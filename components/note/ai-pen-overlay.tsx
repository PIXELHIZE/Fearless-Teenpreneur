"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getStroke } from "perfect-freehand";
import { useEditor, useValue } from "tldraw";
import { Sparkles, Trash2, TriangleAlert, X } from "lucide-react";
import { getAiPen, type AiPin, type Point } from "@/lib/note/ai-pen-controller";
import { AiCommentCard } from "./ai-comment-card";

const CARD_WIDTH = 332;
const CARD_MAX_HEIGHT = 440;
const PIN_SIZE = 30;

/**
 * 캔버스 위 화면 좌표 레이어.
 * 올가미 미리보기, 피그마 코멘트 같은 핀, 열린 메모 카드를 그린다.
 */
export function AiPenOverlay() {
  const editor = useEditor();
  const controller = getAiPen(editor);

  const camera = useValue("camera", () => editor.getCamera(), [editor]);
  const viewport = useValue("viewport", () => editor.getViewportScreenBounds(), [editor]);
  const currentPageId = useValue("page", () => editor.getCurrentPageId(), [editor]);

  const lasso = useValue("lasso", () => controller?.lasso.get() ?? null, [controller]);
  const pins = useValue("pins", () => controller?.pins.get() ?? [], [controller]);
  const openPinId = useValue("open", () => controller?.openPinId.get() ?? null, [controller]);
  const armedPinId = useValue("armed", () => controller?.armedPinId.get() ?? null, [controller]);

  if (!controller) return null;

  const toScreen = (point: Point) => {
    const view = editor.pageToViewport(point);
    return { x: view.x, y: view.y };
  };

  const visiblePins = pins.filter((pin) => pin.tlPageId === currentPageId);
  const openPin = visiblePins.find((pin) => pin.id === openPinId);

  return (
    <>
      {lasso && lasso.length > 1 ? <LassoPreview points={lasso.map(toScreen)} /> : null}
      {openPin ? <LassoGhost points={openPin.lasso.map(toScreen)} /> : null}

      {visiblePins.map((pin) => {
        const position = toScreen(pin);
        return (
          <PinButton
            key={pin.id}
            pin={pin}
            x={position.x}
            y={position.y}
            isOpen={pin.id === openPinId}
            isArmed={pin.id === armedPinId}
            onToggle={() => controller.togglePin(pin.id)}
            onArm={() => controller.armPin(pin.id)}
            onDisarm={() => controller.disarmPin()}
            onDelete={() => controller.deletePin(pin.id)}
          />
        );
      })}

      {openPin
        ? createPortal(
            <CardLayer
              pin={openPin}
              anchor={toScreen(openPin)}
              viewport={{ width: viewport.width, height: viewport.height }}
              onClose={() => controller.closePin()}
              onDelete={() => controller.deletePin(openPin.id)}
              onRetry={() => controller.retry(openPin.id)}
            />,
            // tldraw 패널(z-index 300)보다 위에 떠야 가려지지 않는다.
            editor.getContainer(),
          )
        : null}

      <span hidden data-camera={`${camera.x}:${camera.y}:${camera.z}`} />
    </>
  );
}

function LassoPreview({ points }: { points: Point[] }) {
  const stroke = getStroke(
    points.map((p) => [p.x, p.y]),
    { size: 7, thinning: 0.35, smoothing: 0.6, streamline: 0.45, last: false },
  );
  return (
    <svg className="ai-lasso" aria-hidden>
      <path className="ai-lasso-fill" d={toClosedPath(points)} />
      <path className="ai-lasso-stroke" d={toStrokePath(stroke)} />
    </svg>
  );
}

function LassoGhost({ points }: { points: Point[] }) {
  return (
    <svg className="ai-lasso ai-lasso-ghost" aria-hidden>
      <path d={toClosedPath(points)} />
    </svg>
  );
}

function PinButton({
  pin,
  x,
  y,
  isOpen,
  isArmed,
  onToggle,
  onArm,
  onDisarm,
  onDelete,
}: {
  pin: AiPin;
  x: number;
  y: number;
  isOpen: boolean;
  isArmed: boolean;
  onToggle: () => void;
  onArm: () => void;
  onDisarm: () => void;
  onDelete: () => void;
}) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clearTimer, []);

  return (
    <div className="ai-pin-wrap" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <button
        type="button"
        className="ai-pin"
        data-status={pin.status}
        data-open={isOpen ? "true" : undefined}
        style={{ width: PIN_SIZE, height: PIN_SIZE }}
        aria-label={pin.status === "loading" ? "AI 펜 분석 중" : "AI 펜 메모 열기"}
        onPointerDown={(event) => {
          event.stopPropagation();
          longPressed.current = false;
          timer.current = window.setTimeout(() => {
            longPressed.current = true;
            onArm();
          }, 480);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          clearTimer();
          if (!longPressed.current) onToggle();
        }}
        onPointerLeave={clearTimer}
        onContextMenu={(event) => {
          event.preventDefault();
          longPressed.current = true;
          clearTimer();
          onArm();
        }}
      >
        {pin.status === "loading" ? <span className="ai-pin-spinner" /> : null}
        {pin.status === "error" ? <TriangleAlert size={14} aria-hidden /> : null}
        {pin.status === "done" ? <Sparkles size={14} aria-hidden /> : null}
      </button>

      {isArmed ? (
        <div className="ai-pin-confirm">
          <button type="button" className="ai-pin-delete" onClick={onDelete} aria-label="이 메모 삭제">
            <Trash2 size={15} aria-hidden />
          </button>
          <button type="button" className="ai-pin-cancel" onClick={onDisarm} aria-label="취소">
            <X size={15} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CardLayer({
  pin,
  anchor,
  viewport,
  onClose,
  onDelete,
  onRetry,
}: {
  pin: AiPin;
  anchor: Point;
  viewport: { width: number; height: number };
  onClose: () => void;
  onDelete: () => void;
  onRetry: () => void;
}) {
  const flipX = anchor.x + PIN_SIZE + 12 + CARD_WIDTH > viewport.width;
  const flipY = anchor.y + CARD_MAX_HEIGHT > viewport.height && anchor.y > viewport.height / 2;

  const rawLeft = flipX ? anchor.x - CARD_WIDTH - 12 : anchor.x + PIN_SIZE + 12;
  const left = Math.max(8, Math.min(rawLeft, viewport.width - CARD_WIDTH - 8));
  const position = flipY
    ? { bottom: Math.max(8, viewport.height - anchor.y + 8) }
    : { top: Math.max(8, anchor.y - PIN_SIZE) };

  return (
    <div className="ai-card-layer" style={{ left, width: CARD_WIDTH, ...position }}>
      <AiCommentCard key={pin.id} pin={pin} onClose={onClose} onDelete={onDelete} onRetry={onRetry} />
    </div>
  );
}

function toClosedPath(points: Point[]) {
  if (!points.length) return "";
  return `M ${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")} Z`;
}

function toStrokePath(stroke: number[][]) {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], index, array) => {
      const [x1, y1] = array[(index + 1) % array.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", stroke[0][0], stroke[0][1], "Q"] as (string | number)[],
  );
  d.push("Z");
  return d.join(" ");
}
