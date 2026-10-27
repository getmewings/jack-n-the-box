// Day one. A single drop falls into black. It blooms into living ink that answers your fingers. Then a whirlpool takes it all back.
import { audio, haptic, loop, pointers, rnd, TAU, lerp, clamp } from '../engine.js';
import { createGL, createFluid } from '../gl.js';

const PALETTE = [[0.1, 0.9, 1.4], [1.3, 0.25, 0.9], [1.4, 0.8, 0.15], [0.2, 1.3, 0.7], [0.9, 0.4, 1.5], [1.5, 0.5, 0.3]];

export default {
  name: 'ink',
  async mount(root, api) {
    const c = document.createElement('canvas'); c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none'; root.appendChild(c);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const size = () => { c.width = Math.round(root.clientWidth * dpr); c.height = Math.round(root.clientHeight * dpr); }; size(); window.addEventListener('resize', size);
    const G = createGL(c); if (!G) { root.removeChild(c); return () => {}; }
    const fluid = createFluid(G, { simRes: 144, dyeRes: 640 });
    const mo = await api.motion(); let neutral = null;
    const pad = audio.pad([55, 82.4, 110, 164.8, 220], { gain: 0, type: 'sine' });
    const wash = audio.noiseLoop({ type: 'bandpass', freq: 1200, q: 0.8, gain: 0 });
    let T = 0, phase = 'dark', pT = 0, fade = 1, ended = false, dropY = 0, colorT = 0, lastBreath = 0, speed = 0, lastHap = 0;
    const fingers = new Map();
    const col = (k, gain = 1) => { const i = Math.floor(k) % PALETTE.length, j = (i + 1) % PALETTE.length, f = k - Math.floor(k); return PALETTE[i].map((v, n) => (v + (PALETTE[j][n] - v) * f) * gain); };
    const pt = pointers(root, {
      down(p) { if (phase === 'dark' || phase === 'drop') return; fingers.set(p.id, { k: colorT + fingers.size * 1.7, x: p.x, y: p.y }); fluid.splat(p.x / root.clientWidth, 1 - p.y / root.clientHeight, 0, 0, col(colorT + fingers.size * 1.7, 0.6), 1.6); audio.noise({ dur: 0.3, gain: 0.12, type: 'bandpass', freq: 600 + rnd(600), q: 1.2 }); haptic(6); },
      move(p) { const f = fingers.get(p.id); if (!f) return; const dx = (p.x - p.px) / root.clientWidth, dy = -(p.y - p.py) / root.clientHeight; fluid.splat(p.x / root.clientWidth, 1 - p.y / root.clientHeight, dx * 900, dy * 900, col(f.k, 0.35), 0.9); speed = Math.min(1, speed + Math.hypot(dx, dy) * 6); },
      up(p) { fingers.delete(p.id); },
    });
    const stop = loop((dt, t) => {
      T += dt; pT += dt; colorT += dt * 0.12; speed *= 0.9;
      const W = root.clientWidth, H = root.clientHeight;
      if (mo.ok) { const tl = mo.tilt(); if (!neutral) neutral = tl; fluid.setGravity((tl.x - neutral.x) * 140, -(tl.y - neutral.y) * 140); }
      // ---- choreography ----
      if (phase === 'dark' && pT > 1.4) { phase = 'drop'; pT = 0; dropY = 1.02; audio.tone(1800, { dur: 1.3, gain: 0.05, to: 400 }); }
      if (phase === 'drop') {
        const y0 = dropY; dropY = 1.02 - (pT * pT) * 0.55; // accelerating fall
        if (dropY > 0.5) { fluid.splat(0.5, dropY, 0, -(y0 - dropY) * 2500, [0.8, 0.75, 0.6], 0.2); }
        else { phase = 'bloom'; pT = 0; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, s = 1 + rnd(0.5); fluid.splat(0.5 + Math.cos(a) * 0.01, 0.5 + Math.sin(a) * 0.01, Math.cos(a) * 1400 * s, Math.sin(a) * 1400 * s, col(i * 0.9, 0.5), 1.5); } fluid.splat(0.5, 0.5, 0, 0, [1.4, 1.3, 1.1], 3);
          audio.thump(0, 0.9); audio.noise({ dur: 2.5, gain: 0.35, type: 'lowpass', freq: 2000, freqTo: 120 }); [48, 55, 62, 67, 74].forEach((m, i) => audio.pluck(m, { t: 0.1 + i * 0.06, gain: 0.14, dur: 4 })); pad.gain.setTargetAtTime(0.06, audio.now(), 2); haptic([60, 30, 120]); }
      }
      if (phase === 'bloom' && pT > 1.8) { phase = 'play'; pT = 0; }
      if (phase === 'play') {
        // the ink keeps breathing on its own: slow waves from the edges
        if (T - lastBreath > 2.4) { lastBreath = T; const side = Math.floor(rnd(4)); const x = side === 0 ? 0.02 : side === 1 ? 0.98 : rnd(0.2, 0.8), y = side === 2 ? 0.02 : side === 3 ? 0.98 : rnd(0.2, 0.8); const vx = (0.5 - x) * 1200, vy = (0.5 - y) * 1200; fluid.splat(x, y, vx, vy, col(colorT + rnd(3), 0.45), 2.2); audio.noise({ dur: 1.2, gain: 0.06, type: 'bandpass', freq: 300 + rnd(500), q: 1.5 }); }
        if (pT > 11.5) { phase = 'vortex'; pT = 0; audio.noise({ dur: 7, gain: 0.25, type: 'bandpass', freq: 200, freqTo: 2400, q: 1.2 }); audio.tone(40, { dur: 7, gain: 0.3, to: 110 }); haptic([10, 80, 10, 80, 10, 80, 20]); }
      }
      if (phase === 'vortex') {
        const k = Math.min(1, pT / 6), r = lerp(0.42, 0.06, k * k), n = 6;
        for (let i = 0; i < n; i++) { const a = i / n * TAU + pT * (1.5 + k * 4); const x = 0.5 + Math.cos(a) * r * (W > H ? H / W : 1), y = 0.5 + Math.sin(a) * r * (W > H ? 1 : W / H); const tx = -Math.sin(a), ty = Math.cos(a); fluid.splat(x, y, (tx * 700 - Math.cos(a) * 420) * (0.5 + k), (ty * 700 - Math.sin(a) * 420) * (0.5 + k), [0.05, 0.05, 0.07], 0.5); }
        fluid.cfg.densityDissipation = 0.9 + k * 1.2; fluid.cfg.curl = 24 + k * 10;
        wash.gain.setTargetAtTime(0.1 * k, audio.now(), 0.2); wash.filter.frequency.setTargetAtTime(800 + k * 3000, audio.now(), 0.2);
        if (pT > 6.5) { phase = 'collapse'; pT = 0; fluid.cfg.densityDissipation = 5; fluid.cfg.velocityDissipation = 4; fluid.splat(0.5, 0.5, 0, 0, [2.5, 2.4, 2.2], 1.2); audio.noise({ dur: 0.4, gain: 0.5, type: 'highpass', freq: 2000 }); audio.tone(60, { dur: 1.5, gain: 0.6, to: 30 }); haptic([120, 40, 60]); wash.gain.setTargetAtTime(0, audio.now(), 0.3); pad.gain.setTargetAtTime(0, audio.now(), 1.5); }
      }
      if (phase === 'collapse') {
        if (pT < 1.2) fluid.splat(0.5, 0.5, 0, 0, [0.25, 0.24, 0.22].map(v => v * (1 - pT / 1.2)), 0.25);
        if (pT > 1.4 && pT < 1.5) { fluid.splat(0.5, 0.5, 0, 0, [3, 3, 3], 0.12); audio.pluck(96, { gain: 0.25, dur: 2.5 }); audio.pluck(108, { gain: 0.1, dur: 2 }); haptic(25); }
        fade = clamp(1 - (pT - 2.2) / 1.2, 0, 1);
        if (pT > 3.6 && !ended) { ended = true; api.done(); }
      }
      // touch feedback sounds
      wash.gain.setTargetAtTime(phase === 'vortex' ? wash.gain.value : speed * 0.12, audio.now(), 0.1);
      if (speed > 0.3 && T - lastHap > 0.12) { lastHap = T; haptic(3); }
      fluid.step(Math.min(dt, 0.02));
      fluid.render(fade, T);
    });
    return () => { stop(); pt.destroy(); window.removeEventListener('resize', size); pad.stop(); wash.stop(); c.remove(); };
  },
};
