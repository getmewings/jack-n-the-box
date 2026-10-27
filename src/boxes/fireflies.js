// Day two. A meadow at night. The fireflies come to your finger. Then they gather, become a bird, and fly off into the dawn.
import { audio, haptic, makeCanvas, loop, pointers, rnd, TAU, lerp, glowSprite, clamp } from '../engine.js';

export default {
  name: 'fireflies',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion();
    const N = 360, F = [];
    for (let i = 0; i < N; i++) F.push({ x: rnd(cv.W), y: rnd(cv.H), vx: 0, vy: 0, ph: rnd(TAU), per: rnd(1.5, 4), tx: 0, ty: 0, k: i / N });
    const sprite = glowSprite(96, '220,255,150'), sprite2 = glowSprite(96, '255,235,170');
    const grass = Array.from({ length: 110 }, () => ({ x: rnd(cv.W), h: rnd(30, 120), lean: rnd(-0.4, 0.4), w: rnd(2, 5) }));
    const pad = audio.pad([65.4, 98, 130.8, 196], { gain: 0.05, type: 'triangle' });
    const crick = audio.noiseLoop({ type: 'bandpass', freq: 4200, q: 12, gain: 0 });
    let finger = null, T = 0, phase = 0, pT = 0, dawn = 0, flap = 0, birdX = 0, birdY = 0, birdVX = 0, birdVY = 0, ended = false, lastShake = 0, scale = [0, 2, 4, 7, 9, 12, 14, 16];
    const pt = pointers(root, { down(p) { finger = p; }, move(p) { finger = p; }, up() { finger = null; } });

    // bird made of points: each firefly owns a spot on the bird
    function birdTarget(f, cx, cy, S, flap, dir) {
      const k = f.k; let x, y;
      // wings: a swept shape from the shoulder out to a raised tip, feathered along the trailing edge
      if (k < 0.44) { const side = k < 0.22 ? 1 : -1, u = (k % 0.22) / 0.22, v = f.ph / TAU; const lift = 0.1 + 0.4 * flap; const px = u * 0.5, py = -lift * (u * u * 1.6 - u * 0.3); const thick = 0.26 * Math.sin(Math.min(1, u * 1.3) * Math.PI) + 0.02; x = 0.02 + side * px; y = py + (v - 0.35) * thick + (v > 0.85 ? 0.05 * Math.sin(u * 9) : 0); }
      else if (k < 0.74) { const a = (k - 0.44) / 0.3 * TAU, r = 0.5 + 0.5 * (f.ph / TAU); x = Math.cos(a) * 0.2 * r; y = Math.sin(a) * 0.07 * r + 0.02; }                       // body
      else if (k < 0.84) { const a = (k - 0.74) / 0.1 * TAU, r = 0.5 + 0.5 * (f.ph / TAU); x = 0.24 + Math.cos(a) * 0.06 * r; y = -0.02 + Math.sin(a) * 0.055 * r; if (f.k > 0.835) { x = 0.33; y = -0.01; } } // head + beak
      else { const u = (k - 0.84) / 0.16, v = f.ph / TAU; x = -0.2 - u * 0.16; y = 0.02 + (v - 0.5) * (0.04 + u * 0.14); }                                                   // tail
      return [cx + x * S * dir, cy + y * S];
    }
    function release(k) { lastShake = performance.now(); for (const f of F) { const a = rnd(TAU), s = rnd(200, 700); f.vx = Math.cos(a) * s; f.vy = Math.sin(a) * s; } haptic([20, 30, 20]); for (let i = 0; i < 10; i++) audio.pluck(72 + scale[i % 8] + 12 * Math.floor(i / 8), { t: i * 0.04, gain: 0.1, dur: 1.5 }); }

    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; T += dt; pT += dt;
      const S = Math.min(W, H) * 1.15;
      if (mo.shake > 14 && performance.now() - lastShake > 1500 && phase === 0) release();
      // timeline
      if (phase === 0 && pT > 7) { phase = 1; pT = 0; audio.noise({ dur: 3, gain: 0.08, type: 'bandpass', freq: 2500, q: 0.5 }); }               // gather
      if (phase === 1 && pT > 3) { phase = 2; pT = 0; birdX = W / 2; birdY = H * 0.45; for (let i = 0; i < 8; i++) audio.pluck(76 + scale[i], { t: i * 0.12, gain: 0.12, dur: 2 }); haptic([10, 40, 10, 40, 30]); } // bird forms
      if (phase === 2 && pT > 5.5) { phase = 3; pT = 0; birdVX = 0; birdVY = 0; audio.noise({ dur: 2.5, gain: 0.15, type: 'bandpass', freq: 900, q: 0.8 }); }   // takes off
      if (phase === 3 && pT > 3.2) { phase = 4; pT = 0; pad.gain.setTargetAtTime(0.09, audio.now(), 2); [60, 64, 67, 71, 74].forEach((m, i) => audio.pluck(m, { t: i * 0.25, gain: 0.14, dur: 3 })); } // dawn
      if (phase === 4 && pT > 6 && !ended) { ended = true; api.done(); }
      flap = phase >= 2 ? 0.5 + 0.5 * Math.sin(pT * (phase === 3 ? 9 : 5)) : 0.6;
      if (phase === 3) { birdVX = lerp(birdVX, W * 0.55, 0.03); birdVY = lerp(birdVY, -H * 0.45, 0.03); birdX += birdVX * dt; birdY += birdVY * dt + Math.sin(pT * 9) * 1.5; }
      if (phase === 4) dawn = Math.min(1, pT / 4.5);
      const ch = (Math.sin(t * 28) > 0.6 && Math.sin(t * 0.9) > -0.3) ? 0.02 * (1 - dawn) : 0; crick.gain.setTargetAtTime(ch, audio.now(), 0.01);
      // sky
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, lerpC('#02040c', '#5a6fb8', dawn)); g.addColorStop(0.55, lerpC('#061026', '#e79a7a', dawn)); g.addColorStop(1, lerpC('#0a1a14', '#f8d49a', dawn)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (dawn > 0) { const sy = H * 0.9 - dawn * H * 0.25, sg = ctx.createRadialGradient(W * 0.5, sy, 0, W * 0.5, sy, W * 0.8); sg.addColorStop(0, `rgba(255,240,200,${0.9 * dawn})`); sg.addColorStop(0.12, `rgba(255,200,120,${0.5 * dawn})`); sg.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H); }
      const mg = ctx.createRadialGradient(W * 0.8, H * 0.12, 0, W * 0.8, H * 0.12, W * 0.5); mg.addColorStop(0, `rgba(180,200,255,${0.1 * (1 - dawn)})`); mg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      let caught = 0, i = 0;
      for (const f of F) {
        if (phase === 0) {
          if (finger) { const dx = finger.x - f.x, dy = finger.y - f.y, d = Math.hypot(dx, dy) + 1; if (d < 160) { caught++; f.vx += dx / d * 900 * dt; f.vy += dy / d * 900 * dt; if (d < 30) { f.vx -= dx / d * 1500 * dt; f.vy -= dy / d * 1500 * dt; } } }
          f.vx += rnd(-1, 1) * 60 * dt; f.vy += rnd(-1, 1) * 60 * dt - 2 * dt; f.vx *= 0.97; f.vy *= 0.97;
        } else if (phase === 1) { const a = Math.atan2(f.y - H * 0.45, f.x - W / 2), d = Math.hypot(f.y - H * 0.45, f.x - W / 2); const tx = W / 2 + Math.cos(a + 1.2) * d * 0.6, ty = H * 0.45 + Math.sin(a + 1.2) * d * 0.6; f.vx = lerp(f.vx, (tx - f.x) * 3, 0.1); f.vy = lerp(f.vy, (ty - f.y) * 3, 0.1); }
        else if (phase >= 2 && phase <= 3) { const [tx, ty] = birdTarget(f, birdX, birdY, S, flap, 1); const k = phase === 2 ? Math.min(1, pT * 0.8) : 1; f.vx = lerp(f.vx, (tx - f.x) * (6 + k * 10), 0.25); f.vy = lerp(f.vy, (ty - f.y) * (6 + k * 10), 0.25); }
        else { f.vy -= 40 * dt; f.vx += rnd(-1, 1) * 40 * dt; }
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (phase === 0) { if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20; if (f.y < -20) f.y = H + 20; if (f.y > H + 20) f.y = -20; }
        const lit = phase >= 2 ? 0.85 + 0.15 * Math.sin(t * 6 + f.ph) : Math.pow(Math.max(0, Math.sin(t / f.per * TAU + f.ph)), 3);
        const fade = phase === 4 ? Math.max(0, 1 - pT / 3) : 1;
        if (lit * fade < 0.02) { i++; continue; }
        const sz = (phase >= 2 ? 20 : 16) * (0.7 + lit * 0.5); ctx.globalAlpha = lit * fade * 0.8; ctx.drawImage(phase >= 2 ? sprite2 : sprite, f.x - sz / 2, f.y - sz / 2, sz, sz);
        ctx.fillStyle = `rgba(255,255,230,${lit * fade})`; ctx.beginPath(); ctx.arc(f.x, f.y, 1.3, 0, TAU); ctx.fill(); i++;
      }
      if (finger && phase === 0 && caught) { const sz = 80 + clamp(caught / 80, 0, 1) * 220; ctx.globalAlpha = 0.4; ctx.drawImage(sprite2, finger.x - sz / 2, finger.y - sz / 2, sz, sz); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      for (const b of grass) { const sway = Math.sin(t * 1.2 + b.x * 0.02) * 6; ctx.strokeStyle = lerpC('#05100a', '#3d4a1e', dawn); ctx.lineWidth = b.w; ctx.beginPath(); ctx.moveTo(b.x, H + 2); ctx.quadraticCurveTo(b.x + b.lean * 30, H - b.h * 0.6, b.x + b.lean * 60 + sway, H - b.h); ctx.stroke(); }
    });
    function lerpC(a, b, t) { const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16)); return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`; }
    return () => { stop(); pt.destroy(); pad.stop(); crick.stop(); cv.destroy(); };
  },
};
