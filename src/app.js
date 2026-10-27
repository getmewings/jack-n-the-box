import { audio, haptic, motion, flash, seeded, rnd, TAU, glowSprite } from './engine.js';
import { boxes } from './boxes/index.js';
import { createStage } from './stage.js';
const stage3d = createStage(document.getElementById('stage3d'));

const EPOCH = new Date(2026, 9, 27); // local midnight, day 0
const $ = s => document.querySelector(s);
const stage = $('#stage'), hint = $('#hint'), show = $('#show'), closeBtn = $('#close'), arc = $('#dayarc'), post = $('#post');

// ---------- dust in the spotlight, and the burst when the lid pops ----------
const dust = $('#dust'), dctx = dust.getContext('2d'), motes = [], rays = [], sprite = glowSprite(32, '255,225,170');
let DW = 0, DH = 0, dpr = 1, burstT = 0;
function dsize() { dpr = Math.min(devicePixelRatio || 1, 2); DW = innerWidth; DH = innerHeight; dust.width = DW * dpr; dust.height = DH * dpr; dust.style.width = DW + 'px'; dust.style.height = DH + 'px'; dctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
dsize(); addEventListener('resize', dsize);
for (let i = 0; i < 90; i++) motes.push({ x: Math.random(), y: Math.random(), z: rnd(0.3, 1), vx: rnd(-1, 1), vy: rnd(-1, 1), ph: rnd(TAU) });
let dlast = performance.now();
(function dloop(now) {
  const dt = Math.min(0.05, (now - dlast) / 1000); dlast = now; requestAnimationFrame(dloop);
  dctx.clearRect(0, 0, DW, DH);
  if (stage.classList.contains('hidden') && burstT <= 0) return;
  dctx.globalCompositeOperation = 'lighter';
  if (false) for (const m of motes) {
    m.vx += rnd(-1, 1) * dt * 0.4; m.vy += rnd(-1, 1) * dt * 0.4 - dt * 0.05; m.vx *= 0.98; m.vy *= 0.98;
    m.x += m.vx * dt * 0.02; m.y += m.vy * dt * 0.02;
    if (m.x < 0) m.x = 1; if (m.x > 1) m.x = 0; if (m.y < 0) m.y = 1; if (m.y > 1) m.y = 0;
    const px = m.x * DW, py = m.y * DH, inCone = Math.max(0, 1 - Math.abs(px - DW / 2) / (DW * (0.15 + m.y * 0.45)));
    const a = inCone * (0.25 + 0.2 * Math.sin(now * 0.002 + m.ph)) * m.z; if (a < 0.02) continue;
    const sz = 2 + m.z * 5; dctx.globalAlpha = a; dctx.drawImage(sprite, px - sz, py - sz, sz * 2, sz * 2);
  }
  if (burstT > 0) {
    burstT -= dt; const k = 1 - burstT / 0.8;
    for (const r of rays) {
      const len = r.len * Math.sin(Math.min(1, k * 1.4) * Math.PI / 2), x0 = DW / 2 + Math.cos(r.a) * len * 0.15, y0 = DH * 0.44 + Math.sin(r.a) * len * 0.15, x1 = DW / 2 + Math.cos(r.a) * len, y1 = DH * 0.44 + Math.sin(r.a) * len;
      const g = dctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(255,230,170,${0.9 * (1 - k)})`); g.addColorStop(1, 'rgba(255,230,170,0)');
      dctx.strokeStyle = g; dctx.lineWidth = r.w * (1 - k * 0.5); dctx.beginPath(); dctx.moveTo(x0, y0); dctx.lineTo(x1, y1); dctx.stroke();
    }
    const gg = dctx.createRadialGradient(DW / 2, DH * 0.44, 0, DW / 2, DH * 0.44, DW * 0.6 * k); gg.addColorStop(0, `rgba(255,220,150,${0.5 * (1 - k)})`); gg.addColorStop(1, 'rgba(255,220,150,0)');
    dctx.globalAlpha = 1; dctx.fillStyle = gg; dctx.fillRect(0, 0, DW, DH);
  }
  dctx.globalAlpha = 1; dctx.globalCompositeOperation = 'source-over';
})(dlast);
function burst() { rays.length = 0; for (let i = 0; i < 70; i++) rays.push({ a: rnd(TAU), len: rnd(0.25, 0.8) * Math.max(DW, DH), w: rnd(1, 4) }); burstT = 0.8; }

function today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function dayNumber() { return Math.max(0, Math.round((today() - EPOCH) / 86400000)); }
function pickBox(d) {
  if (d < boxes.length) return boxes[d];
  // past the hand-ordered run: deterministic daily pick that never repeats yesterday's
  const r = seeded(d + 7), prev = pickIndex(d - 1); let i = Math.floor(r() * boxes.length); if (i === prev) i = (i + 1) % boxes.length; return boxes[i];
}
function pickIndex(d) { if (d < boxes.length) return d; const r = seeded(d + 7), prev = pickIndex(d - 1); let i = Math.floor(r() * boxes.length); if (i === prev) i = (i + 1) % boxes.length; return i; }

// day progress ring
function ring() { const n = new Date(), f = (n - today()) / 86400000; arc.setAttribute('stroke-dashoffset', (100.5 * (1 - f)).toFixed(2)); }
ring(); setInterval(ring, 30000);

// ---------- crank -> music box -> pop ----------
const TUNE = [67, 72, 72, 74, 74, 76, 72, 72, 67, 67, 72, 72, 74, 74, 76, 72, 67, 72, 72, 74, 74, 76, 72, 76, 74];
const POP = 81, STEP = 38; // degrees per note
let angle = 0, acc = 0, noteI = 0, opened = false, lastAng = null, lastMoveT = 0, idleTimer = 0;
let activeCleanup = null, current = null;

function ptAngle(e) { const r = stage.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); }
function showHint() { if (!opened) hint.classList.add('show'); }
idleTimer = setTimeout(showHint, 2500);

stage.addEventListener('pointerdown', e => {
  if (opened) return; e.preventDefault();
  audio.ensure(); motion(); // permission prompts ride on this gesture
  lastAng = ptAngle(e); hint.classList.remove('show'); clearTimeout(idleTimer);
  stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e => {
  if (opened || lastAng === null) return;
  const a = ptAngle(e); let d = a - lastAng; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; lastAng = a;
  const deg = Math.abs(d) * 180 / Math.PI; if (deg > 40) return; // ignore jumps
  angle += deg; acc += deg; stage3d.turn(d > 0 ? deg : -deg);
  // tiny creak as you turn
  if (performance.now() - lastMoveT > 90 && deg > 1.5) { lastMoveT = performance.now(); audio.noise({ dur: 0.05, gain: 0.03, type: 'bandpass', freq: 900 + Math.random() * 400, q: 6 }); }
  while (acc >= STEP) { acc -= STEP; note(); }
});
const end = () => { lastAng = null; if (!opened) { clearTimeout(idleTimer); idleTimer = setTimeout(showHint, 4000); } };
stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);

function note() {
  if (noteI < TUNE.length) {
    audio.pluck(TUNE[noteI], { gain: 0.22, dur: 1.1 }); haptic(8);
    noteI++; stage3d.tension(noteI / TUNE.length);
  } else pop();
}
async function pop() {
  opened = true; lastAng = null;
  audio.pluck(POP, { gain: 0.5, dur: 1.6 }); audio.pluck(POP + 12, { gain: 0.2, dur: 1.2 });
  audio.tone(900, { dur: 0.18, gain: 0.5, to: 150, type: 'square' }); audio.noise({ dur: 0.08, gain: 0.5, freq: 1500 });
  haptic([30, 40, 80]);
  stage3d.pop();
  setTimeout(() => { burst(); flash(0.9, 700); }, 220);
  setTimeout(open, 700);
}

async function open() {
  const d = dayNumber(); current = pickBox(d);
  if (location.hostname === 'localhost') { const q = new URLSearchParams(location.search).get('box'); const f = boxes.find(b => b.name === q); if (f) current = f; }
  show.classList.add('on'); post.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => show.classList.add('in'))); stage.classList.add('hidden'); setTimeout(() => stage3d.setVisible(false), 1200);
  closeBtn.classList.add('on'); closeBtn.classList.remove('vis');
  const api = { root: show, day: d, rng: seeded(d + 1), motion, close: closeBox, done: finale };
  try { activeCleanup = await current.mount(show, api); } catch (err) { console.error(err); }
  setTimeout(() => closeBtn.classList.add('vis'), 3500);
}
// the performance is over: a soft chord, fade to black, lid closes
let ending = false;
function finale() {
  if (ending) return; ending = true;
  [60, 67, 72, 76, 79].forEach((m, i) => audio.pluck(m, { t: i * 0.09, gain: 0.16, dur: 2.4 }));
  show.classList.remove('in'); closeBtn.classList.remove('vis');
  setTimeout(() => { ending = false; closeBox(); }, 1500);
}
function closeBox() {
  try { activeCleanup && activeCleanup(); } catch (e) {} activeCleanup = null;
  show.innerHTML = ''; show.classList.remove('on', 'in'); post.classList.remove('on'); closeBtn.classList.remove('on', 'vis');
  stage3d.setVisible(true); stage.classList.remove('hidden');
  setTimeout(() => { stage3d.reset(); opened = false; noteI = 0; acc = 0; audio.noise({ dur: 0.06, gain: 0.15, type: 'lowpass', freq: 500 }); }, 700);
}
closeBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (closeBtn.classList.contains('vis')) closeBox(); });

// keep the screen awake while the box is open
let wake = null;
document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && opened && navigator.wakeLock) { try { wake = await navigator.wakeLock.request('screen'); } catch (e) {} } });
stage.addEventListener('pointerdown', async () => { if (navigator.wakeLock && !wake) { try { wake = await navigator.wakeLock.request('screen'); } catch (e) {} } }, { once: true });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(r => { r.update(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update(); }); }).catch(() => {});
