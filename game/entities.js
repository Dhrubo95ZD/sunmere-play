// Entity views: players, mobs and NPCs built from the asset builders, interpolated from snapshots,
// animated (skills, attacks, hits, deaths) and decorated (quest markers, loot sparkle, target ring).
import * as THREE from 'three';
import { buildCharacter, setCharWeapon, setCharArmor, setCharCape, setCharGear, HOLSTER, holsterAt, setPistolsHolstered } from '../assets/characters.js';
import { buildMachine } from '../assets/creatures.js';
import { disposeCharGeometry } from '../assets/rig.js';
import { mergeCharacter, mergeOn, lightWalk, unfreeze, playerMergeTick, unmergeCharacter, lookChange } from '../assets/charMerge.js';
import { glowSprite } from '../assets/dynamic.js';
import { Animator, compileClip } from './anim.js';
import { CHOREO } from './choreo.js';
import { MOBS, QUALITY, PRISMATIC_STOPS } from '/sunmere-play/shared/data.js';
import { QUALITY as GFX } from '../engine/globals.js';
import { updateBowString } from './fx.js';
import { dsUpdate, dsAttack } from '../assets/dragonslayer.js';
import { heatTick, heatHit, heatAttack } from '../assets/heat.js';
import { dsaLod, dsaDispose } from '../assets/dsArmour.js';
import { buildRunabout } from '../assets/runabout.js';
import { buildCrawler } from '../assets/crawler.js';
import { PETS } from '/sunmere-play/shared/data.js';
import { CLASSES } from '/sunmere-play/shared/classes.js';
import { skillOf } from '/sunmere-play/shared/fusions.js'; // (S2: the new kit and fusions by id; legacy skills otherwise)
const SKILL_BY_ID = new Proxy({}, { get: (_, id) => skillOf(id) });
import { tierInfo } from '/sunmere-play/shared/feel.js';
import { heroOn } from '../assets/hero/heroBody.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _before = new THREE.Vector3(), _hp = new THREE.Vector3(), _lw = new THREE.Vector3();

// ---- view LOD (distance from the local player, re-evaluated at 4 Hz; on-screen tested every frame)
// Within FULL_D every view animates every frame with foot IK and cloth. Out to NEAR_D: 30 Hz (on screen) with no foot
// IK or cloth chains. Beyond: 15 Hz on screen, 5 Hz off screen, pose only. Past cullD (110 m, more for tall machines)
// the view leaves the scene graph altogether (hiding alone would not stop three's matrix walk) and snaps to its
// latest position when it comes back. The local player, a character in hit-stop and anyone mid-skill near you are
// always full rate. Root motion stays smooth every frame at every tier.
export const VIEW_LOD = { FULL_D: 30, NEAR_D: 60, CULL_D: 110, HYST: 4, NEAR_HZ: 30, MID_HZ: 15, OFF_HZ: 5, OFF_NEAR_HZ: 10, FADE: 0.4 }; // FADE: s to grow in / shrink out at the cull edge
// (v114, the phone presets: full detail to 24 m, then 20 Hz, past 60 m 12 Hz)
export const VIEW_LOD_MOB = { ...VIEW_LOD, FULL_D: 24, NEAR_HZ: 20, MID_HZ: 12 };
// (combat_design 7.1, the new hero body on desktop: its retarget pass costs more per update than the old body) full rate
// within 20 m, half rate (30 Hz) to 40 m, a quarter (15 Hz) beyond; the old body keeps VIEW_LOD
export const VIEW_LOD_HERO = { ...VIEW_LOD, FULL_D: 20, NEAR_D: 40 };
// characters cast sun shadows within this many metres of you (the player always does); QUALITY.charShadowDist overrides
export const charShadowDist = () => GFX.charShadowDist ?? (GFX.mobile ? 20 : 45);
const _frustum = new THREE.Frustum(), _pv = new THREE.Matrix4(), _sph = new THREE.Sphere();
// the scene walk's pass over a character skips the rig when the view's animator refreshed it this frame (or when
// nothing about it moved): see EntityView.update and Animator.update
const OBJ_UMW = THREE.Object3D.prototype.updateMatrixWorld;
function charUpdateMatrixWorld(force) {
  if (this.mwSkip) { this.mwSkip = false; this.mwLight = false; unfreeze(this); return; }
  if (this.mwLight) { this.mwLight = false; if (lightWalk(this)) return; } // (v114: charMerge.js)
  unfreeze(this);
  OBJ_UMW.call(this, force);
}
const _leanQ = new THREE.Quaternion(), _leanAx = new THREE.Vector3(); // hit knockback lean
const HOLSTER_AFTER = 3500; // ms after the last skill (out of combat) the Deadeye holsters the pistols (holsterSync)
const HITSTOP_SCALE = 0.06; // how slow a character in hit-stop runs (only the attacker and the target, see FX.hitstop)
// skills whose choreography lands with a hit-stop or a big shake count as heavy hits (staggers)
const HEAVY = new Set(Object.entries(CHOREO).filter(([, c]) => (c.events || []).some((e) => e.stop || e.e === 'hitstop' || (e.e === 'impact' && (e.shake || 0) >= 0.4))).map(([id]) => id));

// generic raider attacks (two daggers / axe)
const RAIDER_ATK = compileClip({ dur: 0.7, mask: 'upper', keys: [
  { t: 0, p: { spine: [10, 0, 0], armR: [-36, 0, -22], foreR: [-70, 0, 0], handR: [-40, 0, 0], armL: [-36, 0, 22], foreL: [-70, 0, 0] } },
  { t: 0.35, p: { spine: [-6, -30, 0], armR: [-150, -20, -30], foreR: [-60, 0, 0], handR: [-20, 0, 0], armL: [-20, 0, 40] } },
  { t: 0.5, p: { spine: [22, 28, 0], armR: [-60, 30, 10], foreR: [-10, 0, 0], handR: [30, 0, 0], armL: [-60, 0, 30], foreL: [-90, 0, 0] }, e: 'snap' },
  { t: 1, p: { spine: [10, 0, 0], armR: [-36, 0, -22], foreR: [-70, 0, 0], handR: [-40, 0, 0], armL: [-36, 0, 22], foreL: [-70, 0, 0] } },
] });
const RAIDER_SHOOT = compileClip({ dur: 0.9, mask: 'upper', keys: [
  { t: 0, p: { spine: [6, 0, 0] } },
  { t: 0.4, p: { spine: [4, -50, 0], head: [0, 50, 0], armL: [0, -15, 86], handL: [0, 90, 0], armR: [0, 0, -88], foreR: [-150, 0, 0] } },
  { t: 0.56, p: { spine: [4, -55, 0], head: [0, 52, 0], armL: [0, -15, 88], handL: [0, 90, 0], armR: [0, 16, -112], foreR: [-58, 0, 0] }, e: 'snap' },
  { t: 1, p: { spine: [6, 0, 0] } },
] });
const EAT = compileClip({ dur: 2.0, mask: 'full', keys: [
  { t: 0, p: { hips: [0, 0, 0], thighL: [-90, 0, 10], shinL: [130], thighR: [-90, 0, -10], shinR: [130], spine: [20, 0, 0], armL: [-60, 20, 10], foreL: [-110, 0, 0] }, root: [0, -0.62, 0] },
  { t: 0.5, p: { armL: [-80, 20, 10], foreL: [-130, 0, 0], head: [10, 0, 0] }, root: [0, -0.62, 0] },
  { t: 1, p: { armL: [-60, 20, 10], foreL: [-110, 0, 0], head: [0, 0, 0] }, root: [0, -0.62, 0] },
], loop: true });

