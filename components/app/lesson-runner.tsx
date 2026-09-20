"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { MathText } from "@/components/app/math-text";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CircleCheck,
  CircleX,
  Clock,
  MessageCircleQuestion,
  NotebookPen,
  Sparkles,
  X,
} from "lucide-react";
import { MotionButton } from "@/components/system/motion-button";
import { DetailBar } from "@/components/app/detail-bar";
import { Confetti } from "@/components/app/confetti";
import { SlideVisual } from "@/components/app/slide-visual";
import { useCountUp } from "@/components/app/count-up";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  answerQuiz,
  askDuringLesson,
  finishLesson,
  heartbeat,
  openExamNote,
  openLesson,
  setStage,
  type LessonReport,
  type LessonView,
} from "@/lib/actions/lesson";
import { durationLabel, minToHHMM } from "@/lib/time";
import type { LessonStage } from "@/lib/types";

const HEARTBEAT_MS = 15_000;

export function LessonRunner({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [view, setView] = useState<LessonView | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStageState] = useState<LessonStage>("slides");
  const [slide, setSlide] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ correct: boolean; answer: string; explain: string } | null>(null);
  const [report, setReport] = useState<LessonReport | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    void openLesson(lessonId).then((data) => {
      if (!alive) return;
      setView(data);
      setLoading(false);
      if (data) {
        // 이미 마친 수업이면 결과부터 보여 주고 "닫기" 로 나간다
        setAlreadyDone(Boolean(data.progress.completed_at));
        setStageState(data.progress.completed_at ? "report" : data.progress.stage);
        setSlide(Math.min(data.progress.slide_index, Math.max(0, data.material.slides.length - 1)));
        setQuizIndex(Math.min(data.progress.quiz_index, Math.max(0, data.material.quiz.length - 1)));
      }
    });
    return () => {
      alive = false;
    };
  }, [lessonId]);

  // 화면에 실제로 머문 시간만 쌓는다.
  useEffect(() => {
    if (!view?.open || alreadyDone) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void heartbeat(lessonId, HEARTBEAT_MS / 1000, { slide_index: slide, quiz_index: quizIndex, stage });
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [lessonId, view?.open, slide, quizIndex, stage, alreadyDone]);

  const go = useCallback(
    (next: LessonStage) => {
      setStageState(next);
      startTransition(async () => {
        await setStage(lessonId, next);
      });
    },
    [lessonId],
  );

  if (loading) return <LessonSkeleton />;
  if (!view) {
    return (
      <Centered title="수업을 찾을 수 없어요" description="목록에서 다시 골라 주세요.">
        <Button asChild variant="outline">
          <Link href="/lessons">수업 목록</Link>
        </Button>
      </Centered>
    );
  }

  if (view.material.status !== "ready") {
    return <PreparingScreen title={view.title} failed={view.material.status === "failed"} onBack={() => router.push("/lessons")} />;
  }

  const slides = view.material.slides;
  const quiz = view.material.quiz;
  const current = quiz[quizIndex];

  return (
    <div className="app-shell">
      <DetailBar
        close
        href="/lessons"
        title={view.title}
        subtitle={`${minToHHMM(view.startMin)}–${minToHHMM(view.endMin)} · ${durationLabel(view.minutes)}`}
        side={view.open ? null : <span className="pill" style={{ marginInlineEnd: 8 }}>지난 수업</span>}
      />

      <main className="app-main app-main--bare" style={{ paddingTop: 20 }}>
        {stage === "slides" ? (
          <SlideStage
            slides={slides}
            index={slide}
            onIndex={setSlide}
            onDone={() => go(quiz.length ? "quiz" : "exam")}
            hasQuiz={quiz.length > 0}
            onAsk={() => setAskOpen(true)}
          />
        ) : null}

        {stage === "quiz" && current ? (
          <QuizStage
            item={current}
            index={quizIndex}
            total={quiz.length}
            picked={picked}
            verdict={verdict}
            onPick={(value) => {
              if (verdict) return;
              setPicked(value);
              startTransition(async () => {
                const result = await answerQuiz(lessonId, current.id, value);
                setVerdict(result);
              });
            }}
            onNext={() => {
              setPicked(null);
              setVerdict(null);
              if (quizIndex + 1 < quiz.length) setQuizIndex(quizIndex + 1);
              else go("exam");
            }}
          />
        ) : null}

        {stage === "exam" ? (
          <ExamStage
            lessonId={lessonId}
            exam={view.material.exam}
            noteId={view.noteId}
            graded={view.answers.filter((answer) => answer.kind === "exam")}
            onSkip={() =>
              startTransition(async () => {
                setReport(await finishLesson(lessonId));
                go("report");
              })
            }
          />
        ) : null}

        {stage === "report" ? (
          <ReportStage
            lessonId={lessonId}
            report={report}
            analysis={view.analysis}
            closeLabel={alreadyDone ? "닫기" : "수업 마치기"}
            onLoad={(value) => setReport(value)}
            onExit={() => router.push("/lessons")}
          />
        ) : null}
      </main>

      <AskSheet lessonId={lessonId} open={askOpen} onOpenChange={setAskOpen} />
    </div>
  );
}

