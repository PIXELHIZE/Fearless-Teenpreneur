"use client";

import { useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "@/lib/motion";

gsap.registerPlugin(useGSAP);

export function MotionReveal({ children, replay = 0, className = "" }: { children: ReactNode; replay?: number; className?: string }) {
  const scope = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add({ reduce: "(prefers-reduced-motion: reduce)", full: "(prefers-reduced-motion: no-preference)" }, context => {
      const reduce = Boolean(context.conditions?.reduce);
      const items = scope.current?.querySelectorAll("[data-reveal]");
      const target = items?.length ? items : scope.current;
      gsap.fromTo(target, { y: reduce ? 0 : 12, opacity: reduce ? 1 : 0 }, { y: 0, opacity: 1, duration: reduce ? 0 : motion.reveal, stagger: reduce ? 0 : motion.stagger, ease: motion.ease, clearProps: "transform,opacity" });
    });
    return () => mm.revert();
  }, { scope, dependencies: [replay], revertOnUpdate: true });
  return <div ref={scope} className={className}>{children}</div>;
}

export function AnimatedProgress({ value, label = "진행률" }: { value: number; label?: string }) {
  const fill = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const bounded = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  useGSAP(() => {
    gsap.to(fill.current, { scaleX: bounded / 100, duration: reduce ? 0 : motion.state, ease: motion.ease, overwrite: "auto" });
  }, { dependencies: [bounded, reduce] });
  return <div role="progressbar" aria-label={label} aria-valuenow={bounded} aria-valuemin={0} aria-valuemax={100} className="animated-progress"><span ref={fill} /></div>;
}

export function FlipSurface({ front, back }: { front?: ReactNode; back?: ReactNode }) {
  const [flipped, setFlipped] = useState(false);
  const reduce = useReducedMotion();
  const scope = useRef<HTMLButtonElement>(null);
  const rotator = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    gsap.to(rotator.current, { rotationY: flipped ? 180 : 0, duration: reduce ? 0 : motion.flip, ease: motion.easeInOut, overwrite: "auto" });
  }, { scope, dependencies: [flipped, reduce] });
  return <button ref={scope} type="button" className="flip-surface" aria-pressed={flipped} onClick={() => setFlipped(v => !v)}>
    <span className="flip-rotator" ref={rotator}>
      <span className="flip-face" aria-hidden={flipped}>{front ?? <><span className="mono">FRONT / 01</span><strong>하나의 컴포넌트.<br />두 개의 면.</strong><span className="flip-caption">눌러서 전환 <ArrowUpRight aria-hidden="true" /></span></>}</span>
      <span className="flip-face flip-back" aria-hidden={!flipped}>{back ?? <><span className="mono">BACK / 02</span><strong>상태가 바뀌어도,<br />같은 디자인 언어.</strong><span className="flip-caption">다시 뒤집기 <RotateCcw aria-hidden="true" /></span></>}</span>
    </span>
  </button>;
}
