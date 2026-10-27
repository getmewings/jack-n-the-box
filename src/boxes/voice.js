// Day: a city at night. Make a sound. Any sound. Louder. Higher.
import { audio, haptic, mic, ask, GLYPH, makeCanvas, loop, pointers, rnd, TAU, lerp, clamp, glowSprite, flash } from '../engine.js';

export default {
  name: 'voice',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const m = await ask(root, GLYPH.mic, mic);
    const R = api.rng;
    const bld = []; for (let x = 0; x < cv.W + 40;) { const w = 18 + R() * 50, h = 40 + R() * R() * 220; const win = []; for (let yy = 10; yy < h - 8; yy += 11) for (let xx = 4; xx < w - 6; xx += 9) if (R() < 0.45) win.push([xx, yy]); bld.push({ x, w, h, win }); x += w + 2 + R() * 6; }
    const sprite = glowSprite(64, '255,200,140'), rockets = [], parts = [], sparks = [];
    let base = 0.01, calT = 0, energy = 0, lastLaunch = 0, hue = 0, finale = false, finaleT = 0, stars = Array.from({ length: 120 }, () => ({ x: rnd(cv.W), y: rnd(cv.H * 0.7), a: rnd(0.2, 0.8) }));
    const pt = pointers(root, { down(p) { launch(p.x, 0.6, rnd(360), true); } });
    function launch(x, pow, h, tap) {
      const W = cv.W, H = cv.H;
      rockets.push({ x, y: H - 60, vx: rnd(-40, 40), vy: -(400 + pow * 300) * (H / 800), h, pow, trail: [], t: 0, fuse: 0.9 + pow * 0.5 + rnd(0.2) });
      audio.tone(900 + pow * 600, { dur: 0.9 + pow * 0.4, gain: 0.08, to: 2200, type: 'sine' }); audio.noise({ dur: 0.5, gain: 0.15, type: 'bandpass', freq: 1200, q: 0.6 }); haptic(8);
    }
    function burst(r) {
      const n = parts.length > 2500 ? 60 : Math.floor(90 + r.pow * 260), kind = Math.floor(rnd(4));
      for (let i = 0; i < n; i++) {
        const a = rnd(TAU), s = (kind === 1 ? 160 + rnd(60) : rnd(40, 180 + r.pow * 260)) * (1 + r.pow * 0.4), hh = kind === 2 ? r.h + (i % 2) * 140 : r.h + rnd(-25, 25);
        parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * s + r.vx * 0.2, vy: Math.sin(a) * s * (kind === 3 ? 0.4 : 1), h: hh, life: 1, decay: rnd(0.35, 0.8) / (0.8 + r.pow * 0.6), sz: rnd(2, 4) + r.pow * 2, crack: r.pow > 0.6 && Math.random() < 0.4 });
      }
      audio.thump(0, 0.5 + r.pow * 0.5); audio.noise({ dur: 0.6 + r.pow, gain: 0.5 + r.pow * 0.4, type: 'lowpass', freq: 1200, freqTo: 100 });
      if (r.pow > 0.5) for (let i = 0; i < 12; i++) audio.noise({ t: 0.3 + rnd(1.2), dur: 0.03, gain: 0.25, type: 'highpass', freq: 3000 });
      haptic(r.pow > 0.6 ? [40, 30, 60] : 25); if (r.pow > 0.5) flash(0.15 + r.pow * 0.3, 120);
    }
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H;
      // listen
      if (m) {
        const l = m.level(); calT += dt; if (calT < 1.2) base = Math.max(base, l * 1.5);
        const lvl = clamp((l - base * 1.8) / 0.25, 0, 1);
        if (lvl > 0.08) { const p = m.pitch(); if (p) hue = lerp(hue, clamp((Math.log2(p / 80)) / 3.5, 0, 1) * 330, 0.3); energy += lvl * dt; }
        if (lvl > 0.1 && t - lastLaunch > 0.55 - lvl * 0.4) { lastLaunch = t; launch(rnd(W * 0.1, W * 0.9), lvl, hue); if (lvl > 0.75) launch(rnd(W * 0.1, W * 0.9), lvl * 0.8, hue + 40); }
        if (energy > 9 && !finale) { finale = true; finaleT = 0; }
      }
      if (finale) { finaleT += dt; if (finaleT < 2.4 && Math.random() < 0.5) launch(rnd(W * 0.05, W * 0.95), rnd(0.7, 1), rnd(360)); if (finaleT > 6) { finale = false; energy = 0; } }
      // sky
      const fl = parts.length ? Math.min(0.35, parts.length / 1500) : 0;
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgb(${4 + fl * 40},${6 + fl * 40},${20 + fl * 60})`); g.addColorStop(1, `rgb(${18 + fl * 60},${10 + fl * 40},${32 + fl * 60})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; for (const s of stars) { ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(t * 2 + s.x)); ctx.fillRect(s.x, s.y, 1.2, 1.2); } ctx.globalAlpha = 1;
      // skyline
      for (const b of bld) { const y = H - 20 - b.h; ctx.fillStyle = `rgb(${10 + fl * 90},${10 + fl * 60},${18 + fl * 90})`; ctx.fillRect(b.x, y, b.w, b.h + 20); ctx.fillStyle = 'rgba(255,220,150,.75)'; for (const w of b.win) if (Math.sin(t * 0.3 + w[0] * w[1]) > -0.7) ctx.fillRect(b.x + w[0], y + w[1], 4, 6); }
      ctx.fillStyle = '#07060c'; ctx.fillRect(0, H - 20, W, 20);
      ctx.globalCompositeOperation = 'lighter';
      // rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]; r.t += dt; r.vy += 260 * dt * (H / 800); r.x += r.vx * dt; r.y += r.vy * dt; r.trail.push([r.x, r.y]); if (r.trail.length > 14) r.trail.shift();
        if (r.t > r.fuse || r.vy > -60) { burst(r); rockets.splice(i, 1); continue; }
        ctx.strokeStyle = `hsla(${r.h},90%,75%,.6)`; ctx.lineWidth = 2; ctx.beginPath(); r.trail.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
        ctx.drawImage(sprite, r.x - 10, r.y - 10, 20, 20);
        if (Math.random() < 0.6) sparks.push({ x: r.x, y: r.y, vx: rnd(-40, 40), vy: rnd(0, 80), life: 0.6, h: 40 });
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.vy += 90 * dt; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        if (p.crack && Math.random() < 0.08) sparks.push({ x: p.x, y: p.y, vx: rnd(-60, 60), vy: rnd(-60, 60), life: 0.4, h: 50 });
        const tw = p.life < 0.4 ? (Math.random() < p.life * 2 ? 1 : 0.2) : 1;
        ctx.globalAlpha = p.life * tw * 0.5; const sz = p.sz * (1 + (1 - p.life) * 2) * 3; ctx.drawImage(sprite, p.x - sz / 2, p.y - sz / 2, sz, sz); ctx.globalAlpha = p.life * tw;
        ctx.fillStyle = `hsl(${p.h},100%,${55 + 20 * p.life}%)`; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * 0.6, 0, TAU); ctx.fill();
      }
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (s.life <= 0) { sparks.splice(i, 1); continue; } ctx.globalAlpha = s.life * 2; ctx.fillStyle = `hsl(${s.h},100%,85%)`; ctx.fillRect(s.x, s.y, 1.5, 1.5); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    });
    return () => { stop(); pt.destroy(); m && m.stop(); cv.destroy(); };
  },
};
