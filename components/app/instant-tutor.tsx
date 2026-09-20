"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Sparkles, Zap } from "lucide-react";
import { MotionButton } from "@/components/system/motion-button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { startInstantAction } from "@/lib/actions/lesson";

const DURATIONS = [15, 30, 45, 60];

/**
 * 즉시 과외. "지금부터 n분" 을 고르면 에이전트가 바로 자료를 만들어 수업을 연다.
 * 끝나면 예약 수업과 똑같이 분석되고 커리큘럼이 바뀐다.
 */
export function InstantTutorCard({ hasGoal }: { hasGoal: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const start = () => {
    setError("");
    startTransition(async () => {
      const result = await startInstantAction({ minutes, topic });
      if (!result.ok || !result.lessonId) {
        setError(result.error ?? "지금은 시작할 수 없어요.");
        return;
      }
      router.push(`/lesson/${result.lessonId}`);
    });
  };

  return (
    <>
      <button type="button" className="instant-card" onClick={() => setOpen(true)} disabled={!hasGoal}>
        <span className="instant-icon" aria-hidden>
          <Zap size={22} />
        </span>
        <span style={{ flex: 1, textAlign: "start" }}>
          <strong>지금 바로 과외</strong>
          <small>{hasGoal ? "15분이든 1시간이든, 에이전트가 맞춰 준비해요" : "목표를 먼저 정해 주세요"}</small>
        </span>
        <span className="instant-go">시작</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>지금부터 얼마나 할까요?</SheetTitle>
            <SheetDescription>고른 시간에 맞춰 카드·문제·시험지를 바로 만들어요. 끝나면 오늘 기록이 커리큘럼에 반영돼요.</SheetDescription>
          </SheetHeader>

          <div className="stack">
            <div className="choice-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              {DURATIONS.map((value) => (
                <button key={value} type="button" className="choice-chip" aria-pressed={minutes === value} onClick={() => setMinutes(value)}>
                  {value}분
                </button>
              ))}
            </div>

            <div className="field">
              <label htmlFor="instant-topic">다룰 주제 (비워 두면 에이전트가 고릅니다)</label>
              <input
                id="instant-topic"
                className="input-lg"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예) 이차함수 최댓값이 헷갈려요"
              />
            </div>

            {error ? (
              <p className="field-error" role="alert">
                <CircleAlert size={16} aria-hidden />
                {error}
              </p>
            ) : null}

            <MotionButton variant="grape" size="lg" loading={pending} onClick={start}>
              <Sparkles size={18} aria-hidden /> {pending ? "자료를 만들고 있어요" : `${minutes}분 과외 시작`}
            </MotionButton>
            {pending ? (
              <p className="muted" style={{ fontSize: 12.5, textAlign: "center" }}>
                카드와 문제를 만드는 데 10초쯤 걸려요.
              </p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
