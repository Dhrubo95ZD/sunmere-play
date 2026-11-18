// Clockwork machines (enemies) with procedural animation: idle, move, attack, hit, death.
// Rigid parts live in an Object3D hierarchy; gears spin with movement, pistons slide, stacks puff steam.
import { buildWanderingForge, buildDuneDredge } from './worldboss.js';
import { buildArcRoller, buildCoilPylon, buildStormengine } from './stormMachines.js';
import * as THREE from 'three';
import { buildDriller, buildCrusher } from './quarryMachines.js';
import { wearModel, MOTION } from './tripoModels.js';
import { buildTiller, buildStrider, buildSawyer } from './machines2.js';
import { buildSweeper, buildMakerWarden, buildCounterweight } from './makers.js';
import { buildAshSentinel, buildSlagHauler, buildOreCrawler, buildFurnaceKeeper, buildAshwright } from './reachMachines.js';
import { buildWheelHammer, buildFlumeWalker, buildSluiceKeeper, buildDamSentry, buildSpillwayEngine } from './rimeMachines.js';
import { buildIcePlough, buildGaleWalker, buildRimeSweeper, buildTowerWarden, buildStormplough } from './heightsMachines.js';
import { buildLogHaulier, buildSawCarriage, buildRopeLayer, buildSiltDredge, buildTideWarden, buildGreatDredge } from './tidewaterMachines.js';
import { buildStumpPuller, buildTerraceCutter, buildDrainBorer, buildSeedDrill, buildSlopeWarden, buildHillLeveller } from './rainwardMachines.js';
import { buildBarkStripper, buildStumpGrinder, buildLogForwarder, buildStackCrane, buildFeller, buildRideWarden, buildGreatForwarder, buildFallenStandard } from './wealdMachines.js';
import { buildGreatSorter } from './oreBosses.js';
import { buildGateWinder, buildTurbineHeart, buildFloodgate } from './sluiceBosses.js';
import { buildRodEngine, buildCisternWarden, buildGreatPump } from './pumpBosses.js';
import { buildLogCarriage, buildFrameSaw, buildGreatUndershot } from './millRaces.js';
import { buildSpoilTipper, buildSumpRam, buildAditDriver } from './drainAdits.js';
import { buildStackTurner, buildLouvreJack, buildLouvreEngine } from './loftBosses.js';
import { buildGateWinch, buildSiltRam, buildSluiceCarriage, buildTideEngine } from './seaGate.js';
import { buildStumpPrime, buildSpoilConveyor, buildBedRam, buildTerraceEngine } from './upperCutting.js';
import { buildBellowsEngine, buildCrucibleCrane, buildPatternCaster, buildFirstFurnace } from './furnaceRaid.js';
import { buildPenstockEngine, buildIceBreaker, buildGovernor, buildDamHeart } from './damRaid.js';
import { buildShopCrane, buildBoardPlane, buildGreatLathe, buildGreatGovernor } from './makersRest.js';
import { Builder, rbox, box, cyl, cone, sphere, torus, lathe, gear, tube, extrude, lumpy, ico, V3, rgb } from './kit.js';
import { smoke, glowSprite } from './dynamic.js';
import { slotGlow } from './slotGlow.js';
import { plate, vent, stack, grime, flywheel as heroFlywheel } from './bossParts.js';

const PI = Math.PI;
const part = (fn, seed = 1) => { const b = new Builder(seed); fn(b); return b.build(); };
const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// riveted plate helper
function rivets(b, mat, pts, r = 0.018) { for (const p of pts) b.add(sphere(r, 6, 4), mat, { p, c: 0xffffff }); }

function finish(root, o) {
  root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  root.userData.machine = o;
  return root;
}

// shared animator state for machines
class MachineAnim {
  constructor(root, parts) {
    this.root = root; this.p = parts;
    this.t = Math.random() * 10; this.phase = 0; this.speed = 0;
    this.atk = -1; this.atkDur = 0.8; this.hitT = 0; this.dead = false; this.deadT = 0; this.stun = false;
    this.dynamics = [];
  }
  attack(dur = 0.8, kind = 'main') { if (this.dead) return; this.atk = 0; this.atkDur = dur; this.atkKind = kind; }
  hit() { this.hitT = 1; }
  die() { this.dead = true; this.deadT = 0; }
  revive() { this.dead = false; this.deadT = 0; this.root.rotation.set(0, this.root.rotation.y, 0); }
  // returns attack progress 0..1 or -1
  stepAttack(dt) {
    if (this.atk < 0) return -1;
    this.atk += dt / this.atkDur;
    if (this.atk >= 1) { this.atk = -1; return -1; }
    return this.atk;
  }
}

// --------------------------------------------------------------------------
// shared detailing helpers for the common machines
// bevelled solid disc on the y axis (rotate to taste): wheels, flywheels and hub caps are always solid, never spoked
const bdisc = (r, w, e = Math.min(r * 0.14, w * 0.3), seg = 22) => lathe([[0.001, -w / 2], [r - e, -w / 2], [r, -w / 2 + e], [r, w / 2 - e], [r - e, w / 2], [0.001, w / 2]], seg);
// a straight row of bolts from a to b
function boltRow(b, mat, a, z, n, r = 0.016) {
  const pts = [];
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); pts.push([a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t, a[2] + (z[2] - a[2]) * t]); }
  rivets(b, mat, pts, r);
}
// per-vertex wear: soft streaky darkening and a little warm/cool drift, so plates are not flat toy colours
function wear(base, amt = 0.22, seed = 0) {
  const c0 = rgb(base);
  return (x, y, z) => {
    const n = 0.5 + 0.5 * Math.sin(x * 9.1 + z * 6.3 + seed) * Math.sin(y * 7.7 - x * 3.1 + seed * 1.7);
    const k = 1 - amt * n, w = 1 + (n - 0.5) * amt * 0.25;
    return [c0[0] * k * w, c0[1] * k, c0[2] * k / w];
  };
}
// an offset bolt plate on a disc face (axis x): shows the turn without any spoke pattern
function hubPlate(b, mat, x, r, s = 1, c = 0xffffff) {
  b.add(rbox(0.02 * s, r * 0.42, r * 0.3, 0.006 * s), mat, { p: [x, r * 0.52, 0], c });
  rivets(b, mat, [[x + Math.sign(x) * 0.012 * s, r * 0.62, 0], [x + Math.sign(x) * 0.012 * s, r * 0.42, 0]], 0.012 * s);
}

