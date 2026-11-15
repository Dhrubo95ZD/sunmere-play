// Townsfolk: the life of Sunmere Village. Client-side ambience only (not part of the simulation).
//  - villagers stroll between spots, glance around, some carry crates between the market and the houses
//  - customers haggle at the market stalls while the stall keepers gesture back
//  - boys play tag round the plaza, readers linger at the notice board
//  - guards patrol the plaza and stand posted at the stairs, the hall door and the gate
//  - two fighters spar in a roped ring by the forge while onlookers cheer; an archer practises at the range
//  - an apprentice hammers sparks off the forge anvil
//  - a handcart caravan travels between the south gate, the market and the farms with an escort
//  - indoors (role 'indoor', houses spec §5): workers at fixed spots of the enterable houses (shared/houses.js), each
//    with a job loop; built lazily, shown within 40 m. After dark the folk who turn in sit or doze at the sit / bed
//    spots of 'home' houses. Spec deviation: there was no chat-bubble path in the client, so barks use a small speech
//    bubble of their own in the HUD's floating-text layer (.hud .floats); carriers, sweepers and hoers (who hold props)
//    still vanish at night instead of going home.
import * as THREE from 'three';
import { buildCharacter } from '../assets/characters.js';
import { mergeCharacter, mergeOn, lightWalk, unfreeze } from '../assets/charMerge.js';
import { Builder, box, rbox, cyl, sphere, torus, lathe, lumpy } from '../assets/kit.js';
import { Animator, compileClip } from './anim.js';
import { CHOREO } from './choreo.js';
import { updateBowString } from './fx.js';
import { arrowMesh } from '../assets/characters.js';
import { STREAM, LAKE, streamInfo, streamLevel } from '/sunmere-play/shared/terrain.js';
import { pointAt } from './villageLayout.js';
import { houseSpec, allHouses } from '/sunmere-play/shared/houses.js';
import { QUALITY as GFX } from '../engine/globals.js';

const PI = Math.PI;
const r = (a, b) => a + (b - a) * Math.random();
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _before = new THREE.Vector3();
// three's scene walk: a hidden villager's subtree is skipped (nothing of it is drawn or read while hidden; the walk on
// the frame it shows again recomputes it, root first), and a rig the animator has just refreshed is not walked twice
const OBJ_UMW = THREE.Object3D.prototype.updateMatrixWorld;
function rootUpdateMatrixWorld(force) { if (this.visible) OBJ_UMW.call(this, force); }
function charUpdateMatrixWorld(force) {
  if (this.mwSkip) { this.mwSkip = false; this.mwLight = false; unfreeze(this); return; }
  if (this.mwLight) { this.mwLight = false; if (lightWalk(this)) return; } // (v114: charMerge.js)
  unfreeze(this);
  OBJ_UMW.call(this, force);
}
// avoidance between walkers: a 4 m grid rebuilt each frame instead of every walker against every other
const CELL = 4;
const cellKey = (x, z) => (Math.floor(x / CELL) + 512) * 1024 + (Math.floor(z / CELL) + 512);
// pose detail by distance from the player: full within 30 m, 30 Hz without foot IK / cloth to 50 m, then 15 Hz pose
// only; beyond 50 m the slow walkers (not the running children or the sparring pair) also think at 10 Hz
// (v114, the phone presets: full detail to 24 m, then 20 Hz, past 50 m 12 Hz: a far villager is a few dozen pixels tall)
const TF_LOD_DESK = { FULL: 30, NEAR: 50, NEAR_HZ: 30, FAR_HZ: 15, THINK_HZ: 10 };
const TF_LOD_MOB = { FULL: 24, NEAR: 50, NEAR_HZ: 20, FAR_HZ: 12, THINK_HZ: 10 };

// walking spots, kept on one side of the stream each so nobody wades across
const SPOTS = {
  village: [[11, 3], [-11, 4], [7, -11], [-7, -11], [3, 12], [-3, 12], [2, 17], [-2, 21], [3, 23], [-11.5, -2], [12, -1],
    [-24, -1], [-34, 0], [-38, -2], [18, 2], [28, 4], [-20, -14], [-30, -26], [-38, -30], [10, -14], [22, -18], [-10, -16], [5, -17]],
  south: [[2, 38], [-3, 42], [3, 44], [-24, 40], [-36, 30], [-44, 42], [26, 37], [38, 30], [16, 46], [-14, 47]],
  farm: [[88, 4], [96, -4], [110, 12], [94, 18], [118, 24], [106, 30], [122, 6], [90, 30]],
  play: [[10, 4], [-10, 5], [6, -10], [-6, -10], [12, -4], [-12, -3], [3, 13], [-4, 13], [11, 10], [-11, 9], [-15, -19], [15, -19]],
};
// stall fronts: where a customer stands and which way they face; stall keepers stand behind the counters
const STALLS = [[-8.4, 16.4, PI / 2], [8.4, 16.4, -PI / 2], [-8.4, 21.6, PI / 2], [8.4, 21.6, -PI / 2], [-13.6, 18.6, PI / 2 - 0.5], [13.6, 18.6, -PI / 2 + 0.5]];
const front = (s, d) => [s[0] + Math.sin(s[2]) * d, s[1] + Math.cos(s[2]) * d];

// small gesture clips (upper body over the walk/idle)
const TALK = compileClip({ dur: 2.4, mask: 'upper', keys: [
  { t: 0, p: {} },
  { t: 0.22, p: { armR: [-55, 20, -22], foreR: [-75, 0, 0], handR: [0, 0, -20], head: [6, 8, 0] } },
  { t: 0.45, p: { armR: [-35, 10, -48], foreR: [-45, 0, 0], handR: [0, 30, -30], head: [-4, -6, 0] } },
  { t: 0.7, p: { armL: [-45, -20, 30], foreL: [-65, 0, 0], armR: [-12, 0, -12], foreR: [-25, 0, 0], head: [4, 10, 0] } },
  { t: 1, p: {} },
] });
const NOD = compileClip({ dur: 1.3, mask: 'upper', keys: [{ t: 0, p: {} }, { t: 0.3, p: { neck: [14, 0, 0], head: [12, 0, 0] } }, { t: 0.55, p: { neck: [2, 0, 0], head: [-2, 0, 0] } }, { t: 0.8, p: { neck: [10, 0, 0], head: [8, 0, 0] } }, { t: 1, p: {} }] });
// sparring: each class's exchanges (the Deadeye's are pistol-butt grip strikes: drill, never a shot at a man)
const SPAR_CLIPS = { knight: ['k_valiant', 'k_twin', 'k_pommel'], sandblade: ['s_slash', 's_twin', 's_needle'], deadeye: ['d_grip'] };
// v108: the Deadeyes of the watch (Townsfolk constructor): the sparring pair's ring by the pistol range, and the posted
// guards [x, z, facing, coat variant]: the range, the north gate, the outposts (Ironcliff, the Westfold camp, Highreach)
const DEADEYE_PIT = [-33.5, -35.5];
const DEADEYE_POSTS = [[-37.0, -38.5, 1.57, 0], [-2.6, 40.6, 0, 1], [2.6, 40.6, 0, 2], [165.5, -36, -1.6, 0], [-34, 162, -2.6, 1], [103.5, -213.5, 1.06, 2]];
const CHEER = compileClip({ dur: 1.6, mask: 'upper', keys: [{ t: 0, p: {} }, { t: 0.3, p: { armR: [-170, 0, -20], foreR: [-20, 0, 0], armL: [-165, 0, 25], foreL: [-25, 0, 0], spine: [-8, 0, 0] } }, { t: 0.6, p: { armR: [-150, 0, -35], foreR: [-50, 0, 0], armL: [-150, 0, 35], foreL: [-50, 0, 0] } }, { t: 1, p: {} }] });
const HOLD = (p) => compileClip({ dur: 1.0, mask: 'upper', keys: [{ t: 0, p }, { t: 1, p }] });
const CARRY = HOLD({ armL: [-42, 0, 16], foreL: [-72, 0, 0], handL: [0, 0, 30], armR: [-42, 0, -16], foreR: [-72, 0, 0], handR: [0, 0, -30], spine: [-6, 0, 0] });
const PUSH = HOLD({ armL: [-38, 0, 10], foreL: [-28, 0, 0], armR: [-38, 0, -10], foreR: [-28, 0, 0], spine: [12, 0, 0] });
const HAMMER = compileClip({ dur: 1.15, mask: 'upper', keys: [
  { t: 0, p: { armR: [-40, 0, -12], foreR: [-30, 0, 0], spine: [14, 0, 0], armL: [-40, 0, 14], foreL: [-60, 0, 0] } },
  { t: 0.42, p: { armR: [-150, 0, -14], foreR: [-50, 0, 0], spine: [4, 0, 0], armL: [-40, 0, 14], foreL: [-60, 0, 0] } },
  { t: 0.56, p: { armR: [-48, 0, -12], foreR: [-18, 0, 0], spine: [18, 0, 0], armL: [-40, 0, 14], foreL: [-60, 0, 0] }, e: 'snap' },
  { t: 1, p: { armR: [-40, 0, -12], foreR: [-30, 0, 0], spine: [14, 0, 0], armL: [-40, 0, 14], foreL: [-60, 0, 0] } },
] });