// emotes: upper-body gestures (legs keep standing), sit is a full pose held while sitting
const UP = (dur, keys) => compileClip({ dur, mask: 'upper', keys });
const REST_R = { armR: [-8, 0, -14], foreR: [-20, 0, 0] }, REST_L = { armL: [-8, 0, 14], foreL: [-20, 0, 0] };
const EMOTE_CLIPS = {
  wave: UP(2.2, [
    { t: 0, p: { ...REST_R, head: [0, 0, 0] } },
    { t: 0.14, p: { armR: [-24, 0, -138], foreR: [-50, 0, 0], head: [-4, -8, 0] } },
    { t: 0.28, p: { armR: [-24, 0, -162], foreR: [-28, 0, 0] } },
    { t: 0.42, p: { armR: [-24, 0, -136], foreR: [-52, 0, 0] } },
    { t: 0.56, p: { armR: [-24, 0, -162], foreR: [-28, 0, 0] } },
    { t: 0.7, p: { armR: [-24, 0, -138], foreR: [-50, 0, 0], head: [-4, -8, 0] } },
    { t: 1, p: { ...REST_R, head: [0, 0, 0] } },
  ]),
  cheer: compileClip({ dur: 1.9, mask: 'full', keys: [
    { t: 0, p: { ...REST_R, ...REST_L, head: [0, 0, 0] } },
    { t: 0.18, p: { armR: [-168, 0, -24], foreR: [-20, 0, 0], armL: [-168, 0, 24], foreL: [-20, 0, 0], head: [-18, 0, 0] }, root: [0, 0.14, 0] },
    { t: 0.36, p: { armR: [-150, 0, -34], armL: [-150, 0, 34] }, root: [0, 0, 0] },
    { t: 0.54, p: { armR: [-170, 0, -20], armL: [-170, 0, 20], head: [-18, 0, 0] }, root: [0, 0.14, 0] },
    { t: 0.72, p: { armR: [-150, 0, -34], armL: [-150, 0, 34] }, root: [0, 0, 0] },
    { t: 1, p: { ...REST_R, ...REST_L, head: [0, 0, 0] }, root: [0, 0, 0] },
  ] }),
  point: UP(1.8, [
    { t: 0, p: { ...REST_R, head: [0, 0, 0] } },
    { t: 0.2, p: { armR: [-86, 4, -10], foreR: [-4, 0, 0], handR: [0, 0, 0], head: [-6, 0, 0], spine: [4, -8, 0] } },
    { t: 0.8, p: { armR: [-88, 4, -10], foreR: [-4, 0, 0], head: [-6, 0, 0], spine: [4, -8, 0] } },
    { t: 1, p: { ...REST_R, head: [0, 0, 0], spine: [0, 0, 0] } },
  ]),
  salute: UP(1.9, [
    { t: 0, p: { ...REST_R, head: [0, 0, 0] } },
    { t: 0.22, p: { armR: [-104, -34, -64], foreR: [-128, 0, 0], handR: [0, 0, 0], head: [-6, 0, 0], spine: [-4, 0, 0] } },
    { t: 0.75, p: { armR: [-104, -34, -64], foreR: [-130, 0, 0], head: [-6, 0, 0], spine: [-4, 0, 0] } },
    { t: 1, p: { ...REST_R, head: [0, 0, 0], spine: [0, 0, 0] } },
  ]),
  clap: UP(2.0, [
    { t: 0, p: { ...REST_R, ...REST_L } },
    ...[0.12, 0.27, 0.42, 0.57, 0.72].flatMap((t) => [
      { t, p: { armR: [-62, 0, -34], foreR: [-66, 0, 0], armL: [-62, 0, 34], foreL: [-66, 0, 0], head: [-4, 0, 0] } },
      { t: t + 0.075, p: { armR: [-62, 0, -6], foreR: [-72, 0, 0], armL: [-62, 0, 6], foreL: [-72, 0, 0], head: [-4, 0, 0] } },
    ]),
    { t: 1, p: { ...REST_R, ...REST_L, head: [0, 0, 0] } },
  ]),
  laugh: UP(1.9, [
    { t: 0, p: { ...REST_R, ...REST_L, spine: [0, 0, 0], head: [0, 0, 0] } },
    { t: 0.15, p: { spine: [-12, 0, 0], head: [-22, 0, 0], armR: [-30, 0, -16], foreR: [-80, 0, 0], armL: [-30, 0, 16], foreL: [-80, 0, 0] } },
    { t: 0.32, p: { spine: [16, 0, 0], head: [8, 0, 0] } },
    { t: 0.48, p: { spine: [-10, 0, 0], head: [-18, 0, 0] } },
    { t: 0.64, p: { spine: [14, 0, 0], head: [6, 0, 0] } },
    { t: 0.8, p: { spine: [-6, 0, 0], head: [-10, 0, 0] } },
    { t: 1, p: { ...REST_R, ...REST_L, spine: [0, 0, 0], head: [0, 0, 0] } },
  ]),
  shrug: UP(1.5, [
    { t: 0, p: { ...REST_R, ...REST_L, head: [0, 0, 0] } },
    { t: 0.3, p: { armR: [-26, 30, -34], foreR: [-84, 0, 0], armL: [-26, -30, 34], foreL: [-84, 0, 0], head: [0, 0, 14], spine: [-4, 0, 0] } },
    { t: 0.7, p: { armR: [-26, 30, -34], foreR: [-84, 0, 0], armL: [-26, -30, 34], foreL: [-84, 0, 0], head: [0, 0, 14], spine: [-4, 0, 0] } },
    { t: 1, p: { ...REST_R, ...REST_L, head: [0, 0, 0], spine: [0, 0, 0] } },
  ]),
  nod: UP(1.2, [
    { t: 0, p: { head: [0, 0, 0] } }, { t: 0.2, p: { head: [20, 0, 0] } }, { t: 0.4, p: { head: [-4, 0, 0] } },
    { t: 0.6, p: { head: [20, 0, 0] } }, { t: 0.8, p: { head: [-2, 0, 0] } }, { t: 1, p: { head: [0, 0, 0] } },
  ]),
};
const SIT = compileClip({ dur: 3.0, mask: 'full', loop: true, keys: [
  { t: 0, p: { hips: [0, 0, 0], thighL: [-90, 0, 14], shinL: [128], thighR: [-90, 0, -14], shinR: [128], spine: [8, 0, 0], armL: [-34, 0, 14], foreL: [-60, 0, 0], armR: [-34, 0, -14], foreR: [-60, 0, 0], head: [0, 0, 0] }, root: [0, -0.62, 0] },
  { t: 0.5, p: { spine: [10, 0, 0], head: [4, 8, 0] }, root: [0, -0.62, 0] },
  { t: 1, p: { spine: [8, 0, 0], head: [0, 0, 0] }, root: [0, -0.62, 0] },
] });

// holding a salvage line out over the water
const SALV_POSE = { armR: [-58, 0, -12], foreR: [-30, 0, 0], handR: [-10, 0, 0], armL: [-30, 0, 16], foreL: [-60, 0, 0], spine: [8, 0, 0], head: [12, 0, 0] };
const SALV = compileClip({ dur: 2.4, mask: 'upper', loop: true, keys: [
  { t: 0, p: SALV_POSE }, { t: 0.5, p: { ...SALV_POSE, armR: [-62, 0, -12], head: [14, 0, 0] } }, { t: 1, p: SALV_POSE },
] });

// seated in the runabout's well, leaning in over the tiller with both hands on the yoke; feet on the footplate with the
// knees up above the rail. Steering lean, speed crouch, the stop settle and the idle hand-off are layered on per frame
// in rideBones().
const RIDE_POSE = { hips: [0, 0, 0], thighL: [-92, 0, 8], shinL: [74], footL: [16, 0, 0], thighR: [-92, 0, -8], shinR: [74], footR: [16, 0, 0], spine: [16, 0, 0], chest: [2, 0, 0], head: [-20, 0, 0], armL: [-46, 0, 9], foreL: [-56, 0, 0], handL: [-10, 0, 0], armR: [-46, 0, -9], foreR: [-56, 0, 0], handR: [-10, 0, 0] };
const RIDE = compileClip({ dur: 2.4, mask: 'full', loop: true, keys: [
  { t: 0, p: RIDE_POSE, root: [0, -0.5, -0.04] },
  { t: 0.5, p: { ...RIDE_POSE, spine: [17.5, 0, 0], head: [-21, 3, 0] }, root: [0, -0.5, -0.04] },
  { t: 1, p: RIDE_POSE, root: [0, -0.5, -0.04] },
] });
const RIDE_IDLE_ARM = [-0.3, 0.1, -0.16], RIDE_IDLE_FORE = [-0.55, 0, 0]; // right hand off the tiller, resting on the knee

function questMarker(text, color) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  x.font = 'bold 110px Cinzel, Georgia, serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 10; x.strokeStyle = '#2a1a06'; x.strokeText(text, 32, 66);
  const g = x.createLinearGradient(0, 10, 0, 120); g.addColorStop(0, '#fff2a0'); g.addColorStop(1, color);
  x.fillStyle = g; x.fillText(text, 32, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(0.75, 1.5, 1);
  s.renderOrder = 30;
  return s;
}

// the Main Story's marker: a crimson crest with a gold ! or ?, so the story stands out from side quests
function storyMarker(text, dim) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 160;
  const x = c.getContext('2d');
  const crest = () => { x.beginPath(); x.moveTo(12, 10); x.lineTo(116, 10); x.lineTo(116, 72); x.quadraticCurveTo(113, 122, 64, 152); x.quadraticCurveTo(15, 122, 12, 72); x.closePath(); };
  crest(); x.fillStyle = '#2a0c06'; x.fill();
  x.save(); x.translate(64, 80); x.scale(0.84, 0.84); x.translate(-64, -80); crest();
  const g = x.createLinearGradient(0, 10, 0, 152);
  if (dim) { g.addColorStop(0, '#8a8478'); g.addColorStop(1, '#4a4640'); } else { g.addColorStop(0, '#e2552a'); g.addColorStop(1, '#7a1408'); }
  x.fillStyle = g; x.fill(); x.lineWidth = 9; x.strokeStyle = dim ? '#c8c0b0' : '#f2c450'; x.stroke(); x.restore();
  x.font = 'bold 90px Cinzel, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 9; x.strokeStyle = '#2a0c06'; x.strokeText(text, 64, 78);
  const t2 = x.createLinearGradient(0, 34, 0, 118); t2.addColorStop(0, dim ? '#f4f0e8' : '#fff6c4'); t2.addColorStop(1, dim ? '#b8b0a0' : '#f0b020');
  x.fillStyle = t2; x.fillText(text, 64, 78);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.15, 1.44, 1);
  s.renderOrder = 30;
  return s;
}

export class EntityView {
  constructor(mgr, data) {
    this.mgr = mgr;
    this.bornAt = performance.now();
    this.id = data.id;
    this.ty = data.ty;
    this.data = data;
    this.pos = V(data.x, data.y, data.z);
    this.target = this.pos.clone();
    this.ry = data.r || 0;
    this.ryTarget = this.ry;
    this.speed = 0;
    this.prevRy = this.ry;
    this.dead = !!data.d;
    this.root = new THREE.Group();
    this.root.position.copy(this.pos);
    this.ctx = null;
    this.radius = 0.5;
    if (data.ty === 'p' || data.ty === 'n') {
      const kind = data.ty === 'p' ? data.c : data.look;
      this.char = buildCharacter(kind, data.v || 0);
      // v114: NPCs never change their look: one draw each (charMerge.js); players keep their per-kind meshes (gear swaps)
      if (data.ty === 'n' && mergeOn()) mergeCharacter(this.char, { share: true, shareKey: kind + ':' + (data.v || 0) });
      // v115: players too, once their look has settled, and taken apart again whenever it changes (charMerge.js lookChange)
      if (data.ty === 'p' && kind !== 'deadeye') { this.char.userData.mergePlayer = true; this.char.userData.remergeAt = performance.now() + 600; }
      this.anim = new Animator(this.char, kind);
      this.cls = kind;
      this.height = 2.0;
    } else {
      const def = MOBS[data.k];
      this.def = def;
      this.radius = def.radius;
      if (def.humanoid) {
        this.char = buildCharacter('raider', def.variant || 0);
        if (mergeOn()) mergeCharacter(this.char, { shareKey: 'raider:' + (def.variant || 0) }); // own material: the hit flash
        if (def.elite) this.char.scale.setScalar(1.18);
        this.anim = new Animator(this.char, 'raider');
        this.cls = 'raider';
        this.height = def.elite ? 2.4 : 2.0;
      } else {
        this.char = buildMachine(def.model, def.variant || 0, data.k);
        this.machine = this.char.userData.machine;
        this.height = this.char.userData.height || 2;
        // a Tripo GLB that comes in later (tripoModels.js wearModel) brings its own, usually lower, height
        this.char.userData.onModelHeight = (h) => { if (h > 0) this.height = h; };
      }
    }
    this.root.add(this.char);
    this.char.updateMatrixWorld = charUpdateMatrixWorld;
    this.lod = 0; this.lodAcc = Math.random() * 0.2; this.culled = false; this.onScreen = true; this.castOn = true;
    this.rootSig = [NaN, 0, 0, 0, 0, 0, 0];
    if (this.dead) { this.anim?.die(); this.machine?.die(); }
    this.sparkle = null;
    this.marker = null;
    // engine/coarse.js: the whole view is skipped by a render pass whose view (or shadow box) its sphere misses
    this.root.userData.coarse = Math.max(3.5, (this.radius || 0.5) * 4, (this.height || 2) * 1.5);
    mgr.scene.add(this.root);
  }

