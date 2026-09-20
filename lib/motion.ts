import { useSyncExternalStore } from "react";

export const motion = {
  press: 0.12,
  state: 0.18,
  reveal: 0.24,
  surface: 0.28,
  flip: 0.36,
  stagger: 0.04,
  ease: "power2.out",
  easeInOut: "power2.inOut",
} as const;

export function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, reducedMotion, () => true);
}
