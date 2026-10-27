// Day one. Something knocks from inside the phone. You break the glass. Behind it is your actual room.
// Then balloons come out of the hole, one by one, until they lift the broken glass clean off the screen.
import { audio, haptic, camera, makeCanvas, loop, pointers, flash, shake, rnd, TAU, lerp, clamp, glowSprite } from '../engine.js';

export default {
  name: 'hole',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion();
    let neutral = null, tiltX = 0, tiltY = 0;
    const sprite = glowSprite(64, '255,240,220');
    let phase = 'knock', T = 0, pT = 0;
    let cam = null, camTried = false, vid = null, vfit = null;
    let knockT = 1.1, knockN = 0, knockAt = null, knockGlow = 0;
    let cracks = [], hole = null, holeC = null, shards = [], dust = [], crackT = 0;
    let balloons = [], confetti = [], born = 0, nextB = 0, glassY = 0, popped = 0, ended = false;
    const amb = audio.noiseLoop({ type: 'lowpass', freq: 150, q: 0.5, gain: 0.0 });
    const pad = audio.pad([130.8, 196, 261.6, 329.6], { gain: 0, type: 'triangle' });
    const hues = [350, 25, 48, 150, 200, 280, 320];

    async function getCam() { if (camTried) return; camTried = true; try { cam = await camera('environment'); } catch (e) { try { cam = await camera('user'); } catch (e2) { cam = null; } } if (cam) vid = cam.video; }
    function fit() { const W = cv.W, H = cv.H, vw = vid.videoWidth || 640, vh = vid.videoHeight || 480, s = Math.max(W / vw, H / vh); vfit = { s, ox: (W - vw * s) / 2, oy: (H - vh * s) / 2, vw, vh }; }
    function inPoly(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
    function jagged(cx, cy, r, n, jit) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (1 + (Math.random() - 0.5) * jit); p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.08]); } return p; }
    function crackLine(x0, y0, a, len, depth) { const pts = [[x0, y0]]; let x = x0, y = y0, ang = a, left = Math.max(len, 10); while (left > 0) { const seg = rnd(14, 40); ang += rnd(-0.22, 0.22); x += Math.cos(ang) * seg; y += Math.sin(ang) * seg; pts.push([x, y]); left -= seg; if (depth > 0 && Math.random() < 0.14) cracks.push({ pts: crackLine(x, y, ang + (Math.random() < 0.5 ? -1 : 1) * rnd(0.5, 1.1), left * rnd(0.2, 0.5), depth - 1), w: 0.6, grow: 0, speed: rnd(2, 4) }); } return pts; }
    function crack(x, y) { phase = 'cracked'; pT = 0; crackT = 0; knockAt = null; holeC = [x, y]; const n = 9 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) cracks.push({ pts: crackLine(x, y, i / n * TAU + rnd(-0.3, 0.3), rnd(120, 340), 2), w: rnd(1, 1.8), grow: 0, speed: rnd(2.5, 5) }); audio.glass(); haptic([70, 30, 50]); flash(0.25, 120); shake(root); }
    function moreCracks(x, y) { for (let i = 0; i < 3; i++) cracks.push({ pts: crackLine(x, y, rnd(TAU), rnd(60, 160), 1), w: 0.8, grow: 0, speed: 4 }); audio.noise({ dur: 0.15, gain: 0.4, type: 'highpass', freq: 2500 }); haptic(30); }
    function burst() {
      phase = 'hole'; pT = 0; const W = cv.W, H = cv.H, [x, y] = holeC, r = Math.min(W, H) * 0.34; hole = jagged(x, y, r, 22, 0.45);
      for (let i = 0; i < 70; i++) { const a = rnd(TAU), d = rnd(0, r * 0.9); shards.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, poly: jagged(0, 0, rnd(8, 34), 5, 0.8), vx: Math.cos(a) * rnd(100, 500), vy: Math.sin(a) * rnd(100, 500) - 60, sc: 1, vs: rnd(1.5, 4), rot: rnd(TAU), vr: rnd(-6, 6), life: 1 }); }
      dustFall(x, y + r * 0.6, 40); audio.glass(); audio.noise({ dur: 0.5, gain: 0.9, type: 'highpass', freq: 1200 }); audio.thump(0, 1); for (let i = 0; i < 14; i++) audio.tinkle(rnd(0.1, 1.2), 0.06);
      haptic([120, 40, 160, 60, 80]); flash(0.8, 220); shake(root); if (!neutral && mo.ok) neutral = mo.tilt(); amb.gain.setTargetAtTime(0.05, audio.now(), 1);
    }
    function dustFall(x, y, n) { for (let i = 0; i < n; i++) dust.push({ x: x + rnd(-30, 30), y, vx: rnd(-20, 20), vy: rnd(10, 80), life: rnd(1, 3), sz: rnd(1, 3) }); }
    function spawnBalloon() {
      const W = cv.W, bottom = hole.reduce((m, p) => p[1] > m[1] ? p : m, hole[0]);
      const r = rnd(26, 44) * Math.min(1, W / 400);
      balloons.push({ x: holeC[0] + rnd(-20, 20), y: holeC[1] + rnd(-10, 10), r, hue: hues[born % hues.length], vx: rnd(-20, 20), vy: 0, sc: 0.05, ph: rnd(TAU), rot: 0, str: r * 2.6, alive: true });
      born++; audio.noise({ dur: 0.25, gain: 0.12, type: 'bandpass', freq: 700 + rnd(600), q: 1.5 }); audio.tone(300 + born * 20, { dur: 0.3, gain: 0.05, to: 600 + born * 20 }); haptic(6);
    }
    function pop(b, x, y) {
      b.alive = false; popped++;
      for (let i = 0; i < 26; i++) { const a = rnd(TAU), sp = rnd(80, 420); confetti.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, hue: b.hue + rnd(-20, 20), rot: rnd(TAU), vr: rnd(-12, 12), w: rnd(4, 9), h: rnd(2, 5), life: rnd(1.2, 2.2) }); }
      audio.noise({ dur: 0.07, gain: 0.9, type: 'highpass', freq: 800 }); audio.tone(180, { dur: 0.12, gain: 0.5, to: 60, type: 'square' }); audio.tone(900 + rnd(600), { dur: 0.08, gain: 0.15 });
      haptic([25, 15, 10]); flash(0.08, 60);
    }
    const pt = pointers(root, {
      down(p) {
        if (phase === 'knock') { getCam(); crack(p.x, p.y); return; }
        if (phase === 'cracked') { if (crackT > 0.5) burst(); return; }
        for (let i = balloons.length - 1; i >= 0; i--) { const b = balloons[i]; if (b.alive && Math.hypot(p.x - b.x, p.y - (b.y + glassY)) < b.r * b.sc * 1.15) { pop(b); return; } }
        if (hole && inPoly(p.x, p.y - glassY, hole)) { audio.tinkle(0, 0.05); dustFall(p.x, p.y, 6); haptic(6); } else { audio.noise({ dur: 0.08, gain: 0.08, type: 'highpass', freq: 3000 }); haptic(4); }
      },
    });

    function drawRoom(c, W, H) {
      if (vid && vid.readyState >= 2) { if (!vfit || vfit.vw !== vid.videoWidth) fit(); const { s, ox, oy } = vfit; c.drawImage(vid, ox + tiltX * 18, oy + tiltY * 18, vfit.vw * s, vfit.vh * s); }
      else { const g = c.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.4, H); g.addColorStop(0, '#5a6a8a'); g.addColorStop(0.5, '#1c2238'); g.addColorStop(1, '#070812'); c.fillStyle = g; c.fillRect(0, 0, W, H); for (let i = 0; i < 9; i++) { const y = H * 0.1 + i * H * 0.1 + Math.sin(T + i) * 3; c.strokeStyle = `rgba(200,210,255,${0.06 + 0.03 * Math.sin(T * 2 + i)})`; c.lineWidth = 1; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } }
    }
    function drawGlass(c, W, H, withHole) {
      c.save(); c.translate(0, glassY);
      c.beginPath(); c.rect(0, -H, W, H * 3); if (withHole && hole) { hole.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); }
      c.save(); c.clip('evenodd');
      c.fillStyle = '#06060a'; c.fillRect(0, -H, W, H * 3);
      const sx = W * (0.3 + tiltX * 0.5), sy = H * (0.25 + tiltY * 0.5);
      const sh = c.createLinearGradient(sx - W * 0.6, sy - H * 0.3, sx + W * 0.6, sy + H * 0.3); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.45, 'rgba(255,255,255,.035)'); sh.addColorStop(0.5, 'rgba(255,255,255,.09)'); sh.addColorStop(0.55, 'rgba(255,255,255,.035)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.fillRect(0, -H, W, H * 3);
      const ed = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); ed.addColorStop(0, 'rgba(0,0,0,0)'); ed.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = ed; c.fillRect(0, 0, W, H);
      if (knockGlow > 0 && knockAt) { const g = c.createRadialGradient(knockAt[0], knockAt[1], 0, knockAt[0], knockAt[1], 140); g.addColorStop(0, `rgba(255,220,170,${knockGlow * 0.35})`); g.addColorStop(1, 'rgba(255,220,170,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      if (cracks.length) { c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; for (const k of cracks) { const n = Math.min(k.pts.length, Math.max(2, Math.ceil(k.pts.length * Math.min(1, k.grow)))); c.strokeStyle = `rgba(255,235,200,${withHole ? 0.12 : 0.22})`; c.lineWidth = k.w * 6; c.beginPath(); for (let i = 0; i < n; i++) i ? c.lineTo(k.pts[i][0], k.pts[i][1]) : c.moveTo(k.pts[i][0], k.pts[i][1]); c.stroke(); } c.globalCompositeOperation = 'source-over'; }
      for (const k of cracks) { const n = Math.min(k.pts.length, Math.max(2, Math.ceil(k.pts.length * Math.min(1, k.grow)))); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = k.w; c.beginPath(); for (let i = 0; i < n; i++) i ? c.lineTo(k.pts[i][0], k.pts[i][1]) : c.moveTo(k.pts[i][0], k.pts[i][1]); c.stroke(); }
      c.restore();
      if (withHole && hole) { c.beginPath(); hole.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.lineJoin = 'miter'; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2.5; c.stroke(); c.strokeStyle = 'rgba(180,200,230,.35)'; c.lineWidth = 9; c.stroke(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < hole.length; i += 2) { const p = hole[i]; c.globalAlpha = (0.3 + 0.7 * Math.abs(Math.sin(T * 2 + i))) * 0.6; c.drawImage(sprite, p[0] - 10, p[1] - 10, 20, 20); } c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
      c.restore();
    }
    function drawBalloon(c, b) {
      const r = b.r * b.sc, x = b.x, y = b.y + glassY; if (r < 1) return;
      c.save(); c.translate(x, y); c.rotate(b.rot);
      // string
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, r * 1.18); c.quadraticCurveTo(Math.sin(T * 2 + b.ph) * 12, r * 1.18 + b.str * 0.5, Math.sin(T * 1.3 + b.ph) * 18, r * 1.18 + b.str); c.stroke();
      // body
      const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1); g.addColorStop(0, `hsl(${b.hue},95%,78%)`); g.addColorStop(0.5, `hsl(${b.hue},90%,55%)`); g.addColorStop(1, `hsl(${b.hue},80%,32%)`);
      c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, r * 0.88, r, 0, 0, TAU); c.fill();
      c.fillStyle = `hsl(${b.hue},80%,38%)`; c.beginPath(); c.moveTo(-r * 0.12, r * 0.98); c.lineTo(r * 0.12, r * 0.98); c.lineTo(0, r * 1.18); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-r * 0.38, -r * 0.45, r * 0.14, r * 0.26, -0.5, 0, TAU); c.fill();
      c.restore();
    }

    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; T += dt; pT += dt;
      if (mo.ok) { const tl = mo.tilt(); if (!neutral) neutral = tl; tiltX = lerp(tiltX, clamp(tl.x - neutral.x, -1, 1), 0.08); tiltY = lerp(tiltY, clamp(tl.y - neutral.y, -1, 1), 0.08); }
      for (const k of cracks) k.grow += dt * k.speed; knockGlow = Math.max(0, knockGlow - dt * 2.5);
      if (phase === 'knock' || phase === 'cracked') {
        knockT -= dt;
        if (knockT <= 0) {
          knockN++; knockT = phase === 'knock' ? Math.max(0.5, 2 - knockN * 0.25) : rnd(0.6, 1.2);
          knockAt = [rnd(W * 0.2, W * 0.8), rnd(H * 0.2, H * 0.8)]; knockGlow = 1; const hard = Math.min(1, knockN / 6);
          audio.tone(90 + hard * 30, { dur: 0.2, gain: 0.45 + hard * 0.3, to: 50, type: 'sine' }); audio.noise({ dur: 0.06, gain: 0.25 + hard * 0.3, type: 'lowpass', freq: 500 }); haptic(20 + hard * 50);
          if (knockN % 3 === 0 && phase === 'knock') { audio.tone(70, { t: 0.16, dur: 0.2, gain: 0.6, to: 40 }); haptic([0, 160, 50]); }
          if (phase === 'cracked') moreCracks(knockAt[0], knockAt[1]); if (knockN >= 5 && phase === 'knock') shake(root);
        }
        if (phase === 'cracked') { crackT += dt; if (crackT > 2.6) burst(); }
      }
      if (phase === 'hole') {
        if (pT > 2.5 && born < 26 && pT > nextB) { spawnBalloon(); nextB = pT + (born < 4 ? 0.9 : 0.32); if (born === 1) pad.gain.setTargetAtTime(0.06, audio.now(), 2); }
        if (pT > 13.5) { phase = 'lift'; pT = 0; audio.noise({ dur: 2, gain: 0.25, type: 'highpass', freq: 3000, freqTo: 600 }); haptic([30, 60, 30, 60, 30]); }
      }
      if (phase === 'lift') { const k = Math.min(1, pT / 3.2), e = k * k * (3 - 2 * k); glassY = -e * (H * 1.4); if (pT > 5 && !ended) { ended = true; api.done(); } }
      // balloons physics
      const lifting = phase === 'lift';
      for (const b of balloons) {
        if (!b.alive) continue;
        b.sc = Math.min(1, b.sc + dt * 1.6);
        const targetVy = lifting ? -(H * 1.4 / 3.2) : -(18 + b.r * 0.4);
        b.vy = lerp(b.vy, targetVy, lifting ? 0.08 : 0.02); b.vx += (tiltX * 60 + Math.sin(T * 0.8 + b.ph) * 14 - b.vx * 0.6) * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.rot = lerp(b.rot, -b.vx * 0.004 + Math.sin(T + b.ph) * 0.05, 0.05);
        if (!lifting) { if (b.y < b.r * 1.1) { b.y = b.r * 1.1; b.vy = 0; } if (b.x < b.r) b.vx += 60 * dt; if (b.x > W - b.r) b.vx -= 60 * dt; }
        for (const o of balloons) { if (o === b || !o.alive) continue; const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy), m = (b.r + o.r) * 0.95; if (d < m && d > 0) { const f = (m - d) * 2; b.vx += dx / d * f * dt * 10; b.vy += dy / d * f * dt * 10; } }
      }
      // render
      if (phase === 'knock' || phase === 'cracked') drawGlass(ctx, W, H, false);
      else {
        drawRoom(ctx, W, H); drawGlass(ctx, W, H, true);
        for (const b of balloons) if (b.alive) drawBalloon(ctx, b);
        for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.life -= dt; if (c.life <= 0) { confetti.splice(i, 1); continue; } c.vy += 500 * dt; c.vx *= 0.97; c.vy *= 0.97; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.globalAlpha = Math.min(1, c.life); ctx.fillStyle = `hsl(${c.hue},90%,60%)`; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore(); }
        ctx.save(); for (let i = shards.length - 1; i >= 0; i--) { const s = shards[i]; s.life -= dt * 1.3; if (s.life <= 0) { shards.splice(i, 1); continue; } s.x += s.vx * dt; s.y += s.vy * dt; s.sc += s.vs * dt; s.rot += s.vr * dt; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale(s.sc, s.sc); ctx.globalAlpha = s.life * 0.8; ctx.fillStyle = 'rgba(200,215,235,.5)'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1 / s.sc; ctx.beginPath(); s.poly.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); } ctx.restore();
        ctx.fillStyle = 'rgba(230,230,240,.7)'; for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i]; d.life -= dt; if (d.life <= 0) { dust.splice(i, 1); continue; } d.vy += 200 * dt; d.x += d.vx * dt; d.y += d.vy * dt; ctx.globalAlpha = Math.min(1, d.life); ctx.fillRect(d.x, d.y + glassY, d.sz, d.sz); } ctx.globalAlpha = 1;
        if (phase === 'hole' && Math.random() < 0.15 && hole) { const p = hole[Math.floor(rnd(hole.length))]; dust.push({ x: p[0], y: p[1], vx: rnd(-10, 10), vy: rnd(5, 30), life: rnd(1, 2.5), sz: rnd(1, 2) }); }
      }
    });
    return () => { stop(); pt.destroy(); cam && cam.stop(); amb.stop(); pad.stop(); cv.destroy(); };
  },
};
