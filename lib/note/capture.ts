"use client";

import { Box, type Editor, type VecLike } from "tldraw";

const MAX_EDGE = 1400;
const MIN_CONTEXT_PADDING = 220;
/** 대표색. 올가미 표시는 브랜드 블루로 통일한다. */
const TARGET_COLOR = "#315EFF";

export interface CaptureResult {
  base64: string;
  mediaType: "image/png";
  width: number;
  height: number;
}

/**
 * 현재 페이지를 캡처하되 올가미 영역을 형광펜처럼 덧칠한다.
 * 올가미 밖의 내용도 문맥으로 함께 담아야 하므로
 * 캡처 범위는 [현재 화면 ∪ 올가미+여백] 의 합집합이다.
 */
export async function captureWithLasso(editor: Editor, lasso: VecLike[]): Promise<CaptureResult> {
  const lassoBox = Box.FromPoints(lasso as { x: number; y: number }[]);
  const region = Box.Common([editor.getViewportPageBounds(), Box.ExpandBy(lassoBox, MIN_CONTEXT_PADDING)]);

  const shapes = editor.getCurrentPageShapes().filter((shape) => {
    const bounds = editor.getShapePageBounds(shape);
    return bounds ? region.collides(bounds) : false;
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(region.width, region.height));
  const base = await renderBase(editor, shapes, region, scale);

  const canvas = document.createElement("canvas");
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (base.image) ctx.drawImage(base.image, 0, 0, canvas.width, canvas.height);

  drawLassoHighlight(ctx, lasso, region, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/png");
  return {
    base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mediaType: "image/png",
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * 제출용 — 시험지 **쪽마다** 한 장씩 캡처한다.
 * 노트 전체를 한 장으로 줄이면 손글씨가 뭉개져서 채점 모델이 읽지 못한다.
 * 잠긴 이미지(시험지 쪽)를 기준으로 그 위에 겹친 필기를 함께 담고, 시험지가 없는 빈 노트는 전체를 한 장으로 담는다.
 */
export async function captureNotePages(editor: Editor): Promise<CaptureResult[]> {
  const shapes = editor.getCurrentPageShapes();
  if (!shapes.length) return [];

  const pages = shapes
    .filter((shape) => shape.type === "image" && shape.isLocked)
    .map((shape) => ({ shape, bounds: editor.getShapePageBounds(shape)! }))
    .filter((page) => page.bounds)
    .sort((a, b) => a.bounds.y - b.bounds.y);

  const regions = pages.length
    ? pages.map((page) => Box.ExpandBy(page.bounds, 16))
    : [Box.ExpandBy(Box.Common(shapes.map((shape) => editor.getShapePageBounds(shape)).filter(Boolean) as Box[]), 24)];

  const results: CaptureResult[] = [];
  for (const region of regions) {
    const inRegion = shapes.filter((shape) => {
      const bounds = editor.getShapePageBounds(shape);
      return bounds ? region.collides(bounds) : false;
    });
    if (!inRegion.length) continue;
    // 손글씨가 또렷하게 읽히도록 쪽 폭 기준 1600px 안팎으로 맞춘다.
    const scale = Math.min(2, 1600 / Math.max(region.width, 1));
    const { blob, width, height } = await editor.toImage(inRegion.map((shape) => shape.id), {
      format: "png",
      background: true,
      bounds: region,
      padding: 0,
      scale,
      pixelRatio: 1,
      darkMode: false,
    });
    const dataUrl = await blobToDataUrl(blob);
    results.push({ base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/png", width, height });
  }
  return results;
}

/** 하위 호환 — 첫 장만 필요할 때 */
export async function captureWholeNote(editor: Editor): Promise<CaptureResult | null> {
  const pages = await captureNotePages(editor);
  return pages[0] ?? null;
}

async function renderBase(
  editor: Editor,
  shapes: { id: string }[],
  region: Box,
  scale: number,
): Promise<{ image: HTMLImageElement | null; width: number; height: number }> {
  const fallbackWidth = Math.max(1, Math.round(region.width * scale));
  const fallbackHeight = Math.max(1, Math.round(region.height * scale));
  if (!shapes.length) return { image: null, width: fallbackWidth, height: fallbackHeight };

  try {
    const { blob, width, height } = await editor.toImage(shapes.map((shape) => shape.id) as never, {
      format: "png",
      background: true,
      bounds: region,
      padding: 0,
      scale,
      pixelRatio: 1,
      darkMode: false,
    });
    return { image: await blobToImage(blob), width, height };
  } catch (error) {
    console.warn("[capture] 내보내기 실패", error);
    return { image: null, width: fallbackWidth, height: fallbackHeight };
  }
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("캡처 이미지를 불러오지 못했습니다."));
    };
    image.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

function drawLassoHighlight(
  ctx: CanvasRenderingContext2D,
  lasso: VecLike[],
  region: Box,
  width: number,
  height: number,
) {
  const points = lasso.map((point) => ({
    x: ((point.x - region.x) / region.width) * width,
    y: ((point.y - region.y) / region.height) * height,
  }));
  if (points.length < 2) return;

  const lineWidth = Math.max(2, Math.round(Math.min(width, height) / 220));
  const path = new Path2D();
  path.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) path.lineTo(point.x, point.y);
  path.closePath();

  ctx.save();
  ctx.fillStyle = "rgba(49, 94, 255, 0.13)";
  ctx.fill(path);
  ctx.strokeStyle = TARGET_COLOR;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.setLineDash([lineWidth * 4, lineWidth * 3]);
  ctx.stroke(path);
  ctx.restore();

  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const fontSize = Math.max(11, Math.round(Math.min(width, height) / 60));
  ctx.save();
  ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const textWidth = ctx.measureText("TARGET").width;
  const padX = fontSize * 0.5;
  const boxWidth = textWidth + padX * 2;
  const boxHeight = fontSize * 1.7;
  const boxX = Math.min(Math.max(0, minX), width - boxWidth);
  const boxY = Math.max(0, minY - boxHeight - lineWidth);
  ctx.fillStyle = TARGET_COLOR;
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText("TARGET", boxX + padX, boxY + boxHeight / 2);
  ctx.restore();
}
