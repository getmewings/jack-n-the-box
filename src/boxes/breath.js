// Day three. A dandelion in the dark. Blow on your phone. The seeds you free turn into lanterns and rise out of sight.
import { audio, haptic, mic, ask, GLYPH, makeCanvas, loop, pointers, rnd, TAU, lerp, glowSprite, clamp } from '../engine.js';

export default {
  name: 'breath',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    let m = await ask(root, GLYPH.mic, mic);
    const sprite = glowSprite(64, '255,220,160'), seedGlow = glowSprite(48, '255,250,220');
    const head = { x: cv.W / 2, y: cv.H * 0.42, r: Math.min(cv.W, cv.H) * 0.26 };
    const N = 170, seeds = [];
    for (let i = 0; i < N; i++) { const a = rnd(TAU), r = rnd(0.2, 1); seeds.push({ a, r, len: head.r * (0.75 + 0.25 * r), free: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, lan: 0, hue: rnd(20, 45), sway: rnd(TAU), gone: false }); }
    let wind = 0, base = 0.01, calT = 0, swipe = 0, T = 0, lantT = -1, ended = false, autoGust = 0;
    const whoosh = audio.noiseLoop({ type: 'bandpass', freq: 600, q: 0.6, gain: 0 });
    const pad = audio.pad([98, 146.8, 196, 246.9], { gain: 0.0, type: 'triangle' });
    const pt = pointers(root, { move(p) { const v = Math.hypot(p.x - p.px, p.y - p.py); swipe = Math.max(swipe, clamp(v / 25, 0, 1)); } });
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; T += dt;
      let lvl = 0;
      if (m) { const l = m.level(); calT += dt; if (calT < 1.2) base = Math.max(base, l * 1.5); lvl = clamp((l - base * 2.2) / 0.12, 0, 1); }
      // a gust comes on its own if you don't blow
      const freed = seeds.filter(s => s.free).length;
      if (T > 7 && freed < 10) autoGust = Math.min(1, autoGust + dt * 0.5); else autoGust = Math.max(0, autoGust - dt);
      lvl = Math.max(lvl, swipe, autoGust * (0.6 + 0.4 * Math.sin(T * 3))); swipe *= 0.9;
      wind = lerp(wind, lvl, 0.15);
      whoosh.gain.setTargetAtTime(wind * 0.25, audio.now(), 0.05); whoosh.filter.frequency.setTargetAtTime(400 + wind * 1200, audio.now(), 0.05);
      const wx = 0.6 + 0.4 * Math.sin(t * 0.7), wy = -0.8;
      // lanterns begin once most seeds are free, or at 13 s
      if (lantT < 0 && (freed > N * 0.6 || T > 13)) { lantT = 0; pad.gain.setTargetAtTime(0.08, audio.now(), 2); [64, 68, 71, 75, 80].forEach((n, i) => audio.pluck(n, { t: i * 0.18, gain: 0.12, dur: 3 })); haptic([10, 60, 10, 60, 20]); }
      if (lantT >= 0) lantT += dt;
      if (lantT > 10 && !ended) { ended = true; api.done(); }
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#050309'); g.addColorStop(1, lantT > 0 ? `rgb(${20 + Math.min(1, lantT / 6) * 30},${12 + Math.min(1, lantT / 6) * 10},${26})` : '#0e0a18'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const sway = Math.sin(t * 1.1) * 4 + wind * 40; head.x = W / 2 + sway; head.y = H * 0.42 + wind * 10;
      ctx.strokeStyle = '#2b4a2a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(W / 2, H + 5); ctx.quadraticCurveTo(W / 2 + sway * 0.5, H * 0.7, head.x, head.y); ctx.stroke();
      ctx.fillStyle = '#4b6b3a'; ctx.beginPath(); ctx.arc(head.x, head.y, 7, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of seeds) {
        if (!s.free) {
          if (wind > 0.12 && Math.random() < wind * wind * 0.35 + (wind > 0.6 ? 0.1 : 0)) { s.free = true; const ex = Math.cos(s.a) * s.len, ey = Math.sin(s.a) * s.len * 0.9; s.x = head.x + ex; s.y = head.y + ey; s.vx = wx * rnd(150, 400) * wind + ex * 2; s.vy = wy * rnd(100, 300) * wind + ey * 2; s.rot = s.a; s.vr = rnd(-2, 2); if (Math.random() < 0.3) audio.tinkle(0, 0.03); if (Math.random() < 0.1) haptic(3); continue; }
          const jit = Math.sin(t * 3 + s.a * 5) * 0.02 * (1 + wind * 10); drawSeed(head.x, head.y, s.a + jit, s.len, 1, 0.9, false);
        } else if (!s.gone) {
          if (lantT < 0) { s.vx += (wx * 120 * (0.3 + wind) + Math.sin(t * 2 + s.a * 7) * 90) * dt; s.vy += (wy * 60 * (0.3 + wind) + Math.cos(t * 1.7 + s.a * 5) * 90 - 10) * dt; s.vx *= 0.99; s.vy *= 0.99; if (s.x > W + 40) s.x = -40; if (s.x < -40) s.x = W + 40; if (s.y < -40) s.y = H + 40; if (s.y > H + 40) s.y = -40; }
          else { // becoming a lantern: slow, upward, swaying
            s.lan = Math.min(1, s.lan + dt * 0.7); s.vx = lerp(s.vx, Math.sin(t * 0.8 + s.sway) * 25 + wind * wx * 200, 0.04); s.vy = lerp(s.vy, -(35 + s.r * 40) - s.lan * 30, 0.04);
            if (s.x < -60) s.x = W + 60; if (s.x > W + 60) s.x = -60; if (s.y < -120) s.gone = true;
          }
          s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt * (1 - s.lan);
          if (s.lan > 0) drawLantern(s); else drawSeed(s.x, s.y, s.rot, s.len * 0.6, 0.9, 0.8, true);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      function drawSeed(x, y, a, len, al, w, free) {
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len * (free ? 1 : 0.9);
        ctx.strokeStyle = `rgba(240,235,220,${0.35 * al})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,245,${0.75 * al})`; ctx.lineWidth = 0.7; ctx.beginPath(); for (let k = -3; k <= 3; k++) { const aa = a + k * 0.28; ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(aa) * 9 * w, ey + Math.sin(aa) * 9 * w); } ctx.stroke();
        if (free) { ctx.globalAlpha = 0.35; ctx.drawImage(seedGlow, ex - 10, ey - 10, 20, 20); ctx.globalAlpha = 1; }
      }
      function drawLantern(s) {
        const k = s.lan, w = 10 + k * (14 + s.r * 12), h = w * 1.45, x = s.x, y = s.y, fl = 0.8 + 0.2 * Math.sin(t * 9 + s.sway);
        ctx.globalAlpha = 0.5 * k * fl; ctx.drawImage(sprite, x - w * 2.2, y - w * 2.2, w * 4.4, w * 4.4); ctx.globalAlpha = 1;
        if (k < 1) drawSeed(x, y, s.rot, s.len * 0.6 * (1 - k), 1 - k, 0.8, true);
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.8 + s.sway) * 0.08);
        const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, `hsla(${s.hue},90%,70%,${0.9 * k})`); g.addColorStop(0.5, `hsla(${s.hue + 10},100%,80%,${0.95 * k * fl})`); g.addColorStop(1, `hsla(${s.hue},90%,55%,${0.9 * k})`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w * 0.35, -h / 2); ctx.quadraticCurveTo(-w * 0.75, 0, -w * 0.35, h / 2); ctx.lineTo(w * 0.35, h / 2); ctx.quadraticCurveTo(w * 0.75, 0, w * 0.35, -h / 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(80,40,20,${k})`; ctx.fillRect(-w * 0.35, -h / 2 - 2, w * 0.7, 3); ctx.fillRect(-w * 0.35, h / 2 - 1, w * 0.7, 3);
        ctx.restore();
      }
    });
    return () => { stop(); pt.destroy(); m && m.stop(); whoosh.stop(); pad.stop(); cv.destroy(); };
  },
};
