import type { CSSProperties } from "react";
import geometry from "@/lib/logo-geometry.json";

type LogoProps = {
  variant?: "lockup" | "wordmark" | "symbol";
  tone?: "brand" | "mono" | "inverse";
  tile?: boolean;
  className?: string;
  decorative?: boolean;
  style?: CSSProperties;
};

/** Outline geometry: logo appearance is independent of installed fonts. */
export function Logo({ variant = "lockup", tone = "brand", tile = true, className, decorative = false, style }: LogoProps) {
  const viewBox = variant === "symbol" ? "0 0 100 100" : variant === "wordmark" ? "0 0 288 100" : "0 0 406 100";
  const isInverse = tone === "inverse";
  const ink = isInverse ? "#FFFFFF" : tone === "mono" ? "#111113" : "currentColor";
  const markBackground = tone === "brand" ? "#315EFF" : ink;
  const markInk = tile ? (isInverse ? "#111113" : "#FFFFFF") : tone === "brand" ? "#315EFF" : ink;
  const dot = geometry.dot;

  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} className={className} style={style} fill="none" role={decorative ? undefined : "img"} aria-label={decorative ? undefined : "teum"} aria-hidden={decorative || undefined} focusable="false">
    {variant !== "wordmark" && <g>
      {tile && <rect width="100" height="100" rx="24" fill={markBackground} />}
      <path d={geometry.symbolPath} fill={markInk} />
      <circle {...dot} fill={markInk} />
    </g>}
    {variant !== "symbol" && <g transform={variant === "lockup" ? "translate(116 0)" : undefined} fill={ink} fillRule="evenodd">
      {geometry.wordmarkPaths.map((path, index) => <path key={index} d={path} />)}
    </g>}
  </svg>;
}