// ==========================================================================
// GEARLING — a monowheel scrap machine: twin armoured pods round one solid wheel, a cross boiler on the deck
// ==========================================================================
export function buildGearling(variant = 0) {
  const big = variant === 1 ? 1.45 : 1;
  const S = (v) => v * big;
  const P = (x, y, z) => [x * big, y * big, z * big];
  const scrap = variant === 1;
  // 0 Rogue Gearling: polished foundry brass, copper trim, orange furnace; 1 Scrap Roller: blackened iron, rust patches, red furnace
  const main = scrap ? 'wIron' : 'wBrass', trim = scrap ? 'wRust' : 'wCopper', glow = scrap ? 'wGlowRed' : 'wGlowOrange';
  const mainC = wear(scrap ? '#8a8682' : '#f0e0c0', scrap ? 0.35 : 0.2, scrap ? 3 : 1), trimC = wear(scrap ? '#d8b8a0' : 0xffffff, 0.25, 2);
  const grime = { y0: S(-0.2), y1: S(0.2), min: scrap ? 0.55 : 0.7 };
  const root = new THREE.Group();
  const body = pivot(root, 0, 0.55 * big, 0);
  // wheel (rolls): dark tyre disc, iron face plates, brass hub caps and an offset bolt plate per face
  const wheel = pivot(root, 0, 0.36 * big, 0);
  wheel.add(part((b) => {
    b.add(bdisc(S(0.36), S(0.17), S(0.04)), 'wDark', { r: [0, 0, PI / 2], c: '#4a4846' });
    // a square axle nut on the plain disc (an iron face disc and a round brass cap read as discs in a ring, an eye)
    b.add(rbox(S(0.24), S(0.12), S(0.12), S(0.015), 1), 'wBrass', { c: 0xffffff });
    for (const sx of [-1, 1]) hubPlate(b, 'wBrass', sx * S(0.104), S(0.27), big);
  }, 2));
  // hull: two armoured pods astride the wheel, a deck, a cross-mounted boiler and a rear firebox
  body.add(part((b) => {
    for (const sx of [-1, 1]) {
      b.add(rbox(S(0.15), S(0.36), S(0.62), S(0.05)), main, { p: P(sx * 0.205, -0.02, -0.02), c: mainC, ao: grime });
      // sloped nose plate and a lower skid
      b.add(rbox(S(0.16), S(0.05), S(0.2), S(0.015)), trim, { p: P(sx * 0.205, 0.1, 0.3), r: [0.55, 0, 0], c: trimC });
      b.add(rbox(S(0.12), S(0.05), S(0.5), S(0.02)), 'wDark', { p: P(sx * 0.205, -0.22, 0), c: 0xffffff });
      // outer armour plate with bolt lines top and bottom
      b.add(rbox(S(0.03), S(0.28), S(0.5), S(0.012)), trim, { p: P(sx * 0.29, -0.01, 0), c: trimC });
      boltRow(b, main, P(sx * 0.307, 0.105, -0.21), P(sx * 0.307, 0.105, 0.21), 5, S(0.014));
      boltRow(b, main, P(sx * 0.307, -0.125, -0.21), P(sx * 0.307, -0.125, 0.21), 5, S(0.014));
      // furnace vent: a glowing slot behind two dark louvres, on the side only
      b.add(box(S(0.012), S(0.09), S(0.24)), glow, { p: P(sx * 0.304, 0.0, -0.04), c: 0xffffff });
      for (const y of [-0.018, 0.018]) b.add(box(S(0.02), S(0.014), S(0.26)), 'wDark', { p: P(sx * 0.309, y, -0.04), c: 0xffffff });
    }
    // deck and a sloped front cowl over the wheel (flat plates)
    b.add(rbox(S(0.58), S(0.05), S(0.6), S(0.02)), trim, { p: P(0, 0.2, -0.04), c: trimC });
    b.add(rbox(S(0.3), S(0.035), S(0.2), S(0.012)), main, { p: P(0, 0.17, 0.3), r: [0.5, 0, 0], c: mainC });
    // cross boiler (axis x): a squared, round-edged drum with flat square end caps and two bands (a round boiler end showed
    // from the side as one big disc above the wheel, an eye)
    b.add(rbox(S(0.44), S(0.26), S(0.26), S(0.06)), main, { p: P(0, 0.355, -0.12), c: mainC, ao: { y0: S(0.24), y1: S(0.48), min: 0.75 } });
    for (const x of [-0.235, 0.235]) b.add(rbox(S(0.035), S(0.28), S(0.28), S(0.03)), trim, { p: P(x, 0.355, -0.12), c: trimC });
    for (const x of [-0.09, 0.09]) b.add(rbox(S(0.03), S(0.274), S(0.274), S(0.06)), 'wDark', { p: P(x, 0.355, -0.12), c: 0xffffff });
    // rear firebox with a furnace slot (faces backwards)
    b.add(rbox(S(0.34), S(0.2), S(0.12), S(0.025)), 'wDark', { p: P(0, 0.08, -0.36), c: 0xffffff });
    b.add(box(S(0.24), S(0.05), S(0.02)), glow, { p: P(0, 0.1, -0.425), c: 0xffffff });
    b.add(box(S(0.26), S(0.016), S(0.03)), 'wDark', { p: P(0, 0.1, -0.43), c: 0xffffff });
    // piston sleeves (two, in line along the centre) and the exhaust stack on one side
    for (const z of [0.08, 0.2]) b.add(rbox(S(0.1), S(0.1), S(0.1), S(0.012)), 'wDark', { p: P(0, 0.27, z), c: 0xffffff }); // square sleeves: two round tops in a row read as a pair of eyes from above
    b.add(cyl(S(0.04), S(0.05), S(0.24), 12), 'wDark', { p: P(-0.17, 0.49, -0.22), c: 0xffffff });
    b.add(cyl(S(0.055), S(0.055), S(0.04), 12), trim, { p: P(-0.17, 0.6, -0.22), c: trimC });
    if (scrap) {
      // bolted-on scrap: an off-square patch plate and a spare tread block on the deck
      b.add(rbox(S(0.02), S(0.16), S(0.2), S(0.006)), 'wRust', { p: P(-0.312, 0.06, 0.12), r: [0.18, 0, 0], c: '#c89870' });
      rivets(b, 'wIron', [P(-0.324, 0.12, 0.05), P(-0.324, 0.0, 0.2), P(-0.324, 0.14, 0.19)], S(0.012));
      b.add(rbox(S(0.16), S(0.06), S(0.1), S(0.015)), 'wDark', { p: P(0.17, 0.25, 0.14), r: [0, 0.3, 0], c: 0xffffff });
    }
  }, 3));
  // flywheels on the pod flanks (turn while idle and faster on the move)
  const sideGears = [];
  for (const sx of [-1, 1]) {
    const g1 = pivot(body, sx * 0.325 * big, -0.1 * big, -0.17 * big);
    g1.add(part((b) => {
      b.add(bdisc(S(0.085), S(0.035), S(0.01), 18), 'wDark', { r: [0, 0, PI / 2], c: '#8a8278' });
      b.add(rbox(S(0.02), S(0.05), S(0.03), S(0.005)), 'wDark', { p: [sx * S(0.02), S(0.045), 0], c: '#d8c8a0' });
    }, 4));
    sideGears.push(g1);
  }
  // pistons: two rods that pump with the wheel
  const pistons = [];
  for (const z of [0.08, 0.2]) {
    const pz = pivot(body, 0, 0.32 * big, z * big);
    pz.add(part((b) => {
      b.add(cyl(S(0.022), S(0.022), S(0.12), 8), 'wMetal', { p: [0, 0, 0], c: 0xffffff });
      b.add(rbox(S(0.075), S(0.025), S(0.06), S(0.008)), 'wMetal', { p: [0, S(0.06), 0], c: '#d8d0c0' });
    }, 6));
    pistons.push(pz);
  }
  // claws / grinder arms on hydraulic sleeves
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = pivot(body, sx * 0.31 * big, 0.06 * big, 0.14 * big);
    const arm = part((b) => {
      b.add(rbox(S(0.07), S(0.1), S(0.1), S(0.02)), 'wDark', { c: 0xffffff });
      b.add(cyl(S(0.032), S(0.032), S(0.14), 10), 'wDark', { p: [0, 0, S(0.1)], r: [PI / 2, 0, 0], c: 0xffffff });
      b.add(cyl(S(0.02), S(0.02), S(0.14), 8), 'wMetal', { p: [0, 0, S(0.2)], r: [PI / 2, 0, 0], c: 0xffffff });
      if (scrap && sx > 0) {
        // grinding disc: solid, bevelled, with an offset bolt plate
        b.add(rbox(S(0.05), S(0.08), S(0.06), S(0.01)), 'wDark', { p: [0, 0, S(0.28)], c: 0xffffff });
        b.add(bdisc(S(0.14), S(0.025), S(0.008), 22), 'wMetal', { p: [S(0.04), 0, S(0.3)], r: [0, 0, PI / 2], c: '#c8c4bc' });
        b.add(rbox(S(0.012), S(0.05), S(0.035), S(0.004)), 'wDark', { p: [S(0.055), S(0.08), S(0.3)], c: 0xffffff });
      } else {
        // pincer: a block and two flat blades
        b.add(rbox(S(0.07), S(0.07), S(0.06), S(0.015)), 'wDark', { p: [0, 0, S(0.28)], c: 0xffffff });
        for (const s2 of [-1, 1]) b.add(rbox(S(0.025), S(0.03), S(0.14), S(0.008)), 'wMetal', { p: [s2 * S(0.025), 0, S(0.36)], r: [0, -s2 * 0.25, 0], c: 0xffffff });
      }
    }, 5 + sx);
    sh.add(arm);
    arms.push(sh);
  }
  const puff = smoke({ rate: 2.5, life: 1.6, size: 0.35 * big, rise: 0.8, color: scrap ? 0x6a645c : 0x9a948c, opacity: 0.4 });
  puff.position.set(-0.17 * big, 0.64 * big, -0.22 * big);
  body.add(puff);
  const a = new MachineAnim(root, { body, wheel, sideGears, arms, pistons });
  a.dynamics.push(puff);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.7);
      p.body.rotation.z = k * 1.2; p.body.position.y = (0.55 - 0.3 * k) * big;
      p.wheel.rotation.z = k * 1.4; p.wheel.position.y = (0.36 - 0.2 * k) * big;
      return;
    }
    const ts = this.stun ? 0.1 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 8);
    p.wheel.rotation.x += (this.speed / (0.36 * big)) * dt * ts;
    for (let i = 0; i < p.sideGears.length; i++) p.sideGears[i].rotation.x += (i % 2 ? -2.2 : 1.6) * (1 + this.speed) * dt * ts;
    // pistons pump on the engine beat (faster when rolling); a stunned engine barely turns
    this.pump = (this.pump || 0) + (5 + this.speed * 3) * dt * ts;
    for (let i = 0; i < p.pistons.length; i++) p.pistons[i].position.y = (0.32 + 0.035 * Math.sin(this.pump + i * PI)) * big;
    const bob = Math.sin(this.t * (6 + this.speed * 2)) * 0.02 * big;
    p.body.position.y = 0.55 * big + bob;
    p.body.rotation.x = Math.min(0.25, this.speed * 0.05) + Math.sin(this.t * 2) * 0.03;
    p.body.rotation.z = Math.sin(this.t * 1.3) * 0.03;
    const at = this.stepAttack(dt);
    for (let i = 0; i < 2; i++) {
      const arm = p.arms[i];
      const idle = Math.sin(this.t * 3 + i * 2) * 0.15;
      let lunge = 0;
      if (at >= 0) lunge = at < 0.35 ? -0.8 * (at / 0.35) : at < 0.5 ? -0.8 + 1.8 * ((at - 0.35) / 0.15) : 1.0 * (1 - (at - 0.5) / 0.5);
      arm.rotation.x = idle - lunge * 0.9;
    }
    if (at >= 0) p.body.position.z = Math.sin(at * PI) * 0.15 * big; else p.body.position.z = 0;
    if (this.hitT > 0) { this.hitT -= dt * 4; p.body.rotation.x -= this.hitT * 0.3; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  root.userData.height = 1.0 * big;
  // the Tripo model (tripoModels.js): its front (+z) leads like the built one, smoke from its stack; the Scrap Roller
  // (and Old Rattletrap) in blackened iron and rust
  return wearModel(finish(root, a), 'gearling', { fit: 'long', stretch: [0.88, 1.15], motion: MOTION.mob,
    keep: [puff], fx: [[puff, [-0.116, 0.67, 0.066]]], tint: scrap ? { c: '#8a6450', k: 0.65, b: 0.6 } : null });
}

