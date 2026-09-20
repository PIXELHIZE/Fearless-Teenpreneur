"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import { hasMath, loadMath, splitMath, type Segment } from "@/lib/math/mathjax";

type Rendered = { type: "text"; value: string } | { type: "math"; svg: string; display: boolean; depth: number };

/**
 * `$...$` 가 섞인 글을 수식과 함께 그린다.
 * 엔진이 뜨기 전에는 평문을 먼저 보여 준다(깜빡임 대신 글자 우선).
 */
export function MathText({ text, as: Tag = "span", className }: { text: string; as?: ElementType; className?: string }) {
  const segments = useMemo(() => splitMath(text), [text]);
  const needs = useMemo(() => hasMath(text), [text]);
  const [rendered, setRendered] = useState<Rendered[] | null>(null);

  useEffect(() => {
    if (!needs) return;
    let alive = true;
    void loadMath().then((engine) => {
      if (!alive) return;
      setRendered(
        segments.map((segment: Segment) => {
          if (segment.type === "text") return segment;
          try {
            const out = engine.convert(segment.value, segment.display);
            return { type: "math", svg: out.svg, display: segment.display, depth: out.depthEx };
          } catch {
            return { type: "text", value: segment.value };
          }
        }),
      );
    });
    return () => {
      alive = false;
    };
  }, [needs, segments]);

  // 부모가 flex/grid 여도 조각들이 흩어지지 않게 항상 한 겹으로 감싼다.
  if (!needs) return <Tag className={className}>{text}</Tag>;

  const list: Rendered[] =
    rendered ??
    segments.map((segment) => (segment.type === "text" ? segment : { type: "text", value: segment.value }));

  return (
    <Tag className={className}>
      <span className="math-text">
        {list.map((part, index) =>
          part.type === "text" ? (
            <span key={index}>{part.value}</span>
          ) : (
            <span
              key={index}
              className={part.display ? "mj mj-display" : "mj"}
              style={{ verticalAlign: `${-part.depth}ex` }}
              dangerouslySetInnerHTML={{ __html: part.svg.replace(/#1b1d2a/g, "currentColor") }}
            />
          ),
        )}
      </span>
    </Tag>
  );
}
