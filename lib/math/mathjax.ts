"use client";

/**
 * 수식 렌더링. 모델은 수식을 `$...$` (인라인) / `$$...$$` (블록) LaTeX 로 쓴다.
 * MathJax 브라우저 번들(tex-svg)을 스크립트로 한 번 올리고 tex2svg 를 쓴다.
 * SVG 출력이라 캔버스(시험지)에 이미지로 그릴 수 있고, DOM 에도 그대로 넣을 수 있다.
 */

export type Segment = { type: "text"; value: string } | { type: "math"; value: string; display: boolean };

export interface MathSvg {
  svg: string;
  widthEx: number;
  heightEx: number;
  /** 기준선 아래로 내려가는 깊이(ex) */
  depthEx: number;
}

type Engine = { convert: (tex: string, display: boolean) => MathSvg };

interface MathJaxGlobal {
  startup?: { promise?: Promise<unknown>; typeset?: boolean };
  tex2svg?: (tex: string, options?: { display?: boolean }) => HTMLElement;
  svg?: Record<string, unknown>;
  tex?: Record<string, unknown>;
}

declare global {
  interface Window {
    MathJax?: MathJaxGlobal;
  }
}

const SCRIPT_SRC = "/mathjax/tex-svg.js";
let enginePromise: Promise<Engine> | null = null;
const cache = new Map<string, MathSvg>();

export function loadMath(): Promise<Engine> {
  if (enginePromise) return enginePromise;
  enginePromise = new Promise<Engine>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("브라우저에서만 수식을 그릴 수 있습니다."));
      return;
    }

    const finish = () => {
      const mj = window.MathJax;
      if (!mj?.tex2svg) {
        reject(new Error("MathJax 를 불러오지 못했습니다."));
        return;
      }
      resolve({
        convert(source, display) {
          const key = `${display ? "D" : "I"}:${source}`;
          const hit = cache.get(key);
          if (hit) return hit;
          const container = mj.tex2svg!(source, { display });
          const svgNode = container.querySelector("svg");
          if (!svgNode) throw new Error("수식 변환 실패");
          // 캔버스에 이미지로 올릴 때는 currentColor 가 먹지 않으니 잉크색을 박아 둔다.
          let svg = svgNode.outerHTML.replace(/currentColor/g, "#1b1d2a");
          if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
          const widthEx = parseFloat(svgNode.getAttribute("width") ?? "1");
          const heightEx = parseFloat(svgNode.getAttribute("height") ?? "2");
          const depthEx = Math.abs(parseFloat(svgNode.style.verticalAlign || "0"));
          const result = { svg, widthEx, heightEx, depthEx };
          cache.set(key, result);
          return result;
        },
      });
    };

    if (window.MathJax?.tex2svg) {
      finish();
      return;
    }

    // 스크립트보다 먼저 설정을 둬야 한다. 자동 typeset 은 끄고, 폰트는 SVG 안에 인라인으로.
    window.MathJax = {
      startup: { typeset: false },
      svg: { fontCache: "none" },
      tex: { packages: { "[+]": ["ams", "noundefined"] } },
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const onReady = () => {
      const ready = window.MathJax?.startup?.promise;
      if (ready) void ready.then(finish, reject);
      else finish();
    };
    if (existing) {
      onReady();
      return;
    }
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = onReady;
    script.onerror = () => reject(new Error("MathJax 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  enginePromise.catch(() => {
    // 실패했으면 다음에 다시 시도할 수 있게 한다.
    enginePromise = null;
  });
  return enginePromise;
}

/** `$...$`, `$$...$$`, `\(...\)`, `\[...\]` 를 찾아 글과 수식으로 쪼갠다. */
export function splitMath(text: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: "text", value: text.slice(last, index) });
    const display = match[1] !== undefined || match[2] !== undefined;
    const value = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").trim();
    if (value) segments.push({ type: "math", value, display });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", value: text.slice(last) });
  return segments;
}

export function hasMath(text: string): boolean {
  return /\$[^$\n]+\$|\$\$[\s\S]+?\$\$|\\\(|\\\[/.test(text);
}

/** `$...$` 를 벗겨 낸 평문 */
export function stripMath(text: string): string {
  return text.replace(/\$\$?([\s\S]+?)\$\$?/g, "$1").replace(/\\[()[\]]/g, "");
}

/**
 * 캔버스용: ex → px.
 * MathJax 가 잰 ex 는 글자 크기의 약 절반인데, 그대로 두면 한글 본문 옆에서 수식이 작아 보인다.
 * 본문과 같은 굵기로 읽히도록 조금 키운다.
 */
export function exToPx(ex: number, fontSize: number) {
  return ex * fontSize * 0.62;
}

export function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("수식 이미지를 만들지 못했습니다."));
    };
    image.src = url;
  });
}
