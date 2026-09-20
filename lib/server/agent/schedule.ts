import "server-only";
import { askForJson } from "../ai";
import {
  createLesson,
  listAvailability,
  listBusy,
  listGoals,
  listLessons,
  listUnits,
} from "../repo";
import { agentEditWindow } from "../policy";
import {
  MIN_LESSON_MINUTES,
  addDaysStr,
  fromDateStr,
  mergeRanges,
  minToHHMM,
  subtractRanges,
  todayStr,
  type Range,
} from "@/lib/time";
import type { Lesson } from "@/lib/types";

export interface FreeSlot {
  date: string;
  start: number;
  end: number;
}

/**
 * 공부 가능 시간에서 개인 일정과 이미 잡힌 수업을 뺀, 실제로 비어 있는 구간.
 * 30분 미만 구간은 수업으로 쓸 수 없으므로 버린다.
 */
export function findFreeSlots(userId: string, fromDate: string, days: number): FreeSlot[] {
  const availability = listAvailability(userId);
  const busy = listBusy(userId);
  const lessons = listLessons(userId, fromDate, addDaysStr(fromDate, days));
  const slots: FreeSlot[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = addDaysStr(fromDate, offset);
    const weekday = fromDateStr(date).getDay();

    const open = mergeRanges(
      availability
        .filter((slot) => (slot.kind === "weekly" ? slot.weekday === weekday : slot.date === date))
        .map((slot) => ({ start: slot.start_min, end: slot.end_min })),
    );
    if (!open.length) continue;

    const blocks: Range[] = [
      ...busy
        .filter((event) => (event.kind === "weekly" ? event.weekday === weekday : event.date === date))
        .map((event) => ({ start: event.start_min, end: event.end_min })),
      ...lessons.filter((lesson) => lesson.date === date).map((lesson) => ({ start: lesson.start_min, end: lesson.end_min })),
    ];

    for (const range of subtractRanges(open, blocks)) {
      if (range.end - range.start >= MIN_LESSON_MINUTES) slots.push({ date, start: range.start, end: range.end });
    }
  }

  return slots;
}

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    lessons: {
      type: "array",
      description: "배치한 수업 목록. 주어진 빈 구간 안에서만 잡는다.",
      items: {
        type: "object",
        properties: {
          slot_index: { type: "integer", description: "사용할 빈 구간의 번호" },
          start_min: { type: "integer", description: "시작 시각(자정 기준 분). 구간 안이어야 한다." },
          end_min: { type: "integer", description: "종료 시각. 시작보다 최소 30분 뒤." },
          goal_id: { type: "string", description: "이 수업이 속한 목표 id" },
          unit_title: { type: "string", description: "다룰 단원 이름. 주어진 단원 목록에서 고른다." },
          title: { type: "string", description: "수업 제목. 학생이 보고 무엇을 하는지 알 수 있게." },
          why: { type: "string", description: "이 시간에 이 단원을 넣은 이유 한 문장" },
        },
        required: ["slot_index", "start_min", "end_min", "goal_id", "unit_title", "title"],
      },
    },
  },
  required: ["lessons"],
};

const SYSTEM = `당신은 학생의 학습 일정을 짜는 과외 선생님입니다.
주어진 "빈 구간" 안에서만 수업을 배치합니다.

규칙:
- 수업은 최소 30분입니다. 빈 구간을 넘어가는 수업은 만들지 않습니다.
- 한 구간이 길면 쪼개서 여러 수업을 넣어도 되고, 한 수업을 길게 잡아도 됩니다. 집중 시간을 생각해 90분을 넘기지 않습니다.
- 목표가 여러 개면 중요도와 남은 기간을 보고 며칠에 걸쳐 고르게 나눕니다. 한 목표만 몰아서 하지 않습니다.
- 단원은 주어진 목록에서 앞 순서(아직 안 한 것)부터, 숙련도가 낮은 것을 우선합니다.
- 같은 날 같은 단원을 반복해서 넣지 않습니다.
- 모든 문장은 한국어로 씁니다.`;

/**
 * 비어 있는 시간에 수업을 배치한다.
 * 어떤 날 어떤 단원을 할지는 AI 가 정하고, 시간 계산과 겹침 검사는 코드가 보장한다.
 */
