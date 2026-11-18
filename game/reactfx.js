// S7 machine reactions on the client (combat_design.md 2.5, 2.6, 5.8, 10.1; shared/reactions.js), all physical:
//   coats      Tarred (black tar drips), Chilled (rime chips and cold vapour), Corroded (sour fumes and drips), Powdered
//              (pale powder puffs), shown while the coat lasts on machines near the camera
//   Reactions  Ignite (flame sheets about 1 m tall on the machine, then a short burn), Shatter (rime chips burst off and fall),
//              Galvanic (one short spark arc to the next machine); a small plain word over the machine
//   wall slam  a crunch, sparks off the wall, a dust burst and stone chips where the machine hit the wall, rock or machine
//   plates     armour plates thrown off a Broken machine (a small instanced pool of flat plates in the machine's colour)
//   split      a fusion's kill: the machine comes apart into 3-5 parts that tumble away with sparks and smoke; the core
//              keeps the death tilt
//   foe clips  humanoid foes: Air_Juggle_Loop in the air then down and up again (Knockdown, LayToIdle), Hit_Knockback on a
//              stagger, Knockdown + LayToIdle on a big knock or a wall slam (the hero body's authored clips, choreo `ual`)
// installReactFx(fx, { ui, entities, localId }) adds fx.coat, fx.react, fx.wallSlam, fx.plates, fx.split, fx.unsplit and
// fx.foeClip. Rule checks: sparks and chips fly in random directions (never an even fan), at most one dust ring per slam,
// smoke and vapour in the alpha pool, nothing glows on the machine but the flame.
import * as THREE from 'three';
import { compileClip } from './anim.js';
import { COAT_BY_NAME, REACTIONS } from '/sunmere-play/shared/reactions.js';
import { QUALITY as GFX } from '../engine/globals.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const r = (a = 0, b = 1) => a + (b - a) * Math.random();
const NEAR = 45; // m from the camera: coats and burns beyond this show nothing (the machine's own reaction still plays)