// ---- indoor work (role 'indoor'): one idle loop per job, played at 0.9-1.1x from a random phase; some jobs have a
// second clip now and then (the baker's peel, the carpenter's saw, the cook's taste)
const UPJ = (dur, keys) => compileClip({ dur, mask: 'upper', keys });
const SEAT = { hips: [0, 0, 0], thighL: [-90, 0, 10], shinL: [130], thighR: [-90, 0, -10], shinR: [130] }; // sitting on the floor
const SMITH_W = { armR: [-40, 0, -12], foreR: [-30, 0, 0], spine: [14, 0, 0], armL: [-40, 0, 14], foreL: [-60, 0, 0], handL: [0, 0, 0], head: [10, 0, 0] };
const SMITHING = UPJ(3.4, [
  { t: 0, p: SMITH_W },
  { t: 0.16, p: { armR: [-150, 0, -14], foreR: [-50, 0, 0], spine: [4, 0, 0] } },
  { t: 0.23, p: { armR: [-48, 0, -12], foreR: [-18, 0, 0], spine: [18, 0, 0] }, e: 'snap' },
  { t: 0.39, p: { armR: [-150, 0, -14], foreR: [-50, 0, 0], spine: [4, 0, 0] } },
  { t: 0.46, p: { armR: [-48, 0, -12], foreR: [-18, 0, 0], spine: [18, 0, 0] }, e: 'snap' },
  { t: 0.62, p: SMITH_W },
  { t: 0.74, p: { ...SMITH_W, armL: [-52, 28, 14], handL: [0, 0, 60], spine: [16, -8, 0], head: [12, -10, 0] } },
  { t: 0.88, p: SMITH_W },
  { t: 1, p: SMITH_W },
]);
const KNEAD_B = { spine: [28, 0, 0], armR: [-50, 0, -10], foreR: [-40, 0, 0], armL: [-50, 0, 10], foreL: [-40, 0, 0], head: [16, 0, 0] };
const KNEADING = UPJ(2.2, [
  { t: 0, p: KNEAD_B },
  { t: 0.25, p: { ...KNEAD_B, armR: [-64, 0, -8], foreR: [-18, 0, 0], spine: [34, 4, 0] } },
  { t: 0.5, p: KNEAD_B },
  { t: 0.75, p: { ...KNEAD_B, armL: [-64, 0, 8], foreL: [-18, 0, 0], spine: [34, -4, 0] } },
  { t: 1, p: KNEAD_B },
]);
const PEEL_B = { thighL: [0, 0, 0], shinL: [0], thighR: [0, 0, 0], shinR: [0], spine: [8, 0, 0], armR: [-48, 0, -10], foreR: [-30, 0, 0], armL: [-44, 0, 10], foreL: [-34, 0, 0] };
const PEELING = compileClip({ dur: 2.8, mask: 'full', keys: [
  { t: 0, p: PEEL_B, root: [0, 0, 0] },
  { t: 0.35, p: { thighL: [-34, 0, 0], shinL: [34], thighR: [12, 0, 0], shinR: [8], spine: [18, 0, 0], armR: [-76, 0, -8], foreR: [-8, 0, 0], armL: [-72, 0, 8], foreL: [-12, 0, 0] }, root: [0, -0.07, 0.16] },
  { t: 0.62, p: { thighL: [-34, 0, 0], shinL: [34], thighR: [12, 0, 0], shinR: [8], spine: [18, 0, 0], armR: [-76, 0, -8], foreR: [-8, 0, 0], armL: [-72, 0, 8], foreL: [-12, 0, 0] }, root: [0, -0.07, 0.16] },
  { t: 1, p: PEEL_B, root: [0, 0, 0] },
] });
const WEAVE_B = { spine: [10, 0, 0], armR: [-60, 0, -20], foreR: [-70, 0, 0], armL: [-60, 0, 20], foreL: [-70, 0, 0], head: [10, 0, 0] };
const WEAVING = UPJ(2.6, [
  { t: 0, p: WEAVE_B },
  { t: 0.2, p: { ...WEAVE_B, armR: [-56, -10, -50], foreR: [-30, 0, 0], spine: [10, -12, 0], head: [8, -16, 0] } },
  { t: 0.4, p: { ...WEAVE_B, armL: [-56, 10, 50], foreL: [-30, 0, 0], spine: [10, 12, 0], head: [8, 16, 0] } },
  { t: 0.6, p: WEAVE_B },
  { t: 0.74, p: { ...WEAVE_B, armR: [-40, 0, -14], foreR: [-92, 0, 0], armL: [-40, 0, 14], foreL: [-92, 0, 0], spine: [4, 0, 0] }, e: 'snap' },
  { t: 1, p: WEAVE_B },
]);
const WRITE_B = { spine: [22, 0, 0], head: [24, 0, 0], armR: [-38, 0, -10], foreR: [-75, 0, 0], handR: [10, 0, 0], armL: [-35, 0, 12], foreL: [-80, 0, 0], handL: [0, 0, 0] };
const WRITING = UPJ(4.2, [
  { t: 0, p: WRITE_B },
  { t: 0.1, p: { ...WRITE_B, handR: [-10, 0, 12] } },
  { t: 0.2, p: { ...WRITE_B, handR: [12, 0, -10] } },
  { t: 0.3, p: { ...WRITE_B, handR: [-10, 0, 12] } },
  { t: 0.4, p: WRITE_B },
  { t: 0.52, p: { ...WRITE_B, armL: [-52, -20, 30], foreL: [-40, 0, 0], handL: [0, 0, -50] } },
  { t: 0.64, p: WRITE_B },
  { t: 0.78, p: { ...WRITE_B, head: [-4, 0, 0], spine: [12, 0, 0] } },
  { t: 0.9, p: { ...WRITE_B, head: [-4, 0, 0], spine: [12, 0, 0] } },
  { t: 1, p: WRITE_B },
]);
const PLANE_B = { spine: [30, 0, 0], armR: [-55, 0, -10], foreR: [-50, 0, 0], armL: [-55, 0, 10], foreL: [-50, 0, 0], head: [18, 0, 0] };
const PLANING = UPJ(1.9, [
  { t: 0, p: PLANE_B },
  { t: 0.55, p: { ...PLANE_B, spine: [38, 0, 0], armR: [-80, 0, -8], foreR: [-8, 0, 0], armL: [-80, 0, 8], foreL: [-8, 0, 0] } },
  { t: 0.7, p: { ...PLANE_B, spine: [38, 0, 0], armR: [-80, 0, -8], foreR: [-8, 0, 0], armL: [-80, 0, 8], foreL: [-8, 0, 0] } },
  { t: 1, p: PLANE_B },
]);
const SAW_B = { spine: [24, 0, -4], armR: [-45, 0, -10], foreR: [-80, 0, 0], armL: [-50, 0, 20], foreL: [-40, 0, 0], head: [20, 0, 0] };
const SAWING = UPJ(1.2, [{ t: 0, p: SAW_B }, { t: 0.5, p: { ...SAW_B, armR: [-70, 0, -8], foreR: [-20, 0, 0] } }, { t: 1, p: SAW_B }]);
const ELDER_B = { ...SEAT, spine: [16, 0, 0], armR: [-60, 0, -10], foreR: [-50, 0, 0], armL: [-60, 0, 10], foreL: [-50, 0, 0], head: [6, 0, 0] };
const ELDERLY = compileClip({ dur: 7, mask: 'full', keys: [
  { t: 0, p: ELDER_B, root: [0, -0.62, 0] },
  { t: 0.3, p: { ...ELDER_B, head: [6, 26, 0], neck: [0, 8, 0] } },
  { t: 0.55, p: { ...ELDER_B, head: [6, -20, 0], neck: [0, -6, 0] } },
  { t: 0.72, p: { ...ELDER_B, head: [16, 0, 0], neck: [0, 0, 0] } },
  { t: 0.8, p: { ...ELDER_B, head: [4, 0, 0] } },
  { t: 0.87, p: { ...ELDER_B, head: [14, 0, 0] } },
  { t: 1, p: ELDER_B },
] });
const STIR_B = { spine: [18, 0, 0], armR: [-50, 0, -20], foreR: [-60, 0, 0], armL: [-30, 0, 20], foreL: [-50, 0, 0], head: [16, 0, 0] };
const STIRRING = UPJ(2.4, [
  { t: 0, p: STIR_B },
  { t: 0.25, p: { ...STIR_B, armR: [-55, 12, -10] } },
  { t: 0.5, p: { ...STIR_B, armR: [-50, 0, -30] } },
  { t: 0.75, p: { ...STIR_B, armR: [-45, -12, -14] } },
  { t: 1, p: STIR_B },
]);
const TASTING = UPJ(2.6, [
  { t: 0, p: STIR_B },
  { t: 0.3, p: { ...STIR_B, armR: [-72, -10, -10], foreR: [-128, 0, 0], head: [-6, 0, 0], spine: [8, 0, 0] } },
  { t: 0.55, p: { ...STIR_B, armR: [-72, -10, -10], foreR: [-128, 0, 0], head: [-6, 0, 0], spine: [8, 0, 0] } },
  { t: 0.68, p: { ...STIR_B, head: [10, 10, 0] } },
  { t: 1, p: STIR_B },
]);
const COOP_B = { spine: [32, 0, 0], armR: [-60, 0, -12], foreR: [-50, 0, 0], armL: [-45, 0, 14], foreL: [-50, 0, 0], head: [20, 0, 0] };
const COOPERING = UPJ(2.2, [
  { t: 0, p: COOP_B },
  { t: 0.14, p: { ...COOP_B, armR: [-100, 0, -10], foreR: [-62, 0, 0] } },
  { t: 0.22, p: { ...COOP_B, armR: [-42, 0, -12], foreR: [-28, 0, 0] }, e: 'snap' },
  { t: 0.38, p: { ...COOP_B, armR: [-100, 0, -10], foreR: [-62, 0, 0] } },
  { t: 0.46, p: { ...COOP_B, armR: [-42, 0, -12], foreR: [-28, 0, 0] }, e: 'snap' },
  { t: 0.7, p: { ...COOP_B, spine: [32, 16, 0], armL: [-55, 10, 20] } },
  { t: 0.86, p: COOP_B },
  { t: 1, p: COOP_B },
]);
// night: sitting at home, and dozing at the bed spot (the head sinks, the arms folded)
const SIT_B = { ...SEAT, spine: [12, 0, 0], armR: [-40, 0, -10], foreR: [-40, 0, 0], armL: [-40, 0, 10], foreL: [-40, 0, 0], head: [8, 0, 0] };
const SITTING = compileClip({ dur: 5, mask: 'full', keys: [{ t: 0, p: SIT_B, root: [0, -0.62, 0] }, { t: 0.5, p: { ...SIT_B, head: [12, 10, 0] } }, { t: 1, p: SIT_B }] });
const DOZE_B = { ...SEAT, spine: [28, 0, 0], armR: [-30, 0, -10], foreR: [-100, 0, 0], armL: [-30, 0, 10], foreL: [-100, 0, 0], head: [30, 0, 0] };
const DOZING = compileClip({ dur: 6, mask: 'full', keys: [{ t: 0, p: DOZE_B, root: [0, -0.62, 0] }, { t: 0.5, p: { ...DOZE_B, spine: [24, 0, 0], head: [26, 0, 0] } }, { t: 1, p: DOZE_B }] });
// each job: its loop, an occasional second clip (and how often), the barks, and a hand tool
const JOBS = {
  smith: { clip: SMITHING, tool: 'hammer', lines: ['Mind the sparks, friend.', 'Iron is honest. Heat it right and it does what you ask.', 'Shut the door behind you. The draught cools the fire.'] },
  baker: { clip: KNEADING, alt: PEELING, altP: 0.25, lines: ['Fresh loaves on the shelf, still warm.', 'Flour gets into everything. Everything.', 'The oven is hot. Stand back a step.'] },
  weaver: { clip: WEAVING, lines: ['Careful of the threads on the floor.', 'Another bolt by sundown, if the shuttle runs true.', 'Blue for the harbour men, brown for the farmers.'] },
  clerk: { clip: WRITING, lines: ['One moment, I have lost my place.', 'Every sack counted twice. That is the rule.', 'Ink, sand, blot. Ink, sand, blot.'] },
  carpenter: { clip: PLANING, alt: SAWING, altP: 0.3, lines: ['Watch the shavings, they are slippery.', 'Measure twice, cut once.', 'Good oak, this. Seasoned three winters.'] },
  elder: { clip: ELDERLY, seated: true, lines: ['Sit a while. The fire is warm.', 'In my day the roads were quieter.', 'Wipe your boots, young one.'] },
  cook: { clip: STIRRING, alt: TASTING, altP: 0.25, lines: ['Supper is not ready yet. Soon.', 'A pinch more salt, I think.', 'Mind the pot, it is hot.'] },
  cooper: { clip: COOPERING, tool: 'hammer', lines: ['Tight hoops make a dry barrel.', 'Grain, water, flour. A good barrel keeps them all.', 'Hear that ring? A sound stave.'] },
};
// who works in which house: [site id, spot, job, villager look]. Spot 0 belongs to the server NPC where a house has one
// (sv_c2 Tomas, sv_c5 Hamid, sv_c8 Wynn, sv_c9 Aldous, sv_lodge Corwin, bf_farm Gil, wf_farm Hadley, hm_2 Anwar,
// hm_shop Dawud); spots 2 (sit) and 3 (bed) of the 'home' houses are kept for the townsfolk who go home at night,
// except where an elder sits by the fire. The homestead lodge is the player's own and stays empty.
const INDOOR = [
  // Sunmere Village
  ['sv_c1', 1, 'cook', 3], ['sv_c2', 1, 'weaver', 5], ['sv_c3', 2, 'elder', 2], ['sv_c4', 1, 'carpenter', 6], ['sv_c4', 4, 'cook', 1],
  ['sv_c5', 1, 'baker', 4], ['sv_c6', 1, 'clerk', 7], ['sv_c6', 5, 'cook', 0], ['sv_c7', 1, 'cook', 5], ['sv_c8', 1, 'cooper', 2],
  ['sv_c9', 1, 'clerk', 6], ['sv_lodge', 1, 'carpenter', 4],
  // the farms
  ['bf_farm', 1, 'cook', 7], ['wf_farm', 1, 'cook', 3], ['wf_farm', 5, 'carpenter', 0],
  // Ledgerholm
  ['lh_1', 1, 'clerk', 1], ['lh_1', 5, 'cook', 4], ['lh_2', 0, 'clerk', 2], ['lh_2', 1, 'clerk', 7], ['lh_3', 0, 'clerk', 5], ['lh_3', 1, 'cooper', 3],
  ['lh_4', 1, 'cook', 6], ['lh_4', 2, 'elder', 0],
  // Harrowmouth
  ['hm_1', 1, 'cook', 2], ['hm_2', 1, 'carpenter', 5], ['hm_3', 1, 'cooper', 1], ['hm_3', 2, 'elder', 6], ['hm_4', 1, 'cook', 4], ['hm_shop', 1, 'cooper', 7],
  // the island works: clerks, coopers and carpenters (and a smith at the Reach workshop)
  ['rc_office', 0, 'clerk', 3], ['rc_store', 1, 'cooper', 6], ['rc_bunk', 1, 'carpenter', 2], ['rc_shop', 1, 'smith', 5], ['rc_pump', 1, 'carpenter', 1],
  ['rm_office', 0, 'clerk', 4], ['rm_store', 1, 'cooper', 0], ['rm_bunk', 1, 'carpenter', 7], ['rm_shop', 0, 'carpenter', 3],
  ['wh_bunk', 1, 'carpenter', 6], ['wh_store', 1, 'cooper', 2], ['wh_house', 0, 'clerk', 5],
];
const INDOOR_NEAR = 40, BARK_R = 3.5, BARK_CD = 20, BARK_SHOW = 4.5;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function propCrate() {
  const b = new Builder(91);
  b.add(rbox(0.56, 0.42, 0.42, 0.02), 'woodLight', { uv: 'box', c: 0xffffff });
  for (const sy of [-1, 1]) b.add(box(0.6, 0.05, 0.05), 'woodDark', { p: [0, sy * 0.18, 0.2], c: 0xffffff });
  for (let k = 0; k < 4; k++) b.add(sphere(0.07, 8, 6), 'cloth', { p: [-0.18 + k * 0.12, 0.25, 0], c: ['#d84a3a', '#e8b030', '#8ac040', '#c86a2a'][k] });
  return b.build({ shadow: true });
}
function propSack() {
  const b = new Builder(92);
  b.add(lumpy(sphere(0.26, 10, 8), 0.06, 3, 4), 'cloth', { s: [1.1, 0.8, 0.9], uv: 'box', c: '#c8b088' });
  return b.build({ shadow: true });
}
function smithHammer() {
  const b = new Builder(93);
  b.add(cyl(0.02, 0.022, 0.42, 6), 'wood', { p: [0, 0.12, 0], c: 0xffffff });
  b.add(box(0.07, 0.07, 0.17), 'iron', { p: [0, 0.32, 0], c: '#9098a0' });
  const g = b.build({ shadow: false });
  g.rotation.x = PI / 2;
  return g;
}