// ==========================================================================
// SAND CRAWLER — tracked drilling machine: rust hull, engine house with side furnace louvres, winch drum,
// two moving track-link runs per side, solid sprocket and idler discs, drill on twin rams
// ==========================================================================
export function buildCrawler(tint = null) {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0.55, 0);
  const rustC = wear('#e8c8a0', 0.3, 5), ironC = wear('#c8c0b8', 0.22, 7);
  const STACKS = [[-0.62, 0.74], [-0.3, 0.56]];
  const hull = part((b) => {
    // lower hull with a sloped glacis and a rear apron
    b.add(rbox(1.0, 0.42, 1.62, 0.07), 'wRust', { p: [0, 0.12, -0.02], c: rustC, ao: { y0: -0.1, y1: 0.3, min: 0.6 } });
    b.add(rbox(0.96, 0.08, 0.5, 0.025), 'wIron', { p: [0, 0.2, 0.86], r: [0.62, 0, 0], c: ironC });
    b.add(rbox(0.9, 0.3, 0.08, 0.03), 'wIron', { p: [0, 0.08, -0.84], r: [-0.25, 0, 0], c: ironC });
    boltRow(b, 'wBrass', [-0.4, 0.33, 0.66], [0.4, 0.33, 0.66], 7, 0.017);
    // side skirts over the tracks: bolt lines, a dark lip and a scuffed lower edge
    for (const sx of [-1, 1]) {
      b.add(rbox(0.05, 0.28, 1.88, 0.02), 'wIron', { p: [sx * 0.79, -0.07, 0], c: wear('#b8b0a8', 0.32, sx + 9), ao: { y0: -0.2, y1: 0.05, min: 0.65 } });
      b.add(rbox(0.32, 0.04, 1.9, 0.015), 'wDark', { p: [sx * 0.66, 0.08, 0], c: 0xffffff });
      boltRow(b, 'wBrass', [sx * 0.82, 0.03, -0.84], [sx * 0.82, 0.03, 0.84], 9, 0.017);
      boltRow(b, 'wBrass', [sx * 0.82, -0.17, -0.84], [sx * 0.82, -0.17, 0.84], 9, 0.017);
      // shoulder plate stepping up from the skirt to the hull side
      b.add(rbox(0.22, 0.05, 1.5, 0.02), 'wRust', { p: [sx * 0.6, 0.35, -0.05], r: [0, 0, -sx * 0.35], c: rustC });
    }
    // engine house with an overhanging roof
    b.add(rbox(0.84, 0.36, 1.0, 0.05), 'wIron', { p: [0, 0.5, -0.25], c: ironC });
    b.add(rbox(0.92, 0.05, 1.08, 0.02), 'wDark', { p: [0, 0.705, -0.25], c: 0xffffff });
    boltRow(b, 'wBrass', [-0.42, 0.66, 0.26], [0.42, 0.66, 0.26], 7, 0.015);
    // side furnace louvres: glow behind four dark slats, both flanks (never on the front)
    for (const sx of [-1, 1]) {
      b.add(box(0.02, 0.22, 0.62), 'wGlowOrange', { p: [sx * 0.42, 0.48, -0.25], c: 0xffffff });
      for (let i = 0; i < 4; i++) b.add(box(0.05, 0.026, 0.66), 'wDark', { p: [sx * 0.432, 0.395 + i * 0.056, -0.25], c: 0xffffff });
    }
    // rear furnace door: a slot behind three slats
    b.add(rbox(0.52, 0.24, 0.06, 0.02), 'wDark', { p: [0, 0.5, -0.76], c: 0xffffff });
    b.add(box(0.4, 0.1, 0.02), 'wGlowOrange', { p: [0, 0.5, -0.795], c: 0xffffff });
    for (const x of [-0.1, 0, 0.1]) b.add(box(0.026, 0.13, 0.03), 'wDark', { p: [x, 0.5, -0.8], c: 0xffffff });
    // two stacks of different heights with collars
    // (both on the left flank, one behind the other, so no view pairs them up)
    // square stacks: two round open stacks showed from straight above as a pair of crescents
    for (const [sz, h] of STACKS) {
      b.add(rbox(0.17, h, 0.17, 0.02), 'wCopper', { p: [-0.27, 0.7 + h / 2, sz], c: wear(0xffffff, 0.25, sz * 10) });
      b.add(rbox(0.21, 0.05, 0.21, 0.015), 'wBrass', { p: [-0.27, 0.75, sz], c: 0xffffff });
      b.add(rbox(0.2, 0.06, 0.2, 0.015), 'wDark', { p: [-0.27, 0.7 + h, sz], c: 0xffffff });
    }
    // roof hatch on the right flank
    b.add(rbox(0.3, 0.05, 0.36, 0.02), 'wIron', { p: [0.2, 0.75, -0.42], c: ironC });
    rivets(b, 'wBrass', [[0.08, 0.78, -0.57], [0.32, 0.78, -0.57], [0.08, 0.78, -0.27], [0.32, 0.78, -0.27]], 0.016);
    // winch brackets on the roof front
    for (const sx of [-1, 1]) b.add(rbox(0.06, 0.2, 0.18, 0.02), 'wDark', { p: [sx * 0.31, 0.8, 0.1], c: 0xffffff });
    // drill ram barrels on the front deck (the arm's rods slide in and out of them)
    for (const sx of [-0.22, 0.22]) {
      // square barrels and collars: two round barrel ends side by side read as a pair of eyes from the front
      b.add(rbox(0.124, 0.124, 0.42, 0.015), 'wDark', { p: [sx, 0.25, 0.62], c: 0xffffff });
      b.add(rbox(0.144, 0.144, 0.04, 0.012), 'wBrass', { p: [sx, 0.25, 0.83], c: 0xffffff });
    }
  }, 21);
  body.add(hull);
  // winch drum (turns): brass drum with dark cable bands
  const drum = pivot(body, 0, 0.84, 0.1);
  drum.add(part((b) => {
    b.add(cyl(0.1, 0.1, 0.54, 14), 'wBrass', { r: [0, 0, PI / 2], c: wear(0xffffff, 0.2, 4) });
    for (const x of [-0.12, 0.13]) b.add(cyl(0.108, 0.108, 0.09, 14), 'wDark', { p: [x, 0, 0], r: [0, 0, PI / 2], c: '#6a6058' });
    b.add(rbox(0.5, 0.025, 0.04, 0.008), 'wDark', { p: [0, 0.1, 0], c: '#9a9088' });
  }, 26));
  // tracks: a dark belt per side and two runs of link plates (top and bottom) that slide by one link pitch and wrap
  const TX = 0.6, PITCH = 0.125, NL = 14, Z0 = -0.86;
  root.add(part((b) => {
    for (const sx of [-1, 1]) {
      b.add(rbox(0.28, 0.4, 2.0, 0.19), 'wDark', { p: [sx * TX, 0.22, 0], c: '#3a3836' });
    }
  }, 22));
  const runs = [];
  for (const top of [true, false]) {
    const g = new THREE.Group();
    g.add(part((b) => {
      for (const sx of [-1, 1]) for (let i = 0; i < NL; i++) {
        const z = Z0 + i * PITCH, y = top ? 0.425 : 0.015, n = top ? 1 : -1;
        b.add(box(0.31, 0.035, 0.1), 'wIron', { p: [sx * TX, y, z], c: '#6a625a' });
        b.add(box(0.31, 0.02, 0.026), 'wIron', { p: [sx * TX, y + n * 0.02, z], c: '#b0a290' }); // worn-bright cleat
      }
    }, 27));
    root.add(g); runs.push(g);
  }
  // sprocket (rear) and idler (front) per side: solid discs with a brass hub and offset bolt plate; three road wheels between
  const wheels = [];
  for (const sx of [-1, 1]) {
    for (const z of [-0.8, 0.8]) {
      const w = pivot(root, sx * 0.77, 0.22, z);
      w.add(part((b) => {
        b.add(bdisc(0.215, 0.05, 0.015), 'wIron', { r: [0, 0, PI / 2], c: '#8a8278' });
        b.add(rbox(0.08, 0.1, 0.1, 0.012, 1), 'wBrass', { c: 0xffffff }); // square axle nut, no round hub in the disc
        hubPlate(b, 'wBrass', sx * 0.03, 0.215);
      }, 23));
      wheels.push(w);
    }
    for (const z of [-0.4, 0, 0.4]) {
      const w = pivot(root, sx * 0.77, 0.16, z);
      w.add(part((b) => {
        b.add(bdisc(0.135, 0.045, 0.012, 18), 'wDark', { r: [0, 0, PI / 2], c: '#7a746c' });
        b.add(rbox(0.06, 0.06, 0.06, 0.008, 1), 'wDark', { c: '#b8a888' }); // square axle nut
        b.add(rbox(0.015, 0.05, 0.035, 0.005), 'wDark', { p: [sx * 0.026, 0.085, 0], c: '#d0c0a0' });
      }, 28));
      wheels.push(w);
    }
  }
  // drill on a piston arm
  const drillArm = pivot(body, 0, 0.25, 0.9);
  drillArm.add(part((b) => {
    b.add(cyl(0.17, 0.19, 0.25, 16), 'wIron', { r: [PI / 2, 0, 0], p: [0, 0, 0.05], c: '#a8a098' });
    b.add(cyl(0.2, 0.2, 0.05, 16), 'wIron', { r: [PI / 2, 0, 0], p: [0, 0, 0.17], c: '#d8c8a8' });
    b.add(rbox(0.56, 0.1, 0.12, 0.03), 'wIron', { p: [0, 0, -0.05], c: '#8a8278' });
    for (const sx of [-0.22, 0.22]) b.add(cyl(0.035, 0.035, 0.5, 8), 'wMetal', { p: [sx, 0, -0.25], r: [PI / 2, 0, 0], c: 0xffffff });
  }, 24));
  const drill = pivot(drillArm, 0, 0, 0.2);
  drill.add(part((b) => {
    // fluted drill bit: cone with two spiral ridges
    b.add(cone(0.22, 0.8, 16), 'wMetal', { p: [0, 0, 0.42], r: [PI / 2, 0, 0], c: 0xffffff });
    for (const ph of [0, PI]) {
      const pts = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40, a = ph + t * PI * 5, r = 0.22 * (1 - t) + 0.01; pts.push(V3(Math.cos(a) * r, Math.sin(a) * r, 0.02 + t * 0.8)); }
      b.add(tube(pts, (t) => 0.032 * (1 - t) + 0.008, 5, 60, { capEnd: true }), 'wBrass', { uv: 'keep', c: 0xffffff });
    }
  }, 25));
  const stacks = [];
  for (const [sz, h] of STACKS) {
    const sm = smoke({ rate: 4, life: 2.2, size: 0.6, rise: 1.4, color: 0x5a544c, opacity: 0.5 });
    sm.position.set(-0.27, 0.76 + h, sz);
    body.add(sm);
    stacks.push(sm);
  }
  const a = new MachineAnim(root, { body, wheels, drillArm, drill, drum, runs });
  a.dynamics.push(...stacks);
  a.trackS = 0;
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.8);
      p.body.rotation.z = k * 0.25; p.body.position.y = 0.55 - 0.15 * k; p.drillArm.rotation.x = k * 0.6;
      return;
    }
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    for (let i = 0; i < p.wheels.length; i++) p.wheels[i].rotation.x += (this.speed / (i % 5 < 2 ? 0.215 : 0.135)) * dt;
    // track links: the top run moves forward and the bottom run back relative to the hull, wrapping each pitch
    this.trackS = (this.trackS + this.speed * dt) % PITCH;
    p.runs[0].position.z = this.trackS; p.runs[1].position.z = -this.trackS;
    p.drum.rotation.x -= (0.6 + this.speed * 0.8 + (this.atk >= 0 ? 4 : 0)) * dt;
    p.drill.rotation.z += (6 + this.speed * 4 + (this.atk >= 0 ? 30 : 0)) * dt;
    p.body.position.y = 0.55 + Math.sin(this.t * 22) * 0.008 * (1 + this.speed);
    p.body.rotation.x = Math.sin(this.t * 1.7) * 0.012;
    const at = this.stepAttack(dt);
    p.drillArm.position.z = 0.9 + (at >= 0 ? (at < 0.3 ? -0.2 * (at / 0.3) : at < 0.5 ? -0.2 + 0.7 * ((at - 0.3) / 0.2) : 0.5 * (1 - (at - 0.5) / 0.5)) : 0);
    p.drillArm.rotation.x = Math.sin(this.t * 1.1) * 0.05;
    if (this.hitT > 0) { this.hitT -= dt * 4; p.body.rotation.z = Math.sin(this.hitT * 20) * 0.03; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  root.userData.height = 1.6;
  // the Tripo model (tripoModels.js), a quarter turn (it came out side-on: its drill at -x leads); smoke from its two stacks
  return wearModel(finish(root, a), 'sandcrawler', { turn: 1, fit: 'long', stretch: [0.9, 1.12], tint, motion: MOTION.mob,
    fx: [[stacks[0], [0.4, 0.5, -0.05]], [stacks[1], [0.15, 0.49, 0]]] });
}

