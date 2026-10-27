// Shared toys: sound synthesis, sensors, canvas, pointers, haptics. No assets, everything synthesized.

export const audio = {
  ctx: null, master: null,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  now() { return this.ensure().currentTime; },
  midi(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  // short plucked note (music box / bell)
  pluck(m, { t = 0, dur = 0.9, gain = 0.25, type = 'sine', detune = 0 } = {}) {
    const c = this.ensure(), t0 = c.currentTime + t;
    const f = this.midi(m);
    const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 3.01;
    const g = c.createGain(), g2 = c.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    g2.gain.setValueAtTime(0, t0); g2.gain.linearRampToValueAtTime(gain * 0.25, t0 + 0.002); g2.gain.exponentialRampToValueAtTime(0.0005, t0 + dur * 0.3);
    o.connect(g).connect(this.master); o2.connect(g2).connect(this.master);
    o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
  },
  tone(freq, { t = 0, dur = 0.5, gain = 0.2, type = 'sine', to = null, attack = 0.01 } = {}) {
    const c = this.ensure(), t0 = c.currentTime + t;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  },
  _noiseBuf: null,
  noiseBuffer() {
    if (this._noiseBuf) return this._noiseBuf;
    const c = this.ensure(), len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (this._noiseBuf = b);
  },
  noise({ t = 0, dur = 0.3, gain = 0.4, type = 'highpass', freq = 2000, q = 0.7, attack = 0.002, freqTo = null } = {}) {
    const c = this.ensure(), t0 = c.currentTime + t;
    const s = c.createBufferSource(); s.buffer = this.noiseBuffer(); s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t0); s.stop(t0 + dur + 0.05);
  },
  // continuous noise source you can modulate: returns {gain, filter, stop}
  noiseLoop({ type = 'bandpass', freq = 800, q = 1, gain = 0 } = {}) {
    const c = this.ensure();
    const s = c.createBufferSource(); s.buffer = this.noiseBuffer(); s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = gain;
    s.connect(f).connect(g).connect(this.master); s.start();
    return { gain: g.gain, filter: f, stop() { try { g.gain.setTargetAtTime(0, c.currentTime, 0.05); s.stop(c.currentTime + 0.3); } catch (e) {} } };
  },
  // sustained pad: returns {gain, stop}
  pad(freqs, { gain = 0.08, type = 'sine' } = {}) {
    const c = this.ensure(); const g = c.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(gain, c.currentTime, 0.8);
    const oscs = freqs.map((f, i) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = (i % 2 ? 4 : -4); o.connect(g); o.start(); return o; });
    g.connect(this.master);
    return { gain: g.gain, oscs, stop() { g.gain.setTargetAtTime(0, c.currentTime, 0.5); oscs.forEach(o => o.stop(c.currentTime + 2)); } };
  },
  glass(t = 0) { // glass crack
    this.noise({ t, dur: 0.12, gain: 0.9, type: 'highpass', freq: 2500 });
    this.noise({ t, dur: 0.5, gain: 0.5, type: 'bandpass', freq: 6000, q: 2 });
    for (let i = 0; i < 6; i++) this.tone(3000 + Math.random() * 5000, { t: t + Math.random() * 0.15, dur: 0.2 + Math.random() * 0.3, gain: 0.08, type: 'sine' });
    this.noise({ t, dur: 0.6, gain: 0.5, type: 'lowpass', freq: 200 });
  },
  tinkle(t = 0, gain = 0.08) { this.tone(2500 + Math.random() * 5000, { t, dur: 0.25 + Math.random() * 0.4, gain }); },
  thump(t = 0, gain = 0.8) { this.tone(120, { t, dur: 0.5, gain, to: 35 }); this.noise({ t, dur: 0.4, gain: gain * 0.5, type: 'lowpass', freq: 300 }); },
};

export function haptic(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

// Orientation / motion. Call inside a user gesture (iOS). Returns live state object.
let _motion = null;
export async function motion() {
  if (_motion) return _motion;
  const s = { ok: false, beta: 90, gamma: 0, ax: 0, ay: 0, az: 0, shake: 0, tilt() { // screen-space gravity (x right, y down), unit-ish
      const b = Math.max(-90, Math.min(90, this.beta)) * Math.PI / 180, g = this.gamma * Math.PI / 180;
      return { x: Math.sin(g), y: Math.sin(b) }; } };
  _motion = s;
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const r = await DeviceMotionEvent.requestPermission(); if (r !== 'granted') return s;
    }
  } catch (e) { }
  window.addEventListener('deviceorientation', e => { if (e.beta == null) return; s.ok = true; s.beta = e.beta; s.gamma = e.gamma; });
  window.addEventListener('devicemotion', e => {
    const a = e.acceleration; if (!a || a.x == null) return; s.ok = true;
    s.ax = a.x; s.ay = a.y; s.az = a.z;
    const m = Math.hypot(a.x, a.y, a.z); s.shake = Math.max(s.shake * 0.9, m);
  });
  return s;
}

