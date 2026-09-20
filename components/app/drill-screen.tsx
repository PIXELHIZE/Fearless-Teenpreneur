"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { MathText } from "@/components/app/math-text";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleCheck, CircleX, Eraser, RotateCw, Sparkles } from "lucide-react";
import { MotionButton } from "@/components/system/motion-button";
import { Button } from "@/components/ui/button";
import { DetailBar } from "@/components/app/detail-bar";
import { Confetti } from "@/components/app/confetti";
import { useCountUp } from "@/components/app/count-up";
import { loadDrills, saveDrillResult, type DrillPack } from "@/lib/actions/drills";
import type { DrillItem } from "@/lib/types";

type Kind = "ox" | "flip" | "trace";

const TITLE: Record<Kind, string> = { ox: "OX 퀴즈", flip: "카드 뒤집기", trace: "따라쓰기" };

export function DrillScreen({ kind }: { kind: Kind }) {
  const router = useRouter();
  const [pack, setPack] = useState<DrillPack | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadDrills(kind).then((data) => {
      if (alive) setPack(data);
    });
    return () => {
      alive = false;
    };
  }, [kind]);

  const finish = (finalScore: number, total: number) => {
    setScore(finalScore);
    setDone(true);
    void saveDrillResult(pack?.goalId ?? null, kind, finalScore, total);
  };

  const total = pack?.items.length ?? 0;

  return (
    <>
      <DetailBar
        close
        href="/home"
        title={TITLE[kind]}
        subtitle={pack?.goalTitle ? `${pack.goalTitle}에 맞춘 문제` : "불러오는 중"}
        side={
          total ? (
            <span className="pill tnum" style={{ marginInlineEnd: 8 }}>
              {Math.min(index + 1, total)} / {total}
            </span>
          ) : null
        }
      />

      <main className="app-main app-main--bare" style={{ paddingTop: 20 }}>
        {total ? (
          <div className="progress-thin" data-tone="ok" aria-hidden>
            <span style={{ width: `${((done ? total : index) / total) * 100}%` }} />
          </div>
        ) : null}

        {!pack ? <DrillSkeleton /> : null}

        {pack?.error ? (
          <div className="card stack" style={{ gap: 12 }}>
            <strong style={{ fontSize: 16 }}>문제를 준비하지 못했어요</strong>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>
              {pack.error}
            </p>
            <Button variant="outline" onClick={() => router.push("/home")}>
              홈으로
            </Button>
          </div>
        ) : null}

        {pack && !pack.error && !total ? (
          <div className="card stack" style={{ gap: 12 }}>
            <strong style={{ fontSize: 16 }}>아직 문제가 없어요</strong>
            <p className="muted" style={{ fontSize: 14 }}>수업을 한 번 하고 나면 여기에 맞춤 문제가 생겨요.</p>
          </div>
        ) : null}

        {total && !done ? (
          <>
            {pack?.generated ? (
              <p className="row muted" style={{ gap: 6, fontSize: 12.5 }}>
                <Sparkles size={13} aria-hidden /> 방금 만든 문제예요
              </p>
            ) : null}

            {kind === "ox" ? (
              <OxDrill
                items={pack!.items}
                index={index}
                onNext={(correct) => {
                  const nextScore = score + (correct ? 1 : 0);
                  setScore(nextScore);
                  if (index + 1 < total) setIndex(index + 1);
                  else finish(nextScore, total);
                }}
              />
            ) : null}

            {kind === "flip" ? (
              <FlipDrill
                items={pack!.items}
                index={index}
                onMove={(step) => setIndex((value) => Math.min(total - 1, Math.max(0, value + step)))}
                onDone={() => finish(total, total)}
              />
            ) : null}

            {kind === "trace" ? (
              <TraceDrill
                item={pack!.items[index]}
                onNext={() => {
                  if (index + 1 < total) setIndex(index + 1);
                  else finish(total, total);
                }}
              />
            ) : null}
          </>
        ) : null}

        {done ? (
          <ResultCard
            kind={kind}
            score={score}
            total={total}
            onRetry={() => {
              setIndex(0);
              setScore(0);
              setDone(false);
            }}
            onExit={() => router.push("/home")}
          />
        ) : null}
      </main>
    </>
  );
}