  setMarker(kind) {
    if (this.markerKind === kind) return;
    this.markerKind = kind;
    if (this.marker) { this.root.remove(this.marker); this.marker = null; }
    if (!kind) return;
    this.marker = kind.startsWith('msq') ? storyMarker(kind === 'msq-offer' ? '!' : '?', kind === 'msq-active') : questMarker(kind === 'turnin' ? '?' : kind === 'active' ? '?' : '!', kind === 'active' ? '#9a9a9a' : '#f0b020');
    this.marker.position.y = this.height + 1.6;
    this.root.add(this.marker);
  }

  setLootable(on, q = 1) {
    if (on && this.sparkle && this.sparkleQ !== q) this.setLootable(false);
    if (on && !this.sparkle) {
      this.sparkleQ = q;
      // Prismatic glows in its tempered-steel colours (straw over a deep blue), never the flat fallback pink
      const col = q >= 6 ? PRISMATIC_STOPS[0] : q >= 0 ? QUALITY[Math.max(1, q)] : '#ffe08a';
      this.sparkle = new THREE.Group();
      const glow = glowSprite(new THREE.Color(col).getHex(), q >= 4 ? 2.2 : 1.4, 0.85); glow.position.y = 0.6; this.sparkle.add(glow);
      const g2 = q >= 6 ? glowSprite(new THREE.Color(PRISMATIC_STOPS[3]).getHex(), 1.5, 0.7) : null;
      if (g2) { g2.position.y = 0.35; this.sparkle.add(g2); }
      // no light shafts (content rules): the loot name plate in its quality colour marks good finds
      this.sparkle.userData.update = (dt, t) => { glow.userData.update?.(dt, t); g2?.userData.update?.(dt, t); };
      this.root.add(this.sparkle);
    }
    if (!on && this.sparkle) { this.root.remove(this.sparkle); this.sparkle = null; this.sparkleQ = null; }
  }

  apply(d) {
    this.data = d;
    this.mwDirty = true; // gear may have been swapped: the rig's next scene walk runs in full
    this.target.set(d.x, d.y, d.z);
    this.ryTarget = d.r;
    this.speedNet = d.s || 0;
    if (d.d && !this.dead) this.kill();
    if (!d.d && this.dead) this.revive(true);
    if (this.machine) this.machine.stun = !!d.st;
    if (d.ty === 'p' && this.char) { setCharWeapon(this.char, d.wt, d.wq || 1, d.oh || null, d.wu || 0, d.ou || 0); setCharArmor(this.char, d.ar || null); setCharCape(this.char, d.ck || null); setCharGear(this.char, d.gr || null); }
    if (d.ty === 'p') { this.eating = !!d.e; this.setPet(d.pt || null); this.setPaint(d.mp || 'brass', d.mk || 1); this.setMounted(!!d.mt); if (this.sitting && !d.si) this.anim?.stop?.(); this.sitting = !!d.si; }
  }

