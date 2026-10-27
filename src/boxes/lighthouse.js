// Day four. A storm at sea, and you are the lighthouse. Tilt or drag to aim the beam. Find the lost ship and bring it home before dawn.
import { audio, haptic, makeCanvas, loop, pointers, rnd, TAU, lerp, clamp, glowSprite, flash, shake } from '../engine.js';

export default {
  name: 'lighthouse',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion(); let neutral = null, tiltX = 0;
    const W0 = cv.W, H0 = cv.H, glow = glowSprite(256, '255,235,190'), warm = glowSprite(64, '255,200,120');
    let T = 0, pT = 0, phase = 'storm', aim = 0.3, aimT = 0.3, finger = null, ship = { x: 1.05, y: 0.56, prog: 0, found: 0, home: false }, dawn = 0, rainA = 1, beamOn = 1, ended = false, bolts = 0, lastBolt = 0, hornT = -1, gulls = [];
    const rain = Array.from({ length: 260 }, () => ({ x: rnd(W0), y: rnd(H0), v: rnd(700, 1200), l: rnd(10, 22) }));
    const sea = audio.noiseLoop({ type: 'lowpass', freq: 380, q: 0.6, gain: 0.12 });
    const wind = audio.noiseLoop({ type: 'bandpass', freq: 900, q: 0.5, gain: 0.05 });
    const pad = audio.pad([49, 73.4, 98, 146.8], { gain: 0.03, type: 'sine' });
    const pt = pointers(root, { down(p) { finger = p; }, move(p) { finger = p; }, up() { finger = null; } });
    const LH = { x: 0.16, base: 0.72 };
    function horn() { const c = audio.ensure(), t0 = c.currentTime, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = 110; o2.frequency.value = 165; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.25, t0 + 0.4); g.gain.setValueAtTime(0.25, t0 + 1.6); g.gain.linearRampToValueAtTime(0, t0 + 2.2); o.connect(f); o2.connect(f); f.connect(g).connect(audio.master); o.start(t0); o2.start(t0); o.stop(t0 + 2.3); o2.stop(t0 + 2.3); haptic([200, 100, 400]); }
    function waveY(x, k, t) { return Math.sin(x * 0.012 * k + t * 1.4) * 9 + Math.sin(x * 0.03 * k - t * 2.1) * 5 + Math.sin(x * 0.005 * k + t * 0.7) * 14; }
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; T += dt; pT += dt;
      if (mo.ok) { const tl = mo.tilt(); if (!neutral) neutral = tl; tiltX = lerp(tiltX, clamp(tl.x - neutral.x, -1, 1), 0.08); }
      // aiming the beam: finger direction from the lamp, or tilt, or a slow sweep
      const lampX = LH.x * W, lampY = LH.base * H - H * 0.3;
      if (finger) aimT = Math.atan2(finger.y - lampY, finger.x - lampX); else if (Math.abs(tiltX) > 0.08) aimT = clamp(aimT + tiltX * 1.6 * dt, -0.6, 0.9); else aimT = 0.2 + Math.sin(T * 0.35) * 0.45;
      aimT = clamp(aimT, -0.7, 1.0); aim = lerp(aim, aimT, 0.08);
      // ship drifts and rocks; when your light is on it, it makes way for the harbour
      const storm = phase === 'storm' ? 1 : phase === 'home' ? 1 - clamp(pT / 4, 0, 1) : 0;
      const sx = ship.x * W, sy = ship.y * H + waveY(sx, 1, T) * 0.6;
      const toShip = Math.atan2(sy - lampY, sx - lampX); let da = toShip - aim; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      const lit = phase === 'storm' ? clamp(1 - Math.abs(da) / 0.16, 0, 1) : 0;
      ship.found = lerp(ship.found, lit, 0.1);
      if (phase === 'storm') { ship.prog += dt * (0.012 + lit * 0.06); ship.x = lerp(1.05, LH.x + 0.1, clamp(ship.prog, 0, 1)); ship.y = lerp(0.56, 0.66, clamp(ship.prog, 0, 1)); if (ship.found > 0.5 && Math.random() < 0.02) haptic(4); if (ship.prog >= 1 || pT > 17) { phase = 'home'; pT = 0; horn(); [55, 62, 67].forEach((m, i) => audio.pluck(m, { t: 0.8 + i * 0.3, gain: 0.14, dur: 3 })); } }
      if (phase === 'home') { ship.x = lerp(ship.x, LH.x + 0.02, 0.02); ship.y = lerp(ship.y, 0.72, 0.02); if (pT > 4) { phase = 'dawn'; pT = 0; pad.gain.setTargetAtTime(0.07, audio.now(), 2); [60, 64, 67, 72, 76].forEach((m, i) => audio.pluck(m, { t: i * 0.25, gain: 0.14, dur: 4 })); for (let i = 0; i < 7; i++) gulls.push({ x: rnd(-0.2, 0.3), y: rnd(0.15, 0.4), v: rnd(0.04, 0.08), ph: rnd(TAU) }); } }
      if (phase === 'dawn') { dawn = clamp(pT / 5, 0, 1); beamOn = 1 - clamp((pT - 3) / 2, 0, 1); if (pT > 8 && !ended) { ended = true; api.done(); } }
      rainA = lerp(rainA, storm, 0.03); sea.gain.setTargetAtTime(0.04 + storm * 0.09, audio.now(), 0.5); wind.gain.setTargetAtTime(storm * 0.05, audio.now(), 0.5);
      // distant lightning
      if (storm > 0.5 && T - lastBolt > rnd(3, 7)) { lastBolt = T; flash(0.12, 120); audio.noise({ t: 1.2, dur: 2.5, gain: 0.25, type: 'lowpass', freq: 150, freqTo: 50, attack: 0.1 }); }
      // ---- draw ----
      const n = [[6, 8, 18], [12, 16, 34]], d = [[90, 70, 120], [255, 170, 110]];
      const c0 = n[0].map((v, i) => lerp(v, d[0][i], dawn)), c1 = n[1].map((v, i) => lerp(v, d[1][i], dawn));
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.6); g.addColorStop(0, `rgb(${c0.join(',')})`); g.addColorStop(1, `rgb(${c1.join(',')})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (dawn > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = dawn * 0.9; ctx.drawImage(glow, W * 0.75 - W * 0.6, H * 0.55 - W * 0.6, W * 1.2, W * 1.2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      // clouds: dark streaks
      for (let i = 0; i < 6; i++) { const y = H * (0.05 + i * 0.07), x = ((T * (10 + i * 4)) % (W * 1.6)) - W * 0.3; ctx.fillStyle = `rgba(${4 + dawn * 120},${6 + dawn * 80},${14 + dawn * 90},${0.5 * (1 - dawn * 0.5)})`; ctx.beginPath(); ctx.ellipse(x, y, W * 0.5, H * 0.03, 0, 0, TAU); ctx.fill(); }
      // sea: layered wave bands
      const horizon = H * 0.56;
      for (let L = 0; L < 7; L++) { const y0 = horizon + L * H * 0.06, k = 1 + L * 0.4, tone = lerp(10 + L * 4, 70 + L * 10, dawn); ctx.fillStyle = `rgb(${tone * 0.5},${tone * 0.8 + dawn * 20},${tone * 1.2 + 20})`; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y0 + waveY(x + L * 300, k, T) * (0.5 + storm * 0.8)); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        if (L === 2) { // the ship sails between the bands
          const bob = waveY(sx, 1.8, T) * 0.4 * (0.5 + storm), rock = Math.sin(T * 1.7) * 0.12 * storm; ctx.save(); ctx.translate(sx, sy + bob); ctx.rotate(rock); const S = 22 + ship.prog * 26;
          ctx.fillStyle = `rgb(${8 + dawn * 40},${8 + dawn * 30},${14 + dawn * 30})`; ctx.beginPath(); ctx.moveTo(-S, 0); ctx.lineTo(S, 0); ctx.lineTo(S * 0.8, S * 0.35); ctx.lineTo(-S * 0.85, S * 0.35); ctx.closePath(); ctx.fill(); ctx.fillRect(-S * 0.3, -S * 0.5, S * 0.5, S * 0.5); ctx.fillRect(S * 0.1, -S * 1.1, S * 0.08, S * 1.1);
          ctx.globalCompositeOperation = 'lighter'; const la = 0.5 + ship.found * 0.5; ctx.globalAlpha = la; ctx.drawImage(warm, S * 0.14 - 12, -S * 1.1 - 12, 24, 24); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(255,220,150,${la})`; ctx.beginPath(); ctx.arc(S * 0.14, -S * 1.1, 2.5, 0, TAU); ctx.fill(); ctx.restore();
        }
      }
      // the beam, lighting rain and sea
      if (beamOn > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const len = W * 1.8, sp = 0.09; const bx = lampX + Math.cos(aim) * len, by = lampY + Math.sin(aim) * len; const bg = ctx.createLinearGradient(lampX, lampY, bx, by); bg.addColorStop(0, `rgba(255,240,200,${0.55 * beamOn})`); bg.addColorStop(0.5, `rgba(255,230,180,${0.18 * beamOn})`); bg.addColorStop(1, 'rgba(255,230,180,0)'); ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(lampX, lampY); ctx.lineTo(lampX + Math.cos(aim - sp) * len, lampY + Math.sin(aim - sp) * len); ctx.lineTo(lampX + Math.cos(aim + sp) * len, lampY + Math.sin(aim + sp) * len); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 0.9 * beamOn; ctx.drawImage(glow, lampX - 70, lampY - 70, 140, 140); ctx.restore(); }
      // rain
      if (rainA > 0.02) { ctx.strokeStyle = `rgba(190,205,235,${0.22 * rainA})`; ctx.lineWidth = 1; ctx.beginPath(); for (const r of rain) { r.y += r.v * dt; r.x -= r.v * 0.25 * dt; if (r.y > H) { r.y = -20; r.x = rnd(-20, W + 80); } ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - r.l * 0.25, r.y - r.l); } ctx.stroke(); }
      // rocks and the lighthouse
      const rk = `rgb(${8 + dawn * 50},${8 + dawn * 40},${12 + dawn * 45})`; ctx.fillStyle = rk; ctx.beginPath(); ctx.moveTo(-10, H); ctx.lineTo(-10, LH.base * H + 20); ctx.quadraticCurveTo(W * 0.1, LH.base * H - 30, W * 0.3, LH.base * H + 10); ctx.quadraticCurveTo(W * 0.4, LH.base * H + 40, W * 0.45, H); ctx.closePath(); ctx.fill();
      const tw = W * 0.045, th = H * 0.3, tx = lampX; ctx.fillStyle = rk; ctx.beginPath(); ctx.moveTo(tx - tw * 1.3, LH.base * H); ctx.lineTo(tx - tw * 0.8, LH.base * H - th); ctx.lineTo(tx + tw * 0.8, LH.base * H - th); ctx.lineTo(tx + tw * 1.3, LH.base * H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.12 + dawn * 0.5})`; for (let i = 0; i < 3; i++) { const yy = LH.base * H - th * (0.25 + i * 0.25), ww = tw * (1.3 - (0.25 + i * 0.25) * 0.5); ctx.fillRect(tx - ww, yy, ww * 2, th * 0.08); }
      ctx.fillStyle = `rgba(255,240,200,${0.6 * beamOn + 0.1})`; ctx.fillRect(tx - tw * 0.9, LH.base * H - th - tw * 1.2, tw * 1.8, tw * 1.2); ctx.fillStyle = rk; ctx.beginPath(); ctx.moveTo(tx - tw * 1.1, LH.base * H - th - tw * 1.2); ctx.lineTo(tx, LH.base * H - th - tw * 2.1); ctx.lineTo(tx + tw * 1.1, LH.base * H - th - tw * 1.2); ctx.closePath(); ctx.fill();
      // gulls at dawn
      for (const gl of gulls) { gl.x += gl.v * dt; gl.ph += dt * 6; const gx = gl.x * W, gy = gl.y * H + Math.sin(gl.ph * 0.3) * 10, f = Math.sin(gl.ph) * 5; ctx.strokeStyle = `rgba(40,30,40,${dawn})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx - 9, gy + f); ctx.quadraticCurveTo(gx - 4, gy - 3, gx, gy); ctx.quadraticCurveTo(gx + 4, gy - 3, gx + 9, gy + f); ctx.stroke(); }
    });
    return () => { stop(); pt.destroy(); sea.stop(); wind.stop(); pad.stop(); cv.destroy(); };
  },
};
