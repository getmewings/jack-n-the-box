// Day five. Tap, and towers rise inside a glass sphere. Then the view pulls back: the globe is sitting in your room. Shake it, and it snows on the city.
import { audio, haptic, camera, makeCanvas, loop, pointers, rnd, TAU, lerp, clamp, glowSprite } from '../engine.js';

export default {
  name: 'globe',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion(); let neutral = null, tiltX = 0, tiltY = 0;
    const W0 = cv.W, H0 = cv.H, warm = glowSprite(32, '255,220,150'), soft = glowSprite(128, '255,255,255');
    let T = 0, pT = 0, phase = 'build', cam = null, camTried = false, vid = null, vfit = null, camA = 0, pull = 0, ended = false, autoT = 1.2, lightsOut = 0, lastShake = 0, snowE = 0;
    const towers = [], snow = [], cars = [{ x: -0.5, v: 0.12, c: '255,220,150' }, { x: 1.2, v: -0.09, c: '255,90,80' }];
    const pad = audio.pad([65.4, 98, 130.8, 164.8, 196], { gain: 0, type: 'triangle' });
    const hum = audio.noiseLoop({ type: 'lowpass', freq: 200, q: 0.6, gain: 0.02 });
    function G() { const W = cv.W, H = cv.H, r = Math.min(W, H) * lerp(0.44, 0.27, pull), cx = W / 2, cy = lerp(H * 0.47, H * 0.5, pull); return { cx, cy, r }; }
    async function getCam() { if (camTried) return; camTried = true; try { cam = await camera('environment'); } catch (e) { try { cam = await camera('user'); } catch (e2) { cam = null; } } if (cam) vid = cam.video; }
    function build(u) { // u in -1..1 across the base
      const g = G(), h = rnd(0.25, 0.75) * g.r * (1 - Math.abs(u) * 0.55), w = rnd(0.07, 0.16) * g.r;
      const t = { u, w, h, p: 0, win: [], hue: rnd(30, 50), ant: Math.random() < 0.3 };
      const cols = Math.max(1, Math.floor(w / 6)), rows = Math.floor(h / 7); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (Math.random() < 0.6) t.win.push([c / cols, r / rows, rnd(0.3, 1)]);
      towers.push(t); audio.noise({ dur: 0.5, gain: 0.12, type: 'lowpass', freq: 400, freqTo: 1600 }); audio.tone(120, { dur: 0.6, gain: 0.08, to: 300 + towers.length * 25, type: 'triangle' }); haptic(8);
    }
    const pt = pointers(root, { down(p) { if (phase !== 'build') return; const g = G(); const u = (p.x - g.cx) / g.r; if (Math.abs(u) < 0.9) { build(clamp(u, -0.85, 0.85)); autoT = 2.5; } } });
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; T += dt; pT += dt;
      if (mo.ok) { const tl = mo.tilt(); if (!neutral) neutral = tl; tiltX = lerp(tiltX, clamp(tl.x - neutral.x, -1, 1), 0.08); tiltY = lerp(tiltY, clamp(tl.y - neutral.y, -1, 1), 0.08); }
      // timeline
      if (phase === 'build') { autoT -= dt; if (autoT <= 0 && towers.length < 16) { autoT = rnd(0.5, 1.1); build(rnd(-0.85, 0.85)); } if (pT > 1 && pad.gain.value < 0.01) pad.gain.setTargetAtTime(0.05, audio.now(), 2); if (pT > 10) { phase = 'reveal'; pT = 0; getCam(); audio.noise({ dur: 3, gain: 0.15, type: 'bandpass', freq: 2500, freqTo: 300, q: 0.8 }); [52, 59, 64, 71].forEach((m, i) => audio.pluck(m, { t: 0.5 + i * 0.2, gain: 0.14, dur: 4 })); } }
      if (phase === 'reveal') { pull = clamp(pT / 3, 0, 1); pull = pull * pull * (3 - 2 * pull); camA = clamp((pT - 0.5) / 2.5, 0, 1); if (pT > 4) { phase = 'snow'; pT = 0; snowE = 1; haptic([20, 40, 20]); } }
      if (phase === 'snow') { if (pT > 9) { phase = 'end'; pT = 0; } }
      if (phase === 'end') { lightsOut = clamp(pT / 4, 0, 1); if (pT > 6 && !ended) { ended = true; api.done(); } }
      for (const tw of towers) tw.p = Math.min(1, tw.p + dt * 0.9);
      const g = G(), { cx, cy, r } = g;
      // shake makes it snow
      const shaken = mo.shake > 12 && T - lastShake > 0.4; if (shaken) { lastShake = T; haptic(15); audio.noise({ dur: 0.3, gain: 0.2, type: 'highpass', freq: 3000 }); }
      const snowing = phase === 'snow' || phase === 'end' || shaken;
      if (snowing && snow.length < 420 && Math.random() < 0.8) for (let k = 0; k < (shaken ? 12 : 3); k++) { const a = rnd(TAU), d = Math.sqrt(rnd()) * r * 0.95; snow.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, vx: rnd(-40, 40) + (shaken ? rnd(-300, 300) : 0), vy: rnd(-60, 20) + (shaken ? rnd(-400, 100) : 0), s: rnd(1, 2.6), ph: rnd(TAU), settled: false }); }
      // ---- draw ----
      ctx.fillStyle = '#07060a'; ctx.fillRect(0, 0, W, H);
      if (camA > 0 && vid && vid.readyState >= 2) { if (!vfit || vfit.vw !== vid.videoWidth) { const vw = vid.videoWidth || 640, vh = vid.videoHeight || 480, s = Math.max(W / vw, H / vh); vfit = { s, ox: (W - vw * s) / 2, oy: (H - vh * s) / 2, vw, vh }; } ctx.globalAlpha = camA; ctx.drawImage(vid, vfit.ox + tiltX * 10, vfit.oy + tiltY * 10, vfit.vw * vfit.s, vfit.vh * vfit.s); ctx.globalAlpha = 1; ctx.fillStyle = `rgba(5,5,12,${0.45 * camA})`; ctx.fillRect(0, 0, W, H); }
      else if (camA > 0) { const tg = ctx.createLinearGradient(0, 0, 0, H); tg.addColorStop(0, '#1a1418'); tg.addColorStop(0.6, '#2a2026'); tg.addColorStop(1, '#4a3328'); ctx.globalAlpha = camA; ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      // base: a wooden pedestal with a gold ring
      const by = cy + r * 0.78; ctx.fillStyle = '#2b1a12'; ctx.beginPath(); ctx.ellipse(cx, by + r * 0.16, r * 0.82, r * 0.16, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#3d2518'; ctx.fillRect(cx - r * 0.82, by, r * 1.64, r * 0.16); ctx.fillStyle = '#4a2d1c'; ctx.beginPath(); ctx.ellipse(cx, by, r * 0.82, r * 0.16, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c9a24c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, by, r * 0.7, r * 0.12, 0, 0, TAU); ctx.stroke();
      // inside the sphere
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
      const sky = ctx.createLinearGradient(0, cy - r, 0, cy + r); sky.addColorStop(0, '#070a1c'); sky.addColorStop(0.65, '#1a1f45'); sky.addColorStop(1, '#2a2458'); ctx.fillStyle = sky; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { const sx = cx + Math.sin(i * 12.9) * r, sy = cy - r + ((i * 37.7) % (r * 1.2)); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + i); ctx.fillRect(sx, sy, 1.2, 1.2); } ctx.globalAlpha = 1;
      const ground = cy + r * 0.62; ctx.fillStyle = '#0c0d1e'; ctx.fillRect(cx - r, ground, r * 2, r);
      for (const tw of [...towers].sort((a, b) => Math.abs(b.u) - Math.abs(a.u))) {
        const x = cx + tw.u * r, h = tw.h * tw.p * tw.p * (3 - 2 * tw.p), w = tw.w; const depth = 1 - Math.abs(tw.u) * 0.5;
        ctx.fillStyle = `rgb(${12 * depth + 6},${14 * depth + 6},${30 * depth + 10})`; ctx.fillRect(x - w / 2, ground - h, w, h);
        ctx.fillStyle = `rgba(255,255,255,0.06)`; ctx.fillRect(x - w / 2, ground - h, w * 0.25, h);
        for (const wn of tw.win) { const wy = ground - h + wn[1] * h + 3; if (wy > ground - 4) continue; const on = wn[2] > lightsOut && Math.sin(t * 0.4 + wn[0] * 9 + wn[1] * 7) > -0.6; if (!on) continue; ctx.fillStyle = `hsla(${tw.hue},90%,75%,${0.8 * tw.p})`; ctx.fillRect(x - w / 2 + 2 + wn[0] * (w - 4), wy, 2.2, 3); }
        if (tw.ant && tw.p > 0.95) { ctx.strokeStyle = '#223'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, ground - h); ctx.lineTo(x, ground - h - r * 0.08); ctx.stroke(); if (Math.sin(t * 4 + tw.u * 10) > 0.6 && lightsOut < 0.9) { ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(x, ground - h - r * 0.08, 1.5, 0, TAU); ctx.fill(); } }
      }
      // tiny traffic along the base
      ctx.globalCompositeOperation = 'lighter'; for (const car of cars) { car.x += car.v * dt; if (car.x > 1.3) car.x = -0.3; if (car.x < -0.3) car.x = 1.3; const x = cx + (car.x - 0.5) * 2 * r * 0.95; ctx.fillStyle = `rgba(${car.c},${0.9 * (1 - lightsOut)})`; ctx.fillRect(x, ground + 2, 4, 1.5); ctx.globalAlpha = 0.5 * (1 - lightsOut); ctx.drawImage(warm, x - 6, ground - 4, 14, 14); ctx.globalAlpha = 1; }
      // snow inside the glass: falls, swirls with tilt, settles on the ground and rooftops
      const gx = tiltX * 260, gy = 60 + tiltY * 200;
      for (let i = snow.length - 1; i >= 0; i--) { const s = snow[i]; if (!s.settled) { s.vx += (gx + Math.sin(t * 2 + s.ph) * 30 - s.vx * 1.2) * dt; s.vy += (gy - s.vy * 1.2) * dt; s.x += s.vx * dt; s.y += s.vy * dt; const dx = s.x - cx, dy = s.y - cy, d = Math.hypot(dx, dy); if (d > r * 0.97) { s.x = cx + dx / d * r * 0.97; s.y = cy + dy / d * r * 0.97; s.vx *= -0.3; s.vy *= -0.3; } if (s.y > ground - 1 && Math.abs(s.vy) < 90) { s.settled = true; s.y = ground - 1; } for (const tw of towers) { const x = cx + tw.u * r, h = tw.h * tw.p; if (Math.abs(s.x - x) < tw.w / 2 && s.y > ground - h - 2 && s.y < ground - h + 4 && s.vy > 0) { s.settled = true; s.y = ground - h - 1; } } }
        ctx.globalAlpha = 0.9; ctx.drawImage(soft, s.x - s.s * 2, s.y - s.s * 2, s.s * 4, s.s * 4); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (snow.length > 300) { for (let i = 0; i < 3; i++) { const j = snow.findIndex(s => s.settled); if (j >= 0) snow.splice(j, 1); } }
      // snow drift on the ground
      const drift = clamp(snow.length / 300, 0, 1); if (drift > 0) { ctx.fillStyle = `rgba(235,240,250,${drift * 0.9})`; ctx.beginPath(); ctx.moveTo(cx - r, ground + 2); for (let x = -r; x <= r; x += 10) ctx.lineTo(cx + x, ground - drift * 5 - Math.abs(Math.sin(x * 0.05)) * drift * 4); ctx.lineTo(cx + r, ground + 20); ctx.lineTo(cx - r, ground + 20); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      // the glass: rim, reflections, shading
      const sh = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.2, cx, cy, r); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.85, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = r * 0.03; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, -2.5, -1.7); ctx.stroke(); ctx.lineWidth = r * 0.012; ctx.beginPath(); ctx.arc(cx, cy, r * 0.93, -1.5, -1.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, 0.5, 1.4); ctx.stroke();
      // a room reflection on the glass once we're in your room
      if (camA > 0 && vid && vid.readyState >= 2) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); ctx.globalAlpha = 0.14 * camA; ctx.translate(cx * 2, 0); ctx.scale(-1, 1); ctx.drawImage(vid, vfit.ox, vfit.oy, vfit.vw * vfit.s, vfit.vh * vfit.s); ctx.restore(); }
      hum.gain.setTargetAtTime(0.02 + Math.min(0.05, snow.length / 8000), audio.now(), 0.3);
    });
    return () => { stop(); pt.destroy(); cam && cam.stop(); pad.stop(); hum.stop(); cv.destroy(); };
  },
};