  startSalvage(pt) {
    this.stopSalvage();
    const bob = new THREE.Group();
    const cork = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.7 }));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.092, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb03020, roughness: 0.6 }));
    bob.add(cork, cap);
    bob.position.set(pt.x, pt.y + 0.03, pt.z);
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xe8e0d0, transparent: true, opacity: 0.7 }));
    line.frustumCulled = false;
    this.mgr.scene.add(bob, line);
    this.salvage = { bob, line, geo, y0: pt.y, t: 0 };
    this.ry = Math.atan2(pt.x - this.pos.x, pt.z - this.pos.z); this.ryTarget = this.ry;
    if (this.anim) this.anim.play(SALV, { fadeIn: 0.25 });
  }
  stopSalvage() {
    const S = this.salvage;
    if (!S) return;
    this.mgr.scene.remove(S.bob, S.line); S.geo.dispose();
    this.salvage = null;
    this.anim?.stop?.();
  }
  playEmote(e) {
    const c = EMOTE_CLIPS[e];
    if (c && this.anim && !this.dead && !this.mounted) this.anim.play(c, { fadeIn: 0.15, fadeOut: 0.3 });
  }
  setPet(id) {
    if ((this.petId || null) === id) return;
    if (this.pet) { this.mgr.scene.remove(this.pet); this.pet = null; }
    this.petId = id;
    const P = id && PETS[id];
    if (!P) return;
    const o = buildMachine(P.model, 0);
    o.scale.multiplyScalar(P.scale);
    o.position.copy(this.pos).add(V(1.2, 0, -1));
    this.mgr.scene.add(o);
    this.pet = o; this.petSpeed = 0;
  }
  updatePet(dt) {
    const o = this.pet;
    if (!o) return;
    // trot to a spot beside and behind the owner, a little behind on turns
    const want = V(this.pos.x - Math.sin(this.ry) * 1.3 + Math.cos(this.ry) * 0.9, 0, this.pos.z - Math.cos(this.ry) * 1.3 - Math.sin(this.ry) * 0.9);
    const dx = want.x - o.position.x, dz = want.z - o.position.z, d = Math.hypot(dx, dz);
    if (d > 25) { o.position.copy(want); }
    let sp = 0;
    if (d > 0.35) { sp = Math.min(d * 3, 9); o.position.x += (dx / d) * sp * dt; o.position.z += (dz / d) * sp * dt; o.rotation.y = Math.atan2(dx, dz); }
    else { let a = this.ry - o.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); o.rotation.y += a * Math.min(1, dt * 3); }
    o.position.y = this.mgr.heightAt(o.position.x, o.position.z);
    this.petSpeed += (sp - this.petSpeed) * Math.min(1, dt * 6);
    o.userData.machine?.update(dt, this.petSpeed / 1.5);
  }
  setPaint(paint, mk = 1) {
    if ((this.paint || 'brass') === paint && (this.mk || 1) === mk) return;
    this.paint = paint; this.mk = mk;
    this.rebuildCart();
  }
  // which mount R brings: 'runabout' or 'crawler' (the Deepway half-track), from the snapshot's mc flag
  setMountKind(kind) {
    if ((this.kind || 'runabout') === kind) return;
    this.kind = kind;
    this.rebuildCart();
  }
  buildCart() { return this.kind === 'crawler' ? buildCrawler(this.paint || 'brass') : buildRunabout(this.paint || 'brass', this.mk || 1); }
  rebuildCart() {
    if (!this.cart) return;
    const was = this.mounted; if (was) this.root.remove(this.cart); this.cart.userData.dispose?.(); this.cart = null;
    if (was) { this.cart = this.buildCart(); this.root.add(this.cart); this.rideUpdate(0); }
  }
  setMounted(on) {
    if (on === !!this.mounted || !this.anim) return;
    lookChange(this.char); // (v115: stowGear moves the held pieces: per-kind meshes first, charMerge.js)
    this.mounted = on;
    // a burst of steam and dust as the engine is brought round or put away (not on the first snapshot of a rider)
    const fx = window.game?.fx;
    if (fx && performance.now() - this.bornAt > 1500 && this.pos) {
      const p = this.pos.clone(); p.y += 0.4;
      fx.emit('dust', p, { n: 8, spread: 1.0, size: 0.9 });
      fx.emit('smoke', p.clone().setY(p.y + 0.6), { n: 6, spread: 0.6, color: '#e8ecee', size: 0.8, lifeK: 0.6 });
    }
    if (on) {
      if (!this.cart) this.cart = this.buildCart();
      this.root.add(this.cart);
      this.ride = { idleT: 5 + Math.random() * 3, idleW: 0, settle: 0, lastRun: 0 };
      this.rideUpdate(0);
      this.stowGear(true);
      this.anim.play(RIDE, { fadeIn: 0.15 });
    } else {
      if (this.cart) this.root.remove(this.cart);
      this.char.position.set(0, 0, 0);
      this.char.rotation.set(0, 0, 0);
      this.stowGear(false);
      this.anim.stop?.();
    }
  }
  // the rider sits in the sprung body: follow its bob, lean and pitch (seat = hips in body space)
  rideUpdate() {
    const body = this.cart?.userData.body, s = this.cart?.userData.seat;
    if (!body || !s) return;
    this.char.rotation.copy(body.rotation);
    this.char.position.set(s.x, s.y - 0.5, s.z).applyEuler(body.rotation).add(body.position);
  }
  // layered on top of the RIDE clip each frame: lean into turns, crouch with speed, settle on stopping, hands follow the
  // yoke as it turns, and now and then (when parked) the right hand comes off the tiller to rest on the knee
  rideBones(dt) {
    const B = this.char.userData.bones, st = this.cart?.userData.state, R = this.ride;
    if (!B || !st || !R) return;
    const sn = st.steer || 0, run = st.run || 0;
    if (R.lastRun > 0.35 && run < 0.12) R.settle = 1;
    R.lastRun = run;
    R.settle = Math.max(0, R.settle - dt / 0.45);
    const settle = R.settle > 0 ? Math.sin((1 - R.settle) * Math.PI) * 0.12 * R.settle : 0; // rocks forward then back
    if (B.spine) { B.spine.rotation.z += -sn * 0.21; B.spine.rotation.x += run * 0.1 + settle; }
    if (B.head) B.head.rotation.z += sn * 0.12;
    if (B.armL) B.armL.rotation.x += sn * 0.14;
    if (B.armR) B.armR.rotation.x -= sn * 0.14;
    if (B.foreL) B.foreL.rotation.x -= sn * 0.07;
    if (B.foreR) B.foreR.rotation.x += sn * 0.07;
    // idle hand-off
    R.idleT -= dt;
    const parked = run < 0.03 && Math.abs(sn) < 0.05;
    if (!parked) R.idleT = Math.max(R.idleT, 2);
    if (R.idleT < 0) { R.idleHold = 2.6; R.idleT = 6 + Math.random() * 2 + 2.6; }
    if (R.idleHold > 0) R.idleHold -= dt;
    R.idleW += ((R.idleHold > 0 && parked ? 1 : 0) - R.idleW) * (1 - Math.exp(-dt * 6));
    if (R.idleW > 0.001 && B.armR && B.foreR) {
      const w = R.idleW;
      B.armR.rotation.x += (RIDE_IDLE_ARM[0] - B.armR.rotation.x) * w; B.armR.rotation.y += (RIDE_IDLE_ARM[1] - B.armR.rotation.y) * w; B.armR.rotation.z += (RIDE_IDLE_ARM[2] - B.armR.rotation.z) * w;
      B.foreR.rotation.x += (RIDE_IDLE_FORE[0] - B.foreR.rotation.x) * w;
    }
  }
  // the Deadeye out of combat (v108): the pistols ride in the hip holsters and the arms swing free (Animator.holster);
  // drawn again the moment a skill starts (now: at once, the clip itself lifts them from the hips) or combat begins
  // (a quick 0.2 s draw). Riding, stowGear holsters the real pistols instead, so the copies stay out of it.
  holsterSync(on, now = false) {
    const A = this.anim, ch = this.char;
    if (!A || !ch) return;
    if (on && !A.holster && A.combatTarget && !this.data?.t) { A.combatTarget = 0; A.combatTimer = 0; } // holstering ends the guard too
    A.holster = on ? 1 : 0;
    if (now && !on) { A.holsterK = Math.min(A.holsterK, 0.6); A.pistolsIn = false; }
    setPistolsHolstered(ch, A.pistolsIn && !this.mounted);
  }
  // riding: the weapon and off hand go on the back (sword diagonal, shield flat at a slight tilt) and come back on dismount
  stowGear(on) {
    const ch = this.char, B = ch?.userData.bones;
    if (!B || !B.chest) return;
    const key = () => `${ch.userData.weaponKey || ''}|${ch.userData.offKey || ''}`;
    if (on) {
      this.stowed = this.stowed || [];
      if (this.stowed.length && this.stowKey !== key()) {
        lookChange(ch);
        // gear changed while riding: the replaced models are gone, the outfit's own ones go home first
        for (const S of this.stowed) {
          S.obj.parent?.remove(S.obj);
          if (!S.obj.userData.swapped && !S.obj.userData.offSwap) { S.parent.add(S.obj); S.obj.position.copy(S.pos); S.obj.quaternion.copy(S.quat); S.obj.visible = S.parent === B.foreL ? !(ch.userData.offKey || '').split(':')[0] : !S.parent.children.some((c) => c.userData.swapped); }
        }
        this.stowed = [];
      }
      this.stowKey = key();
      let n = this.stowed.length;
      for (const bn of ['weaponR', 'weaponL', 'foreL']) for (const c of [...(B[bn]?.children || [])]) {
        if (c.isBone || !c.visible || c.userData.armSwap) continue;
        const shield = bn === 'foreL';
        if (shield && !c.userData.isShield && !c.userData.offSwap) continue;
        lookChange(ch);
        this.stowed.push({ obj: c, parent: B[bn], pos: c.position.clone(), quat: c.quaternion.clone() });
        // the Deadeye's pistols go in their hip holsters, barrel down (client/assets/characters.js HOLSTER)
        if (c.userData.pistol && B.hips) { const at = holsterAt(ch); B.hips.add(c); c.position.set((bn === 'weaponR' ? -1 : 1) * at[0], at[1], at[2]); c.rotation.set(HOLSTER.rx, 0, 0); continue; }
        B.chest.add(c);
        if (shield) { c.position.set(0, 0.08, -0.34); c.rotation.set(0.17, Math.PI, 0); }
        else { c.position.set(n % 2 ? -0.12 : 0.12, 0.4, -0.27); c.rotation.set(0, 0, n % 2 ? Math.PI + 0.3 : Math.PI - 0.3); } // grip over the shoulder, blade down behind the shield
        n++;
      }
    } else if (this.stowed?.length) {
      lookChange(ch);
      const changed = this.stowKey !== key();
      for (const S of this.stowed) {
        S.obj.parent?.remove(S.obj);
        if (changed && (S.obj.userData.swapped || S.obj.userData.offSwap)) continue; // replaced while riding
        S.parent.add(S.obj); S.obj.position.copy(S.pos); S.obj.quaternion.copy(S.quat);
        if (changed) S.obj.visible = S.parent === B.foreL ? !(ch.userData.offKey || '').split(':')[0] : !S.parent.children.some((c) => c.userData.swapped);
      }
      this.stowed = [];
    }
  }
  // the 'die' event carries no attacker, so the fall uses the killing blow recorded by hit() a moment before
  kill() {
    this.dead = true;
    const L = this.lastHit && performance.now() - this.lastHit.at < 1500 ? this.lastHit : null;
    // a blow with no direction (a tick, a far hit) falls the default way
    this.anim?.die(undefined, L?.away ? this.toLocal(L.away) : undefined); this.machine?.die();
    if (this.machine && L?.away) this.mTilt = { d: this.toLocal(L.away), t: 0, w: 1, die: true, x: this.mTilt?.x || 0, z: this.mTilt?.z || 0 };
    this.deadT = 0;
    // the local player's killing blow lands a touch longer on the two of them
    if (L?.fx && L.src && L.src.id === this.mgr.localId && L.src !== this) L.fx.hitstop?.(0.09, [L.src, this]);
  }
  // a world direction (attacker -> target) in this character's own space: +z the way it faces, +x its left
  toLocal(w) {
    const s = Math.sin(this.ry), c = Math.cos(this.ry);
    return { x: w.x * c - w.z * s, z: w.x * s + w.z * c };
  }
  // how hard a hit lands, 0..1.4 (Animator.hit: under 0.4 a graze, under 0.8 a solid hit, then a stagger):
  // damage against max health (mobs send it, players are estimated from class and level), crits and heavy skills stagger
  hitWeight(ev) {
    let mh = this.data?.mh;
    if (!mh && this.ty === 'p') { const c = CLASSES[this.cls]; mh = (c?.hp || 120) * (1 + 0.18 * ((this.data?.l || 1) - 1)) * 1.4; }
    const f = mh ? (ev?.amt || 0) / mh : 0.1;
    let w = f < 0.06 ? (f / 0.06) * 0.4 : f < 0.2 ? 0.4 + ((f - 0.06) / 0.14) * 0.4 : 0.8 + Math.min(0.6, ((f - 0.2) / 0.3) * 0.6);
    if (ev?.crit || HEAVY.has(ev?.skill)) w = Math.max(w, 0.85 + (ev?.crit && HEAVY.has(ev?.skill) ? 0.25 : 0));
    if (ev?.skill === 'dot' || ev?.skill === 'thorns') w = Math.min(w, 0.3);
    return w;
  }
  revive(snap) {
    this.dead = false;
    if (this.splitHidden) { for (const m of this.splitHidden) m.visible = true; this.splitHidden = null; } // (S7: a split machine is whole again)
    this.anim?.revive(); this.machine?.revive();
    if (this.mTilt) { const part = this.machine?.p?.body || this.machine?.p?.torso || this.machine?.p?.hull; if (part) { part.rotation.x -= this.mTilt.x || 0; part.rotation.z -= this.mTilt.z || 0; } this.mTilt = null; }
    if (snap) { this.pos.copy(this.target); }
    this.char.position.y = 0;
    this.char.traverse((m) => { if (m.material && m.userData.fadeCorpse) { m.material.opacity = 1; } });
  }

  playSkill(id, targetEnt, ground, fx, haste = 1) {
    // a fusion (S2) plays the existing clip it names (choreo) until S4/S5 give it its own; its contacts count as the
    // fusion's (ctx.as: the tier, and the server's dmg events, which name the fusion)
    const as = CHOREO[id] ? null : skillOf(id)?.choreo ? id : null;
    let ch = CHOREO[id] || (as && CHOREO[skillOf(id).choreo]);
    if (!ch || !this.anim) return;
    // a clip with a mirrored twin (the Deadeye's Snap Shot: right pistol, then left) alternates hands, cast by cast
    if (ch.alt && CHOREO[ch.alt]) { this.altShot = !this.altShot; if (!this.altShot) ch = CHOREO[ch.alt]; }
    const tgt = targetEnt ? targetEnt : null;
    // S1 cancel (combat_design.md 2.2): a skill or dodge cutting the one before cross-fades in 0.06 s, and the cut swing's
    // trail is stopped so it fades out instead of hanging in the air
    const cut = this.anim.busy && this.anim.action;
    if (this.ctx?.trails) { for (const k of Object.keys(this.ctx.trails)) this.ctx.trails[k].stop(); this.ctx.trails = {}; }
    this.ctx = { char: this.char, animator: this.anim, cls: this.cls, yaw: this.ry, targetEnt: tgt, target: ground ? V(ground.x, 0, ground.z).setY(this.mgr.heightAt(ground.x, ground.z)) : null, held: this.ctx?.held || {}, local: this.id === this.mgr.localId, src: this, as, castFrom: this.pos?.clone?.(), aFrom: this.ctx?.castFrom || null }; // (aFrom, S11: where the last skill began; Highwire Volley rains on it) // (castFrom, S9: Earthbreaker's furrow starts where the charge began)
    const ctx = this.ctx;
    // a holstered Deadeye draws at once: the pistols come into the fists as the clip lifts them from the hips
    this.skillAt = performance.now();
    if (this.anim.holster || this.anim.pistolsIn) this.holsterSync(false, true);
    // S4: a leap that lands at its target (choreo.js toTarget): the root travel scaled to the distance less the gap
    let travelK = 1;
    // (toTarget.behind, S5 Pierce the Line: the gap is past the machine, its own radius further, so the hero ends clear of it)
    if (ch.toTarget && ch.endRoot?.[2] > 0 && tgt?.pos) travelK = Math.max(0, Math.min(ch.toTarget.max, Math.hypot(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z) - ch.toTarget.gap + (ch.toTarget.behind ? tgt.radius || 0.6 : 0))) / ch.endRoot[2];
    // (S14) the cast's effect budget (fx.js castBudget, fxbudget.js): its level for this client (own, party, others by the
    // Options setting, minimal in a crowd, far) and the caps every beat of it counts on
    ctx.fb = fx.castBudget?.(this, { fusion: !!skillOf(id)?.from, dur: ch.dur / (haste || 1) }) || null;
    this.anim.play(ch.clip, { speed: haste, fadeIn: cut ? 0.06 : undefined, travelK, onEvent: (ev) => { ctx.yaw = this.ry; fx.run(ev, ctx); } });
    if (this.char.userData.dsList && !(this.dist > 45)) dsAttack(this.char, fx); // Dragonslayer pieces vent steam
    heatAttack(this); // a +10 piece: the phones' and Simple's sparks and wisp follow your own attacks (heat.js)
  }

  mobAttack(targetEnt, ranged, special, fx) {
    if (this.machine) this.machine.attack(Math.min(1.1, (this.def?.swing || 1.6) * 0.55), special ? 'slam' : 'main');
    else if (this.anim) this.anim.play(ranged ? RAIDER_SHOOT : RAIDER_ATK, { onEvent: () => {} });
    if (ranged === 'arc' && targetEnt) {
      setTimeout(() => fx.arc(this.root.position.clone().add(V(0, (this.root.userData.height || 2.6) * 0.9, 0)), targetEnt.root.position.clone().add(V(0, 1.1, 0))), 420);
    } else if (ranged && targetEnt) {
      setTimeout(() => {
        const from = this.root.position.clone().add(V(0, 1.4, 0));
        const to = targetEnt.root.position.clone().add(V(0, 1.1, 0));
        fx.runProjectile({ kind: 'arrow', from: 'chest' }, { char: this.char, animator: this.anim }, null, () => to, V(Math.sin(this.ry), 0, Math.cos(this.ry)), () => this.root.position.clone());
      }, 450);
    }
  }

  // src: the attacking EntityView when known; ev: the dmg event ({ crit, skill })
  // the reaction follows the hit: its weight picks graze / solid / stagger, the attacker's side sets the lean
  // (and, through lastHit, which way a killing blow drops the body)
  hit(fx, src, ev) {
    // a hero's shot (S1 feel review): the server's word comes before the ball lands, often before it has left the gun (its
    // damage lands at the skill's hit time, the clip fires the ball then). The whole contact (flinch, flash, stop, sound,
    // sparks) waits for the ball: fx.runProjectile set shotDue for a ball in the air, or calls pendHit as it lands
    if (src && src.ty === 'p' && ev?.ht != null && !ev.late && fx.after) {
      const hk = SKILL_BY_ID[ev.skill]?.hit?.kind;
      if (hk === 'proj') {
        const late = () => this.hit(fx, src, { ...ev, late: true });
        const due = this.shotDue ? this.shotDue - (fx.clockT || 0) : 0;
        if (due > 0.005 && due < 0.8) { fx.after(due, null, late); return 'later'; }
        const act = src.anim?.action;
        if (src.ctx?.src === src && act?.clip.events?.some((e) => e.e === 'proj' && !act.fired.has(e))) {
          const had = this.pendHit;
          this.pendHit = had && had.ht >= ev.ht ? had : Object.assign(late, { ht: ev.ht });
          if (!had) fx.after(0.5, null, () => { const q = this.pendHit; if (q) { this.pendHit = null; q(); } });
          return 'later'; // (held: tools/combatshots logs the contact when it plays)
        }
      }
    }
    const w = this.hitWeight(ev);
    const dot = ev?.skill === 'dot' || ev?.skill === 'thorns';
    let away = null;
    if (src && src !== this && src.pos && !dot) { const a = new THREE.Vector3().subVectors(this.pos, src.pos).setY(0); if (a.lengthSq() > 1e-4) away = a.normalize(); }
    this.anim?.hit(away ? this.toLocal(away) : Math.random() < 0.5 ? 1 : -1, w);
    this.machine?.hit();
    if (this.machine && away && !this.dead) { const d = this.toLocal(away); this.mTilt = { d, t: 0, w, x: this.mTilt?.x || 0, z: this.mTilt?.z || 0 }; }
    this.lastHit = { at: performance.now(), away, src, fx, w };
    if (ev?.ht >= 4 && ev.skill !== 'kf_highledger') this.heavyAt = performance.now(); // (a fusion's finishing blow: a hold that follows it slams first, startReact; High Ledger's last cut lifts, so not that one)
    if (src && src !== this && !dot) heatHit(src, this, fx); // sparks where a +10 weapon struck (capped, heat.js)
    this.flashT = 0.22; this.flashK = ev?.crit ? 1.25 : w >= 0.8 ? 1.12 : 1; // warm flash, eased out (see update)
    const melee = away && src.pos.distanceTo(this.pos) < 5.5;
    if (away && this.ty === 'm') {
      // knockback lean away from the attacker plus a short squash, bigger for bigger hits
      this.leanDir = away.clone(); this.leanT = 0; this.leanAmt = w >= 0.8 ? 1.4 : w >= 0.4 ? 1 : 0.65;
    }
    // scoped hit-stop: only the attacker and this target stick for a moment (players' melee contacts, and the heavy
    // blows of anyone); the rest of the world, the particles and the camera keep running
    // S1: a hero's skill contact carries its hit-stop tier (ev.ht, shared/feel.js). The clip's own contact frame already
    // played the predicted tier (fx.tierHit); the server's word only adds what it alone knows (a break or a lift: T3).
    // A contact the clip did not show (a shot, a far or culled hero) plays its tier here, the stop on the target only.
    if (src && src.ty === 'p' && ev?.ht != null && fx.tierHit) {
      // the server's contact came first (offline, or a tick ahead of the clip): the clip's own contact frame plays it, at the
      // higher of the two tiers, so the stop never lands twice or holds the swing before its contact
      const act = src.anim?.action;
      if (act && src.ctx?.src === src && act.clip.events?.some((e) => e.e === 'impact' && (src.ctx.as || e.sk) === ev.skill && !act.fired.has(e))) { src.ctx.pendHt = Math.max(src.ctx.pendHt || 0, ev.ht); if (this.heavyAt) this.slamWait = true; return; }
      const L = src.lastImpact, fresh = L && performance.now() - L.at < 400 && (L.tgt === this.id || L.tgt === '*');
      const T = tierInfo(ev.ht), local = src.id === this.mgr.localId;
      const dir = away ? away.clone() : null, at = this.pos.clone().setY(this.pos.y + (this.height || 1.6) * 0.6);
      // (ranged is the skill's own kind, not the distance: a pistol shot from 3 m stopped the shooter like a sword swing)
      const hk = SKILL_BY_ID[ev.skill]?.hit?.kind, ranged = hk ? hk === 'proj' || hk === 'line' : !melee;
      if (!fresh) fx.tierHit(T, { at, feet: this.pos.clone(), dir, who: [src, this], local, ranged });
      else if (ev.ht > L.tier) { L.tier = ev.ht; fx.tierHit(T, { at, feet: this.pos.clone(), dir, who: [src, this], local, upgrade: true }); }
      else if (L.tgt === '*' && T.stop) fx.hitstop?.(T.stop, [this]); // (each machine a spin reached still sticks)
      return;
    }
    if (melee && (src.ty === 'p' || w >= 0.8)) {
      const mine = src.id === this.mgr.localId;
      const d = w >= 0.8 ? (ev?.crit ? 0.075 : 0.06) : 0.045;
      fx.hitstop?.(src.ty === 'p' ? d : 0.05, [src, this]);
      if (mine) fx.rig?.addKick?.(ev?.crit ? 0.075 : w >= 0.8 ? 0.06 : 0.045, away.clone());
    }
  }

  // S1 machine reactions (combat_design.md 2.6, all physical): 'air' (Lifted: an arc 1.6-2.6 m up with a slow tumble away
  // from the blow, a slam down with a dust puff and a 0.3 m bounce), 'stag' (Staggered: a 0.3 m lurch back, sparks from the
  // joint nearest the hit and a puff of steam from a vent) and 'broken' (the body drops 0.3 m into a kneel, steam from
  // the joints for 2 s, a few plates thrown off as debris). ev: the sim's event ({ dur, h, dir: [x, z], t })
  startReact(kind, ev, fx) {
    if (this.dead) return;
    // S7: a raider plays the hero body's clips (Air_Juggle_Loop, Hit_Knockback, Knockdown, LayToIdle; reactfx.js foeClip)
    const human = !!this.def?.humanoid;
    if (human && kind !== 'recover' && !(kind === 'air' && ev?.hold) && !(kind === 'stag' && this.react?.kind === 'air' && !this.react.landed)) fx?.foeClip?.(this, kind, ev);
    // S7: a boss's recovery after its big telegraph: it sags and vents steam for the window (not over a lift or a kneel)
    if (kind === 'recover') {
      if (this.react && this.react.kind !== 'recover') return;
      const d0 = V(-Math.sin(this.ry), 0, -Math.cos(this.ry));
      this.react = { kind, t: 0, dur: Math.min(2, ev?.t || 1.2), dir: d0, y: 0, fx, jet: 0, h: 0 };
      if (fx && !human) { fx.emit('steam', this.pos.clone().setY(this.pos.y + (this.height || 2) * 0.85), { n: 8, size: 1 + (this.radius || 1) * 0.25, spread: 0.5 }); fx.sound('hiss'); }
      return;
    }
    const d = ev?.dir ? V(ev.dir[0], 0, ev.dir[1]) : V(-Math.sin(this.ry), 0, -Math.cos(this.ry));
    if (d.lengthSq() < 1e-4) d.set(0, 0, 1);
    d.normalize();
    const H = this.height || 2, at = this.pos.clone().setY(this.pos.y + H * 0.55);
    // a hold on a machine already in the air (holdLift: High Ledger's cuts, Stormfall) carries on from where it hangs: a
    // small rise from its height, then the fall, with no snap to the ground and no take-off puff (review 18 Nov: each
    // hold restarted the arc from the floor, so the machine dropped and jumped again on every cut)
    const was = this.react;
    if (kind === 'air' && ev?.hold && was?.kind === 'air' && !was.landed && was.y > 0.05) {
      // (review 18 Nov) a hold that comes with a fusion's finishing blow (Stormfall's plunge, T4+) is a slam: the machine is
      // driven into the ground under the blade and bounces up off it, still Lifted, instead of hanging 2 m over the
      // crater while the Knight lands beneath it (the plunge never touched it)
      if (this.heavyAt && performance.now() - this.heavyAt < 300) {
        this.heavyAt = 0;
        const go = !this.slamWait || performance.now() - (this.slamHitAt || 0) < 300; this.slamWait = false; // (the server's word came before the clip's contact: wait for it, fx 'impact')
        const rem = Math.max(0.3, (ev.dur || 1) - 0.06), t1 = Math.min(0.9, rem * 0.68), t2 = rem - t1;
        // it bounces away from the hero who landed on it (the leap ends on the machine's spot, so it would sit on them)
        const away = this.lastHit?.away, dir = away && performance.now() - this.lastHit.at < 300 ? away.clone() : was.dir;
        const b0 = was.back0 ?? Math.min(0.7, 0.7 * was.t / was.dur), ox = was.dir.x * b0 - dir.x * b0, oz = was.dir.z * b0 - dir.z * b0;
        this.react = { ...was, t: 0, dur: ev.dur || 1, y0: was.y, dir, back0: b0, slam: { ts: 0.06, t1, t2, h1: 4.9 * t1 * t1 / 4, h2: Math.min(0.4, 4.9 * t2 * t2 / 4), hit: false, ox, oz, go, w: 0 }, held: true };
        return;
      }
      const u0 = Math.min(1, was.t / was.dur);
      this.react = { ...was, t: 0, dur: ev.dur || 0.6, y0: was.y, back0: (was.back0 ?? 0) + (0.7 - (was.back0 ?? 0)) * u0, h: Math.max(0.35, (was.h - was.y) * 0.45), held: true };
      return;
    }
    // a stagger on a machine in the air jolts it there (sparks, a vent puff) instead of dropping it to the floor mid-arc
    // (S5: also a stagger in the same moment as the lift, a poise break on the launching blow; it used to replace the lift,
    // so Upheaval's machine never left the ground on screen)
    if (kind === 'stag' && was?.kind === 'air' && !was.landed && (was.y > 0.05 || was.t < 0.15)) {
      if (fx) { fx.emit('sparks', this.pos.clone().setY(this.pos.y + was.y + H * 0.55).addScaledVector(d, -0.25), { n: 12, dir: d }); fx.emit('steam', this.pos.clone().setY(this.pos.y + was.y + H * 0.8), { n: 5, size: 0.8 }); }
      return;
    }
    this.react = { kind, t: 0, dur: kind === 'air' ? ev.dur || 1 : kind === 'stag' ? 0.55 : Math.min(ev?.t || 4, 4), h: Math.min(2.6, Math.max(1.6, ev?.h || 1.9)), dir: d, y: 0, ox: 0, oz: 0, tilt: 0, fx, landed: false, jet: 0 };
    if (!fx) return;
    if (kind === 'stag') {
      fx.emit('sparks', at.clone().addScaledVector(d, -0.25), { n: 12, dir: d });
      fx.emit('steam', at.clone().setY(this.pos.y + H * 0.8), { n: 5, size: 0.8 });
    } else if (kind === 'broken' && human) {
      fx.emit('dust', this.pos.clone().setY(this.pos.y + 0.15), { n: 8, spread: 0.5, size: 0.8 }); fx.sound('thud');
    } else if (kind === 'broken') {
      // (S7) jets of steam from the joints and 3-5 armour plates thrown off in the machine's own colour, sized to it
      const R = this.radius || 1, big = Math.min(2.2, 0.8 + R * 0.45);
      fx.emit('steam', at, { n: 10 + Math.round(R * 4), size: 1.1 * big, spread: 0.4 * big });
      for (let i = 0; i < 3; i++) fx.emit('steam', this.pos.clone().setY(this.pos.y + H * (0.3 + Math.random() * 0.5)).add(V((Math.random() - 0.5) * R, 0, (Math.random() - 0.5) * R)), { n: 3, size: 0.8 * big, dir: V(Math.random() - 0.5, 0.5, Math.random() - 0.5), speed: 1.4 });
      if (fx.plates) fx.plates(at.clone().setY(this.pos.y + H * 0.6), 3 + Math.floor(Math.random() * 3), Math.min(1.1, 0.32 + R * 0.22), fx.machineTone?.(this), d.clone().negate());
      else fx.rocks(at, 3 + Math.floor(Math.random() * 3), 0.5);
      fx.sound('hiss'); fx.sound('clang'); fx.sound('thud');
    } else if (kind === 'air') {
      fx.emit('dust', this.pos.clone().setY(this.pos.y + 0.15), { n: 8, spread: 0.5, size: 0.8 });
      fx.sound('scrape');
    }
  }
  updateReact(dt, dtRaw = dt) {
    const R = this.react, d = R.dir;
    R.t += dt;
    // (a slam's drive into the ground runs on real time through the contact's hit-stop, so the freeze holds the machine
    // on the ground under the blade, not still hanging over it)
    if (R.slam?.go && R.t < R.slam.ts) R.t = Math.min(R.slam.ts, R.t + Math.max(0, dtRaw - dt));
    let y = 0, back = 0, tilt = 0;
    if (R.kind === 'air') {
      const u = Math.min(1, R.t / R.dur);
      const S = R.slam;
      if (S && !S.go) { R.t = 0; S.w += dtRaw; if (S.w > 0.25) S.go = true; } // (hangs until the blade arrives)
      if (u < 1 && S) {
        // driven down in 0.06 s, then two falling bounces (heights from the time left: gravity, not a float)
        const t = R.t;
        back = R.back0 + 0.9 * Math.min(1, Math.max(0, t - S.ts) / Math.max(0.1, S.t1)) ** 0.6; tilt = 0.75 * Math.max(0, 1 - t / S.ts) + 0.3 * Math.sin(Math.min(1, t / R.dur) * Math.PI);
        this.root.position.x += S.ox; this.root.position.z += S.oz; // (where it hung, whichever way it now bounces)
        if (t < S.ts) y = R.y0 * (1 - (t / S.ts) ** 2);
        else {
          if (!S.hit) {
            S.hit = true;
            const f = this.pos.clone();
            R.fx?.emit('dust', f.clone().setY(f.y + 0.2), { n: 10, spread: 0.7, size: 1.1 });
            R.fx?.sound('clang'); // (no rocks of its own: the fusion's contact already throws the debris budget's worth)
          }
          const b = t - S.ts;
          if (b < S.t1) { const v = b / S.t1; y = S.h1 * 4 * v * (1 - v); } else { const v = Math.min(1, (b - S.t1) / Math.max(0.05, S.t2)); y = S.h2 * 4 * v * (1 - v); }
        }
      } else if (u < 1 && R.held) { y = R.y0 * (1 - u * u) + R.h * 4 * u * (1 - u); back = R.back0 + (0.7 - R.back0) * u; tilt = 0.75 * Math.sin((0.5 + 0.4 * u) * Math.PI); }
      else if (u < 1) { y = R.h * 4 * u * (1 - u) * (u < 0.5 ? 1 : 1 - 0.25 * (u - 0.5)); back = 0.7 * u; tilt = 0.75 * Math.sin(u * Math.PI * 0.9); }
      else {
        if (!R.landed) {
          R.landed = true;
          const f = this.pos.clone(); f.y = this.pos.y;
          R.fx?.emit('ringdust', f, { n: 14, r: 0.7, speed: 2.6, size: 0.9 });
          R.fx?.emit('dust', f.clone().setY(f.y + 0.2), { n: 6, spread: 0.5, size: 1 });
          R.fx?.rocks(f.clone().setY(f.y + 0.3), 4, 0.4);
          R.fx?.sound('thud');
        }
        const b = R.t - R.dur;
        y = b < 0.26 ? 0.3 * Math.sin((b / 0.26) * Math.PI) : 0; back = S ? (R.back0 + 0.9) * (1 - Math.min(1, b / 0.5) ** 2) : 0.7; if (S) { const k = 1 - Math.min(1, b / 0.5) ** 2; this.root.position.x += S.ox * k; this.root.position.z += S.oz * k; } tilt = b < 0.3 ? 0.2 * (1 - b / 0.3) : 0;
        if (b > 0.5) { this.react = null; }
      }
    } else if (R.kind === 'stag') {
      const u = R.t / R.dur;
      back = 0.3 * Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) * (u > 0.6 ? Math.max(0, 1 - (u - 0.6) / 0.4) : 1);
      tilt = 0.18 * Math.sin(Math.min(1, u) * Math.PI);
      if (u >= 1) this.react = null;
    } else if (R.kind === 'recover') {
      // a sag forward and down, eased in and out, with a vent puff now and then (no glow, steam in the alpha pool)
      const t = R.t, k = Math.min(1, t / 0.25, Math.max(0, (R.dur - t) / 0.35));
      y = -0.08 * k * Math.min(1.6, (this.height || 2) / 2.5); tilt = -0.09 * k;
      if ((R.jet += dt) > 0.34 && t < R.dur - 0.2 && !this.def?.humanoid) { R.jet = 0; const Hh = this.height || 2; R.fx?.emit('steam', this.pos.clone().setY(this.pos.y + Hh * (0.6 + Math.random() * 0.3)).add(V((Math.random() - 0.5) * (this.radius || 1), 0, (Math.random() - 0.5) * (this.radius || 1))), { n: 2, size: 0.9, dir: V(Math.random() - 0.5, 0.8, Math.random() - 0.5) }); }
      if (t >= R.dur) this.react = null;
    } else if (R.kind === 'broken') {
      const t = R.t, down = t < 0.2 ? t / 0.2 : t > R.dur - 0.4 ? Math.max(0, (R.dur - t) / 0.4) : 1;
      y = -0.3 * down * down; tilt = -0.22 * down; // (a kneel: the front drops toward the hero)
      if (t < 2 && (R.jet += dt) > 0.22) { R.jet = 0; const H = this.height || 2; R.fx?.emit('steam', this.pos.clone().setY(this.pos.y + H * (0.35 + Math.random() * 0.4)).add(V((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8)), { n: 2, size: 0.7, dir: V(Math.random() - 0.5, 0.6, Math.random() - 0.5) }); }
      if (t >= R.dur) this.react = null;
    }
    if (this.def?.humanoid) tilt *= 0.2; // (a raider's own clip carries the fall: the root only rises and slides)
    R.y = y;
    this.root.position.x += d.x * back; this.root.position.z += d.z * back; this.root.position.y += y;
    if (Math.abs(tilt) > 1e-4) { if (!this.leanDir) this.root.rotation.set(0, this.ry, 0); _leanQ.setFromAxisAngle(_leanAx.set(d.z, 0, -d.x), tilt); this.root.quaternion.premultiply(_leanQ); }
    else if (!this.leanDir) this.root.rotation.set(0, this.ry, 0);
  }

  // step (from EntityManager's LOD): undefined = the full update; otherwise { anim: seconds to advance the animator and
  // the machine by now (0 = not this frame), lod: animator detail }. Movement, turning and the root follow every frame.
  update(dtRaw, isLocal, step) {
    const ch = this.char;
    ch.mwSkip = false;
    if (this.ty === 'p' && playerMergeTick(ch, performance.now(), this.flashT > 0)) this.mwDirty = true; // (v115)
    // own time scale: a character in hit-stop (FX.hitstop sets char.userData.hitstopT) runs at HITSTOP_SCALE
    const hsU = ch.userData, hs = hsU.hitstopT || 0;
    if (hs > 0) hsU.hitstopT = Math.max(0, hs - dtRaw);
    // only the part of this frame inside the stop runs slow: a whole frame at HITSTOP_SCALE rounded every stop up to the next
    // frame (T1 0.035 s held 0.067 s at 30 fps, 0.05 s at 60), which read as sticky on phones (S1 feel review)
    const frz = Math.min(hs, dtRaw);
    this.timeScale = hs > 0 && dtRaw > 0 ? (dtRaw - frz + frz * HITSTOP_SCALE) / dtRaw : 1;
    const dt = dtRaw * this.timeScale;
    const runAnim = !step || step.anim > 0;
    const adt = !step ? dt : step.anim * this.timeScale;
    // interpolate toward the latest snapshot (the local player drives itself)
    if (!isLocal) {
      const k = 1 - Math.exp(-dt * 10);
      const before = _before.copy(this.pos);
      this.pos.lerp(this.target, k);
      if (this.pos.distanceTo(this.target) > 12) this.pos.copy(this.target);
      let d = this.ryTarget - this.ry;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.ry += d * Math.min(1, dt * 10);
      const moved = before.distanceTo(this.pos) / Math.max(dt, 1e-4);
      this.speed += (Math.min(this.speedNet || 0, moved * 1.2) - this.speed) * Math.min(1, dt * 8);
    }
    const turnRate = Math.atan2(Math.sin(this.ry - this.prevRy), Math.cos(this.ry - this.prevRy)) / Math.max(dt, 1e-4);
    this.prevRy = this.ry;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.ry;
    if (this.flashT > 0) {
      this.flashT -= dtRaw; // the flash runs through the hit-stop: it is the punch
      // warm white flash that eases out (0.9 * e^(-t/0.05)) instead of switching on and off
      // (players flash softer: bright plate armour would blow out to white under the bloom)
      const t = 0.22 - Math.max(0, this.flashT), e = this.flashT > 0 ? (this.ty === 'm' ? 0.6 : 0.3) * (this.flashK || 1) * Math.exp(-t / 0.045) : 0; // short enough that the flinch pose reads under it
      const mats = ch.userData.mats;
      if (mats) for (const k in mats) { const m = mats[k]; if (k === 'glow' || k === 'dark' || !m.emissive) continue; m.emissive.setRGB(e, e * 0.94, e * 0.85); }
    }
    if (this.leanDir) {
      // mob knockback: lean ~0.15 m at the head away from the blow and squash, back in ~0.25 s
      this.leanT += dt;
      const u = this.leanT / 0.26, w = u >= 1 ? 0 : Math.sin(Math.min(1, u) * Math.PI) * Math.exp(-u * 1.5) * (this.leanAmt || 1);
      const h = Math.max(1.2, this.root.userData.height || ch.userData.height || 2);
      const ang = Math.atan(0.15 * w / h) * 1.6;
      this.root.rotation.set(0, this.ry, 0);
      _leanQ.setFromAxisAngle(_leanAx.set(this.leanDir.z, 0, -this.leanDir.x), ang);
      this.root.quaternion.premultiply(_leanQ);
      const sq = u < 0.31 ? 1 - 0.08 * Math.sin(Math.min(1, u / 0.31) * Math.PI) * (this.leanAmt || 1) : 1;
      this.root.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      if (u >= 1) { this.leanDir = null; this.root.scale.set(1, 1, 1); this.root.rotation.set(0, this.ry, 0); }
    }
    if (this.react) this.updateReact(dt, dtRaw); // (S1: lifted, staggered, broken)
    let fresh = false; // the animator refreshed the whole rig and nothing moved it afterwards
    if (this.anim) {
      if (this.eating && !this.anim.busy) this.anim.play(EAT, { fadeIn: 0.3 });
      if (this.mounted && !this.anim.busy) this.anim.play(RIDE, { fadeIn: 0.2 });
      if (this.sitting && !this.mounted && !this.anim.busy) this.anim.play(SIT, { fadeIn: 0.3 });
      if (this.ty === 'p' && this.data && (this.data.mc ? 'crawler' : 'runabout') !== (this.kind || 'runabout')) this.setMountKind(this.data.mc ? 'crawler' : 'runabout');
      if (this.mounted) {
        const me = isLocal ? null : this.mgr.views.get(this.mgr.localId); // remote carts far from us drop smoke and rods
        this.cart.userData.update(dt, this.speed, turnRate, me ? this.root.position.distanceTo(me.root.position) : 0);
        this.rideUpdate(); this.stowGear(true);
      }
      if (this.salvage) {
        const S = this.salvage; S.t += dt;
        if (!this.anim.busy) this.anim.play(SALV, { fadeIn: 0.2 });
        S.bob.position.y = S.y0 + 0.03 + Math.sin(S.t * 2.6) * 0.025 - (Math.sin(S.t * 0.9) > 0.97 ? 0.06 : 0);
        const hand = ch.userData.bones?.handR, a = S.geo.attributes.position;
        const hp = hand ? hand.getWorldPosition(_hp) : _hp.copy(this.pos).setY(this.pos.y + 1.3);
        a.setXYZ(0, hp.x, hp.y, hp.z); a.setXYZ(1, S.bob.position.x, S.bob.position.y + 0.08, S.bob.position.z); a.needsUpdate = true;
      }
      if (ch.userData.kind === 'deadeye') this.holsterSync(!this.data?.t && !(performance.now() - (this.skillAt || -1e9) < HOLSTER_AFTER) && !this.dead);
      if (runAnim) {
        this.anim.lod = step ? step.lod : 0;
        if (ch.userData.dsList) dsUpdate(ch, adt, this.dead || this.mounted ? 0 : this.anim.combat); // Dragonslayer parts, before the rig refresh
        this.anim.update(adt, { speed: this.dead || this.mounted ? 0 : this.speed, turnRate, combat: !!this.data?.t, air: this.data?.a });
        if (this.mounted) this.rideBones(adt);
        if (ch.userData.bow) { updateBowString(ch); ch.userData.bow.updateMatrixWorld(true); }
        fresh = !this.mounted;
      }
    }
    if (this.machine && runAnim) {
      // directional reaction layered on the machine's own animation: tip the main part away from the blow
      // (last frame's offset comes off first, so machines that never reset their rotation do not drift)
      const part = this.machine.p?.body || this.machine.p?.torso || this.machine.p?.hull, mt = this.mTilt;
      if (part && mt?.x) { part.rotation.x -= mt.x; part.rotation.z -= mt.z; mt.x = mt.z = 0; }
      this.machine.update(adt, this.dead ? 0 : this.speed);
      if (part && mt?.d) {
        mt.t += adt;
        // a hit snaps in over 60 ms and settles over about 0.4 s; a killing blow eases in and stays
        const k = mt.die ? Math.min(1, mt.t / 0.45) * (2 - Math.min(1, mt.t / 0.45)) * 0.32
          : (mt.t < 0.06 ? mt.t / 0.06 : Math.max(0, 1 - (mt.t - 0.06) / 0.38) ** 2) * 0.2 * (0.55 + Math.min(1.4, mt.w));
        if (k > 1e-4) { mt.x = mt.d.z * k; mt.z = -mt.d.x * k; part.rotation.x += mt.x; part.rotation.z += mt.z; } else if (!mt.die) mt.d = null;
      }
    }
    if (this.machine) this.steadyLight();
    if (this.pet) this.updatePet(dt);
    if (this.dead) {
      this.deadT = (this.deadT || 0) + dt;
      if (this.deadT > 20 && this.ty === 'm') ch.position.y = -Math.min(2, (this.deadT - 20) * 0.3);
    }
    if (this.marker) this.marker.position.y = this.height + 1.6 + Math.sin(performance.now() / 300) * 0.08;
    this.sparkle?.userData.update?.(dt, performance.now() / 1000);
    // the scene walk may skip this rig: the animator just refreshed it, or (a frame it did not run) nothing moved
    const R = this.root, sig = this.rootSig;
    const same = sig[0] === R.position.x && sig[1] === R.position.y && sig[2] === R.position.z && sig[3] === R.quaternion.y && sig[4] === R.scale.y && sig[5] === ch.position.y && sig[6] === R.quaternion.x;
    if (!same) { sig[0] = R.position.x; sig[1] = R.position.y; sig[2] = R.position.z; sig[3] = R.quaternion.y; sig[4] = R.scale.y; sig[5] = ch.position.y; sig[6] = R.quaternion.x; }
    { const g = ch.userData.mergeGen | 0; if (g !== this._mg) { this._mg = g; this.mwDirty = true; } } // (merged or taken apart: a full walk)
    if (this.anim && !this.mwDirty && (fresh || (!runAnim && same && !this.mounted))) ch.mwSkip = true;
    else if (this.anim && !this.mwDirty && !runAnim && !this.mounted) ch.mwLight = true; // only the root moved (v114 light walk)
    this.mwDirty = false;
  }
  // a boss machine's furnace light (creatures.js marks it userData.steadyLight): borrowed from the effects' fixed light
  // pool while it is near, so no light is ever added to or removed from the scene (that recompiles every lit material)
  steadyLight() {
    const L = this.machine.p?.light, S = L?.userData?.steadyLight, fx = window.game?.fx;
    if (!S || !fx?.steadyLight || this.culled || this.root.visible === false || this.dist > 70) return;
    L.getWorldPosition(_lw);
    fx.steadyLight(this, _lw, S.color, L.userData.intensity ?? S.intensity, S.dist, S.decay);
  }
  // past the cull distance: no rig, no animation; keep the cheap state (where it is, how long it has lain dead)
  farTick(dtRaw) {
    this.pos.copy(this.target); this.ry = this.ryTarget; this.prevRy = this.ry; this.speed = 0;
    const hsU = this.char.userData; if (hsU.hitstopT) hsU.hitstopT = 0;
    if (this.flashT > 0) this.flashT -= dtRaw;
    if (this.dead) this.deadT = (this.deadT || 0) + dtRaw;
    this.lodAcc = Math.min(3, this.lodAcc + dtRaw);
  }
  setCulled(on) {
    if (on === this.culled) return;
    this.culled = on;
    const sc = this.mgr.scene;
    if (on) { sc.remove(this.root); if (this.pet) sc.remove(this.pet); return; }
    // back in range: snap to the latest server position and settle the rig with the time it missed (a death that
    // happened out there lands lying down, a skill in progress finishes)
    this.pos.copy(this.target); this.ry = this.ryTarget; this.prevRy = this.ry;
    if (this.pet) { this.pet.position.copy(this.pos); sc.add(this.pet); }
    sc.add(this.root);
    this.mwDirty = true;
    this.update(1 / 60, false, { anim: Math.max(1 / 60, this.lodAcc), lod: 2 });
    this.lodAcc = 0;
  }
  // characters stop casting sun shadows past charShadowDist (the meshes' own flags are kept and restored)
  setCast(on) {
    this.castOn = on;
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      if (on) { if (o.userData.csOff) { o.castShadow = true; o.userData.csOff = false; } }
      else if (o.castShadow) { o.castShadow = false; o.userData.csOff = true; }
    });
  }

  dispose() {
    if (this.pet) this.mgr.scene.remove(this.pet);
    this.mgr.scene.remove(this.root);
    if (this.char) unmergeCharacter(this.char); // (v115: a merged player's per-kind meshes and pieces are freed below too)
    if (this.char) dsaDispose(this.char); // the Dragonslayer armour's merged mesh, material and its share of the atlas
    // (a skinned mesh's bone texture too: three re-creates it if a shared skeleton is drawn again)
    this.root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) { disposeCharGeometry(o.geometry); } if (o.isSkinnedMesh) o.skeleton?.dispose?.(); }); // (shared vertex arrays stay: rig.js)
    this.cart?.userData.dispose?.(); // the runabout's own materials (and its geometry when it is parked off the root)
  }
}

