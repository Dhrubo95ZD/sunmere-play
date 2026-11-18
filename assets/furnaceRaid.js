// The Makers' First Furnace (Part Ten raid, level 45): the four boss machines of the casting hall under the Old Works.
//  - The Bellows Engine: a long blowing engine on heavy treads. Two great pleated bellows work one behind the other on its
//    back (in tandem, never side by side), driven by a solid flywheel; their air runs down a manifold to a blowing house at
//    the front and out of one square nozzle that swings to aim. A square stack off-centre on the blowing house.
//  - The Crucible Crane: a gantry crane on four rail trucks (solid wheels), two plated legs a side with one diagonal brace,
//    two parallel bridge girders, a trolley with a winch drum, and a square crucible of molten metal hung from a yoke that
//    sways and tips to pour. From above: a plain rectangle of girders with the trolley in it.
//  - The Pattern Caster: the moulding press that made the Makers' shapes. A sledge on solid rollers carrying a two-part
//    moulding flask, a press frame of two square columns and a flat crosshead with a square steam cylinder and a ram that
//    drives down; one pouring ladle on a jib to the right, a sand hopper to the left (never a matched pair), a boiler at the back.
//  - THE FIRST FURNACE: a towering square furnace engine on a basalt plinth. A wide hearth with one louvred glowing grille in
//    front and a tapping spout below it, a tapered square shaft banded in brass, four square corner buttresses with flat caps,
//    bustle ducts down each side feeding three blast pipes each, a skip hoist up the back to the charging floor, and a square
//    chimney with a flat hood on top.
// Content rules: no faces (no paired lamps or ports with a grille or slot under them, on any side or from above), nothing
// animal-like, no spokes, no domes, rings or radiating patterns; everything square from above.
import * as THREE from 'three';
import { box, rbox, cyl, ico, taper } from './kit.js';
import { plate, vent, flywheel, stack, sleeve, heroTreads, crawl, wear, grime, bolts, bdisc } from './bossParts.js';
import { smoke, glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { Anim, finish, part, pivot } from './quarryMachines.js';
import { wearModel, MOTION } from './tripoModels.js';

const PI = Math.PI;
const rb = (w, h, d, r) => rbox(w, h, d, r, 1);
const BASALT = '#6c6662', BASALT2 = '#58534f', SOOT = '#2a2828', IRONR = '#5c5650', BRASS = '#a88a52', ASH = '#a29e98', CANVAS = '#5a4c40';
const G = 'wGlowOrange';

// ash crusted on a top face: one even cap of settled ash over the rectangle
// (RF.7 review) never a scatter of separate pale flakes: on a dark top they read as the pips of a die from straight above
function ash(b, x, y, z, w, d, n, seed = 0) {
  if (w * d < 0.4) return; // a small pale square on a dark top reads as a dot
  b.add(rb(w * 0.98, 0.05, d * 0.96, 0.02), 'wPaint', { p: [x, y, z], c: wear(ASH, 0.08, seed + n) });
}
// a short glowing drip run down a face (molten metal that spilled and set hot)
function seam(b, x, y, z, h, axis = 'y') {
  b.add(box(axis === 'y' ? 0.07 : h, axis === 'y' ? h : 0.07, 0.05), G, { p: [x, y, z] });
}

// ========================================================================== THE BELLOWS ENGINE
export function buildBellowsEngine() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const TR = heroTreads(base, { gauge: 3.5, len: 6.6, h: 1.3, tw: 0.86, paintC: '#3e3a38', linkC: '#5a5450', road: 2, seed: 1510 });
  const body = pivot(base, 0, 0, 0);
  const hullC = grime(BASALT, 1.2, 2.4, 0.3, 1), hull2C = wear('#5a5450', 0.3, 2), ironC = wear(IRONR, 0.25, 4), trimC = wear(BRASS, 0.3, 5);
  const P = (w, h, d, seed, o = {}) => plate(w, h, d, { c: hullC, c2: hull2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed, ...o });
  body.add(part((b) => {
    // the chassis over the treads and its deck
    b.add(rb(2.9, 1.0, 6.4, 0.1), 'wPaint', { p: [0, 1.65, 0], c: hullC });
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) b.addBuilder(P(2.8, 0.8, 0.1, 1511 + i), { p: [sx * 1.48, 1.7, -1.5 + i * 3.0], r: [0, sx * PI / 2, 0] });
    b.add(rb(3.1, 0.16, 6.6, 0.04), 'wIron', { p: [0, 2.2, 0], c: ironC });
    for (const sx of [-1, 1]) b.add(box(0.09, 0.09, 6.6), 'wBrass', { p: [sx * 1.52, 2.3, 0], c: trimC });
    // the blowing house at the front: a square plated block the bellows blow into
    b.add(rb(2.6, 1.7, 1.6, 0.08), 'wPaint', { p: [0, 3.1, 2.4], c: hull2C });
    b.addBuilder(P(2.0, 1.2, 0.1, 1514, { inset: false }), { p: [0, 3.1, 3.22] });
    b.add(rb(2.8, 0.14, 1.8, 0.03), 'wIron', { p: [0, 4.0, 2.4], c: ironC });
    b.addBuilder(vent(1.0, 0.8, { frame: 'wDark', frameC: '#4a4644', glow: G, n: 5, depth: 0.12 }), { p: [1.32, 3.1, 2.4], r: [0, PI / 2, 0] }); // one grille, on the right flank
    b.addBuilder(stack(0.62, 1.9, { c: SOOT, trimC: '#5a5450', seed: 1516 }), { p: [-0.75, 4.05, 2.6] });
    // the bellows' beds: two plated boxes one behind the other, each with its bottom board
    for (const z of [-0.5, -2.6]) {
      b.add(rb(2.5, 0.4, 1.9, 0.05), 'wPaint', { p: [0, 2.5, z], c: hull2C });
      b.add(rb(2.6, 0.14, 2.0, 0.03), 'woodDark', { p: [0, 2.76, z], c: '#6a4e36' });
      for (const sx of [-1, 1]) b.add(rb(0.12, 0.6, 0.12, 0.02), 'wIron', { p: [sx * 1.32, 3.0, z + 0.9], c: ironC }); // hinge posts at the front edge
    }
    // the air manifold down the right side: a square duct from each bellows bed to the blowing house
    b.add(rb(0.42, 0.42, 4.6, 0.05), 'wIron', { p: [1.12, 2.5, -0.4], c: ironC });
    for (const z of [-0.5, -2.6]) b.add(rb(0.5, 0.2, 0.5, 0.03), 'wBrass', { p: [1.12, 2.5, z], c: trimC });
    // the stern: a tool chest and a towing beam
    b.add(rb(2.4, 0.7, 0.7, 0.05), 'wPaint', { p: [0, 2.0, -3.4], c: hullC });
    b.add(rb(3.0, 0.22, 0.3, 0.04), 'wIron', { p: [0, 1.3, -3.5], c: ironC });
    bolts(b, 'wBrass', [-1.5, 2.0, -3.2], [-1.5, 2.0, 3.2], 10, 0.05, 'x', trimC);
    bolts(b, 'wBrass', [1.5, 2.0, -3.2], [1.5, 2.0, 3.2], 10, 0.05, 'x', trimC);
    ash(b, 0, 4.1, 2.3, 2.4, 1.4, 8, 10);
    ash(b, 0, 2.32, 0.7, 2.6, 0.6, 6, 30);
    seam(b, -1.46, 1.7, -0.8, 0.5); // one drip down the left flank
  }, 1520));
  // the two bellows: a top board on its own pivot that lifts and falls, the pleated canvas between scaled to the gap
  const lids = [], folds = [];
  [-0.5, -2.6].forEach((z, i) => {
    const fold = pivot(body, 0, 2.83, z);
    fold.add(part((b) => {
      // pleats for a unit height (y 0..1): alternating wide and narrow bands of oiled canvas with iron stiffeners
      for (let k = 0; k < 6; k++) {
        const y = (k + 0.5) / 6, wide = k % 2 === 0;
        b.add(box(wide ? 2.42 : 2.18, 1 / 6 * 0.98, wide ? 1.86 : 1.64), 'wCloth', { p: [0, y, 0], c: wear(wide ? CANVAS : '#4a3e34', 0.3, k + i * 7) });
        if (wide) b.add(box(2.46, 0.02, 1.9), 'wIron', { p: [0, y, 0], c: '#4a4440' });
      }
    }, 1530 + i));
    const lid = pivot(body, 0, 3.5, z);
    lid.add(part((b) => {
      b.add(rb(2.6, 0.16, 2.0, 0.03), 'woodDark', { c: '#6a4e36' });
      for (const sx of [-1, 1]) b.add(box(0.1, 0.18, 2.04), 'wIron', { p: [sx * 1.26, 0, 0], c: ironC });
      // a brass weight block on the board, off-centre toward the hinge
      b.add(rb(0.9, 0.42, 0.7, 0.04), 'wBrass', { p: [0, 0.28, 0.45], c: trimC });
      b.add(rb(0.4, 0.5, 0.12, 0.02), 'wIron', { p: [0, 0.2, -0.9], c: ironC }); // the lifting bracket at the back edge
      ash(b, 0, 0.1, -0.3, 2.2, 0.9, 5, 40 + i);
    }, 1540 + i));
    lids.push(lid); folds.push(fold);
  });
  // the flywheel on the left that works the bellows, a connecting rod up to each lifting bracket
  const fly = pivot(body, -1.78, 3.15, -1.55);
  fly.add(part((b) => b.addBuilder(flywheel(0.85, 0.24, { c: '#4a4644', seed: 1550 })), 1550));
  const rods = [-0.5, -2.6].map((z, i) => { const r = pivot(body, -1.42, 3.0, z - 0.9); r.add(part((b) => { b.add(rb(0.12, 1.0, 0.12, 0.02), 'wIron', { p: [0, 0.5, 0], c: ironC }); }, 1555 + i)); return r; });
  // the nozzle: one long square duct out of the blowing house, tapering to a hot square mouth; it swings to aim
  const noz = pivot(body, 0, 2.75, 3.25);
  noz.add(part((b) => {
    b.add(rb(1.0, 1.0, 0.4, 0.05), 'wIron', { p: [0, 0, 0.15], c: ironC });
    b.add(taper(box(0.9, 0.9, 2.2), 0.62, 0.62, 'z'), 'wPaint', { p: [0, 0, 1.4], c: wear(BASALT2, 0.3, 60) });
    for (const z of [0.7, 1.6]) b.add(rb(0.84, 0.84, 0.1, 0.02).scale(z > 1 ? 0.84 : 1, z > 1 ? 0.84 : 1, 1), 'wBrass', { p: [0, 0, z], c: trimC });
    b.add(rb(0.62, 0.62, 0.16, 0.03), 'wDark', { p: [0, 0, 2.5], c: SOOT });
    b.add(box(0.4, 0.4, 0.04), G, { p: [0, 0, 2.6] });
  }, 1560));
  const puff = smoke({ rate: 2.5, life: 3.0, size: 1.1, rise: 1.6, color: 0x4a4644, opacity: 0.5 }); puff.position.set(-0.75, 6.4, 2.6); body.add(puff);
  const blast = slotGlow(0xff8030, 0.7, 0.7, 0.0); blast.position.set(0, 0, 2.64); noz.add(blast);
  const side = slotGlow(0xff7020, 1.05, 0.85, 0.5, { ry: PI / 2 }); side.position.set(1.4, 3.1, 2.4); body.add(side);
  const a = new Anim(root, { base, body, wheels: TR.wheels, lids, folds, fly, rods, noz });
  a.dynamics.push(puff, side);
  let dist = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    const setBellows = (ph) => {
      for (let i = 0; i < 2; i++) {
        const k = 0.5 + 0.5 * Math.sin(ph + i * PI); // in tandem, out of step
        const top = 3.35 + k * 0.7;
        p.lids[i].position.y = top; p.lids[i].rotation.x = -(k - 0.5) * 0.06;
        p.folds[i].scale.y = Math.max(0.05, top - 2.83 - 0.08);
        p.rods[i].position.y = 2.6 + k * 0.5;
      }
    };
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.0), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.z = -e * 0.07; p.body.position.y = -0.25 * e; p.noz.rotation.x = 0.35 * e;
      setBellows(-PI / 2); puff.visible = false; side.material.opacity = 0.5 * (1 - k); blast.material.opacity = 0;
      return;
    }
    puff.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.65) * dt * ts;
    dist += this.speed * dt * ts; crawl(TR.runs, dist);
    const at = this.stepAttack(dt);
    p.fly.rotation.x += (1.6 + this.speed * 0.6 + (at >= 0 ? 4 : 0)) * dt * ts;
    setBellows(p.fly.rotation.x);
    p.body.position.y = Math.abs(Math.sin(this.t * 3.0)) * 0.03 * Math.min(1, this.speed);
    // the nozzle hunts slowly; an attack draws it back, then drives it forward and down with a hot blast
    let pull = 0;
    if (at >= 0) pull = at < 0.45 ? at / 0.45 : at < 0.6 ? 1 - 2 * ((at - 0.45) / 0.15) : -1 + (at - 0.6) / 0.4;
    p.noz.rotation.y = Math.sin(this.t * 0.5) * 0.12;
    p.noz.rotation.x = pull * -0.18 + 0.05;
    p.noz.position.z = 3.25 - Math.max(0, pull) * 0.25;
    blast.material.opacity = at >= 0.45 && at < 0.8 ? 0.9 * (1 - (at - 0.45) / 0.35) : 0;
    side.material.opacity = 0.4 + 0.2 * Math.sin(this.t * 4.1) * Math.sin(this.t * 2.3);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.015; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 5.2);
}

