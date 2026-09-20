"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleSlash, FileCheck2, Sparkles, Zap } from "lucide-react";
import type { FeedbackEntry } from "@/lib/types";
import { minToHHMM, relativeDateLabel } from "@/lib/time";

export interface LessonHistoryRow {
  id: string;
  title: string;
  date: string;
  start_min: number;
  end_min: number;
  status: string;
  origin: string;
  minutes: number;
  accuracy: number | null;
  summary: string;
}

const KIND: Record<FeedbackEntry["kind"], { label: string; tone: string; icon: typeof Sparkles }> = {
  lesson: { label: "수업", tone: "brand", icon: Sparkles },
  exam: { label: "시험지", tone: "grape", icon: FileCheck2 },
  instant: { label: "즉시 과외", tone: "sun", icon: Zap },
};

function tone(accuracy: number | null) {
  if (accuracy === null) return undefined;
  return accuracy >= 80 ? "ok" : accuracy >= 50 ? "sun" : "coral";
}

/** 피드백 / 수업 기록 두 탭 */
export function HistoryList({ feedback, lessons }: { feedback: FeedbackEntry[]; lessons: LessonHistoryRow[] }) {
  const [tab, setTab] = useState<"feedback" | "lessons">("feedback");
  const [openId, setOpenId] = useState<string | null>(feedback[0]?.id ?? null);

  return (
    <>
      <div className="segment" role="tablist">
        <button type="button" role="tab" aria-pressed={tab === "feedback"} onClick={() => setTab("feedback")}>
          피드백 {feedback.length}
        </button>
        <button type="button" role="tab" aria-pressed={tab === "lessons"} onClick={() => setTab("lessons")}>
          수업 기록 {lessons.length}
        </button>
      </div>

      {tab === "feedback" ? (
        feedback.length ? (
          <div className="stack-sm">
            {feedback.map((entry) => {
              const meta = KIND[entry.kind] ?? KIND.lesson;
              const Icon = meta.icon;
              const open = openId === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="feedback-card"
                  data-open={open ? "true" : undefined}
                  onClick={() => setOpenId(open ? null : entry.id)}
                >
                  <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                    <span className="icon-tile" data-tone={meta.tone} aria-hidden style={{ width: 40, height: 40, borderRadius: 13 }}>
                      <Icon size={18} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row-between">
                        <strong style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-.02em" }}>{entry.title}</strong>
                        <span className="pill tnum" data-tone={tone(entry.accuracy)}>
                          {entry.accuracy}%
                        </span>
                      </div>
                      <p className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                        {meta.label} · {new Date(entry.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                      </p>
                      <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>{entry.summary}</p>
                    </div>
                  </div>

                  {open ? (
                    <div className="feedback-detail">
                      {entry.strengths.length ? (
                        <div>
                          <span className="pill" data-tone="ok">잘한 점</span>
                          <ul>
                            {entry.strengths.map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {entry.weaknesses.length ? (
                        <div>
                          <span className="pill" data-tone="coral">보충할 점</span>
                          <ul>
                            {entry.weaknesses.map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {entry.feedback ? <p className="feedback-say">{entry.feedback}</p> : null}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="time-empty">
            <strong>아직 피드백이 없어요</strong>
            <span>수업을 마치거나 시험지를 채점받으면 여기에 쌓여요.</span>
          </div>
        )
      ) : lessons.length ? (
        <div className="card-list">
          {lessons.map((lesson) => {
            const done = lesson.status === "completed";
            return (
              <Link key={lesson.id} href={`/lesson/${lesson.id}`} className="card-row" style={{ textDecoration: "none", color: "inherit", alignItems: "flex-start" }}>
                <span className="icon-tile" data-tone={done ? "ok" : "coral"} aria-hidden style={{ width: 38, height: 38, borderRadius: 12 }}>
                  {done ? <CircleCheck size={17} /> : <CircleSlash size={17} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-.02em" }}>{lesson.title}</strong>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                    {relativeDateLabel(lesson.date)} {minToHHMM(lesson.start_min)}–{minToHHMM(lesson.end_min)}
                    {lesson.origin === "instant" ? " · 즉시 과외" : ""}
                    {done ? ` · ${lesson.minutes}분 참여` : " · 참여하지 않음"}
                  </p>
                  {lesson.summary ? (
                    <p style={{ fontSize: 13.5, lineHeight: 1.65, marginTop: 6 }}>{lesson.summary}</p>
                  ) : null}
                </div>
                {lesson.accuracy !== null && done ? (
                  <span className="pill tnum" data-tone={tone(lesson.accuracy)}>
                    {lesson.accuracy}%
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="time-empty">
          <strong>아직 지난 수업이 없어요</strong>
          <span>첫 수업을 마치면 여기서 기록을 볼 수 있어요.</span>
        </div>
      )}
    </>
  );
}
