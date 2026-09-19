import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const destination = path.resolve(root, "teum-logo");
const publicDir = path.join(root, "public/brand");
const geometry = JSON.parse(await fs.readFile(path.join(root, "lib/logo-geometry.json"), "utf8"));
const {symbolPath, wordmarkPaths, dot} = geometry;
const wordmark = color => `<g fill="${color}" fill-rule="evenodd">${wordmarkPaths.map(d => `<path d="${d}"/>`).join("")}</g>`;
const symbol = (ink, background) => `${background ? `<rect width="100" height="100" rx="24" fill="${background}"/>` : ""}<path d="${symbolPath}" fill="${ink}"/><circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${ink}"/>`;
const svg = (body, viewBox, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}">${body}</svg>\n`;
await fs.mkdir(destination, {recursive:true});
await fs.mkdir(publicDir, {recursive:true});
const variants = {
  "teum-logo-primary.svg": svg(symbol("#FFFFFF","#315EFF") + `<g transform="translate(116 0)">${wordmark("#111113")}</g>`, "0 0 406 100", "teum primary logo"),
  "teum-logo-black.svg": svg(symbol("#FFFFFF","#111113") + `<g transform="translate(116 0)">${wordmark("#111113")}</g>`, "0 0 406 100", "teum black logo"),
  "teum-logo-white.svg": svg(symbol("#111113","#FFFFFF") + `<g transform="translate(116 0)">${wordmark("#FFFFFF")}</g>`, "0 0 406 100", "teum white logo"),
  "teum-wordmark-black.svg": svg(wordmark("#111113"), "0 0 288 100", "teum wordmark"),
  "teum-wordmark-white.svg": svg(wordmark("#FFFFFF"), "0 0 288 100", "teum white wordmark"),
  "teum-symbol-blue.svg": svg(symbol("#FFFFFF","#315EFF"), "0 0 100 100", "teum app icon"),
  "teum-symbol-black.svg": svg(symbol("#FFFFFF","#111113"), "0 0 100 100", "teum black app icon"),
  "teum-symbol-transparent.svg": svg(symbol("#111113",null), "0 0 100 100", "teum t dot symbol"),
};
for (const [name, source] of Object.entries(variants)) {
  await fs.writeFile(path.join(destination,name),source);
  await fs.writeFile(path.join(publicDir,name),source);
}
const board = svg(`<rect width="1440" height="1000" fill="#F5F5F7"/>
<text x="72" y="68" fill="#65656F" font-family="Arial,sans-serif" font-size="16" letter-spacing="2">teum / BRAND IDENTITY</text>
<text x="1368" y="68" text-anchor="end" fill="#65656F" font-family="Arial,sans-serif" font-size="16">01</text>
<rect x="48" y="100" width="1344" height="470" rx="24" fill="#FFFFFF"/>
<g transform="translate(320 230) scale(2)">${symbol("#FFFFFF","#315EFF")}<g transform="translate(116 0)">${wordmark("#111113")}</g></g>
<text x="84" y="530" fill="#65656F" font-family="Arial,sans-serif" font-size="16">PRIMARY LOCKUP</text>
<rect x="48" y="594" width="432" height="358" rx="24" fill="#315EFF"/>
<g transform="translate(166 660) scale(2)">${symbol("#FFFFFF",null)}</g>
<text x="84" y="914" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="16">t. / SYMBOL</text>
<rect x="504" y="594" width="432" height="358" rx="24" fill="#111113"/>
<g transform="translate(547 710) scale(1.2)">${wordmark("#FFFFFF")}</g>
<text x="540" y="914" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="16">WORDMARK / REVERSE</text>
<rect x="960" y="594" width="432" height="358" rx="24" fill="#FFFFFF"/>
<g transform="translate(1030 710)">${symbol("#FFFFFF","#315EFF")}</g>
<g transform="translate(1162 722) scale(.76)">${symbol("#FFFFFF","#111113")}</g>
<g transform="translate(1264 742) scale(.36)">${symbol("#FFFFFF","#315EFF")}</g>
<text x="996" y="914" fill="#65656F" font-family="Arial,sans-serif" font-size="16">APP ICON / SMALL SCALE</text>`, "0 0 1440 1000", "teum logo system presentation");
await fs.writeFile(path.join(destination,"teum-logo-board.svg"), board);
await sharp(Buffer.from(board)).png().toFile(path.join(destination,"teum-logo-board.png"));
await sharp(Buffer.from(variants["teum-symbol-blue.svg"])).resize(1024,1024).png().toFile(path.join(destination,"teum-app-icon-1024.png"));
await sharp(Buffer.from(variants["teum-logo-primary.svg"])).resize(1624,400).png().toFile(path.join(destination,"teum-logo-primary.png"));
await fs.writeFile(path.join(root,"app/icon.svg"),variants["teum-symbol-blue.svg"]);
await sharp(Buffer.from(variants["teum-symbol-blue.svg"])).resize(180,180).png().toFile(path.join(root,"app/apple-icon.png"));
const iconPng = await sharp(Buffer.from(variants["teum-symbol-blue.svg"])).resize(32,32).png().toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=32;ico[7]=32;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(iconPng.length,14);ico.writeUInt32LE(22,18);
await fs.writeFile(path.join(root,"app/favicon.ico"),Buffer.concat([ico,iconPng]));
console.log(`Exported ${Object.keys(variants).length} SVG variants, PNG previews and app icons.`);
