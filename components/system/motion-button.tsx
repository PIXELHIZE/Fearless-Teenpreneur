"use client";

import { useRef, type ComponentProps } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, reducedMotion } from "@/lib/motion";

gsap.registerPlugin(useGSAP);

type MotionButtonProps = ComponentProps<typeof Button> & { loading?: boolean };

export function MotionButton({ children, loading, disabled, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave, onKeyDown, onKeyUp, onBlur, ...props }: MotionButtonProps) {
  const scope = useRef<HTMLSpanElement>(null);
  const { contextSafe } = useGSAP({ scope });
  const animate = (pressed: boolean) => { contextSafe(() => {
    gsap.to(scope.current, { scale: pressed && !disabled && !loading && !reducedMotion() ? .97 : 1, duration: reducedMotion() ? 0 : motion.press, ease: motion.ease, overwrite: "auto" });
  })(); };

  return <span ref={scope} className="motion-button-wrap">
    <Button {...props} disabled={disabled || loading} aria-busy={loading || undefined}
      onPointerDown={e => { onPointerDown?.(e); if (!e.defaultPrevented) animate(true); }}
      onPointerUp={e => { onPointerUp?.(e); animate(false); }}
      onPointerCancel={e => { onPointerCancel?.(e); animate(false); }}
      onPointerLeave={e => { onPointerLeave?.(e); animate(false); }}
      onKeyDown={e => { onKeyDown?.(e); if (!e.defaultPrevented && ["Enter", " "].includes(e.key)) animate(true); }}
      onKeyUp={e => { onKeyUp?.(e); animate(false); }}
      onBlur={e => { onBlur?.(e); animate(false); }}>
      {loading && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}{children}
    </Button>
  </span>;
}
