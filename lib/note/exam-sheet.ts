"use client";

import { AssetRecordType, createShapeId, type Editor, type TLAssetId, type TLImageAsset } from "tldraw";
import { exToPx, loadMath, splitMath, svgToImage } from "@/lib/math/mathjax";
import type { ExamItem } from "@/lib/types";

/** 글과 수식이 섞인 한 줄을 그리기 위한 토큰 */
type Token =
  | { kind: "word"; text: string; width: number }
  | { kind: "math"; image: HTMLImageElement; width: number; ascent: number; descent: number }
  | { kind: "space"; width: number };

/** 시험지 한 장의 가로 폭 (page 단위) */
const SHEET_WIDTH = 1000;
const MARGIN = 56;
const RENDER_SCALE = 2;

/**
 * 시험지를 이미지로 그려 캔버스에 잠긴 상태로 올린다.
 * DOM 이 아니라 이미지로 올려야 AI 펜이 캡처할 때 문제 본문까지 함께 읽힌다.
 */
export async function placeExamSheet(editor: Editor, exam: ExamItem[], title: string) {
  if (!exam.length) return;

  const pages = paginate(exam);
  let cursorY = 0;

  for (const [pageIndex, items] of pages.entries()) {
    const canvas = await renderPage(items, title, pageIndex + 1, pages.length);
    const height = (SHEET_WIDTH * canvas.height) / canvas.width;
    const assetId: TLAssetId = AssetRecordType.createId();
    const asset: TLImageAsset = {
      id: assetId,
      typeName: "asset",
      type: "image",
      meta: {},
      props: {
        name: `${title} ${pageIndex + 1}쪽`,
        src: canvas.toDataURL("image/png"),
        w: canvas.width,
        h: canvas.height,
        mimeType: "image/png",
        isAnimated: false,
      },
    };
    editor.createAssets([asset]);

    const shapeId = createShapeId();
    editor.createShape({
      id: shapeId,
      type: "image",
      x: 0,
      y: cursorY,
      isLocked: true,
      props: { assetId, w: SHEET_WIDTH, h: height },
    });
    cursorY += height + 48;
  }

  const first = editor.getCurrentPageShapes()[0];
  const bounds = first ? editor.getShapePageBounds(first) : undefined;
  if (bounds) editor.zoomToBounds(bounds, { inset: 12 });
}

/** 한 쪽에 들어갈 만큼 문항을 나눈다. */
function paginate(exam: ExamItem[]): ExamItem[][] {
  const pages: ExamItem[][] = [];
  let current: ExamItem[] = [];
  let used = 0;

  for (const item of exam) {
    const cost = estimateHeight(item);
    if (used + cost > 1180 && current.length) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(item);
    used += cost;
  }
  if (current.length) pages.push(current);
  return pages;
}

function estimateHeight(item: ExamItem) {
  const lines = Math.ceil(item.question.length / 30) + (item.question.includes("$") ? 1 : 0);
  const passage = item.passage ? Math.ceil(item.passage.length / 40) * 26 + 30 : 0;
  const choices = (item.choices?.length ?? 0) * 34;
  const space = item.kind === "essay" ? 260 : item.kind === "short" ? 150 : 40;
  return 60 + passage + lines * 36 + choices + space;
}

const CIRCLED = ["①", "②", "③", "④", "⑤"];