export function installReactFx(fx, o = {}) {
  const { ui, entities } = o;
  const camPos = () => fx.camera?.position;
  const near = (p, d = NEAR) => { const c = camPos(); return !c || c.distanceTo(p) < d; };
  const H = (v) => v.height || 2;
  const body = (v, f = r(0.25, 0.85)) => { const R = Math.max(0.3, (v.radius || 0.6) * 0.7), a = r(0, 6.283), d = R * Math.sqrt(Math.random()); return v.pos.clone().add(V(Math.cos(a) * d, H(v) * f, Math.sin(a) * d)); };
  const word = (v, text) => { if (ui?.floatText && near(v.pos, 40)) ui.floatText(v.pos.clone().setY(v.pos.y + 0.4), text, 'miss'); };

  // ---------------------------------------------------------------- coats
  const COAT_LOOK = {
    tar: (v) => { fx.emit('drops', body(v, r(0.3, 0.8)), { n: 1, color: '#16110c' }); if (Math.random() < 0.3) fx.emit('smoke', body(v, 0.7), { n: 1, color: '#2a241e', size: 0.35, alpha: 0.3, lifeK: 0.5 }); },
    chill: (v) => { fx.emit('shards', body(v, r(0.3, 0.9)), { n: 1, color: '#d8eef8' }); if (Math.random() < 0.5) fx.emit('steam', body(v, 0.5), { n: 1, color: '#e6f4ff', size: 0.45, alpha: 0.25, speed: 0.3 }); },
    corrode: (v) => { fx.emit('smoke', body(v, r(0.3, 0.8)), { n: 1, color: '#8a9c52', size: 0.45, alpha: 0.32, lifeK: 0.6, speed: 0.6 }); if (Math.random() < 0.35) fx.emit('drops', body(v, 0.6), { n: 1, color: '#6c8a2a' }); },
    powder: (v) => fx.emit('dust', body(v, r(0.4, 0.9)), { n: 1, color: '#e8e2d0', size: 0.45, alpha: 0.35, speed: 0.4 }),
  };
  const COAT_ON = { tar: '#1c160f', chill: '#dff1fb', corrode: '#93a85a', powder: '#ece6d4' };
  // a coat's buff event ({k:'buff', id, name, dur}): a splash as it lands, then a few particles a beat while it lasts
  fx.coat = (v, name, dur) => {
    const kind = COAT_BY_NAME[name];
    if (!kind || !v || v.dead || v.ty !== 'm') return false;
    const cs = (v.coats ||= {});
    if (cs[kind]) cs[kind].stop = true;
    const h = (cs[kind] = { stop: false, acc: 0 });
    if (near(v.pos)) { fx.emit(kind === 'chill' ? 'shards' : kind === 'powder' ? 'dust' : 'drops', body(v, 0.6), { n: GFX.mobile ? 4 : 8, color: COAT_ON[kind], size: kind === 'powder' ? 0.7 : 1 }); fx.sound(kind === 'chill' ? 'glass' : kind === 'powder' ? 'puff' : 'splat'); }
    const every = GFX.mobile ? 0.32 : 0.18;
    fx.after(Math.min(dur || 6, 12), (k, t, dt) => {
      if (h.stop || v.dead) return;
      if ((h.acc += dt) < every) return;
      h.acc = 0;
      if (near(v.pos)) COAT_LOOK[kind](v);
    }, () => { if (cs[kind] === h) cs[kind] = null; });
    return true;
  };
  const coatOff = (v, kind) => { const h = v?.coats?.[kind]; if (h) { h.stop = true; v.coats[kind] = null; } };

  // ---------------------------------------------------------------- Reactions ({k:'react', id, kind, src, to})
  fx.react = (ev) => {
    const v = entities.get(ev.id);
    if (!v || v.ty !== 'm') return;
    const coat = { ignite: 'tar', shatter: 'chill', galvanic: 'corrode' }[ev.kind];
    coatOff(v, coat);
    const name = REACTIONS[ev.kind]?.name;
    if (name) word(v, name);
    if (!near(v.pos, 70)) return;
    const Hh = H(v), at = v.pos.clone().setY(v.pos.y + Hh * 0.55), mob = GFX.mobile;
    if (ev.kind === 'ignite') {
      // flame sheets up the machine's sides (about 1 m tall), embers and a warm flash, then a short burn
      for (let i = 0; i < (mob ? 8 : 18); i++) fx.emit('flame', body(v, r(0.1, 0.7)), { n: 1, size: r(0.7, 1.1) });
      fx.emit('embers', at, { n: mob ? 6 : 14 });
      fx.emit('smoke', at.clone().setY(at.y + Hh * 0.3), { n: 3, color: '#3a322a', size: 0.9, alpha: 0.45 });
      fx.light(at, '#ff9a48', 9, 0.45, 9, true);
      fx.sound('fire'); fx.sound('thud');
      let acc = 0;
      fx.after(REACTIONS.ignite.dur, (k, t, dt) => { if (v.dead) return; if ((acc += dt) < (mob ? 0.22 : 0.12)) return; acc = 0; if (near(v.pos)) { fx.emit('flame', body(v, r(0.15, 0.6)), { n: 1, size: r(0.45, 0.75) }); if (Math.random() < 0.2) fx.emit('smoke', body(v, 0.9), { n: 1, color: '#3a322a', size: 0.6, alpha: 0.35 }); } });
    } else if (ev.kind === 'shatter') {
      // the rime bursts off in chips that fall and bounce, a puff of cold vapour, a white contact core
      for (let i = 0; i < (mob ? 3 : 6); i++) fx.emit('shards', body(v, r(0.2, 0.9)), { n: mob ? 3 : 5, color: Math.random() < 0.5 ? '#e6f6ff' : '#bcdcec' });
      fx.emit('grit', at, { n: mob ? 4 : 8, color: '#cfe6f0', speed: 1.2 });
      fx.emit('steam', at, { n: mob ? 3 : 6, color: '#eef8ff', size: 0.9, alpha: 0.4, spread: 0.4 });
      fx.hitCore?.(at, 1.1, '#f4fbff', 0.1);
      fx.sound('glass'); fx.sound('crack');
    } else if (ev.kind === 'galvanic') {
      const t = ev.to ? entities.get(ev.to) : null;
      fx.emit('sparks', at, { n: mob ? 6 : 12, color: '#bfe4ff' });
      fx.emit('smoke', at, { n: 2, color: '#8a9c52', size: 0.6, alpha: 0.3 });
      if (t && !t.dead) {
        const to = t.pos.clone().setY(t.pos.y + H(t) * 0.55);
        fx.arc(at, to, '#a8dcff', 0.28);
        // the arc is a hair-thin line: spark puffs along it (at uneven points, a little off the line) make it read at phone size
        for (let i = 0; i < (mob ? 3 : 5); i++) { const p = at.clone().lerp(to, r(0.12, 0.92)).add(V(r(-0.15, 0.15), r(-0.12, 0.2), r(-0.15, 0.15))); fx.emit('sparks', p, { n: mob ? 3 : 5, color: '#cfeaff', size: 1.2 }); fx.emit('flash', p, { size: r(0.5, 0.8), color: '#bfe2ff', life: 0.12 }); }
        fx.emit('sparks', to, { n: mob ? 6 : 12, color: '#cfeaff' });
        fx.emit('smoke', to, { n: 2, color: '#8a9c52', size: 0.6, alpha: 0.3 });
      }
      else fx.sound('hiss');
    }
  };

  // ---------------------------------------------------------------- wall slam ({k:'wall', id, dir, on, o})
  fx.wallSlam = (ev) => {
    const v = entities.get(ev.id);
    if (!v || v.dead) return;
    const d = V(ev.dir?.[0] || 0, 0, ev.dir?.[1] || 1); if (d.lengthSq() < 1e-4) d.set(0, 0, 1); d.normalize();
    const Hh = H(v), mob = GFX.mobile, R = v.radius || 0.6;
    const hitAt = v.pos.clone().addScaledVector(d, R * 0.9).setY(v.pos.y + Hh * 0.45), feet = v.pos.clone().addScaledVector(d, R * 0.8);
    fx.sound('crunch'); fx.sound('clang');
    // sparks thrown back off the face it hit (random spread), grit, a dust burst against the wall and one ring at the feet
    fx.emit('fan', hitAt, { n: mob ? 8 : 18, dir: d.clone().negate().add(V(0, 0.4, 0)), width: 5.5, color: '#ffd090' });
    fx.emit('grit', hitAt, { n: mob ? 5 : 10, speed: 1.2 });
    fx.emit('dust', hitAt, { n: mob ? 4 : 9, spread: 0.5, size: 1.1 + R * 0.2, alpha: 0.6 });
    fx.emit('dust', feet.clone().setY(fx.ground(feet) + 0.2), { n: mob ? 3 : 6, spread: 0.5, size: 1.2 });
    fx.emit('ringdust', feet, { n: mob ? 6 : 12, r: 0.6, speed: 2.4, size: 0.9 });
    fx.rocks(hitAt.clone(), mob ? 3 : 6, 0.42);
    fx.hitCore?.(hitAt, 1, '#fff2d0', 0.08);
    if (ev.on === 'mob' && ev.o) { const t = entities.get(ev.o); if (t && !t.dead) { t.flashT = 0.22; t.leanDir = d.clone(); t.leanT = 0; t.leanAmt = 1.2; } }
    const L = entities.get(o.localId?.());
    if (L && L.pos.distanceTo(v.pos) < 14) fx.shake?.(0.3);
    if (v.def?.humanoid) fx.foeClip(v, 'down');
  };

  // ---------------------------------------------------------------- plates (Broken): a small pool of flat plates
  const PMAX = GFX.mobile ? 10 : 24;
  const pGeo = new THREE.BoxGeometry(1, 0.1, 0.7);
  const pMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.6 });
  const pMesh = new THREE.InstancedMesh(pGeo, pMat, PMAX);
  pMesh.count = 0; pMesh.castShadow = true; pMesh.frustumCulled = false;
  pMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PMAX * 3), 3);
  fx.scene.add(pMesh);
  const plates = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = V(), cTmp = new THREE.Color();
  let driving = false;
  const drive = () => {
    if (driving) return; driving = true;
    fx.after(30, (k, t, dt) => {
      let n = 0;
      for (let i = plates.length - 1; i >= 0; i--) {
        const P = plates[i];
        P.age += dt;
        if (P.age > P.life) { plates.splice(i, 1); continue; }
        P.v.y -= 16 * dt; P.p.addScaledVector(P.v, dt);
        const gy = fx.ground(P.p) + 0.05 * P.s;
        if (P.p.y < gy) { P.p.y = gy; P.v.y *= -0.3; P.v.x *= 0.55; P.v.z *= 0.55; P.w.multiplyScalar(0.5); if (!P.b) { P.b = 1; fx.sound('clang'); } }
        P.rot.addScaledVector(P.w, dt);
        const s = P.s * (P.age > P.life - 0.5 ? (P.life - P.age) / 0.5 : 1);
        m4.compose(P.p, q.setFromEuler(e.set(P.rot.x, P.rot.y, P.rot.z)), sc.set(s, s, s));
        pMesh.setMatrixAt(n, m4); pMesh.setColorAt(n, cTmp.set(P.c)); n++;
      }
      pMesh.count = n; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
      if (!plates.length && t > 1) { driving = false; return; }
    }, () => { driving = false; if (plates.length) drive(); });
  };
  const tone = (v) => { let c = null; v.char?.traverse((m) => { if (!c && m.isMesh && m.material?.color && (m.material.metalness ?? 0) > 0.25) c = '#' + m.material.color.getHexString(); }); return c || '#6c6458'; };
  // n plates of size `power` (m) thrown off from `at` (away from the hero when dir is given)
  fx.plates = (at, n = 4, power = 0.5, color = '#6c6458', dir = null) => {
    for (let i = 0; i < n; i++) {
      if (plates.length >= PMAX) plates.shift();
      const v = V(r(-1, 1), 0, r(-1, 1)).normalize().multiplyScalar(r(1.8, 4.2) * (0.7 + power * 0.5));
      if (dir) v.addScaledVector(dir, r(0.5, 1.6));
      v.y = r(3.2, 5.6);
      plates.push({ p: at.clone().add(V(r(-0.4, 0.4) * power, r(-0.2, 0.3), r(-0.4, 0.4) * power)), v, w: V(r(-9, 9), r(-6, 6), r(-9, 9)), rot: V(r(0, 6), r(0, 6), r(0, 6)), s: power * r(0.7, 1.15), c: color, age: 0, life: r(2.2, 3.2), b: 0 });
    }
    drive();
  };
  fx.machineTone = tone;

  // ---------------------------------------------------------------- split (a fusion's kill)
  fx.split = (v, away) => {
    if (!v?.char || v.ty !== 'm' || v.def?.humanoid || v.splitHidden) return false;
    const root = v.char;
    root.updateMatrixWorld(true);
    const list = [];
    root.traverse((m) => { if (m.isMesh && !m.isSkinnedMesh && !m.isInstancedMesh && m.visible && m.geometry && list.length < 400) list.push(m); });
    const box = new THREE.Box3().setFromObject(root), Hh = Math.max(0.5, box.max.y - box.min.y), c = box.getCenter(V()), R = Math.max(0.3, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2);
    const Hc = (v.height || Hh) * 0.55;
    const dir = away ? V(away.x, 0, away.z).normalize() : V(r(-1, 1), 0, r(-1, 1)).normalize();
    if (list.length < 4) { // one solid model (a GLB in a single mesh): it bursts its plates instead
      fx.plates(v.pos.clone().setY(v.pos.y + Hc), GFX.mobile ? 3 : 5, Math.min(0.9, 0.35 + R * 0.2), tone(v), dir);
      fx.emit('sparks', v.pos.clone().setY(v.pos.y + Hc), { n: 16, color: '#ffc070' });
      return false;
    }
    const nSide = 2 + Math.floor(Math.random() * 3); // 2-4 side parts and the top: 3-5 parts
    const cuts = Array.from({ length: nSide }, () => r(0, 6.283)).sort((a, b) => a - b); // (uneven pieces: never a pie of even slices)
    const sector = (a) => { for (let i = 0; i < cuts.length; i++) if (a < cuts[i]) return i; return 0; };
    const groups = new Map(), wp = V(), sp = new THREE.Sphere();
    for (const m of list) {
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      sp.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld); wp.copy(sp.center);
      const rx = wp.x - c.x, rz = wp.z - c.z, ry = wp.y - box.min.y;
      let k;
      if (ry > Hh * 0.62) k = 'top';
      else if (Math.hypot(rx, rz) < R * 0.28) continue; // the core stays and falls with the death tilt
      else k = sector((Math.atan2(rz, rx) + 6.283) % 6.283);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    }
    if (groups.size < 2) return false;
    const parts = [], hidden = [], inv = new THREE.Matrix4(), lm = new THREE.Matrix4();
    for (const [k, ms] of groups) {
      const cen = V(); for (const m of ms) { m.geometry.boundingSphere || m.geometry.computeBoundingSphere(); cen.add(sp.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld).center); } cen.multiplyScalar(1 / ms.length);
      const g = new THREE.Group(); g.position.copy(cen); fx.scene.add(g); g.updateMatrixWorld(true);
      inv.copy(g.matrixWorld).invert();
      for (const m of ms) {
        const cl = new THREE.Mesh(m.geometry, m.material); cl.castShadow = true;
        lm.multiplyMatrices(inv, m.matrixWorld); lm.decompose(cl.position, cl.quaternion, cl.scale);
        g.add(cl); m.visible = false; hidden.push(m);
      }
      const out = V(cen.x - c.x, 0, cen.z - c.z); if (out.lengthSq() < 1e-4) out.set(r(-1, 1), 0, r(-1, 1)); out.normalize();
      const vel = out.multiplyScalar(r(2.0, 3.8)).addScaledVector(dir, r(0.8, 2.0)); vel.y = k === 'top' ? r(4.5, 6.5) : r(2.6, 4.6);
      parts.push({ g, v: vel, w: V(r(-6, 6), r(-4, 4), r(-6, 6)), b: 0, acc: 0 });
      fx.emit('sparks', cen, { n: GFX.mobile ? 5 : 10, dir: out, color: '#ffc070' });
      fx.emit('smoke', cen, { n: 2, size: 0.8, alpha: 0.45 });
    }
    v.splitHidden = hidden;
    fx.sound('clang'); fx.sound('crack');
    fx.after(2.9, (k, t, dt) => {
      for (const P of parts) {
        const p = P.g.position;
        P.v.y -= 15 * dt; p.addScaledVector(P.v, dt);
        const gy = fx.ground(p) + 0.12;
        if (p.y < gy) { p.y = gy; if (!P.b) { P.b = 1; P.v.y *= -0.32; P.v.x *= 0.5; P.v.z *= 0.5; P.w.multiplyScalar(0.45); fx.emit('dust', p.clone(), { n: 3, size: 0.8 }); fx.sound('thud'); } else { P.v.y = Math.max(0, P.v.y); P.v.x *= 0.9; P.v.z *= 0.9; P.w.multiplyScalar(0.9); } }
        P.g.rotation.x += P.w.x * dt; P.g.rotation.y += P.w.y * dt; P.g.rotation.z += P.w.z * dt;
        if (!P.b && (P.acc += dt) > 0.09) { P.acc = 0; fx.emit('smoke', p.clone(), { n: 1, size: 0.5, alpha: 0.35, lifeK: 0.5 }); }
        if (t > 2.1) P.g.scale.setScalar(Math.max(0.01, 1 - (t - 2.1) / 0.8));
      }
    }, () => { for (const P of parts) fx.scene.remove(P.g); });
    return true;
  };
  fx.unsplit = (v) => { if (v?.splitHidden) { for (const m of v.splitHidden) m.visible = true; v.splitHidden = null; } };

  // ---------------------------------------------------------------- humanoid foes' clips
  const CLIPS = {};
  const clipFor = (kind, dur = 1) => {
    const key = kind + ':' + dur.toFixed(2);
    if (CLIPS[key]) return CLIPS[key];
    let segs, total;
    if (kind === 'air') { segs = [['Air_Juggle_Loop', 0, dur, 0, dur], ['Knockdown', dur, dur + 0.3, 0.62, 1.0], ['LayToIdle', dur + 0.3, dur + 1.25, 0, 1.5]]; total = dur + 1.3; }
    else if (kind === 'stag') { segs = [['Hit_Knockback', 0, 0.6, 0, 0.833]]; total = 0.65; }
    else if (kind === 'broken') { segs = [['Hit_Chest', 0, 0.25], ['Knockdown', 0.25, 0.9, 0, 0.8], ['LayToIdle', 0.9, 1.95, 0.25, 1.5]]; total = 2; }
    else { segs = [['Knockdown', 0, 0.75, 0, 1.0], ['LayToIdle', 0.75, 1.75, 0, 1.5]]; total = 1.8; }
    const c = compileClip({ dur: total, mask: 'full', keys: [{ t: 0, p: {} }, { t: 1, p: {} }], events: [], ual: { mask: 'full', segs } });
    if (Object.keys(CLIPS).length < 64) CLIPS[key] = c;
    return c;
  };
  fx.foeClip = (v, kind, ev) => {
    if (!v?.anim || v.dead || !v.def?.humanoid) return;
    const dur = kind === 'air' ? Math.max(0.4, Math.min(1.6, Math.round((ev?.dur || 1) * 10) / 10)) : 1;
    v.anim.play(clipFor(kind, dur), { fadeIn: 0.05, fadeOut: 0.2 });
  };
}
