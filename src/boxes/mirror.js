// Day six. Your face arrives as a few thousand beads. Tilt and you pour away. Then a whirlpool takes you, rebuilds you in gold, and the wind carries you off.
import { audio, haptic, camera, ask, GLYPH, makeCanvas, loop, pointers, rnd, TAU, lerp, clamp } from '../engine.js';

export default {
  name: 'mirror',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion();
    const cam = await ask(root, GLYPH.cam, () => camera('user'));
    const COLS = 52, ROWS = Math.round(COLS * cv.H / cv.W), cell = cv.W / COLS;
    const smp = document.createElement('canvas'); smp.width = COLS; smp.height = ROWS; const sx = smp.getContext('2d', { willReadFrequently: true });
    const P = [];
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) P.push({ hx: i * cell + cell / 2, hy: j * cell + cell / 2, x: rnd(cv.W), y: -rnd(0, cv.H * 2), vx: 0, vy: 0, r: 0, g: 0, b: 0, far: 0, ph: rnd(TAU) });
    let neutral = mo.tilt(), gx = 0, gy = 0, fingers = new Map(), T = 0, phase = 0, pT = 0, gold = 0, blow = 0, ended = false, hue = api.rng() * 360;
    const shimmer = audio.noiseLoop({ type: 'bandpass', freq: 2500, q: 1.5, gain: 0 });
    const pad = audio.pad([110, 164.8, 220, 277.2], { gain: 0, type: 'sine' });
    const pt = pointers(root, { down(p) { fingers.set(p.id, p); audio.noise({ dur: 0.25, gain: 0.3, type: 'bandpass', freq: 1200, q: 1 }); haptic(6); }, move(p) { fingers.set(p.id, p); }, up(p) { fingers.delete(p.id); } });
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; T += dt; pT += dt;
      if (phase === 0 && pT < 1.5) neutral = mo.tilt();
      // timeline: 0 arrive, 1 play, 2 whirlpool, 3 gold return, 4 blown away
      if (phase === 0 && pT > 4) { phase = 1; pT = 0; }
      if (phase === 1 && pT > 10) { phase = 2; pT = 0; audio.noise({ dur: 4, gain: 0.2, type: 'bandpass', freq: 300, freqTo: 1500, q: 0.7 }); haptic([10, 40, 10, 40, 10, 40]); }
      if (phase === 2 && pT > 4.5) { phase = 3; pT = 0; pad.gain.setTargetAtTime(0.07, audio.now(), 1); [57, 64, 69, 76, 81].forEach((m, i) => audio.pluck(m, { t: i * 0.1, gain: 0.14, dur: 2.5 })); haptic([30, 20, 60]); }
      if (phase === 3 && pT > 4.5) { phase = 4; pT = 0; audio.noise({ dur: 4, gain: 0.3, type: 'bandpass', freq: 500, freqTo: 2500, q: 0.5 }); }
      if (phase === 4 && pT > 3.5 && !ended) { ended = true; api.done(); }
      gold = phase === 3 ? clamp(1 - pT / 4.5, 0, 1) : 0; blow = phase === 4 ? Math.min(1, pT / 2) : 0;
      if (cam) { const v = cam.video, vw = v.videoWidth || 640, vh = v.videoHeight || 480, sc = Math.max(COLS / vw, ROWS / vh), dw = vw * sc, dh = vh * sc; sx.save(); sx.translate(COLS, 0); sx.scale(-1, 1); sx.drawImage(v, (COLS - dw) / 2, (ROWS - dh) / 2, dw, dh); sx.restore(); }
      else { for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) { sx.fillStyle = `hsl(${hue + Math.sin(i * 0.2 + t) * 40 + Math.cos(j * 0.15 - t * 0.7) * 40},70%,${45 + 20 * Math.sin((i + j) * 0.3 + t * 1.3)}%)`; sx.fillRect(i, j, 1, 1); } }
      const d = sx.getImageData(0, 0, COLS, ROWS).data;
      const tl = mo.tilt(); gx = lerp(gx, tl.x - neutral.x, 0.1); gy = lerp(gy, tl.y - neutral.y, 0.1);
      const gm = Math.hypot(gx, gy), level = gm < 0.12 || phase !== 1;
      const G = 2600, k = phase === 0 ? 12 : phase === 3 ? 60 : level ? 40 : 6, damp = phase === 0 ? 0.95 : level ? 0.86 : 0.985;
      ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
      const F = [...fingers.values()]; let speed = 0;
      for (let n = 0; n < P.length; n++) {
        const p = P[n], o = n * 4; p.r = d[o]; p.g = d[o + 1]; p.b = d[o + 2];
        let ax = 0, ay = 0;
        if (phase === 2) { const dx = p.x - W / 2, dy = p.y - H / 2, dist = Math.hypot(dx, dy) + 1, pull = Math.min(1, pT / 2); ax = (-dx / dist * 900 - dy / dist * 1400) * pull; ay = (-dy / dist * 900 + dx / dist * 1400) * pull; if (dist < 40) { ax += dx / dist * 3000; ay += dy / dist * 3000; } }
        else if (phase === 4) { ax = 1200 * blow + Math.sin(p.ph + t * 3) * 400; ay = -500 * blow + Math.cos(p.ph * 2 + t * 2) * 300; }
        else { ax = (p.hx - p.x) * k; ay = (p.hy - p.y) * k; if (!level) { ax += gx * G; ay += gy * G; } if (phase === 0) ay += 600; }
        for (const f of F) { const dx = p.x - f.x, dy = p.y - f.y, dd = dx * dx + dy * dy; if (dd < 120 * 120) { const dist = Math.sqrt(dd) + 1, fo = (120 - dist) / 120 * 9000; ax += dx / dist * fo; ay += dy / dist * fo; } }
        p.vx = (p.vx + ax * dt) * (phase === 2 || phase === 4 ? 0.97 : damp); p.vy = (p.vy + ay * dt) * (phase === 2 || phase === 4 ? 0.97 : damp);
        p.x += p.vx * dt; p.y += p.vy * dt;
        const rr = cell * 0.45;
        if (phase !== 4) { if (p.x < rr) { p.x = rr; p.vx = -p.vx * 0.4; } else if (p.x > W - rr) { p.x = W - rr; p.vx = -p.vx * 0.4; } if (p.y < rr && phase !== 0) { p.y = rr; p.vy = -p.vy * 0.4; } else if (p.y > H - rr) { p.y = H - rr; p.vy = -p.vy * 0.4; p.vx *= 0.9; } }
        if (phase === 4 && (p.x > W + 40 || p.y < -40)) continue;
        speed += Math.abs(p.vx) + Math.abs(p.vy);
        const far = Math.hypot(p.x - p.hx, p.y - p.hy); p.far = far;
        const sz = cell * (far < 2 ? 0.95 : clamp(0.9 - far * 0.0012, 0.55, 0.9)), bright = far > 4 ? 1.25 : 1;
        let r = Math.min(255, p.r * bright), g = Math.min(255, p.g * bright), b = Math.min(255, p.b * bright);
        if (gold > 0) { const l = (r + g + b) / 3; r = lerp(r, l * 1.3 + 40, gold); g = lerp(g, l * 1.0 + 20, gold); b = lerp(b, l * 0.4, gold); }
        if (phase === 4) { const a = 1 - blow * 0.7; r *= a; g *= a; b *= a; }
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        if (far < 2) ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz); else { ctx.beginPath(); ctx.arc(p.x, p.y, sz / 2, 0, TAU); ctx.fill(); }
      }
      speed /= P.length;
      shimmer.gain.setTargetAtTime(clamp(speed / 400, 0, 0.3), audio.now(), 0.05); shimmer.filter.frequency.setTargetAtTime(1500 + clamp(speed, 0, 800) * 4, audio.now(), 0.05);
      if (speed > 60 && Math.random() < 0.3) haptic(3);
    });
    return () => { stop(); pt.destroy(); cam && cam.stop(); shimmer.stop(); pad.stop(); cv.destroy(); };
  },
};
