// Small WebGL layer: context with float render targets, shader programs, ping-pong framebuffers, fullscreen blits.
export function createGL(canvas) {
  const params = { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
  let gl = canvas.getContext('webgl2', params), isGL2 = !!gl;
  if (!gl) { gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params); }
  if (!gl) return null;
  let halfFloat, supportLinear, formatRGBA, formatRG, formatR, texType;
  if (isGL2) { gl.getExtension('EXT_color_buffer_float'); supportLinear = !!gl.getExtension('OES_texture_float_linear'); texType = gl.HALF_FLOAT; }
  else { halfFloat = gl.getExtension('OES_texture_half_float'); supportLinear = !!gl.getExtension('OES_texture_half_float_linear'); texType = halfFloat ? halfFloat.HALF_FLOAT_OES : gl.UNSIGNED_BYTE; }
  gl.clearColor(0, 0, 0, 1);
  function supported(internalFormat, format, type) {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.deleteFramebuffer(fbo); gl.deleteTexture(tex); return ok;
  }
  function pick(internalFormat, format, type) {
    if (supported(internalFormat, format, type)) return { internalFormat, format };
    if (isGL2) { if (internalFormat === gl.R16F) return pick(gl.RG16F, gl.RG, type); if (internalFormat === gl.RG16F) return pick(gl.RGBA16F, gl.RGBA, type); }
    return null;
  }
  if (isGL2) { formatRGBA = pick(gl.RGBA16F, gl.RGBA, texType); formatRG = pick(gl.RG16F, gl.RG, texType); formatR = pick(gl.R16F, gl.RED, texType); }
  else { formatRGBA = pick(gl.RGBA, gl.RGBA, texType); formatRG = formatRGBA; formatR = formatRGBA; }
  if (!formatRGBA) { texType = gl.UNSIGNED_BYTE; formatRGBA = { internalFormat: gl.RGBA, format: gl.RGBA }; formatRG = formatRGBA; formatR = formatRGBA; supportLinear = true; }
  // fullscreen quad
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);
  const blit = target => { if (target == null) { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); } else { gl.viewport(0, 0, target.width, target.height); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); } gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0); };
  function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src); return s; }
  const VS = compile(gl.VERTEX_SHADER, `precision highp float; attribute vec2 aPosition; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform vec2 texelSize;
    void main () { vUv = aPosition * 0.5 + 0.5; vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0); vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y); gl_Position = vec4(aPosition, 0.0, 1.0); }`);
  function program(fsSrc, vs = VS) {
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc)); gl.bindAttribLocation(p, 0, 'aPosition'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u, use() { gl.useProgram(p); } };
  }
  function fbo(w, h, fmt, filter) {
    gl.activeTexture(gl.TEXTURE0); const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internalFormat, w, h, 0, fmt.format, texType, null);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo: f, width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h, attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
  }
  function doubleFbo(w, h, fmt, filter) { let a = fbo(w, h, fmt, filter), b = fbo(w, h, fmt, filter); return { width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h, get read() { return a; }, get write() { return b; }, swap() { const t = a; a = b; b = t; } }; }
  const filter = supportLinear ? gl.LINEAR : gl.NEAREST;
  return { gl, isGL2, blit, program, fbo, doubleFbo, formatRGBA, formatRG, formatR, filter, supportLinear };
}

