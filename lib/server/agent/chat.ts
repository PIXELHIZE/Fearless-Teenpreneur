import "server-only";
import { askForJson } from "../ai";
import { db } from "../db";
import {
  addChat,
  addUnit,
  createGoal,
  listChat,
  listGoals,
  listLessons,
  listUnits,
  recordRevision,
  updateUnit,
  upcomingLessons,
} from "../repo";
import { agentEditWindow, isLessonLocked } from "../policy";
import { buildCurriculum } from "./curriculum";
import { planLessons } from "./schedule";
import { startInstantLesson } from "./instant";
import { minToHHMM, relativeDateLabel, todayStr } from "@/lib/time";
import type { User } from "../auth";

type Action =
  | { type: "replan_schedule"; reason: string }
  | { type: "add_goal"; title: string; subject?: string; detail?: string; level?: string; target_date?: string }
  | { type: "cancel_lessons"; from_date: string; to_date: string; reason: string }
  | { type: "adjust_curriculum"; goal_title: string; add_units?: { title: string; summary: string }[]; emphasize?: string[]; reason: string }
  | { type: "instant_lesson"; minutes: number; topic?: string };

const SCHEMA = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "학생에게 보여 줄 답변. 한국어로 3문장 이내. 무엇을 바꿨는지 분명히 말한다.",
    },
    actions: {
      type: "array",
      description: "실제로 실행할 변경. 대화만 하면 빈 배열.",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["replan_schedule", "add_goal", "cancel_lessons", "adjust_curriculum", "instant_lesson"],
          },
          reason: { type: "string", description: "왜 이 변경을 하는지" },
          title: { type: "string", description: "add_goal 일 때 목표 이름" },
          subject: { type: "string" },
          detail: { type: "string" },
          level: { type: "string", description: "현재 수준" },
          target_date: { type: "string", description: "YYYY-MM-DD" },
          from_date: { type: "string", description: "cancel_lessons 시작일 YYYY-MM-DD" },
          to_date: { type: "string", description: "cancel_lessons 종료일 YYYY-MM-DD" },
          goal_title: { type: "string", description: "adjust_curriculum 대상 목표" },
          add_units: {
            type: "array",
            items: {
              type: "object",
              properties: { title: { type: "string" }, summary: { type: "string" } },
              required: ["title"],
            },
          },
          emphasize: { type: "array", items: { type: "string" }, description: "비중을 올릴 단원 이름" },
          minutes: { type: "integer", description: "instant_lesson 의 길이(분). 15~120." },
          topic: { type: "string", description: "instant_lesson 에서 다룰 주제. 없으면 생략." },
        },
        required: ["type"],
      },
    },
  },
  required: ["message"],
};

function system(window: ReturnType<typeof agentEditWindow>) {
  return `당신은 teum 의 학습 담당 AI 에이전트입니다. 학생 한 명을 전담하는 과외 선생님처럼 말합니다.

할 수 있는 일:
- 스케줄 다시 짜기 (replan_schedule)
- 새 목표 추가 (add_goal) — 목표를 추가하면 커리큘럼도 같이 설계됩니다
- 특정 기간 수업 비우기 (cancel_lessons)
- 커리큘럼 손보기 (adjust_curriculum)
- 즉시 과외 시작 (instant_lesson) — "지금 30분만 봐 줘" 처럼 지금 바로 공부하겠다고 하면 이걸 씁니다. 분 수를 말하지 않으면 30분.

반드시 지킬 규칙:
- **다가오는 수업과 오늘 수업은 절대 바꾸지 않습니다.** 변경은 ${window.fromDate} 이후 수업부터 적용됩니다.
  학생이 "지금 바꿔 줘" 라고 해도, 가장 가까운 수업은 그대로 두고 그 다음부터 바꾼다고 알려 주세요.
- 학생이 단순히 질문만 하면 actions 는 빈 배열로 두고 답만 합니다.
- 확실하지 않으면 멋대로 바꾸지 말고 한 번 되물어 봅니다.
- 말투는 짧고 다정하게. 한국어로 3문장 이내.`;
}

export interface AgentReply {
  message: string;
  actions: string[];
  /** 즉시 과외를 열었을 때 바로 이동할 경로 */
  redirect?: string;
}