export async function mic() {
  const c = audio.ensure();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
  const src = c.createMediaStreamSource(stream);
  const an = c.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.5; src.connect(an);
  const buf = new Float32Array(an.fftSize), fr = new Uint8Array(an.frequencyBinCount);
  return {
    level() { an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); },
    spectrum() { an.getByteFrequencyData(fr); return fr; },
    pitch() { // autocorrelation, returns Hz or 0
      an.getFloatTimeDomainData(buf); const n = buf.length, sr = c.sampleRate; let best = -1, bestV = 0;
      const minLag = Math.floor(sr / 1000), maxLag = Math.floor(sr / 70);
      let energy = 0; for (let i = 0; i < n; i++) energy += buf[i] * buf[i]; if (energy / n < 0.0004) return 0;
      for (let lag = minLag; lag < maxLag; lag++) { let s = 0; for (let i = 0; i < n - lag; i += 2) s += buf[i] * buf[i + lag]; if (s > bestV) { bestV = s; best = lag; } }
      return best > 0 && bestV / energy > 0.3 ? sr / best : 0;
    },
    stop() { stream.getTracks().forEach(t => t.stop()); },
  };
}

export async function camera(facing = 'user') {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  const v = document.createElement('video'); v.srcObject = stream; v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  await v.play();
  return { video: v, stop() { stream.getTracks().forEach(t => t.stop()); } };
}

export function makeCanvas(root, { alpha = true } = {}) {
  const c = document.createElement('canvas'); root.appendChild(c);
  c.style.cssText = 'position:absolute;inset:0;display:block;touch-action:none';
  const ctx = c.getContext('2d', { alpha });
  const o = { c, ctx, W: 0, H: 0, dpr: 1, onresize: null };
  function resize() {
    o.dpr = Math.min(window.devicePixelRatio || 1, 2);
    o.W = root.clientWidth || window.innerWidth; o.H = root.clientHeight || window.innerHeight;
    c.width = Math.round(o.W * o.dpr); c.height = Math.round(o.H * o.dpr);
    c.style.width = o.W + 'px'; c.style.height = o.H + 'px';
    ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
    o.onresize && o.onresize();
  }
  resize(); window.addEventListener('resize', resize);
  o.destroy = () => { window.removeEventListener('resize', resize); c.remove(); };
  return o;
}

// requestAnimationFrame loop with dt (seconds) and elapsed time
export function loop(fn) {
  let id = 0, last = performance.now(), t = 0, alive = true;
  const step = now => { if (!alive) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; fn(dt, t); id = requestAnimationFrame(step); };
  id = requestAnimationFrame(step);
  return () => { alive = false; cancelAnimationFrame(id); };
}

// pointer tracking. handlers get (p, pointersMap)
export function pointers(el, h = {}) {
  const act = new Map();
  const pos = e => { const r = el.getBoundingClientRect(); return { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; };
  const down = e => { e.preventDefault(); const p = pos(e); p.x0 = p.x; p.y0 = p.y; p.t0 = p.t; p.px = p.x; p.py = p.y; act.set(p.id, p); h.down && h.down(p, act); };
  const move = e => { const q = act.get(e.pointerId); if (!q) return; const p = pos(e); q.px = q.x; q.py = q.y; q.x = p.x; q.y = p.y; q.t = p.t; h.move && h.move(q, act); };
  const up = e => { const q = act.get(e.pointerId); if (!q) return; act.delete(e.pointerId); h.up && h.up(q, act); };
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  return { active: act, destroy() { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('pointerleave', up); } };
}

// Big pulsing glyph asking for a sense. Resolves with the result of fn() or null if denied/unsupported.
export function ask(root, svg, fn) {
  return new Promise(res => {
    const g = document.createElement('div'); g.className = 'glyph'; g.innerHTML = svg; root.appendChild(g);
    let done = false;
    const go = async e => { e && e.preventDefault(); if (done) return; done = true; g.style.animation = 'none'; g.style.opacity = '.3';
      let r = null; try { r = await fn(); } catch (err) { r = null; } g.remove(); res(r); };
    g.addEventListener('pointerdown', go);
  });
}
export const GLYPH = {
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  tilt: '<svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2 12c2-3 4-3 5 0M22 12c-2 3-4 3-5 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M8 13V5a1.5 1.5 0 0 1 3 0v6V4a1.5 1.5 0 0 1 3 0v7V6a1.5 1.5 0 0 1 3 0v9c0 3-2 6-6 6s-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.6-1.4L8 13z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};

export const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;
// deterministic rng from day number so a day looks the same on every open
export function seeded(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
// pre-rendered soft glow sprite
export function glowSprite(size, color = '255,255,255') {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${color},1)`); g.addColorStop(0.25, `rgba(${color},.5)`); g.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}
export function flash(alpha = 1, ms = 120) { const f = document.getElementById('flash'); f.style.transition = 'none'; f.style.opacity = alpha; requestAnimationFrame(() => { f.style.transition = `opacity ${ms}ms`; f.style.opacity = 0; }); }
export function shake(el = document.body) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