// ==========================================================================
// BRASS SENTINEL — biped piston walker
// ==========================================================================
function sentinelParts(variant) {
  // 0 foundry brass, 1 rusted (Northwatch), 2 copper and gold (the vault), 3 the Brass Concord's white enamel, 4 the Exchequer's black iron and gold
  const main = variant === 1 ? 'wRust' : variant === 2 ? 'wCopper' : variant === 3 ? 'wPaint' : variant === 4 ? 'wIron' : variant === 5 ? 'crystalTeal' : 'wBrass';
  const trim = variant === 1 ? 'wIron' : variant === 2 ? 'wGold' : variant === 3 ? 'wBrass' : variant === 4 ? 'wGold' : variant === 5 ? 'wBrass' : 'wCopper';
  const tint = variant === 1 ? '#c8a888' : variant === 2 ? '#f0d8b8' : variant === 3 ? '#e8e2d4' : variant === 4 ? '#8a8480' : variant === 5 ? '#c8f0ec' : 0xffffff;
  // how worn the plating is: rusted Northwatch engines are filthy, the Concord's enamel and the crystal one are kept clean
  const worn = variant === 1 ? 0.38 : variant === 3 || variant === 5 ? 0.1 : variant === 4 ? 0.18 : 0.24;
  return { main, trim, tint, worn };
}
export function buildSentinel(variant = 0) {
  const { main, trim, tint, worn } = sentinelParts(variant);
  const mainC = wear(tint, worn, variant * 3 + 1), trimC = wear(0xffffff, worn * 0.7, variant + 11);
  const root = new THREE.Group();
  const pelvis = pivot(root, 0, 1.25, 0);
  const torso = pivot(pelvis, 0, 0.12, 0);
  torso.add(part((b) => {
    b.add(rbox(0.86, 0.82, 0.62, 0.09), main, { p: [0, 0.46, 0], c: mainC, ao: { y0: 0.0, y1: 0.5, min: 0.72 } });
    // layered chest plate with a bolt line top and bottom, and a heavy collar
    b.add(rbox(0.72, 0.36, 0.1, 0.04), main, { p: [0, 0.64, 0.3], r: [-0.08, 0, 0], c: mainC });
    boltRow(b, trim, [-0.31, 0.79, 0.37], [0.31, 0.79, 0.37], 7);
    boltRow(b, trim, [-0.31, 0.49, 0.35], [0.31, 0.49, 0.35], 7);
    b.add(rbox(0.92, 0.1, 0.68, 0.035), trim, { p: [0, 0.88, 0], c: trimC });
    // furnace door low on the chest: a glowing slot behind three slats in a dark frame
    b.add(rbox(0.46, 0.2, 0.06, 0.02), 'wDark', { p: [0, 0.3, 0.31], c: 0xffffff });
    b.add(box(0.36, 0.12, 0.02), 'wGlowOrange', { p: [0, 0.3, 0.338], c: 0xffffff });
    for (const y of [0.265, 0.3, 0.335]) b.add(box(0.38, 0.016, 0.03), 'wDark', { p: [0, y, 0.345], c: 0xffffff });
    // waist: trim band over a dark segmented skirt
    b.add(rbox(0.74, 0.14, 0.66, 0.05), trim, { p: [0, 0.1, 0], c: trimC });
    b.add(rbox(0.62, 0.1, 0.56, 0.03), 'wDark', { p: [0, -0.01, 0], c: 0xffffff });
    // boiler tank on the back + smokestack, and a rear firebox slot
    b.add(cyl(0.22, 0.22, 0.75, 16), 'wCopper', { p: [0, 0.5, -0.42], c: wear(0xffffff, worn, 21) });
    for (const y of [0.2, 0.5, 0.8]) b.add(cyl(0.232, 0.232, 0.035, 16), trim, { p: [0, y, -0.42], c: trimC });
    b.add(cyl(0.07, 0.09, 0.6, 12), 'wDark', { p: [0.18, 1.1, -0.42], c: 0xffffff });
    b.add(cyl(0.095, 0.095, 0.05, 12), trim, { p: [0.18, 0.92, -0.42], c: trimC });
    b.add(rbox(0.3, 0.14, 0.08, 0.02), 'wDark', { p: [0, 0.12, -0.62], c: 0xffffff });
    b.add(box(0.22, 0.045, 0.02), 'wGlowOrange', { p: [0, 0.12, -0.665], c: 0xffffff });
    // flywheel axle bracket on the back plate
    b.add(rbox(0.08, 0.1, 0.12, 0.02), 'wDark', { p: [-0.3, 0.74, -0.36], c: 0xffffff });
    // shoulder joint caps: solid bevelled discs with an offset bolt plate
    for (const sx of [-1, 1]) {
      b.add(bdisc(0.16, 0.06, 0.015, 20), trim, { p: [sx * 0.46, 0.72, 0], r: [0, 0, PI / 2], c: trimC });
      hubPlate(b, trim, sx * 0.495, 0.16, 1, trimC);
    }
  }, 31));
  // back flywheel (turns with the engine)
  const flywheel = pivot(torso, -0.3, 0.74, -0.44);
  flywheel.add(part((b) => {
    b.add(bdisc(0.13, 0.045, 0.012, 20), 'wDark', { r: [PI / 2, 0, 0], c: '#8a8278' });
    b.add(rbox(0.045, 0.06, 0.02, 0.006), 'wDark', { p: [0, 0.075, -0.03], c: '#d8c8a0' });
  }, 37));
  // head turret: a squat block under an overhanging brow plate, one visor slit
  const head = pivot(torso, 0, 0.95, 0.05);
  head.add(part((b) => {
    b.add(rbox(0.4, 0.26, 0.38, 0.06), main, { p: [0, 0.12, 0], c: mainC });
    b.add(rbox(0.46, 0.06, 0.44, 0.02), trim, { p: [0, 0.27, 0.01], c: trimC });
    b.add(rbox(0.44, 0.05, 0.12, 0.02), trim, { p: [0, 0.22, 0.17], r: [0.35, 0, 0], c: trimC });
    b.add(rbox(0.3, 0.045, 0.05, 0.02), 'wGlowAmber', { p: [0, 0.135, 0.18], c: 0xffffff });
    b.add(rbox(0.36, 0.05, 0.03, 0.01), 'wDark', { p: [0, 0.065, 0.19], c: 0xffffff });
    boltRow(b, trim, [0.205, 0.05, -0.12], [0.205, 0.05, 0.12], 3, 0.014);
    boltRow(b, trim, [-0.205, 0.05, -0.12], [-0.205, 0.05, 0.12], 3, 0.014);
    b.add(cyl(0.01, 0.01, 0.2, 6), 'wDark', { p: [-0.13, 0.38, -0.1], c: 0xffffff });
  }, 32));
  // arms: right = hammer fist, left = shield plate
  const arms = {};
  for (const sx of [-1, 1]) {
    const sh = pivot(torso, sx * 0.58, 0.72, 0);
    const up = part((b) => {
      b.add(sphere(0.15, 12, 10), trim, { c: trimC });
      // stepped pauldron: two flat plates sloping off the shoulder
      b.add(rbox(0.36, 0.07, 0.44, 0.03), main, { p: [sx * 0.04, 0.16, 0], r: [0, 0, -sx * 0.32], c: mainC });
      b.add(rbox(0.26, 0.05, 0.4, 0.02), trim, { p: [sx * 0.15, 0.06, 0], r: [0, 0, -sx * 0.75], c: trimC });
      boltRow(b, trim, [sx * 0.06, 0.2, -0.17], [sx * 0.06, 0.2, 0.17], 3, 0.015);
      b.add(rbox(0.18, 0.5, 0.2, 0.05), main, { p: [0, -0.3, 0], c: mainC });
      b.add(cyl(0.03, 0.03, 0.4, 8), 'wMetal', { p: [sx * 0.1, -0.28, 0.06], c: 0xffffff }); // piston
    }, 33);
    sh.add(up);
    const el = pivot(sh, 0, -0.58, 0);
    el.add(part((b) => {
      b.add(sphere(0.11, 10, 8), trim, { c: trimC });
      b.add(rbox(0.2, 0.5, 0.22, 0.05), main, { p: [0, -0.28, 0], c: mainC });
      b.add(rbox(0.23, 0.12, 0.25, 0.03), trim, { p: [0, -0.1, 0], c: trimC }); // forearm cuff
      if (sx < 0) {
        // hammer fist: a dark block between trim cheek plates, a hot slot in each striking side
        b.add(rbox(0.38, 0.34, 0.4, 0.05), 'wDark', { p: [0, -0.62, 0], c: 0xffffff });
        for (const s2 of [-1, 1]) {
          b.add(rbox(0.06, 0.38, 0.44, 0.02), trim, { p: [s2 * 0.2, -0.62, 0], c: trimC });
          boltRow(b, main, [s2 * 0.235, -0.5, -0.15], [s2 * 0.235, -0.5, 0.15], 3, 0.016);
        }
        for (const z of [-1, 1]) b.add(box(0.26, 0.045, 0.02), 'wGlowOrange', { p: [0, -0.66, z * 0.202], c: 0xffffff });
        b.add(rbox(0.3, 0.06, 0.34, 0.02), 'wDark', { p: [0, -0.81, 0], c: '#a09890' });
      } else {
        // shield: iron backing, raised main plate, one horizontal bar and a short glow slot above it
        b.add(rbox(0.08, 0.74, 0.58, 0.04), 'wIron', { p: [0.12, -0.42, 0.05], c: wear('#c0b8b0', worn, 31) });
        b.add(rbox(0.09, 0.56, 0.44, 0.03), main, { p: [0.15, -0.42, 0.05], c: mainC });
        b.add(rbox(0.1, 0.06, 0.48, 0.02), trim, { p: [0.16, -0.5, 0.05], c: trimC });
        b.add(box(0.02, 0.04, 0.24), 'wGlowAmber', { p: [0.2, -0.3, 0.05], c: 0xffffff });
        rivets(b, trim, [[0.2, -0.17, -0.15], [0.2, -0.17, 0.25], [0.2, -0.67, -0.15], [0.2, -0.67, 0.25]], 0.02);
      }
    }, 34));
    arms[sx < 0 ? 'R' : 'L'] = { sh, el };
  }
  // legs: thigh with a ram sleeve, a sliding ram rod that follows the knee, shin with knee guard, layered foot
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = pivot(pelvis, sx * 0.26, -0.05, 0);
    const thigh = part((b) => {
      b.add(sphere(0.14, 10, 8), trim, { c: trimC });
      b.add(rbox(0.2, 0.55, 0.24, 0.05), main, { p: [0, -0.3, 0], c: mainC });
      b.add(rbox(0.22, 0.2, 0.06, 0.02), trim, { p: [0, -0.2, 0.12], c: trimC });
      b.add(cyl(0.05, 0.05, 0.24, 10), 'wDark', { p: [sx * 0.14, -0.18, -0.05], c: 0xffffff });
    }, 35);
    hip.add(thigh);
    const ram = pivot(hip, sx * 0.14, -0.42, -0.05);
    ram.add(part((b) => b.add(cyl(0.028, 0.028, 0.3, 8), 'wMetal', { c: 0xffffff }), 38));
    const knee = pivot(hip, 0, -0.6, 0);
    knee.add(part((b) => {
      b.add(sphere(0.12, 10, 8), trim, { c: trimC });
      b.add(rbox(0.18, 0.55, 0.22, 0.05), main, { p: [0, -0.3, 0], c: mainC, ao: { y0: -0.6, y1: -0.1, min: 0.6 } });
      b.add(rbox(0.22, 0.16, 0.07, 0.02), trim, { p: [0, -0.06, 0.12], r: [-0.2, 0, 0], c: trimC }); // knee guard
      b.add(rbox(0.32, 0.12, 0.5, 0.04), 'wDark', { p: [0, -0.6, 0.08], c: 0xffffff }); // foot
      b.add(rbox(0.3, 0.06, 0.16, 0.02), trim, { p: [0, -0.53, 0.3], r: [0.3, 0, 0], c: trimC }); // toe plate
      b.add(rbox(0.26, 0.06, 0.12, 0.02), trim, { p: [0, -0.56, -0.15], c: trimC }); // heel
      b.add(cyl(0.03, 0.03, 0.4, 8), 'wMetal', { p: [0, -0.3, -0.13], c: 0xffffff });
    }, 36));
    legs[sx > 0 ? 'L' : 'R'] = { hip, knee, ram };
  }
  const stack = smoke({ rate: 3, life: 2.4, size: 0.55, rise: 1.6, color: 0x9a948c, opacity: 0.45 });
  stack.position.set(0.18, 1.42, -0.42);
  torso.add(stack);
  const glow = slotGlow(0xff8a30, 0.5, 0.24, 0.55); // a flat bar over the chest furnace door (a round halo there read as one eye)
  glow.position.set(0, 0.3, 0.36);
  torso.add(glow);
  const a = new MachineAnim(root, { pelvis, torso, head, arms, legs, flywheel });
  a.dynamics.push(stack, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.0), e = 1 - Math.pow(1 - k, 3);
      p.pelvis.position.y = 1.25 - 0.85 * e; p.torso.rotation.x = 0.9 * e; p.head.rotation.x = 0.4 * e;
      p.legs.L.hip.rotation.x = -1.2 * e; p.legs.L.knee.rotation.x = 1.8 * e; p.legs.R.hip.rotation.x = -0.9 * e; p.legs.R.knee.rotation.x = 1.6 * e;
      p.arms.R.sh.rotation.x = -0.5 * e; p.arms.L.sh.rotation.z = 0.6 * e;
      return;
    }
    const ts = this.stun ? 0.15 : 1;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    const sk = Math.min(1, this.speed / 2.5);
    this.phase = (this.phase + this.speed * dt * 0.42 * ts) % 1;
    const ph = this.phase * PI * 2;
    // heavy mechanical stride: legs swing, knees bend on the lift, body drops on each footfall
    const swing = Math.sin(ph) * 0.55 * sk;
    p.legs.L.hip.rotation.x = -swing; p.legs.R.hip.rotation.x = swing;
    p.legs.L.knee.rotation.x = Math.max(0, Math.cos(ph)) * 0.9 * sk + 0.05;
    p.legs.R.knee.rotation.x = Math.max(0, -Math.cos(ph)) * 0.9 * sk + 0.05;
    // thigh rams slide out of their sleeves as the knee folds
    for (const L of [p.legs.L, p.legs.R]) L.ram.position.y = -0.42 - L.knee.rotation.x * 0.07;
    p.flywheel.rotation.z += (1.5 + this.speed * 2.5) * dt * ts;
    const stomp = Math.abs(Math.sin(ph));
    p.pelvis.position.y = 1.25 - (1 - stomp) * 0.06 * sk + Math.sin(this.t * 1.5) * 0.015;
    p.pelvis.rotation.z = Math.sin(ph) * 0.06 * sk;
    p.torso.rotation.y = Math.sin(ph) * 0.12 * sk;
    p.head.rotation.y = Math.sin(this.t * 0.7) * 0.4 * (1 - sk);
    p.arms.R.sh.rotation.x = swing * 0.6; p.arms.L.sh.rotation.x = -swing * 0.6 - 0.2;
    p.arms.R.el.rotation.x = -0.25; p.arms.L.el.rotation.x = -0.9; p.arms.L.sh.rotation.z = 0.15;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // overhead hammer slam with the right arm
      const up = at < 0.45 ? at / 0.45 : 1;
      const down = at < 0.45 ? 0 : Math.min(1, (at - 0.45) / 0.12);
      const rec = at > 0.7 ? (at - 0.7) / 0.3 : 0;
      p.arms.R.sh.rotation.x = (-2.6 * up + 3.1 * down) * (1 - rec);
      p.arms.R.el.rotation.x = (-0.6 * up + 0.5 * down) * (1 - rec) - 0.25;
      p.torso.rotation.x = (-0.15 * up + 0.4 * down) * (1 - rec);
      p.pelvis.position.y -= 0.12 * down * (1 - rec);
    } else p.torso.rotation.x = Math.sin(this.t * 1.2) * 0.02;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.torso.rotation.x -= this.hitT * 0.2; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  root.userData.height = 3.0;
  return finish(root, a);
}

