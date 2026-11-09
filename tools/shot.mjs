// Скриншоты через Chrome DevTools Protocol без зависимостей: node tools/shot.mjs <url> <out.png> [width] [height] [scrollY]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [url, out, w = '1440', h = '900', scroll = '0', full = '0'] = process.argv.slice(2);
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const prof = mkdtempSync(join(tmpdir(), 'shot-'));
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', `--window-size=${w},${h}`, 'about:blank']);
const wsUrl = await new Promise((res) => proc.stderr.on('data', (d) => { const m = String(d).match(/ws:\/\/[^\s]+/); if (m) res(m[0]); }));
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
const s = (m, p) => send(m, p, sessionId);
await s('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 700 });
await s('Page.enable'); await s('Runtime.enable');
await s('Page.navigate', { url });
await new Promise((r) => setTimeout(r, 2500));
const stops = String(scroll).split(',').map(Number);
if (stops.length > 1) {
  for (let i = 0; i < stops.length; i++) {
    await s('Runtime.evaluate', { expression: `window.scrollTo(0, ${stops[i]})` });
    await new Promise((r) => setTimeout(r, 1400));
    const shot = await s('Page.captureScreenshot', { format: 'png' });
    writeFileSync(out.replace('.png', `_${i}.png`), Buffer.from(shot.result.data, 'base64'));
  }
  ws.close(); proc.kill(); process.exit(0);
}
if (+scroll) { await s('Runtime.evaluate', { expression: `window.scrollTo(0, ${scroll})` }); }
await new Promise((r) => setTimeout(r, 3500));
const logs = await s('Runtime.evaluate', { expression: 'JSON.stringify({w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, canvas: !!document.querySelector(".hero__canvas.is-ready")})', returnByValue: true });
console.log(logs.result.result.value);
if (process.env.CLIP) {
  const r = await s('Runtime.evaluate', { expression: `JSON.stringify(document.querySelector(${JSON.stringify(process.env.CLIP)}).getBoundingClientRect())`, returnByValue: true });
  const b = JSON.parse(r.result.result.value);
  const c = await s('Page.captureScreenshot', { format: 'png', clip: { x: b.x, y: b.y, width: b.width, height: b.height, scale: Number(process.env.SCALE || 1) } });
  writeFileSync(out, Buffer.from(c.result.data, 'base64'));
  ws.close(); proc.kill(); process.exit(0);
}
const shot = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full === '1', ...(full === '1' ? { clip: { x: 0, y: 0, width: +w, height: JSON.parse(logs.result.result.value).h, scale: 1 } } : {}) });
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
ws.close(); proc.kill();