// ========================================================================== THE CRUCIBLE CRANE
export function buildCrucibleCrane() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const hullC = grime(BASALT, 0.4, 6.5, 0.3, 11), hull2C = wear('#5a5450', 0.3, 12), ironC = wear(IRONR, 0.25, 14), trimC = wear(BRASS, 0.3, 15), sootC = wear(SOOT, 0.3, 16);
  const SPAN = 3.3, H = 6.4;
  const wheels = [];
  // the rail trucks: a plated truck each side with two solid wheels, running on a short length of rail
  for (const sx of [-1, 1]) {
    base.add(part((b) => {
      b.add(rb(0.9, 0.8, 3.8, 0.06), 'wPaint', { p: [sx * SPAN, 0.9, 0], c: hullC });
      b.addBuilder(plate(3.4, 0.6, 0.08, { c: hullC, c2: hull2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 1600 + sx }), { p: [sx * (SPAN + 0.46), 0.9, 0], r: [0, sx * PI / 2, 0] });
      for (const ez of [-1, 1]) b.add(rb(1.0, 0.5, 0.3, 0.04), 'wIron', { p: [sx * SPAN, 0.55, ez * 1.95], c: ironC }); // buffers
      for (const s of [-0.3, 0.3]) b.add(box(0.12, 0.12, 4.4), 'wIron', { p: [sx * SPAN + s, 0.06, 0], c: '#7a7672' }); // the rail under it
    }, 1601 + (sx > 0 ? 1 : 0)));
    for (const ez of [-1, 1]) {
      const w = pivot(base, sx * SPAN, 0.48, ez * 1.15);
      w.add(part((b) => {
        b.add(bdisc(0.46, 0.3, 0.05, 20), 'wIron', { r: [0, 0, PI / 2], c: '#5a5650' });
        b.add(rb(0.36, 0.22, 0.22, 0.03), 'wBrass', { c: trimC }); // square axle nut (a round hub read as a disc in a ring)
        b.add(rb(0.34, 0.12, 0.3, 0.02), 'wIron', { p: [0, 0.26, 0], c: '#8a8278' }); // a balance block, so the turn shows
      }, 1605));
      wheels.push(w);
    }
  }
  const body = pivot(base, 0, 0, 0);
  body.add(part((b) => {
    for (const sx of [-1, 1]) {
      // two plated square legs a side, leaning in toward the top, and one diagonal brace between them
      for (const ez of [-1, 1]) {
        b.add(taper(box(0.7, H - 1.2, 0.8), 0.75, 0.75, 'y'), 'wPaint', { p: [sx * SPAN, 1.3 + (H - 1.2) / 2, ez * 1.25], r: [ez * 0.09, 0, 0], c: hullC });
        for (const y of [2.2, 4.2]) b.add(rb(0.82, 0.12, 0.92, 0.02), 'wIron', { p: [sx * SPAN, y, ez * (1.25 - (y - 1.3) * 0.09)], c: ironC });
      }
      b.add(rb(0.22, 0.22, 3.4, 0.03), 'wIron', { p: [sx * SPAN, 3.6, 0], r: [0.62 * sx, 0, 0], c: ironC });
      // the end carriage over each pair of legs
      b.add(rb(0.95, 0.7, 2.8, 0.06), 'wPaint', { p: [sx * SPAN, H + 0.05, 0], c: hull2C });
      b.add(rb(1.05, 0.1, 2.9, 0.02), 'wBrass', { p: [sx * SPAN, H + 0.45, 0], c: trimC });
    }
    // the two bridge girders, parallel across the span, riveted, with a walkway plate between
    for (const ez of [-1, 1]) {
      b.add(rb(SPAN * 2 + 0.9, 0.8, 0.42, 0.05), 'wPaint', { p: [0, H + 0.2, ez * 0.85], c: wear(BASALT2, 0.3, 20 + ez) });
      b.add(box(SPAN * 2 + 0.9, 0.1, 0.5), 'wIron', { p: [0, H + 0.62, ez * 0.85], c: ironC });
      bolts(b, 'wBrass', [-SPAN, H + 0.2, ez * 1.07], [SPAN, H + 0.2, ez * 1.07], 12, 0.045, 'z', trimC);
    }
    // the hot-metal shield under the bridge: a plated apron that takes the heat off the crucible
    b.add(rb(2.6, 0.12, 1.4, 0.02), 'wIron', { p: [0, H - 0.25, 0], c: sootC });
    // the cab hung off the right-hand leg: a plain plated box with a door, a hand rail
    b.add(rb(1.2, 1.4, 1.5, 0.06), 'wPaint', { p: [SPAN + 1.0, 4.3, 0], c: hull2C });
    b.add(rb(0.06, 1.0, 0.6, 0.02), 'wDark', { p: [SPAN + 1.62, 4.2, 0.2], c: SOOT });
    b.add(rb(1.4, 0.12, 1.7, 0.02), 'wIron', { p: [SPAN + 1.0, 5.05, 0], c: ironC });
    b.add(rb(1.3, 0.08, 1.6, 0.02), 'wIron', { p: [SPAN + 1.0, 3.55, 0], c: ironC });
    ash(b, 0, H + 0.7, 0, SPAN * 2, 1.6, 14, 50);
  }, 1610));
  // the trolley that runs across the girders: a block on four solid wheels, the winch drum, a square motor house
  const trolley = pivot(body, 0, H + 0.68, 0);
  trolley.add(part((b) => {
    b.add(rb(1.6, 0.5, 2.2, 0.05), 'wPaint', { p: [0, 0.28, 0], c: hull2C });
    for (const sx of [-1, 1]) for (const ez of [-1, 1]) b.add(bdisc(0.18, 0.12, 0.02, 12), 'wIron', { p: [sx * 0.6, 0.12, ez * 0.85], r: [0, 0, PI / 2], c: '#6a6460' });
    b.add(cyl(0.34, 0.34, 1.3, 16), 'wIron', { p: [0, 0.82, -0.25], r: [0, 0, PI / 2], c: ironC });
    for (const sx of [-1, 1]) b.add(rb(0.12, 0.8, 0.8, 0.02), 'wPaint', { p: [sx * 0.72, 0.82, -0.25], c: hull2C });
    b.add(rb(1.0, 0.7, 0.7, 0.05), 'wPaint', { p: [0.2, 0.86, 0.7], c: wear(BASALT, 0.3, 30) });
    b.add(rb(1.1, 0.08, 0.8, 0.02), 'wBrass', { p: [0.2, 1.25, 0.7], c: trimC });
    ash(b, 0, 1.3, 0, 1.4, 1.8, 6, 60);
  }, 1620));
  // the hoist: two hanger bars down from the trolley to the yoke; the crucible swings on the yoke's trunnions
  const hoist = pivot(trolley, 0, 0, 0);
  hoist.add(part((b) => {
    for (const sx of [-0.55, 0.55]) b.add(box(0.12, 3.1, 0.12), 'wIron', { p: [sx, -1.55, -0.25], c: '#7a7672' });
    b.add(rb(2.6, 0.3, 0.36, 0.04), 'wPaint', { p: [0, -3.15, -0.25], c: hullC });
    for (const sx of [-1, 1]) b.add(rb(0.2, 1.3, 0.24, 0.03), 'wIron', { p: [sx * 1.18, -3.8, -0.25], c: ironC });
  }, 1630));
  const cru = pivot(hoist, 0, -4.35, -0.25);
  cru.add(part((b) => {
    // a square crucible, wider at the lip, lined in dark refractory, molten metal at the brim, a pouring lip at the front
    b.add(taper(box(1.9, 1.7, 1.9), 0.72, 0.72, 'y'), 'wPaint', { p: [0, -0.4, 0], c: grime(BASALT2, -1.2, 0.4, 0.3, 70) });
    b.add(rb(2.05, 0.16, 2.05, 0.03), 'wBrass', { p: [0, 0.48, 0], c: trimC });
    b.add(box(1.7, 0.05, 1.7), 'molten', { p: [0, 0.4, 0] });
    b.add(rb(0.6, 0.14, 0.5, 0.03), 'wIron', { p: [0, 0.42, 1.12], r: [-0.25, 0, 0], c: ironC });
    for (const sx of [-1, 1]) b.add(bdisc(0.16, 0.2, 0.02, 12), 'wIron', { p: [sx * 1.05, 0.1, 0], r: [0, 0, PI / 2], c: ironC });
    for (let i = 0; i < 3; i++) seam(b, -0.5 + i * 0.5, -0.6, 0.86 - 0.02, 0.5);
    for (const y of [-0.2, -0.8]) b.add(rb(1.96 - (0.4 - y) * 0.35, 0.08, 1.96 - (0.4 - y) * 0.35, 0.02), 'wIron', { p: [0, y, 0], c: ironC });
  }, 1640));
  const hot = slotGlow(0xff7a20, 1.7, 1.7, 0.6, { rx: -PI / 2, d: 0.2 }); hot.position.set(0, 0.5, 0); cru.add(hot);
  const pour = slotGlow(0xffa040, 0.3, 1.4, 0, { d: 0.3 }); pour.position.set(0, -0.4, 1.3); cru.add(pour);
  const puff = smoke({ rate: 1.5, life: 2.6, size: 1.0, rise: 1.6, color: 0x6a6460, opacity: 0.35 }); puff.position.set(0, 0.6, 0); cru.add(puff);
  const a = new Anim(root, { base, body, wheels, trolley, hoist, cru });
  a.dynamics.push(hot, puff);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.2), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.x = e * 0.05; p.body.position.y = -0.2 * e;
      p.cru.rotation.x = 0.9 * e; p.hoist.position.y = -0.8 * e;
      hot.material.opacity = 0.6 * (1 - k * 0.8); pour.material.opacity = 0; puff.visible = false;
      return;
    }
    puff.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.46) * dt * ts;
    // the crucible swings a little as the gantry travels; an attack runs the trolley out and tips the pour
    const at = this.stepAttack(dt);
    let tip = 0, run = 0;
    if (at >= 0) { run = Math.sin(Math.min(1, at / 0.35) * PI / 2) * (1 - Math.max(0, at - 0.75) / 0.25); tip = at < 0.35 ? 0 : at < 0.55 ? (at - 0.35) / 0.2 : at < 0.8 ? 1 : 1 - (at - 0.8) / 0.2; }
    p.trolley.position.x = Math.sin(this.t * 0.35) * 0.4 + run * 0.8;
    p.cru.rotation.z = Math.sin(this.t * 1.3) * 0.04 * (0.4 + this.speed);
    p.cru.rotation.x = tip * 0.75 + Math.sin(this.t * 1.1) * 0.03 * (0.4 + this.speed);
    pour.material.opacity = tip > 0.6 ? 0.9 : 0;
    hot.material.opacity = 0.5 + 0.15 * Math.sin(this.t * 3.7);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.01; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 7.6);
}

