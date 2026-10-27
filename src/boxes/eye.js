// Day: something is looking at you. Don't poke it.
import { audio, haptic, makeCanvas, loop, pointers, rnd, TAU, lerp, clamp, shake, flash } from '../engine.js';

export default {
  name: 'eye',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion();
    const R = api.rng;
    const IRIS = [[200, 60, 40], [95, 55, 45], [30, 60, 40], [150, 40, 50]][Math.floor(R() * 4)]; // hsl
    const veins = Array.from({ length: 26 }, () => ({ a: R() * TAU, k: R(), seg: Array.from({ length: 5 }, () => R() * 2 - 1) }));
    const fibers = Array.from({ length: 160 }, () => ({ a: R() * TAU, l: 0.55 + R() * 0.45, w: 0.6 + R() * 1.4, h: (R() - 0.5) * 30 }));
    let look = { x: 0, y: 0 }, target = { x: 0, y: 0 }, finger = null, wanderT = 0, blink = 0, blinkT = rnd(2, 5), phase = 0, flinchT = 0, ink = [], inkPool = [], eyes = [], bigT = 0, pupil = 0.33, pTarget = 0.33;
    const drone = audio.pad([55, 82.4, 110], { gain: 0, type: 'sawtooth' });
    const breath = audio.noiseLoop({ type: 'lowpass', freq: 300, q: 0.5, gain: 0.0 });
    const pt = pointers(root, {
      down(p) {
        finger = p;
        if (phase === 0) { const E = mainEye(); const d = Math.hypot(p.x - E.cx - look.x * E.w * 0.28, p.y - E.cy - look.y * E.h * 0.3); if (d < E.w * 0.21) poke(E); }
        else if (phase === 2) { for (const e of eyes) if (Math.hypot(p.x - e.x, p.y - e.y) < e.w * 0.6) { shut(); break; } }
      },
      move(p) { finger = p; }, up() { finger = null; },
    });
    function mainEye() { const W = cv.W, H = cv.H, w = Math.min(W * 0.92, H * 0.6); return { cx: W / 2, cy: H / 2, w, h: w * 0.52 }; }
    function poke(E) {
      phase = 1; flinchT = 0; blink = 1; shake(root); haptic([80, 40, 120]);
      audio.noise({ dur: 0.25, gain: 0.7, type: 'lowpass', freq: 900, freqTo: 100 }); audio.tone(180, { dur: 0.5, gain: 0.5, to: 40, type: 'sawtooth' });
      for (let i = 0; i < 260; i++) ink.push({ x: E.cx + rnd(-E.w * 0.3, E.w * 0.3), y: E.cy + rnd(-10, 20), vx: rnd(-60, 60), vy: rnd(0, 120), r: rnd(6, 26), life: 1 });
      drone.gain.setTargetAtTime(0.06, audio.now(), 1.5);
    }
    function shut() {
      phase = 3; bigT = 0; haptic(60); audio.noise({ dur: 0.15, gain: 0.5, type: 'lowpass', freq: 600 }); drone.gain.setTargetAtTime(0, audio.now(), 0.2);
      setTimeout(() => { phase = 4; bigT = 0; audio.tone(40, { dur: 6, gain: 0.5, to: 30, type: 'sine' }); audio.noise({ dur: 5, gain: 0.3, type: 'lowpass', freq: 90 }); breath.gain.setTargetAtTime(0.12, audio.now(), 2); haptic([200, 100, 400]); }, 1400);
    }
    function drawEye(E, open, lx, ly, pup, big) {
      const { cx, cy, w, h } = E; if (open <= 0.01) return;
      ctx.save();
      // eyelid aperture
      ctx.beginPath(); ctx.moveTo(cx - w / 2, cy); ctx.quadraticCurveTo(cx, cy - h * open * 1.15, cx + w / 2, cy); ctx.quadraticCurveTo(cx, cy + h * open * 0.95, cx - w / 2, cy); ctx.closePath(); ctx.clip();
      // sclera
      const sg = ctx.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.55); sg.addColorStop(0, '#f7f3ee'); sg.addColorStop(0.75, '#e9e0d8'); sg.addColorStop(1, '#b89a92'); ctx.fillStyle = sg; ctx.fillRect(cx - w, cy - h, w * 2, h * 2);
      // veins
      if (!big) { ctx.strokeStyle = 'rgba(190,40,40,.28)'; ctx.lineWidth = w * 0.004; for (const v of veins) { ctx.beginPath(); let x = cx + Math.cos(v.a) * w * 0.5, y = cy + Math.sin(v.a) * h * 0.5; ctx.moveTo(x, y); for (let i = 0; i < 5; i++) { x -= Math.cos(v.a) * w * 0.045; y -= Math.sin(v.a) * h * 0.045 + v.seg[i] * h * 0.03; ctx.lineTo(x, y); } ctx.stroke(); } }
      // iris
      const ir = w * 0.19 * (big ? 2.2 : 1), ix = cx + lx * w * 0.28, iy = cy + ly * h * 0.3;
      ctx.save(); ctx.beginPath(); ctx.arc(ix, iy, ir, 0, TAU); ctx.clip();
      const ig = ctx.createRadialGradient(ix, iy, ir * 0.3, ix, iy, ir); ig.addColorStop(0, `hsl(${IRIS[0]},${IRIS[1]}%,${IRIS[2] + 15}%)`); ig.addColorStop(0.8, `hsl(${IRIS[0]},${IRIS[1]}%,${IRIS[2]}%)`); ig.addColorStop(1, `hsl(${IRIS[0]},${IRIS[1]}%,${IRIS[2] - 25}%)`); ctx.fillStyle = ig; ctx.fillRect(ix - ir, iy - ir, ir * 2, ir * 2);
      for (const f of fibers) { ctx.strokeStyle = `hsla(${IRIS[0] + f.h},${IRIS[1]}%,${IRIS[2] + 25}%,.35)`; ctx.lineWidth = f.w * ir * 0.012; ctx.beginPath(); ctx.moveTo(ix + Math.cos(f.a) * ir * pup * 0.9, iy + Math.sin(f.a) * ir * pup * 0.9); ctx.lineTo(ix + Math.cos(f.a + 0.05) * ir * f.l, iy + Math.sin(f.a + 0.05) * ir * f.l); ctx.stroke(); }
      // pupil
      const pg = ctx.createRadialGradient(ix, iy, ir * pup * 0.7, ix, iy, ir * pup * 1.08); pg.addColorStop(0, '#000'); pg.addColorStop(0.85, '#000'); pg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(ix, iy, ir * pup * 1.1, 0, TAU); ctx.fill();
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(ix - ir * 0.35, iy - ir * 0.38, ir * 0.16, ir * 0.11, -0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(ix + ir * 0.3, iy + ir * 0.35, ir * 0.06, 0, TAU); ctx.fill();
      ctx.restore();
      // lid shadow
      const lg = ctx.createLinearGradient(0, cy - h * open, 0, cy - h * open * 0.3); lg.addColorStop(0, 'rgba(60,20,30,.55)'); lg.addColorStop(1, 'rgba(60,20,30,0)'); ctx.fillStyle = lg; ctx.fillRect(cx - w, cy - h * 2, w * 2, h * 3);
      ctx.restore();
      // lid edges
      ctx.strokeStyle = big ? 'rgba(40,10,20,.9)' : '#2a1016'; ctx.lineWidth = w * 0.012; ctx.beginPath(); ctx.moveTo(cx - w / 2, cy); ctx.quadraticCurveTo(cx, cy - h * open * 1.15, cx + w / 2, cy); ctx.stroke();
      ctx.lineWidth = w * 0.006; ctx.beginPath(); ctx.moveTo(cx - w / 2, cy); ctx.quadraticCurveTo(cx, cy + h * open * 0.95, cx + w / 2, cy); ctx.stroke();
    }
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H, E = mainEye();
      ctx.fillStyle = '#120a0c'; ctx.fillRect(0, 0, W, H);
      const skin = ctx.createRadialGradient(W / 2, H / 2, E.w * 0.3, W / 2, H / 2, E.w * 0.9); skin.addColorStop(0, '#5a2a30'); skin.addColorStop(1, '#120a0c'); ctx.fillStyle = skin; ctx.fillRect(0, 0, W, H);
      // where to look
      if (finger) { target.x = clamp((finger.x - W / 2) / (W / 2), -1, 1); target.y = clamp((finger.y - H / 2) / (H / 2), -1, 1); wanderT = 0; }
      else { wanderT += dt; if (wanderT > rnd(1.5, 3)) { wanderT = 0; target = Math.random() < 0.5 ? { x: 0, y: 0 } : { x: rnd(-1, 1), y: rnd(-0.6, 0.6) }; } if (mo.ok) { const tl = mo.tilt(); target.x = clamp(target.x + tl.x * 0.6, -1, 1); } }
      look.x = lerp(look.x, target.x, 0.12); look.y = lerp(look.y, target.y, 0.12);
      pTarget = finger ? 0.22 : 0.33 + 0.05 * Math.sin(t * 0.8); pupil = lerp(pupil, pTarget, 0.05);
      // blinking
      blinkT -= dt; if (blinkT < 0 && phase === 0) { blink = 1; blinkT = rnd(2.5, 6); }
      if (phase === 0) blink = Math.max(0, blink - dt * 6);
      if (phase === 1) { flinchT += dt; blink = flinchT < 1.4 ? 1 : Math.max(0, blink - dt * 2.5); if (flinchT > 2.6) { phase = 2; spawnEyes(); } }
      if (phase === 0 || phase === 1 || phase === 2) drawEye(E, 1 - blink, look.x, look.y, pupil, false);
      // ink
      ctx.fillStyle = '#060206';
      for (const k of ink) { k.vy += 500 * dt; k.vx *= 0.98; k.x += k.vx * dt; k.y += k.vy * dt; if (k.y > H - k.r * 0.6) { k.y = H - k.r * 0.6; k.vy = 0; k.vx *= 0.8; k.r = Math.min(k.r * 1.01, 60); } ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, TAU); ctx.fill(); }
      for (const k of inkPool) { ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, TAU); ctx.fill(); }
      // ink drips down from the eye as streaks
      if (phase >= 1 && phase < 3) { ctx.fillStyle = '#060206'; const n = Math.min(1, flinchT / 1.5); for (let i = 0; i < 7; i++) { const x = E.cx + (i - 3) * E.w * 0.08 + Math.sin(i * 3) * 10, len = (H - E.cy) * n * (0.5 + ((i * 37) % 10) / 20); ctx.fillRect(x - 5 - i % 3, E.cy, 10 + i % 3 * 2, len); ctx.beginPath(); ctx.arc(x, E.cy + len, 9 + i % 3 * 2, 0, TAU); ctx.fill(); } }
      // many small eyes in the dark
      if (phase === 2) for (const e of eyes) {
        e.bt -= dt; if (e.bt < 0) { e.b = 1; e.bt = rnd(2, 7); } e.b = Math.max(0, e.b - dt * 5); e.open = Math.min(1, e.open + dt * 1.5);
        const lx = finger ? clamp((finger.x - e.x) / 200, -1, 1) : look.x, ly = finger ? clamp((finger.y - e.y) / 200, -1, 1) : look.y;
        drawEye({ cx: e.x, cy: e.y, w: e.w, h: e.w * 0.5 }, e.open * (1 - e.b), lx, ly, 0.3, false);
      }
      if (phase === 3) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
      if (phase === 4) {
        bigT += dt; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        const open = Math.min(1, bigT / 2.5); const big = { cx: W / 2, cy: H / 2, w: Math.max(W, H) * 2.4, h: Math.max(W, H) * 1.0 };
        const lx = finger ? clamp((finger.x - W / 2) / (W / 2), -1, 1) * 0.25 : 0, ly = finger ? clamp((finger.y - H / 2) / (H / 2), -1, 1) * 0.25 : 0;
        drawEye(big, open * 0.6, lx, ly, 0.5 - open * 0.3, true);
        if (open > 0.95 && bigT % 7 < dt) haptic(30);
      }
    });
    function spawnEyes() {
      const W = cv.W, H = cv.H; eyes = [];
      for (const k of ink) { inkPool.push({ x: k.x, y: k.y, r: k.r }); } ink = [];
      for (let i = 0; i < 28; i++) { const w = rnd(40, 90); eyes.push({ x: rnd(w, W - w), y: rnd(H * 0.05, H * 0.95), w, open: 0, b: 0, bt: rnd(0, 4) }); }
      eyes.sort((a, b) => a.w - b.w); audio.noise({ dur: 1.5, gain: 0.2, type: 'bandpass', freq: 200, q: 2 }); haptic([10, 50, 10, 50, 10]);
      for (let i = 0; i < 10; i++) audio.tone(rnd(300, 1500), { t: i * 0.12, dur: 0.1, gain: 0.03, type: 'square' });
    }
    return () => { stop(); pt.destroy(); drone.stop(); breath.stop(); cv.destroy(); };
  },
};
