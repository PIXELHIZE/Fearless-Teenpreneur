"use client";

import { StateNode } from "tldraw";
import { getAiPen } from "./ai-pen-controller";

/**
 * AI 펜 도구.
 * 올가미는 "여기에 대해 물어본다"는 이벤트 위치일 뿐, 노트에 선으로 남지 않는다.
 */
export class AiPenTool extends StateNode {
  static override id = "ai-pen";

  private drawing = false;

  override onEnter() {
    this.editor.setCursor({ type: "cross", rotation: 0 });
  }

  override onExit() {
    this.drawing = false;
    getAiPen(this.editor)?.cancelLasso();
    this.editor.setCursor({ type: "default", rotation: 0 });
  }

  override onPointerDown() {
    const controller = getAiPen(this.editor);
    if (!controller) return;
    this.drawing = true;
    controller.beginLasso(this.editor.inputs.currentPagePoint.toJson());
  }

  override onPointerMove() {
    if (!this.drawing) return;
    getAiPen(this.editor)?.extendLasso(this.editor.inputs.currentPagePoint.toJson());
  }

  override onPointerUp() {
    if (!this.drawing) return;
    this.drawing = false;
    getAiPen(this.editor)?.finishLasso();
  }

  override onCancel() {
    this.abort();
  }

  override onInterrupt() {
    this.abort();
  }

  private abort() {
    if (!this.drawing) return;
    this.drawing = false;
    getAiPen(this.editor)?.cancelLasso();
  }
}