// ==========================================================================
// THE FOREMAN — boss engine
// ==========================================================================
// variant 0 the Foreman, 1 Furnace Engine (common), 2 Depths Overseer (elite), 3 the Forgemaster (boss),
// 4 the Buried Engine (boss): a Furnace Engine dug out of the deep, rust and verdigris, rock still packed in its plates
// The two bosses (0 and 3) carry hero detailing: riveted armour staves round the boiler, plated limbs, a back flywheel and
// forge-hot hammer faces. Stacks stand in one line fore and aft and the firebox is square-cut under a square cap plate (no dome, no rings from above).
export function buildForeman(variant = 0) {
  const root = new THREE.Group();
  const S = [1.9, 1.0, 1.3, 2.4, 1.0][variant] || 1.9;
  const BODY = ['wBrass', 'wRust', 'wCopper', 'wSteel', 'wRust'][variant] || 'wBrass';
  const hero = variant === 0 || variant === 3 || variant === 4;
  const TRIM = variant === 3 ? 'wGold' : variant === 4 ? 'wVerdigris' : 'wCopper';
  const J = variant === 3 ? BODY : 'wIron'; // the Forgemaster's joints and limb plates share its steel, one draw per limb
  const bodyC = hero ? (variant === 3 ? grime('#8a847c', -0.2 * S, 1.2 * S, 0.28, 41) : variant === 4 ? grime('#c8a890', -0.3 * S, 1.3 * S, 0.4, 49) : wear(0xffffff, 0.24, 41)) : 0xffffff;
  const trimC = hero ? wear(0xffffff, 0.18, 43) : 0xffffff;
  const ironC = hero ? wear(variant === 3 ? '#6a625c' : '#a09890', 0.28, 44) : 0xffffff;
  const pelvis = pivot(root, 0, 1.5 * S, 0);
  const torso = pivot(pelvis, 0, 0.1 * S, 0);
  torso.add(part((b) => {
    // a square firebox with chamfered corners under a square iron cap plate that covers the whole top, gold straps
    // standing straight up the four corner faces (a round barrel with trim rings read as a disc in a ring from above)
    const fire = (h, c, d, y) => { const s = new THREE.Shape(), a = h * S, k = c * S; s.moveTo(-a + k, -a); s.lineTo(a - k, -a); s.lineTo(a, -a + k); s.lineTo(a, a - k); s.lineTo(a - k, a); s.lineTo(-a + k, a); s.lineTo(-a, a - k); s.lineTo(-a, -a + k); s.closePath(); b.add(extrude(s, d * S, 0.03 * S, 1), BODY, { p: [0, y * S, 0], r: [-PI / 2, 0, 0], c: bodyC }); };
    fire(0.6, 0.16, 0.16, 0.1); // footing
    fire(0.7, 0.2, 0.88, 0.64); // firebox
    fire(0.64, 0.18, 0.08, 1.12); // shoulder step
    b.add(rbox(1.5 * S, 0.07 * S, 1.5 * S, 0.025 * S), 'wIron', { p: [0, 1.19 * S, 0], c: ironC });
    for (let i = 0; i < 4; i++) {
      const a = PI / 4 + i * PI / 2, R = 0.89 * S;
      b.add(rbox(0.12 * S, 0.94 * S, 0.035 * S, 0.012 * S), TRIM, { p: [Math.sin(a) * R, 0.64 * S, Math.cos(a) * R], r: [0, a, 0], c: trimC });
      rivets(b, TRIM, [0.3, 0.55, 0.8, 1.0].map((y) => [Math.sin(a) * (R + 0.02 * S), y * S, Math.cos(a) * (R + 0.02 * S)]), 0.025 * S);
    }
    // furnace door: one louvred grille under a trim brow
    b.addBuilder(vent(0.74 * S, 0.46 * S, { frame: 'wDark', n: 5, depth: 0.12 * S }), { p: [0, 0.6 * S, 0.78 * S] });
    b.add(rbox(0.82 * S, 0.06 * S, 0.14 * S, 0.02 * S), TRIM, { p: [0, 0.86 * S, 0.79 * S], c: trimC });
    b.add(rbox(0.5 * S, 0.12 * S, 0.45 * S, 0.03 * S), 'wIron', { p: [0, 1.24 * S, 0.1 * S], c: ironC });
    // two square stacks in one line fore and aft behind the head
    b.addBuilder(stack(0.26 * S, 1.0 * S, { mat: 'wDark', c: '#3a3634', trim: 'wIron', trimC: '#6a6460', seed: 45 }), { p: [0, 1.12 * S, -0.22 * S] });
    b.addBuilder(stack(0.24 * S, 0.8 * S, { mat: 'wDark', c: '#3a3634', trim: 'wIron', trimC: '#6a6460', seed: 46 }), { p: [0, 1.1 * S, -0.62 * S] });
    // armour skirt plates
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; b.add(rbox(0.36 * S, 0.3 * S, 0.06 * S, 0.02 * S), 'wIron', { p: [Math.sin(a) * 0.66 * S, -0.08 * S, Math.cos(a) * 0.66 * S], r: [0.25, a, 0], order: 'YXZ', c: ironC }); }
    if (hero) {
      // riveted armour staves flat on the side and back faces, leaving the furnace door clear
      [[PI / 2, -0.27], [PI / 2, 0.27], [-PI / 2, -0.27], [-PI / 2, 0.27], [PI, -0.3], [PI, 0.3]].forEach(([a, o], i) => {
        const x = Math.sin(a) * 0.76 + Math.cos(a) * o, z = Math.cos(a) * 0.76 - Math.sin(a) * o;
        b.addBuilder(plate(0.4 * S, 0.3 * S, 0.05 * S, { mat: BODY, c: bodyC, inset: false, trim: TRIM, trimC, boltMat: TRIM, boltC: trimC, seed: 47 + i }), { p: [x * S, 0.62 * S, z * S], r: [0, a, 0] });
      });
      // a rear firebox slot and the flywheel bracket
      b.addBuilder(vent(0.5 * S, 0.2 * S, { frame: 'wDark', glow: 'wDark', n: 2, depth: 0.08 * S }), { p: [0, 0.22 * S, -0.77 * S], r: [0.2, PI, 0] }); // unlit: a lit slot under the back flywheel read as a mouth
      b.add(rbox(0.2 * S, 0.2 * S, 0.16 * S, 0.03 * S), 'wIron', { p: [0, 0.7 * S, -0.8 * S], c: ironC });
      if (variant === 4) for (let i = 0; i < 9; i++) { const a = 0.9 + i * 0.55, y = (0.05 + (i % 3) * 0.12) * S; b.add(ico((0.09 + (i % 2) * 0.05) * S, 0), 'wRust', { p: [Math.sin(a) * 0.74 * S, y, Math.cos(a) * 0.74 * S], r: [i, i * 2, 0], c: wear('#6a5a48', 0.4, i) }); }
      // copper feed pipes from the boiler to each shoulder
      for (const sx of [-1, 1]) b.add(cyl(0.035 * S, 0.035 * S, 0.6 * S, 8), TRIM, { p: [sx * 0.62 * S, 1.02 * S, -0.25 * S], r: [0, 0, sx * 1.1], c: trimC });
    }
  }, 41));
  // head cab with a lens band
  const head = pivot(torso, 0, 1.3 * S, 0.2 * S);
  head.add(part((b) => {
    b.add(rbox(0.6 * S, 0.36 * S, 0.5 * S, 0.08 * S), 'wIron', { p: [0, 0.18 * S, 0], c: ironC });
    // an unlit dark lens band: only the furnace below glows, so the front never reads as eyes over a mouth
    b.add(rbox(0.5 * S, 0.07 * S, 0.06 * S, 0.02 * S), 'wDark', { p: [0, 0.2 * S, 0.25 * S], c: 0xffffff });
    b.add(rbox(0.66 * S, 0.06 * S, 0.54 * S, 0.02 * S), BODY, { p: [0, 0.38 * S, 0], c: bodyC });
    if (hero) {
      // a sloped brow plate over the lens band, cheek plates with bolt rows
      b.add(rbox(0.68 * S, 0.06 * S, 0.16 * S, 0.02 * S), BODY, { p: [0, 0.31 * S, 0.26 * S], r: [0.4, 0, 0], c: bodyC });
      for (const sx of [-1, 1]) {
        b.add(rbox(0.05 * S, 0.3 * S, 0.44 * S, 0.015 * S), BODY, { p: [sx * 0.31 * S, 0.17 * S, 0], c: bodyC });
        for (let k = 0; k < 3; k++) b.add(cyl(0.018 * S, 0.018 * S, 0.02 * S, 6), BODY, { p: [sx * 0.34 * S, 0.08 * S, (-0.14 + k * 0.14) * S], r: [0, 0, PI / 2], c: 0xffffff });
      }
      b.add(rbox(0.4 * S, 0.05 * S, 0.06 * S, 0.015 * S), 'wIron', { p: [0, 0.08 * S, 0.26 * S], c: ironC });
    }
  }, 42));
  // shoulder gears (spinning)
  const gears = [];
  for (const sx of [-1, 1]) {
    const g = pivot(torso, sx * 0.86 * S, 0.95 * S, 0);
    g.add(part((b) => { b.add(gear(22, 0.32 * S, 0.38 * S, 0.1 * S, { hole: 0, spokes: 0 }), TRIM, { r: [0, PI / 2, 0], c: trimC }); b.add(rbox(0.16 * S, 0.12 * S, 0.12 * S, 0.015 * S), 'wDark', { c: 0xffffff }); /* solid gear, square axle nut: a six-spoke gear round a round hub read as a star in a ring */ }, 43));
    gears.push(g);
  }
  // arms with steam hammers
  const arms = {};
  for (const sx of [-1, 1]) {
    const sh = pivot(torso, sx * 1.0 * S, 0.95 * S, 0);
    sh.add(part((b) => {
      b.add(sphere(0.26 * S, 14, 10), J, { c: ironC });
      b.add(rbox(0.36 * S, 0.8 * S, 0.38 * S, 0.08 * S), BODY, { p: [0, -0.45 * S, 0], c: bodyC });
      b.add(cyl(0.06 * S, 0.06 * S, 0.7 * S, 10), 'wMetal', { p: [sx * 0.2 * S, -0.42 * S, 0.1 * S], c: 0xffffff });
      if (hero) {
        // stepped pauldron: two plates sloping off the shoulder, a bolt row along the top one
        b.add(rbox(0.5 * S, 0.08 * S, 0.56 * S, 0.03 * S), BODY, { p: [sx * 0.06 * S, 0.22 * S, 0], r: [0, 0, -sx * 0.3], c: bodyC });
        b.add(rbox(0.36 * S, 0.06 * S, 0.5 * S, 0.02 * S), J, { p: [sx * 0.24 * S, 0.06 * S, 0], r: [0, 0, -sx * 0.8], c: ironC });
        for (let k = 0; k < 4; k++) b.add(cyl(0.02 * S, 0.02 * S, 0.03 * S, 6), J, { p: [sx * 0.08 * S, 0.27 * S, (-0.2 + k * 0.133) * S], r: [0, 0, -sx * 0.3], c: '#c8b080' });
        b.add(rbox(0.38 * S, 0.3 * S, 0.06 * S, 0.02 * S), J, { p: [0, -0.42 * S, 0.2 * S], c: ironC });
      }
    }, 44));
    const el = pivot(sh, 0, -0.9 * S, 0);
    el.add(part((b) => {
      b.add(sphere(0.2 * S, 12, 10), J, { c: ironC });
      b.add(rbox(0.32 * S, 0.7 * S, 0.34 * S, 0.06 * S), BODY, { p: [0, -0.4 * S, 0], c: bodyC });
      // steam hammer head
      // a square head with square bands (a round head's glowing face read as a disc in a ring, and as a pair of discs)
      b.add(rbox(0.6 * S, 0.5 * S, 0.6 * S, 0.04 * S), 'wDark', { p: [0, -0.95 * S, 0], c: 0xffffff });
      for (const y of [-0.75, -1.15]) b.add(rbox(0.63 * S, 0.06 * S, 0.63 * S, 0.015 * S), TRIM, { p: [0, y * S, 0], c: trimC });
      b.add(cyl(0.08 * S, 0.08 * S, 0.4 * S, 10), 'wMetal', { p: [0, -0.62 * S, 0], c: 0xffffff });
      if (hero) {
        // forearm cuff, square cheek plates on the hammer, and a forge-hot striking face
        b.add(rbox(0.38 * S, 0.14 * S, 0.4 * S, 0.03 * S), J, { p: [0, -0.18 * S, 0], c: ironC });
        for (const s2 of [-1, 1]) b.add(rbox(0.06 * S, 0.36 * S, 0.4 * S, 0.02 * S), J, { p: [s2 * 0.36 * S, -0.95 * S, 0], c: ironC });
        b.add(box(0.5 * S, 0.03 * S, 0.5 * S), 'wGlowOrange', { p: [0, -1.21 * S, 0], c: 0xffffff });
      }
    }, 45));
    arms[sx < 0 ? 'R' : 'L'] = { sh, el };
  }
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = pivot(pelvis, sx * 0.45 * S, -0.1 * S, 0);
    hip.add(part((b) => {
      b.add(sphere(0.24 * S, 12, 10), J, { c: ironC }); b.add(rbox(0.34 * S, 0.7 * S, 0.38 * S, 0.06 * S), BODY, { p: [0, -0.38 * S, 0], c: bodyC });
      if (hero) { b.add(rbox(0.38 * S, 0.34 * S, 0.06 * S, 0.02 * S), J, { p: [0, -0.3 * S, 0.2 * S], c: ironC }); b.add(cyl(0.045 * S, 0.045 * S, 0.5 * S, 8), 'wMetal', { p: [sx * 0.2 * S, -0.36 * S, -0.06 * S], c: 0xffffff }); }
    }, 46));
    const knee = pivot(hip, 0, -0.75 * S, 0);
    knee.add(part((b) => {
      b.add(sphere(0.2 * S, 12, 10), J, { c: ironC });
      b.add(rbox(0.32 * S, 0.62 * S, 0.36 * S, 0.06 * S), BODY, { p: [0, -0.32 * S, 0], c: bodyC });
      b.add(rbox(0.5 * S, 0.14 * S, 0.7 * S, 0.05 * S), 'wDark', { p: [0, -0.65 * S, 0.1 * S], c: 0xffffff });
      b.add(cyl(0.05 * S, 0.05 * S, 0.5 * S, 8), 'wMetal', { p: [0, -0.32 * S, -0.2 * S], c: 0xffffff });
      if (hero) {
        b.add(rbox(0.36 * S, 0.22 * S, 0.08 * S, 0.02 * S), BODY, { p: [0, -0.04 * S, 0.2 * S], r: [-0.25, 0, 0], c: bodyC }); // knee guard
        b.add(rbox(0.36 * S, 0.3 * S, 0.05 * S, 0.02 * S), J, { p: [0, -0.36 * S, 0.19 * S], c: ironC }); // shin plate
        b.add(rbox(0.46 * S, 0.08 * S, 0.22 * S, 0.02 * S), J, { p: [0, -0.56 * S, 0.42 * S], r: [0.3, 0, 0], c: ironC }); // toe plate
      }
    }, 47));
    legs[sx > 0 ? 'L' : 'R'] = { hip, knee };
  }
  // back flywheel: a solid disc with an off-centre bolt plate, turning with the engine (bosses only)
  let fly = null;
  if (hero) {
    const fm = pivot(torso, 0, 0.7 * S, -0.9 * S); fm.rotation.y = PI / 2;
    fly = pivot(fm, 0, 0, 0);
    // one plain solid disc with a single off-centre bolt plate and nothing at its centre (the shared stepped flywheel, a
    // disc in a disc with a round hub, sat centred on the back over the lit rear slot and read as a single eye over a mouth)
    fly.add(part((b) => {
      const r = 0.42 * S, w = 0.1 * S, fc = variant === 3 ? '#5a5450' : '#8a8278';
      b.add(bdisc(r, w, Math.min(r * 0.1, w * 0.3), 28), 'wIron', { r: [0, 0, PI / 2], c: fc });
      for (const sx of [-1, 1]) b.add(rbox(w * 0.2, r * 0.36, r * 0.24, Math.min(r * 0.03, w * 0.08)), TRIM, { p: [sx * w * 0.62, r * 0.6, 0], c: trimC });
    }, 48));
  }
  const stacks = [];
  for (const [z, h] of [[-0.22, 1.0], [-0.62, 0.8]]) {
    const sm = smoke({ rate: 6, life: 3.2, size: 1.4, rise: 2.4, color: 0x4a4440, opacity: 0.55, spread: 0.5 });
    sm.position.set(0, (1.1 + h + 0.12) * S, z * S);
    torso.add(sm);
    stacks.push(sm);
  }
  const glow = slotGlow(0xff6a20, 0.9 * S, 0.58 * S, 0.7); // a flat panel over the louvred furnace door, not a round halo
  glow.position.set(0, 0.6 * S, 0.86 * S);
  torso.add(glow);
  // only the bosses carry a light, and not a light of their own: lights added and removed with mobs force every lit
  // material to rebuild its shader (a frame hitch). The marker asks the effects' fixed light pool for one while the boss
  // is near (EntityView.steadyLight, FX.steadyLight); userData.intensity carries the flicker.
  const light = new THREE.Object3D();
  if (variant === 0 || variant === 3) light.userData.steadyLight = { color: 0xff7a30, intensity: 6, dist: 12, decay: 1.6 };
  light.userData.intensity = 6;
  light.position.set(0, 0.6 * S, 1.3 * S);
  torso.add(light);
  const a = new MachineAnim(root, { pelvis, torso, head, arms, legs, gears, light, fly });
  a.dynamics.push(...stacks, glow);
  a.update = function (dt, speed) {
    this.t += dt;
    const p = this.p;
    p.light.userData.intensity = 5 + Math.sin(this.t * 9) * 0.8 + Math.sin(this.t * 23) * 0.4;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.6), e = 1 - Math.pow(1 - k, 3);
      p.pelvis.position.y = (1.5 - 1.0 * e) * S; p.torso.rotation.x = 0.5 * e; p.torso.rotation.z = 0.2 * e;
      p.legs.L.knee.rotation.x = 1.4 * e; p.legs.R.knee.rotation.x = 1.2 * e; p.legs.L.hip.rotation.x = -1 * e; p.legs.R.hip.rotation.x = -0.8 * e;
      p.light.userData.intensity *= 1 - e;
      for (const d of this.dynamics) d.userData.update(dt, this.t);
      return;
    }
    this.speed += (speed - this.speed) * Math.min(1, dt * 4);
    const sk = Math.min(1, this.speed / 2.4);
    this.phase = (this.phase + this.speed * dt * 0.22) % 1;
    const ph = this.phase * PI * 2;
    const swing = Math.sin(ph) * 0.42 * sk;
    p.legs.L.hip.rotation.x = -swing; p.legs.R.hip.rotation.x = swing;
    p.legs.L.knee.rotation.x = Math.max(0, Math.cos(ph)) * 0.7 * sk; p.legs.R.knee.rotation.x = Math.max(0, -Math.cos(ph)) * 0.7 * sk;
    p.pelvis.position.y = (1.5 - (1 - Math.abs(Math.sin(ph))) * 0.05 * sk) * S + Math.sin(this.t * 1.2) * 0.02;
    p.torso.rotation.z = Math.sin(ph) * 0.05 * sk;
    for (let i = 0; i < 2; i++) p.gears[i].rotation.x += (i ? 1 : -1) * (0.8 + this.speed) * dt;
    if (p.fly) p.fly.rotation.x += (1.2 + this.speed * 1.5) * dt;
    p.arms.R.sh.rotation.x = swing * 0.4 + Math.sin(this.t * 0.9) * 0.05; p.arms.L.sh.rotation.x = -swing * 0.4 + Math.sin(this.t * 0.8 + 1) * 0.05;
    p.arms.R.el.rotation.x = -0.35; p.arms.L.el.rotation.x = -0.35;
    p.arms.R.sh.rotation.z = -0.12; p.arms.L.sh.rotation.z = 0.12;
    const at = this.stepAttack(dt);
    if (at >= 0) {
      // double-hammer slam (special) or single swing
      const both = this.atkKind === 'slam';
      const up = at < 0.5 ? at / 0.5 : 1, down = at < 0.5 ? 0 : Math.min(1, (at - 0.5) / 0.1), rec = at > 0.72 ? (at - 0.72) / 0.28 : 0;
      const sw = (-2.4 * up + 2.9 * down) * (1 - rec);
      p.arms.R.sh.rotation.x = sw;
      if (both) p.arms.L.sh.rotation.x = sw;
      p.torso.rotation.x = (-0.18 * up + 0.35 * down) * (1 - rec);
      p.pelvis.position.y -= 0.18 * down * (1 - rec) * S;
    } else p.torso.rotation.x = Math.sin(this.t * 1.1) * 0.02;
    if (this.hitT > 0) { this.hitT -= dt * 3; p.torso.rotation.x -= this.hitT * 0.06; }
    for (const d of this.dynamics) d.userData.update(dt, this.t);
  };
  root.userData.height = 5.4 * S / 1.9;
  return finish(root, a);
}

