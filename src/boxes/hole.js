// Day one. Something knocks from inside the phone. You break the glass. Behind it is your actual room.
// Then the room starts to fill with water. Then the water comes through the hole. Then something swims past.
import { audio, haptic, camera, makeCanvas, loop, pointers, flash, shake, rnd, TAU, lerp, clamp, glowSprite } from '../engine.js';

export default {
  name: 'hole',
  async mount(root, api) {
    const cv = makeCanvas(root, { alpha: false }), ctx = cv.ctx;
    const mo = await api.motion();
    let neutral = null, tiltX = 0, tiltY = 0;
    const sprite = glowSprite(64, '220,240,255');
    const snap = document.createElement('canvas'), snx = snap.getContext('2d');
    function takeSnap() { if (snap.width !== cv.c.width || snap.height !== cv.c.height) { snap.width = cv.c.width; snap.height = cv.c.height; } snx.drawImage(cv.c, 0, 0); }

    // ---------- state ----------
    let phase = 'knock';            // knock -> cracked -> hole -> rising -> pouring -> under -> whale -> after
    let T = 0, pT = 0;              // total time, time in phase
    let cam = null, camTried = false, vid = null, vfit = null;
    let knockT = 1.2, knockN = 0, knockAt = null, knockGlow = 0;
    let cracks = [], hole = null, holeC = null, shards = [], dust = [], crackT = 0;
    let roomWater = 0;              // 0..1 water level in the room (seen through the hole), 1 = hole bottom
    let frontWater = -0.15;         // 0..1.2 water level on our side, as fraction of screen height from bottom
    let pourStream = [], bubbles = [], ripples = [], slosh = 0, sloshV = 0, caust = [];
    let whale = null, whaleCallT = 0, deep = 0, rays = [];
    let fingers = new Map(), lastTouchBub = 0;
    const amb = audio.noiseLoop({ type: 'lowpass', freq: 120, q: 0.5, gain: 0.03 });
    const pour = audio.noiseLoop({ type: 'bandpass', freq: 900, q: 0.5, gain: 0 });
    const under = audio.pad([46, 69, 92.5], { gain: 0, type: 'sine' });
    const rise = audio.noiseLoop({ type: 'lowpass', freq: 300, q: 0.8, gain: 0 });

    async function getCam() {
      if (camTried) return; camTried = true;
      try { cam = await camera('environment'); } catch (e) { try { cam = await camera('user'); } catch (e2) { cam = null; } }
      if (cam) vid = cam.video;
    }
    function fit() { // cover-fit video into screen
      const W = cv.W, H = cv.H, vw = vid && vid.videoWidth || 640, vh = vid && vid.videoHeight || 480, s = Math.max(W / vw, H / vh);
      vfit = { s, ox: (W - vw * s) / 2, oy: (H - vh * s) / 2, vw, vh };
    }
    const pt = pointers(root, {
      down(p) {
        fingers.set(p.id, p);
        if (phase === 'knock') { getCam(); crack(p.x, p.y); }
        else if (phase === 'cracked') { if (crackT > 0.5) burst(); }
        else if (phase === 'hole' || phase === 'rising') { if (hole && inPoly(p.x, p.y, hole)) { audio.tinkle(0, 0.05); dustFall(p.x, p.y, 6); haptic(6); } else { audio.noise({ dur: 0.08, gain: 0.08, type: 'highpass', freq: 3000 }); haptic(4); } }
        else if (phase === 'under' || phase === 'whale' || phase === 'after') { ripple(p.x, p.y, 1); for (let i = 0; i < 6; i++) bubble(p.x, p.y, 1); audio.noise({ dur: 0.2, gain: 0.12, type: 'lowpass', freq: 500 }); haptic(5); }
        else if (phase === 'pouring') { ripple(p.x, p.y, 0.6); }
      },
      move(p) { fingers.set(p.id, p); if ((phase === 'under' || phase === 'whale' || phase === 'after') && T - lastTouchBub > 0.08) { lastTouchBub = T; bubble(p.x, p.y, 0.5); if (Math.random() < 0.3) ripple(p.x, p.y, 0.3); } },
      up(p) { fingers.delete(p.id); },
    });

    // ---------- geometry helpers ----------
    function inPoly(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
    function jaggedPath(cx, cy, r, n, jit) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (1 + (Math.random() - 0.5) * jit); p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.08]); } return p; }
    function crackLine(x0, y0, a, len, depth) { const pts = [[x0, y0]]; let x = x0, y = y0, ang = a, left = Math.max(len, 10); while (left > 0) { const seg = rnd(14, 40); ang += rnd(-0.22, 0.22); x += Math.cos(ang) * seg; y += Math.sin(ang) * seg; pts.push([x, y]); left -= seg; if (depth > 0 && Math.random() < 0.14) cracks.push({ pts: crackLine(x, y, ang + (Math.random() < 0.5 ? -1 : 1) * rnd(0.5, 1.1), left * rnd(0.2, 0.5), depth - 1), w: 0.6, grow: 0, speed: rnd(2, 4) }); } return pts; }
    function crack(x, y) {
      phase = 'cracked'; pT = 0; crackT = 0; knockAt = null; holeC = [x, y];
      const n = 9 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) cracks.push({ pts: crackLine(x, y, i / n * TAU + rnd(-0.3, 0.3), rnd(120, 340), 2), w: rnd(1, 1.8), grow: 0, speed: rnd(2.5, 5) });
      audio.glass(); haptic([70, 30, 50]); flash(0.25, 120); shake(root);
    }
    function moreCracks(x, y) { for (let i = 0; i < 3; i++) cracks.push({ pts: crackLine(x, y, rnd(TAU), rnd(60, 160), 1), w: 0.8, grow: 0, speed: 4 }); audio.noise({ dur: 0.15, gain: 0.4, type: 'highpass', freq: 2500 }); haptic(30); }
    function burst() {
      phase = 'hole'; pT = 0;
      const W = cv.W, H = cv.H, [x, y] = holeC, r = Math.min(W, H) * 0.34;
      hole = jaggedPath(x, y, r, 22, 0.45);
      // shards fly at the viewer
      for (let i = 0; i < 70; i++) { const a = rnd(TAU), d = rnd(0, r * 0.9); const poly = jaggedPath(0, 0, rnd(8, 34), 5, 0.8); shards.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, poly, vx: Math.cos(a) * rnd(100, 500), vy: Math.sin(a) * rnd(100, 500) - 60, sc: 1, vs: rnd(1.5, 4), rot: rnd(TAU), vr: rnd(-6, 6), life: 1 }); }
      dustFall(x, y + r * 0.6, 40);
      audio.glass(); audio.noise({ dur: 0.5, gain: 0.9, type: 'highpass', freq: 1200 }); audio.thump(0, 1); for (let i = 0; i < 14; i++) audio.tinkle(rnd(0.1, 1.2), 0.06);
      haptic([120, 40, 160, 60, 80]); flash(0.8, 220); shake(root);
      if (!neutral && mo.ok) neutral = mo.tilt();
      amb.gain.setTargetAtTime(0.06, audio.now(), 1);
    }
    function dustFall(x, y, n) { for (let i = 0; i < n; i++) dust.push({ x: x + rnd(-30, 30), y, vx: rnd(-20, 20), vy: rnd(10, 80), life: rnd(1, 3), sz: rnd(1, 3) }); }
    function bubble(x, y, k) { bubbles.push({ x: x + rnd(-6, 6), y, vx: rnd(-10, 10), vy: -rnd(30, 90) * k - 20, r: rnd(1.5, 5) * k + 1, life: rnd(2, 5), ph: rnd(TAU) }); }
    function ripple(x, y, k) { if (ripples.length > 10) ripples.shift(); ripples.push({ x, y, r: 4, v: 160 * k + 60, life: 1, k }); }
    function whaleCall(near) {
      const c = audio.ensure(), t0 = c.currentTime, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = near ? 900 : 400;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(near ? 0.5 : 0.18, t0 + 0.8); g.gain.setTargetAtTime(0, t0 + 3.6, 0.6);
      const o = c.createOscillator(), o2 = c.createOscillator(); o.type = 'sine'; o2.type = 'triangle';
      const f0 = near ? 70 : 110; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 3.2, t0 + 1.6); o.frequency.exponentialRampToValueAtTime(f0 * 1.1, t0 + 4.2);
      o2.frequency.setValueAtTime(f0 * 2, t0); o2.frequency.exponentialRampToValueAtTime(f0 * 6.4, t0 + 1.6); o2.frequency.exponentialRampToValueAtTime(f0 * 2.2, t0 + 4.2);
      const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5.5; vg.gain.value = 6; vib.connect(vg).connect(o.frequency);
      const g2 = c.createGain(); g2.gain.value = 0.25; o.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(audio.master);
      o.start(t0); o2.start(t0); vib.start(t0); o.stop(t0 + 5); o2.stop(t0 + 5); vib.stop(t0 + 5);
      if (near) { audio.tone(32, { dur: 4, gain: 0.5, to: 28 }); haptic([400, 120, 600, 100, 300]); } else haptic([60, 80, 90]);
    }

    // ---------- drawing ----------
    function drawRoom(c, W, H, waterLevelPx) { // the world behind the phone, with water rising to waterLevelPx (y from top; Infinity = none)
      if (vid && vid.readyState >= 2) {
        if (!vfit || vfit.vw !== vid.videoWidth) fit();
        const { s, ox, oy } = vfit;
        const px = tiltX * 18, py = tiltY * 18; // parallax
        if (waterLevelPx >= H || waterLevelPx < 0) { c.drawImage(vid, ox + px, oy + py, vfit.vw * s, vfit.vh * s); if (waterLevelPx < 0) { const wg = c.createLinearGradient(0, 0, 0, H); wg.addColorStop(0, 'rgba(40,120,150,.3)'); wg.addColorStop(1, 'rgba(5,30,60,.7)'); c.fillStyle = wg; c.fillRect(0, 0, W, H); } }
        else {
          // dry part
          const dryH = Math.max(0, waterLevelPx);
          if (dryH > 0) c.drawImage(vid, 0, Math.max(0, (-oy - py) / s), vfit.vw, dryH / s, ox + px, 0, vfit.vw * s, dryH);
          // wet part in refracted strips
          const strip = 10;
          for (let y = Math.max(0, waterLevelPx); y < H; y += strip) {
            const depth = (y - waterLevelPx) / H;
            let off = Math.sin(y * 0.045 + T * 2.2) * 5 * (0.3 + depth) + Math.sin(y * 0.011 - T * 1.1) * 9 * depth;
            for (const r of ripples) { const dy = y - r.y; if (Math.abs(dy) < r.r + 20) { const d = Math.abs(dy); off += Math.sin((d - r.r) * 0.25) * 8 * r.life * r.k; } }
            const sy = (y - oy - py) / s, sh = strip / s;
            c.drawImage(vid, 0, clamp(sy, 0, vfit.vh - sh), vfit.vw, sh, ox + px + off, y, vfit.vw * s, strip + 1);
          }
          // tint and depth darkening
          const wg = c.createLinearGradient(0, waterLevelPx, 0, H); wg.addColorStop(0, 'rgba(40,120,150,.28)'); wg.addColorStop(1, 'rgba(5,30,60,.75)'); c.fillStyle = wg; c.fillRect(0, waterLevelPx, W, H - waterLevelPx);
          // caustics
          c.globalCompositeOperation = 'lighter';
          for (const k of caust) { const x = k.x * W + Math.sin(T * k.s + k.ph) * 40, y = waterLevelPx + k.y * (H - waterLevelPx); const sz = k.sz * W; c.globalAlpha = 0.07 + 0.05 * Math.sin(T * 3 + k.ph); c.drawImage(sprite, x - sz / 2, y - sz / 2, sz, sz); }
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          // surface line
          if (waterLevelPx > 0) { c.strokeStyle = 'rgba(220,245,255,.8)'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x <= W; x += 6) c.lineTo(x, waterLevelPx + Math.sin(x * 0.04 + T * 3) * 3 + Math.sin(x * 0.013 - T * 1.7) * 4); c.stroke(); }
        }
      } else { // no camera: a dark hallway of light
        const g = c.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.4, H); g.addColorStop(0, '#3a3f55'); g.addColorStop(0.5, '#141828'); g.addColorStop(1, '#05060c'); c.fillStyle = g; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 9; i++) { const y = H * 0.1 + i * H * 0.1 + Math.sin(T + i) * 3; c.strokeStyle = `rgba(200,210,255,${0.05 + 0.03 * Math.sin(T * 2 + i)})`; c.lineWidth = 1; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        if (waterLevelPx < H) { const wg = c.createLinearGradient(0, waterLevelPx, 0, H); wg.addColorStop(0, 'rgba(40,120,150,.5)'); wg.addColorStop(1, 'rgba(5,30,60,.9)'); c.fillStyle = wg; c.fillRect(0, waterLevelPx, W, H - waterLevelPx); c.strokeStyle = 'rgba(220,245,255,.8)'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x <= W; x += 6) c.lineTo(x, waterLevelPx + Math.sin(x * 0.04 + T * 3) * 3); c.stroke(); }
      }
    }
    function glassPath(c, W, H, withHole) { c.beginPath(); c.rect(0, 0, W, H); if (withHole && hole) { hole.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); } }
    let submergedNow = false;
    function drawGlass(c, W, H, withHole) {
      // obsidian glass with a sheen that slides with tilt
      c.save(); glassPath(c, W, H, withHole); c.clip('evenodd');
      c.fillStyle = submergedNow ? '#0b1b2a' : '#06060a'; c.fillRect(0, 0, W, H);
      const sx = W * (0.3 + tiltX * 0.5), sy = H * (0.25 + tiltY * 0.5);
      const sh = c.createLinearGradient(sx - W * 0.6, sy - H * 0.3, sx + W * 0.6, sy + H * 0.3); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.45, 'rgba(255,255,255,.035)'); sh.addColorStop(0.5, 'rgba(255,255,255,.09)'); sh.addColorStop(0.55, 'rgba(255,255,255,.035)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.fillRect(0, 0, W, H);
      const ed = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); ed.addColorStop(0, 'rgba(0,0,0,0)'); ed.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = ed; c.fillRect(0, 0, W, H);
      if (knockGlow > 0 && knockAt) { const g = c.createRadialGradient(knockAt[0], knockAt[1], 0, knockAt[0], knockAt[1], 140); g.addColorStop(0, `rgba(255,220,170,${knockGlow * 0.35})`); g.addColorStop(1, 'rgba(255,220,170,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      // light leaking through cracks
      if (cracks.length) { c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; for (const k of cracks) { const n = Math.min(k.pts.length, Math.max(2, Math.ceil(k.pts.length * Math.min(1, k.grow)))); c.strokeStyle = `rgba(255,235,200,${withHole ? 0.12 : 0.22})`; c.lineWidth = k.w * 6; c.beginPath(); for (let i = 0; i < n; i++) i ? c.lineTo(k.pts[i][0], k.pts[i][1]) : c.moveTo(k.pts[i][0], k.pts[i][1]); c.stroke(); } c.globalCompositeOperation = 'source-over'; }
      for (const k of cracks) { const n = Math.min(k.pts.length, Math.max(2, Math.ceil(k.pts.length * Math.min(1, k.grow)))); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = k.w; c.beginPath(); for (let i = 0; i < n; i++) i ? c.lineTo(k.pts[i][0], k.pts[i][1]) : c.moveTo(k.pts[i][0], k.pts[i][1]); c.stroke(); }
      c.restore();
      if (withHole && hole) { // thick broken rim with glints
        c.save(); c.beginPath(); hole.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
        c.lineJoin = 'miter'; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2.5; c.stroke();
        c.strokeStyle = 'rgba(180,200,230,.35)'; c.lineWidth = 9; c.stroke();
        c.globalCompositeOperation = 'lighter'; for (let i = 0; i < hole.length; i += 2) { const p = hole[i], a = 0.3 + 0.7 * Math.abs(Math.sin(T * 2 + i)); c.globalAlpha = a * 0.6; c.drawImage(sprite, p[0] - 10, p[1] - 10, 20, 20); } c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        c.restore();
      }
    }
    function drawFrontWater(c, W, H) { // water on our side of the glass, sloshing with tilt
      const lvl = H * (1 - frontWater); if (frontWater <= 0) return;
      const tilt = Math.atan2(slosh, 1) * 0.6; // surface angle
      c.save(); c.beginPath(); c.moveTo(0, H); const base = lvl;
      for (let x = 0; x <= W; x += 6) { const y = base + (x - W / 2) * Math.tan(tilt) + Math.sin(x * 0.03 + T * 4) * 4 + Math.sin(x * 0.009 - T * 2.3) * 7 + Math.cos(x * 0.05 + T * 7) * 1.5; c.lineTo(x, y); }
      c.lineTo(W, H); c.closePath(); c.clip();
      // what's under our water: the glass + room, refracted by strips
      takeSnap(); const strip = 8;
      for (let y = Math.max(0, lvl - W * 0.3); y < H; y += strip) {
        let off = Math.sin(y * 0.05 + T * 3) * 4 + Math.sin(y * 0.012 - T * 1.4) * 7;
        for (const r of ripples) { const dy = y - r.y; if (Math.abs(dy) < r.r + 20) off += Math.sin((Math.abs(dy) - r.r) * 0.25) * 10 * r.life * r.k; }
        c.drawImage(snap, 0, y * cv.dpr, snap.width, strip * cv.dpr, off, y, W, strip + 1);
      }
      const wg = c.createLinearGradient(0, lvl, 0, H); wg.addColorStop(0, 'rgba(60,150,180,.35)'); wg.addColorStop(1, 'rgba(0,25,55,.7)'); c.fillStyle = wg; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'lighter';
      for (const k of caust) { const x = k.x * W + Math.sin(T * k.s + k.ph) * 50, y = lvl + k.y * (H - lvl); const sz = k.sz * W * 1.3; c.globalAlpha = 0.08 + 0.05 * Math.sin(T * 2.5 + k.ph); c.drawImage(sprite, x - sz / 2, y - sz / 2, sz, sz); }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.restore();
      // surface highlight
      if (frontWater < 1.05) { c.strokeStyle = 'rgba(230,250,255,.9)'; c.lineWidth = 2.5; c.beginPath(); for (let x = 0; x <= W; x += 6) { const y = base + (x - W / 2) * Math.tan(tilt) + Math.sin(x * 0.03 + T * 4) * 4 + Math.sin(x * 0.009 - T * 2.3) * 7 + Math.cos(x * 0.05 + T * 7) * 1.5; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.strokeStyle = 'rgba(120,190,220,.35)'; c.lineWidth = 10; c.stroke(); }
    }
    function drawWhale(c, W, H) {
      if (!whale) return; const w = whale, L = w.L, x = w.x, y = w.y + Math.sin(T * 0.7) * 10, dir = w.dir, a = Math.sin(T * 0.9) * 0.04;
      c.save(); c.translate(x, y); c.rotate(a); c.scale(dir, 1);
      const body = cc => { cc.beginPath(); cc.moveTo(-L * 0.5, 0); cc.bezierCurveTo(-L * 0.45, -L * 0.12, -L * 0.1, -L * 0.16, L * 0.2, -L * 0.1); cc.bezierCurveTo(L * 0.35, -L * 0.07, L * 0.46, -L * 0.03, L * 0.5, 0); cc.bezierCurveTo(L * 0.46, L * 0.05, L * 0.35, L * 0.11, L * 0.15, L * 0.13); cc.bezierCurveTo(-L * 0.1, L * 0.16, -L * 0.42, L * 0.1, -L * 0.5, 0); cc.closePath();
        // fluke
        cc.moveTo(-L * 0.47, 0); cc.bezierCurveTo(-L * 0.55, -L * 0.1, -L * 0.62, -L * 0.14, -L * 0.66, -L * 0.1); cc.bezierCurveTo(-L * 0.6, -L * 0.03, -L * 0.6, L * 0.03, -L * 0.66, L * 0.1); cc.bezierCurveTo(-L * 0.62, L * 0.14, -L * 0.55, L * 0.1, -L * 0.47, 0); cc.closePath();
        // fin
        cc.moveTo(L * 0.05, L * 0.1); cc.bezierCurveTo(L * 0.0, L * 0.22, -L * 0.08, L * 0.26, -L * 0.1, L * 0.2); cc.bezierCurveTo(-L * 0.06, L * 0.15, -L * 0.04, L * 0.12, -L * 0.02, L * 0.1); cc.closePath(); };
      for (let i = 3; i >= 0; i--) { c.save(); c.scale(1 + i * 0.025, 1 + i * 0.04); c.fillStyle = i ? `rgba(90,150,190,${0.12})` : 'rgba(16,34,52,.95)'; body(c); c.fill(); c.restore(); }
      c.strokeStyle = 'rgba(160,220,255,.35)'; c.lineWidth = L * 0.004; body(c); c.stroke();
      // eye
      const ex = L * 0.3, ey = -L * 0.02, er = L * 0.014, bl = w.blink; c.fillStyle = 'rgba(190,210,220,.9)'; c.beginPath(); c.ellipse(ex, ey, er * 1.6, er * (1 - bl), 0, 0, TAU); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.ellipse(ex + er * 0.3, ey, er * 0.9, er * (1 - bl) * 0.9, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(ex + er * 0.1, ey - er * 0.4, er * 0.3 * (1 - bl), 0, TAU); c.fill();
      c.restore();
    }

    for (let i = 0; i < 7; i++) caust.push({ x: rnd(), y: rnd(), sz: rnd(0.4, 0.9), s: rnd(0.3, 0.8), ph: rnd(TAU) });
    for (let i = 0; i < 7; i++) rays.push({ x: rnd(0.1, 0.9), w: rnd(0.08, 0.25), a: rnd(-0.25, 0.25), ph: rnd(TAU) });

    // ---------- main loop ----------
    const stop = loop((dt, t) => {
      const W = cv.W, H = cv.H; T += dt; pT += dt;
      if (mo.ok) { const tl = mo.tilt(); if (!neutral) neutral = tl; tiltX = lerp(tiltX, clamp(tl.x - neutral.x, -1, 1), 0.08); tiltY = lerp(tiltY, clamp(tl.y - neutral.y, -1, 1), 0.08); }
      // slosh spring driven by tilt
      sloshV += ((tiltX * 1.2) - slosh) * 14 * dt - sloshV * 2.2 * dt; slosh += sloshV * dt;
      for (const k of cracks) k.grow += dt * k.speed;
      knockGlow = Math.max(0, knockGlow - dt * 2.5);

      // ---- phase logic ----
      if (phase === 'knock' || phase === 'cracked') {
        knockT -= dt;
        if (knockT <= 0) {
          knockN++; knockT = phase === 'knock' ? Math.max(0.55, 2.2 - knockN * 0.25) : rnd(0.6, 1.2);
          knockAt = [rnd(W * 0.2, W * 0.8), rnd(H * 0.2, H * 0.8)]; knockGlow = 1;
          const hard = Math.min(1, knockN / 6);
          audio.tone(70 + hard * 30, { dur: 0.25, gain: 0.5 + hard * 0.4, to: 40, type: 'sine' }); audio.noise({ dur: 0.08, gain: 0.3 + hard * 0.4, type: 'lowpass', freq: 400 }); haptic(25 + hard * 60);
          if (knockN % 3 === 0 && phase === 'knock') { audio.tone(60, { t: 0.18, dur: 0.25, gain: 0.7, to: 35 }); haptic([0, 180, 60]); }
          if (phase === 'cracked') moreCracks(knockAt[0], knockAt[1]);
          if (knockN >= 5 && phase === 'knock') shake(root);
        }
        if (phase === 'cracked') { crackT += dt; if (crackT > 3.2) burst(); }
      }
      if (phase === 'hole') { if (pT > 5) { phase = 'rising'; pT = 0; rise.gain.setTargetAtTime(0.1, audio.now(), 2); } }
      if (phase === 'rising') { roomWater = clamp(pT / 11, 0, 1); rise.filter.frequency.setTargetAtTime(300 + roomWater * 900, audio.now(), 0.5); if (roomWater >= 1) { phase = 'pouring'; pT = 0; pour.gain.setTargetAtTime(0.3, audio.now(), 0.5); audio.thump(0, 0.5); haptic([40, 40, 40, 40, 80]); } }
      if (phase === 'pouring') {
        frontWater = clamp(pT / 12, 0, 1.2); pour.gain.setTargetAtTime(frontWater < 1 ? 0.3 : 0, audio.now(), 0.5); under.gain.setTargetAtTime(0.03 + frontWater * 0.06, audio.now(), 1);
        if (frontWater >= 1.15) { phase = 'under'; pT = 0; amb.gain.setTargetAtTime(0, audio.now(), 1); rise.stop(); whaleCallT = 2.5; }
        if (Math.random() < 0.5) haptic(3);
      }
      if (phase === 'under' || phase === 'whale' || phase === 'after') {
        if (Math.random() < 0.08) bubble(rnd(W), H + 10, rnd(0.3, 1));
        whaleCallT -= dt;
        if (phase === 'under' && pT > 4) { phase = 'whale'; pT = 0; whale = { x: -W * 1.3, y: H * 0.5, L: W * 2.3, dir: 1, blink: 0, called: false }; whaleCall(false); }
        if (phase === 'whale') {
          const w = whale; w.x += dt * W * 0.09; deep = clamp(1 - Math.abs(w.x - W / 2) / (W * 1.4), 0, 1);
          if (!w.called && w.x > W * 0.15) { w.called = true; whaleCall(true); flash(0.08, 400); }
          w.blink = w.x > W * 0.35 && w.x < W * 0.6 ? Math.max(0, Math.sin((w.x - W * 0.35) / (W * 0.25) * Math.PI)) : 0;
          if (Math.random() < 0.3) bubble(w.x - w.L * 0.5 + rnd(w.L), w.y + rnd(-40, 40), 0.6);
          if (w.x > W * 2.4) { phase = 'after'; pT = 0; whale = null; whaleCallT = rnd(10, 18); }
        }
        if (phase === 'after' && whaleCallT <= 0) { whaleCallT = rnd(14, 26); whaleCall(false); }
      }

      // ---- render ----
      const roomLevel = phase === 'rising' || phase === 'pouring' || phase === 'under' || phase === 'whale' || phase === 'after'
        ? (holeC ? (holeC[1] + Math.min(W, H) * 0.37) - roomWater * (holeC[1] + Math.min(W, H) * 0.37) * (phase === 'rising' ? 1 : 1) - (phase !== 'rising' ? (pT * 0) : 0) : H) : Infinity;
      const submerged = phase === 'under' || phase === 'whale' || phase === 'after'; submergedNow = submerged;
      const lvlPx = submerged ? -50 : (phase === 'pouring' ? Math.max(-50, holeC[1] + Math.min(W, H) * 0.37 - roomWater * (holeC[1] + Math.min(W, H) * 0.37) - pT * 40) : roomLevel);
      if (phase === 'knock' || phase === 'cracked') { drawGlass(ctx, W, H, false); }
      else {
        drawRoom(ctx, W, H, lvlPx);
        // whale swims in the room, behind the glass
        drawGlass(ctx, W, H, true);
        if (whale) { ctx.save(); ctx.globalAlpha = 0.92; drawWhale(ctx, W, H); ctx.restore(); if (deep > 0) { ctx.fillStyle = `rgba(0,5,15,${deep * 0.3})`; ctx.fillRect(0, 0, W, H); } }
        // light rays when submerged
        if (submerged) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const r of rays) { const x = r.x * W + Math.sin(T * 0.3 + r.ph) * 30, a = 0.05 + 0.04 * Math.sin(T * 0.8 + r.ph); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(180,230,255,${a})`); g.addColorStop(1, 'rgba(180,230,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - r.w * W * 0.3, 0); ctx.lineTo(x + r.w * W * 0.3, 0); ctx.lineTo(x + r.w * W + r.a * H, H); ctx.lineTo(x - r.w * W + r.a * H, H); ctx.closePath(); ctx.fill(); } ctx.restore(); }
        // pour stream out of the hole
        if (phase === 'pouring' && frontWater < 1) {
          const bottom = hole.reduce((m, p) => p[1] > m[1] ? p : m, hole[0]); for (let i = 0; i < 6; i++) pourStream.push({ x: bottom[0] + rnd(-24, 24), y: bottom[1], vx: rnd(-30, 30), vy: rnd(80, 200), r: rnd(2, 6) });
          ctx.fillStyle = 'rgba(190,230,245,.8)';
          for (let i = pourStream.length - 1; i >= 0; i--) { const s = pourStream[i]; s.vy += 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.y > H * (1 - frontWater)) { pourStream.splice(i, 1); if (Math.random() < 0.04) ripple(s.x, H * (1 - frontWater), 0.3); continue; } ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
          const fg = ctx.createLinearGradient(bottom[0], bottom[1], bottom[0], H); fg.addColorStop(0, 'rgba(200,235,250,.5)'); fg.addColorStop(1, 'rgba(200,235,250,0)'); ctx.fillStyle = fg; ctx.fillRect(bottom[0] - 18, bottom[1], 36, H);
        }
        if (phase === 'pouring' || submerged) {
          if (submerged) { // whole screen is water: refract everything once more, gently
            takeSnap(); const strip = 16; for (let y = 0; y < H; y += strip) { let off = Math.sin(y * 0.03 + T * 1.5) * 3; for (const r of ripples) { const dy = Math.abs(y - r.y); if (dy < r.r + 24) off += Math.sin((dy - r.r) * 0.22) * 9 * r.life * r.k; } if (Math.abs(off) > 0.5) ctx.drawImage(snap, 0, y * cv.dpr, snap.width, strip * cv.dpr, off, y, W, strip + 1); }
            ctx.fillStyle = `rgba(10,50,80,${0.22 + deep * 0.2})`; ctx.fillRect(0, 0, W, H);
          } else drawFrontWater(ctx, W, H);
        }
        // shards flying at you
        ctx.save(); for (let i = shards.length - 1; i >= 0; i--) { const s = shards[i]; s.life -= dt * 1.3; if (s.life <= 0) { shards.splice(i, 1); continue; } s.x += s.vx * dt; s.y += s.vy * dt; s.sc += s.vs * dt; s.rot += s.vr * dt; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale(s.sc, s.sc); ctx.globalAlpha = s.life * 0.8; ctx.fillStyle = 'rgba(200,215,235,.5)'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1 / s.sc; ctx.beginPath(); s.poly.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); } ctx.restore();
        // dust from the rim
        ctx.fillStyle = 'rgba(230,230,240,.7)'; for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i]; d.life -= dt; if (d.life <= 0) { dust.splice(i, 1); continue; } d.vy += 200 * dt; d.x += d.vx * dt; d.y += d.vy * dt; ctx.globalAlpha = Math.min(1, d.life); ctx.fillRect(d.x, d.y, d.sz, d.sz); } ctx.globalAlpha = 1;
        if (phase === 'hole' && Math.random() < 0.15 && hole) { const p = hole[Math.floor(rnd(hole.length))]; dust.push({ x: p[0], y: p[1], vx: rnd(-10, 10), vy: rnd(5, 30), life: rnd(1, 2.5), sz: rnd(1, 2) }); }
        // bubbles and ripples (front)
        ctx.strokeStyle = 'rgba(220,245,255,.7)'; ctx.lineWidth = 1.2;
        for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.life -= dt; b.x += (b.vx + Math.sin(T * 4 + b.ph) * 15) * dt; b.y += b.vy * dt; b.vy -= 30 * dt; if (b.life <= 0 || b.y < -10) { bubbles.splice(i, 1); continue; } ctx.globalAlpha = Math.min(1, b.life); ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
        for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.r += r.v * dt; r.life -= dt * 0.7; if (r.life <= 0) { ripples.splice(i, 1); continue; } ctx.strokeStyle = `rgba(230,250,255,${r.life * 0.5})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); }
      }
    });
    return () => { stop(); pt.destroy(); cam && cam.stop(); amb.stop(); pour.stop(); under.stop(); try { rise.stop(); } catch (e) {} cv.destroy(); };
  },
};
