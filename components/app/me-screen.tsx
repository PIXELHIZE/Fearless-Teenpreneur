"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, CircleAlert, LogOut, Plus, Target, Trash2, TriangleAlert } from "lucide-react";
import { HistoryList, type LessonHistoryRow } from "@/components/app/history-list";
import type { FeedbackEntry } from "@/lib/types";
import { MotionButton } from "@/components/system/motion-button";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHead } from "@/components/app/page-head";
import { addGoalAction, archiveGoalAction } from "@/lib/actions/goals";
import { signOutAction } from "@/lib/actions/auth";

interface GoalView {
  id: string;
  title: string;
  subject: string;
  level: string;
  targetDate: string | null;
  total: number;
  done: number;
  mastery: number;
  units: { id: string; title: string; summary: string; mastery: number; status: string }[];
}

interface Props {
  user: { name: string; email: string; gender: string; birthYear: number | null };
  stats: { streak: number; lessonsDone: number; minutes: number };
  goals: GoalView[];
  revisions: { id: string; reason: string; changes: string[]; effectiveFrom: string; createdAt: number }[];
  analyses: { lessonId: string; summary: string; accuracy: number; focusSeconds: number; createdAt: number }[];
  feedback: FeedbackEntry[];
  lessons: LessonHistoryRow[];
}

const GENDER_LABEL: Record<string, string> = { female: "여성", male: "남성", other: "기타", skip: "밝히지 않음" };
const TONES = ["brand", "grape", "ok", "flame"] as const;

