"use client";

import { useRef, useState } from "react";
import {
  clamp,
  clamp255,
  hexToRgb,
  Hsv,
  hsvToRgb,
  normalizeHex,
  rgbToHex,
  rgbToHsv,
} from "@/lib/color";
import { PresetColor } from "@/lib/types";

interface Props {
  value: string; // "#rrggbb"
  onChange: (hex: string) => void;
  /** 한 번에 고를 수 있는 기본 색 (없으면 스와치 줄을 숨긴다) */
  presets?: PresetColor[];
}

const CHANNELS = [
  { key: "r", label: "R" },
  { key: "g", label: "G" },
  { key: "b", label: "B" },
] as const;

type Channel = (typeof CHANNELS)[number]["key"];

// 색상 휠: 각도 = 색상, 중심에서 바깥으로 = 채도.
// conic-gradient는 12시에서 시작해 시계방향으로 도므로 HSV 색상각과 그대로 맞는다.
const WHEEL_HUE =
  "conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)";
const WHEEL_SAT =
  "radial-gradient(circle closest-side, #ffffff, rgba(255,255,255,0))";

export default function ColorPicker({ value, onChange, presets }: Props) {
  const rgb = hexToRgb(value) ?? { r: 14, g: 165, b: 233 };

  // 색상·채도·명도를 상태로 들고 있는다. 명도가 0이거나 채도가 0이면 hex만으로는
  // 원래 각도를 복원할 수 없어서, 순수 파생값으로 두면 조작 중에 손잡이가 튄다.
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(rgb));

  // 스와치·RGB·hex처럼 밖에서 값이 바뀐 경우에만 다시 맞춘다
  // (렌더 중 상태 보정 — 이 컴포넌트가 만든 값이면 그대로 둔다)
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (rgbToHex(hsvToRgb(hsv)) !== value) setHsv(rgbToHsv(rgb));
  }

  const wheelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [drafts, setDrafts] = useState<Partial<Record<Channel, string>>>({});
  const [hexDraft, setHexDraft] = useState<string | null>(null);

  const emit = (next: Hsv) => {
    setHsv(next);
    onChange(rgbToHex(hsvToRgb(next)));
  };

  /** 드래그 중 계속 따라오도록 window에 리스너를 걸고 pointerup에서 뗀다 */
  const trackDrag = (onMove: (ev: PointerEvent) => void) => {
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ── 색상 휠 ──
  // 명도는 휠에서 바뀌지 않으므로 pointerdown 시점 값을 잡아 두면
  // window 리스너가 오래된 상태를 붙잡는 문제가 없다.
  const handleWheelPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = wheelRef.current;
    if (!el) return;
    e.preventDefault();

    const rect = el.getBoundingClientRect();
    const v = hsv.v;
    const pick = (clientX: number, clientY: number) => {
      const radius = rect.width / 2;
      const dx = clientX - (rect.left + radius);
      const dy = clientY - (rect.top + rect.height / 2);
      const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      emit({
        h: (deg + 360) % 360,
        s: clamp(Math.hypot(dx, dy) / radius, 0, 1),
        v,
      });
    };

    pick(e.clientX, e.clientY);
    trackDrag((ev) => pick(ev.clientX, ev.clientY));
  };

  const handleWheelKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") emit({ ...hsv, h: (hsv.h - step + 360) % 360 });
    else if (e.key === "ArrowRight") emit({ ...hsv, h: (hsv.h + step) % 360 });
    else if (e.key === "ArrowUp")
      emit({ ...hsv, s: clamp(hsv.s + step / 100, 0, 1) });
    else if (e.key === "ArrowDown")
      emit({ ...hsv, s: clamp(hsv.s - step / 100, 0, 1) });
    else return;
    e.preventDefault();
  };

  // ── 명도 바 (위가 밝고 아래가 어둡다) ──
  const handleBarPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = barRef.current;
    if (!el) return;
    e.preventDefault();

    const rect = el.getBoundingClientRect();
    const { h, s } = hsv;
    const pick = (clientY: number) =>
      emit({ h, s, v: 1 - clamp((clientY - rect.top) / rect.height, 0, 1) });

    pick(e.clientY);
    trackDrag((ev) => pick(ev.clientY));
  };

  const handleBarKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === "ArrowUp" || e.key === "ArrowRight")
      emit({ ...hsv, v: clamp(hsv.v + step, 0, 1) });
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft")
      emit({ ...hsv, v: clamp(hsv.v - step, 0, 1) });
    else if (e.key === "Home") emit({ ...hsv, v: 1 });
    else if (e.key === "End") emit({ ...hsv, v: 0 });
    else return;
    e.preventDefault();
  };

  // ── RGB 입력 ──
  // 타이핑 중 빈 칸이 0으로 튀지 않도록 채널별 초안을 따로 들고,
  // 포커스가 빠지면 실제 값으로 되돌린다.
  const setChannel = (k: Channel, raw: string) => {
    setDrafts((d) => ({ ...d, [k]: raw }));
    if (raw.trim() === "") return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange(rgbToHex({ ...rgb, [k]: clamp255(n) }));
  };

  const clearDraft = (k: Channel) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[k];
      return next;
    });

  // ── hex 입력 ──
  const hexText = hexDraft ?? value;
  const hexInvalid = hexDraft !== null && normalizeHex(hexDraft) === null;

  const setHex = (raw: string) => {
    setHexDraft(raw);
    const n = normalizeHex(raw);
    if (n) onChange(n);
  };

  // 손잡이 위치: 각도 = 색상, 중심으로부터의 거리 = 채도
  const rad = (hsv.h * Math.PI) / 180;
  const handleLeft = 50 + Math.sin(rad) * hsv.s * 50;
  const handleTop = 50 - Math.cos(rad) * hsv.s * 50;

  // 명도 바는 현재 색상·채도의 가장 밝은 색에서 검정까지
  const barTopColor = rgbToHex(hsvToRgb({ h: hsv.h, s: hsv.s, v: 1 }));

  return (
    <div className="flex flex-col gap-2.5">
      {/* 색상 휠 + 명도 바 */}
      <div className="flex items-stretch justify-center gap-2.5">
        <div
          ref={wheelRef}
          onPointerDown={handleWheelPointerDown}
          onKeyDown={handleWheelKeyDown}
          tabIndex={0}
          role="application"
          aria-label="색상 휠 — 좌우 화살표로 색상, 위아래로 채도"
          className="relative h-[136px] w-[136px] shrink-0 cursor-crosshair rounded-full shadow-inner outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-primary"
          style={{ backgroundImage: `${WHEEL_SAT}, ${WHEEL_HUE}` }}
        >
          {/* 명도를 휠에도 반영해 실제 색과 어긋나지 않게 한다 */}
          <span
            className="pointer-events-none absolute inset-0 rounded-full bg-black"
            style={{ opacity: 1 - hsv.v }}
          />
          <span
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/30"
            style={{
              left: `${handleLeft}%`,
              top: `${handleTop}%`,
              backgroundColor: value,
            }}
          />
        </div>

        <div
          ref={barRef}
          onPointerDown={handleBarPointerDown}
          onKeyDown={handleBarKeyDown}
          tabIndex={0}
          role="slider"
          aria-label="명도"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsv.v * 100)}
          aria-valuetext={`${Math.round(hsv.v * 100)}%`}
          className="relative w-4 shrink-0 cursor-ns-resize rounded-full border border-border outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-primary"
          style={{
            backgroundImage: `linear-gradient(to bottom, ${barTopColor}, #000000)`,
          }}
        >
          <span
            className="pointer-events-none absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/30"
            style={{ top: `${(1 - hsv.v) * 100}%`, backgroundColor: value }}
          />
        </div>
      </div>

      {/* 미리보기 + hex */}
      <div className="flex items-center gap-2">
        <span
          className="h-7 w-7 shrink-0 rounded-md border border-border"
          style={{ backgroundColor: value }}
          aria-hidden
        />
        <input
          value={hexText}
          onChange={(e) => setHex(e.target.value)}
          onBlur={() => setHexDraft(null)}
          spellCheck={false}
          aria-label="hex 색상 값"
          className={`min-w-0 flex-1 rounded-md border bg-white px-2 py-1.5 font-mono text-xs uppercase outline-none focus:ring-2 focus:ring-primary ${
            hexInvalid ? "border-rose-400" : "border-border"
          }`}
        />
      </div>

      {/* RGB */}
      <div className="grid grid-cols-3 gap-1.5">
        {CHANNELS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1">
            <span className="w-3 shrink-0 text-[10px] font-semibold text-gray-400">
              {label}
            </span>
            <input
              type="number"
              min={0}
              max={255}
              value={drafts[key] ?? String(rgb[key])}
              onChange={(e) => setChannel(key, e.target.value)}
              onBlur={() => clearDraft(key)}
              aria-label={`${label} (0~255)`}
              className="min-w-0 flex-1 rounded-md border border-border bg-white px-1.5 py-1 text-xs outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        ))}
      </div>

      {/* 기본 색 스와치 */}
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.hex}
              type="button"
              onClick={() => onChange(p.hex)}
              title={p.name}
              aria-label={p.name}
              className={`h-5 w-5 rounded-full border border-black/10 ${
                value.toLowerCase() === p.hex.toLowerCase()
                  ? "ring-2 ring-gray-800 ring-offset-1"
                  : ""
              }`}
              style={{ backgroundColor: p.hex }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
