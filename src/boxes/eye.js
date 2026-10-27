// Day four. A huge eye watches your finger. It gets sleepy. It wakes with a start. Then it sneezes paint all over your screen.
import { audio, haptic, makeCanvas, loop, pointers, rnd, TAU, lerp, clamp, shake, flash } from '../engine.js';

export default {
  name: 'eye',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion();
    const R = api.rng;
    const IRIS = [[200, 60, 40], [95, 55, 45], [30, 60, 40], [150, 40, 50]][Math.floor(R() * 4)];
    const veins = Array.from({ length: 26 }, () => ({ a: R() * TAU, seg: Array.from({ length: 5 }, () => R() * 2 - 1) }));
    const fibers = Array.from({ length: 160 }, () => ({ a: R() * TAU, l: 0.55 + R() * 0.45, w: 0.6 + R() * 1.4, h: (R() - 0.5) * 30 }));
    let look = { x: 0, y: 0 }, target = { x: 0, y: 0 }, finger = null, wanderT = 0, blink = 0, blinkT = rnd(2, 5), T = 0, phase = 0, pT = 0, sleepy = 0, open = 1, pupil = 0.33, squint = 0, splats = [], drips = [], wipe = 0, wink = 0, ended = false, snoreT = 0, lastMove = 0;
    const snore = audio.noiseLoop({ type: 'lowpass', freq: 220, q: 1.5, gain: 0 });
    const pt = pointers(root, {
      down(p) { finger = p; lastMove = T; if (phase === 1) wake(); },
      move(p) { finger = p; lastMove = T; }, up() { finger = null; },
    });
    function E() { const W = cv.W, H = cv.H, w = Math.min(W * 0.92, H * 0.6); return { cx: W / 2, cy: H / 2, w, h: w * 0.52 }; }
    function wake() { phase = 2; pT = 0; sleepy = 0; snore.gain.setTargetAtTime(0, audio.now(), 0.05); audio.noise({ dur: 0.2, gain: 0.5, type: 'bandpass', freq: 1200, q: 1 }); audio.tone(400, { dur: 0.15, gain: 0.3, to: 900 }); shake(root); haptic([40, 30, 40]); }
    function sneeze() {
      phase = 4; pT = 0; const W = cv.W, H = cv.H, e = E();
      audio.noise({ dur: 0.35, gain: 1, type: 'bandpass', freq: 1500, q: 0.5 }); audio.tone(700, { dur: 0.3, gain: 0.5, to: 150, type: 'sawtooth' }); audio.thump(0, 0.8);
      shake(root); haptic([150, 30, 80]); flash(0.4, 100);
      const hues = [340, 25, 50, 120, 190, 270, 300];
      for (let i = 0; i < 46; i++) { const a = rnd(-Math.PI, 0) + rnd(-0.6, 0.6), d = rnd(0, 1); const x = e.cx + Math.cos(a) * d * W * 0.9, y = e.cy + Math.sin(a) * d * H * 0.9 + rnd(0, H * 0.3); splats.push({ x, y, r: rnd(18, 90), hue: hues[i % hues.length], t: rnd(0, 0.35), blob: Array.from({ length: 9 }, () => rnd(0.6, 1.3)), drip: rnd(0.4, 1) }); }
      for (let i = 0; i < 30; i++) { const s = splats[Math.floor(rnd(splats.length))]; drips.push({ x: s.x + rnd(-s.r * 0.6, s.r * 0.6), y: s.y, len: 0, max: rnd(60, 280) * s.drip, v: rnd(30, 90), w: rnd(4, 12), hue: s.hue, t0: s.t + rnd(0.2, 1) }); }
    }
    function drawEye(c, e, open, lx, ly, pup) {
      const { cx, cy, w, h } = e; if (open <= 0.01) return;
      c.save();
      c.beginPath(); c.moveTo(cx - w / 2, cy); c.quadraticCurveTo(cx, cy - h * open * 1.15, cx + w / 2, cy); c.quadraticCurveTo(cx, cy + h * open * 0.95, cx - w / 2, cy); c.closePath(); c.clip();
      const sg = c.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.55); sg.addColorStop(0, '#f7f3ee'); sg.addColorStop(0.75, '#e9e0d8'); sg.addColorStop(1, '#b89a92'); c.fillStyle = sg; c.fillRect(cx - w, cy - h, w * 2, h * 2);
      c.strokeStyle = `rgba(190,40,40,${0.2 + sleepy * 0.35})`; c.lineWidth = w * 0.004; for (const v of veins) { c.beginPath(); let x = cx + Math.cos(v.a) * w * 0.5, y = cy + Math.sin(v.a) * h * 0.5; c.moveTo(x, y); for (let i = 0; i < 5; i++) { x -= Math.cos(v.a) * w * 0.045; y -= Math.sin(v.a) * h * 0.045 + v.seg[i] * h * 0.03; c.lineTo(x, y); } c.stroke(); }
      const ir = w * 0.19, ix = cx + lx * w * 0.28, iy = cy + ly * h * 0.3;
      c.save(); c.beginPath(); c.arc(ix, iy, ir, 0, TAU); c.clip();
      const ig = c.createRadialGradient(ix, iy, ir * 0.3, ix, iy, ir); ig.addColorStop(0, `hsl(${IRIS[0]},${IRIS[1]}%,${IRIS[2] + 15}%)`); ig.addColorStop(0.8, `hsl(${IRIS[0]},${IRIS[1]}%,${IRIS[2]}%)`); ig.addColorStop(1, `hsl(${IRIS[0]},${IRIS[1]}%,${IRIS[2] - 25}%)`); c.fillStyle = ig; c.fillRect(ix - ir, iy - ir, ir * 2, ir * 2);
      for (const f of fibers) { c.strokeStyle = `hsla(${IRIS[0] + f.h},${IRIS[1]}%,${IRIS[2] + 25}%,.35)`; c.lineWidth = f.w * ir * 0.012; c.beginPath(); c.moveTo(ix + Math.cos(f.a) * ir * pup * 0.9, iy + Math.sin(f.a) * ir * pup * 0.9); c.lineTo(ix + Math.cos(f.a + 0.05) * ir * f.l, iy + Math.sin(f.a + 0.05) * ir * f.l); c.stroke(); }
      const pg = c.createRadialGradient(ix, iy, ir * pup * 0.7, ix, iy, ir * pup * 1.08); pg.addColorStop(0, '#000'); pg.addColorStop(0.85, '#000'); pg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = pg; c.beginPath(); c.arc(ix, iy, ir * pup * 1.1, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(ix - ir * 0.35, iy - ir * 0.38, ir * 0.16, ir * 0.11, -0.6, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(ix + ir * 0.3, iy + ir * 0.35, ir * 0.06, 0, TAU); c.fill();
      c.restore();
      const lg = c.createLinearGradient(0, cy - h * open, 0, cy - h * open * 0.3); lg.addColorStop(0, 'rgba(60,20,30,.55)'); lg.addColorStop(1, 'rgba(60,20,30,0)'); c.fillStyle = lg; c.fillRect(cx - w, cy - h * 2, w * 2, h * 3);
      c.restore();
      c.strokeStyle = '#2a1016'; c.lineWidth = w * 0.012; c.beginPath(); c.moveTo(cx - w / 2, cy); c.quadraticCurveTo(cx, cy - h * open * 1.15, cx + w / 2, cy); c.stroke();
      c.lineWidth = w * 0.006; c.beginPath(); c.moveTo(cx - w / 2, cy); c.quadraticCurveTo(cx, cy + h * open * 0.95, cx + w / 2, cy); c.stroke();
      // lashes
      c.lineWidth = w * 0.008; c.lineCap = 'round'; for (let i = 0; i < 9; i++) { const u = 0.08 + i / 9 * 0.84, x = cx - w / 2 + u * w, yy = cy - h * open * 1.15 * 4 * u * (1 - u) * 0.5 - h * open * 0.1; const dir = (u - 0.5) * 2; c.beginPath(); c.moveTo(x, yy + h * 0.04); c.quadraticCurveTo(x + dir * w * 0.03, yy - h * 0.08, x + dir * w * 0.07, yy - h * 0.16 * open); c.stroke(); }
    }
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H, e = E(); T += dt; pT += dt;
      // timeline
      if (phase === 0 && pT > 5) { phase = 1; pT = 0; snoreT = 0; }
      if (phase === 1 && pT > 6) wake();
      if (phase === 2 && pT > 2.5) { phase = 3; pT = 0; }
      if (phase === 3) { const k = pT / 2.6; squint = clamp(k, 0, 1); if (pT % 0.9 < dt) { audio.tone(300 + squint * 400, { dur: 0.35, gain: 0.25, to: 500 + squint * 500, type: 'sawtooth' }); haptic(15); } if (pT > 2.6) sneeze(); }
      if (phase === 4 && pT > 4) { phase = 5; pT = 0; audio.noise({ dur: 1, gain: 0.15, type: 'bandpass', freq: 400, q: 1 }); }
      if (phase === 5) { wipe = Math.min(1, pT / 1.5); if (pT > 2 && pT < 2.6) wink = 1; else wink = Math.max(0, wink - dt * 6); if (pT > 2 && pT < 2 + dt) { audio.pluck(84, { gain: 0.2, dur: 1 }); haptic(20); } if (pT > 4.5) { phase = 6; pT = 0; } }
      if (phase === 6) { open = Math.max(0, 1 - pT * 1.2); if (pT > 2 && !ended) { ended = true; api.done(); } }
      // looking
      if (finger) { target.x = clamp((finger.x - W / 2) / (W / 2), -1, 1); target.y = clamp((finger.y - H / 2) / (H / 2), -1, 1); wanderT = 0; }
      else { wanderT += dt; if (wanderT > rnd(1.5, 3)) { wanderT = 0; target = Math.random() < 0.5 ? { x: 0, y: 0 } : { x: rnd(-1, 1), y: rnd(-0.6, 0.6) }; } if (mo.ok) { const tl = mo.tilt(); target.x = clamp(target.x + tl.x * 0.6, -1, 1); } }
      if (phase === 1) { sleepy = Math.min(1, pT / 4); target.y = -0.5 * sleepy + Math.sin(pT * 1.2) * 0.1; target.x *= 0.3; snoreT += dt; const sn = Math.sin(snoreT * 2.2); snore.gain.setTargetAtTime(sn > 0 ? 0.08 * sn * sleepy : 0, audio.now(), 0.05); snore.filter.frequency.setTargetAtTime(sn > 0 ? 180 + sn * 120 : 400, audio.now(), 0.05); }
      if (phase === 2) { target.x = Math.sin(pT * 9) * 0.9 * Math.max(0, 1 - pT / 2); target.y = Math.cos(pT * 7) * 0.5 * Math.max(0, 1 - pT / 2); }
      if (phase === 3) { target.y = -0.8 * squint; }
      look.x = lerp(look.x, target.x, phase === 2 ? 0.4 : 0.12); look.y = lerp(look.y, target.y, phase === 2 ? 0.4 : 0.12);
      pupil = lerp(pupil, phase === 2 ? 0.18 : finger ? 0.26 : 0.33 + 0.05 * Math.sin(t * 0.8), 0.08);
      blinkT -= dt; if (blinkT < 0 && phase === 0) { blink = 1; blinkT = rnd(2.5, 6); } blink = Math.max(0, blink - dt * 6);
      const lid = phase === 1 ? 1 - sleepy * 0.85 - 0.08 * Math.sin(snoreT * 2.2) : phase === 3 ? 1 - squint * 0.75 : phase === 4 ? (pT < 0.4 ? 0.05 : Math.min(1, (pT - 0.4) * 1.5)) : phase === 5 ? 1 - wink : phase === 6 ? open : 1;
      // render
      ctx.fillStyle = '#120a0c'; ctx.fillRect(0, 0, W, H);
      const skin = ctx.createRadialGradient(W / 2, H / 2, e.w * 0.3, W / 2, H / 2, e.w * 0.9); skin.addColorStop(0, '#5a2a30'); skin.addColorStop(1, '#120a0c'); ctx.fillStyle = skin; ctx.fillRect(0, 0, W, H);
      drawEye(ctx, e, clamp(lid * (1 - blink), 0, 1), look.x, look.y, pupil);
      // sleepy z's as rising bubbles of light (no text): soft rings
      if (phase === 1 && sleepy > 0.3) { ctx.strokeStyle = 'rgba(255,240,220,.35)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { const k = ((pT * 0.5 + i * 0.33) % 1); ctx.globalAlpha = (1 - k) * 0.6; ctx.beginPath(); ctx.arc(e.cx + e.w * 0.35 + Math.sin(k * 6) * 10, e.cy - e.h * 0.4 - k * 160, 6 + k * 14, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
      // paint
      if (splats.length) {
        for (const s of splats) { const k = clamp((pT + (phase > 4 ? 10 : 0) - s.t) * 4, 0, 1); if (k <= 0) continue; ctx.fillStyle = `hsl(${s.hue},88%,55%)`; ctx.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, r = s.r * k * s.blob[i]; i ? ctx.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r) : ctx.moveTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.fillStyle = `hsla(${s.hue},90%,75%,.35)`; ctx.beginPath(); ctx.arc(s.x - s.r * 0.3 * k, s.y - s.r * 0.3 * k, s.r * 0.25 * k, 0, TAU); ctx.fill(); }
        for (const d of drips) { const age = (phase > 4 ? pT + 4 : pT) - d.t0; if (age <= 0) continue; d.len = Math.min(d.max, age * d.v); ctx.strokeStyle = `hsl(${d.hue},88%,52%)`; ctx.lineWidth = d.w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.y + d.len); ctx.stroke(); ctx.fillStyle = `hsl(${d.hue},88%,48%)`; ctx.beginPath(); ctx.arc(d.x, d.y + d.len, d.w * 0.8, 0, TAU); ctx.fill(); }
        // the eye wipes a clean patch and peeks through
        if (wipe > 0) { ctx.save(); ctx.beginPath(); ctx.ellipse(e.cx, e.cy, e.w * 0.5 * wipe, e.h * 0.9 * wipe, 0, 0, TAU); ctx.clip(); ctx.fillStyle = '#120a0c'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = skin; ctx.fillRect(0, 0, W, H); drawEye(ctx, e, clamp(lid, 0, 1), look.x, look.y, pupil); ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(e.cx, e.cy, e.w * 0.5 * wipe, e.h * 0.9 * wipe, 0, 0, TAU); ctx.stroke(); }
      }
    });
    return () => { stop(); pt.destroy(); snore.stop(); cv.destroy(); };
  },
};