export async function runAgentChat(user: User, message: string): Promise<AgentReply> {
  addChat(user.id, { role: "user", content: message });

  const window = agentEditWindow(user.id);
  const goals = listGoals(user.id);
  const upcoming = upcomingLessons(user.id, 6);
  const history = listChat(user.id, "agent", 12);

  const context = [
    `오늘은 ${todayStr()} 입니다.`,
    "",
    "[목표]",
    ...goals.map((goal) => `- ${goal.title}${goal.target_date ? ` (목표일 ${goal.target_date})` : ""} · ${goal.level || "수준 미입력"}`),
    "",
    "[다가오는 수업]",
    ...upcoming.map(
      (lesson, index) =>
        `${index === 0 ? "▶ (보호됨, 바꿀 수 없음) " : "  "}${relativeDateLabel(lesson.date)} ${minToHHMM(lesson.start_min)}~${minToHHMM(lesson.end_min)} · ${lesson.title}`,
    ),
    "",
    "[커리큘럼]",
    ...goals.flatMap((goal) => [
      `· ${goal.title}`,
      ...listUnits(user.id, goal.id)
        .slice(0, 8)
        .map((unit) => `   - ${unit.title} (숙련도 ${unit.mastery}%, ${unit.status})`),
    ]),
  ].join("\n");

  const result = await askForJson<{ message: string; actions?: Record<string, unknown>[] }>({
    system: system(window),
    name: "respond",
    description: "학생에게 답하고, 필요하면 변경을 실행한다.",
    schema: SCHEMA,
    messages: [
      { role: "user", content: context },
      ...history.slice(-8).map((entry) => ({ role: entry.role, content: entry.content })),
      { role: "user" as const, content: message },
    ],
  });

  const { done, redirect } = await executeActions(user, (result.actions ?? []) as unknown as Action[]);
  const scheduleChanged = done.some((d) => !d.startsWith("즉시 과외"));
  const text = scheduleChanged ? `${result.message}\n\n${window.reason}` : result.message;

  addChat(user.id, { role: "assistant", content: text, actions: done });
  return { message: text, actions: done, redirect };
}

async function executeActions(user: User, actions: Action[]): Promise<{ done: string[]; redirect?: string }> {
  const done: string[] = [];
  let redirect: string | undefined;
  const window = agentEditWindow(user.id);

  for (const action of actions) {
    try {
      if (action.type === "instant_lesson") {
        const lesson = await startInstantLesson(user.id, { minutes: action.minutes || 30, topic: action.topic });
        done.push(`즉시 과외 시작 · ${lesson.title}`);
        redirect = `/lesson/${lesson.id}`;
        continue;
      }

      if (action.type === "add_goal" && action.title) {
        const goal = createGoal(user.id, {
          title: action.title,
          subject: action.subject ?? "",
          detail: action.detail ?? "",
          level: action.level ?? "",
          target_date: action.target_date ?? null,
        });
        await buildCurriculum(user.id, goal, { name: user.name, age: age(user) });
        await planLessons(user.id, { fromDate: window.fromDate });
        done.push(`목표 추가 · ${goal.title}`);
        continue;
      }

      if (action.type === "cancel_lessons") {
        const removed = clearLessons(user.id, action.from_date, action.to_date);
        done.push(`${action.from_date}~${action.to_date} 수업 ${removed}개 정리`);
        continue;
      }

      if (action.type === "adjust_curriculum") {
        const goal = listGoals(user.id).find((g) => g.title === action.goal_title) ?? listGoals(user.id)[0];
        if (!goal) continue;
        const log: string[] = [];
        for (const unit of action.add_units ?? []) {
          addUnit(user.id, goal.id, { title: unit.title, summary: unit.summary ?? "", difficulty: 3, weight: 4 });
          log.push(`단원 추가 · ${unit.title}`);
        }
        const units = listUnits(user.id, goal.id);
        for (const title of action.emphasize ?? []) {
          const unit = units.find((u) => u.title === title);
          if (!unit) continue;
          updateUnit(user.id, unit.id, { weight: Math.min(5, unit.weight + 1), status: "todo" });
          log.push(`${unit.title} 비중 상향`);
        }
        if (log.length) {
          recordRevision(user.id, {
            goalId: goal.id,
            reason: action.reason ?? "대화로 조정",
            changes: log,
            effectiveFrom: window.fromDate,
          });
          done.push(`커리큘럼 조정 · ${goal.title}`);
        }
        continue;
      }

      if (action.type === "replan_schedule") {
        clearLessons(user.id, window.fromDate, addDays(window.fromDate, 21));
        const created = await planLessons(user.id, { fromDate: window.fromDate, days: 21 });
        done.push(`스케줄 다시 배치 · ${created.length}개`);
      }
    } catch (error) {
      console.error("[agent] 실행 실패", action.type, error);
    }
  }

  return { done, redirect };
}

/** 보호되는 수업(오늘·다가오는 수업)은 남기고 지운다. */
function clearLessons(userId: string, fromDate: string, toDate: string) {
  const window = agentEditWindow(userId);
  const targets = listLessons(userId, fromDate, toDate).filter((lesson) => !isLessonLocked(lesson, window));
  const remove = db.prepare(`DELETE FROM lessons WHERE id = ?`);
  db.transaction(() => targets.forEach((lesson) => remove.run(lesson.id)))();
  return targets.length;
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function age(user: User) {
  return user.birth_year ? new Date().getFullYear() - user.birth_year + 1 : null;
}