export function buildDummy() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  body.add(part((b) => {
    b.add(cyl(0.34, 0.4, 0.3, 12), 'bark', { p: [0, 0.15, 0], uv: 'box', c: 0xffffff });
    b.add(cyl(0.07, 0.08, 1.9, 8), 'woodDark', { p: [0, 1.15, 0], c: 0xffffff });
    b.add(lumpy(sphere(0.36, 14, 10), 0.05, 3, 5), 'straw', { p: [0, 1.4, 0], s: [1, 1.55, 0.8], uv: 'box', c: 0xffffff });
    b.add(lumpy(sphere(0.21, 12, 9), 0.04, 3, 6), 'straw', { p: [0, 2.1, 0], uv: 'box', c: '#e8d090' });
    b.add(torus(0.28, 0.03, 6, 16), 'leather', { p: [0, 1.2, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.8, 1], c: '#6a4a2a' });
    b.add(torus(0.12, 0.025, 6, 14), 'leather', { p: [0, 1.95, 0], r: [Math.PI / 2, 0, 0], c: '#c8b890' });
    for (const sx of [-1, 1]) b.add(cyl(0.07, 0.06, 0.5, 8), 'straw', { p: [sx * 0.38, 1.55, 0], r: [0, 0, sx * 0.95], uv: 'box', c: '#d8c080' });
  }));
  const a = new MachineAnim(root, { body });
  a.update = function (dt) {
    this.t += dt; this.stepAttack(dt);
    if (this.hitT > 0) { this.hitT -= dt * 2.5; body.rotation.z = Math.sin(this.hitT * 16) * 0.14 * Math.max(0, this.hitT); body.rotation.x = Math.sin(this.hitT * 11) * 0.06 * Math.max(0, this.hitT); }
    else { body.rotation.z *= 0.9; body.rotation.x *= 0.9; }
  };
  root.userData.height = 2.3;
  return finish(root, a);
}

