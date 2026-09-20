// MathJax 브라우저 번들을 public/ 으로 복사한다. 번들러를 거치지 않고 스크립트로 올리기 위해서다.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/mathjax-full/es5/tex-svg.js");
const to = join(root, "public/mathjax/tex-svg.js");

if (!existsSync(from)) {
  console.warn("[copy-mathjax] mathjax-full 을 찾을 수 없습니다. npm install 후 다시 실행하세요.");
  process.exit(0);
}
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log("[copy-mathjax] public/mathjax/tex-svg.js 준비 완료");
