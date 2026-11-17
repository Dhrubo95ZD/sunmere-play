// Global shader uniforms shared by every world material (wind, time, see-through fade, cloud shadows).
import * as THREE from 'three';
import { SETTINGS, QUALITY_PRESETS, BATTERY_PRESET } from './settings.js';

export const CUT_SLOTS = 2, CUT_PARTS = 6;
export const G = {
  time: { value: 0 },
  windDir: { value: new THREE.Vector2(0.86, 0.5).normalize() },
  windStrength: { value: 0.55 },
  playerPos: { value: new THREE.Vector3(0, 0, 0) },
  // see-through circle around the player (screen space)
  fadeCenter: { value: new THREE.Vector2(0.5, 0.5) },
  fadeDepth: { value: 1e6 },
  fadeRadius: { value: 0.11 },
  fadeOn: { value: 0 },
  // the Russet Weald's canopy cut (materials.js FRAG_CANOPY): x on, y radius (m), z height over the hero's feet (m)
  canopy: { value: new THREE.Vector3(0, 13, 3.4) },
  // house cut-away (world.updateHouses, materials.js CUT): while you stand in a house, the roof, the upper storey and the
  // camera-side upper walls inside its cut box are discarded. Centre = the house origin, rot its turn; cutRect / cutFoot are
  // the local cut box (footprint + extensions + eaves) and footprint as (x0, z0, x1, z1); cutDir is the camera's forward
  // on the ground (world xz). Shadows are not cut (the roof still shades the room).
  cutOn: { value: 0 },
  cutCenter: { value: new THREE.Vector2() },
  cutRot: { value: 0 },
  cutRect: { value: new THREE.Vector4() },
  cutFoot: { value: new THREE.Vector4() },
  cutY: { value: 1e6 },
  cutFrontY: { value: 1e6 },
  cutDir: { value: new THREE.Vector2(0, -1) },
  // v108 RuneScape-style cut-away, up to CUT_SLOTS houses at once (the one you stand in, and houses between the camera and
  // you): per slot cutA (centre x, z, rot, on), cutR (the local cut box), cutF (the local footprint), cutH (wainscot y:
  // everything above it in the walls and eaves goes; ceiling y: everything above it inside the room goes; the floor y)
  // and cutP (CUT_PARTS local partition rects per slot). world.updateHouses fills them; materials.js smCut reads them.
  cutA: { value: Array.from({ length: 2 }, () => new THREE.Vector4()) },
  cutR: { value: Array.from({ length: 2 }, () => new THREE.Vector4()) },
  cutF: { value: Array.from({ length: 2 }, () => new THREE.Vector4()) },
  cutH: { value: Array.from({ length: 2 }, () => new THREE.Vector4(1e6, 1e6, 0, 0)) },
  cutP: { value: Array.from({ length: 12 }, () => new THREE.Vector4(1e6, 1e6, -1e6, -1e6)) },
  cutK: { value: Array.from({ length: 2 }, () => new THREE.Vector4(1e6, 1e6, -1e6, -1e6)) }, // a kept rect per slot (the wall hearth's breast)
  resolution: { value: new THREE.Vector2(1920, 1080) },
  // drifting cloud shadows
  cloudTex: { value: null },
  cloudOffset: { value: new THREE.Vector2(0, 0) },
  cloudAmount: { value: 0.3 },
  // 0 by day, 1 at the dark of night (lantern glows burn brighter)
  night: { value: 0 },
  // 0 dry .. 1 soaked: the ground darkens and turns glossy while it rains, drying off slowly afterwards
  wet: { value: 0 },
  // lamps and fires lighting the air this frame ({ x, y, z, w: strength, c: Color }), from the world's light pool
  airLamps: [],
};

// (v116) which pass three is drawing: shadow = true inside the sun's shadow map (renderer.js sets it; the scatter's merged
// batches draw only their casting instances then, game/scatter.js)
export const PASS = { shadow: false };

// Battery saver lays its preset over the chosen one (never raising the pixel ratio)
const _preset = QUALITY_PRESETS[SETTINGS.quality] || QUALITY_PRESETS.high;
export const QUALITY = SETTINGS.battery ? { ..._preset, ...BATTERY_PRESET, pixelRatio: Math.min(_preset.pixelRatio, BATTERY_PRESET.pixelRatio) } : { ..._preset };
