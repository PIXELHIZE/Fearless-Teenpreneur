"use client";

import { atom, type Editor } from "tldraw";
import { captureWithLasso } from "./capture";
import { askAiPen } from "@/lib/actions/note";
import type { AiPenResult } from "./ai-pen";

export interface Point {
  x: number;
  y: number;
}

export interface AiPin {
  id: string;
  tlPageId: string;
  x: number;
  y: number;
  lasso: Point[];
  status: "loading" | "done" | "error";
  result?: AiPenResult;
  error?: string;
  createdAt: number;
}

/** 탭(점 찍기)만 했을 때 대신 만들어 줄 원형 올가미 반지름 */
const TAP_RADIUS = 38;

export class AiPenController {
  readonly lasso = atom<Point[] | null>("ai-pen:lasso", null);
  readonly pins = atom<AiPin[]>("ai-pen:pins", []);
  readonly openPinId = atom<string | null>("ai-pen:open", null);
  readonly armedPinId = atom<string | null>("ai-pen:armed", null);

  private previousToolId = "draw";

  constructor(
    readonly editor: Editor,
    readonly noteId: string,
    initial: AiPin[],
    private readonly persist: (pins: AiPin[]) => void,
  ) {
    this.pins.set(initial);
  }

  rememberPreviousTool(toolId: string) {
    if (toolId !== "ai-pen") this.previousToolId = toolId;
  }

  restorePreviousTool() {
    try {
      this.editor.setCurrentTool(this.previousToolId);
    } catch {
      this.editor.setCurrentTool("select");
    }
  }

  beginLasso(point: Point) {
    this.lasso.set([point]);
    this.openPinId.set(null);
    this.armedPinId.set(null);
  }

  extendLasso(point: Point) {
    const current = this.lasso.get();
    if (!current) return;
    const last = current[current.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) < 2) return;
    this.lasso.set([...current, point]);
  }

  cancelLasso() {
    this.lasso.set(null);
  }

  finishLasso() {
    const raw = this.lasso.get();
    this.lasso.set(null);
    if (!raw?.length) return;

    const path = normalizePath(raw);
    const anchor = raw[raw.length - 1];
    const pin: AiPin = {
      id: crypto.randomUUID(),
      tlPageId: this.editor.getCurrentPageId(),
      x: anchor.x,
      y: anchor.y,
      lasso: path,
      status: "loading",
      createdAt: Date.now(),
    };

    this.pins.set([...this.pins.get(), pin]);
    this.openPinId.set(pin.id);
    this.restorePreviousTool();
    void this.run(pin.id, path);
  }

  private async run(pinId: string, path: Point[]) {
    try {
      const capture = await captureWithLasso(this.editor, path);
      const response = await askAiPen(capture.base64, capture.mediaType);
      if (!response.result) {
        this.patch(pinId, { status: "error", error: response.error ?? "AI 호출에 실패했습니다." });
        return;
      }
      this.patch(pinId, { status: "done", result: response.result });
    } catch (error) {
      this.patch(pinId, {
        status: "error",
        error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      });
    }
  }

  retry(pinId: string) {
    const pin = this.pins.get().find((item) => item.id === pinId);
    if (!pin) return;
    this.patch(pinId, { status: "loading", error: undefined });
    void this.run(pinId, pin.lasso);
  }

  private patch(pinId: string, patch: Partial<AiPin>) {
    const next = this.pins.get().map((pin) => (pin.id === pinId ? { ...pin, ...patch } : pin));
    this.pins.set(next);
    this.persist(next.filter((pin) => pin.status !== "loading"));
  }

  togglePin(pinId: string) {
    this.openPinId.set(this.openPinId.get() === pinId ? null : pinId);
    this.armedPinId.set(null);
  }

  closePin() {
    this.openPinId.set(null);
  }

  armPin(pinId: string) {
    this.armedPinId.set(pinId);
    this.openPinId.set(null);
  }

  disarmPin() {
    this.armedPinId.set(null);
  }

  deletePin(pinId: string) {
    const next = this.pins.get().filter((pin) => pin.id !== pinId);
    this.pins.set(next);
    this.persist(next.filter((pin) => pin.status !== "loading"));
    if (this.openPinId.get() === pinId) this.openPinId.set(null);
    if (this.armedPinId.get() === pinId) this.armedPinId.set(null);
  }
}

/** 점 하나만 찍었으면 그 자리를 감싸는 원형 올가미로 바꾼다. */
function normalizePath(points: Point[]): Point[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  if (points.length >= 4 && (Math.max(...xs) - Math.min(...xs) > 12 || Math.max(...ys) - Math.min(...ys) > 12)) {
    return points;
  }
  const center = points[points.length - 1];
  return Array.from({ length: 24 }, (_, index) => {
    const angle = (index / 24) * Math.PI * 2;
    return { x: center.x + Math.cos(angle) * TAP_RADIUS, y: center.y + Math.sin(angle) * TAP_RADIUS };
  });
}

const controllers = new WeakMap<Editor, AiPenController>();

export function attachAiPen(
  editor: Editor,
  noteId: string,
  initial: AiPin[],
  persist: (pins: AiPin[]) => void,
): AiPenController {
  const existing = controllers.get(editor);
  if (existing) return existing;
  const controller = new AiPenController(editor, noteId, initial, persist);
  controllers.set(editor, controller);
  return controller;
}

export function getAiPen(editor: Editor): AiPenController | undefined {
  return controllers.get(editor);
}