export async function planLessons(userId: string, options: { fromDate?: string; days?: number } = {}) {
  const window = agentEditWindow(userId);
  const fromDate = options.fromDate ?? window.fromDate;
  const days = options.days ?? 14;

  const goals = listGoals(userId);
  if (!goals.length) return [];

  const slots = findFreeSlots(userId, fromDate, days).filter(
    (slot) => slot.date > window.fromDate || (slot.date === window.fromDate && slot.start >= window.fromMinute),
  );
  if (!slots.length) return [];

  const unitsByGoal = goals.map((goal) => ({ goal, units: listUnits(userId, goal.id) }));

  const plan = await askForJson<{
    lessons: {
      slot_index: number;
      start_min: number;
      end_min: number;
      goal_id: string;
      unit_title: string;
      title: string;
      why?: string;
    }[];
  }>({
    system: SYSTEM,
    name: "plan_lessons",
    description: "빈 구간에 수업을 배치한다.",
    schema: PLAN_SCHEMA,
    messages: [
      {
        role: "user",
        content: [
          "[목표와 단원]",
          ...unitsByGoal.map(({ goal, units }) =>
            [
              `목표 ${goal.id} · ${goal.title}${goal.target_date ? ` (목표일 ${goal.target_date})` : ""}`,
              ...units.map(
                (unit, index) =>
                  `  ${index + 1}. ${unit.title} · 난이도 ${unit.difficulty} · 중요도 ${unit.weight} · 숙련도 ${unit.mastery}% · ${unit.status}`,
              ),
            ].join("\n"),
          ),
          "",
          "[빈 구간]",
          ...slots.map(
            (slot, index) =>
              `${index}. ${slot.date} ${minToHHMM(slot.start)}~${minToHHMM(slot.end)} (${slot.end - slot.start}분)`,
          ),
          "",
          `오늘은 ${todayStr()} 입니다. 위 구간에만 수업을 배치하세요.`,
        ].join("\n"),
      },
    ],
  });

  return commitPlan(userId, slots, plan.lessons ?? []);
}

/** AI 가 준 배치를 실제 구간 안으로 끼워 맞춰 저장한다. */
function commitPlan(
  userId: string,
  slots: FreeSlot[],
  drafts: { slot_index: number; start_min: number; end_min: number; goal_id: string; unit_title: string; title: string }[],
): Lesson[] {
  const goals = new Set(listGoals(userId).map((goal) => goal.id));
  const units = listUnits(userId);
  const used = new Map<number, Range[]>();
  const created: Lesson[] = [];

  for (const draft of drafts) {
    const slot = slots[draft.slot_index];
    if (!slot) continue;
    if (!goals.has(draft.goal_id)) continue;

    // 구간 밖으로 나가지 않도록 자른다.
    const start = Math.max(slot.start, Math.round(draft.start_min));
    const end = Math.min(slot.end, Math.round(draft.end_min));
    if (end - start < MIN_LESSON_MINUTES) continue;

    const taken = used.get(draft.slot_index) ?? [];
    if (taken.some((range) => start < range.end && range.start < end)) continue;
    taken.push({ start, end });
    used.set(draft.slot_index, taken);

    const unit = units.find((u) => u.goal_id === draft.goal_id && u.title === draft.unit_title);

    created.push(
      createLesson(userId, {
        goal_id: draft.goal_id,
        unit_id: unit?.id ?? null,
        series_id: null,
        title: draft.title || draft.unit_title,
        date: slot.date,
        start_min: start,
        end_min: end,
        status: "scheduled",
        origin: "agent",
      }),
    );
  }

  return created;
}

/** AI 없이도 일정이 비어 있지 않도록 하는 단순 배치 */
export function fallbackPlan(userId: string, fromDate: string, days = 14): Lesson[] {
  const goals = listGoals(userId);
  if (!goals.length) return [];
  const slots = findFreeSlots(userId, fromDate, days);
  const created: Lesson[] = [];
  let goalIndex = 0;

  for (const slot of slots.slice(0, 14)) {
    const goal = goals[goalIndex % goals.length];
    goalIndex += 1;
    const units = listUnits(userId, goal.id).filter((unit) => unit.status !== "done");
    const unit = units[0];
    const end = Math.min(slot.end, slot.start + 60);
    if (end - slot.start < MIN_LESSON_MINUTES) continue;
    created.push(
      createLesson(userId, {
        goal_id: goal.id,
        unit_id: unit?.id ?? null,
        series_id: null,
        title: unit ? unit.title : goal.title,
        date: slot.date,
        start_min: slot.start,
        end_min: end,
        status: "scheduled",
        origin: "agent",
      }),
    );
  }
  return created;
}
