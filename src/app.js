import { audio, haptic, motion, flash, seeded } from './engine.js';
import { boxes } from './boxes/index.js';

const EPOCH = new Date(2026, 9, 27); // local midnight, day 0
const $ = s => document.querySelector(s);
const stage = $('#stage'), room = $('#room'), lid = $('#lid'), crank = $('#crank'), hint = $('#hint'), show = $('#show'), closeBtn = $('#close'), arc = $('#dayarc');

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
  angle += deg; acc += deg; crank.style.setProperty('--a', angle + 'deg');
  // tiny creak as you turn
  if (performance.now() - lastMoveT > 90 && deg > 1.5) { lastMoveT = performance.now(); audio.noise({ dur: 0.05, gain: 0.03, type: 'bandpass', freq: 900 + Math.random() * 400, q: 6 }); }
  while (acc >= STEP) { acc -= STEP; note(); }
});
const end = () => { lastAng = null; if (!opened) { clearTimeout(idleTimer); idleTimer = setTimeout(showHint, 4000); } };
stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);

function note() {
  if (noteI < TUNE.length) {
    audio.pluck(TUNE[noteI], { gain: 0.22, dur: 1.1 }); haptic(8);
    const left = TUNE.length - noteI; if (left <= 6) lid.style.setProperty('--open', ((7 - left) * 2) + 'deg');
    noteI++;
  } else pop();
}
async function pop() {
  opened = true; lastAng = null;
  audio.pluck(POP, { gain: 0.5, dur: 1.6 }); audio.pluck(POP + 12, { gain: 0.2, dur: 1.2 });
  audio.tone(900, { dur: 0.18, gain: 0.5, to: 150, type: 'square' }); audio.noise({ dur: 0.08, gain: 0.5, freq: 1500 });
  haptic([30, 40, 80]);
  lid.style.removeProperty('--open'); lid.classList.add('open');
  room.style.animation = 'none';
  setTimeout(() => flash(1, 500), 180);
  setTimeout(open, 260);
}

async function open() {
  const d = dayNumber(); current = pickBox(d);
  if (location.hostname === 'localhost') { const q = new URLSearchParams(location.search).get('box'); const f = boxes.find(b => b.name === q); if (f) current = f; }
  show.classList.add('on'); stage.classList.add('hidden');
  closeBtn.classList.add('on'); closeBtn.classList.remove('vis');
  const api = { root: show, day: d, rng: seeded(d + 1), motion, close: closeBox };
  try { activeCleanup = await current.mount(show, api); } catch (err) { console.error(err); }
  setTimeout(() => closeBtn.classList.add('vis'), 3500);
}
function closeBox() {
  try { activeCleanup && activeCleanup(); } catch (e) {} activeCleanup = null;
  show.innerHTML = ''; show.classList.remove('on'); closeBtn.classList.remove('on', 'vis');
  stage.classList.remove('hidden');
  setTimeout(() => { lid.classList.remove('open'); room.style.animation = ''; opened = false; noteI = 0; acc = 0; audio.noise({ dur: 0.06, gain: 0.15, type: 'lowpass', freq: 500 }); }, 700);
}
closeBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (closeBtn.classList.contains('vis')) closeBox(); });

// keep the screen awake while the box is open
let wake = null;
document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && opened && navigator.wakeLock) { try { wake = await navigator.wakeLock.request('screen'); } catch (e) {} } });
stage.addEventListener('pointerdown', async () => { if (navigator.wakeLock && !wake) { try { wake = await navigator.wakeLock.request('screen'); } catch (e) {} } }, { once: true });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