// ---- village work: sweeping, hoeing the vegetable rows, fishing (props and loops)
const SWEEP = compileClip({ dur: 1.7, mask: 'upper', keys: [
  { t: 0, p: { spine: [16, -16, 0], armR: [-30, 0, -10], foreR: [-30, 0, 0], armL: [-52, 0, 20], foreL: [-48, 0, 0] } },
  { t: 0.5, p: { spine: [18, 16, 0], armR: [-40, 0, -6], foreR: [-22, 0, 0], armL: [-58, 0, 14], foreL: [-38, 0, 0] } },
  { t: 1, p: { spine: [16, -16, 0], armR: [-30, 0, -10], foreR: [-30, 0, 0], armL: [-52, 0, 20], foreL: [-48, 0, 0] } },
] });
const HOE = compileClip({ dur: 1.9, mask: 'upper', keys: [
  { t: 0, p: { spine: [22, 0, 0], armR: [-45, 0, -10], foreR: [-30, 0, 0], armL: [-50, 0, 14], foreL: [-40, 0, 0] } },
  { t: 0.45, p: { spine: [6, 0, 0], armR: [-115, 0, -10], foreR: [-40, 0, 0], armL: [-110, 0, 14], foreL: [-45, 0, 0] } },
  { t: 0.62, p: { spine: [26, 0, 0], armR: [-40, 0, -10], foreR: [-20, 0, 0], armL: [-45, 0, 14], foreL: [-30, 0, 0] }, e: 'snap' },
  { t: 1, p: { spine: [22, 0, 0], armR: [-45, 0, -10], foreR: [-30, 0, 0], armL: [-50, 0, 14], foreL: [-40, 0, 0] } },
] });
const FISH = HOLD({ armR: [-48, 0, -6], foreR: [-38, 0, 0], handR: [0, 0, 0], armL: [-40, 0, 22], foreL: [-55, 0, 0], spine: [4, 0, 0] });
const TUG = compileClip({ dur: 1.4, mask: 'upper', keys: [
  { t: 0, p: { armR: [-48, 0, -6], foreR: [-38, 0, 0], armL: [-40, 0, 22], foreL: [-55, 0, 0], spine: [4, 0, 0] } },
  { t: 0.35, p: { armR: [-80, 0, -6], foreR: [-58, 0, 0], armL: [-60, 0, 22], foreL: [-70, 0, 0], spine: [-6, 0, 0] } },
  { t: 1, p: { armR: [-48, 0, -6], foreR: [-38, 0, 0], armL: [-40, 0, 22], foreL: [-55, 0, 0], spine: [4, 0, 0] } },
] });
// tools are built along +y from the grip and turned like the weapons (x by 90 degrees)
function handTool(kind) {
  const b = new Builder(94);
  if (kind === 'broom') {
    b.add(cyl(0.022, 0.022, 1.45, 6), 'wood', { p: [0, -0.4, 0], c: '#b08a58' });
    b.add(cyl(0.05, 0.13, 0.42, 8), 'straw', { p: [0, -1.3, 0], c: '#d8b860' });
    b.add(torus(0.06, 0.012, 4, 10), 'leather', { p: [0, -1.11, 0], r: [PI / 2, 0, 0], c: '#6a4a2a' });
  } else if (kind === 'hoe') {
    b.add(cyl(0.022, 0.022, 1.5, 6), 'wood', { p: [0, 0.35, 0], c: '#b08a58' });
    b.add(box(0.2, 0.05, 0.16), 'iron', { p: [0, 1.08, 0.07], c: '#8890a0' });
  } else {
    b.add(cyl(0.026, 0.03, 0.4, 6), 'wood', { p: [0, 0.05, 0], c: '#8a6038' });
    b.add(cyl(0.008, 0.02, 2.4, 6), 'woodDark', { p: [0, 1.45, 0], c: '#5a4028' });
    b.add(torus(0.03, 0.008, 4, 8), 'iron', { p: [0.03, 0.2, 0], c: 0xffffff });
  }
  const g = b.build({ shadow: false });
  if (kind === 'rod') { const tip = new THREE.Object3D(); tip.position.set(0, 2.62, 0); g.add(tip); g.userData.tip = tip; }
  g.rotation.x = PI / 2;
  return g;
}
// a fishing line from the rod's tip to a float on the water (kept in the scene, re-hung every frame)
function fishLine(scene) {
  const b = new Builder(95);
  b.add(cyl(0.004, 0.004, 1, 3), 'leather', { p: [0, -0.5, 0], c: '#e8e4d8' });
  const line = b.build({ shadow: false });
  const fb = new Builder(96);
  fb.add(sphere(0.045, 8, 6), 'cloth', { p: [0, 0.02, 0], c: '#d84a3a' });
  fb.add(sphere(0.045, 8, 6, 0, PI * 2, 0, PI / 2), 'cloth', { p: [0, 0.03, 0], c: '#f2ece0' });
  const float = fb.build({ shadow: false });
  scene.add(line); scene.add(float);
  return { line, float };
}
// the nearest dry footing from a point on the water, walking outward along (dx, dz); returns [x, z, facing the water]
function shoreSpot(T, wx, wz, dx, dz, wy) {
  const L = Math.hypot(dx, dz); dx /= L; dz /= L;
  let x = wx, z = wz;
  for (let i = 0; i < 80 && T.height(x, z) < wy + 0.22; i++) { x += dx * 0.25; z += dz * 0.25; }
  return [x + dx * 0.45, z + dz * 0.45, Math.atan2(-dx, -dz)];
}

