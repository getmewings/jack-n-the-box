// Day one. A seed falls into dark earth. Your finger is the sun, and the tree grows toward it.
// Spring blossoms. Autumn wind from your hand strips the leaves. Winter snow. Then one seed drops into your palm.
import { audio, haptic, makeCanvas, loop, pointers, rnd, TAU, lerp, clamp, glowSprite } from '../engine.js';

const SKY = { // [top, mid, horizon] per season, hex
  night: ['#05060f', '#0b0e22', '#1a1430'], dawn: ['#1b1838', '#5a3a63', '#d9875e'], spring: ['#7fb2e6', '#c7dcf0', '#f2e3d2'],
  summer: ['#2f7ad6', '#8fc1ee', '#e9f0e3'], autumn: ['#3b3f6b', '#b56f5a', '#f0b87a'], winter: ['#6c7690', '#a9b2c3', '#e2e6ee'], end: ['#0a0c1a', '#161a30', '#2a2238'],
};
const hex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = c => `rgb(${c.map(v => Math.round(v)).join(',')})`;

export default {
  name: 'seed',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion(); let neutral = null, tiltX = 0;
    const W0 = cv.W, H0 = cv.H, ground = H0 * 0.86, baseX = W0 / 2;
    const sun = glowSprite(256, '255,214,150'), petalS = glowSprite(32, '255,200,215'), snowS = glowSprite(24, '255,255,255'), seedS = glowSprite(48, '255,240,200');
    let T = 0, phase = 'fall', pT = 0, finger = null, sunX = W0 / 2, sunY = H0 * 0.25, sunA = 0, seed = { x: baseX, y: -20, vy: 0 }, grown = 0, season = 0, ended = false;
    const branches = [], leaves = [], flyers = [], snow = [], stars = Array.from({ length: 90 }, () => ({ x: rnd(W0), y: rnd(H0 * 0.6), a: rnd(0.3, 1), s: rnd(1, 2) }));
    const hills = [0.79, 0.83, 0.86].map((h, i) => ({ h, f1: rnd(1.5, 2.5), f2: rnd(4, 7), ph: rnd(TAU), amp: 0.025 - i * 0.005, tone: i }));
    const pad = audio.pad([65.4, 98, 130.8, 196, 261.6], { gain: 0, type: 'sine' });
    const wind = audio.noiseLoop({ type: 'bandpass', freq: 500, q: 0.7, gain: 0 });
    let gust = 0, swipe = 0, lastChime = 0, lastCreak = 0, finalSeed = null;
    const pt = pointers(root, {
      down(p) { finger = p; }, move(p) { finger = p; swipe = Math.max(swipe, clamp(Math.hypot(p.x - p.px, p.y - p.py) / 30, 0, 1)); }, up() { finger = null; },
    });
    // ---- tree ----
    function addBranch(parent, x, y, ang, len, depth) { const b = { parent, x0: x, y0: y, ang, len, depth, p: 0, w0: 20 * Math.pow(0.66, depth) * (W0 / 400), w1: 20 * Math.pow(0.66, depth + 1) * (W0 / 400) * 0.8, kids: false, sway: rnd(TAU) }; branches.push(b); return b; }
    function tip(b, p = b.p) { const a = b.ang + bend(b); return [b.x0 + Math.cos(a) * b.len * p, b.y0 + Math.sin(a) * b.len * p]; }
    function bend(b) { const k = b.depth * 0.012 + 0.004; return Math.sin(T * 1.1 + b.sway) * k * (1 + gust * 6) + tiltX * k * 8 + gust * k * 10; }
    function grow(dt) {
      const toSun = Math.atan2(sunY - ground, sunX - baseX);
      for (const b of [...branches]) {
        if (b.p < 1) { b.p = Math.min(1, b.p + dt / (b.depth === 0 ? 1.6 : 0.9 + b.depth * 0.1)); if (b.p > 0.55 && !b.kids && b.depth < 7) { b.kids = true; spawn(b, toSun); } }
      }
    }
    function spawn(b, toSun) {
      const [x, y] = [b.x0 + Math.cos(b.ang) * b.len, b.y0 + Math.sin(b.ang) * b.len];
      const n = b.depth < 2 ? 2 : (Math.random() < 0.3 ? 3 : 2);
      for (let i = 0; i < n; i++) {
        let a = b.ang + (i - (n - 1) / 2) * rnd(0.5, 0.95) + rnd(-0.15, 0.15);
        const ts = Math.atan2(sunY - y, sunX - x); let d = ts - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; a += d * 0.22; // reach for the light
        a = lerp(a, -Math.PI / 2, 0.08); // and up
        const nb = addBranch(b, x, y, a, b.len * rnd(0.66, 0.78), b.depth + 1);
        if (nb.depth >= 3) { const cnt = 2 + Math.floor(rnd(3)); for (let k = 0; k < cnt; k++) leaves.push({ b: nb, t: rnd(0.3, 1), side: Math.random() < 0.5 ? -1 : 1, size: rnd(5, 9) * (W0 / 400), ph: rnd(TAU), bloom: 0, hue: rnd(335, 355), fallen: false, leaf: 0 }); }
      }
      if (T - lastCreak > 0.25) { lastCreak = T; audio.noise({ dur: 0.12, gain: 0.05, type: 'bandpass', freq: 300 + b.depth * 120, q: 4 }); if (b.depth < 3) haptic(5); }
    }
    function drawTree(c, snowy) {
      for (const b of branches) {
        if (b.p <= 0) continue; const [x1, y1] = tip(b); const a = Math.atan2(y1 - b.y0, x1 - b.x0), nx = -Math.sin(a), ny = Math.cos(a);
        const w0 = b.w0 * Math.min(1, grown * 2), w1 = b.w1 * b.p * Math.min(1, grown * 2);
        c.fillStyle = '#120c0f'; if (b.depth > 0) { c.beginPath(); c.arc(b.x0, b.y0, w0, 0, TAU); c.fill(); } c.beginPath(); c.moveTo(b.x0 + nx * w0, b.y0 + ny * w0); c.lineTo(x1 + nx * w1, y1 + ny * w1); c.lineTo(x1 - nx * w1, y1 - ny * w1); c.lineTo(b.x0 - nx * w0, b.y0 - ny * w0); c.closePath(); c.fill();
        if (snowy > 0 && b.depth > 0) { c.strokeStyle = `rgba(255,255,255,${0.75 * snowy})`; c.lineWidth = Math.max(0.8, w0 * 0.35); c.lineCap = 'round'; c.beginPath(); c.moveTo(b.x0 + nx * w0 * 0.3, b.y0 - w0 * 0.3); c.lineTo(x1, y1 - w1 * 0.3); c.stroke(); }
      }
    }
    // ---- seasons timeline (seconds in 'grow' phase) ----
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; T += dt; pT += dt; swipe *= 0.92;
      if (mo.ok) { const tl = mo.tilt(); if (!neutral) neutral = tl; tiltX = lerp(tiltX, clamp(tl.x - neutral.x, -1, 1), 0.05); }
      // the sun: your finger, or on its own arc
      if (finger) { sunX = lerp(sunX, finger.x, 0.12); sunY = lerp(sunY, finger.y, 0.12); } else { sunA += dt * 0.12; sunX = lerp(sunX, W / 2 + Math.cos(sunA) * W * 0.4, 0.03); sunY = lerp(sunY, H * 0.22 + Math.sin(sunA * 0.7) * H * 0.06, 0.03); }
      // phases
      if (phase === 'fall') { seed.vy += 160 * dt; seed.y += seed.vy * dt; if (seed.y >= ground - 4) { seed.y = ground - 4; phase = 'wait'; pT = 0; audio.pluck(55, { gain: 0.25, dur: 2 }); haptic(20); } }
      if (phase === 'wait' && (pT > 1.2)) { phase = 'grow'; pT = 0; addBranch(null, baseX, ground, -Math.PI / 2 + rnd(-0.05, 0.05), H * 0.19, 0); pad.gain.setTargetAtTime(0.06, audio.now(), 2); }
      let sky = SKY.night, skyB = SKY.night, mixT = 0, snowy = 0, sunAlpha = 0;
      if (phase === 'grow') {
        grown = Math.min(1, pT / 7);
        if (pT < 7) { grow(dt); season = 0; sky = SKY.night; skyB = SKY.dawn; mixT = clamp(pT / 5, 0, 1); sunAlpha = clamp(pT / 2, 0, 1); }
        else if (pT < 9.5) { season = 1; sky = SKY.dawn; skyB = SKY.spring; mixT = (pT - 7) / 2.5; sunAlpha = 1; }                     // spring: blossoms
        else if (pT < 13) { season = 2; sky = SKY.spring; skyB = SKY.summer; mixT = clamp((pT - 9.5) / 2, 0, 1); sunAlpha = 1; }       // summer: leaves
        else if (pT < 18) { season = 3; sky = SKY.summer; skyB = SKY.autumn; mixT = clamp((pT - 13) / 2, 0, 1); sunAlpha = 0.9; }      // autumn: wind
        else if (pT < 23) { season = 4; sky = SKY.autumn; skyB = SKY.winter; mixT = clamp((pT - 18) / 2, 0, 1); snowy = clamp((pT - 19) / 3, 0, 1); sunAlpha = 0.5; } // winter: snow
        else { season = 5; sky = SKY.winter; skyB = SKY.end; mixT = clamp((pT - 23) / 2, 0, 1); snowy = 1; sunAlpha = 0.3 * (1 - mixT); }
        if (pT >= 7 && pT < 7 + dt) { [72, 76, 79, 84, 88].forEach((m, i) => audio.pluck(m, { t: i * 0.1, gain: 0.12, dur: 2.5 })); haptic([10, 40, 10, 40, 10]); }
        if (pT >= 13 && pT < 13 + dt) { wind.gain.setTargetAtTime(0.05, audio.now(), 1); [67, 64, 60].forEach((m, i) => audio.pluck(m, { t: i * 0.2, gain: 0.1, dur: 3 })); }
        if (pT >= 18 && pT < 18 + dt) { wind.gain.setTargetAtTime(0.02, audio.now(), 2); audio.pad([130.8, 164.8], { gain: 0.03 }); }
        if (pT >= 23 && pT < 23 + dt) { // the last seed lets go of the highest branch
          let top = branches[0]; for (const b of branches) { const [, y] = tip(b); if (y < tip(top)[1]) top = b; } const [x, y] = tip(top); finalSeed = { x, y, vx: 0, vy: 0, landed: false }; audio.pluck(84, { gain: 0.18, dur: 2 }); haptic(10); wind.gain.setTargetAtTime(0, audio.now(), 1);
        }
        if (pT > 29 && !ended) { ended = true; api.done(); }
      }
      gust = lerp(gust, season === 3 ? 0.35 + swipe * 1.2 + Math.abs(tiltX) * 0.8 + 0.25 * Math.sin(T * 0.7) : swipe * 0.4, 0.05);
      if (season === 3) wind.gain.setTargetAtTime(0.03 + gust * 0.12, audio.now(), 0.2);
      // ---- sky ----
      const c0 = mix(hex(sky[0]), hex(skyB[0]), mixT), c1 = mix(hex(sky[1]), hex(skyB[1]), mixT), c2 = mix(hex(sky[2]), hex(skyB[2]), mixT);
      const g = ctx.createLinearGradient(0, 0, 0, ground); g.addColorStop(0, rgb(c0)); g.addColorStop(0.6, rgb(c1)); g.addColorStop(1, rgb(c2)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const night = phase !== 'grow' ? 1 : season === 0 ? 1 - mixT : season === 5 ? mixT : 0;
      if (night > 0) { ctx.fillStyle = '#fff'; for (const s of stars) { ctx.globalAlpha = s.a * night * (0.6 + 0.4 * Math.sin(t * 2 + s.x)); ctx.fillRect(s.x, s.y, s.s, s.s); } ctx.globalAlpha = 1; }
      // sun
      if (sunAlpha > 0) { const r = W * 0.9; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * sunAlpha; ctx.drawImage(sun, sunX - r / 2, sunY - r / 2, r, r); ctx.globalAlpha = 0.9 * sunAlpha; ctx.drawImage(sun, sunX - 70, sunY - 70, 140, 140); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(255,250,235,${0.95 * sunAlpha})`; ctx.beginPath(); ctx.arc(sunX, sunY, 14, 0, TAU); ctx.fill(); }
      // hills and ground
      hills.forEach((hl, i) => { const sh = mix(mix(c2, [0, 0, 0], 0.55 + i * 0.12), [255, 255, 255], snowy * 0.6); ctx.fillStyle = rgb(sh); ctx.beginPath(); ctx.moveTo(0, H); for (let k = 0; k <= 40; k++) { const u = k / 40; ctx.lineTo(u * W, H * (hl.h + Math.sin(u * hl.f1 * Math.PI + hl.ph) * hl.amp + Math.sin(u * hl.f2 * Math.PI + hl.ph * 2) * hl.amp * 0.3)); } ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = snowy > 0 ? rgb(mix([18, 12, 15], [225, 228, 236], snowy)) : '#120c0f'; ctx.fillRect(0, ground, W, H - ground);
      // tree
      drawTree(ctx, snowy);
      // leaves and blossoms
      ctx.globalCompositeOperation = 'source-over';
      for (const l of leaves) {
        if (l.fallen) continue; const b = l.b; if (b.p < l.t) continue;
        const [x, y] = tip(b, l.t); const a = Math.atan2(y - b.y0, x - b.x0) + l.side * 1.1 + Math.sin(T * 2 + l.ph) * 0.1 * (1 + gust * 4);
        if (season >= 1) l.bloom = Math.min(1, l.bloom + dt * rnd(0.8, 1.6)); if (season >= 2) l.leaf = Math.min(1, l.leaf + dt * 0.8);
        if (l.bloom <= 0) continue;
        const px = x + Math.cos(a) * l.size * 1.2, py = y + Math.sin(a) * l.size * 1.2;
        if (season === 1 && l.bloom > 0.05 && l.bloom < 0.05 + dt * 2 && T - lastChime > 0.05) { lastChime = T; audio.pluck(84 + [0, 2, 4, 7, 9][Math.floor(rnd(5))] + 12 * Math.floor(rnd(2)), { gain: 0.04, dur: 1.2 }); }
        let col;
        if (season <= 1 || l.leaf < 1) { const k = l.leaf; col = mix([255, 205, 220], [70, 150, 70], k); if (season === 1) { ctx.globalAlpha = 0.5 * l.bloom; ctx.drawImage(petalS, px - l.size * 1.5, py - l.size * 1.5, l.size * 3, l.size * 3); ctx.globalAlpha = 1; } }
        else col = [70, 150, 70];
        if (season >= 3) { const k = clamp((pT - 13) / 2.5, 0, 1) * (0.5 + 0.5 * Math.sin(l.ph)); col = mix(col, [l.hue > 345 ? 220 : 240, l.hue > 345 ? 70 : 150, 30], clamp(k * 1.5, 0, 1)); if (season === 3 && Math.random() < (0.002 + gust * 0.04) * clamp((pT - 14) / 2, 0, 1)) { l.fallen = true; flyers.push({ x: px, y: py, vx: rnd(-20, 20), vy: rnd(0, 20), rot: a, vr: rnd(-6, 6), col, size: l.size, ph: l.ph, life: 1 }); continue; } }
        if (season >= 4) { if (Math.random() < 0.02) { l.fallen = true; continue; } }
        ctx.fillStyle = rgb(col); ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.scale(l.bloom, l.bloom); ctx.beginPath(); ctx.ellipse(0, 0, l.size, l.size * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
      // leaves in the wind
      for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i]; f.vx += (gust * 500 + tiltX * 300 + Math.sin(T * 3 + f.ph) * 120) * dt; f.vy += (90 + Math.cos(T * 2.3 + f.ph) * 150 - gust * 120) * dt; f.vx *= 0.985; f.vy *= 0.985; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; if (f.y > ground + 10 || f.x > W + 40 || f.x < -40) { flyers.splice(i, 1); continue; } ctx.fillStyle = rgb(f.col); ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.beginPath(); ctx.ellipse(0, 0, f.size, f.size * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore(); }
      // snow
      if (snowy > 0) { if (snow.length < 260 && Math.random() < snowy) snow.push({ x: rnd(-20, W + 20), y: -10, v: rnd(30, 80), s: rnd(1.5, 4), ph: rnd(TAU) }); ctx.globalCompositeOperation = 'lighter'; for (let i = snow.length - 1; i >= 0; i--) { const s = snow[i]; s.y += s.v * dt; s.x += Math.sin(T * 1.5 + s.ph) * 20 * dt + tiltX * 40 * dt; if (s.y > ground) { snow.splice(i, 1); continue; } ctx.globalAlpha = 0.8; ctx.drawImage(snowS, s.x - s.s * 2, s.y - s.s * 2, s.s * 4, s.s * 4); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      // the seed (first and last)
      if (phase === 'fall' || phase === 'wait') { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(seedS, seed.x - 20, seed.y - 20, 40, 40); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#f7e9c8'; ctx.beginPath(); ctx.ellipse(seed.x, seed.y, 4, 6, 0.3, 0, TAU); ctx.fill(); }
      if (finalSeed) {
        const s = finalSeed;
        if (!s.landed) { if (finger) { const dx = finger.x - s.x, dy = finger.y - s.y, d = Math.hypot(dx, dy) + 1; s.vx += dx / d * 120 * dt; s.vy += dy / d * 120 * dt; if (d < 14) { s.landed = true; s.x = finger.x; s.y = finger.y; [72, 79, 84, 91].forEach((m, i) => audio.pluck(m, { t: i * 0.12, gain: 0.16, dur: 3 })); haptic([30, 30, 30]); } } else { s.vy += 25 * dt; s.vx += Math.sin(T * 2) * 30 * dt; } s.vx *= 0.98; s.vy *= 0.98; s.x += s.vx * dt; s.y += s.vy * dt; if (s.y > ground - 4) { s.y = ground - 4; s.landed = true; [72, 79, 84].forEach((m, i) => audio.pluck(m, { t: i * 0.12, gain: 0.16, dur: 3 })); haptic(20); } }
        else if (finger) { s.x = lerp(s.x, finger.x, 0.3); s.y = lerp(s.y, finger.y, 0.3); }
        ctx.globalCompositeOperation = 'lighter'; const gl = 30 + (s.landed ? 20 * Math.sin(T * 3) + 20 : 0); ctx.drawImage(seedS, s.x - gl / 2, s.y - gl / 2, gl, gl); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#f7e9c8'; ctx.beginPath(); ctx.ellipse(s.x, s.y, 4, 6, 0.3, 0, TAU); ctx.fill();
      }
      // finger glow when it's the sun
      if (finger && phase === 'grow' && season < 4) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; ctx.drawImage(sun, finger.x - 60, finger.y - 60, 120, 120); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    });
    return () => { stop(); pt.destroy(); pad.stop(); wind.stop(); cv.destroy(); };
  },
};
