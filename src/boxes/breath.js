// Day: a dandelion clock in the dark. Blow on your phone. Then blow again.
import { audio, haptic, mic, ask, GLYPH, makeCanvas, loop, pointers, rnd, TAU, lerp, glowSprite, clamp } from '../engine.js';

export default {
  name: 'breath',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    let m = await ask(root, GLYPH.mic, mic); // null => swipe mode
    const sprite = glowSprite(48, '255,250,220');
    const W0 = cv.W, H0 = cv.H;
    const head = { x: W0 / 2, y: H0 * 0.42, r: Math.min(W0, H0) * 0.26 };
    const N = 200, seeds = [];
    for (let i = 0; i < N; i++) { const a = rnd(TAU), r = rnd(0.2, 1); seeds.push({ a, r, len: head.r * (0.75 + 0.25 * r), free: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, landed: false, bloom: 0 }); }
    const plants = []; // where seeds land and sprout
    let wind = 0, windS = 0, base = 0.01, calT = 0, swipe = 0, phase = 0, gone = 0, rainT = -1, whoosh = audio.noiseLoop({ type: 'bandpass', freq: 600, q: 0.6, gain: 0 });
    const pad = audio.pad([130.8, 196, 261.6, 392], { gain: 0.03, type: 'triangle' });
    const pt = pointers(root, { move(p) { const v = Math.hypot(p.x - p.px, p.y - p.py); swipe = Math.max(swipe, clamp(v / 25, 0, 1)); } });
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H;
      // breath level
      let lvl = 0;
      if (m) { const l = m.level(); calT += dt; if (calT < 1.2) base = Math.max(base, l * 1.5); lvl = clamp((l - base * 2.2) / 0.12, 0, 1); }
      lvl = Math.max(lvl, swipe); swipe *= 0.9;
      wind = lerp(wind, lvl, 0.15); windS = lerp(windS, lvl > 0.1 ? 1 : 0, 0.1);
      whoosh.gain.setTargetAtTime(wind * 0.25, audio.now(), 0.05); whoosh.filter.frequency.setTargetAtTime(400 + wind * 1200, audio.now(), 0.05);
      const wx = 0.6 + 0.4 * Math.sin(t * 0.7), wy = -0.8;
      // background
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#050309'); g.addColorStop(1, phase === 2 ? '#0b1a10' : '#0e0a18'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const sway = Math.sin(t * 1.1) * 4 + wind * 40;
      head.x = W / 2 + sway; head.y = H * 0.42 + wind * 10;
      // stem
      ctx.strokeStyle = '#2b4a2a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(W / 2, H + 5); ctx.quadraticCurveTo(W / 2 + sway * 0.5, H * 0.7, head.x, head.y); ctx.stroke();
      ctx.fillStyle = '#4b6b3a'; ctx.beginPath(); ctx.arc(head.x, head.y, 7, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      let attached = 0;
      for (const s of seeds) {
        if (!s.free) {
          attached++;
          if (wind > 0.12 && Math.random() < wind * wind * 0.35 + (wind > 0.6 ? 0.1 : 0)) {
            s.free = true; const ex = Math.cos(s.a) * s.len, ey = Math.sin(s.a) * s.len * 0.9;
            s.x = head.x + ex; s.y = head.y + ey; s.vx = wx * rnd(150, 400) * wind + ex * 2; s.vy = wy * rnd(100, 300) * wind + ey * 2; s.rot = s.a; s.vr = rnd(-2, 2);
            if (Math.random() < 0.3) audio.tinkle(0, 0.03); if (Math.random() < 0.1) haptic(3);
            continue;
          }
          const jit = Math.sin(t * 3 + s.a * 5) * 0.02 * (1 + wind * 10);
          drawSeed(head.x, head.y, s.a + jit, s.len, 1, 0.9);
        } else if (!s.landed) {
          if (phase < 2) { // flying away
            s.vx += (wx * 120 * (0.3 + wind) + Math.sin(t * 2 + s.a * 7) * 90) * dt; s.vy += (wy * 60 * (0.3 + wind) + Math.cos(t * 1.7 + s.a * 5) * 90 - 10) * dt;
            s.vx *= 0.995; s.vy *= 0.995; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
            if (s.x > W + 60 || s.y < -60 || s.x < -60) { s.gone = true; }
          } else { // raining back down
            s.vy = lerp(s.vy, 40 + s.r * 40, 0.05); s.vx = lerp(s.vx, Math.sin(t * 1.5 + s.a * 3) * 40 + wind * wx * 500, 0.1); s.vy += wind * wy * 300 * dt;
            s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; if (s.x < -20) s.x = W + 20; if (s.x > W + 20) s.x = -20; if (s.y < -40) s.y = -40;
            if (s.y > H - 10 - s.r * 30 && wind < 0.3) { s.landed = true; s.y = H - 5 - s.r * 30; plants.push({ x: s.x, y: s.y, h: rnd(40, 120), t: 0, hue: rnd(40, 90), seed: s }); audio.pluck(76 + [0, 2, 4, 7, 9, 11][plants.length % 6] + 12 * (plants.length % 3), { gain: 0.035, dur: 1.2 }); }
          }
          if (!s.gone) drawSeed(s.x, s.y, s.rot, s.len * 0.6, 0.9, 0.8, true);
        } else if (wind > 0.25 && Math.random() < wind * 0.2) { // blown off its new plant
          s.landed = false; s.vx = wx * rnd(200, 500); s.vy = wy * rnd(200, 500) * wind; s.bloom = 0;
          const p = plants.find(q => q.seed === s); if (p) { p.seed = null; }
          if (Math.random() < 0.1) audio.tinkle(0, 0.03);
        }
      }
      // plants grow where seeds landed
      for (const p of plants) {
        p.t = Math.min(1, p.t + dt * 0.5); const h = p.h * p.t, top = p.y - h;
        ctx.strokeStyle = `hsla(${p.hue + 60},50%,40%,.9)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + Math.sin(t + p.x) * 6, p.y - h / 2, p.x + Math.sin(t * 1.3 + p.x) * 8, top); ctx.stroke();
        if (p.t > 0.6) { const b = (p.t - 0.6) / 0.4, R = 14 * b, cx = p.x + Math.sin(t * 1.3 + p.x) * 8; ctx.globalAlpha = 0.9; ctx.drawImage(sprite, cx - R * 2, top - R * 2, R * 4, R * 4); ctx.globalAlpha = 1; for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + t * 0.3; ctx.fillStyle = `hsla(${p.hue},90%,85%,.9)`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R, top + Math.sin(a) * R, 1.6, 0, TAU); ctx.fill(); } }
      }
      ctx.globalCompositeOperation = 'source-over';
      // phases
      if (phase === 0 && attached === 0) { phase = 1; rainT = 0; }
      if (phase === 1) { rainT += dt; if (rainT > 2.2) { phase = 2; for (const s of seeds) { s.gone = false; s.x = rnd(W); s.y = -rnd(20, H * 2.5); s.vx = 0; s.vy = rnd(30, 80); s.landed = false; } pad.gain.setTargetAtTime(0.09, audio.now(), 2); audio.noise({ dur: 4, gain: 0.08, type: 'lowpass', freq: 300, freqTo: 1500 }); haptic([10, 100, 10, 100, 30]); } }
      function drawSeed(x, y, a, len, al, w, free) {
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len * (free ? 1 : 0.9);
        ctx.strokeStyle = `rgba(240,235,220,${0.35 * al})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,245,${0.75 * al})`; ctx.lineWidth = 0.7; ctx.beginPath();
        for (let k = -3; k <= 3; k++) { const aa = a + k * 0.28; ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(aa) * 9 * w, ey + Math.sin(aa) * 9 * w); }
        ctx.stroke();
        if (free) { ctx.globalAlpha = 0.35; ctx.drawImage(sprite, ex - 10, ey - 10, 20, 20); ctx.globalAlpha = 1; }
      }
    });
    return () => { stop(); pt.destroy(); m && m.stop(); whoosh.stop(); pad.stop(); cv.destroy(); };
  },
};
