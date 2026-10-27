// The box itself: a real-time 3D jack-in-the-box. Lacquer, gold, a spotlight on a glossy floor, a crank that turns, a lid on a spring.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07050a); scene.fog = new THREE.FogExp2(0x07050a, 0.09);
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const CAM0 = new THREE.Vector3(3.0, 2.4, 4.0), LOOK0 = new THREE.Vector3(0, 0.45, 0);
  camera.position.copy(CAM0); camera.lookAt(LOOK0);

  // lights
  scene.add(new THREE.HemisphereLight(0x3a2a44, 0x0a0608, 0.35));
  const spot = new THREE.SpotLight(0xffd9a8, 160, 16, 0.5, 0.8, 1.6); spot.position.set(1.6, 5.2, 2.2); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005; spot.shadow.radius = 4; scene.add(spot); spot.target.position.set(0, 0.5, 0); scene.add(spot.target);
  const rim = new THREE.PointLight(0x6a7cff, 3, 8, 2); rim.position.set(-2.5, 1.8, -2); scene.add(rim);
  const inner = new THREE.PointLight(0xffd38a, 0, 4, 2); inner.position.set(0, 0.6, 0); scene.add(inner);

  // floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.MeshStandardMaterial({ color: 0x1c1620, roughness: 0.38, metalness: 0.1, envMapIntensity: 0.5 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // materials
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x8a0f2b, roughness: 0.28, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.22, metalness: 1, envMapIntensity: 1.3 });
  const ivory = new THREE.MeshPhysicalMaterial({ color: 0xf2e6c8, roughness: 0.35, clearcoat: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a060c, roughness: 0.9 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd38a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

  const box = new THREE.Group(); scene.add(box);
  const S = 1, base = new THREE.Mesh(new RoundedBoxGeometry(S, S * 0.92, S, 4, 0.035), lacquer); base.position.y = S * 0.46; base.castShadow = true; base.receiveShadow = true; box.add(base);
  // hollow: a dark inner cavity and a glow plane at the opening
  const cavity = new THREE.Mesh(new THREE.BoxGeometry(S * 0.86, S * 0.8, S * 0.86), dark); cavity.position.y = S * 0.52; cavity.material.side = THREE.BackSide; box.add(cavity);
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(S * 0.86, S * 0.86), glowMat); glowPlane.rotation.x = -Math.PI / 2; glowPlane.position.y = S * 0.93; box.add(glowPlane);
  // gold edge trim
  const trim = (len, x, y, z, ry, rz) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, len, 12), gold); m.position.set(x, y, z); m.rotation.set(0, ry, rz); m.castShadow = true; box.add(m); return m; };
  const h = S * 0.92, e = S / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) trim(h, sx * e, h / 2, sz * e, 0, 0);
  for (const sx of [-1, 1]) for (const yy of [0.02, h]) trim(S, sx * e, yy, 0, 0, Math.PI / 2).rotation.set(Math.PI / 2, 0, 0);
  for (const sz of [-1, 1]) for (const yy of [0.02, h]) trim(S, 0, yy, sz * e, 0, Math.PI / 2);
  // inlay medallion on each visible face
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 10, 48), gold), dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), gold);
  for (const [x, z, ry] of [[0, e + 0.005, 0], [e + 0.005, 0, Math.PI / 2]]) { const r = ring.clone(); r.position.set(x, h / 2, z); r.rotation.y = ry; box.add(r); const d = dot.clone(); d.position.set(x, h / 2, z); box.add(d); }
  // lid on a hinge at the back edge
  const hinge = new THREE.Group(); hinge.position.set(0, h, -e); box.add(hinge);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(S * 1.04, 0.11, S * 1.04, 4, 0.03), lacquer); lid.position.set(0, 0.055, e); lid.castShadow = true; lid.receiveShadow = true; hinge.add(lid);
  const lidTrim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 10, 48), gold); lidTrim.rotation.x = Math.PI / 2; lidTrim.position.set(0, 0.115, e); hinge.add(lidTrim);
  const lidDot = dot.clone(); lidDot.position.set(0, 0.115, e); hinge.add(lidDot);
  for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, S * 1.04, 12), gold); m.position.set(sx * (e + 0.02), 0.11, e); m.rotation.x = Math.PI / 2; hinge.add(m); }
  const m2 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, S * 1.04, 12), gold); m2.position.set(0, 0.11, e * 2 + 0.02); m2.rotation.z = Math.PI / 2; hinge.add(m2);
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.03), gold); latch.position.set(0, h - 0.04, e + 0.02); box.add(latch);
  // the crank on the right face
  const crank = new THREE.Group(); crank.position.set(e, h / 2, 0); box.add(crank);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 16), gold); shaft.rotation.z = Math.PI / 2; shaft.position.x = 0.08; crank.add(shaft);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 24), gold); hub.rotation.z = Math.PI / 2; hub.position.x = 0.17; crank.add(hub);
  const arm = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.34, 0.05, 2, 0.015), ivory); arm.position.set(0.21, 0.15, 0); crank.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 24), new THREE.MeshPhysicalMaterial({ color: 0xc8362a, roughness: 0.25, clearcoat: 1 })); knob.position.set(0.27, 0.3, 0); crank.add(knob);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 12), gold); pin.rotation.z = Math.PI / 2; pin.position.set(0.24, 0.3, 0); crank.add(pin);
  [shaft, hub, arm, knob].forEach(m => { m.castShadow = true; });

  // dust in the spotlight, and a burst of sparks for the pop
  const dustN = 260, dustPos = new Float32Array(dustN * 3); for (let i = 0; i < dustN; i++) { dustPos[i * 3] = (Math.random() - 0.5) * 4; dustPos[i * 3 + 1] = Math.random() * 3; dustPos[i * 3 + 2] = (Math.random() - 0.5) * 4; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const spriteTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,210,1)'); g.addColorStop(0.3, 'rgba(255,240,210,.5)'); g.addColorStop(1, 'rgba(255,240,210,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.035, map: spriteTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(dust);
  const sparkN = 400, sparkPos = new Float32Array(sparkN * 3), sparkVel = new Float32Array(sparkN * 3); const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.05, map: spriteTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffd9a0 })); scene.add(sparks); let sparkT = -1;

  // state
  const st = { crank: 0, tension: 0, lidOpen: 0, lidVel: 0, lidTarget: 0, popT: -1, camT: 0, camMode: 0, idle: 0, visible: true, rock: 0 };
  function resize() { const w = container.clientWidth || innerWidth, hh = container.clientHeight || innerHeight; renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix(); const s = Math.min(1, w / hh / 0.56); camera.fov = 32 / s; camera.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);
  let last = performance.now(), T = 0;
  const tmpV = new THREE.Vector3(), look = LOOK0.clone();
  function frame(now) {
    requestAnimationFrame(frame); if (!st.visible && st.camMode === 0) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
    // crank and tension: the box rattles as the spring winds
    crank.rotation.x = -st.crank; st.rock = st.rock * 0.9;
    const tremble = Math.pow(st.tension, 3);
    box.rotation.z = Math.sin(T * 40) * 0.012 * tremble + st.rock * 0.03; box.rotation.x = Math.cos(T * 37) * 0.01 * tremble;
    box.position.y = Math.abs(Math.sin(T * 44)) * 0.012 * tremble;
    // lid: damped spring to its target, trembling when nearly wound
    const target = st.lidTarget - tremble * 0.06 * (0.5 + 0.5 * Math.sin(T * 30));
    const k = 60, c = st.lidTarget > 1 ? 5.5 : 9; st.lidVel += ((target - st.lidOpen) * k - st.lidVel * c) * dt; st.lidOpen += st.lidVel * dt; if (st.lidOpen < 0 && st.lidTarget === 0) { st.lidOpen = 0; st.lidVel *= -0.3; }
    hinge.rotation.x = -st.lidOpen;
    // inner glow and sparks on pop
    if (st.popT >= 0) { st.popT += dt; const g = Math.max(0, 1 - st.popT / 1.4); inner.intensity = 40 * g * g; glowMat.opacity = g * 0.9; }
    if (sparkT >= 0) { sparkT += dt; const p = sparkGeo.attributes.position.array; for (let i = 0; i < sparkN; i++) { sparkVel[i * 3 + 1] -= 2.2 * dt; p[i * 3] += sparkVel[i * 3] * dt; p[i * 3 + 1] += sparkVel[i * 3 + 1] * dt; p[i * 3 + 2] += sparkVel[i * 3 + 2] * dt; } sparkGeo.attributes.position.needsUpdate = true; sparks.material.opacity = Math.max(0, 1 - sparkT / 1.6); if (sparkT > 1.8) sparkT = -1; }
    // dust drift
    const dp = dustGeo.attributes.position.array; for (let i = 0; i < dustN; i++) { dp[i * 3 + 1] += Math.sin(T * 0.5 + i) * 0.0008 + 0.0006; dp[i * 3] += Math.cos(T * 0.3 + i * 1.3) * 0.0006; if (dp[i * 3 + 1] > 3) dp[i * 3 + 1] = 0; } dustGeo.attributes.position.needsUpdate = true;
    // idle: a slow turntable until touched; camera dolly into the box on pop
    if (st.camMode === 0) { st.idle += dt; box.rotation.y = Math.sin(T * 0.25) * 0.18; camera.position.lerp(CAM0, 0.04); look.lerp(LOOK0, 0.04); }
    else { st.camT = Math.min(1, st.camT + dt / 0.9); const e2 = st.camT * st.camT * (3 - 2 * st.camT); tmpV.set(0, 1.9, 0.45).lerp(new THREE.Vector3(0, 1.25, 0.05), e2); camera.position.lerp(tmpV, 0.12); look.lerp(new THREE.Vector3(0, 0.6, 0), 0.12); }
    camera.lookAt(look);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    turn(deg) { st.crank += deg * Math.PI / 180; st.rock = Math.sign(deg) * Math.min(1, Math.abs(deg) / 10); },
    tension(t) { st.tension = t; },
    pop() {
      st.lidTarget = 1.95; st.lidVel = 14; st.popT = 0; st.tension = 0; st.camMode = 1; st.camT = 0;
      const p = sparkGeo.attributes.position.array; for (let i = 0; i < sparkN; i++) { p[i * 3] = (Math.random() - 0.5) * 0.3; p[i * 3 + 1] = 0.95; p[i * 3 + 2] = (Math.random() - 0.5) * 0.3; const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 2.2; sparkVel[i * 3] = Math.cos(a) * s * 0.6; sparkVel[i * 3 + 1] = 1.5 + Math.random() * 3; sparkVel[i * 3 + 2] = Math.sin(a) * s * 0.6; } sparkGeo.attributes.position.needsUpdate = true; sparkT = 0;
    },
    reset() { st.lidTarget = 0; st.camMode = 0; st.popT = -1; inner.intensity = 0; glowMat.opacity = 0; st.tension = 0; },
    setVisible(v) { st.visible = v; },
    destroy() { renderer.dispose(); },
  };
}