/* ── OX ────────────────────────────────────────────────────────────── */

function OxDrill({ items, index, onNext }: { items: DrillItem[]; index: number; onNext: (correct: boolean) => void }) {
  const item = items[index];
  const [picked, setPicked] = useState<boolean | null>(null);

  useEffect(() => setPicked(null), [index]);
  if (!item) return null;

  const answered = picked !== null;
  const correct = picked === item.answer;

  return (
    <>
      <MathText as="p" className="quiz-q rise" text={item.question ?? ""} />

      <div className="ox-pair rise rise-1">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            className="ox-button"
            data-side={value ? "O" : "X"}
            data-picked={picked === value ? "true" : undefined}
            disabled={answered}
            onClick={() => setPicked(value)}
          >
            {value ? "O" : "X"}
            <small>{value ? "맞다" : "틀리다"}</small>
          </button>
        ))}
      </div>

      {answered ? (
        <div className="answer-banner" data-ok={correct ? "true" : "false"} role="status">
          <div className="answer-banner-head">
            {correct ? <CircleCheck aria-hidden /> : <CircleX aria-hidden />}
            {correct ? "맞았어요!" : `정답은 ${item.answer ? "O" : "X"}`}
          </div>
          <MathText as="p" text={item.explain ?? ""} />
          <MotionButton variant={correct ? "ok" : "destructive"} size="lg" onClick={() => onNext(correct)}>
            {index + 1 < items.length ? "계속하기" : "결과 보기"} <ArrowRight size={16} aria-hidden />
          </MotionButton>
        </div>
      ) : null}
    </>
  );
}

/* ── 카드 뒤집기 ───────────────────────────────────────────────────── */

function FlipDrill({
  items,
  index,
  onMove,
  onDone,
}: {
  items: DrillItem[];
  index: number;
  onMove: (step: number) => void;
  onDone: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const item = items[index];

  // 카드를 넘길 때는 반드시 앞면부터 보이게 한다.
  useEffect(() => setFlipped(false), [index]);
  if (!item) return null;

  return (
    <>
      <div className="flip-stage rise">
        <button
          type="button"
          className="flip-inner"
          data-flipped={flipped ? "true" : undefined}
          onClick={() => setFlipped((value) => !value)}
          aria-pressed={flipped}
        >
          <span className="flip-face" data-side="front">
            <MathText as="strong" text={item.front ?? ""} />
            {item.hint ? <MathText as="small" text={item.hint} /> : null}
            <small>눌러서 뒤집기</small>
          </span>
          <span className="flip-face" data-side="back">
            <MathText as="strong" text={item.back ?? ""} />
            <small>다시 눌러 앞면으로</small>
          </span>
        </button>
      </div>

      <div className="action-row">
        <Button variant="outline" size="icon" aria-label="이전 카드" disabled={index === 0} onClick={() => onMove(-1)} >
          <ArrowLeft aria-hidden />
        </Button>
        {index + 1 < items.length ? (
          <MotionButton variant="grape" size="lg" onClick={() => onMove(1)} style={{ flex: 1 }}>
            다음 카드 <ArrowRight size={16} aria-hidden />
          </MotionButton>
        ) : (
          <MotionButton variant="grape" size="lg" onClick={onDone} style={{ flex: 1 }}>
            다 봤어요
          </MotionButton>
        )}
      </div>
    </>
  );
}

/* ── 따라쓰기 ──────────────────────────────────────────────────────── */

function TraceDrill({ item, onNext }: { item: DrillItem; onNext: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const [drawn, setDrawn] = useState(false);
  const [ghostSize, setGhostSize] = useState(120);

  // 따라 쓸 글자가 길면 잘리지 않도록 폭에 맞춰 글자 크기를 정한다.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !item?.text) return;
    const fit = () => {
      const width = stage.clientWidth - 48;
      const length = Math.max(1, [...item.text!].length);
      // 한글·숫자는 정방형에 가깝고, 영문·기호는 절반 폭 정도다.
      const units = [...item.text!].reduce((sum, ch) => sum + (/[가-힣ㄱ-ㅎ0-9]/.test(ch) ? 1 : 0.62), 0);
      setGhostSize(Math.max(36, Math.min(150, Math.floor((width / units) * 0.95), Math.floor(length === 1 ? 150 : 130))));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [item?.text]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    setDrawn(false);
  }, [item?.id]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    setDrawn(true);
    const { x, y } = point(event);
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111113";
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawn(false);
  };

  if (!item) return null;

  return (
    <>
      <div className="rise">
        <MathText as="p" className="trace-guide" text={item.guide ?? ""} />
        <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
          회색 글씨 위에 그대로 따라 써 보세요.
        </p>
      </div>

      <div className="trace-stage rise rise-1" ref={stageRef}>
        <span className="trace-ghost" aria-hidden style={{ fontSize: ghostSize }}>
          {item.text}
        </span>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => (drawing.current = false)}
          onPointerCancel={() => (drawing.current = false)}
        />
      </div>

      <div className="action-row">
        <Button variant="outline" size="icon" aria-label="지우기" onClick={clear} >
          <Eraser aria-hidden />
        </Button>
        <MotionButton variant="sun" size="lg" disabled={!drawn} onClick={onNext} style={{ flex: 1.5 }}>
          다음 <ArrowRight size={16} aria-hidden />
        </MotionButton>
      </div>
    </>
  );
}

