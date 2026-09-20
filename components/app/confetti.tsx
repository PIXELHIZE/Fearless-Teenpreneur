"use client";

import { useMemo } from "react";

const COLORS = ["#3b6cff", "#3dbe5b", "#ffc530", "#ff5c6c", "#8b5cf6", "#ff8a3d"];

/** 결과가 좋을 때 한 번 흩날리는 컨페티. 순수 CSS 애니메이션이라 가볍다. */
export function Confetti({ count = 28, seed = 1 }: { count?: number; seed?: number }) {
  const pieces = useMemo(() => {
    let state = seed * 9301 + 49297;
    const random = () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
    return Array.from({ length: count }, (_, index) => ({
      id: index,
      left: `${random() * 100}%`,
      color: COLORS[index % COLORS.length],
      dx: `${(random() - 0.5) * 160}px`,
      rot: `${(random() - 0.5) * 900}deg`,
      dur: `${1.6 + random() * 1.4}s`,
      delay: `${random() * 0.6}s`,
      scale: 0.7 + random() * 0.8,
    }));
  }, [count, seed]);

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((piece) => (
        <i
          key={piece.id}
          style={{
            left: piece.left,
            background: piece.color,
            transform: `scale(${piece.scale})`,
            ["--dx" as string]: piece.dx,
            ["--rot" as string]: piece.rot,
            ["--dur" as string]: piece.dur,
            ["--delay" as string]: piece.delay,
          }}
        />
      ))}
    </div>
  );
}