// ==========================================================================
// THE VAULT COLOSSUS — hero dressing over the copper-and-gold sentinel (variant 2). The sentinel builder is untouched:
// extra armour is merged per material onto its existing pivots, and one more flywheel turns beside the old one.
// Tiered pauldrons, a gold gorget and head fin, waist tassets, flank furnace vents and a framed tower shield.
// ==========================================================================
function dressColossus(root) {
  const a = root.userData.machine, p = a.p;
  const cu = wear('#f0d8b8', 0.26, 71), au = wear(0xffffff, 0.16, 72), cuDark = wear('#c8a888', 0.3, 73);
  p.torso.add(part((b) => {
    // breastplate over the chest, bolted along gold lips
    b.addBuilder(plate(0.8, 0.32, 0.06, { mat: 'wCopper', c: cu, c2: cuDark, trim: 'wGold', trimC: au, boltMat: 'wGold', boltC: au, seed: 74 }), { p: [0, 0.65, 0.36], r: [-0.08, 0, 0] });
    // the gorget: a gold collar rising behind the head
    b.add(rbox(0.66, 0.2, 0.22, 0.04), 'wGold', { p: [0, 0.98, -0.16], r: [-0.2, 0, 0], c: au });
    b.add(rbox(0.7, 0.06, 0.26, 0.02), 'wCopper', { p: [0, 1.09, -0.18], r: [-0.2, 0, 0], c: cuDark });
    // one furnace vent on each flank
    for (const sx of [-1, 1]) b.addBuilder(vent(0.34, 0.3, { frame: 'wGold', frameC: au, n: 3, depth: 0.06, seed: 75 }), { p: [sx * 0.445, 0.48, 0.02], r: [0, sx * PI / 2, 0] });
    // back armour: plates flanking the boiler and a gold band across the shoulders
    for (const sx of [-1, 1]) b.addBuilder(plate(0.2, 0.66, 0.05, { mat: 'wCopper', c: cu, inset: false, trim: 'wGold', trimC: au, boltMat: 'wGold', boltC: au, seed: 76 }), { p: [sx * 0.34, 0.48, -0.33], r: [0, PI, 0] });
    b.add(rbox(0.9, 0.08, 0.1, 0.02), 'wGold', { p: [0, 0.84, -0.3], c: au });
    // waist tassets: three plates hanging off the belt
    for (const x of [-0.25, 0, 0.25]) {
      b.add(rbox(0.21, 0.24, 0.05, 0.02), 'wCopper', { p: [x, -0.1, 0.33], r: [0.18, 0, 0], c: cu });
      b.add(rbox(0.22, 0.04, 0.06, 0.01), 'wGold', { p: [x, 0.01, 0.35], r: [0.18, 0, 0], c: au });
    }
    for (const sx of [-1, 1]) b.add(rbox(0.05, 0.24, 0.4, 0.02), 'wCopper', { p: [sx * 0.39, -0.08, 0], r: [0, 0, sx * 0.15], c: cu });
  }, 77));
  p.head.add(part((b) => {
    // cheek plates and a low fin along the crown (a ridge, never a ring)
    for (const sx of [-1, 1]) b.add(rbox(0.04, 0.2, 0.34, 0.015), 'wGold', { p: [sx * 0.215, 0.12, 0.01], c: au });
    b.add(rbox(0.06, 0.08, 0.42, 0.02), 'wGold', { p: [0, 0.33, -0.02], c: au });
  }, 78));
  for (const k of ['L', 'R']) {
    const sx = k === 'L' ? 1 : -1, A = p.arms[k];
    // tiered pauldron: three plates stepping down off the shoulder, bolts along the top tier
    A.sh.add(part((b) => {
      b.add(rbox(0.52, 0.09, 0.6, 0.03), 'wCopper', { p: [sx * 0.05, 0.27, 0], r: [0, 0, -sx * 0.22], c: cu });
      b.add(rbox(0.44, 0.07, 0.56, 0.025), 'wGold', { p: [sx * 0.2, 0.15, 0], r: [0, 0, -sx * 0.6], c: au });
      b.add(rbox(0.32, 0.06, 0.5, 0.02), 'wCopper', { p: [sx * 0.3, 0.0, 0], r: [0, 0, -sx * 1.0], c: cuDark });
      for (let i = 0; i < 4; i++) b.add(cyl(0.017, 0.017, 0.03, 6), 'wGold', { p: [sx * 0.07, 0.33, -0.21 + i * 0.14], r: [0, 0, -sx * 0.22], c: au });
      b.add(rbox(0.22, 0.3, 0.05, 0.02), 'wCopper', { p: [0, -0.3, 0.12], c: cu });
    }, 79));
    A.el.add(part((b) => {
      b.add(rbox(0.25, 0.28, 0.05, 0.02), 'wCopper', { p: [0, -0.3, 0.125], c: cu });
      if (sx < 0) {
        // the hammer fist gets a gold knuckle band
        b.add(rbox(0.42, 0.07, 0.46, 0.02), 'wGold', { p: [0, -0.46, 0], c: au });
      } else {
        // the tower shield gets a gold frame round its edge (no upright bar, so never a cross)
        b.add(rbox(0.04, 0.05, 0.62, 0.015), 'wGold', { p: [0.2, -0.04, 0.05], c: au });
        b.add(rbox(0.04, 0.05, 0.62, 0.015), 'wGold', { p: [0.2, -0.8, 0.05], c: au });
        for (const z of [-0.26, 0.36]) b.add(rbox(0.04, 0.8, 0.05, 0.015), 'wGold', { p: [0.2, -0.42, z], c: au });
      }
    }, 80));
  }
  for (const k of ['L', 'R']) {
    const sx = k === 'L' ? 1 : -1, L = p.legs[k];
    L.hip.add(part((b) => {
      b.add(rbox(0.24, 0.3, 0.05, 0.02), 'wCopper', { p: [0, -0.32, 0.13], c: cu });
      b.add(rbox(0.05, 0.26, 0.3, 0.02), 'wCopper', { p: [sx * 0.13, -0.1, 0], c: cuDark });
    }, 81));
    L.knee.add(part((b) => {
      b.add(rbox(0.28, 0.2, 0.09, 0.03), 'wCopper', { p: [0, -0.03, 0.15], r: [-0.25, 0, 0], c: cu });
      b.add(rbox(0.24, 0.3, 0.05, 0.02), 'wCopper', { p: [0, -0.33, 0.13], c: cuDark });
      b.add(rbox(0.36, 0.05, 0.2, 0.02), 'wCopper', { p: [0, -0.5, 0.3], r: [0.3, 0, 0], c: cu });
    }, 82));
  }
  // a second back flywheel beside the first, turning the other way
  const fly2 = pivot(p.torso, 0.3, 0.74, -0.44);
  fly2.add(part((b) => {
    b.add(rbox(0.08, 0.1, 0.12, 0.02), 'wCopper', { p: [0, 0, 0.08], c: cuDark });
    b.add(bdisc(0.11, 0.04, 0.01, 18), 'wCopper', { r: [PI / 2, 0, 0], c: cuDark });
    b.add(rbox(0.04, 0.05, 0.02, 0.006), 'wCopper', { p: [0, 0.065, -0.025], c: au });
  }, 83));
  const up = a.update;
  a.update = function (dt, speed) { up.call(this, dt, speed); if (!this.dead) fly2.rotation.z -= (1.5 + this.speed * 2.5) * dt * (this.stun ? 0.15 : 1); };
  return root;
}

