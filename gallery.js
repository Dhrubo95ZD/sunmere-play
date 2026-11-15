// Asset gallery: inspect every model and animation up close. Open with /?gallery
// URL params: asset=<name> seed=<n> view=<close|mid|game> wind=<0..3>
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Engine } from './engine/renderer.js';
import { G } from './engine/globals.js';
import { grassTex } from './engine/textures.js';
import { patchWorld } from './engine/materials.js';
import { ASSETS } from './assets/index.js';
import { assemble, swingFocus } from './assets/dynamic.js';
swingFocus.set(0, 0, 0); // (the props stand at the origin: their lanterns swing)
import { Animator } from './game/anim.js';
import { FX, updateBowString } from './game/fx.js';
import { SFX } from './game/sfx.js';
import { CHOREO } from './game/choreo.js';
import { SKILLS, CLASSES } from '/sunmere-play/shared/classes.js';
import { Builder, cyl, sphere, box } from './assets/kit.js';

export async function startGallery() {
  const params = new URLSearchParams(location.search);
  const engine = new Engine(document.getElementById('view'));
  const { scene, camera } = engine;
  scene.fog.near = 400; scene.fog.far = 900;

  // ground disc
  const gt = grassTex();
  const gmat = new THREE.MeshStandardMaterial({ map: gt.map, normalMap: gt.normalMap, roughness: 0.95 });
  gmat.map.repeat.set(10, 10); gmat.normalMap.repeat.set(10, 10);
  patchWorld(gmat, { cloud: true });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), gmat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const controls = new OrbitControls(camera, engine.renderer.domElement);
  controls.target.set(0, 2, 0);
  controls.enableDamping = true;
  camera.position.set(14, 10, 14);

  const sfx = new SFX();
  const shakeRig = { s: 0, addShake(a) { this.s = Math.min(1, this.s + a); } };
  const shakeOff = new THREE.Vector3();
  const fx = new FX(scene, camera, { heightAt: () => 0, rig: shakeRig, sfx });
  // training dummy (straw sack on a post, no face)
  const db = new Builder(9);
  db.add(cyl(0.06, 0.07, 1.9, 8), 'woodDark', { p: [0, 0.95, 0], c: 0xffffff });
  db.add(cyl(0.05, 0.05, 1.1, 8), 'woodDark', { p: [0, 1.45, 0], r: [0, 0, Math.PI / 2], c: 0xffffff });
  db.add(cyl(0.26, 0.22, 0.75, 12), 'cloth', { p: [0, 1.25, 0], c: '#c8a868' });
  db.add(sphere(0.18, 12, 10), 'cloth', { p: [0, 1.82, 0], c: '#c8a868' });
  for (const y of [1.0, 1.25, 1.5]) db.add(cyl(0.27, 0.27, 0.03, 12), 'leather', { p: [0, y, 0], c: '#5a3a22' });
  const dummy = db.build();
  dummy.position.set(0, 0, 6);
  scene.add(dummy);
  let skillCtx = null, idleT = 0;
  function playSkill(id) {
    const ch = CHOREO[id];
    if (!ch || !animator) return;
    skillCtx = { char: current, animator, cls: currentClass, yaw: 0, target: dummy.position.clone(), held: {} };
    animator.play(ch.clip, { onEvent: (ev) => fx.run(ev, skillCtx) });
    idleT = 0;
  }
  let currentClass = null;

  let current = null, currentName = null, seed = Number(params.get('seed') || 1);
  const t0 = performance.now();

  function frameView(view = 'mid') {
    if (!current) return;
    const bb = new THREE.Box3().setFromObject(current);
    const size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z);
    controls.target.copy(c);
    if (view === 'game') {
      // the in-game 2.5D angle
      const d = 30;
      camera.position.set(c.x, c.y, c.z).add(new THREE.Vector3(0, Math.sin(0.9) * d, Math.cos(0.9) * d));
    } else if (view === 'close') {
      camera.position.copy(c).add(new THREE.Vector3(r * 0.45, r * 0.15, r * 0.55));
    } else if (view === 'top') {
      camera.position.copy(c).add(new THREE.Vector3(0.01, r * 1.6, r * 0.4));
    } else {
      camera.position.copy(c).add(new THREE.Vector3(r * 0.9, r * 0.55, r * 1.1));
    }
    controls.update();
  }

  function show(name, s = seed, view = 'mid') {
    if (current) { scene.remove(current); current.traverse((o) => o.geometry?.dispose?.()); }
    const def = ASSETS[name];
    if (!def) return;
    const res = def.make(s);
    current = res.isObject3D ? res : assemble(res);
    animator = def.character ? new Animator(current, def.character) : null;
    machine = current.userData.machine || null;
    animPanel.style.display = animator || machine ? 'block' : 'none';
    currentClass = def.character || null;
    dummy.visible = !!animator;
    const list = SKILLS[currentClass] || [];
    document.getElementById('gal-actions').innerHTML = list.length ? '<div style="color:#e8c26a;font:700 12px Cinzel,serif;margin:8px 0 4px">Skills</div>' + list.map((sk) => `<button class="gal-skill" data-id="${sk.id}" title="${sk.desc}" style="display:block;width:100%;margin:2px 0;padding:3px 6px;text-align:left;background:#30241a;color:#f3d48a;border:1px solid #5a4422;border-radius:3px;cursor:pointer">${sk.lvl}. ${sk.name}</button>`).join('') : '';
    scene.add(current);
    currentName = name; seed = s;
    frameView(view);
    document.querySelectorAll('.gal-btn').forEach((b) => b.classList.toggle('on', b.dataset.name === name));
    let tris = 0; current.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    info.textContent = `${name}  seed ${s}  ·  ${Math.round(tris).toLocaleString()} tris`;
  }

  // UI
  const ui = document.getElementById('ui');
  const panel = document.createElement('div');
  panel.style.cssText = 'position:absolute;left:10px;top:10px;bottom:10px;width:190px;overflow:auto;background:rgba(15,12,9,.82);border:1px solid #7a5a28;border-radius:6px;padding:8px;font:13px Alegreya Sans,sans-serif';
  const cats = {};
  for (const [n, d] of Object.entries(ASSETS)) (cats[d.cat] ||= []).push(n);
  panel.innerHTML = Object.entries(cats).map(([c, list]) => `<div style="color:#e8c26a;font:700 12px Cinzel,serif;margin:8px 0 4px">${c}</div>` +
    list.map((n) => `<button class="gal-btn" data-name="${n}" style="display:block;width:100%;margin:2px 0;padding:4px 6px;text-align:left;background:#2a2118;color:#f4ead2;border:1px solid #4a3a22;border-radius:3px;cursor:pointer">${n}</button>`).join('')).join('') +
    `<div style="margin-top:12px;color:#e8c26a;font:700 12px Cinzel,serif">Wind</div><input id="gal-wind" type="range" min="0" max="3" step="0.1" value="1" style="width:100%">
     <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">${['close', 'mid', 'game', 'top'].map((v) => `<button class="gal-view" data-v="${v}" style="flex:1;padding:3px;background:#2a2118;color:#f4ead2;border:1px solid #4a3a22;border-radius:3px;cursor:pointer">${v}</button>`).join('')}</div>
     <button id="gal-seed" style="margin-top:6px;width:100%;padding:4px;background:#3a2a18;color:#f4ead2;border:1px solid #7a5a28;border-radius:3px;cursor:pointer">New seed</button>`;
  ui.appendChild(panel);
  const info = document.createElement('div');
  info.style.cssText = 'position:absolute;right:12px;top:10px;padding:6px 10px;background:rgba(15,12,9,.7);border-radius:4px;font:13px Alegreya Sans,sans-serif;color:#f4ead2';
  ui.appendChild(info);
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('.gal-btn'); if (b) show(b.dataset.name, seed);
    const v = e.target.closest('.gal-view'); if (v) frameView(v.dataset.v);
  });
  panel.querySelector('#gal-seed').onclick = () => show(currentName, seed + 1);
  panel.querySelector('#gal-wind').oninput = (e) => { G.windStrength.value = Number(e.target.value); };
  G.windStrength.value = Number(params.get('wind') ?? 1);

  // animation controls for characters
  let animator = null, machine = null, animState = 'idle', treadmill = 0;
  const animPanel = document.createElement('div');
  animPanel.style.cssText = 'position:absolute;right:12px;top:44px;bottom:10px;overflow:auto;width:180px;background:rgba(15,12,9,.82);border:1px solid #7a5a28;border-radius:6px;padding:8px;display:none;font:13px Alegreya Sans,sans-serif';
  const states = ['idle', 'combat', 'walk', 'run', 'sprint', 'jump', 'hit', 'death'];
  animPanel.innerHTML = '<div style="color:#e8c26a;font:700 12px Cinzel,serif;margin-bottom:4px">Animation</div>' +
    states.map((n) => `<button class="gal-anim" data-a="${n}" style="display:block;width:100%;margin:2px 0;padding:3px 6px;text-align:left;background:#2a2118;color:#f4ead2;border:1px solid #4a3a22;border-radius:3px;cursor:pointer">${n}</button>`).join('') +
    '<div id="gal-actions"></div>';
  ui.appendChild(animPanel);
  animPanel.addEventListener('click', (e) => {
    const sk = e.target.closest('.gal-skill');
    if (sk) { playSkill(sk.dataset.id); return; }
    const b = e.target.closest('.gal-anim');
    if (b && machine) {
      const a = b.dataset.a;
      if (a === 'hit') machine.hit(); else if (a === 'death') { machine.dead ? machine.revive() : machine.die(); } else if (a === 'jump') machine.attack(1.0, 'slam'); else animState = a;
      return;
    }
    if (!b || !animator) return;
    const a = b.dataset.a;
    if (a === 'hit') animator.hit(1);
    else if (a === 'death') { animator.dead ? animator.revive() : animator.die(); }
    else if (a === 'jump') { jumpT = 0.6; }
    else animState = a;
    if (b.dataset.clip) playClip(b.dataset.clip);
  });
  let jumpT = 0;
  const actionClips = {};
  function playClip(name) { if (animator && actionClips[name]) animator.play(actionClips[name]); }
  function setActions(map) {
    Object.assign(actionClips, map);
    document.getElementById('gal-actions').innerHTML = Object.keys(map).map((n) => `<button class="gal-anim" data-a="clip" data-clip="${n}" style="display:block;width:100%;margin:2px 0;padding:3px 6px;text-align:left;background:#30241a;color:#f3d48a;border:1px solid #5a4422;border-radius:3px;cursor:pointer">${n}</button>`).join('');
  }

  window.gallery = {
    setActions, playClip, playSkill, fx, get machine() { return machine; }, get animator() { return animator; }, setAnim: (a) => { animState = a; }, show, frameView, engine, camera, controls, scene, get current() { return current; } };
  show(params.get('asset') || Object.keys(ASSETS)[0], seed, params.get('view') || 'mid');
  document.getElementById('loading').classList.add('done');

  engine.updaters.add((dt) => {
    controls.update();
    current?.userData.update?.(dt, G.time.value);
    const ts = fx.timeScale();
    fx.update(dt);
    camera.position.sub(shakeOff);
    shakeOff.set(0, 0, 0);
    if (shakeRig.s > 0.001) { shakeRig.s = Math.max(0, shakeRig.s - dt * 2.2); const a = shakeRig.s * shakeRig.s * 0.25, t = performance.now() / 1000 * 38; shakeOff.set(Math.sin(t * 1.3) * a, Math.sin(t * 1.7) * a, Math.sin(t * 1.1) * a); }
    camera.position.add(shakeOff);
    if (machine) {
      const speed = { idle: 0, combat: 0, walk: 1.2, run: 3.2, sprint: 4.5 }[animState] ?? 0;
      machine.update(dt * ts, speed);
      if (animState === 'combat' && machine.atk < 0 && Math.random() < dt * 0.6) machine.attack(1.0);
    }
    if (animator) {
      const speed = { idle: 0, combat: 0, walk: 1.6, run: 6.2, sprint: 8 }[animState] ?? 0;
      if (jumpT > 0) jumpT -= dt;
      animator.update(dt * ts, { speed, combat: animState === 'combat', air: jumpT > 0 });
      updateBowString(current);
      if (speed === 0) {
        // skills move the character (leaps, charges); drift back home afterwards
        const tr = animator.consumeTravel();
        current.position.z += tr;
        if (animator.busy) idleT = 0; else idleT += dt;
        if (idleT > 1.2 && Math.abs(current.position.z) > 0.01) current.position.z *= Math.exp(-dt * 3);
        camera.position.z += 0; // keep camera fixed while testing skills
      }
      // treadmill: let the character actually travel so cloth reacts, then loop back
      treadmill += speed * dt;
      if (treadmill > 40) treadmill = 0;
      const prevZ = current.position.z;
      if (speed > 0) current.position.z = treadmill - 20;
      // camera travels with the character
      const dz = current.position.z - prevZ;
      if (Math.abs(dz) < 5) { camera.position.z += dz; controls.target.z += dz; }
      else { camera.position.z += dz; controls.target.z += dz; }
      ground.position.z = Math.round(current.position.z / 10) * 10;
      current.position.y = jumpT > 0 ? Math.sin((1 - jumpT / 0.6) * Math.PI) * 0.9 : 0;
    }
    engine.updateShadow(controls.target, 30);
  });
  engine.start((frame) => frame());
}
