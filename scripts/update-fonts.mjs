// Regenerate the bundled Noto Sans JP subsets from every user-facing string that
// ships in site/. Because the full character set exceeds the Google Fonts `text`
// URL limit, glyphs are split into chunks; each chunk becomes one @font-face with
// a `unicode-range`, so the browser loads only the chunks it actually needs and
// no glyph ever falls back to a system font.
import {readFile, writeFile} from 'node:fs/promises';
import {readdirSync, statSync} from 'node:fs';
import path from 'node:path';

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (/\.(mjs|html|css)$/.test(entry)) files.push(full);
  }
})('site');
const text = (await Promise.all(files.map(file => readFile(file, 'utf8')))).join('');
const chars = [...new Set(text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}、。・「」（）！？：；／％…ー〜―＝＋＆＠＃＄＊￥　]/gu) || [])].sort();

const CHUNK = 130;
const chunks = [];
for (let i = 0; i < chars.length; i += CHUNK) chunks.push(chars.slice(i, i + CHUNK));
console.log('unique Japanese characters:', chars.length, '-> chunks:', chunks.length);

const headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'};
async function fetchOk(url) {
  const response = await fetch(url, {headers, signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}
function unicodeRange(chunk) {
  const cps = chunk.map(char => char.codePointAt(0));
  const ranges = [];
  let start = cps[0], end = cps[0];
  for (let i = 1; i < cps.length; i++) {
    if (cps[i] === end + 1) { end = cps[i]; continue; }
    ranges.push(start === end ? `U+${start.toString(16).toUpperCase()}` : `U+${start.toString(16).toUpperCase()}-${end.toString(16).toUpperCase()}`);
    start = end = cps[i];
  }
  ranges.push(start === end ? `U+${start.toString(16).toUpperCase()}` : `U+${start.toString(16).toUpperCase()}-${end.toString(16).toUpperCase()}`);
  return ranges.join(',');
}

const faces = [];
for (let i = 0; i < chunks.length; i++) {
  const css = await (await fetchOk(`https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400..700&display=swap&text=${encodeURIComponent(chunks[i].join(''))}`)).text();
  const url = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\) format\('woff2'\)/g)].at(-1)?.[1];
  if (!url) throw new Error(`No WOFF2 URL for chunk ${i}`);
  const buffer = Buffer.from(await (await fetchOk(url)).arrayBuffer());
  if (buffer.subarray(0, 4).toString() !== 'wOF2') throw new Error(`Chunk ${i} is not a WOFF2 font`);
  await writeFile(`site/fonts/notosansjp-${i}.woff2`, buffer);
  faces.push(`@font-face { font-family: "Noto Sans JP"; src: url("./fonts/notosansjp-${i}.woff2") format("woff2"); font-style: normal; font-weight: 400 700; font-display: swap; unicode-range: ${unicodeRange(chunks[i])}; }`);
}

const cssBlock = faces.join('\n') + '\n';
const stylesPath = 'site/styles.css';
const styles = await readFile(stylesPath, 'utf8');
if (!/@font-face\s*\{[^}]*"Noto Sans JP"[^}]*\}/.test(styles)) throw new Error('Existing Noto Sans JP @font-face not found in styles.css');
await writeFile(stylesPath, styles.replace(/@font-face\s*\{[^}]*"Noto Sans JP"[^}]*\}\n?/, cssBlock));
console.log('Wrote', chunks.length, 'font chunks and updated styles.css');
