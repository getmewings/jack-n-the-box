// Day six. Rain on a fogged window at night, your room on the other side. Wipe the fog with your finger and draw. Then the rain stops, the sun comes out, and the glass clears.
import { audio, haptic, camera, ask, GLYPH, makeCanvas, loop, pointers, rnd, TAU, lerp, clamp, glowSprite } from '../engine.js';

export default {
  name: 'window',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion(); let neutral = null, tiltX = 0;
    const cam = await ask(root, GLYPH.cam, () => camera('environment').catch(() => camera('user')));
    const W0 = cv.W, H0 = cv.H, sun = glowSprite(256, '255,235,200'), spark = glowSprite(24, '255,255,255');
    // fog layer: an offscreen canvas we erase with the finger
    const fog = document.createElement('canvas'); fog.width = Math.round(W0 * 0.5); fog.height = Math.round(H0 * 0.5); const fx = fog.getContext('2d');
    function fillFog(a) { fx.globalCompositeOperation = 'source-over'; fx.fillStyle = `rgba(120,135,160,${a})`; fx.fillRect(0, 0, fog.width, fog.height); }
    fillFog(0.86); { const g = fx.createLinearGradient(0, 0, 0, fog.height); g.addColorStop(0, 'rgba(60,70,90,0)'); g.addColorStop(1, 'rgba(60,70,90,.35)'); fx.fillStyle = g; fx.fillRect(0, 0, fog.width, fog.height); for (let i = 0; i < 400; i++) { fx.fillStyle = `rgba(255,255,255,${rnd(0.02, 0.08)})`; fx.beginPath(); fx.arc(rnd(fog.width), rnd(fog.height), rnd(1, 4), 0, TAU); fx.fill(); } }
    // the scene behind the glass: camera, blurred by downsampling
    const view = document.createElement('canvas'); view.width = 96; view.height = Math.round(96 * H0 / W0); const vx = view.getContext('2d');
    const drops = [], streaks = [], sparkles = [];
    let T = 0, pT = 0, phase = 'rain', rainA = 1, sunA = 0, clear = 0, ended = false, wipeT = 0, lastDrop = 0, refog = 0, draws = 0;
    const rain = audio.noiseLoop({ type: 'highpass', freq: 3500, q: 0.5, gain: 0.06 });
    const pad = audio.pad([110, 164.8, 220, 277.2, 329.6], { gain: 0.03, type: 'sine' });
    const pt = pointers(root, {
      down(p) { wipe(p.x, p.y, p.x, p.y); audio.noise({ dur: 0.15, gain: 0.1, type: 'bandpass', freq: 1500, q: 2 }); haptic(5); },
      move(p) { wipe(p.px, p.py, p.x, p.y); draws++; if (draws % 6 === 0) audio.noise({ dur: 0.08, gain: 0.05, type: 'bandpass', freq: 1200 + rnd(800), q: 3 }); },
    });
    function wipe(x0, y0, x1, y1) { fx.globalCompositeOperation = 'destination-out'; fx.strokeStyle = 'rgba(0,0,0,1)'; fx.lineWidth = 22; fx.lineCap = 'round'; fx.lineJoin = 'round'; fx.beginPath(); fx.moveTo(x0 / 2, y0 / 2); fx.lineTo(x1 / 2, y1 / 2); fx.stroke(); fx.lineWidth = 34; fx.strokeStyle = 'rgba(0,0,0,.35)'; fx.stroke(); }
    function drawScene(c, W, H) {
      if (cam && cam.video.readyState >= 2) { const v = cam.video, vw = v.videoWidth || 640, vh = v.videoHeight || 480, s = Math.max(view.width / vw, view.height / vh); vx.drawImage(v, (view.width - vw * s) / 2, (view.height - vh * s) / 2, vw * s, vh * s); c.imageSmoothingEnabled = true; c.drawImage(view, tiltX * 12, 0, W, H); }
      else { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b2238'); g.addColorStop(0.6, '#3a3550'); g.addColorStop(1, '#6a4e45'); c.fillStyle = g; c.fillRect(0, 0, W, H); for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(255,220,150,${0.15 + 0.1 * Math.sin(T + i)})`; c.fillRect(((i * 97) % W), H * 0.3 + (i * 53) % (H * 0.4), 14, 18); } }
      // night, then sun
      c.fillStyle = `rgba(10,14,30,${0.45 * (1 - sunA)})`; c.fillRect(0, 0, W, H);
      if (sunA > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6 * sunA; c.drawImage(sun, W * 0.75 - W * 0.55, H * 0.12 - W * 0.55, W * 1.1, W * 1.1); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    }
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; T += dt; pT += dt;
      if (mo.ok) { const tl = mo.tilt(); if (!neutral) neutral = tl; tiltX = lerp(tiltX, clamp(tl.x - neutral.x, -1, 1), 0.08); }
      // timeline
      if (phase === 'rain' && pT > 14) { phase = 'stop'; pT = 0; rain.gain.setTargetAtTime(0, audio.now(), 2); }
      if (phase === 'stop' && pT > 2.5) { phase = 'sun'; pT = 0; pad.gain.setTargetAtTime(0.08, audio.now(), 2); [60, 64, 67, 71, 74, 79].forEach((m, i) => audio.pluck(m, { t: i * 0.22, gain: 0.14, dur: 4 })); haptic([10, 60, 10, 60, 20]); }
      if (phase === 'sun') { sunA = clamp(pT / 3, 0, 1); clear = clamp((pT - 1) / 5, 0, 1); if (pT > 8 && !ended) { ended = true; api.done(); } }
      rainA = phase === 'rain' ? 1 : phase === 'stop' ? 1 - clamp(pT / 2.5, 0, 1) : 0;
      // fog creeps back where you wiped, until the sun burns it off
      refog += dt; if (refog > 0.5) { refog = 0; if (phase === 'rain') fillFog(0.02); }
      if (clear > 0) { fx.globalCompositeOperation = 'destination-out'; const g = fx.createRadialGradient(fog.width * 0.75, 0, 0, fog.width * 0.75, 0, fog.width * 1.6 * clear); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); fx.fillStyle = g; fx.fillRect(0, 0, fog.width, fog.height); }
      // raindrops on the glass
      if (rainA > 0 && T - lastDrop > 0.05 / rainA) { lastDrop = T; drops.push({ x: rnd(W), y: rnd(-10, H), r: rnd(2, 5.5), vy: 0, life: rnd(2, 6), big: Math.random() < 0.25 }); }
      // ---- draw ----
      drawScene(ctx, W, H);
      // blurred fog over the scene
      ctx.drawImage(fog, 0, 0, W, H);
      // drops: each is a little lens showing the scene flipped
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.life -= dt;
        if (d.big && d.r > 3.5) { d.vy += (40 + d.r * 20) * dt; d.y += d.vy * dt; d.x += Math.sin(T * 5 + i) * 10 * dt + tiltX * 30 * dt; if (Math.random() < 0.6) streaks.push({ x: d.x, y: d.y, r: d.r * 0.5, life: 1.2 }); if (d.y > H + 10) { drops.splice(i, 1); continue; } }
        if (d.life <= 0 || (sunA > 0.5 && Math.random() < 0.03)) { if (sunA > 0.3) sparkles.push({ x: d.x, y: d.y, life: 0.8 }); drops.splice(i, 1); continue; }
        ctx.save(); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.clip(); ctx.translate(d.x, d.y); ctx.scale(-0.08, -0.08); ctx.translate(-d.x, -d.y); drawScene(ctx, W, H); ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(d.x - d.r * 0.35, d.y - d.r * 0.35, d.r * 0.22, 0, TAU); ctx.fill();
      }
      for (let i = streaks.length - 1; i >= 0; i--) { const s = streaks[i]; s.life -= dt; if (s.life <= 0) { streaks.splice(i, 1); continue; } ctx.fillStyle = `rgba(220,230,245,${0.25 * s.life})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'lighter'; for (let i = sparkles.length - 1; i >= 0; i--) { const s = sparkles[i]; s.life -= dt; if (s.life <= 0) { sparkles.splice(i, 1); continue; } ctx.globalAlpha = s.life; ctx.drawImage(spark, s.x - 8, s.y - 8, 16, 16); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // window frame
      const fw = Math.max(10, W * 0.035); ctx.fillStyle = '#1a1512'; ctx.fillRect(0, 0, W, fw); ctx.fillRect(0, H - fw * 1.6, W, fw * 1.6); ctx.fillRect(0, 0, fw, H); ctx.fillRect(W - fw, 0, fw, H); ctx.fillRect(W / 2 - fw / 2, 0, fw, H);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(fw, fw, W - fw * 2, 2);
      // sill highlight at sunrise
      if (sunA > 0) { ctx.fillStyle = `rgba(255,220,170,${0.25 * sunA})`; ctx.fillRect(0, H - fw * 1.6, W, 3); }
      if (rainA > 0 && Math.random() < 0.1 * rainA) haptic(2);
    });
    return () => { stop(); pt.destroy(); cam && cam.stop(); rain.stop(); pad.stop(); cv.destroy(); };
  },
};
