// Day five. A storm in your phone. Hold your finger down and the lightning finds it. Then the storm clears and leaves a rainbow where you were.
import { audio, haptic, makeCanvas, loop, pointers, rnd, TAU, lerp, flash, shake, glowSprite, clamp } from '../engine.js';

export default {
  name: 'lightning',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const bolts = [], scorch = [], embers = [], clouds = Array.from({ length: 14 }, () => ({ x: rnd(-0.1, 1.1), y: rnd(-0.05, 0.22), r: rnd(0.25, 0.5), s: rnd(0.3, 1) }));
    const sprite = glowSprite(64, '255,200,120'), drop = glowSprite(32, '255,255,255');
    let hold = 0, since = 0, lastFlash = 0, fingers = new Map(), lastThunder = 0, T = 0, strikes = 0, clear = 0, clearT = -1, ended = false, autoT = 6, bowAt = null;
    const rumble = audio.noiseLoop({ type: 'lowpass', freq: 120, q: 0.7, gain: 0 }), buzz = audio.noiseLoop({ type: 'bandpass', freq: 3000, q: 2, gain: 0 }), rainS = audio.noiseLoop({ type: 'highpass', freq: 4000, q: 0.5, gain: 0.04 });
    const pad = audio.pad([130.8, 164.8, 196, 261.6], { gain: 0, type: 'triangle' });
    const cl = document.createElement('canvas'); cl.width = 128; cl.height = 96; const clx = cl.getContext('2d');
    for (const c of clouds) { const g = clx.createRadialGradient(c.x * 128, c.y * 96 * 2.5, 0, c.x * 128, c.y * 96 * 2.5, c.r * 128); g.addColorStop(0, `rgba(255,255,255,${0.45 * c.s})`); g.addColorStop(1, 'rgba(255,255,255,0)'); clx.fillStyle = g; clx.fillRect(0, 0, 128, 96); }
    const rain = Array.from({ length: 220 }, () => ({ x: rnd(cv.W), y: rnd(cv.H), v: rnd(600, 1100), l: rnd(8, 20) }));
    const pt = pointers(root, { down(p) { if (clearT >= 0) return; fingers.set(p.id, p); if (fingers.size === 1) hold = 0; }, move(p) { if (fingers.has(p.id)) fingers.set(p.id, p); }, up(p) { if (!fingers.has(p.id)) return; fingers.delete(p.id); if (!fingers.size) { since = 0; thunder(Math.min(1, hold / 2)); } } });
    function path(ax, ay, bx, by, jag) { const pts = [[ax, ay]], n = 18; let dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy); for (let i = 1; i < n; i++) { const t = i / n, off = (Math.random() - 0.5) * jag * L * (1 - Math.abs(t - 0.5)) * 0.5; pts.push([ax + dx * t - dy / L * off, ay + dy * t + dx / L * off]); } pts.push([bx, by]); return pts; }
    function bolt(ax, ay, bx, by, pow) { const main = path(ax, ay, bx, by, 0.5), branches = []; for (let i = 2; i < main.length - 3; i++) if (Math.random() < 0.25 * pow) { const [x, y] = main[i], a = Math.atan2(by - ay, bx - ax) + rnd(-1.2, 1.2), L = rnd(40, 160) * pow; branches.push(path(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 0.7)); } bolts.push({ main, branches, life: 1, pow }); strikes++; bowAt = [bx, by]; }
    function thunder(pow) { if (pow < 0.1) return; const d = 0.3 + (1 - pow) * 0.8; audio.noise({ t: d, dur: 2 + pow * 2, gain: 0.5 + pow * 0.5, type: 'lowpass', freq: 160, freqTo: 50, attack: 0.08 }); audio.tone(50, { t: d, dur: 2, gain: 0.5 * pow, to: 25 }); setTimeout(() => { haptic([120, 60, 200]); shake(root); }, d * 1000); }
    function strike(x, y, pow) { for (let k = 0; k < 1 + Math.floor(pow * 2); k++) bolt(rnd(cv.W * 0.1, cv.W * 0.9), rnd(-20, cv.H * 0.1), x, y, pow); const s = scorch.find(q => Math.hypot(q.x - x, q.y - y) < 20); if (s) { s.r = Math.min(s.r + 2, 140); s.a = Math.min(1, s.a + 0.05); } else scorch.push({ x, y, r: 30, a: 0.2 }); for (let i = 0; i < 3; i++) embers.push({ x, y, vx: rnd(-150, 150), vy: rnd(-250, -50), life: 1 }); audio.noise({ dur: 0.06 + pow * 0.1, gain: 0.25 + pow * 0.5, type: 'highpass', freq: 1500 }); audio.tone(rnd(2000, 6000), { dur: 0.04, gain: 0.1, type: 'square' }); haptic(pow > 0.7 ? [15, 10, 25] : 10); }
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; T += dt;
      // the storm ends on its own: after enough strikes or 15 s
      if (clearT < 0 && (T > 15 || strikes > 70)) { clearT = 0; fingers.clear(); pad.gain.setTargetAtTime(0.08, audio.now(), 2); thunder(0.8); [55, 62, 67, 74].forEach((m, i) => audio.pluck(m, { t: 1.2 + i * 0.3, gain: 0.12, dur: 3 })); }
      if (clearT >= 0) { clearT += dt; clear = clamp((clearT - 1) / 4, 0, 1); rainS.gain.setTargetAtTime(0.04 * (1 - clear), audio.now(), 0.5); if (clearT > 9 && !ended) { ended = true; api.done(); } }
      const fl = bolts.reduce((m, b) => Math.max(m, b.life * b.pow), 0);
      // sky: storm to clear
      const top = [8 + fl * 60 + clear * 100, 8 + fl * 60 + clear * 150, 16 + fl * 80 + clear * 200], bot = [20 + fl * 40 + clear * 200, 18 + fl * 40 + clear * 190, 30 + fl * 60 + clear * 170];
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgb(${top.join(',')})`); g.addColorStop(1, `rgb(${bot.join(',')})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (clear > 0) { const sg = ctx.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, W * 0.7); sg.addColorStop(0, `rgba(255,250,220,${clear})`); sg.addColorStop(0.1, `rgba(255,230,160,${0.6 * clear})`); sg.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H); }
      ctx.globalAlpha = (0.18 + fl * 0.7) * (1 - clear * 0.6); ctx.drawImage(cl, Math.sin(t * 0.05) * 20 - clear * W * 0.5, -clear * H * 0.3, W, H * 0.4); ctx.globalAlpha = 1;
      // rain
      if (clear < 1) { ctx.strokeStyle = `rgba(170,190,230,${(0.18 + fl * 0.5) * (1 - clear)})`; ctx.lineWidth = 1; ctx.beginPath(); for (const r of rain) { r.y += r.v * dt; r.x -= r.v * 0.15 * dt; if (r.y > H) { r.y = -20; r.x = rnd(-20, W + 60); } ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - r.l * 0.15, r.y - r.l); } ctx.stroke(); }
      // rainbow rises from where the lightning hit
      if (clear > 0 && bowAt) { const [bx, by] = bowAt; const R0 = Math.max(W, H) * 0.9 * clear, cx = bx, cy = by + R0 * 0.2; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * clear; const cols = [0, 30, 55, 120, 200, 240, 280]; cols.forEach((h, i) => { ctx.strokeStyle = `hsl(${h},100%,60%)`; ctx.lineWidth = R0 * 0.028; ctx.beginPath(); ctx.arc(cx, cy, R0 * (0.75 - i * 0.028), Math.PI, TAU); ctx.stroke(); }); ctx.restore(); }
      for (const s of scorch) { const g2 = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r); g2.addColorStop(0, `rgba(0,0,0,${0.9 * s.a * (1 - clear * 0.5)})`); g2.addColorStop(0.6, `rgba(10,5,0,${0.6 * s.a * (1 - clear * 0.5)})`); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2); }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = embers.length - 1; i >= 0; i--) { const e = embers[i]; e.vy += 140 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt * rnd(0.5, 1.5); if (e.life <= 0) { embers.splice(i, 1); continue; } ctx.globalAlpha = e.life; ctx.drawImage(sprite, e.x - 6, e.y - 6, 12, 12); }
      // glittering drops after the storm
      if (clear > 0.3) for (let i = 0; i < 40; i++) { const x = (i * 97.3) % W, y = (i * 151.7 + t * 20) % H, a = Math.max(0, Math.sin(t * 3 + i)) * clear * 0.6; ctx.globalAlpha = a; ctx.drawImage(drop, x, y, 10, 10); }
      ctx.globalAlpha = 1;
      // strikes
      const F = [...fingers.values()];
      if (F.length && clearT < 0) {
        hold += dt; since += dt; const pow = Math.min(1, 0.35 + hold / 2.5), rate = 0.14 - pow * 0.09;
        if (since > rate) { since = 0; const nb = 1 + Math.floor(pow * 2 * Math.random()); for (let k = 0; k < nb; k++) { if (F.length >= 2 && k === 0) bolt(F[0].x, F[0].y, F[1].x, F[1].y, pow); else strike(F[k % F.length].x, F[k % F.length].y, pow); } if (Math.random() < pow * 0.15 && t - lastFlash > 0.6) { lastFlash = t; flash(0.12 + pow * 0.2, 90); } if (hold > 1.6 && t - lastThunder > 1.6) { lastThunder = t; thunder(pow); } }
        buzz.gain.setTargetAtTime(0.06 + pow * 0.12, audio.now(), 0.03); buzz.filter.frequency.setTargetAtTime(2000 + Math.random() * 3000, audio.now(), 0.01); rumble.gain.setTargetAtTime(pow * 0.35, audio.now(), 0.1);
      } else {
        buzz.gain.setTargetAtTime(0, audio.now(), 0.05); rumble.gain.setTargetAtTime(0, audio.now(), 0.4);
        // the storm strikes on its own if you don't touch
        if (clearT < 0) { autoT -= dt; if (autoT <= 0) { autoT = rnd(1.2, 2.6); const x = rnd(W * 0.15, W * 0.85), y = rnd(H * 0.35, H * 0.85); strike(x, y, 0.8); flash(0.3, 100); thunder(0.7); } }
      }
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i]; b.life -= dt * (F.length ? 7 : 2.5); if (b.life <= 0) { bolts.splice(i, 1); continue; }
        const draw = (pts, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); };
        const a = b.life; draw(b.main, 18 * b.pow, `rgba(120,140,255,${0.18 * a})`); draw(b.main, 7 * b.pow, `rgba(170,190,255,${0.5 * a})`); draw(b.main, 2.2, `rgba(255,255,255,${a})`);
        for (const br of b.branches) { draw(br, 5 * b.pow, `rgba(160,180,255,${0.3 * a})`); draw(br, 1.2, `rgba(255,255,255,${0.9 * a})`); }
        const end = b.main[b.main.length - 1]; const sz = 60 + 120 * b.pow * a; ctx.globalAlpha = a * 0.8; ctx.drawImage(sprite, end[0] - sz / 2, end[1] - sz / 2, sz, sz); ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
    });
    return () => { stop(); pt.destroy(); rumble.stop(); buzz.stop(); rainS.stop(); pad.stop(); cv.destroy(); };
  },
};