/* ── 슬라이드 (카드뉴스) ───────────────────────────────────────────── */

function SlideStage({
  slides,
  index,
  onIndex,
  onDone,
  hasQuiz,
  onAsk,
}: {
  slides: LessonView["material"]["slides"];
  index: number;
  onIndex: (value: number) => void;
  onDone: () => void;
  hasQuiz: boolean;
  onAsk: () => void;
}) {
  const slide = slides[index];
  const last = index >= slides.length - 1;
  const touch = useRef<number | null>(null);

  if (!slide) return null;

  return (
    <>
      <div className="slide-dots" aria-hidden>
        {slides.map((item, i) => (
          <span key={item.id} className="slide-dot" data-on={i <= index ? "true" : undefined} />
        ))}
      </div>

      <div
        onTouchStart={(event) => (touch.current = event.touches[0].clientX)}
        onTouchEnd={(event) => {
          if (touch.current === null) return;
          const delta = event.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (delta < -50 && !last) onIndex(index + 1);
          if (delta > 50 && index > 0) onIndex(index - 1);
        }}
      >
        <article className="slide-card rise" key={slide.id}>
          <span className="slide-index">
            {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </span>
          <MathText as="h3" text={slide.title} />
          <MathText as="p" text={slide.body} />
          {slide.visual ? <SlideVisual visual={slide.visual} /> : null}
          {slide.bullets?.length ? (
            <ul className="slide-bullets">
              {slide.bullets.map((bullet, i) => (
                <li key={i}>
                  <MathText text={bullet} />
                </li>
              ))}
            </ul>
          ) : null}
          {slide.example ? <MathText as="p" className="slide-example" text={slide.example} /> : null}
        </article>
      </div>

      <div className="action-row">
        <Button variant="outline" size="icon" aria-label="이전" disabled={index === 0} onClick={() => onIndex(index - 1)} >
          <ArrowLeft aria-hidden />
        </Button>
        <Button variant="outline" size="lg" onClick={onAsk} style={{ flex: 1 }}>
          <MessageCircleQuestion size={16} aria-hidden /> 질문하기
        </Button>
        {last ? (
          <MotionButton variant="ok" size="lg" onClick={onDone} style={{ flex: 1.4 }}>
            {hasQuiz ? "문제 풀기" : "마무리"} <ArrowRight size={16} aria-hidden />
          </MotionButton>
        ) : (
          <MotionButton variant="brand" size="lg" onClick={() => onIndex(index + 1)} style={{ flex: 1.4 }}>
            다음 <ArrowRight size={16} aria-hidden />
          </MotionButton>
        )}
      </div>
    </>
  );
}

/* ── 퀴즈 ──────────────────────────────────────────────────────────── */

function QuizStage({
  item,
  index,
  total,
  picked,
  verdict,
  onPick,
  onNext,
}: {
  item: LessonView["material"]["quiz"][number];
  index: number;
  total: number;
  picked: string | null;
  verdict: { correct: boolean; answer: string; explain: string } | null;
  onPick: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="row" style={{ gap: 12 }}>
        <span className="slide-index" style={{ flex: "none" }}>
          Q {index + 1} / {total}
        </span>
        <div className="progress-thin" data-tone="ok" style={{ flex: 1 }}>
          <span style={{ width: `${((index + (verdict ? 1 : 0)) / total) * 100}%` }} />
        </div>
      </div>

      <MathText as="p" className="quiz-q rise" text={item.question} />

      {item.kind === "ox" ? (
        <div className="ox-pair rise rise-1">
          {["O", "X"].map((value) => (
            <button
              key={value}
              type="button"
              className="ox-button"
              data-side={value}
              data-picked={picked === value ? "true" : undefined}
              disabled={Boolean(verdict)}
              onClick={() => onPick(value)}
            >
              {value}
              <small>{value === "O" ? "맞다" : "틀리다"}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="choice-list rise rise-1">
          {(item.choices ?? []).map((choice, i) => {
            const value = String(i + 1);
            return (
              <button
                key={value}
                type="button"
                className="choice-row"
                data-picked={picked === value ? "true" : undefined}
                data-truth={verdict && verdict.answer === value ? "correct" : undefined}
                disabled={Boolean(verdict)}
                onClick={() => onPick(value)}
              >
                <span className="choice-num">{value}</span>
                <MathText text={choice} />
              </button>
            );
          })}
        </div>
      )}

      {verdict ? (
        <div className="answer-banner" data-ok={verdict.correct ? "true" : "false"} role="status">
          <div className="answer-banner-head">
            {verdict.correct ? <CircleCheck aria-hidden /> : <CircleX aria-hidden />}
            {verdict.correct ? "맞았어요!" : `정답은 ${verdict.answer}`}
          </div>
          <MathText as="p" text={verdict.explain} />
          <MotionButton variant={verdict.correct ? "ok" : "destructive"} size="lg" onClick={onNext}>
            {index + 1 < total ? "계속하기" : "시험지로"} <ArrowRight size={16} aria-hidden />
          </MotionButton>
        </div>
      ) : null}
    </>
  );
}

/* ── 시험지 안내 ───────────────────────────────────────────────────── */

function ExamStage({
  lessonId,
  exam,
  noteId,
  graded,
  onSkip,
}: {
  lessonId: string;
  exam: LessonView["material"]["exam"];
  noteId: string | null;
  graded: LessonView["answers"];
  onSkip: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 이미 노트에서 채점을 받았으면 점수를 보여 주고 바로 마칠 수 있게 한다.
  if (graded.length && exam.length) {
    const score = graded.reduce((sum, answer) => sum + answer.score, 0);
    const total = exam.reduce((sum, item) => sum + item.points, 0);
    const correct = graded.filter((answer) => answer.is_correct).length;
    return (
      <div className="stack-lg">
        <div className="rise">
          <span className="slide-index">EXAM GRADED</span>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.035em", marginTop: 8 }}>시험지 채점이 끝났어요</h2>
          <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.75, marginTop: 8 }}>
            {exam.length}문항 중 {correct}문항을 맞혔어요. 자세한 풀이 피드백은 노트에서 볼 수 있어요.
          </p>
        </div>

        <div className="stat-grid rise rise-1">
          <div className="stat-tile" data-tone="grape">
            <span className="label">시험지 점수</span>
            <span className="value">
              {score}
              <span className="unit">/ {total}점</span>
            </span>
          </div>
          <div className="stat-tile" data-tone="ok">
            <span className="label">맞힌 문항</span>
            <span className="value">
              {correct}
              <span className="unit">/ {exam.length}</span>
            </span>
          </div>
        </div>

        <div className="card-list rise rise-2">
          {exam.map((item) => {
            const answer = graded.find((row) => row.question_id === item.id);
            return (
              <div key={item.id} className="card-row" style={{ alignItems: "flex-start" }}>
                <span className="pill" data-tone={answer?.is_correct ? "ok" : (answer?.score ?? 0) > 0 ? "sun" : "coral"} style={{ flex: "none" }}>
                  {item.number}번
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MathText as="p" text={item.question} className="muted" />
                  {answer?.comment ? <MathText as="p" text={answer.comment} /> : null}
                </div>
                <span className="tnum" style={{ fontSize: 13, fontWeight: 800, flex: "none" }}>
                  {answer?.score ?? 0}/{item.points}
                </span>
              </div>
            );
          })}
        </div>

        <div className="stack-sm">
          <MotionButton variant="ok" size="lg" onClick={onSkip}>
            <Check size={18} aria-hidden /> 수업 마치기
          </MotionButton>
          {noteId ? (
            <Button variant="ghost" onClick={() => router.push(`/note/${noteId}`)}>
              노트에서 피드백 다시 보기
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!exam.length) {
    return (
      <div className="stack-lg">
        <p style={{ fontSize: 16, lineHeight: 1.8 }}>오늘은 시험지가 없어요. 바로 마무리할게요.</p>
        <MotionButton variant="brand" size="lg" onClick={onSkip}>
          결과 보기
        </MotionButton>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <div className="rise">
        <span className="slide-index">EXAM</span>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.035em", marginTop: 8 }}>
          모의고사처럼
          <br />
          노트에 풀어 보세요
        </h2>
        <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.75, marginTop: 8 }}>
          {exam.length}문항 · 총 {exam.reduce((sum, item) => sum + item.points, 0)}점. 5지선다는 번호에 동그라미를 치고,
          서술형은 빈칸에 쓰면 AI 가 읽고 채점해요.
        </p>
      </div>

      <div className="exam-sheet rise rise-1">
        {exam.map((item) => (
          <div key={item.id} className="exam-item">
            <span className="exam-no">
              {item.number}번 · {item.points}점
            </span>
            {item.passage ? <MathText as="p" className="exam-passage" text={item.passage} /> : null}
            <MathText as="p" className="exam-q" text={item.question} />
            {item.choices?.length ? (
              <div className="exam-choices">
                {item.choices.map((choice, i) => (
                  <span key={i}>
                    {["①", "②", "③", "④", "⑤"][i] ?? i + 1} <MathText text={choice} />
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <MotionButton
          variant="brand"
          size="lg"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const id = noteId ?? (await openExamNote(lessonId));
              router.push(`/note/${id}`);
            })
          }
        >
          <NotebookPen size={18} aria-hidden /> 노트에서 풀기
        </MotionButton>
        <Button variant="ghost" onClick={onSkip}>
          지금은 건너뛰기
        </Button>
      </div>
    </div>
  );
}

/* ── 결과 ──────────────────────────────────────────────────────────── */

function ReportStage({
  lessonId,
  report,
  analysis,
  closeLabel,
  onLoad,
  onExit,
}: {
  lessonId: string;
  report: LessonReport | null;
  analysis: LessonView["analysis"];
  closeLabel: string;
  onLoad: (value: LessonReport) => void;
  onExit: () => void;
}) {
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (report) return;
    startTransition(async () => {
      onLoad(await finishLesson(lessonId));
    });
  }, [report, lessonId, onLoad]);

  if (!report) {
    return (
      <div className="stack">
        <div className="skeleton-block" style={{ height: 132, borderRadius: 66, width: 132, margin: "0 auto" }} />
        <div className="skeleton-line" style={{ width: "60%", margin: "0 auto" }} />
      </div>
    );
  }

  return <ReportBody report={report} analysis={analysis} closeLabel={closeLabel} onExit={onExit} />;
}

function ReportBody({
  report,
  analysis,
  closeLabel,
  onExit,
}: {
  report: LessonReport;
  analysis: LessonView["analysis"];
  closeLabel: string;
  onExit: () => void;
}) {
  const circumference = 2 * Math.PI * 74;
  const great = report.accuracy >= 80;
  const minutes = useCountUp(report.minutes);
  const correct = useCountUp(report.correct);
  const slides = useCountUp(report.slidesRead);
  const exam = useCountUp(report.examScore);

  return (
    <div className="stack-lg">
      {great && closeLabel !== "닫기" ? <Confetti seed={report.correct + report.total} /> : null}
      <div className="rise" style={{ textAlign: "center", paddingTop: 12 }}>
        <span className="pill pop-in" data-tone={great ? "sun" : "brand"}>
          LESSON COMPLETE
        </span>
        <h2 className="result-title" data-tone={great ? "ok" : undefined}>
          {report.headline}
        </h2>

        <div className="score-ring">
          <svg viewBox="0 0 168 168" aria-hidden>
            <circle cx="84" cy="84" r="74" fill="none" stroke="var(--muted)" strokeWidth="14" />
            <circle
              cx="84"
              cy="84"
              r="74"
              fill="none"
              stroke={great ? "var(--ok)" : "var(--brand)"}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - report.accuracy / 100)}
            />
          </svg>
          <div>
            <div className="num">{report.grade}</div>
            <div className="cap">정답률 {report.accuracy}%</div>
          </div>
        </div>
      </div>

      <div className="stat-grid rise rise-1">
        <div className="stat-tile" data-tone="sun">
          <span className="label">공부한 시간</span>
          <span className="value">
            {minutes}
            <span className="unit">분</span>
          </span>
        </div>
        <div className="stat-tile" data-tone="ok">
          <span className="label">맞힌 문제</span>
          <span className="value">
            {correct}
            <span className="unit">/ {report.total}</span>
          </span>
        </div>
        <div className="stat-tile">
          <span className="label">읽은 카드</span>
          <span className="value">
            {slides}
            <span className="unit">/ {report.slidesTotal}</span>
          </span>
        </div>
        <div className="stat-tile" data-tone="grape">
          <span className="label">시험지</span>
          <span className="value">
            {exam}
            <span className="unit">/ {report.examTotal}점</span>
          </span>
        </div>
      </div>

      {analysis ? (
        <div className="card-muted rise rise-2 stack" style={{ gap: 10 }}>
          <span className="row" style={{ gap: 6, fontSize: 12.5, color: "var(--grape-ink)", fontWeight: 800 }}>
            <Sparkles size={14} aria-hidden /> 선생님 피드백
          </span>
          <MathText as="p" text={analysis.feedback} />
        </div>
      ) : (
        <div className="card-muted rise rise-2 stack" style={{ gap: 10 }}>
          <span className="row" style={{ gap: 6, fontSize: 12.5, color: "var(--muted-foreground)", fontWeight: 600 }}>
            <Clock size={14} aria-hidden /> 자세한 분석은 수업 시간이 끝나면 정리돼요
          </span>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.75 }}>
            오늘 푼 기록을 모아 약점을 찾고, 내일 커리큘럼부터 손볼게요.
          </p>
        </div>
      )}

      <MotionButton variant={great ? "ok" : "brand"} size="lg" onClick={onExit} className="rise rise-3">
        {closeLabel === "닫기" ? <X size={18} aria-hidden /> : <Check size={18} aria-hidden />} {closeLabel}
      </MotionButton>
    </div>
  );
}

/* ── 수업 중 질문 ──────────────────────────────────────────────────── */

function AskSheet({
  lessonId,
  open,
  onOpenChange,
}: {
  lessonId: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const [log, setLog] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const send = () => {
    const question = draft.trim();
    if (!question || pending) return;
    setDraft("");
    setLog((prev) => [...prev, { role: "user", text: question }]);
    startTransition(async () => {
      const answer = await askDuringLesson(lessonId, question);
      setLog((prev) => [...prev, { role: "assistant", text: answer }]);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>지금 이 내용, 물어보세요</SheetTitle>
        </SheetHeader>

        <div className="chat-log" style={{ padding: "16px 0", maxHeight: "44dvh" }}>
          {!log.length ? (
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.75 }}>
              보고 있는 카드에 대해 물어보면 그 맥락에 맞춰 답해 드려요.
            </p>
          ) : null}
          {log.map((entry, index) => (
            <div key={index} className="chat-bubble" data-role={entry.role}>
              <MathText text={entry.text} />
            </div>
          ))}
          {pending ? (
            <div className="chat-bubble" data-role="assistant">
              <span className="typing" aria-label="작성 중">
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : null}
        </div>

        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <input
            className="input-lg"
            style={{ flex: 1 }}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="예) 이 공식이 왜 이렇게 되나요?"
            aria-label="질문"
          />
          <Button type="submit" variant="brand" size="icon" disabled={!draft.trim() || pending} aria-label="보내기">
            <ArrowUp aria-hidden />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/* ── 보조 화면 ─────────────────────────────────────────────────────── */

function LessonSkeleton() {
  return (
    <div className="app-shell">
      <main className="app-main" style={{ paddingTop: 40 }}>
        <div className="skeleton-line" style={{ width: "40%" }} />
        <div className="skeleton-block" style={{ height: 320 }} />
        <div className="skeleton-line" style={{ width: "70%" }} />
      </main>
    </div>
  );
}

function PreparingScreen({ title, failed, onBack }: { title: string; failed: boolean; onBack: () => void }) {
  return (
    <Centered
      title={failed ? "자료를 만들지 못했어요" : "자료를 준비하고 있어요"}
      description={
        failed
          ? "잠시 뒤 다시 들어오면 다시 시도해요."
          : `${title} 수업에 쓸 카드와 문제를 만들고 있어요. 조금만 기다려 주세요.`
      }
    >
      {!failed ? (
        <div className="stack" style={{ width: "100%", maxWidth: 320 }}>
          <div className="skeleton-line" style={{ width: "92%" }} />
          <div className="skeleton-line" style={{ width: "76%" }} />
          <div className="skeleton-line" style={{ width: "84%" }} />
        </div>
      ) : null}
      <Button variant="outline" onClick={onBack}>
        수업 목록으로
      </Button>
    </Centered>
  );
}

function Centered({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          textAlign: "center",
          minHeight: "100dvh",
          padding: "0 var(--page-gutter)",
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-.03em" }}>{title}</h2>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.8, maxWidth: 300 }}>
          {description}
        </p>
        {children}
      </main>
    </div>
  );
}
