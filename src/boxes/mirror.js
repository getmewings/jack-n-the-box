// Day: your face, as a few thousand beads. Tilt the phone and you pour away. Level it and you come back.
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
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) P.push({ hx: i * cell + cell / 2, hy: j * cell + cell / 2, x: i * cell + cell / 2, y: j * cell + cell / 2, vx: 0, vy: 0, i, j, r: 0, g: 0, b: 0, far: 0 });
    let neutral = mo.tilt(), gx = 0, gy = 0, fingers = new Map(), tapT = 0, shimmer = audio.noiseLoop({ type: 'bandpass', freq: 2500, q: 1.5, gain: 0 }), hue = api.rng() * 360, calT = 0;
    const pt = pointers(root, {
      down(p) { fingers.set(p.id, p); const now = performance.now(); if (now - tapT < 300) { neutral = mo.tilt(); haptic(20); } tapT = now; audio.noise({ dur: 0.25, gain: 0.3, type: 'bandpass', freq: 1200, q: 1 }); },
      move(p) { fingers.set(p.id, p); }, up(p) { fingers.delete(p.id); },
    });
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; calT += dt;
      if (calT < 1.5) neutral = mo.tilt(); // settle neutral pose while the picture appears
      // sample camera (mirrored, cover-fit)
      if (cam) {
        const v = cam.video, vw = v.videoWidth || 640, vh = v.videoHeight || 480, sc = Math.max(COLS / vw, ROWS / vh), dw = vw * sc, dh = vh * sc;
        sx.save(); sx.translate(COLS, 0); sx.scale(-1, 1); sx.drawImage(v, (COLS - dw) / 2, (ROWS - dh) / 2, dw, dh); sx.restore();
      } else { // no camera: a drifting colour field
        for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) { sx.fillStyle = `hsl(${hue + Math.sin(i * 0.2 + t) * 40 + Math.cos(j * 0.15 - t * 0.7) * 40},70%,${45 + 20 * Math.sin((i + j) * 0.3 + t * 1.3)}%)`; sx.fillRect(i, j, 1, 1); }
      }
      const d = sx.getImageData(0, 0, COLS, ROWS).data;
      const tl = mo.tilt(); gx = lerp(gx, tl.x - neutral.x, 0.1); gy = lerp(gy, tl.y - neutral.y, 0.1);
      const gm = Math.hypot(gx, gy), level = gm < 0.12;
      const G = 2600, k = level ? 40 : 6, damp = level ? 0.86 : 0.985;
      ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
      const F = [...fingers.values()];
      let speed = 0;
      for (let n = 0; n < P.length; n++) {
        const p = P[n], o = n * 4; p.r = d[o]; p.g = d[o + 1]; p.b = d[o + 2];
        let ax = (p.hx - p.x) * k, ay = (p.hy - p.y) * k;
        if (!level) { ax += gx * G; ay += gy * G; }
        for (const f of F) { const dx = p.x - f.x, dy = p.y - f.y, dd = dx * dx + dy * dy; if (dd < 120 * 120) { const dist = Math.sqrt(dd) + 1, fo = (120 - dist) / 120 * 9000; ax += dx / dist * fo; ay += dy / dist * fo; } }
        p.vx = (p.vx + ax * dt) * damp; p.vy = (p.vy + ay * dt) * damp;
        p.x += p.vx * dt; p.y += p.vy * dt;
        // walls
        const rr = cell * 0.45;
        if (p.x < rr) { p.x = rr; p.vx = -p.vx * 0.4; } else if (p.x > W - rr) { p.x = W - rr; p.vx = -p.vx * 0.4; }
        if (p.y < rr) { p.y = rr; p.vy = -p.vy * 0.4; } else if (p.y > H - rr) { p.y = H - rr; p.vy = -p.vy * 0.4; p.vx *= 0.9; }
        speed += Math.abs(p.vx) + Math.abs(p.vy);
        const far = Math.hypot(p.x - p.hx, p.y - p.hy); p.far = far;
        const sz = cell * (far < 2 ? 0.95 : clamp(0.9 - far * 0.0012, 0.55, 0.9)), bright = far > 4 ? 1.25 : 1;
        ctx.fillStyle = `rgb(${Math.min(255, p.r * bright)},${Math.min(255, p.g * bright)},${Math.min(255, p.b * bright)})`;
        if (far < 2) ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
        else { ctx.beginPath(); ctx.arc(p.x, p.y, sz / 2, 0, TAU); ctx.fill(); }
      }
      speed /= P.length;
      shimmer.gain.setTargetAtTime(clamp(speed / 400, 0, 0.3), audio.now(), 0.05); shimmer.filter.frequency.setTargetAtTime(1500 + clamp(speed, 0, 800) * 4, audio.now(), 0.05);
      if (speed > 60 && Math.random() < 0.3) haptic(3);
    });
    return () => { stop(); pt.destroy(); cam && cam.stop(); shimmer.stop(); cv.destroy(); };
  },
};
