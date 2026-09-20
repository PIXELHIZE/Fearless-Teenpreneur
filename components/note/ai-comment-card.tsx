"use client";

import { useEffect, useMemo, useState } from "react";
import { MathText } from "@/components/app/math-text";
import {
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Lightbulb,
  RotateCw,
  SearchCheck,
  Shapes,
  Sparkles,
  TextQuote,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  filledSections,
  SECTION_LABEL,
  SPOILER_SECTIONS,
  type AiPenSectionKey,
  type CheckVerdict,
} from "@/lib/note/ai-pen";
import type { AiPin } from "@/lib/note/ai-pen-controller";

const SECTION_ICON: Record<AiPenSectionKey, LucideIcon> = {
  meaning: BookOpen,
  summary: TextQuote,
  concept: Shapes,
  check: SearchCheck,
  hint: Lightbulb,
  solution: CheckCircle2,
};

const VERDICT_LABEL: Record<CheckVerdict, string> = {
  correct: "맞았어요",
  error: "틀린 곳이 있어요",
  unsure: "확인이 필요해요",
};

interface Props {
  pin: AiPin;
  onClose: () => void;
  onDelete: () => void;
  onRetry: () => void;
}

export function AiCommentCard({ pin, onClose, onDelete, onRetry }: Props) {
  const tabs = useMemo(() => filledSections(pin.result), [pin.result]);
  const [active, setActive] = useState<AiPenSectionKey | null>(null);
  const [revealed, setRevealed] = useState<AiPenSectionKey[]>([]);
  const [hintDepth, setHintDepth] = useState(1);

  useEffect(() => {
    if (tabs.length && (!active || !tabs.includes(active))) setActive(tabs[0]);
  }, [tabs, active]);

  const current = active && pin.result ? active : null;
  const needsReveal = current !== null && SPOILER_SECTIONS.includes(current) && !revealed.includes(current);

  return (
    <div className="ai-card" onPointerDown={(event) => event.stopPropagation()}>
      <header className="ai-card-head">
        <span className="ai-card-brand">
          <Sparkles size={13} aria-hidden />
          AI 펜
        </span>
        {pin.result?.subject ? <span className="ai-card-tag">{pin.result.subject}</span> : null}
        <span style={{ flex: 1 }} />
        <button type="button" className="ai-card-icon" onClick={onDelete} aria-label="삭제">
          <Trash2 size={14} aria-hidden />
        </button>
        <button type="button" className="ai-card-icon" onClick={onClose} aria-label="닫기">
          <X size={15} aria-hidden />
        </button>
      </header>

      {pin.status === "loading" ? <LoadingBody /> : null}

      {pin.status === "error" ? (
        <div className="ai-card-body">
          <p className="row" style={{ gap: 8, alignItems: "flex-start", fontSize: 13, lineHeight: 1.7 }}>
            <CircleAlert size={16} aria-hidden style={{ flex: "none", marginTop: 2 }} />
            {pin.error}
          </p>
          <button type="button" className="ai-more" onClick={onRetry} style={{ marginTop: 12 }}>
            <RotateCw size={13} aria-hidden /> 다시 시도
          </button>
        </div>
      ) : null}

      {pin.status === "done" && pin.result ? (
        <>
          {tabs.length > 1 ? (
            <nav className="ai-card-tabs">
              {tabs.map((tab) => {
                const Icon = SECTION_ICON[tab];
                return (
                  <button
                    key={tab}
                    type="button"
                    className="ai-card-tab"
                    aria-pressed={tab === current}
                    onClick={() => setActive(tab)}
                  >
                    <Icon size={13} aria-hidden />
                    {SECTION_LABEL[tab]}
                  </button>
                );
              })}
            </nav>
          ) : null}

          <div className="ai-card-body">
            {!tabs.length ? <p className="muted" style={{ fontSize: 13 }}>이 부분에서는 더 드릴 내용이 없었어요.</p> : null}

            {needsReveal && current ? (
              <button type="button" className="ai-reveal" onClick={() => setRevealed([...revealed, current])}>
                <strong>{SECTION_LABEL[current]} 보기</strong>
                <span>먼저 스스로 풀어 본 다음 열어 보세요</span>
              </button>
            ) : null}

            {!needsReveal && current === "meaning" && pin.result.meaning
              ? pin.result.meaning.entries.map((entry, index) => (
                  <section key={index} className="ai-block">
                    <h4>
                      {entry.term}
                      {entry.pos ? <em>{entry.pos}</em> : null}
                    </h4>
                    <MathText as="p" text={entry.definition} />
                    {entry.synonyms?.length ? (
                      <ul className="ai-chips">
                        {entry.synonyms.map((word) => (
                          <li key={word}>{word}</li>
                        ))}
                      </ul>
                    ) : null}
                    {entry.example ? <MathText as="p" className="ai-example" text={`예) ${entry.example}`} /> : null}
                    {entry.role ? <p className="ai-role">문장에서의 역할 · {entry.role}</p> : null}
                  </section>
                ))
              : null}

            {!needsReveal && current === "summary" && pin.result.summary ? (
              <section className="ai-block">
                <MathText as="p" className="ai-lead" text={pin.result.summary.one_line} />
                {pin.result.summary.key_points?.length ? (
                  <ul className="ai-list">
                    {pin.result.summary.key_points.map((point, index) => (
                      <li key={index}>
                        <MathText text={point} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {!needsReveal && current === "concept" && pin.result.concept ? (
              <section className="ai-block">
                {pin.result.concept.intent ? (
                  <p className="ai-callout">
                    <span>묻는 것</span>
                    {pin.result.concept.intent}
                  </p>
                ) : null}
                {pin.result.concept.items.map((item, index) => (
                  <div key={index} className="ai-concept">
                    <MathText as="h4" text={item.name} />
                    <MathText as="p" text={item.detail} />
                  </div>
                ))}
              </section>
            ) : null}

            {!needsReveal && current === "check" && pin.result.check ? (
              <section className="ai-block">
                <p className="ai-verdict" data-verdict={pin.result.check.verdict}>
                  <span>{VERDICT_LABEL[pin.result.check.verdict]}</span>
                  {pin.result.check.summary}
                </p>
                {pin.result.check.issues?.length ? (
                  <ol className="ai-issues">
                    {pin.result.check.issues.map((issue, index) => (
                      <li key={index}>
                        <MathText as="strong" text={issue.where} />
                        <MathText as="span" text={issue.what} />
                        {issue.fix ? <MathText as="em" text={`고치면 · ${issue.fix}`} /> : null}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            ) : null}

            {!needsReveal && current === "hint" && pin.result.hint ? (
              <section className="ai-block">
                <ol className="ai-steps">
                  {pin.result.hint.steps.slice(0, hintDepth).map((step, index) => (
                    <li key={index}>
                      <MathText text={step} />
                    </li>
                  ))}
                </ol>
                {hintDepth < pin.result.hint.steps.length ? (
                  <button type="button" className="ai-more" onClick={() => setHintDepth(hintDepth + 1)}>
                    힌트 하나 더 ({hintDepth}/{pin.result.hint.steps.length})
                  </button>
                ) : null}
              </section>
            ) : null}

            {!needsReveal && current === "solution" && pin.result.solution ? (
              <section className="ai-block">
                {pin.result.solution.asked ? (
                  <p className="ai-callout">
                    <span>발문</span>
                    {pin.result.solution.asked}
                  </p>
                ) : null}
                <ol className="ai-steps">
                  {pin.result.solution.steps.map((step, index) => (
                    <li key={index}>
                      <MathText as="strong" text={step.title} />
                      <MathText as="span" text={step.detail} />
                    </li>
                  ))}
                </ol>
                {pin.result.solution.answer ? (
                  <p className="ai-answer">
                    <span>답</span>
                    <MathText text={pin.result.solution.answer} />
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function LoadingBody() {
  return (
    <div className="ai-card-body">
      <div className="row" style={{ gap: 6, marginBottom: 14, fontSize: 12, color: "var(--brand)", fontWeight: 600 }}>
        <span className="typing" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        올가미 친 부분을 읽고 있어요
      </div>
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        <span className="skeleton-block" style={{ width: 58, height: 26, borderRadius: 999 }} />
        <span className="skeleton-block" style={{ width: 58, height: 26, borderRadius: 999 }} />
        <span className="skeleton-block" style={{ width: 58, height: 26, borderRadius: 999 }} />
      </div>
      <div className="stack" style={{ gap: 9 }}>
        <div className="skeleton-line" style={{ width: "92%" }} />
        <div className="skeleton-line" style={{ width: "78%" }} />
        <div className="skeleton-line" style={{ width: "85%" }} />
        <div className="skeleton-line" style={{ width: "54%" }} />
      </div>
    </div>
  );
}
