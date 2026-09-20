import Link from "next/link";
import { ChevronRight, Play, Sparkles } from "lucide-react";
import { durationLabel, minToHHMM } from "@/lib/time";
import type { LessonCardData } from "@/lib/server/views";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "예정",
  in_progress: "진행 중",
  completed: "완료",
  missed: "지나감",
};

/** 수업 목록의 한 줄. 시간이 왼쪽, 내용이 오른쪽. */
export function LessonCard({ lesson }: { lesson: LessonCardData }) {
  const openable = lesson.isLive || lesson.status === "completed";

  const body = (
    <>
      <div className="lesson-when">
        <strong>{minToHHMM(lesson.start_min)}</strong>
        <span>{durationLabel(lesson.minutes)}</span>
      </div>
      <div className="lesson-body">
        <strong>{lesson.title}</strong>
        <span>
          {lesson.goalTitle}
          {lesson.materialReady && lesson.status !== "completed" ? " · 자료 준비됨" : ""}
          {!lesson.materialReady && (lesson.status === "scheduled" || lesson.status === "in_progress") ? " · 자료 준비 중" : ""}
        </span>
        {lesson.isLive ? (
          <span className="lesson-go">
            <Play size={14} aria-hidden /> 지금 시작하기
          </span>
        ) : lesson.status === "completed" ? (
          <span className="lesson-go" style={{ color: "var(--muted-foreground)" }}>
            결과 보기
          </span>
        ) : null}
      </div>
      <div className="lesson-side">
        {lesson.isLive ? (
          <span className="pill pop-in" data-tone="ok">
            <Sparkles size={11} aria-hidden /> LIVE
          </span>
        ) : lesson.status === "completed" ? (
          <span className="pill" data-tone="ok">
            완료
          </span>
        ) : openable ? (
          <ChevronRight size={18} aria-hidden />
        ) : (
          <span className="pill">{STATUS_LABEL[lesson.status] ?? lesson.status}</span>
        )}
      </div>
    </>
  );

  if (!openable) {
    return (
      <div className="lesson-row" data-state={lesson.status}>
        {body}
      </div>
    );
  }

  return (
    <Link href={`/lesson/${lesson.id}`} className="lesson-row" data-live={lesson.isLive ? "true" : undefined} data-state={lesson.status}>
      {body}
    </Link>
  );
}