export function MeScreen({ user, stats, goals, revisions, feedback, lessons }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(goals[0]?.id ?? null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [removing, setRemoving] = useState<GoalView | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [detail, setDetail] = useState("");

  const submit = () => {
    setError("");
    startTransition(async () => {
      const result = await addGoalAction({ title, subject, level, targetDate, detail });
      if (!result.ok) {
        setError(result.error ?? "다시 시도해 주세요.");
        return;
      }
      setNote(result.note ?? "");
      setTitle("");
      setSubject("");
      setLevel("");
      setTargetDate("");
      setDetail("");
      setOpen(false);
    });
  };

  const age = user.birthYear ? new Date().getFullYear() - user.birthYear + 1 : null;

  return (
    <main className="app-main">
      <PageHead title="내 정보" />

      <section className="profile-hero rise">
        <div className="row" style={{ gap: 14 }}>
          <span className="profile-avatar" aria-hidden>
            {user.name.slice(0, 1) || "학"}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="profile-name">{user.name}</div>
            <div className="profile-sub">
              {[GENDER_LABEL[user.gender], age ? `${age}세` : null].filter(Boolean).join(" · ") || "기본 정보 미입력"}
            </div>
          </div>
        </div>
        <div className="profile-stats">
          <div className="profile-stat">
            <strong>{stats.streak}</strong>
            <small>연속 일수</small>
          </div>
          <div className="profile-stat">
            <strong>{stats.lessonsDone}</strong>
            <small>마친 수업</small>
          </div>
          <div className="profile-stat">
            <strong>{stats.minutes >= 60 ? `${Math.round(stats.minutes / 60)}h` : `${stats.minutes}m`}</strong>
            <small>공부 시간</small>
          </div>
        </div>
      </section>

      <section className="rise rise-1">
        <div className="section-title">
          <h2>목표와 커리큘럼</h2>
          <button type="button" onClick={() => setOpen(true)}>
            <Plus size={14} aria-hidden /> 목표 추가
          </button>
        </div>

        {note ? (
          <p className="verdict" data-ok="true" style={{ marginBottom: 12 }}>
            <CircleAlert size={16} aria-hidden />
            <span>{note}</span>
          </p>
        ) : null}

        <div className="stack">
          {goals.map((goal, index) => {
            const isOpen = expanded === goal.id;
            const tone = TONES[index % TONES.length];
            return (
              <div key={goal.id} className="goal-card">
                <div className="goal-card-head">
                  <span className="icon-tile" data-tone={tone} aria-hidden>
                    <Target size={20} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{goal.title}</strong>
                    <p>{[goal.subject, goal.targetDate ? `목표일 ${goal.targetDate}` : null].filter(Boolean).join(" · ") || "과목 미입력"}</p>
                  </div>
                  <button type="button" className="icon-button" aria-label="목표 지우기" onClick={() => setRemoving(goal)}>
                    <Trash2 size={17} aria-hidden />
                  </button>
                </div>
                <div className="goal-card-body">
                  <div className="row-between">
                    <span className="pill" data-tone="ok">
                      숙련도 {goal.mastery}%
                    </span>
                    <span className="muted tnum" style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {goal.done}/{goal.total} 단원 완료
                    </span>
                  </div>
                  <div className="bar" data-tone="ok">
                    <span style={{ width: `${goal.mastery}%` }} />
                  </div>
                </div>

                <button type="button" className="goal-toggle" onClick={() => setExpanded(isOpen ? null : goal.id)} aria-expanded={isOpen}>
                  <span style={{ flex: 1, textAlign: "start" }}>단원 {goal.units.length}개 보기</span>
                  <ChevronDown size={18} aria-hidden style={{ transform: isOpen ? "rotate(180deg)" : undefined, transition: "transform var(--motion-state)" }} />
                </button>

                {isOpen ? (
                  <ul className="unit-list">
                    {goal.units.map((unit, unitIndex) => (
                      <li key={unit.id}>
                        <span className="unit-num" data-state={unit.status === "done" ? "done" : unit.mastery > 0 ? "learning" : undefined}>
                          {unit.status === "done" ? <Check size={14} /> : unitIndex + 1}
                        </span>
                        <div className="unit-copy">
                          <strong>{unit.title}</strong>
                          <p>{unit.summary}</p>
                        </div>
                        <span className="pill tnum" data-tone={unit.status === "done" ? "ok" : unit.mastery > 0 ? "brand" : undefined}>
                          {unit.mastery}%
                        </span>
                      </li>
                    ))}
                    {!goal.units.length ? (
                      <li className="muted" style={{ fontSize: 13.5 }}>
                        단원을 준비하고 있어요.
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            );
          })}

          {!goals.length ? (
            <div className="card stack" style={{ gap: 12 }}>
              <div className="row" style={{ gap: 12 }}>
                <span className="icon-tile" data-tone="grape" aria-hidden>
                  <Target size={20} />
                </span>
                <div>
                  <strong style={{ fontSize: 16, fontWeight: 800 }}>목표를 하나 정해 볼까요</strong>
                  <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 2 }}>
                    목표를 추가하면 커리큘럼과 수업 일정이 함께 만들어져요.
                  </p>
                </div>
              </div>
              <MotionButton type="button" variant="grape" size="lg" onClick={() => setOpen(true)}>
                <Plus size={16} aria-hidden /> 목표 추가
              </MotionButton>
            </div>
          ) : null}
        </div>
      </section>

      {revisions.length ? (
        <section className="rise rise-2">
          <div className="section-title">
            <h2>커리큘럼이 바뀐 기록</h2>
          </div>
          <div className="log-list">
            {revisions.map((revision) => (
              <div key={revision.id} className="log-item">
                <time>{revision.effectiveFrom} 수업부터</time>
                <strong>{revision.reason}</strong>
                <ul>
                  {revision.changes.map((change, index) => (
                    <li key={index}>· {change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rise rise-3">
        <div className="section-title">
          <h2>피드백 · 수업 기록</h2>
          <Link href="/me/history">
            전체 보기 <ChevronRight size={14} aria-hidden />
          </Link>
        </div>
        <HistoryList feedback={feedback} lessons={lessons} />
      </section>

      <section className="rise rise-3">
        <div className="section-title">
          <h2>계정</h2>
        </div>
        <div className="card-list">
          <div className="card-row">
            <span className="icon-tile" aria-hidden style={{ width: 38, height: 38, borderRadius: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>@</span>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 14, fontWeight: 700 }}>이메일</strong>
              <p className="muted" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
            </div>
          </div>
          <form action={signOutAction} style={{ display: "contents" }}>
            <button type="submit" className="card-row" style={{ width: "100%", border: 0, background: "none", color: "inherit", textAlign: "start" }}>
              <span className="icon-tile" data-tone="coral" aria-hidden style={{ width: 38, height: 38, borderRadius: 12 }}>
                <LogOut size={17} />
              </span>
              <strong style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>로그아웃</strong>
              <ChevronRight size={18} aria-hidden style={{ color: "var(--muted-foreground)" }} />
            </button>
          </form>
        </div>
      </section>

      <Dialog open={Boolean(removing)} onOpenChange={(value) => !value && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="row" style={{ gap: 8 }}>
              <TriangleAlert size={18} aria-hidden /> 목표를 지울까요?
            </DialogTitle>
            <DialogDescription>
              &ldquo;{removing?.title}&rdquo; 의 커리큘럼과 아직 하지 않은 관련 수업이 함께 사라져요. 지난 수업 기록과 피드백은 남습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              그대로 둘게요
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!removing) return;
                const target = removing;
                startTransition(async () => {
                  const result = await archiveGoalAction(target.id);
                  setRemoving(null);
                  setNote(result.removedLessons ? `관련 수업 ${result.removedLessons}개를 함께 정리했어요.` : "");
                });
              }}
            >
              지우기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>새 목표</SheetTitle>
            <SheetDescription>목표를 추가하면 커리큘럼과 일정이 함께 만들어져요.</SheetDescription>
          </SheetHeader>

          <div className="stack">
            <div className="field">
              <label htmlFor="g-title">목표</label>
              <input id="g-title" className="input-lg" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 영어 단어 1000개 외우기" />
            </div>
            <div className="field-pair">
              <div className="field">
                <label htmlFor="g-subject">과목</label>
                <input id="g-subject" className="input-lg" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="g-date">목표일</label>
                <input id="g-date" type="date" className="input-lg tnum" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="g-level">지금 수준</label>
              <input id="g-level" className="input-lg" value={level} onChange={(e) => setLevel(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="g-detail">더 알려 주고 싶은 것</label>
              <textarea id="g-detail" className="input-lg" value={detail} onChange={(e) => setDetail(e.target.value)} />
            </div>

            {error ? (
              <p className="field-error" role="alert">
                <CircleAlert size={16} aria-hidden />
                {error}
              </p>
            ) : null}

            <MotionButton type="button" variant="grape" size="lg" loading={pending} onClick={submit}>
              목표 추가하고 계획 짜기
            </MotionButton>
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
              다가오는 수업은 그대로 두고, 그 다음 수업부터 새 목표가 들어가요.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