// ---------------------------------------------------------------- one villager, many behaviours
class Person {
  constructor(scene, terrain, kind, variant, o = {}) {
    this.T = terrain;
    this.o = o;
    this.char = buildCharacter(kind, variant);
    // v114: one draw a villager, tools in hand included (charMerge.js), done at the first pose: the tools are handed out
    // after the villager is made
    this.mergeKey = mergeOn() ? kind + ':' + variant : null;
    this.anim = new Animator(this.char, kind);
    this.root = new THREE.Group();
    this.root.add(this.char);
    this.root.updateMatrixWorld = rootUpdateMatrixWorld;
    this.char.updateMatrixWorld = charUpdateMatrixWorld;
    this.poseAcc = Math.random() * 0.06; this.thinkAcc = Math.random() * 0.1; this.cf = Math.floor(Math.random() * 3);
    this.scale = o.scale || 1;
    this.char.scale.setScalar(this.scale);
    this.root.userData.coarse = 3.5 * this.scale; // engine/coarse.js
    scene.add(this.root);
    const s = o.at || pick(o.spots || SPOTS.village);
    this.pos = new THREE.Vector3(s[0] + (o.at ? 0 : r(-1, 1)), 0, s[1] + (o.at ? 0 : r(-1, 1)));
    this.ry = this.ryT = this.prevRy = o.face ?? r(0, PI * 2);
    this.speed = 0; this.moved = 0; this.goal = null; this.wait = r(0, 4); this.stuck = 0;
    this.walk = o.walk || r(1.15, 1.6);
    this.hold = null; // looping upper-body pose
    this.t = r(0, 10);
  }
  setGoal(x, z) { this.goal = new THREE.Vector3(x, 0, z); }
  face(x, z) { this.ryT = Math.atan2(x - this.pos.x, z - this.pos.z); }
  gesture(clip) { if (!this.anim.busy) this.anim.play(clip, { fadeIn: 0.25, fadeOut: 0.35 }); }
  // steer toward the goal (turn first, then walk), keep apart from others, slide round obstacles
  step(dt, world, others, player, wantSpeed = this.walk, arrive = 0.6) {
    let want = 0;
    if (this.goal) {
      const dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < arrive || this.stuck > 2.5) { this.goal = null; this.stuck = 0; this.arrived = true; }
      else { this.ryT = Math.atan2(dx, dz); want = wantSpeed * Math.min(1, d / 1.2 + 0.3); }
    }
    const dr = Math.atan2(Math.sin(this.ryT - this.ry), Math.cos(this.ryT - this.ry));
    this.ry += dr * Math.min(1, dt * (wantSpeed > 2.5 ? 7 : 4));
    this.speed += (want * Math.max(0, Math.cos(dr)) - this.speed) * Math.min(1, dt * 4);
    const before = _before.copy(this.pos);
    this.pos.x += Math.sin(this.ry) * this.speed * dt;
    this.pos.z += Math.cos(this.ry) * this.speed * dt;
    if (!this.o.ghost) {
      const rad = 0.45 * this.scale;
      const push = (o) => {
        if (o === this || o.o.ghost) return;
        const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d2 = dx * dx + dz * dz, rr = rad + 0.45 * o.scale;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); this.pos.x += (dx / d) * (rr - d) * 0.5; this.pos.z += (dz / d) * (rr - d) * 0.5; }
      };
      const grid = others.grid;
      if (grid) {
        // only the walkers in the 3x3 cells round this one (the grid holds the solid villagers active this frame)
        const cx = Math.floor(this.pos.x / CELL), cz = Math.floor(this.pos.z / CELL);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const c = grid.get((cx + i + 512) * 1024 + (cz + j + 512)); if (c) for (const o of c) push(o); }
      } else for (const o of others) push(o);
      // the player is never shoved aside, and never shoves: a walker who steps into them only loses the part of its
      // stride that heads into them (it slides round); the player's own move collides against us (Townsfolk.collide)
      if (player) {
        const rr = rad + 0.45, dx = this.pos.x - player.x, dz = this.pos.z - player.z, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr) {
          const bx = before.x - player.x, bz = before.z - player.z, bd = Math.hypot(bx, bz);
          if (bd > 1e-4) {
            const nx = bx / bd, nz = bz / bd, into = (this.pos.x - before.x) * nx + (this.pos.z - before.z) * nz;
            if (into < 0) { this.pos.x -= nx * into; this.pos.z -= nz * into; }
          }
        }
      }
      // walls and props: walkers move well under 2 m/s, so every third frame is enough (staggered across walkers);
      // faster movers (the tag game, a dash) and anyone pressed against something check every frame
      if (++this.cf >= 3 || this.speed > 2 || this.stuck > 0) { this.cf = 0; world.collide(this.pos, rad); }
    }
    this.moved = before.distanceTo(this.pos);
    if (want > 0 && this.moved < want * dt * 0.3) this.stuck += dt; else this.stuck = 0;
  }
  pose(dt) {
    if (this.mergeKey) { mergeCharacter(this.char, { share: true, shareKey: this.mergeKey }); this.mergeKey = null; }
    if (this.hold && !this.anim.busy) this.anim.play(this.hold, { fadeIn: 0.3, fadeOut: 0.01 });
    this.pos.y = this.T.walk(this.pos.x, this.pos.z);
    const turnRate = Math.atan2(Math.sin(this.ry - this.prevRy), Math.cos(this.ry - this.prevRy)) / Math.max(dt, 1e-4);
    this.prevRy = this.ry;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.ry;
    // children cover the same ground with shorter legs: drive the gait as if faster (moved: metres in the last think
    // step; mdt: how long that step was, when far walkers think at a lower rate than the frame)
    this.char.mwSkip = false;
    this.anim.update(dt, { speed: this.moved / Math.max(this.mdt || dt, 1e-4) / this.scale, turnRate, combat: !!this.combat });
    this.anim.consumeTravel();
    // a head turn on top of whatever the clip does (indoor folk look at a player who comes close)
    if (this.lookT !== undefined) {
      this.look = (this.look || 0) + (this.lookT - (this.look || 0)) * Math.min(1, dt * 5);
      const B = this.char.userData.bones;
      if (Math.abs(this.look) > 1e-3 && B.head) { B.head.rotation.y += this.look * 0.6; if (B.neck) B.neck.rotation.y += this.look * 0.3; OBJ_UMW.call(B.neck || B.head, true); }
    }
    if (this.char.userData.bow) { updateBowString(this.char); this.char.userData.bow.updateMatrixWorld(true); }
    this.char.mwSkip = true; // the rig is fresh: the scene walk need not redo it this frame
  }
}

// ---------------------------------------------------------------- handcart caravan
function handcart(seed) {
  const b = new Builder(seed);
  b.add(rbox(1.3, 0.12, 2.0, 0.03), 'wood', { p: [0, 0.62, 0], uv: 'box', c: '#b08858' });
  for (const sx of [-1, 1]) b.add(box(0.08, 0.36, 2.0), 'wood', { p: [sx * 0.62, 0.84, 0], uv: 'box', c: '#a07848' });
  for (const sz of [-1, 1]) b.add(box(1.3, 0.36, 0.08), 'wood', { p: [0, 0.84, sz * 0.98], uv: 'box', c: '#a07848' });
  for (const sx of [-1, 1]) b.add(cyl(0.035, 0.035, 1.1, 6), 'woodDark', { p: [sx * 0.42, 0.72, -1.45], r: [PI / 2 - 0.25, 0, 0], c: 0xffffff });
  b.add(cyl(0.03, 0.03, 0.95, 6), 'woodDark', { p: [0, 0.6, -1.95], r: [0, 0, PI / 2], c: 0xffffff });
  b.add(cyl(0.04, 0.04, 1.5, 8), 'iron', { p: [0, 0.45, 0.1], r: [0, 0, PI / 2], c: 0xffffff });
  // cargo
  const kind = seed % 3;
  if (kind === 0) for (let i = 0; i < 4; i++) { b.add(rbox(0.5, 0.42, 0.5, 0.02), 'woodLight', { p: [-0.28 + (i % 2) * 0.56, 0.9, -0.5 + Math.floor(i / 2) * 0.62], uv: 'box', c: 0xffffff }); }
  else if (kind === 1) for (let i = 0; i < 5; i++) b.add(lumpy(sphere(0.3, 10, 8), 0.06, 3, i), 'cloth', { p: [-0.3 + (i % 2) * 0.6, 0.92 + (i > 3 ? 0.3 : 0), -0.6 + i * 0.3], s: [1.1, 0.75, 0.9], uv: 'box', c: '#c8b088' });
  else {
    for (let i = 0; i < 3; i++) b.add(lathe([[0.001, 0], [0.24, 0], [0.28, 0.22], [0.28, 0.4], [0.24, 0.62], [0.001, 0.62]], 12), 'wood', { p: [0, 0.68, -0.62 + i * 0.62], r: [0, 0, PI / 2], uv: 'box', c: 0xffffff });
    b.add(box(1.36, 0.04, 2.1), 'canopyBlue', { p: [0, 1.45, 0], uv: 'box', c: 0xffffff });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(cyl(0.025, 0.025, 0.7, 6), 'woodDark', { p: [sx * 0.62, 1.1, sz * 0.95], c: 0xffffff });
  }
  const g = b.build({ shadow: true });
  // wheels turn as the cart rolls
  const wheels = [];
  for (const sx of [-1, 1]) {
    const wb = new Builder(seed + 5);
    // a solid plank disc with an iron tyre and a hub (no spokes)
    wb.add(cyl(0.44, 0.44, 0.08, 20), 'wood', { r: [0, 0, PI / 2], c: '#9a7048' });
    wb.add(torus(0.44, 0.03, 5, 20), 'iron', { r: [0, PI / 2, 0], c: 0xffffff });
    wb.add(cyl(0.11, 0.11, 0.16, 10), 'wood', { r: [0, 0, PI / 2], c: '#7a5030' });
    for (const y of [-0.2, 0.2]) wb.add(box(0.1, 0.03, 0.78), 'wood', { p: [0, y, 0], c: '#8a6038' });
    const w = wb.build({ shadow: true });
    w.position.set(sx * 0.74, 0.45, 0.1);
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

class Caravan {
  constructor(scene, terrain, route) {
    this.T = terrain;
    this.route = route.map(([x, z]) => new THREE.Vector2(x, z));
    this.cum = [0];
    for (let i = 1; i < this.route.length; i++) this.cum.push(this.cum[i - 1] + this.route[i].distanceTo(this.route[i - 1]));
    this.len = this.cum[this.cum.length - 1];
    this.d = 20; this.dir = 1; this.pause = 3; this.speed = 1.25; this.gap = 6.5;
    // (v116: a parked cart, at either end of the route, is a still shadow switch: engine/shadowCache.js caches it)
    this.carts = [0, 1, 2].map((i) => { const c = handcart(120 + i); c.userData.shadowSwitch = true; c.userData.shadowStill = false; scene.add(c); return c; });
    this.porters = [0, 1, 2].map((i) => new Person(scene, terrain, 'villager', i + 3, { ghost: true, at: [0, 60] }));
    this.porters.forEach((p) => { p.hold = PUSH; });
    this.escort = [0, 1].map(() => new Person(scene, terrain, 'knight', 0, { ghost: true, at: [0, 60] }));
  }
  at(d) {
    d = Math.max(0, Math.min(this.len, d));
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < d) i++;
    const a = this.route[i - 1], b = this.route[i], t = (d - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1] || 1);
    const p = a.clone().lerp(b, t), dirv = b.clone().sub(a).normalize();
    return { x: p.x, z: p.y, dx: dirv.x, dz: dirv.y };
  }
  update(dt, near) {
    let moving = 0;
    if (this.pause > 0) this.pause -= dt;
    else {
      this.d += this.dir * this.speed * dt; moving = this.speed;
      // at either end the train turns round: the last cart becomes the lead, so nobody piles up
      if ((this.dir > 0 && this.d >= this.len - 1) || (this.dir < 0 && this.d <= 16)) {
        this.d -= this.dir * this.gap * 2;
        this.dir = -this.dir;
        this.carts.reverse(); this.porters.reverse();
        this.pause = r(8, 14);
      }
    }
    const lead = this.d;
    this.carts.forEach((c, i) => {
      const dc = lead - this.dir * i * this.gap;
      const p = this.at(dc), face = Math.atan2(p.dx * this.dir, p.dz * this.dir);
      c.visible = near;
      c.position.set(p.x, this.T.walk(p.x, p.z), p.z);
      let df = face - c.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
      c.rotation.y += df * Math.min(1, dt * 3);
      for (const w of c.userData.wheels) w.rotation.x += (moving * dt) / 0.45;
      // (parked and turned round: snap the last of the turn, so the cart stands exactly still and its cached shadow holds)
      if (!moving && Math.abs(df) < 2e-3) { c.rotation.y += df * (1 - Math.min(1, dt * 3)); c.userData.shadowStill = true; } else c.userData.shadowStill = false;
      // the porter walks between the handles, behind the cart
      const po = this.porters[i];
      const bx = p.x - Math.sin(c.rotation.y) * 2.25, bz = p.z - Math.cos(c.rotation.y) * 2.25;
      po.moved = Math.hypot(bx - po.pos.x, bz - po.pos.z);
      po.pos.set(bx, 0, bz); po.ry = c.rotation.y;
      po.root.visible = near;
      if (near) po.pose(dt);
    });
    const p0 = this.at(lead + this.dir * 2.2);
    this.escort.forEach((e, k) => {
      const side = k ? 1 : -1, face = Math.atan2(p0.dx * this.dir, p0.dz * this.dir);
      const ex = p0.x + Math.cos(face) * side * 1.7 - Math.sin(face) * k * 9.5, ez = p0.z - Math.sin(face) * side * 1.7 - Math.cos(face) * k * 9.5;
      e.moved = Math.hypot(ex - e.pos.x, ez - e.pos.z);
      e.pos.set(ex, 0, ez); e.ry = face;
      e.root.visible = near;
      if (near) e.pose(dt);
    });
  }
}

