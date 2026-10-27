// Day three. A kite on a string. Tilt to run with it, blow or swipe for wind. Then the string snaps, and you follow it up through the clouds to where the lost kites go.
import { audio, haptic, mic, makeCanvas, loop, pointers, rnd, TAU, lerp, clamp, glowSprite } from '../engine.js';

export default {
  name: 'kite',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion(); let neutral = null, tiltX = 0;
    let m = null; try { m = await mic(); } catch (e) { m = null; } // quiet ask: no glyph, wind works from tilt and swipe too
    const W0 = cv.W, H0 = cv.H, sun = glowSprite(256, '255,230,190');
    const R = api.rng, hue = Math.floor(R() * 360);
    const clouds = Array.from({ length: 16 }, () => ({ x: rnd(-0.2, 1.2), y: rnd(-3, 0.75), s: rnd(0.25, 0.6), v: rnd(0.01, 0.03), puffs: Array.from({ length: 5 }, () => [rnd(-0.5, 0.5), rnd(-0.25, 0.15), rnd(0.35, 0.6)]) }));
    const others = Array.from({ length: 18 }, () => ({ x: rnd(-0.1, 1.1), y: rnd(-0.3, 0.6), hue: rnd(360), ph: rnd(TAU), s: rnd(0.5, 1.1) }));
    // rope: verlet points from the hand to the kite; tail: from kite outward
    const N = 22, rope = Array.from({ length: N }, (_, i) => ({ x: W0 / 2, y: H0 * 0.86 - i * 4, px: W0 / 2, py: H0 * 0.86 - i * 4 }));
    const TN = 12, tail = Array.from({ length: TN }, (_, i) => ({ x: W0 / 2, y: H0 * 0.86 + i * 6, px: W0 / 2, py: H0 * 0.86 + i * 6 }));
    let T = 0, pT = 0, phase = 'ground', handX = W0 / 2, wind = 0, gust = 0, swipe = 0, base = 0.01, calT = 0, kite = { x: W0 / 2, y: H0 * 0.86, vx: 0, vy: 0, a: -Math.PI / 2 }, camY = 0, cloudWhite = 0, sunset = 0, ended = false, snapT = -1, lastHum = 0;
    const air = audio.noiseLoop({ type: 'bandpass', freq: 700, q: 0.6, gain: 0.02 });
    const pad = audio.pad([130.8, 196, 261.6, 329.6, 392], { gain: 0, type: 'triangle' });
    const pt = pointers(root, { move(p) { swipe = clamp(swipe + Math.hypot(p.x - p.px, p.y - p.py) / 40, 0, 1.5); handX = lerp(handX, p.x, 0.2); } });
    function kiteShape(c, x, y, a, s, h, lit) {
      c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2);
      c.fillStyle = `hsl(${h},85%,${55 * lit}%)`; c.beginPath(); c.moveTo(0, -s * 1.1); c.lineTo(s * 0.75, 0); c.lineTo(0, s * 1.4); c.lineTo(-s * 0.75, 0); c.closePath(); c.fill();
      c.fillStyle = `hsl(${h + 40},90%,${70 * lit}%)`; c.beginPath(); c.moveTo(0, -s * 1.1); c.lineTo(s * 0.75, 0); c.lineTo(0, s * 1.4); c.closePath(); c.fill();
      c.strokeStyle = `rgba(40,30,30,${0.6 * lit})`; c.lineWidth = Math.max(1, s * 0.06); c.beginPath(); c.moveTo(0, -s * 1.1); c.lineTo(0, s * 1.4); c.moveTo(-s * 0.75, 0); c.lineTo(s * 0.75, 0); c.stroke();
      c.restore();
    }
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; T += dt; pT += dt; swipe *= 0.9;
      if (mo.ok) { const tl = mo.tilt(); if (!neutral) neutral = tl; tiltX = lerp(tiltX, clamp(tl.x - neutral.x, -1, 1), 0.08); }
      let breath = 0; if (m) { const l = m.level(); calT += dt; if (calT < 1.2) base = Math.max(base, l * 1.5); breath = clamp((l - base * 2.2) / 0.12, 0, 1); }
      // wind: a steady breeze that builds, plus your gusts
      const steady = phase === 'ground' ? clamp(pT / 3, 0, 1) * 0.6 : phase === 'fly' ? 0.6 + 0.25 * Math.sin(T * 0.5) : 1.2;
      gust = lerp(gust, breath * 1.4 + swipe * 0.8, 0.1); wind = steady + gust;
      air.gain.setTargetAtTime(0.02 + wind * 0.06, audio.now(), 0.1); air.filter.frequency.setTargetAtTime(500 + wind * 900, audio.now(), 0.1);
      if (!pt.active.size) handX = lerp(handX, W / 2 + tiltX * W * 0.35, 0.05);
      // timeline
      if (phase === 'ground' && pT > 3.2) { phase = 'fly'; pT = 0; pad.gain.setTargetAtTime(0.05, audio.now(), 2); audio.noise({ dur: 1.5, gain: 0.15, type: 'bandpass', freq: 900, q: 0.8 }); haptic(10); }
      if (phase === 'fly' && pT > 11) { phase = 'snap'; pT = 0; snapT = T; audio.noise({ dur: 0.06, gain: 0.8, type: 'highpass', freq: 2500 }); audio.tone(1200, { dur: 0.25, gain: 0.4, to: 200, type: 'square' }); haptic([60, 20, 30]); audio.noise({ dur: 4, gain: 0.3, type: 'bandpass', freq: 600, freqTo: 2500, q: 0.7 }); }
      if (phase === 'snap' && pT > 2.5) { phase = 'rise'; pT = 0; }
      if (phase === 'rise') { cloudWhite = pT < 3 ? clamp(pT / 1.6, 0, 1) : clamp(1 - (pT - 3) / 1.6, 0, 1); if (pT > 3) sunset = clamp((pT - 3) / 2, 0, 1); if (pT > 3 && pT < 3 + dt) { [64, 71, 76, 80, 83, 88].forEach((n, i) => audio.pluck(n, { t: i * 0.15, gain: 0.14, dur: 4 })); haptic([10, 50, 10, 50, 40]); } if (pT > 10 && !ended) { ended = true; api.done(); } }
      // kite physics
      const anchor = { x: handX, y: H * 0.86 };
      const tethered = phase === 'ground' || phase === 'fly';
      const lift = wind * 1150, drag = 0.975;
      const restX = anchor.x + W * 0.12 * wind; kite.vx += ((restX - kite.x) * 3 + Math.sin(T * 2.3) * wind * 260 + Math.sin(T * 0.9) * wind * 120 + tiltX * 260) * dt; kite.vy += (420 - lift + Math.sin(T * 3.1) * wind * 200 - (phase === 'rise' || phase === 'snap' ? 700 : 0)) * dt; if (!tethered) kite.vy = Math.max(kite.vy, -320);
      if (phase === 'ground' && wind < 0.4) { kite.vy = 0; kite.vx = 0; kite.y = anchor.y; kite.x = anchor.x; }
      kite.vx *= drag; kite.vy *= drag; kite.x += kite.vx * dt; kite.y += kite.vy * dt;
      if (tethered) { const dx = kite.x - anchor.x, dy = kite.y - anchor.y, d = Math.hypot(dx, dy), L = H * 0.62; if (d > L) { kite.x = anchor.x + dx / d * L; kite.y = anchor.y + dy / d * L; const vn = (kite.vx * dx + kite.vy * dy) / d; if (vn > 0) { kite.vx -= dx / d * vn; kite.vy -= dy / d * vn; } } if (kite.y > anchor.y) { kite.y = anchor.y; kite.vy = 0; } }
      else { camY = lerp(camY, kite.y - H * 0.4, 0.04); if (kite.x < W * 0.2) kite.vx += 300 * dt; if (kite.x > W * 0.8) kite.vx -= 300 * dt; }
      kite.a = lerp(kite.a, Math.atan2(kite.vy - 200, kite.vx + 60), 0.1);
      // rope verlet
      if (tethered) { rope[0].x = anchor.x; rope[0].y = anchor.y; rope[N - 1].x = kite.x; rope[N - 1].y = kite.y; for (let i = 1; i < N - 1; i++) { const r = rope[i], vx = (r.x - r.px) * 0.98, vy = (r.y - r.py) * 0.98; r.px = r.x; r.py = r.y; r.x += vx + wind * 30 * dt; r.y += vy + 500 * dt * dt * 60; } const seg = Math.hypot(kite.x - anchor.x, kite.y - anchor.y) / (N - 1) * 1.02; for (let k = 0; k < 6; k++) for (let i = 0; i < N - 1; i++) { const a = rope[i], b = rope[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, diff = (d - seg) / d * 0.5; if (i > 0) { a.x += dx * diff; a.y += dy * diff; } if (i < N - 2) { b.x -= dx * diff; b.y -= dy * diff; } } }
      else { for (let i = 0; i < N; i++) { const r = rope[i]; const vx = (r.x - r.px) * 0.97, vy = (r.y - r.py) * 0.97; r.px = r.x; r.py = r.y; r.x += vx + wind * 20 * dt; r.y += vy + 300 * dt * dt * 60; } rope[N - 1].x = kite.x; rope[N - 1].y = kite.y; for (let k = 0; k < 3; k++) for (let i = N - 2; i >= Math.max(0, N - 10); i--) { const a = rope[i], b = rope[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, diff = (d - 10) / d; a.x += dx * diff; a.y += dy * diff; } }
      // tail
      tail[0].x = kite.x - Math.cos(kite.a) * 0; tail[0].y = kite.y; for (let i = 1; i < TN; i++) { const r = tail[i], vx = (r.x - r.px) * 0.96, vy = (r.y - r.py) * 0.96; r.px = r.x; r.py = r.y; r.x += vx - wind * 40 * dt + Math.sin(T * 8 + i) * 30 * dt; r.y += vy + 200 * dt * dt * 60; }
      for (let k = 0; k < 4; k++) for (let i = 0; i < TN - 1; i++) { const a = tail[i], b = tail[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, diff = (d - 9) / d * 0.5; if (i > 0) { a.x += dx * diff; a.y += dy * diff; } b.x -= dx * diff; b.y -= dy * diff; }
      // ---- draw ----
      const sky0 = [[118, 176, 232], [255, 150, 110]], sky1 = [[196, 226, 246], [255, 214, 160]], c0 = sky0[0].map((v, i) => lerp(v, sky0[1][i], sunset)), c1 = sky1[0].map((v, i) => lerp(v, sky1[1][i], sunset));
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgb(${c0.join(',')})`); g.addColorStop(1, `rgb(${c1.join(',')})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (sunset > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = sunset * 0.55; ctx.drawImage(sun, W * 0.5 - W * 0.45, H * 0.62 - W * 0.45, W * 0.9, W * 0.9); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      ctx.save(); ctx.translate(0, -camY);
      // clouds (world space), drifting
      for (const c of clouds) { c.x += c.v * dt * (0.5 + wind * 0.5); if (c.x > 1.3) c.x = -0.3; const cx = c.x * W, cy = c.y * H + H * 0.5, s = c.s * W; for (const p of c.puffs) { const r = p[2] * s * 0.6, cg = ctx.createRadialGradient(cx + p[0] * s, cy + p[1] * s, 0, cx + p[0] * s, cy + p[1] * s, r); cg.addColorStop(0, `rgba(255,255,255,${0.85 - sunset * 0.25})`); cg.addColorStop(0.55, `rgba(255,255,255,${0.6 - sunset * 0.2})`); cg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(cx + p[0] * s, cy + p[1] * s, r, r * 0.62, 0, 0, TAU); ctx.fill(); } }
      // ground
      const gy = H * 0.86; const hill = ctx.createLinearGradient(0, gy - 40, 0, H); hill.addColorStop(0, '#79b457'); hill.addColorStop(1, '#3d7a35'); ctx.fillStyle = hill; ctx.beginPath(); ctx.moveTo(0, H + 400); ctx.lineTo(0, gy + 10); ctx.quadraticCurveTo(W * 0.5, gy - 40, W, gy + 20); ctx.lineTo(W, H + 400); ctx.closePath(); ctx.fill();
      // sea of lost kites above the clouds
      if (sunset > 0) for (const o of others) { o.ph += dt; const ox = o.x * W + Math.sin(o.ph * 0.7) * 30, oy = kite.y - H * 0.6 + o.y * H + Math.cos(o.ph * 0.5) * 20; ctx.globalAlpha = sunset; kiteShape(ctx, ox, oy, -Math.PI / 2 + Math.sin(o.ph) * 0.2, 14 * o.s, o.hue, 0.95); ctx.strokeStyle = 'rgba(80,60,60,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ox, oy + 16 * o.s); ctx.quadraticCurveTo(ox - 20, oy + 60 * o.s, ox - 10, oy + 110 * o.s); ctx.stroke(); ctx.globalAlpha = 1; }
      // rope
      ctx.strokeStyle = 'rgba(70,55,50,.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); rope.forEach((r, i) => i ? ctx.lineTo(r.x, r.y) : ctx.moveTo(r.x, r.y)); ctx.stroke();
      // tail ribbons
      for (let i = 1; i < TN; i++) { const a = tail[i - 1], b = tail[i]; ctx.strokeStyle = `hsl(${hue + i * 25},85%,60%)`; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); if (i % 3 === 0) { ctx.fillStyle = `hsl(${hue + i * 25},85%,62%)`; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2); ctx.fillRect(-7, -2, 14, 4); ctx.restore(); } }
      kiteShape(ctx, kite.x, kite.y, kite.a, 26 * (W / 400), hue, 1);
      ctx.restore();
      // the hand on the ground (a small spool), tethered only
      if (tethered) { ctx.fillStyle = '#4a342e'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(handX - 10, H * 0.86 - 6, 20, 12, 4) : ctx.rect(handX - 10, H * 0.86 - 6, 20, 12); ctx.fill(); }
      if (cloudWhite > 0) { ctx.fillStyle = `rgba(255,255,255,${cloudWhite})`; ctx.fillRect(0, 0, W, H); }
      if (wind > 1.2 && T - lastHum > 0.25) { lastHum = T; haptic(3); }
    });
    return () => { stop(); pt.destroy(); m && m.stop(); air.stop(); pad.stop(); cv.destroy(); };
  },
};