// ========================================================================== THE PATTERN CASTER
export function buildPatternCaster() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const hullC = grime(BASALT, 0.3, 2.0, 0.3, 21), hull2C = wear('#5a5450', 0.3, 22), ironC = wear(IRONR, 0.25, 24), trimC = wear(BRASS, 0.3, 25), sandC = wear('#8a8270', 0.25, 26);
  // the sledge on two axles of solid rollers
  const wheels = [];
  for (const ez of [-1, 1]) for (const sx of [-1, 1]) {
    const w = pivot(base, sx * 2.05, 0.5, ez * 1.6);
    w.add(part((b) => {
      b.add(bdisc(0.5, 0.42, 0.05, 20), 'wIron', { r: [0, 0, PI / 2], c: '#5a5650' });
      b.add(rb(0.5, 0.22, 0.22, 0.03), 'wBrass', { c: trimC }); // square axle nut (a round hub read as a disc in a ring)
      b.add(rb(0.5, 0.14, 0.34, 0.02), 'wIron', { p: [0, 0.3, 0], c: '#8a8278' });
    }, 1700));
    wheels.push(w);
  }
  const body = pivot(base, 0, 0, 0);
  body.add(part((b) => {
    b.add(rb(4.0, 0.9, 4.8, 0.08), 'wPaint', { p: [0, 1.15, 0], c: hullC });
    for (const sx of [-1, 1]) b.addBuilder(plate(4.2, 0.7, 0.08, { c: hullC, c2: hull2C, trim: 'wIron', trimC: '#5a5652', boltMat: 'wBrass', boltC: trimC, seed: 1701 + sx }), { p: [sx * 2.03, 1.15, 0], r: [0, sx * PI / 2, 0] });
    b.add(rb(4.3, 0.14, 5.0, 0.03), 'wIron', { p: [0, 1.65, 0], c: ironC });
    // the moulding flask on the bed: two square halves (cope over drag), a brass parting band, a clamp on each face
    b.add(rb(2.4, 0.7, 2.4, 0.04), 'wIron', { p: [0, 2.07, 0.3], c: wear('#4a4644', 0.3, 30) });
    b.add(rb(2.5, 0.1, 2.5, 0.02), 'wBrass', { p: [0, 2.45, 0.3], c: trimC });
    b.add(rb(2.4, 0.6, 2.4, 0.04), 'wIron', { p: [0, 2.78, 0.3], c: wear('#55504c', 0.3, 31) });
    b.add(box(2.2, 0.04, 2.2), 'wPaint', { p: [0, 3.09, 0.3], c: sandC }); // packed sand in the top of the cope
    for (const [px, pz, ry] of [[0, 1.52, 0], [1.22, 0.3, PI / 2], [0, -0.92, PI], [-1.22, 0.3, -PI / 2]]) b.add(rb(0.5, 1.0, 0.14, 0.03), 'wIron', { p: [px, 2.45, pz], r: [0, ry, 0], c: ironC });
    // the pouring cup: a small square sprue in the back-right corner of the cope, glowing
    b.add(rb(0.44, 0.24, 0.44, 0.03), 'wDark', { p: [0.78, 3.2, -0.48], c: SOOT });
    b.add(box(0.28, 0.03, 0.28), 'molten', { p: [0.78, 3.31, -0.48] });
    // the press frame: two square columns left and right of the flask, a flat crosshead over them, a square steam cylinder
    for (const sx of [-1, 1]) {
      b.add(rb(0.62, 4.6, 0.62, 0.05), 'wPaint', { p: [sx * 1.75, 4.0, 0.3], c: wear(BASALT2, 0.3, 32 + sx) });
      for (const y of [2.0, 4.0, 6.0]) b.add(rb(0.74, 0.12, 0.74, 0.02), 'wIron', { p: [sx * 1.75, y, 0.3], c: ironC });
    }
    b.add(rb(4.4, 0.9, 1.2, 0.06), 'wPaint', { p: [0, 6.7, 0.3], c: hull2C });
    b.add(rb(4.5, 0.1, 1.3, 0.02), 'wBrass', { p: [0, 7.18, 0.3], c: trimC });
    b.add(rb(1.2, 1.3, 1.2, 0.06), 'wIron', { p: [0, 7.8, 0.3], c: wear('#4a4644', 0.3, 34) });
    b.add(rb(1.32, 0.12, 1.32, 0.02), 'wIron', { p: [0, 8.5, 0.3], c: ironC });
    bolts(b, 'wBrass', [-2.0, 6.7, 0.92], [2.0, 6.7, 0.92], 9, 0.05, 'z', trimC);
    // the sand hopper on the left: a square bin on legs, grey moulding sand heaped in it, a chute to the flask
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(rb(0.16, 1.5, 0.16, 0.02), 'wIron', { p: [-2.6 + sx * 0.55, 2.4, -1.0 + sz * 0.55], c: ironC });
    b.add(taper(box(1.5, 1.2, 1.5), 0.55, 0.55, 'y').rotateX(PI), 'wPaint', { p: [-2.6, 3.7, -1.0], c: hull2C });
    b.add(box(1.36, 0.1, 1.36), 'wPaint', { p: [-2.6, 4.28, -1.0], c: sandC });
    b.add(rb(0.4, 0.1, 1.2, 0.02), 'wIron', { p: [-1.75, 3.15, -0.6], r: [0, 0.7, -0.45], c: ironC });
    // the boiler at the back: a square plated box, one louvred grille facing back, a square stack off-centre
    b.add(rb(3.0, 1.6, 1.3, 0.08), 'wPaint', { p: [0.2, 2.5, -2.0], c: hull2C });
    b.addBuilder(vent(1.4, 0.8, { frame: 'wDark', frameC: '#4a4644', glow: G, n: 5, depth: 0.12 }), { p: [0.2, 2.4, -2.68], r: [0, PI, 0] });
    b.addBuilder(stack(0.55, 2.0, { c: SOOT, trimC: '#5a5450', seed: 1716 }), { p: [1.3, 3.3, -2.1] });
    // the lever bank at the front left: three square-headed levers in a row (an odd number, unlike a face)
    for (let i = 0; i < 3; i++) b.add(rb(0.1, 0.9, 0.1, 0.02), 'wIron', { p: [-1.2 + i * 0.3, 2.1, 2.2], r: [0.3 - i * 0.2, 0, 0], c: '#8a8278' });
    ash(b, 0, 7.24, 0.3, 4.0, 1.0, 10, 70);
    ash(b, 0, 1.73, 0, 3.8, 4.4, 10, 90);
    seam(b, 1.2, 2.07, 1.52, 0.6, 'x');
  }, 1720));
  // the ram: a square rod out of the cylinder down to a heavy ram head carrying the pattern plate
  const ram = pivot(body, 0, 5.7, 0.3);
  ram.add(part((b) => {
    b.add(rb(0.42, 1.6, 0.42, 0.04), 'wMetal', { p: [0, 0.4, 0], c: '#b0aca4' });
    b.add(rb(2.1, 0.55, 2.1, 0.06), 'wPaint', { p: [0, -0.5, 0], c: wear(BASALT2, 0.3, 80) });
    b.add(rb(1.8, 0.18, 1.8, 0.03), 'wBrass', { p: [0, -0.85, 0], c: trimC });
    for (let i = 0; i < 3; i++) b.add(rb(1.4 - i * 0.4, 0.08, 0.3, 0.02), 'wBrass', { p: [0, -0.97, -0.4 + i * 0.4], c: trimC }); // the pattern's raised ribs
    for (const sx of [-1, 1]) b.add(rb(0.22, 0.4, 0.5, 0.03), 'wIron', { p: [sx * 1.4, -0.45, 0], c: ironC }); // guides on the columns
  }, 1730));
  // the ladle on its jib to the right: the jib turns on a post, the ladle tips on its trunnions
  const jib = pivot(body, 2.65, 1.7, -0.6);
  jib.add(part((b) => {
    b.add(rb(0.4, 3.6, 0.4, 0.04), 'wIron', { p: [0, 1.8, 0], c: ironC });
    b.add(rb(0.3, 0.3, 2.4, 0.04), 'wPaint', { p: [0, 3.5, 1.0], c: hull2C });
    b.add(rb(0.12, 1.3, 0.12, 0.02), 'wIron', { p: [0, 2.85, 2.0], c: '#7a7672' });
    b.add(rb(0.14, 0.14, 1.6, 0.02), 'wIron', { p: [0, 2.7, 0.8], r: [0.75, 0, 0], c: ironC });
  }, 1740));
  const ladle = pivot(jib, 0, 2.05, 2.0);
  ladle.add(part((b) => {
    b.add(rb(1.2, 0.12, 0.14, 0.02), 'wIron', { p: [0, 0.2, 0], c: ironC });
    for (const sx of [-1, 1]) b.add(rb(0.1, 0.6, 0.1, 0.02), 'wIron', { p: [sx * 0.55, -0.1, 0], c: ironC });
    b.add(taper(box(0.95, 0.85, 0.95), 0.7, 0.7, 'y'), 'wPaint', { p: [0, -0.62, 0], c: grime(BASALT2, -1.0, -0.2, 0.3, 90) });
    b.add(rb(1.02, 0.08, 1.02, 0.02), 'wBrass', { p: [0, -0.18, 0], c: trimC });
    b.add(box(0.84, 0.04, 0.84), 'molten', { p: [0, -0.22, 0] });
    b.add(rb(0.3, 0.08, 0.3, 0.02), 'wIron', { p: [0, -0.2, 0.58], r: [-0.3, 0, 0], c: ironC });
  }, 1750));
  const lg = slotGlow(0xff8030, 0.84, 0.84, 0.5, { rx: -PI / 2, d: 0.12 }); lg.position.set(0, -0.16, 0); ladle.add(lg);
  const puff = smoke({ rate: 2.2, life: 3.0, size: 1.0, rise: 1.5, color: 0x4a4644, opacity: 0.5 }); puff.position.set(1.3, 5.8, -2.1); body.add(puff);
  const steam = smoke({ rate: 14, life: 1.6, size: 1.3, rise: 0.4, color: 0xd8d4ce, opacity: 0.35, spread: 0.9 }); steam.position.set(0, 2.2, 0.3); steam.userData.rate = 0; body.add(steam);
  const a = new Anim(root, { base, body, wheels, ram, jib, ladle });
  a.dynamics.push(lg, puff, steam);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 2.0), e = 1 - Math.pow(1 - k, 2);
      p.body.rotation.z = e * 0.06; p.body.position.y = -0.2 * e; p.ram.position.y = 5.7 - 1.0 * e; p.ladle.rotation.x = 1.1 * e;
      lg.material.opacity = 0.5 * (1 - k); puff.visible = false; steam.visible = false;
      return;
    }
    puff.visible = true; steam.visible = true;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 3);
    for (const w of p.wheels) w.rotation.x += (this.speed / 0.5) * dt * ts;
    const at = this.stepAttack(dt);
    // the ram rises slowly and drops hard; between attacks it works small strokes
    let ramY = 5.7 + 0.2 * Math.sin(this.t * 1.4);
    if (at >= 0) ramY = at < 0.5 ? 5.7 + 0.6 * (at / 0.5) : at < 0.62 ? 6.3 - 2.1 * ((at - 0.5) / 0.12) : 4.2 + 1.5 * ((at - 0.62) / 0.38);
    p.ram.position.y = ramY;
    steam.userData.rate = at >= 0.6 && at < 0.75 ? 14 : 0;
    p.jib.rotation.y = Math.sin(this.t * 0.4) * 0.3 + (at >= 0 ? -0.5 * Math.sin(at * PI) : 0);
    p.ladle.rotation.x = at >= 0 ? 0.8 * Math.sin(at * PI) : Math.sin(this.t * 1.2) * 0.04;
    p.body.position.y = at >= 0.6 && at < 0.7 ? -0.05 : 0;
    lg.material.opacity = 0.45 + 0.15 * Math.sin(this.t * 3.3);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 25) * this.hitT * 0.012; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  return finish(root, a, 8.4);
}