export class EntityManager {
  constructor(scene, heightAt) {
    this.scene = scene;
    this.heightAt = heightAt;
    this.views = new Map();
    this.seen = new Map();
    this.localId = null;
  }
  get(id) { return this.views.get(id); }
  ensure(d) {
    let v = this.views.get(d.id);
    if (!v) { v = new EntityView(this, d); this.views.set(d.id, v); }
    return v;
  }
  snapshot(list, now) {
    for (const d of list) {
      const v = this.ensure(d);
      if (d.id !== this.localId) v.apply(d); else { v.data = { ...v.data, ...d }; if (d.d && !v.dead) v.kill(); if (!d.d && v.dead) v.revive(false); }
      this.seen.set(d.id, now);
    }
    for (const [id, t] of this.seen) {
      if (now - t > 1.5 && id !== this.localId && !id.startsWith('n_')) {
        const v = this.views.get(id);
        if (v) { v.dispose(); this.views.delete(id); }
        this.seen.delete(id);
      }
    }
  }
  addNpc(n) {
    const v = this.ensure({ id: n.id, ty: 'n', look: n.look, v: n.v, x: n.x, y: n.y, z: n.z, r: n.ry });
    v.npc = n;
    v.name = n.name;
    return v;
  }
  // per frame: every view, at the rate and detail its distance and visibility earn (VIEW_LOD above)
  update(dt) {
    const L = GFX.mobile ? VIEW_LOD_MOB : heroOn() ? VIEW_LOD_HERO : VIEW_LOD, me =this.views.get(this.localId), cam = window.game?.engine?.camera;
    const ref = me ? me.pos : cam ? cam.position : null;
    this.lodT = (this.lodT ?? 0) - dt;
    const evalNow = this.lodT <= 0;
    if (evalNow) { this.lodT = 0.25; this.sweepN = ((this.sweepN || 0) + 1) % 8; }
    if (cam) { _pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _frustum.setFromProjectionMatrix(_pv); }
    const sd = charShadowDist();
    for (const v of this.views.values()) {
      const local = v.id === this.localId;
      if (local || !ref || this.lodOff) { if (v.culled) v.setCulled(false); if (!v.castOn) v.setCast(true); v.update(dt, local); continue; }
      if (evalNow || v.dist === undefined) {
        const d = v.dist = v.pos.distanceTo(ref);
        const h = v.height || 2, cd = Math.max(GFX.viewDist ?? L.CULL_D, h * 28); // (QUALITY.viewDist: the phones' shorter cut)
        const cull = v.culled ? d > cd - L.HYST : d > cd + L.HYST;
        // at the cull edge a view grows in (or shrinks out over FADE, then leaves the scene) instead of popping
        if (cull && !v.culled) v.fadeOut = true;
        else if (!cull) { v.fadeOut = false; if (v.culled) { v.setCulled(false); v.fade = 0; } }
        const t0 = v.tier ?? 0;
        v.tier = d < L.FULL_D + (t0 === 0 ? L.HYST : 0) ? 0 : d < L.NEAR_D + (t0 <= 1 ? L.HYST : 0) ? 1 : 2;
        if (v.tier !== t0 && v.char) dsaLod(v.char, v.tier >= 2); // far: the Dragonslayer armour's _lo models
        // sun shadows from characters within charShadowDist (re-swept now and then: new gear casts by default)
        const cs = v.castOn ? d < sd + 2 : d < sd - 2;
        if (cs !== v.castOn || (!cs && this.sweepN === 0)) v.setCast(cs);
      }
      if (v.culled) { v.farTick(dt); continue; }
      let on = v.root.visible !== false;
      if (on && cam) { const h = v.height || 2; _sph.center.set(v.pos.x, v.pos.y + h * 0.5, v.pos.z); _sph.radius = h * 0.75 + 2; on = _frustum.intersectsSphere(_sph); }
      v.onScreen = on;
      const force = (v.char.userData.hitstopT || 0) > 0 || (v.tier <= 1 && v.anim?.busy);
      const hz = force || v.tier === 0 ? 0 : v.tier === 1 ? (on ? L.NEAR_HZ : v.dist < 45 ? L.OFF_NEAR_HZ : L.OFF_HZ) : on ? L.MID_HZ : L.OFF_HZ;
      v.lodAcc += dt;
      let anim = 0;
      if (hz === 0 || v.lodAcc >= 1 / hz - 1e-4) { anim = Math.min(v.lodAcc, 0.5); v.lodAcc = 0; }
      const fading = v.fadeOut || (v.fade ?? 1) < 1;
      if (fading) v.mwDirty = true; // the root's scale changes: the rig's walk runs in full
      v.update(dt, false, { anim, lod: v.tier });
      if (fading) {
        v.fade = Math.max(0, Math.min(1, (v.fade ?? 1) + (v.fadeOut ? -dt : dt) / L.FADE));
        if (v.fadeOut && v.fade <= 0) { v.fadeOut = false; v.root.scale.set(1, 1, 1); v.setCulled(true); continue; }
        const k = Math.max(1e-3, v.fade * v.fade * (3 - 2 * v.fade));
        if (v.leanDir) v.root.scale.multiplyScalar(k); else v.root.scale.setScalar(k);
      }
    }
    heatTick(this, dt, window.game?.fx); // upgrade heat: the shared shimmer setting and the capped steam wisps
  }

}