// the crawler model's paint by mob (tripoModels.js tint): salt-bleached skimmers, sooty tunnel crawlers, sea-green tide-crawlers
const CRAWLER_TINT = { skimmer: { c: '#f4efe6', k: 0.95, b: 2.5 }, shaftcrawler: { c: '#8a7c6c', k: 0.4, b: 0.75 }, tidecrawler: { c: '#7fb8a8', k: 0.75, b: 1.0 } };
export function buildMachine(model, variant = 0, mob = null) {
  // Part Fifteen, the Russet Weald (the rares dress their model: the Damp-Bound Stacker's damp and sodden block, the Leaning Feller's cant and last butt)
  if (model === 'barkstripper') return buildBarkStripper(variant); if (model === 'stumpgrinder') return buildStumpGrinder(variant); if (model === 'logforwarder') return buildLogForwarder(variant); if (model === 'stackcrane') return buildStackCrane(variant, mob === 'dampstacker'); if (model === 'feller') return buildFeller(variant, mob === 'leaningfeller'); if (model === 'ridewarden') return buildRideWarden(variant); if (model === 'greatforwarder') return buildGreatForwarder(); if (model === 'fallenstandard') return buildFallenStandard();
  // Part Fourteen, the Rainward Gorge (the rares dress their model: the Mired Puller's mud and last stump, the Moss-Grown Cutter's moss)
  if (model === 'stumppuller') return buildStumpPuller(variant, mob === 'miredpuller'); if (model === 'terracecutter') return buildTerraceCutter(variant, mob === 'mossgrowncutter'); if (model === 'drainborer') return buildDrainBorer(variant); if (model === 'seeddrill') return buildSeedDrill(variant); if (model === 'slopewarden') return buildSlopeWarden(variant); if (model === 'hillleveller') return buildHillLeveller();
  // the Upper Cutting (Part Fourteen raid): the Stump Puller Prime, the Spoil Conveyor, the Bed Ram and the Terrace Engine
  if (model === 'stumpprime') return buildStumpPrime(); if (model === 'spoilconveyor') return buildSpoilConveyor(); if (model === 'bedram') return buildBedRam(); if (model === 'terraceengine') return buildTerraceEngine();
  // Part Thirteen, Tidewater Sound (the rares dress their model: the Snagged Haulier's dragged log, the Mudbound Saw's silt)
  if (model === 'loghaulier') return buildLogHaulier(variant, mob === 'snaggedhaulier'); if (model === 'sawcarriage') return buildSawCarriage(variant, mob === 'mudboundsaw'); if (model === 'ropelayer') return buildRopeLayer(variant); if (model === 'siltdredge') return buildSiltDredge(variant); if (model === 'tidewarden') return buildTideWarden(variant); if (model === 'greatdredge') return buildGreatDredge();
  // Part Twelve, the Windward Heights
  if (model === 'iceplough') return buildIcePlough(variant); if (model === 'galewalker') return buildGaleWalker(variant); if (model === 'rimesweeper') return buildRimeSweeper(variant); if (model === 'towerwarden') return buildTowerWarden(variant); if (model === 'stormplough') return buildStormplough();
  // the Makers' Rest (Part Twelve raid): the Shop Crane, the Board Plane, the Great Lathe and the Great Governor
  if (model === 'shopcrane') return buildShopCrane(); if (model === 'boardplane') return buildBoardPlane(); if (model === 'greatlathe') return buildGreatLathe(); if (model === 'greatgovernor') return buildGreatGovernor();
  // the Pump Works (Part Twelve dungeon): the Rod Engine, the Cistern Warden and the Great Pump
  // the Sea Gate (Part Thirteen raid): the Gate Winch, the Silt Ram, the Sluice Carriage and the Tide Engine
  if (model === 'gatewinch') return buildGateWinch(); if (model === 'siltram') return buildSiltRam(); if (model === 'sluicecarriage') return buildSluiceCarriage(); if (model === 'tideengine') return buildTideEngine();
  // the Mill Races (Part Thirteen dungeon): the Log Carriage, the Frame Saw and the Great Undershot
  // the Drain Adits (Part Fourteen dungeon): the Spoil Tipper, the Sump Ram and the Adit Driver
  if (model === 'spoiltipper') return buildSpoilTipper(); if (model === 'sumpram') return buildSumpRam(); if (model === 'aditdriver') return buildAditDriver();
  if (model === 'stackturner') return buildStackTurner(); if (model === 'louvrejack') return buildLouvreJack(); if (model === 'louvreengine') return buildLouvreEngine();
  if (model === 'logcarriage') return buildLogCarriage(); if (model === 'framesaw') return buildFrameSaw(); if (model === 'greatundershot') return buildGreatUndershot();
  if (model === 'rodengine') return buildRodEngine(); if (model === 'cisternwarden') return buildCisternWarden(); if (model === 'greatpump') return buildGreatPump();
  // Part Eleven, the Rime Steps
  if (model === 'wheelhammer') return buildWheelHammer(variant); if (model === 'flumewalker') return buildFlumeWalker(variant); if (model === 'sluicekeeper') return buildSluiceKeeper(variant); if (model === 'damsentry') return buildDamSentry(variant); if (model === 'spillwayengine') return buildSpillwayEngine();
  // Part Ten, the Cinder Reach
  if (model === 'ashsentinel') return buildAshSentinel(variant); if (model === 'slaghauler') return buildSlagHauler(variant); if (model === 'orecrawler') return buildOreCrawler(variant); if (model === 'furnacekeeper') return buildFurnaceKeeper(variant); if (model === 'ashwright') return buildAshwright();
  // the Ore Galleries (Part Ten dungeon): a slag-hauling engine, a drill engine, and the Great Sorter
  if (model === 'skipengine') return scaled(buildSlagHauler(0), 2.0); if (model === 'gallerybore') return scaled(buildOreCrawler(0), 2.3); if (model === 'greatsorter') return buildGreatSorter();
  // the Sluice Galleries (Part Eleven dungeon): the Gate Winder, the Turbine Heart and the Floodgate
  if (model === 'gatewinder') return buildGateWinder(); if (model === 'turbineheart') return buildTurbineHeart(); if (model === 'floodgate') return buildFloodgate();
  // the Great Dam (Part Eleven raid): the Penstock Engine, the Ice Breaker, the Governor and the Great Dam's Heart
  if (model === 'penstockengine') return buildPenstockEngine(); if (model === 'icebreaker') return buildIceBreaker(); if (model === 'governor') return buildGovernor(); if (model === 'damheart') return buildDamHeart();
  // the Makers' First Furnace (Part Ten raid): the Bellows Engine, the Crucible Crane, the Pattern Caster and the First Furnace
  if (model === 'bellowsengine') return buildBellowsEngine(); if (model === 'cruciblecrane') return buildCrucibleCrane(); if (model === 'patterncaster') return buildPatternCaster(); if (model === 'firstfurnace') return buildFirstFurnace();
  // the Makers' automata of the Deepway
  if (model === 'sweeper') return buildSweeper();
  if (model === 'oldbrush') return scaled(buildSweeper(), 1.8);
  if (model === 'bwarden') return buildMakerWarden(0);
  if (model === 'hallkeeper') return scaled(buildMakerWarden(1), 1.35);
  if (model === 'cweight') return buildCounterweight(0);
  if (model === 'plumbweight') return scaled(buildCounterweight(0), 1.45);
  if (model === 'firstengine') return scaled(buildCounterweight(1), 2.3);
  if (model === 'hallwarden') return scaled(buildMakerWarden(0), 1.3);
  if (model === 'copyengine') return scaled(buildSentinel(0), 1.5); // Part Nine: a crude brass copy built from the stolen drawing
  if (model === 'draughtsman') return scaled(buildMakerWarden(1), 2.4);
  if (model === 'masterpattern') return scaled(buildCounterweight(1), 3.0);
  if (model === 'leviathan') return scaled(buildDuneDredge(1), 1.35);
  if (model === 'dummy') return buildDummy();
  if (model === 'buried') return scaled(buildForeman(4), 1.7);
  if (model === 'wforge') return buildWanderingForge();
  if (model === 'dredge') return buildDuneDredge();
  if (model === 'arcroller') return buildArcRoller();
  if (model === 'pylon') return buildCoilPylon();
  if (model === 'stormengine') return scaled(buildStormengine(), 1.15);
  if (model === 'thunderhead') return scaled(buildStormengine(1), 1.45);
  if (model === 'furnacestrider') return scaled(buildStormengine(1), 1.9);
  if (model === 'furnaceengine') return scaled(buildStormengine(1), 2.4);
  if (model === 'scraptitan') return scaled(buildMachine('colossus'), 1.7);
  if (model === 'unfinished') return scaled(buildForeman(1), 2.3);
  if (model === 'assembler') return scaled(buildSentinel(1), 2.6);
  if (model === 'glasscolossus') return scaled(buildSentinel(5), 2.0);
  if (model === 'capwarden') return scaled(buildCoilPylon(), 2.1);
  if (model === 'sparkplug') return scaled(buildArcRoller(), 1.7);
  if (model === 'tallyman') return scaled(buildSentinel(3), 1.6);
  if (model === 'weighbridge') return scaled(buildDriller(2), 1.75);
  if (model === 'launchengine') return scaled(buildDriller(2), 2.7);
  if (model === 'appraiser') return scaled(buildSentinel(3), 2.35);
  if (model === 'exchequer') return scaled(buildSentinel(4), 2.8);
  if (model === 'tidecrawler') return scaled(buildCrawler(CRAWLER_TINT.tidecrawler), 1.3);
  if (model === 'tidewright') return scaled(buildSentinel(2), 1.7);
  if (model === 'gearling') return buildGearling(variant);
  if (model === 'crawler') return buildCrawler(CRAWLER_TINT[mob] || null);
  if (model === 'sentinel') return buildSentinel(variant);
  if (model === 'foreman') return buildForeman(0);
  if (model === 'furnace') return buildForeman(1);
  if (model === 'overseer') return buildForeman(2);
  if (model === 'forgemaster') return buildForeman(3);
  if (model === 'driller') return buildDriller(variant);
  if (model === 'borer') return scaled(buildDriller(0), 1.55);
  if (model === 'crusher') return buildCrusher(0);
  if (model === 'grandbore') return buildCrusher(1);
  if (model === 'keeper') return scaled(buildSentinel(2), 1.45);
  if (model === 'colossus') return scaled(dressColossus(buildSentinel(2)), 2.3);
  if (model === 'rattletrap') return scaled(buildGearling(1), 1.7);
  if (model === 'clatterhook') return scaled(buildTiller(1), 1.9);
  if (model === 'sandsplitter') return scaled(buildStrider(), 1.5);
  if (model === 'ironbark') return scaled(buildSawyer(), 1.55);
  if (model === 'thresher') return scaled(buildTiller(2), 2.4);
  if (model === 'tiller') return buildTiller(0);
  if (model === 'harvester') return scaled(buildTiller(1), 1.45);
  if (model === 'nwarden') return scaled(buildSentinel(1), 1.5);
  if (model === 'strider') return buildStrider();
  if (model === 'sawyer') return buildSawyer();
  return buildGearling(0);
}
function scaled(root, k) {
  root.scale.setScalar(k);
  root.userData.height = (root.userData.height || 2) * k;
  return root;
}
