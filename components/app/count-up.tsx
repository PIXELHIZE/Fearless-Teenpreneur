"use client";

import { useEffect, useState } from "react";

/** 숫자가 0에서 목표값까지 차오른다. 결과 화면의 통계에 쓴다. */
export function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

export function CountUp({ value, duration }: { value: number; duration?: number }) {
  const shown = useCountUp(value, duration);
  return <>{shown}</>;
}