async function renderPage(items: ExamItem[], title: string, page: number, total: number) {
  const canvas = document.createElement("canvas");
  const width = SHEET_WIDTH * RENDER_SCALE;
  canvas.width = width;
  canvas.height = 1414 * RENDER_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const font = '"Pretendard Variable", "Apple SD Gothic Neo", system-ui, sans-serif';
  ctx.scale(RENDER_SCALE, RENDER_SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SHEET_WIDTH, 1414);

  let y = MARGIN;

  // 머리말
  ctx.fillStyle = "#1b1d2a";
  ctx.font = `800 26px ${font}`;
  ctx.fillText(title, MARGIN, y + 22);
  ctx.fillStyle = "#6f7590";
  ctx.font = `600 13px ${font}`;
  ctx.textAlign = "right";
  ctx.fillText(`${page} / ${total} · 이름: ____________`, SHEET_WIDTH - MARGIN, y + 22);
  ctx.textAlign = "left";
  y += 44;

  ctx.strokeStyle = "#e5e5e9";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, y);
  ctx.lineTo(SHEET_WIDTH - MARGIN, y);
  ctx.stroke();
  y += 34;

  for (const item of items) {
    ctx.fillStyle = "#3b6cff";
    ctx.font = `800 16px ${font}`;
    ctx.fillText(`${item.number}.`, MARGIN, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#8a8fa8";
    ctx.font = `500 13px ${font}`;
    ctx.fillText(`${item.points}점`, SHEET_WIDTH - MARGIN, y);
    ctx.textAlign = "left";
    y += 26;

    if (item.passage) {
      // 지문·조건 상자
      const boxTop = y - 16;
      const lines = Math.ceil(item.passage.length / 40);
      const boxHeight = lines * 26 + 24;
      ctx.fillStyle = "#f3f5fa";
      roundRect(ctx, MARGIN + 22, boxTop, SHEET_WIDTH - MARGIN * 2 - 22, boxHeight, 10);
      ctx.fill();
      ctx.fillStyle = "#3a3f55";
      ctx.font = `400 15px ${font}`;
      const passageEnd = await drawRich(ctx, item.passage, MARGIN + 36, y + 2, SHEET_WIDTH - MARGIN * 2 - 50, 26, 15, font, 400);
      y = Math.max(boxTop + boxHeight, passageEnd + 4) + 22;
    }

    ctx.fillStyle = "#1b1d2a";
    y = await drawRich(ctx, item.question, MARGIN + 22, y, SHEET_WIDTH - MARGIN * 2 - 22, 32, 17, font, 500);
    y += 10;

    if (item.choices?.length) {
      ctx.fillStyle = "#2b2f44";
      for (const [index, choice] of item.choices.entries()) {
        y = await drawRich(ctx, `${CIRCLED[index] ?? index + 1} ${choice}`, MARGIN + 34, y, SHEET_WIDTH - MARGIN * 2 - 34, 30, 16, font, 400);
        y += 2;
      }
      y += 10;
    }

    // 답 쓰는 자리 (5지선다는 짧게, 서술은 길게)
    const space = item.kind === "essay" ? 220 : item.kind === "short" ? 110 : 40;
    ctx.strokeStyle = "#e5e5e9";
    ctx.setLineDash([4, 5]);
    for (let line = 34; line < space; line += 38) {
      ctx.beginPath();
      ctx.moveTo(MARGIN + 22, y + line);
      ctx.lineTo(SHEET_WIDTH - MARGIN, y + line);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    y += space + 22;
  }

  return canvas;
}

/**
 * 글과 `$수식$` 이 섞인 문단을 줄바꿈하며 그린다. 수식은 MathJax SVG 를 이미지로 얹는다.
 * 그린 뒤 다음 줄의 기준선 y 를 돌려준다.
 */
async function drawRich(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  fontSize: number,
  font: string,
  weight: number,
): Promise<number> {
  ctx.font = `${weight} ${fontSize}px ${font}`;
  const segments = splitMath(text);
  const tokens: Token[] = [];
  const spaceWidth = ctx.measureText(" ").width;

  const engine = segments.some((s) => s.type === "math") ? await loadMath() : null;

  for (const segment of segments) {
    if (segment.type === "math" && engine) {
      try {
        const out = engine.convert(segment.value, segment.display);
        const image = await svgToImage(out.svg);
        const width = exToPx(out.widthEx, fontSize);
        const height = exToPx(out.heightEx, fontSize);
        const descent = exToPx(out.depthEx, fontSize);
        tokens.push({ kind: "math", image, width, ascent: height - descent, descent });
        continue;
      } catch {
        /* 수식을 못 그리면 평문으로 */
      }
    }
    const value = segment.type === "math" ? segment.value : segment.value;
    // 공백 기준으로 나누되, 공백 없는 긴 덩어리(한글 문장)는 글자 단위로 자른다.
    for (const chunk of value.split(/(\s+)/)) {
      if (!chunk) continue;
      if (/^\s+$/.test(chunk)) {
        tokens.push({ kind: "space", width: spaceWidth });
        continue;
      }
      if (ctx.measureText(chunk).width <= maxWidth * 0.6) {
        tokens.push({ kind: "word", text: chunk, width: ctx.measureText(chunk).width });
      } else {
        for (const ch of chunk) tokens.push({ kind: "word", text: ch, width: ctx.measureText(ch).width });
      }
    }
  }

  // 줄 나누기
  const lines: Token[][] = [[]];
  let lineWidth = 0;
  for (const token of tokens) {
    if (token.kind === "space") {
      if (lines[lines.length - 1].length) {
        lines[lines.length - 1].push(token);
        lineWidth += token.width;
      }
      continue;
    }
    if (lineWidth + token.width > maxWidth && lines[lines.length - 1].length) {
      lines.push([]);
      lineWidth = 0;
    }
    lines[lines.length - 1].push(token);
    lineWidth += token.width;
  }

  // 줄마다 수식 높이만큼 줄 간격을 늘린다
  let baseline = y;
  const textAscent = fontSize * 0.8;
  for (const line of lines) {
    const ascent = Math.max(textAscent, ...line.map((t) => (t.kind === "math" ? t.ascent : 0)));
    const descent = Math.max(fontSize * 0.25, ...line.map((t) => (t.kind === "math" ? t.descent : 0)));
    baseline += Math.max(0, ascent - textAscent);
    let cursor = x;
    for (const token of line) {
      if (token.kind === "word") {
        ctx.fillText(token.text, cursor, baseline);
      } else if (token.kind === "math") {
        ctx.drawImage(token.image, cursor, baseline - token.ascent, token.width, token.ascent + token.descent);
      }
      cursor += token.width;
    }
    baseline += Math.max(lineHeight - (ascent - textAscent), descent + textAscent * 0.4);
  }
  return baseline;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  let line = "";
  let cursor = y;
  for (const char of text) {
    const candidate = line + char;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      cursor += lineHeight;
      line = char;
    } else {
      line = candidate;
    }
  }
  if (line) {
    ctx.fillText(line, x, cursor);
    cursor += lineHeight;
  }
  return cursor;
}