// ========================================================================== THE FIRST FURNACE
export function buildFirstFurnace() {
  const root = new THREE.Group();
  const base = pivot(root, 0, 0, 0);
  const stoneC = grime('#8a8480', 0.0, 6.0, 0.3, 41), stone2C = wear('#74706c', 0.3, 42), ironC = wear(IRONR, 0.25, 44), trimC = wear(BRASS, 0.3, 45), sootC = wear(SOOT, 0.3, 46);
  const body = pivot(base, 0, 0, 0);
  body.add(part((b) => {
    // the basalt plinth, stepped once, the hearth block on it
    b.add(rb(10.4, 0.6, 10.4, 0.06), 'dWallFoundry', { p: [0, 0.3, 0], c: stone2C, uv: 'box', us: 0.4 });
    b.add(rb(9.6, 0.6, 9.6, 0.06), 'dWallFoundry', { p: [0, 0.9, 0], c: stoneC, uv: 'box', us: 0.4 });
    b.add(rb(8.2, 4.6, 8.2, 0.1), 'dWallFoundry', { p: [0, 3.5, 0], c: stoneC, uv: 'box', us: 0.35 });
    // brass banding round the hearth, bolted
    // bands are four strips round the outside (a solid slab through the masonry shows through it at a distance)
    const band = (y, w, h, t = 0.18) => { for (const s of [-1, 1]) { b.add(box(w, h, t), 'wBrass', { p: [0, y, s * (w / 2 - t / 2)], c: trimC }); b.add(box(t, h, w - 2 * t), 'wBrass', { p: [s * (w / 2 - t / 2), y, 0], c: trimC }); } };
    for (const y of [1.5, 5.6]) band(y, 8.5, 0.26);
    for (const sx of [-1, 1]) { bolts(b, 'wBrass', [sx * 4.27, 1.5, -3.6], [sx * 4.27, 1.5, 3.6], 10, 0.07, 'x', trimC); bolts(b, 'wBrass', [sx * 4.27, 5.6, -3.6], [sx * 4.27, 5.6, 3.6], 10, 0.07, 'x', trimC); }
    // the front: one wide louvred grille in an iron frame, a plain lintel plate over it, the tapping spout under it
    b.add(rb(5.4, 3.4, 0.3, 0.05), 'wIron', { p: [0, 3.5, 4.12], c: ironC });
    b.addBuilder(vent(4.6, 2.6, { frame: 'wDark', frameC: '#3e3a38', glow: G, n: 11, depth: 0.22 }), { p: [0, 3.5, 4.3] });
    b.add(rb(6.0, 0.5, 0.5, 0.05), 'wPaint', { p: [0, 5.35, 4.3], c: stone2C });
    b.add(rb(1.4, 0.5, 2.4, 0.05), 'dWallFoundry', { p: [0, 1.25, 5.2], c: stone2C, uv: 'box', us: 0.4 });
    b.add(box(0.6, 0.06, 2.3), 'molten', { p: [0, 1.52, 5.25] });
    for (const sx of [-1, 1]) b.add(rb(0.16, 0.3, 2.4, 0.03), 'wIron', { p: [sx * 0.62, 1.6, 5.2], c: ironC });
    // the shaft: a tapered square tower over the hearth, banded, glowing cracks in the lining low on each face
    b.add(taper(box(7.2, 6.6, 7.2), 0.82, 0.82, 'y'), 'dWallFoundry', { p: [0, 9.1, 0], c: grime(BASALT, 5.8, 12.4, 0.3, 47), uv: 'box', us: 0.35 });
    for (const [y, w] of [[7.2, 7.0], [9.6, 6.6], [12.0, 6.1]]) band(y, w, 0.22, 0.2);
    // (never on the front: the grille stands alone there)
    for (const [x, z, ry, l] of [[3.42, 0.8, PI / 2, 1.2], [-3.42, -1.4, PI / 2, 0.9], [0.6, -3.42, 0, 1.1]]) b.add(box(0.07, l, 0.05), G, { p: [x, 6.6, z], r: [0, ry, 0.1] });
    // the flat cap and the square chimney on top
    b.add(rb(6.4, 0.4, 6.4, 0.05), 'wIron', { p: [0, 12.6, 0], c: ironC });
    b.add(rb(5.6, 0.6, 5.6, 0.05), 'dWallFoundry', { p: [0, 13.1, 0], c: stone2C, uv: 'box', us: 0.4 });
    b.addBuilder(stack(2.2, 3.8, { c: SOOT, trimC: '#5a5450', seed: 1816 }), { p: [0, 13.4, 0.4] });
    // four square corner buttresses with flat caps
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.add(rb(1.3, 9.6, 1.3, 0.06), 'dWallFoundry', { p: [sx * 4.3, 5.4, sz * 4.3], c: stone2C, uv: 'box', us: 0.35 });
      b.add(rb(1.6, 0.4, 1.6, 0.04), 'wIron', { p: [sx * 4.3, 10.4, sz * 4.3], c: ironC });
      for (const y of [3.0, 7.0]) b.add(rb(1.44, 0.18, 1.44, 0.03), 'wBrass', { p: [sx * 4.3, y, sz * 4.3], c: trimC });
    }
    // the bustle ducts down each side: a square duct along the side, three blast pipes from it into the hearth
    for (const sx of [-1, 1]) {
      b.add(rb(0.8, 0.8, 7.0, 0.06), 'wIron', { p: [sx * 4.75, 6.4, -0.4], c: ironC });
      for (const z of [-2.4, 0, 2.4]) {
        b.add(rb(0.34, 1.6, 0.34, 0.04), 'wIron', { p: [sx * 4.6, 5.3, z], r: [0, 0, sx * 0.25], c: ironC });
        b.add(rb(0.5, 0.2, 0.5, 0.03), 'wBrass', { p: [sx * 4.42, 4.55, z], c: trimC });
      }
      // the duct runs back to the blowing engines behind the furnace
      b.add(rb(0.8, 0.8, 2.6, 0.06), 'wIron', { p: [sx * 4.75, 6.4, -5.0], c: ironC });
      b.add(rb(0.8, 6.0, 0.8, 0.06), 'wIron', { p: [sx * 4.75, 3.4, -6.1], c: ironC });
    }
    // the skip hoist up the back: two rails on a sloping frame from the ground to the charging floor, a landing at the top
    for (const sx of [-0.9, 0.9]) b.add(rb(0.22, 0.22, 11.6, 0.03), 'wIron', { p: [sx, 6.7, -7.4], r: [-0.92, 0, 0], c: '#7a7672' });
    for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5, y = 1.8 + t * 9.4, z = -11.4 + t * 7.4; b.add(rb(0.22, y - 0.2, 0.22, 0.03), 'wIron', { p: [-1.1, (y - 0.2) / 2, z], c: ironC }); b.add(rb(0.22, y - 0.2, 0.22, 0.03), 'wIron', { p: [1.1, (y - 0.2) / 2, z], c: ironC }); }
    b.add(rb(3.2, 0.24, 2.0, 0.03), 'wIron', { p: [0, 12.0, -4.4], c: ironC });
    b.add(rb(3.0, 0.8, 0.12, 0.02), 'wIron', { p: [0, 12.5, -5.4], c: ironC });
    // ash heaped on every ledge, slag spilled round the spout
    ash(b, 0, 13.42, 0, 5.2, 5.2, 16, 100);
    ash(b, 0, 5.75, 0, 8.0, 8.0, 18, 120);
    for (let q = 0; q < 8; q++) b.add(ico(b.r(0.2, 0.4), 0), 'wDark', { p: [b.r(-1.6, 1.6), 1.25, 6.4 + b.r(0, 1.2)], s: [1.4, 0.4, 1.2], c: sootC });
  }, 1820));
  // the skip: a square box that climbs the hoist rails to the charging floor and tips its load in
  const skip = pivot(body, 0, 2.0, -11.0);
  skip.add(part((b) => {
    b.add(taper(box(1.5, 1.0, 1.3), 1.15, 1.15, 'y'), 'wPaint', { p: [0, 0.5, 0], c: wear('#55504c', 0.3, 130) });
    b.add(rb(1.74, 0.1, 1.5, 0.02), 'wBrass', { p: [0, 1.02, 0], c: trimC });
    for (let i = 0; i < 6; i++) b.add(ico(b.r(0.14, 0.22), 0), 'wRust', { p: [b.r(-0.5, 0.5), 1.05, b.r(-0.4, 0.4)], c: wear('#5a4a42', 0.4, i) });
  }, 1830));
  // the grille's light and the hearth's heat, smoke from the chimney, a hot pour from the spout during an attack
  const grille = slotGlow(0xff8030, 4.7, 2.7, 0.6); grille.position.set(0, 3.5, 4.43); body.add(grille);
  const spout = slotGlow(0xffa040, 0.8, 2.5, 0.35, { rx: -PI / 2, d: 0.14 }); spout.position.set(0, 1.6, 5.25); body.add(spout);
  const puff = smoke({ rate: 4, life: 4.4, size: 2.6, rise: 2.4, color: 0x3a3634, opacity: 0.55, spread: 0.8 }); puff.position.set(0.0, 17.8, 0.4); body.add(puff);
  const a = new Anim(root, { base, body, skip });
  a.dynamics.push(grille, spout, puff);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      // a furnace does not fall: it goes dark and settles, the smoke thinning out
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 3.0);
      grille.material.opacity = 0.7 * (1 - k * 0.9); spout.material.opacity = 0.35 * (1 - k); puff.userData.rate = 4 * (1 - k);
      p.body.position.y = -0.15 * k; p.body.rotation.x = 0.015 * k;
      for (const d of this.dynamics) d.userData.update(dt, this.t);
      return;
    }
    puff.userData.rate = 4;
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 2);
    // the skip climbs and drops back on a slow cycle
    const c = ((this.t * 0.06 * ts) % 1), up = c < 0.5 ? c / 0.5 : 1 - (c - 0.5) / 0.5;
    p.skip.position.set(0, 2.0 + up * 9.0, -11.0 + up * 7.0);
    p.skip.rotation.x = up > 0.97 ? -0.6 : 0;
    const at = this.stepAttack(dt);
    // an attack: the whole furnace heaves, the grille flares white-hot and metal runs from the spout
    const flare = at >= 0 ? Math.sin(at * PI) : 0;
    grille.material.opacity = 0.55 + 0.15 * Math.sin(this.t * 2.7) * Math.sin(this.t * 1.9) + flare * 0.4;
    spout.material.opacity = 0.3 + flare * 0.6;
    p.body.position.y = flare * 0.12 + Math.abs(Math.sin(this.t * 2)) * 0.02 * Math.min(1, this.speed);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; p.body.rotation.z = Math.sin(this.t * 22) * this.hitT * 0.004; } else p.body.rotation.z = 0;
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  // the Tripo model (tripoModels.js): the grille's light on its louvred door, the pour from its spout, chimney smoke
  return wearModel(finish(root, a, 17.5), 'firstfurnace', { fit: 'long', stretch: [0.85, 1.1], keep: [grille, spout],
    fx: [[grille, [0, 0.29, 0.412], { sx: 0.62, sy: 0.85 }], [spout, [0, 0.03, 0.47]], [puff, [0, 0.89, 0.15]]], motion: MOTION.fixed });
}