// Stable GPU fluid (Stam) with vorticity confinement. Dye in RGB, velocity in RG.
export function createFluid(G, { simRes = 128, dyeRes = 512 } = {}) {
  const { gl, blit, program, doubleFbo, fbo, formatRGBA, formatRG, formatR, filter } = G;
  const F = `precision mediump float; precision mediump sampler2D; varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;`;
  const copyP = program(`precision mediump float; varying highp vec2 vUv; uniform sampler2D uTexture; void main(){ gl_FragColor = texture2D(uTexture, vUv); }`);
  const clearP = program(`precision mediump float; varying highp vec2 vUv; uniform sampler2D uTexture; uniform float value; void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }`);
  const splatP = program(`precision highp float; varying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;
    void main(){ vec2 p = vUv - point.xy; p.x *= aspectRatio; vec3 splat = exp(-dot(p, p) / radius) * color; vec3 base = texture2D(uTarget, vUv).xyz; gl_FragColor = vec4(base + splat, 1.0); }`);
  const advP = program(`precision highp float; precision highp sampler2D; varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform float dt; uniform float dissipation;
    void main(){ vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize; vec4 result = texture2D(uSource, coord); float decay = 1.0 + dissipation * dt; gl_FragColor = result / decay; }`);
  const divP = program(F + `uniform sampler2D uVelocity; void main(){ float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x; float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y; vec2 C = texture2D(uVelocity, vUv).xy; if (vL.x < 0.0) { L = -C.x; } if (vR.x > 1.0) { R = -C.x; } if (vT.y > 1.0) { T = -C.y; } if (vB.y < 0.0) { B = -C.y; } float div = 0.5 * (R - L + T - B); gl_FragColor = vec4(div, 0.0, 0.0, 1.0); }`);
  const curlP = program(F + `uniform sampler2D uVelocity; void main(){ float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y; float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x; float vorticity = R - L - T + B; gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0); }`);
  const vortP = program(`precision highp float; precision highp sampler2D; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
    void main(){ float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x; float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x; float C = texture2D(uCurl, vUv).x; vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); force /= length(force) + 0.0001; force *= curl * C; force.y *= -1.0; vec2 velocity = texture2D(uVelocity, vUv).xy; velocity += force * dt; velocity = min(max(velocity, -1000.0), 1000.0); gl_FragColor = vec4(velocity, 0.0, 1.0); }`);
  const presP = program(F + `uniform sampler2D uPressure; uniform sampler2D uDivergence; void main(){ float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x; float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x; float C = texture2D(uPressure, vUv).x; float divergence = texture2D(uDivergence, vUv).x; float pressure = (L + R + B + T - divergence) * 0.25; gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0); }`);
  const gradP = program(F + `uniform sampler2D uPressure; uniform sampler2D uVelocity; void main(){ float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x; float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x; vec2 velocity = texture2D(uVelocity, vUv).xy; velocity.xy -= vec2(R - L, T - B); gl_FragColor = vec4(velocity, 0.0, 1.0); }`);
  const gravP = program(`precision highp float; varying vec2 vUv; uniform sampler2D uVelocity; uniform vec2 g; uniform float dt; void main(){ vec2 v = texture2D(uVelocity, vUv).xy; gl_FragColor = vec4(v + g * dt, 0.0, 1.0); }`);
  // display: dye with soft 3D shading from its gradient, bloom-ish glow, vignette
  const dispP = program(`precision highp float; precision highp sampler2D; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform sampler2D uTexture; uniform vec2 texelSize; uniform float uFade; uniform float uTime;
    void main(){ vec3 c = texture2D(uTexture, vUv).rgb; vec3 lc = texture2D(uTexture, vL).rgb; vec3 rc = texture2D(uTexture, vR).rgb; vec3 tc = texture2D(uTexture, vT).rgb; vec3 bc = texture2D(uTexture, vB).rgb;
      float dx = length(rc) - length(lc); float dy = length(tc) - length(bc); vec3 n = normalize(vec3(dx, dy, length(texelSize) * 2.5)); vec3 l = normalize(vec3(0.35, 0.6, 0.72)); float diffuse = clamp(dot(n, l) + 0.6, 0.6, 1.25);
      vec3 h = normalize(l + vec3(0.0, 0.0, 1.0)); float spec = pow(clamp(dot(n, h), 0.0, 1.0), 48.0) * smoothstep(0.02, 0.4, length(c));
      float d = smoothstep(0.0, 0.3, length(c)); vec3 col = c * mix(1.0, diffuse, d) + spec * 0.35 * d;
      col = max(col - 0.012, 0.0); col += col * col * 0.35; // soft knee kills thin haze, lift on bright ink
      vec2 q = vUv - 0.5; float vig = 1.0 - dot(q, q) * 0.85;
      col = col * vig * uFade; col = col / (1.0 + col) * 1.35; col = pow(col, vec3(0.9));
      gl_FragColor = vec4(col, 1.0); }`);
  let dye, vel, div, curl, pres, W = 0, H = 0;
  function resize() {
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, ar = w / h; if (w === W && h === H) return; W = w; H = h;
    const sim = ar < 1 ? [Math.round(simRes * ar), simRes] : [simRes, Math.round(simRes / ar)], dy = ar < 1 ? [Math.round(dyeRes * ar), dyeRes] : [dyeRes, Math.round(dyeRes / ar)];
    dye = doubleFbo(dy[0], dy[1], formatRGBA, filter); vel = doubleFbo(sim[0], sim[1], formatRG, filter); div = fbo(sim[0], sim[1], formatR, gl.NEAREST); curl = fbo(sim[0], sim[1], formatR, gl.NEAREST); pres = doubleFbo(sim[0], sim[1], formatR, gl.NEAREST);
  }
  resize();
  const cfg = { densityDissipation: 0.9, velocityDissipation: 0.25, pressure: 0.8, pressureIter: 18, curl: 24, splatRadius: 0.25 };
  let gx = 0, gy = 0;
  function step(dt) {
    resize(); gl.disable(gl.BLEND);
    curlP.use(); gl.uniform2f(curlP.u.texelSize, vel.texelSizeX, vel.texelSizeY); gl.uniform1i(curlP.u.uVelocity, vel.read.attach(0)); blit(curl);
    vortP.use(); gl.uniform2f(vortP.u.texelSize, vel.texelSizeX, vel.texelSizeY); gl.uniform1i(vortP.u.uVelocity, vel.read.attach(0)); gl.uniform1i(vortP.u.uCurl, curl.attach(1)); gl.uniform1f(vortP.u.curl, cfg.curl); gl.uniform1f(vortP.u.dt, dt); blit(vel.write); vel.swap();
    if (gx || gy) { gravP.use(); gl.uniform1i(gravP.u.uVelocity, vel.read.attach(0)); gl.uniform2f(gravP.u.g, gx, gy); gl.uniform1f(gravP.u.dt, dt); blit(vel.write); vel.swap(); }
    divP.use(); gl.uniform2f(divP.u.texelSize, vel.texelSizeX, vel.texelSizeY); gl.uniform1i(divP.u.uVelocity, vel.read.attach(0)); blit(div);
    clearP.use(); gl.uniform1i(clearP.u.uTexture, pres.read.attach(0)); gl.uniform1f(clearP.u.value, cfg.pressure); blit(pres.write); pres.swap();
    presP.use(); gl.uniform2f(presP.u.texelSize, vel.texelSizeX, vel.texelSizeY); gl.uniform1i(presP.u.uDivergence, div.attach(0));
    for (let i = 0; i < cfg.pressureIter; i++) { gl.uniform1i(presP.u.uPressure, pres.read.attach(1)); blit(pres.write); pres.swap(); }
    gradP.use(); gl.uniform2f(gradP.u.texelSize, vel.texelSizeX, vel.texelSizeY); gl.uniform1i(gradP.u.uPressure, pres.read.attach(0)); gl.uniform1i(gradP.u.uVelocity, vel.read.attach(1)); blit(vel.write); vel.swap();
    advP.use(); gl.uniform2f(advP.u.texelSize, vel.texelSizeX, vel.texelSizeY); gl.uniform1i(advP.u.uVelocity, vel.read.attach(0)); gl.uniform1i(advP.u.uSource, vel.read.attach(0)); gl.uniform1f(advP.u.dt, dt); gl.uniform1f(advP.u.dissipation, cfg.velocityDissipation); blit(vel.write); vel.swap();
    gl.uniform2f(advP.u.texelSize, dye.texelSizeX, dye.texelSizeY); gl.uniform1i(advP.u.uVelocity, vel.read.attach(0)); gl.uniform1i(advP.u.uSource, dye.read.attach(1)); gl.uniform1f(advP.u.dissipation, cfg.densityDissipation); blit(dye.write); dye.swap();
  }
  // x,y in 0..1 (y up), dx,dy velocity, color [r,g,b] (ink amount), radius multiplier
  function splat(x, y, dx, dy, color, rad = 1) {
    splatP.use(); gl.uniform1i(splatP.u.uTarget, vel.read.attach(0)); gl.uniform1f(splatP.u.aspectRatio, W / H); gl.uniform2f(splatP.u.point, x, y); gl.uniform3f(splatP.u.color, dx, dy, 0); gl.uniform1f(splatP.u.radius, cfg.splatRadius / 100 * rad * (W / H < 1 ? 1 : W / H)); blit(vel.write); vel.swap();
    gl.uniform1i(splatP.u.uTarget, dye.read.attach(0)); gl.uniform3f(splatP.u.color, color[0], color[1], color[2]); blit(dye.write); dye.swap();
  }
  function render(fade = 1, time = 0) { dispP.use(); gl.uniform2f(dispP.u.texelSize, 1 / W, 1 / H); gl.uniform1i(dispP.u.uTexture, dye.read.attach(0)); gl.uniform1f(dispP.u.uFade, fade); gl.uniform1f(dispP.u.uTime, time); blit(null); }
  return { cfg, step, splat, render, setGravity(x, y) { gx = x; gy = y; }, resize };
}