// ---------------------------------------------------------------- the village
export class Townsfolk {
  constructor(scene, world, { fx = null, sfx = null } = {}) {
    this.world = world; this.fx = fx; this.sfx = sfx; this.scene = scene;
    const T = world.terrain;
    this.list = [];
    const add = (kind, v, o) => { const p = new Person(scene, T, kind, v, o); this.list.push(p); return p; };
    // strollers; a few carry crates or sacks between the market and the houses
    for (let i = 0; i < 9; i++) add('villager', i, { role: 'stroll', spots: SPOTS.village });
    for (let i = 0; i < 4; i++) add('villager', i + 2, { role: 'stroll', spots: SPOTS.south });
    for (let i = 0; i < 3; i++) add('villager', i + 1, { role: 'stroll', spots: SPOTS.farm });
    for (let i = 0; i < 3; i++) {
      const p = add('villager', i + 4, { role: 'stroll', spots: SPOTS.village, walk: 1.05 });
      p.hold = CARRY;
      const prop = i % 2 ? propSack() : propCrate();
      prop.position.set(0, 1.12, 0.36);
      p.char.add(prop);
    }
    // market: keepers behind five counters (Idris keeps the sixth) and customers going stall to stall
    STALLS.forEach((s, i) => { if (i === 1) return; const [x, z] = front(s, -0.55); add('villager', i + 6, { role: 'keeper', at: [x, z], face: s[2] }); });
    for (let i = 0; i < 6; i++) add('villager', i + 1, { role: 'customer', spots: [[3, 18], [-3, 20]] });
    // boys playing tag round the plaza
    this.kids = [];
    for (let i = 0; i < 4; i++) this.kids.push(add('villager', i, { role: 'kid', scale: 0.62, spots: SPOTS.play, walk: 3.6 }));
    for (let i = 0; i < 4; i += 2) { this.kids[i].partner = this.kids[i + 1]; this.kids[i + 1].partner = this.kids[i]; this.kids[i].it = true; }
    // readers at the notice board
    [[-6.8, -14.4], [-5.0, -14.7]].forEach(([x, z], i) => add('villager', i + 1, { role: 'reader', at: [x, z], face: PI + 0.15 }));
    // guards: two patrol the plaza, six stand posted
    add('knight', 0, { role: 'patrol', ring: [0, 0, 11.6, 1], walk: 1.2 });
    add('knight', 0, { role: 'patrol', ring: [0, 0, 11.6, -1], walk: 1.2 });
    for (const st of [[-3.0, -32.2, 0], [3.0, -32.2, 0], [-2.5, -35.0, 0], [2.5, -35.0, 0], [-3.2, 44.6, 0], [3.2, 44.6, 0]]) add('knight', 0, { role: 'post', at: [st[0], st[1]], face: st[2], ghost: true });
    // sparring ring by the forge with onlookers
    const ring = { x: -29.5, z: -10.5 };
    this.ring = ring;
    const f1 = add('knight', 0, { role: 'spar', at: [ring.x - 1.3, ring.z], ghost: true });
    const f2 = add('sandblade', 0, { role: 'spar', at: [ring.x + 1.3, ring.z], ghost: true });
    f1.foe = f2; f2.foe = f1; f1.lead = true; f1.combat = f2.combat = true;
    for (const [dx, dz, v] of [[-3.6, 2.6, 2], [3.4, 2.8, 4], [0.2, 3.6, 7]]) add('villager', v, { role: 'cheer', at: [ring.x + dx, ring.z + dz], face: Math.atan2(-dx, -dz) });
    // archer at the range
    add('ranger', 0, { role: 'archer', at: [-27.4, -39.4], face: PI, ghost: true, target: new THREE.Vector3(-27.4, 0, -47.0) });
    // v108: Deadeyes of the watch, pistols in hand: a pair drilling close-quarters grip strikes (pistol butts, no shots)
    // by Oswin Harl's range, one posted at the range and two at the north gate beside the knights
    { const pit = { x: DEADEYE_PIT[0], z: DEADEYE_PIT[1] };
      const d1 = add('deadeye', 1, { role: 'spar', pit, at: [pit.x - 1.2, pit.z], ghost: true }), d2 = add('deadeye', 2, { role: 'spar', pit, at: [pit.x + 1.2, pit.z], ghost: true });
      d1.foe = d2; d2.foe = d1; d1.lead = true; d1.combat = d2.combat = true; }
    for (const [x, z, f, v] of DEADEYE_POSTS) add('deadeye', v, { role: 'post', at: [x, z], face: f, ghost: true });
    // apprentice at the forge anvil
    const smith = add('villager', 5, { role: 'smith', at: [-41.2, -6.5], face: PI + 0.12, ghost: true });
    const ham = smithHammer(); smith.char.userData.bones.weaponR.add(ham);
    smith.anvil = new THREE.Vector3(-41.26, 0, -7.38);
    // caravan between the gate, the market and the farms
    this.caravan = new Caravan(scene, T, [[0, 62], [0, 44], [0, 30], [0, 18], [6, 15.5], [12.5, 11], [16.5, 6], [19, 1.6], [40, 4], [70, 10], [96, 12]]);
    // the outposts: guards on post and on rounds, workers and travellers about the camps
    for (const [x, z, f] of [[-96, -104, 0.6], [-112, -118, 2.6], [-90, -114, 1.2]]) add('knight', 0, { role: 'post', at: [x, z], face: f, ghost: true });
    add('warden', 0, { role: 'patrol', ring: [-104, -110, 9.5, 1], walk: 1.1 });
    for (let i = 0; i < 3; i++) add('villager', i + 1, { role: 'stroll', spots: [[-100, -106], [-108, -112], [-104, -102], [-99, -115], [-110, -106]] });
    for (const [x, z, f] of [[-28, 178, 1.0], [-52, 162, -2.2], [-46, 180, 0.4]]) add('sandblade', 0, { role: 'post', at: [x, z], face: f, ghost: true });
    add('sandblade', 0, { role: 'patrol', ring: [-40, 170, 11, -1], walk: 1.1 });
    for (let i = 0; i < 3; i++) add('villager', i + 3, { role: 'stroll', spots: [[-44, 166], [-36, 176], [-32, 166], [-46, 176], [-40, 160]] });
    for (let i = 0; i < 3; i++) add('villager', i, { role: 'stroll', spots: [[168, -24], [176, -34], [171, -38], [178, -21], [165, -30]] });
    add('warden', 0, { role: 'post', at: [180.5, -33], face: 1.57, ghost: true });
    for (let i = 0; i < 2; i++) add('villager', i + 1, { role: 'stroll', spots: [[178, 134], [186, 142], [176, 146], [190, 136]] });
    add('sandblade', 0, { role: 'post', at: [188, 132], face: -0.6, ghost: true });
    for (let i = 0; i < 2; i++) add('villager', i + 4, { role: 'stroll', spots: [[-136, 190], [-128, 196], [-134, 200], [-126, 188]] });
    add('ranger', 0, { role: 'post', at: [168, -118], face: 1.2, ghost: true });
    // Highreach Lookout: wardens at the gates and on rounds, porters hauling up the climb, an engineer's helper at the tents
    for (const [x, z, f] of [[96.5, -207, -1.4], [120, -209, 1.6], [108, -222.5, 3.1]]) add('warden', 0, { role: 'post', at: [x, z], face: f, ghost: true });
    add('knight', 0, { role: 'patrol', ring: [108, -210, 9, 1], walk: 1.05 });
    // Ashfall Landing on the Cinder Reach: camp hands about the square, a warden at the tower, a docker on the pier
    for (let i = 0; i < 3; i++) add('villager', i + 2, { role: 'stroll', spots: [[458, -1196], [468, -1196], [456, -1209], [470, -1209], [463, -1193]] });
    add('warden', 0, { role: 'post', at: [478.5, -1210.6], face: 0.2, ghost: true });
    add('warden', 0, { role: 'patrol', ring: [463, -1200, 13, -1], walk: 1.0 });
    add('villager', 6, { role: 'post', at: [420, -1198.4], face: -1.4, ghost: true });
    // the Icefall Landing on the Rime Steps: hands about the camp square, a warden at the watchtower and one on rounds, a
    // docker on the pier
    for (let i = 0; i < 3; i++) add('villager', i + 3, { role: 'stroll', spots: [[452, -1646], [464, -1646], [455, -1656], [465, -1655], [460, -1643]] });
    add('warden', 0, { role: 'post', at: [470.2, -1655.4], face: -2.2, ghost: true });
    add('warden', 0, { role: 'patrol', ring: [458, -1650, 12.5, 1], walk: 1.0 });
    add('villager', 1, { role: 'post', at: [420, -1648.4], face: -1.4, ghost: true });
    for (let i = 0; i < 3; i++) add('villager', i + 2, { role: 'stroll', spots: [[104, -206], [112, -212], [101, -213], [115, -205], [107, -216]] });
    // the Windward Camp on the Heights: hands about the camp square (one carrying a crate from the store), a warden at the gap
    // in the wind wall where the road comes in from the lift, and one on rounds inside the wall
    for (let i = 0; i < 2; i++) add('villager', i + 5, { role: 'stroll', spots: [[451.5, -2101.5], [458.5, -2103.5], [457, -2092.5], [465.5, -2099.5], [455, -2097.5]] });
    { const p = add('villager', 7, { role: 'stroll', spots: [[468.5, -2110], [459, -2101], [446.5, -2084.5], [465, -2098]], walk: 1.0 }); p.hold = CARRY; const c = propCrate(); c.position.set(0, 1.12, 0.36); p.char.add(c); }
    add('warden', 0, { role: 'post', at: [437.6, -2096.8], face: -1.4, ghost: true });
    add('warden', 0, { role: 'patrol', ring: [456, -2100, 13.5, -1], walk: 1.0 });
    // (more of the crew: one sweeping the blown snow off the yard's slabs, two talking by the north tent over the day's
    // list, and one carrying sacks between the store and the tent by the south wall)
    { const p = add('villager', 3, { role: 'sweep', home: [458.5, -2101.5], spots: [[458.5, -2101.5]], walk: 0.55 }); p.char.userData.bones.weaponR.add(handTool('broom')); }
    { const a = add('villager', 8, { role: 'chat', at: [461.2, -2112.8], face: Math.atan2(1.4, 0.9) }), b = add('villager', 2, { role: 'chat', at: [462.6, -2111.9], face: Math.atan2(-1.4, -0.9) }); a.partner = b; b.partner = a; a.speaker = true; }
    { const p = add('villager', 4, { role: 'stroll', spots: [[453.5, -2086.5], [466, -2104], [460, -2094]], walk: 1.0 }); p.hold = CARRY; const s = propSack(); s.position.set(0, 1.12, 0.36); p.char.add(s); }
    // the Tidewrights' camp on Tidewater Sound: hands about the square, one carrying a hank from the ropewalk, two laying rope
    // (walking the length of the ropewalk and back), a man sweeping the quay, two talking by the tar yards, a docker posted on
    // the quay, one carrying sacks from the quay up to the huts
    for (let i = 0; i < 2; i++) add('villager', i + 2, { role: 'stroll', spots: [[466, -2590], [474, -2597], [470, -2585], [462, -2595], [477, -2590]] });
    { const p = add('villager', 5, { role: 'stroll', spots: [[490, -2627.5], [468, -2603], [478, -2596]], walk: 1.0 }); p.hold = CARRY; const c = propSack(); c.position.set(0, 1.12, 0.36); p.char.add(c); }
    for (let i = 0; i < 2; i++) add('villager', i + 6, { role: 'stroll', spots: [[412 + i * 3, -2626.5 + i], [492 - i * 4, -2626.5 + i]], walk: 0.7 });
    { const p = add('villager', 4, { role: 'sweep', home: [470, -2569], spots: [[470, -2569]], walk: 0.55 }); p.char.userData.bones.weaponR.add(handTool('broom')); }
    { const a2 = add('villager', 8, { role: 'chat', at: [441.5, -2583.5], face: Math.atan2(1.4, -0.9) }), b2 = add('villager', 1, { role: 'chat', at: [442.9, -2584.4], face: Math.atan2(-1.4, 0.9) }); a2.partner = b2; b2.partner = a2; a2.speaker = true; }
    add('villager', 3, { role: 'post', at: [488, -2566], face: PI, ghost: true });
    { const p = add('villager', 7, { role: 'stroll', spots: [[482, -2571], [472, -2588], [484, -2592]], walk: 1.0 }); p.hold = CARRY; const c = propCrate(); c.position.set(0, 1.12, 0.36); p.char.add(c); }
    // (dressing pass) more Tidewrights at work: one drawing rope through the tarring trough with a scraper and one sweeping
    // the tar yard, one turning the ropewalk's jack and a third laying rope down the walk, a sawyer at each mill's frame saw,
    // a man carrying from the second mill's log pile to its door, two talking in the first mill's yard
    { const p = add('villager', 2, { role: 'hoe', at: [431, -2583.2], face: PI, ghost: true }); p.char.userData.bones.weaponR.add(handTool('hoe')); }
    { const p = add('villager', 6, { role: 'sweep', home: [436, -2591], spots: [[436, -2591]], walk: 0.55 }); p.char.userData.bones.weaponR.add(handTool('broom')); }
    add('villager', 0, { role: 'hoe', at: [409.6, -2627.4], face: -PI / 2, ghost: true });
    add('villager', 3, { role: 'stroll', spots: [[416, -2627], [452, -2627.5], [486, -2627]], walk: 0.7 });
    for (const [x, z, v] of [[530.6, -2605.5, 5], [576.6, -2608.5, 8]]) add('villager', v, { role: 'hoe', at: [x, z], face: -PI / 2, ghost: true });
    { const p = add('villager', 1, { role: 'stroll', spots: [[581, -2606.5], [582, -2603.5], [587.5, -2596]], walk: 1.0 }); p.hold = CARRY; const c = propCrate(); c.position.set(0, 1.12, 0.36); p.char.add(c); }
    { const a3 = add('villager', 4, { role: 'chat', at: [544, -2593], face: Math.atan2(1.3, -0.8) }), b3 = add('villager', 7, { role: 'chat', at: [545.3, -2593.8], face: Math.atan2(-1.3, 0.8) }); a3.partner = b3; b3.partner = a3; a3.speaker = true; }
    this.addVillageWork(add, scene, T);
    this.addIndoor(add);
    this.arrows = [];
    this.frustum = new THREE.Frustum();
    this.m4 = new THREE.Matrix4();
  }

