// ── 색 계산 ──
// 캘린더 색은 사용자가 자유롭게 정할 수 있어야 하는데, Tailwind는 런타임에
// 클래스를 만들어 낼 수 없다. 그래서 색은 hex 문자열로 저장하고 화면에는
// 인라인 스타일로 내려보낸다. 아래는 그 계산을 모아 둔 곳이다.

import type { CSSProperties } from "react";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** h: 0~360, s/v: 0~1 */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

export const clamp255 = (n: number) => clamp(Math.round(n), 0, 255);

/** "#abc" · "ABCDEF" 등을 "#aabbcc" 형태로 통일한다. 형식이 틀리면 null */
export function normalizeHex(input: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `#${h.length === 3 ? h.replace(/./g, (c) => c + c) : h}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((v) => clamp255(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = v - c;
  return {
    r: clamp255((r1 + m) * 255),
    g: clamp255((g1 + m) * 255),
    b: clamp255((b1 + m) * 255),
  };
}

// ── 명암 ──

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG 상대 휘도 (0~1) */
export function luminance(rgb: Rgb): number {
  return (
    0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b)
  );
}

/** 배경색 위에 얹을 글자색 — 밝은 배경엔 짙은 글자, 어두운 배경엔 흰 글자 */
export function textOn(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  return luminance(rgb) > 0.45 ? "#1f2937" : "#ffffff";
}

/** hex를 흰색(amount>0) 또는 검은색(amount<0) 쪽으로 섞는다. amount: -1~1 */
export function shade(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return rgbToHex({
    r: rgb.r + (target - rgb.r) * t,
    g: rgb.g + (target - rgb.g) * t,
    b: rgb.b + (target - rgb.b) * t,
  });
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

// ── 색 거리 ──

/**
 * 두 색의 체감 차이. 단순 RGB 거리보다 사람 눈에 가까운 가중 근사식("redmean")을
 * 쓴다. 값 범위는 0 ~ 약 765.
 */
export function colorDistance(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return Number.POSITIVE_INFINITY;
  const rmean = (x.r + y.r) / 2;
  const dr = x.r - y.r;
  const dg = x.g - y.g;
  const db = x.b - y.b;
  return Math.sqrt(
    (2 + rmean / 256) * dr * dr +
      4 * dg * dg +
      (2 + (255 - rmean) / 256) * db * db,
  );
}

/**
 * 예약 색 보호용 임계값. 이 정도 이내면 나란히 놓았을 때 같은 색으로 보여서
 * 예약의 의미가 없어진다. (예: emerald-500 대 green-600 은 약 104로 통과)
 */
export const SIMILAR_THRESHOLD = 40;

export function isTooSimilar(a: string, b: string): boolean {
  return colorDistance(a, b) < SIMILAR_THRESHOLD;
}

// ── 화면용 스타일 ──

/** 사이드바·패널의 색 점 */
export function dotStyle(hex: string): CSSProperties {
  return { backgroundColor: hex };
}

/** 주간 뷰의 일정 블록 — 색을 그대로 채우고 글자색만 대비에 맞춘다 */
export function blockStyle(hex: string): CSSProperties {
  return { backgroundColor: hex, color: textOn(hex) };
}

/** 월간 뷰의 일정 칩 — 옅은 배경 + 짙은 글자 + 원색 테두리 */
export function chipStyle(hex: string): CSSProperties {
  return {
    backgroundColor: shade(hex, 0.88),
    color: shade(hex, -0.45),
    borderColor: hex,
  };
}
