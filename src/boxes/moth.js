// Day two. A dark forest. One moth finds your light. Lead it, and the forest follows: more moths join until you're guiding a river of them to the moon.
import { audio, haptic, makeCanvas, loop, pointers, rnd, TAU, lerp, clamp, glowSprite } from '../engine.js';

export default {
  name: 'moth',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion(); let neutral = null, tiltX = 0;
    const W0 = cv.W, H0 = cv.H;
    const lamp = glowSprite(256, '255,220,160'), moon = glowSprite(256, '220,230,255'), mothG = glowSprite(32, '255,235,200');
    // parallax forest: 4 layers of tree silhouettes
    const layers = [0.15, 0.3, 0.55, 1].map((depth, li) => ({ depth, trees: Array.from({ length: 9 }, () => ({ x: rnd(-0.3, 1.6), w: (0.03 + rnd(0.04)) * (0.4 + depth), h: 0.6 + rnd(0.6), lean: rnd(-0.03, 0.03), limbs: Array.from({ length: 6 }, () => ({ y: rnd(0.25, 0.8), a: rnd(0.3, 1.1) * (Math.random() < 0.5 ? -1 : 1), l: rnd(0.1, 0.26) })) })), tone: li }));
    const moths = [{ x: W0 * 0.3, y: H0 * 0.6, vx: 0, vy: 0, ph: rnd(TAU), flap: rnd(TAU), lead: true, join: 0 }];
    let T = 0, pT = 0, phase = 'dark', finger = null, lampX = W0 / 2, lampY = H0 * 0.55, lampOn = 0, scroll = 0, scrollV = 0, moonUp = 0, ended = false, spawnT = 0, lastTick = 0, brightness = 0;
    const pad = audio.pad([55, 82.4, 110, 146.8], { gain: 0, type: 'triangle' });
    const night = audio.noiseLoop({ type: 'bandpass', freq: 3000, q: 8, gain: 0 });
    const flutter = audio.noiseLoop({ type: 'bandpass', freq: 900, q: 1.2, gain: 0 });
    const pt = pointers(root, { down(p) { finger = p; if (phase === 'dark') { phase = 'found'; pT = 0; audio.pluck(79, { gain: 0.18, dur: 2.5 }); haptic(15); pad.gain.setTargetAtTime(0.05, audio.now(), 2); } }, move(p) { finger = p; }, up() { finger = null; } });
    function drawTree(c, t, L, W, H, col) {
      const x = ((t.x + scroll * L.depth * 0.6) % 1.9 + 1.9) % 1.9 * W - W * 0.45, w = t.w * W, h = t.h * H, top = H - h;
      c.fillStyle = col; c.beginPath(); c.moveTo(x - w, H + 5); c.quadraticCurveTo(x + t.lean * W, H - h * 0.5, x - w * 0.25 + t.lean * W * 2, top); c.lineTo(x + w * 0.25 + t.lean * W * 2, top); c.quadraticCurveTo(x + w + t.lean * W, H - h * 0.5, x + w, H + 5); c.closePath(); c.fill();
      c.strokeStyle = col; c.lineCap = 'round';
      for (const lb of t.limbs) { const ly = H - h * lb.y, lx = x + t.lean * W * (1 - lb.y) * 2; c.lineWidth = w * 0.5 * (1 - lb.y) + 1; c.beginPath(); c.moveTo(lx, ly); c.quadraticCurveTo(lx + Math.cos(lb.a) * lb.l * W * 0.5, ly - lb.l * H * 0.3, lx + Math.cos(lb.a) * lb.l * W, ly - Math.abs(Math.sin(lb.a)) * lb.l * H * 0.6); c.stroke(); }
    }
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; T += dt; pT += dt;
      if (mo.ok) { const tl = mo.tilt(); if (!neutral) neutral = tl; tiltX = lerp(tiltX, clamp(tl.x - neutral.x, -1, 1), 0.05); }
      // the lamp is your finger; it drifts on its own if you let go
      if (finger) { lampX = lerp(lampX, finger.x, 0.15); lampY = lerp(lampY, finger.y, 0.15); } else if (phase !== 'dark') { lampX = lerp(lampX, W * 0.55 + Math.sin(T * 0.4) * W * 0.25, 0.02); lampY = lerp(lampY, H * 0.45 + Math.cos(T * 0.3) * H * 0.1, 0.02); }
      if (phase === 'dark' && pT > 4) { phase = 'found'; pT = 0; audio.pluck(79, { gain: 0.18, dur: 2.5 }); pad.gain.setTargetAtTime(0.05, audio.now(), 2); }
      lampOn = lerp(lampOn, phase === 'dark' ? 0.15 : phase === 'moon' || phase === 'end' ? 0.3 : 1, 0.04);
      // the forest scrolls as you lead: lamp position on screen pulls the world
      const pull = phase === 'found' || phase === 'river' ? (lampX / W - 0.5) * 0.25 + tiltX * 0.15 : phase === 'moon' ? 0.05 : 0;
      scrollV = lerp(scrollV, -pull, 0.05); scroll += scrollV * dt;
      // timeline
      if (phase === 'found' && pT > 5) { phase = 'river'; pT = 0; }
      if (phase === 'river') { spawnT += dt; const rate = 0.08 + Math.max(0, 0.3 - pT * 0.03); if (spawnT > rate && moths.length < 420) { spawnT = 0; const side = Math.random() < 0.5 ? -1 : 1; moths.push({ x: side < 0 ? -30 : W + 30, y: rnd(H * 0.2, H * 0.9), vx: 0, vy: 0, ph: rnd(TAU), flap: rnd(TAU), lead: false, join: 0 }); if (moths.length % 20 === 0) { audio.pluck(67 + [0, 3, 7, 10, 12][Math.floor(rnd(5))], { gain: 0.08, dur: 2 }); haptic(4); } } if (pT > 12) { phase = 'moon'; pT = 0; audio.noise({ dur: 6, gain: 0.12, type: 'highpass', freq: 2000, freqTo: 6000 }); [60, 67, 72, 76, 79, 84].forEach((m, i) => audio.pluck(m, { t: i * 0.2, gain: 0.14, dur: 4 })); haptic([10, 60, 10, 60, 10, 60, 30]); } }
      if (phase === 'moon') { moonUp = clamp(pT / 4, 0, 1); brightness = clamp((pT - 2) / 5, 0, 1) * 0.5; if (pT > 10) { phase = 'end'; pT = 0; } }
      if (phase === 'end') { if (pT > 4.5 && !ended) { ended = true; api.done(); } }
      const moonX = W * 0.5, moonY = lerp(H * 1.2, H * 0.22, 1 - Math.pow(1 - moonUp, 3));
      // ---- draw ----
      const amb = brightness;
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgb(${4 + amb * 60},${6 + amb * 70},${16 + amb * 110})`); g.addColorStop(1, `rgb(${8 + amb * 40},${10 + amb * 50},${20 + amb * 70})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (moonUp > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7 * moonUp; ctx.drawImage(moon, moonX - W * 0.7, moonY - W * 0.7, W * 1.4, W * 1.4); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(235,240,255,${moonUp})`; ctx.beginPath(); ctx.arc(moonX, moonY, W * 0.11, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(200,210,235,.25)'; ctx.beginPath(); ctx.arc(moonX - W * 0.03, moonY + W * 0.02, W * 0.025, 0, TAU); ctx.arc(moonX + W * 0.04, moonY - W * 0.04, W * 0.018, 0, TAU); ctx.fill(); }
      // fog band
      const fog = ctx.createLinearGradient(0, H * 0.5, 0, H); fog.addColorStop(0, 'rgba(40,50,80,0)'); fog.addColorStop(1, `rgba(40,50,80,${0.35 + amb * 0.3})`); ctx.fillStyle = fog; ctx.fillRect(0, 0, W, H);
      // lamp light: your finger
      ctx.globalCompositeOperation = 'lighter'; const lr = W * 1.1 * lampOn; ctx.globalAlpha = 0.5 * lampOn; ctx.drawImage(lamp, lampX - lr / 2, lampY - lr / 2, lr, lr); ctx.globalAlpha = 0.9 * lampOn; ctx.drawImage(lamp, lampX - 50, lampY - 50, 100, 100); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // forest layers, lit by the lamp
      for (const L of layers) { const shade = 10 + L.depth * 14 + amb * 90, blue = 18 + L.depth * 18 + amb * 100; const col = `rgb(${shade * 0.6},${shade * 0.7},${blue})`; for (const tr of L.trees) drawTree(ctx, tr, L, W, H, col); }
      // lamp halo in front of the near trees
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 * lampOn; ctx.drawImage(lamp, lampX - lr / 3, lampY - lr / 3, lr / 1.5, lr / 1.5); ctx.globalAlpha = 1;
      // moths
      let speedSum = 0;
      const tx = phase === 'moon' || phase === 'end' ? moonX : lampX, ty = phase === 'moon' || phase === 'end' ? moonY : lampY;
      for (let i = moths.length - 1; i >= 0; i--) {
        const m = moths[i]; m.flap += dt * (18 + Math.random() * 6);
        const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) + 1;
        const orbit = phase === 'moon' || phase === 'end' ? 0 : 60 + (i % 7) * 12, k = phase === 'dark' ? 0 : 1;
        // flutter toward the light, circle it when close, never quite still
        const want = d > orbit ? 1 : -0.6; m.vx += (dx / d * want * 700 * k + Math.cos(m.ph + t * 7) * 500 + (-dy / d) * 260 * k) * dt; m.vy += (dy / d * want * 700 * k + Math.sin(m.ph * 1.3 + t * 6) * 500 + (dx / d) * 260 * k) * dt;
        if (phase === 'end' || (phase === 'moon' && pT > 4)) { m.vy -= 220 * dt; m.vx += (dx / d) * 220 * dt; }
        m.vx *= 0.93; m.vy *= 0.93; m.x += m.vx * dt; m.y += m.vy * dt; speedSum += Math.hypot(m.vx, m.vy);
        if (m.lead && phase === 'end') { if (pT < 2.5 && finger) { m.x = lerp(m.x, finger.x, 0.2); m.y = lerp(m.y, finger.y - 10, 0.2); } }
        if ((phase === 'moon' || phase === 'end') && pT > 3 && Math.hypot(m.x - moonX, m.y - moonY) < W * 0.06 && !m.lead) { moths.splice(i, 1); if (Math.random() < 0.08) audio.tinkle(0, 0.03); continue; }
        if (m.lead && phase === 'end' && pT > 3 && Math.hypot(m.x - moonX, m.y - moonY) < W * 0.1) { moths.splice(i, 1); audio.pluck(91, { gain: 0.2, dur: 3 }); haptic(20); continue; }
        // draw: body + two flapping wings, lit by distance to lamp
        const lit = clamp(1 - Math.hypot(m.x - lampX, m.y - lampY) / (W * 0.9), 0.15, 1) * lampOn + amb;
        const a = Math.atan2(m.vy, m.vx), sz = m.lead ? 9 : 6 + (i % 3), wing = Math.abs(Math.sin(m.flap)) * 0.9 + 0.1;
        ctx.globalAlpha = Math.min(1, lit * 0.35); ctx.drawImage(mothG, m.x - sz * 2, m.y - sz * 2, sz * 4, sz * 4);
        ctx.globalAlpha = Math.min(1, lit); ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(a); ctx.fillStyle = `rgb(${235 * lit + 20},${215 * lit + 15},${180 * lit + 20})`;
        ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.9, sz * 0.3, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-sz * 0.1, -sz * 0.55 * wing, sz * 0.75, sz * 0.55 * wing, 0.2, 0, TAU); ctx.ellipse(-sz * 0.1, sz * 0.55 * wing, sz * 0.75, sz * 0.55 * wing, -0.2, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      flutter.gain.setTargetAtTime(clamp(moths.length / 400, 0, 1) * 0.08 + (phase !== 'dark' ? 0.012 : 0), audio.now(), 0.2); flutter.filter.frequency.setTargetAtTime(700 + Math.sin(t * 9) * 200, audio.now(), 0.05);
      night.gain.setTargetAtTime((Math.sin(t * 22) > 0.7 ? 0.012 : 0) * (1 - amb), audio.now(), 0.01);
    });
    return () => { stop(); pt.destroy(); pad.stop(); night.stop(); flutter.stop(); cv.destroy(); };
  },
};