  update(dt, focus, camera, night = 0) {
    this._player = focus;
    if (camera) { this.m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.m4); }
    const sphere = this.sphere || (this.sphere = new THREE.Sphere(new THREE.Vector3(), 2.2));
    this.clock = (this.clock || 0) + dt;
    // this frame's avoidance grid: the solid villagers who were about last frame
    const grid = this.grid || (this.grid = new Map());
    for (const c of grid.values()) c.length = 0;
    for (const p of this.list) if (p.active && !p.o.ghost) { const k = cellKey(p.pos.x, p.pos.z); let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(p); }
    this.list.grid = grid;
    // indoor folk are built the first time the player comes near their house (most players never see most of them)
    if ((this.pendT = (this.pendT || 0) - dt) <= 0 && this.pending?.length) {
      this.pendT = 0.5;
      for (let k = this.pending.length - 1; k >= 0; k--) {
        const q = this.pending[k];
        if (Math.hypot(focus.x - q.S.x, focus.z - q.S.z) < INDOOR_NEAR + 15) { this.pending.splice(k, 1); this.makeIndoor(q); }
      }
    }
    const TF_LOD = GFX.mobile ? TF_LOD_MOB : TF_LOD_DESK;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      // after dark the children and shoppers go home and half the strollers turn in: those with a home house sit or doze
      // at its sit / bed spot (shown only near the house); the rest simply vanish as before
      const r0 = p.o.role;
      p.active = false;
      const away = night > 0.6 && (r0 === 'kid' || r0 === 'customer' || r0 === 'reader' || r0 === 'sweep' || r0 === 'hoe' || (r0 === 'stroll' && i % 2));
      if (away && !p.home) { p.root.visible = false; continue; }
      if (away && !p.atHome) this.goHome(p);
      else if (!away && p.atHome) this.leaveHome(p);
      const H = p.atHome ? p.home.S : p.S;
      const near = H ? (focus.x - H.x) ** 2 + (focus.z - H.z) ** 2 < INDOOR_NEAR * INDOOR_NEAR : p.pos.distanceToSquared(focus) < 95 * 95;
      if (p.bubble && !near) this.dropBubble(p);
      p.t += dt;
      if (p.fl) p.fl.line.visible = p.fl.float.visible = near;
      if (!near) { p.root.visible = false; continue; }
      p.active = true;
      const dd = p.pos.distanceToSquared(focus), far = dd > TF_LOD.NEAR * TF_LOD.NEAR;
      // sun shadows within QUALITY.charShadowDist of you, as for every other character (entities.js charShadowDist)
      { const sd = GFX.charShadowDist ?? (GFX.mobile ? 20 : 45), cs = p.castOn !== false ? dd < (sd + 2) * (sd + 2) : dd < (sd - 2) * (sd - 2);
        if (cs !== (p.castOn !== false)) { p.castOn = cs; p.root.traverse((o) => { if (!o.isMesh) return; if (cs) { if (o.userData.csOff) { o.castShadow = true; o.userData.csOff = false; } } else if (o.castShadow) { o.castShadow = false; o.userData.csOff = true; } }); } }
      // far walkers think (and so move) at 10 Hz
      const slowThink = far && r0 !== 'kid' && r0 !== 'spar' && !p.anim.busy;
      p.thinkAcc += dt;
      if (!slowThink || p.thinkAcc >= 1 / TF_LOD.THINK_HZ) { const td = Math.min(p.thinkAcc, 0.25); p.thinkAcc = 0; this.think(p, td); p.mdt = td; }
      sphere.center.copy(p.pos).setY(p.pos.y + 1);
      // (QUALITY.viewDist: the phones draw villagers out to a shorter distance; past it they keep walking unseen)
      const seen = (!camera || this.frustum.intersectsSphere(sphere)) && !(GFX.viewDist && dd > GFX.viewDist * GFX.viewDist);
      p.root.visible = seen;
      // movement always advances; the skeleton is only posed when it can be seen, at a rate set by its distance
      p.poseAcc += dt;
      const lod = dd < TF_LOD.FULL * TF_LOD.FULL ? 0 : far ? 2 : 1, hz = lod === 0 || p.anim.busy ? 0 : lod === 1 ? TF_LOD.NEAR_HZ : TF_LOD.FAR_HZ;
      if (seen && (hz === 0 || p.poseAcc >= 1 / hz - 1e-4)) { p.anim.lod = lod; const pd = Math.min(p.poseAcc, 0.5); p.poseAcc = 0; p.pose(pd); }
      else { p.pos.y = p.T.walk(p.pos.x, p.pos.z); p.root.position.copy(p.pos); p.root.rotation.y = p.ry; if (!seen) p.poseAcc = Math.min(p.poseAcc, 0.5); else p.char.mwLight = true; }
    }
    this.updateBubbles(dt, camera);
    this.caravan.update(dt, this.caravan.carts[0].position.distanceToSquared(focus) < 110 * 110);
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.t += dt;
      if (a.t < a.fly) { const k = a.t / a.fly; a.mesh.position.lerpVectors(a.from, a.to, k); a.mesh.position.y += Math.sin(k * PI) * 0.25; }
      else if (a.t > a.fly + 7) { this.scene.remove(a.mesh); this.arrows.splice(i, 1); }
    }
  }

  think(p, dt) {
    const W = this.world, others = this.list, player = this._player;
    const role = p.o.role;
    if (p.atHome) { p.ryT = p.home.sp.ry; p.step(dt, W, others, player); return; }
    if (role === 'indoor') return this.thinkIndoor(p, dt);
    if (this.thinkWork(p, dt, role)) return;
    if (role === 'stroll' || role === 'customer') {
      if (p.goal) { p.step(dt, W, others, player); if (p.arrived) { p.arrived = false; p.wait = role === 'customer' ? r(9, 18) : r(2.5, 8); if (p.stall) p.face(p.stall[0], p.stall[1]); } return; }
      if (p.wait > 0) {
        p.wait -= dt;
        if (role === 'customer' && p.stall && Math.random() < dt * 0.35) p.gesture(Math.random() < 0.7 ? TALK : NOD);
        else if (Math.random() < dt * 0.25) p.ryT = p.ry + r(-1.2, 1.2);
        p.step(dt, W, others, player);
        if (p.wait <= 0) {
          if (role === 'customer') {
            const s = pick(STALLS); const [x, z] = front(s, 1.9 + r(0, 0.5)); p.stall = [s[0], s[1]];
            p.setGoal(x + r(-0.5, 0.5), z + r(-0.5, 0.5));
          } else {
            const near = p.o.spots.filter((s) => { const d = Math.hypot(s[0] - p.pos.x, s[1] - p.pos.z); return d > 4 && d < 24; });
            const s = pick(near.length ? near : p.o.spots);
            p.setGoal(s[0] + r(-1.5, 1.5), s[1] + r(-1.5, 1.5));
          }
        }
        return;
      }
      p.wait = r(0.5, 2); p.step(dt, W, others, player); return;
    }
    if (role === 'keeper') {
      p.ryT = p.o.face;
      // answer nearby customers
      if (Math.random() < dt * 0.22) p.gesture(Math.random() < 0.65 ? TALK : NOD);
      p.step(dt, W, others, player); return;
    }
    if (role === 'reader') {
      p.ryT = p.o.face + Math.sin(p.t * 0.4) * 0.15;
      if (Math.random() < dt * 0.12) p.gesture(NOD);
      p.step(dt, W, others, player); return;
    }
    if (role === 'kid') {
      // tag: whoever is "it" chases the partner, who runs to open spots; a tag swaps them
      const q = p.partner;
      if (p.it) {
        p.setGoal(q.pos.x, q.pos.z);
        p.step(dt, W, others, player, 3.9, 0.9);
        if (p.pos.distanceTo(q.pos) < 1.0 && (p.cool || 0) <= 0) { p.it = false; q.it = true; q.cool = 1.6; p.goal = null; }
        p.cool = Math.max(0, (p.cool || 0) - dt);
      } else {
        p.cool = Math.max(0, (p.cool || 0) - dt);
        if (!p.goal || p.arrived) {
          p.arrived = false;
          // run to the open spot farthest from the chaser
          let best = null, bd = -1;
          for (const s of SPOTS.play) { const d = Math.hypot(s[0] - q.pos.x, s[1] - q.pos.z) - Math.hypot(s[0] - p.pos.x, s[1] - p.pos.z) * 0.35; if (d > bd) { bd = d; best = s; } }
          p.setGoal(best[0] + r(-1, 1), best[1] + r(-1, 1));
        }
        p.step(dt, W, others, player, (p.cool > 0 ? 2.2 : 3.6), 1.0);
      }
      return;
    }
    if (role === 'patrol') {
      const [cx, cz, R, dir] = p.o.ring;
      p.pa = (p.pa ?? r(0, PI * 2)) + dir * (p.walk / R) * dt;
      p.setGoal(cx + Math.cos(p.pa) * R, cz + Math.sin(p.pa) * R);
      p.step(dt, W, others, player, p.walk, 0.05);
      return;
    }
    if (role === 'post') {
      if (Math.random() < dt * 0.15) p.ryT = p.o.face + r(-0.45, 0.45);
      if (Math.random() < dt * 0.3) p.ryT = p.o.face;
      p.step(dt, W, others, player); return;
    }
    if (role === 'cheer') {
      p.ryT = Math.atan2(this.ring.x - p.pos.x, this.ring.z - p.pos.z);
      if (Math.random() < dt * 0.3) p.gesture(Math.random() < 0.5 ? CHEER : NOD);
      p.step(dt, W, others, player); return;
    }
    if (role === 'spar') {
      // circle the ring facing each other; the leader calls the exchanges: one attacks, the other is driven back
      // (each pair its own ring: o.pit, else the ring by the forge; the clips by the attacker's class, SPAR_CLIPS)
      const f = p.foe, c = p.o.pit || this.ring;
      p.face(f.pos.x, f.pos.z);
      if (p.lead) {
        p.phase = (p.phase ?? 0) + dt * 0.35;
        const a = p.phase, R = 1.35;
        p.pos.x = c.x + Math.cos(a) * R; p.pos.z = c.z + Math.sin(a) * R;
        f.pos.x = c.x - Math.cos(a) * R; f.pos.z = c.z - Math.sin(a) * R;
        p.moved = f.moved = R * 0.35 * dt;
        p.next = (p.next ?? 1.5) - dt;
        if (p.next <= 0 && !p.anim.busy && !f.anim.busy) {
          const atk = Math.random() < 0.5 ? p : f, def = atk === p ? f : p;
          const clip = pick((SPAR_CLIPS[atk.char.userData.kind] || SPAR_CLIPS.knight).map((id) => CHOREO[id]).filter(Boolean));
          if (clip) {
            atk.anim.play(clip.clip, { fadeIn: 0.12 });
            const hitAt = (clip.clip.dur || 0.7) * 0.45;
            setTimeout(() => { def.anim.hit(1); if (this.sfx && this._player && def.pos.distanceTo(this._player) < 22) this.sfx.play(Math.random() < 0.5 ? 'hit' : 'swing', 0.35); }, hitAt * 1000);
          }
          p.next = r(1.4, 2.6);
        }
      }
      return;
    }
    if (role === 'archer') {
      p.ryT = p.o.face;
      p.next = (p.next ?? 2) - dt;
      if (p.next <= 0 && !p.anim.busy && CHOREO.r_quick) {
        p.anim.play(CHOREO.r_quick.clip, { fadeIn: 0.1, onEvent: (ev) => {
          if (ev.e === 'bowstring') p.char.userData.bowPull = ev.pull;
          if (ev.e === 'proj') this.shootArrow(p);
        } });
        p.next = r(3, 5);
      }
      p.step(dt, W, others, player); return;
    }
    if (role === 'smith') {
      p.ryT = p.o.face;
      if (!p.anim.busy) {
        p.anim.play(HAMMER, { fadeIn: 0.15, fadeOut: 0.05 });
        p.struck = false;
      }
      const act = p.anim.action;
      if (act && act.clip === HAMMER && !p.struck && act.time > HAMMER.dur * 0.56) {
        p.struck = true;
        const top = p.anvil.clone(); top.y = p.T.height(top.x, top.z) + 0.98;
        this.fx?.emit('sparks', top, { n: 9, color: '#ffb050', size: 0.8 });
        if (this.sfx && this._player && p.pos.distanceTo(this._player) < 20) this.sfx.play('hit', 0.18);
      }
      p.step(dt, W, others, player); return;
    }
  }

  // ---------------------------------------------------------------- inside the houses (shared/houses.js spots)
  // The indoor workers wait in this.pending until the player first comes near; the night homes are handed out now:
  // every townsperson who turns in after dark gets a free sit or bed spot in the nearest 'home' house within 90 m of
  // where he spends the day (none on the homestead, which is the player's own).
  addIndoor(add) {
    this.add = add;
    this.pending = [];
    const used = new Set();
    for (const [id, k, job, v] of INDOOR) {
      const S = houseSpec(id), sp = S?.spots[k];
      if (!S || !sp || !S.enter || !JOBS[job]) continue;
      used.add(id + ':' + k);
      this.pending.push({ S, k, sp, job, v });
    }
    const beds = [];
    for (const S of allHouses()) {
      if (!S.enter || S.role !== 'home' || S.group === 'homestead') continue;
      for (const k of [2, 3]) if (S.spots[k] && !used.has(S.id + ':' + k)) beds.push({ S, k, sp: S.spots[k], taken: false });
    }
    this.list.forEach((p, i) => {
      const r0 = p.o.role;
      if (!(r0 === 'kid' || r0 === 'customer' || r0 === 'reader' || (r0 === 'stroll' && i % 2))) return;
      if (p.hold) return; // carriers keep their crates and sacks: they vanish as before
      const at = p.o.at || p.o.spots?.[0] || [p.pos.x, p.pos.z];
      let best = null, bd = 90;
      for (const b of beds) { if (b.taken) continue; const d = Math.hypot(b.sp.x - at[0], b.sp.z - at[1]); if (d < bd) { bd = d; best = b; } }
      if (best) { best.taken = true; p.home = best; }
    });
  }
  makeIndoor(q) {
    const J = JOBS[q.job];
    const p = this.add('villager', q.v, { role: 'indoor', house: q.S.id, spot: q.k, job: q.job, ghost: true, at: [q.sp.x, q.sp.z], face: q.sp.ry });
    p.S = q.S; p.J = J; p.rate = r(0.9, 1.1); p.barkT = 0; p.lookT = 0;
    if (J.tool === 'hammer') p.char.userData.bones.weaponR?.add(smithHammer());
  }
  thinkIndoor(p, dt) {
    const J = p.J, player = this._player;
    p.ryT = p.o.face;
    if (!p.anim.busy) {
      const clip = J.alt && Math.random() < J.altP ? J.alt : J.clip;
      p.anim.play(clip, { speed: p.rate, fadeIn: p.started ? 0.25 : 0.01, fadeOut: 0.05 });
      if (!p.started) { p.started = true; if (p.anim.action) p.anim.action.time = r(0, clip.dur); } // a random phase
    }
    // a bark when the player comes close: the head turns toward him and a line shows over the head (20 s apart)
    const dx = player ? player.x - p.pos.x : 99, dz = player ? player.z - p.pos.z : 99, d = Math.hypot(dx, dz);
    if (d < BARK_R) {
      p.lookT = Math.max(-1.1, Math.min(1.1, wrapA(Math.atan2(dx, dz) - p.ry)));
      if (this.clock >= p.barkT) { p.barkT = this.clock + BARK_CD; this.bark(p, pick(J.lines)); }
    } else p.lookT = 0;
    p.step(dt, this.world, this.list, player);
  }
  goHome(p) {
    const H = p.home;
    p.dayPos = p.pos.clone(); p.dayRy = p.ry; p.dayGhost = p.o.ghost;
    p.atHome = true; p.goal = null; p.speed = 0; p.o.ghost = true;
    p.pos.set(H.sp.x, 0, H.sp.z); p.ry = p.ryT = p.prevRy = H.sp.ry;
    p.hold = H.k === 3 ? DOZING : SITTING;
    p.anim.stop(0.05);
  }
  leaveHome(p) {
    p.atHome = false; p.o.ghost = p.dayGhost;
    if (p.dayPos) { p.pos.copy(p.dayPos); p.ry = p.ryT = p.prevRy = p.dayRy; }
    p.hold = null; p.wait = r(0, 3);
    p.anim.stop(0.05);
  }
  // speech bubbles: a small line over the head, kept on screen in the HUD's floating-text layer
  bark(p, text) {
    if (typeof document === 'undefined') return;
    this.dropBubble(p);
    const host = document.querySelector('.hud .floats') || document.body;
    const el = document.createElement('div');
    el.className = 'tf-bark';
    el.textContent = text;
    el.style.cssText = 'position:absolute;left:0;top:0;max-width:210px;padding:5px 10px;border-radius:9px;background:rgba(24,18,10,0.84);' +
      'border:1px solid rgba(232,200,140,0.55);color:#f6ead0;font:600 13px/1.3 var(--font-body, sans-serif);text-align:center;' +
      'pointer-events:none;white-space:normal;transition:opacity 0.3s;opacity:0;will-change:transform;';
    host.appendChild(el);
    p.bubble = { el, t: 0 };
    (this.bubbles ||= []).push(p);
  }
  dropBubble(p) {
    if (!p.bubble) return;
    p.bubble.el.remove(); p.bubble = null;
    const i = this.bubbles.indexOf(p); if (i >= 0) this.bubbles.splice(i, 1);
  }
  updateBubbles(dt, camera) {
    if (!this.bubbles?.length) return;
    const Wd = innerWidth, Ht = innerHeight;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const p = this.bubbles[i], B = p.bubble;
      B.t += dt;
      if (B.t > BARK_SHOW || !p.root.parent) { this.dropBubble(p); continue; }
      if (!camera) continue;
      const v = _v.copy(p.pos).setY(p.pos.y + 2.25 * p.scale).project(camera);
      if (v.z > 1 || !p.root.visible) { B.el.style.display = 'none'; continue; }
      B.el.style.display = 'block';
      B.el.style.opacity = B.t > BARK_SHOW - 0.4 ? String(Math.max(0, (BARK_SHOW - B.t) / 0.4)) : '1';
      B.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * Wd}px, ${(-v.y * 0.5 + 0.5) * Ht}px) translate(-50%, -100%)`;
    }
  }

  shootArrow(p) {
    const m = arrowMesh();
    const hand = p.pos.clone(); hand.y = p.T.walk(hand.x, hand.z) + 1.45;
    const tgt = p.o.target.clone(); tgt.y = p.T.height(tgt.x, tgt.z) + 1.3 + r(-0.25, 0.25); tgt.x += r(-0.3, 0.3); tgt.z += 0.12;
    m.position.copy(hand);
    m.lookAt(tgt); m.rotateX(PI / 2);
    this.scene.add(m);
    this.arrows.push({ mesh: m, from: hand, to: tgt, t: 0, fly: hand.distanceTo(tgt) / 38 });
    if (this.arrows.length > 10) { const a = this.arrows.shift(); this.scene.remove(a.mesh); }
  }
  setPlayer(p) { this._player = p; }

  // the first zone at work: sweepers on the plaza and the avenue, pairs chatting, porters with sacks at the farm,
  // hands hoeing the vegetable rows, and fishers on the stream bank, at the farm pond and on the lake shore
  addVillageWork(add, scene, T) {
    this.world.townsfolk = this; // for the off-screen checks
    const tool = (p, kind) => { const t = handTool(kind); p.char.userData.bones.weaponR.add(t); return t; };
    for (const [x, z] of [[-9.5, -8.5], [9, 9.5], [-3.6, 19.5]]) { const p = add('villager', 3 + Math.round(x) % 3 + 3, { role: 'sweep', home: [x, z], spots: [[x, z]], walk: 0.55 }); tool(p, 'broom'); }
    for (const [[ax, az], [bx, bz], v] of [[[16.4, -8.6], [17.7, -7.5], 2], [[-38.6, 28.2], [-37.3, 27.1], 5], [[-6.6, 45.8], [-5.3, 46.9], 1], [[88.2, 0.2], [89.5, 1.2], 4], [[23.4, 34.6], [24.6, 35.8], 6]]) {
      const a = add('villager', v, { role: 'chat', at: [ax, az], face: Math.atan2(bx - ax, bz - az) });
      const b = add('villager', v + 1, { role: 'chat', at: [bx, bz], face: Math.atan2(ax - bx, az - bz) });
      a.partner = b; b.partner = a; a.speaker = true;
    }
    for (let i = 0; i < 2; i++) {
      const p = add('villager', i + 2, { role: 'stroll', spots: [[119, 0], [104, -3], [98, -12], [120, -6], [91, -3]], walk: 1.0 });
      p.hold = CARRY; const s = propSack(); s.position.set(0, 1.12, 0.36); p.char.add(s);
    }
    for (const [x, z, f] of [[91.6, -13.6, PI / 2], [96.6, -15.3, -PI / 2]]) { const p = add('villager', 4 + Math.round(x) % 3, { role: 'hoe', at: [x, z], face: f, ghost: true }); tool(p, 'hoe'); }
    // fishers: each one stands on the first dry ground out from a point on the water and faces it
    const fishers = [];
    for (const s of [58, 101]) {
      const at = pointAt(s), wy = streamInfo(at.x, at.z).level;
      fishers.push([...shoreSpot(T, at.x, at.z, -at.dz, at.dx, wy), wy]);
    }
    { const P = STREAM.pond, wy = streamLevel(1e4); fishers.push([...shoreSpot(T, P.x + 3, P.z, 1, 0.15, wy), wy]); }
    for (const a of [-0.35, 0.3]) fishers.push([...shoreSpot(T, LAKE.x + Math.cos(a) * (LAKE.r - 6), LAKE.z + Math.sin(a) * (LAKE.r - 6), Math.cos(a), Math.sin(a), 0), 0]);
    fishers.forEach(([x, z, f, wy], i) => {
      const p = add('villager', (i * 2 + 1) % 8, { role: 'fish', at: [x, z], face: f, ghost: true });
      p.hold = FISH; p.rod = tool(p, 'rod'); p.water = wy; p.fl = fishLine(scene);
    });
  }

  // the work roles (sweep, chat, hoe, fish); returns true when it handled p
  thinkWork(p, dt, role) {
    const W = this.world, others = this.list, player = this._player;
    if (role === 'sweep') {
      // a slow sweep about home, a few steps at a time
      if (!p.anim.busy) p.anim.play(SWEEP, { fadeIn: 0.2, fadeOut: 0.05 });
      if (!p.goal && (p.wait -= dt) <= 0) { const [hx, hz] = p.o.home; p.setGoal(hx + r(-2.4, 2.4), hz + r(-2.4, 2.4)); p.wait = r(3, 7); }
      p.step(dt, W, others, player, p.walk, 0.4);
      return true;
    }
    if (role === 'chat') {
      p.ryT = p.o.face + Math.sin(p.t * 0.3) * 0.12;
      p.talkT = (p.talkT ?? r(0, 3)) - dt;
      if (p.talkT <= 0) {
        // one talks while the other listens and nods, then they swap
        if (p.speaker) { p.gesture(TALK); p.partner.listenAt = 0.8; } else if (Math.random() < 0.5) p.gesture(NOD);
        p.talkT = r(3, 6);
        if (Math.random() < 0.35) { p.speaker = !p.speaker; p.partner.speaker = !p.speaker; }
      }
      if (p.listenAt !== undefined && (p.listenAt -= dt) <= 0) { p.listenAt = undefined; p.gesture(NOD); }
      p.step(dt, W, others, player);
      return true;
    }
    if (role === 'hoe') {
      p.ryT = p.o.face;
      if (!p.anim.busy) p.anim.play(HOE, { fadeIn: 0.2, fadeOut: 0.05 });
      p.step(dt, W, others, player);
      return true;
    }
    if (role === 'fish') {
      p.ryT = p.o.face;
      if (Math.random() < dt * 0.06) p.gesture(TUG);
      p.step(dt, W, others, player);
      // hang the line from the rod's tip to a float bobbing on the water ahead
      const tip = _v.set(0, 0, 0);
      p.char.updateWorldMatrix(true, true);
      p.rod.userData.tip.getWorldPosition(tip);
      const fx = tip.x + Math.sin(p.ry) * 0.6, fz = tip.z + Math.cos(p.ry) * 0.6, fy = p.water + 0.01 + Math.sin(p.t * 2.2) * 0.012;
      const len = Math.max(0.05, tip.distanceTo(_v2.set(fx, fy, fz)));
      p.fl.line.position.copy(tip); p.fl.line.lookAt(fx, fy, fz); p.fl.line.rotateX(-PI / 2); p.fl.line.scale.set(1, len, 1);
      p.fl.float.position.set(fx, fy, fz);
      return true;
    }
    return false;
  }
  // the player's body against the townsfolk: they stand firm and the player slides round them
  collide(pos, pr = 0.45) {
    for (const p of this.list) {
      if (!p.active || p.o.role === 'spar') continue;
      const rr = 0.45 * p.scale + pr, dx = pos.x - p.pos.x, dz = pos.z - p.pos.z;
      if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = p.pos.x + (dx / d) * rr; pos.z = p.pos.z + (dz / d) * rr; }
    }
  }
}
