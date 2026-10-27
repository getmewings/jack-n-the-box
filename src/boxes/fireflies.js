// Day: a dark meadow. Touch, and they come to your finger. Hold still, and they build something. Shake to let them go.
import { audio, haptic, makeCanvas, loop, pointers, rnd, TAU, lerp, glowSprite, clamp } from '../engine.js';

export default {
  name: 'fireflies',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion();
    const N = 320, F = [];
    for (let i = 0; i < N; i++) F.push({ x: rnd(cv.W), y: rnd(cv.H), vx: 0, vy: 0, ph: rnd(TAU), per: rnd(1.5, 4), caught: false, th: rnd(TAU), r: 0, h: rnd(-20, 20) });
    const sprite = glowSprite(96, '220,255,150'), sprite2 = glowSprite(96, '255,240,180');
    const grass = Array.from({ length: 90 }, () => ({ x: rnd(cv.W), h: rnd(30, 110), lean: rnd(-0.4, 0.4), w: rnd(2, 5) }));
    const pad = audio.pad([65.4, 98, 130.8, 196], { gain: 0.05, type: 'triangle' });
    const crick = audio.noiseLoop({ type: 'bandpass', freq: 4200, q: 12, gain: 0 });
    let finger = null, holdT = 0, formT = 0, build = 0, scale = [0, 2, 4, 7, 9, 12, 14, 16], lastShake = 0, glow = 0, caughtN = 0;
    const pt = pointers(root, {
      down(p) { finger = p; holdT = 0; },
      move(p) { finger = p; if (Math.hypot(p.x - p.px, p.y - p.py) > 3) holdT = 0; },
      up() { finger = null; },
    });
    function release() {
      lastShake = performance.now(); let k = 0;
      for (const f of F) if (f.caught) { f.caught = false; const a = rnd(TAU), s = rnd(200, 700); f.vx = Math.cos(a) * s; f.vy = Math.sin(a) * s; k++; }
      caughtN = 0; build = 0; formT = 0;
      if (k) { haptic([20, 30, 20]); for (let i = 0; i < 10; i++) audio.pluck(72 + scale[i % 8] + 12 * Math.floor(i / 8), { t: i * 0.04, gain: 0.12, dur: 1.5 }); audio.noise({ dur: 0.6, gain: 0.12, type: 'highpass', freq: 3000 }); }
    }
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H;
      // shake
      if (mo.shake > 14 && performance.now() - lastShake > 1500) release();
      if (finger && finger.t && performance.now() - finger.t < 60 && Math.hypot(finger.x - finger.px, finger.y - finger.py) > 60 && caughtN > 30) release();
      // crickets: pulsing chirps
      const ch = (Math.sin(t * 28) > 0.6 && Math.sin(t * 0.9) > -0.3) ? 0.02 : 0; crick.gain.setTargetAtTime(ch, audio.now(), 0.01);
      // sky
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#02040c'); g.addColorStop(0.7, '#061026'); g.addColorStop(1, '#0a1a14'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // moon haze
      const mg = ctx.createRadialGradient(W * 0.8, H * 0.12, 0, W * 0.8, H * 0.12, W * 0.5); mg.addColorStop(0, 'rgba(180,200,255,.10)'); mg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
      if (finger) holdT += dt; else holdT = 0;
      if (holdT > 1.2 && caughtN > 12) { formT += dt; build = Math.min(1, build + dt * 0.6); } else { build = Math.max(0, build - dt * 1.5); }
      ctx.globalCompositeOperation = 'lighter';
      let i = 0;
      for (const f of F) {
        if (f.caught && finger) {
          if (build > 0) { // orbiting sphere
            f.th += dt * (0.6 + (i % 5) * 0.08);
            const R = 60 + Math.min(W, H) * 0.12 * build, lat = ((i * 7919) % 97) / 97 * Math.PI - Math.PI / 2;
            const tx = finger.x + Math.cos(f.th) * Math.cos(lat) * R, ty = finger.y + Math.sin(lat) * R * 0.9 + Math.sin(f.th * 0.5 + formT) * 4;
            const depth = Math.sin(f.th) * Math.cos(lat); f.r = depth;
            f.vx = lerp(f.vx, (tx - f.x) * 8, 0.2); f.vy = lerp(f.vy, (ty - f.y) * 8, 0.2);
          } else {
            const dx = finger.x - f.x, dy = finger.y - f.y, d = Math.hypot(dx, dy) + 1;
            f.vx += (dx / d) * 900 * dt + rnd(-200, 200) * dt; f.vy += (dy / d) * 900 * dt + rnd(-200, 200) * dt;
            if (d < 30) { f.vx -= dx / d * 1200 * dt; f.vy -= dy / d * 1200 * dt; }
            f.vx *= 0.95; f.vy *= 0.95; f.r = 0;
          }
        } else {
          f.caught = false;
          f.vx += rnd(-1, 1) * 60 * dt + Math.sin(t * 0.3 + f.ph) * 4 * dt; f.vy += rnd(-1, 1) * 60 * dt - 2 * dt;
          f.vx *= 0.985; f.vy *= 0.985;
          if (finger) { const dx = finger.x - f.x, dy = finger.y - f.y, d = Math.hypot(dx, dy); if (d < 140 + caughtN * 0.5) { f.caught = true; caughtN++; audio.pluck(84 + scale[caughtN % 8], { gain: 0.05, dur: 0.8 }); haptic(4); } }
        }
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20; if (f.y < -20) f.y = H + 20; if (f.y > H + 20) f.y = -20;
        const blink = f.caught ? 0.8 + 0.2 * Math.sin(t * 6 + f.ph) : Math.pow(Math.max(0, Math.sin(t / f.per * TAU + f.ph)), 3);
        if (blink < 0.02) { i++; continue; }
        const sz = (f.caught ? 22 : 16) * (1 + (f.r || 0) * 0.5) * (0.7 + blink * 0.5);
        ctx.globalAlpha = blink * (f.caught ? 0.9 : 0.75) * (f.r ? 0.5 + (f.r + 1) * 0.25 : 1);
        ctx.drawImage(f.caught ? sprite2 : sprite, f.x - sz / 2, f.y - sz / 2, sz, sz);
        ctx.fillStyle = `rgba(255,255,230,${blink})`; ctx.beginPath(); ctx.arc(f.x, f.y, 1.3, 0, TAU); ctx.fill();
        i++;
      }
      caughtN = F.reduce((n, f) => n + (f.caught ? 1 : 0), 0);
      // finger glow
      glow = lerp(glow, finger ? Math.min(1, caughtN / 60) : 0, 0.1);
      if (finger && glow > 0.01) { const sz = 80 + glow * 220; ctx.globalAlpha = glow * 0.5; ctx.drawImage(sprite2, finger.x - sz / 2, finger.y - sz / 2, sz, sz); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // grass silhouettes, lit by glow
      for (const b of grass) {
        const sway = Math.sin(t * 1.2 + b.x * 0.02) * 6;
        ctx.strokeStyle = '#05100a'; ctx.lineWidth = b.w; ctx.beginPath(); ctx.moveTo(b.x, H + 2); ctx.quadraticCurveTo(b.x + b.lean * 30, H - b.h * 0.6, b.x + b.lean * 60 + sway, H - b.h); ctx.stroke();
      }
    });
    return () => { stop(); pt.destroy(); pad.stop(); crick.stop(); cv.destroy(); };
  },
};