/* ── 결과 ──────────────────────────────────────────────────────────── */

function ResultCard({
  kind,
  score,
  total,
  onRetry,
  onExit,
}: {
  kind: Kind;
  score: number;
  total: number;
  onRetry: () => void;
  onExit: () => void;
}) {
  const percent = total ? Math.round((score / total) * 100) : 0;
  const shown = useCountUp(score);
  const circumference = 2 * Math.PI * 74;
  const great = percent >= 80;

  return (
    <div className="stack-lg">
      {great ? <Confetti seed={score + total} /> : null}
      <div className="rise" style={{ textAlign: "center", paddingTop: 12 }}>
        <span className="pill pop-in" data-tone={great ? "sun" : "brand"}>
          RESULT
        </span>
        <h2 className="result-title" data-tone={great ? "ok" : undefined}>
          {kind === "ox" ? (great ? "대단해요!" : "다시 한 판 어때요") : "끝까지 해냈어요!"}
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
              strokeDashoffset={circumference * (1 - percent / 100)}
            />
          </svg>
          <div>
            <div className="num">
              {shown}
              <span style={{ fontSize: 20, color: "var(--muted-foreground)", fontWeight: 700 }}>/{total}</span>
            </div>
            <div className="cap">{percent}%</div>
          </div>
        </div>
      </div>

      <div className="action-row">
        <Button variant="outline" size="lg" onClick={onRetry} style={{ flex: 1 }}>
          <RotateCw size={16} aria-hidden /> 다시
        </Button>
        <MotionButton variant={great ? "ok" : "brand"} size="lg" onClick={onExit} style={{ flex: 1.5 }}>
          홈으로
        </MotionButton>
      </div>
    </div>
  );
}

function DrillSkeleton() {
  return (
    <div className="stack">
      <div className="skeleton-block" style={{ height: 128 }} />
      <div className="ox-pair">
        <div className="skeleton-block" style={{ height: 156 }} />
        <div className="skeleton-block" style={{ height: 156 }} />
      </div>
    </div>
  );
}
