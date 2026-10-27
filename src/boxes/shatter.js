// Day: a calm breathing orb. Tap it. The glass breaks. Tilt and the pieces fall into a sky behind the screen.
import { audio, haptic, makeCanvas, loop, pointers, flash, shake, rnd, TAU, lerp, glowSprite } from '../engine.js';

export default {
  name: 'shatter',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion();
    let phase = 0, t0 = 0, crackT = 0, fallT = 0;
    const off = document.createElement('canvas'), octx = off.getContext('2d');
    let shards = [], cracks = [];
    const stars = Array.from({ length: 700 }, () => ({ x: rnd(-1, 1), y: rnd(-1, 1), z: rnd(0.05, 1), h: rnd(200, 320) }));
    const sprite = glowSprite(64);
    const pad = audio.pad([110, 164.8, 220, 329.6], { gain: 0.0 });
    let drag = null, stirX = 0, stirY = 0;
    const neutral = mo.tilt();

    const motes = Array.from({ length: 46 }, () => ({ a: rnd(TAU), r: rnd(1.25, 2.4), s: rnd(0.05, 0.2), z: rnd(0.4, 1), ph: rnd(TAU) }));
    const blobs = [[285, 0.9, 0.0], [330, 0.7, 2.1], [200, 0.6, 4.2], [260, 0.8, 1.0], [20, 0.35, 3.3]];
    function drawCalm(c, t) {
      const W = cv.W, H = cv.H;
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#07060f'); g.addColorStop(1, '#120b1d'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const r = Math.min(W, H) * (0.21 + 0.012 * Math.sin(t * 1.1)), cx = W / 2, cy = H * 0.45;
      // halo
      const halo = c.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 2.6); halo.addColorStop(0, 'rgba(150,90,255,.22)'); halo.addColorStop(1, 'rgba(150,90,255,0)'); c.fillStyle = halo; c.fillRect(0, 0, W, H);
      // motes in orbit
      c.globalCompositeOperation = 'lighter';
      for (const m of motes) { m.a += m.s * 0.016; const d = r * m.r, x = cx + Math.cos(m.a) * d, y = cy + Math.sin(m.a) * d * 0.55 + Math.sin(t + m.ph) * 6, al = (0.35 + 0.3 * Math.sin(t * 2 + m.ph)) * m.z, sz = 3 + m.z * 5; c.globalAlpha = al; c.drawImage(sprite, x - sz, y - sz, sz * 2, sz * 2); }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      // the glass orb: nebula inside
      c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
      c.fillStyle = '#17082a'; c.fillRect(cx - r, cy - r, r * 2, r * 2);
      c.globalCompositeOperation = 'lighter';
      for (const [h, k, ph] of blobs) { const bx = cx + Math.cos(t * 0.23 + ph) * r * 0.45, by = cy + Math.sin(t * 0.31 + ph * 1.3) * r * 0.45, br = r * (0.5 + 0.25 * Math.sin(t * 0.4 + ph)) * k; const bg = c.createRadialGradient(bx, by, 0, bx, by, br); bg.addColorStop(0, `hsla(${h},85%,62%,.75)`); bg.addColorStop(1, `hsla(${h},85%,62%,0)`); c.fillStyle = bg; c.fillRect(cx - r, cy - r, r * 2, r * 2); }
      c.globalCompositeOperation = 'source-over';
      // sphere shading, rim and specular
      const sh = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,.05)'); sh.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = sh; c.fillRect(cx - r, cy - r, r * 2, r * 2);
      const rim = c.createRadialGradient(cx, cy, r * 0.86, cx, cy, r); rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(0.8, 'rgba(200,180,255,.25)'); rim.addColorStop(1, 'rgba(255,255,255,.55)'); c.fillStyle = rim; c.fillRect(cx - r, cy - r, r * 2, r * 2);
      const hl = c.createRadialGradient(cx - r * 0.38, cy - r * 0.42, 0, cx - r * 0.38, cy - r * 0.42, r * 0.45); hl.addColorStop(0, 'rgba(255,255,255,.7)'); hl.addColorStop(0.4, 'rgba(255,255,255,.12)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = hl; c.fillRect(cx - r, cy - r, r * 2, r * 2);
      c.restore();
      // ground reflection
      const rf = c.createRadialGradient(cx, cy + r * 1.9, 0, cx, cy + r * 1.9, r * 1.4); rf.addColorStop(0, 'rgba(160,100,255,.14)'); rf.addColorStop(1, 'rgba(160,100,255,0)'); c.fillStyle = rf; c.fillRect(0, 0, W, H);
    }

    function crack(px, py) {
      const W = cv.W, H = cv.H, diag = Math.hypot(W, H);
      off.width = cv.c.width; off.height = cv.c.height; octx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); drawCalm(octx, t0);
      const K = 13, rings = [0, 18, 48, 100, 180, 300, 470, 700, 1000, diag * 1.3];
      const base = rnd(TAU), angs = Array.from({ length: K }, (_, i) => base + i * TAU / K + rnd(-0.12, 0.12));
      const V = angs.map((a, i) => { let drift = 0; return rings.map((r, j) => { drift += rnd(-0.09, 0.09); const rr = j === 0 ? 0 : r * rnd(0.72, 1.28), aa = a + (j ? drift + rnd(-0.05, 0.05) : 0); return [px + Math.cos(aa) * rr, py + Math.sin(aa) * rr]; }); });
      shards = []; cracks = [];
      for (let i = 0; i < K; i++) for (let j = 0; j < rings.length - 1; j++) {
        const i2 = (i + 1) % K;
        const poly = j === 0 ? [V[i][0], V[i][1], V[i2][1]] : [V[i][j], V[i][j + 1], V[i2][j + 1], V[i2][j]];
        const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
        if (cx < -400 || cx > W + 400 || cy < -400 || cy > H + 400) continue;
        const d = Math.hypot(cx - px, cy - py);
        shards.push({ poly, cx, cy, x: 0, y: 0, a: 0, vx: 0, vy: 0, va: 0, d, off: d < 300 ? rnd(1, 3) : rnd(0, 0.8), delay: d / diag * 0.6 + rnd(0.3), gone: false });
      }
      for (let i = 0; i < K; i++) cracks.push(V[i].slice(1));
      for (let j = 1; j < rings.length - 1; j++) for (let i = 0; i < K; i++) if (Math.random() < 0.55) cracks.push([V[i][j], V[(i + 1) % K][j]]);
    }

    const pt = pointers(root, {
      down(p) {
        if (phase === 0) { phase = 1; crackT = 0; crack(p.x, p.y); audio.glass(); haptic([60, 30, 40]); flash(0.8, 150); shake(root); }
        else if (phase === 1 && crackT > 0.5) startFall();
        else if (phase === 2) drag = p;
      },
      move(p) { if (phase === 2) drag = p; },
      up() { drag = null; },
    });
    function startFall() { phase = 2; fallT = 0; audio.thump(0, 0.6); pad.gain.setTargetAtTime(0.12, audio.now(), 2); audio.noise({ dur: 3, gain: 0.25, type: 'lowpass', freq: 120, freqTo: 40 }); haptic([20, 60, 20, 60, 120]); }

    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; t0 = t;
      if (phase === 0) { drawCalm(ctx, t); return; }
      crackT += dt;
      // behind the glass: deep sky
      ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
      if (phase >= 1) {
        const tilt = mo.tilt(); const gx = tilt.x - neutral.x, gy = tilt.y - neutral.y;
        if (phase === 1 && Math.hypot(gx, gy) > 0.35 && crackT > 0.6) startFall();
        if (phase === 1 && crackT > 4) startFall();
        const speed = phase === 2 ? Math.min(1, fallT / 2) : 0;
        stirX = lerp(stirX, drag ? (drag.x - W / 2) / W : 0, 0.05); stirY = lerp(stirY, drag ? (drag.y - H / 2) / H : 0, 0.05);
        ctx.globalCompositeOperation = 'lighter';
        for (const s of stars) {
          s.z -= dt * (0.02 + speed * 0.25 * s.z); if (s.z < 0.03) { s.z = 1; s.x = rnd(-1, 1); s.y = rnd(-1, 1); }
          const px = W / 2 + (s.x / s.z + stirX * 0.6) * W * 0.6, py = H / 2 + (s.y / s.z + stirY * 0.6) * H * 0.6;
          if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
          const sz = (1 - s.z) * 18 + 3, al = Math.min(1, (1 - s.z) * 2) * (phase >= 2 ? 1 : 0.55);
          ctx.globalAlpha = al; ctx.drawImage(sprite, px - sz / 2, py - sz / 2, sz, sz);
          if (sz > 9) { ctx.fillStyle = `hsla(${s.h},90%,80%,${al * 0.9})`; ctx.beginPath(); ctx.arc(px, py, sz * 0.12, 0, TAU); ctx.fill(); }
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        // the glass
        if (phase === 2) {
          fallT += dt; const g = 1800;
          let any = false;
          for (const s of shards) {
            if (s.gone) continue; any = true;
            if (fallT < s.delay) continue;
            if (!s.vx && !s.vy) { s.vx = rnd(-40, 40) + gx * 200; s.vy = rnd(-30, 30); s.va = rnd(-3, 3); }
            s.vx += gx * g * dt; s.vy += (gy + (Math.hypot(gx, gy) < 0.15 ? 1 : 0)) * g * dt;
            s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.va * dt;
            if (s.cy + s.y > H + 600 || s.cy + s.y < -900 || Math.abs(s.cx + s.x) > W + 900) { s.gone = true; if (Math.random() < 0.35) audio.tinkle(0, 0.05); }
          }
          if (!any) phase = 3;
        }
        for (const s of shards) {
          if (s.gone) continue;
          ctx.save(); ctx.translate(s.cx + s.x, s.cy + s.y); ctx.rotate(s.a); ctx.translate(-s.cx, -s.cy);
          const ox = (s.cx - W / 2) * 0.004 * s.off, oy = (s.cy - H / 2) * 0.004 * s.off; ctx.translate(ox, oy);
          ctx.beginPath(); s.poly.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip();
          ctx.drawImage(off, 0, 0, W, H);
          // glint
          ctx.fillStyle = `rgba(255,255,255,${0.04 + 0.1 * Math.abs(Math.sin(s.a + s.d * 0.01 + t * 2))})`; ctx.fill();
          ctx.restore();
        }
        if (phase === 1) {
          ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineJoin = 'round';
          const grow = Math.min(1, crackT * 5);
          for (const c of cracks) { ctx.beginPath(); const n = Math.max(2, Math.ceil(c.length * grow)); for (let i = 0; i < n; i++) i ? ctx.lineTo(c[i][0], c[i][1]) : ctx.moveTo(c[i][0], c[i][1]); ctx.stroke(); }
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.08)'; for (const c of cracks.slice(0, 13)) { ctx.beginPath(); c.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }
        }
      }
    });
    return () => { stop(); pt.destroy(); pad.stop(); cv.destroy(); };
  },
};
