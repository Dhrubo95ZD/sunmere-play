// LF.4 the far horizon: rings of distant hill and mountain silhouettes past the edge of every outdoor area, so a low
// camera never looks out at flat fog. One mesh, three layers (far mountains, middle hills, near hills, drawn far to
// near), a child of the sky dome (it follows the camera and hides with the sky underground). Like the sky it is drawn at
// the far plane with no depth write: the world draws over it, the air pass treats it as sky (no extra fog), and it costs
// one draw call of ~2,000 triangles. Colours come from the live fog and sky each frame (dusk, night, rain and snow carry
// over); the base of each layer dissolves into the haze so it meets the fogged ground without a seam. Each area has its
// own profile (heights, roughness, gaps), rebuilt when you change area. Phones skip the painterly streaks (a cheaper shader).
// Plain shapes only: rounded hills and ridged peaks, no spires, no rays.
import * as THREE from 'three';
import { QUALITY } from '../engine/globals.js';

const N = 360; // columns round the ring (1 degree each)
const R = 400; // ring radius (any: the shader puts it on the far plane)
const BASE = -0.16; // the bottom of every column (tan of the angle under the eye line), well under any ground horizon
const LIFT = 1.9; // every profile's heights times this (the fogged ground of each area reaches near the eye line: the hills must clear it)
// per area: for each layer [far, middle, near] the lowest height, the swing (tan of elevation), the roughness
// (0 rounded hills .. 1 ridged peaks), the feature count round the ring; gap: how deep the low stretches dip (sea,
// open plain); snow: how much of the far peaks is white; seed. mist: where each layer's base meets the haze.
export const HORIZON = {
  valley: { L: [[0.035, 0.085, 0.75, 9], [0.022, 0.04, 0.35, 14], [0.01, 0.026, 0.1, 22]], gap: 0.25, snow: 0.35, seed: 3 },
  reach: { L: [[0.012, 0.06, 0.7, 6], [0.008, 0.03, 0.4, 10], [0.0, 0.016, 0.1, 16]], gap: 0.7, snow: 0, seed: 11 },
  rime: { L: [[0.045, 0.11, 0.9, 10], [0.028, 0.055, 0.6, 15], [0.012, 0.03, 0.3, 24]], gap: 0.35, snow: 0.8, seed: 23 },
  heights: { L: [[0.03, 0.1, 0.9, 8], [0.006, 0.045, 0.7, 12], [-0.01, 0.02, 0.2, 18]], gap: 0.4, snow: 0.9, seed: 31 },
  tidewater: { L: [[0.02, 0.07, 0.6, 8], [0.012, 0.035, 0.3, 13], [0.004, 0.02, 0.1, 20]], gap: 0.6, snow: 0.15, seed: 41 },
  rainward: { L: [[0.06, 0.12, 0.8, 9], [0.04, 0.07, 0.5, 14], [0.022, 0.045, 0.25, 22]], gap: 0.15, snow: 0.1, seed: 53 },
  weald: { L: [[0.03, 0.07, 0.5, 8], [0.02, 0.04, 0.2, 13], [0.012, 0.028, 0.05, 21]], gap: 0.25, snow: 0.2, seed: 67 },
};
const MIST = [[-0.01, 0.07], [-0.02, 0.04], [-0.03, 0.02]]; // per layer: fully haze below, clear above (tan)

// periodic value noise round the ring: a hash on the integer lattice of the feature count, smooth between
const hash = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
function ringNoise(u, count, seed) { // u in 0..1 round the ring
  const x = u * count, i = Math.floor(x), f = x - i, w = f * f * (3 - 2 * f);
  return hash(i % count, seed) * (1 - w) + hash((i + 1) % count, seed) * w;
}
function fbm(u, count, seed) {
  return ringNoise(u, count, seed) * 0.55 + ringNoise(u, count * 2, seed + 5) * 0.27 + ringNoise(u, count * 4, seed + 9) * 0.13 + ringNoise(u, count * 8, seed + 13) * 0.05;
}
// the height (tan of elevation) of one layer at u
export function profile(P, l, u) {
  const [lo, amp, rough, count] = P.L[l];
  const n = fbm(u, count, P.seed + l * 101);
  const ridged = 1 - Math.abs(2 * n - 1); // sharp crests
  const shape = n * (1 - rough) + Math.pow(ridged, 1.6) * rough;
  const env = 1 - P.gap * Math.max(0, 1 - ringNoise(u, 3, P.seed + 77) * 1.9); // a few low stretches round the ring
  return (lo + amp * shape) * env * LIFT;
}

const VERT = /* glsl */ `
  attribute vec3 aCol; // x: top of this column, y: layer (0 far .. 2 near), z: angle (radians)
  varying vec3 vInfo; varying float vY;
  void main() {
    vInfo = aCol; vY = position.y / ${R.toFixed(1)};
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; // on the far plane, like the sky
  }`;
const FRAG = /* glsl */ `
  uniform vec3 uFog, uZen, uSun, uSunDir;
  uniform float uNight, uDusk, uSnow;
  varying vec3 vInfo; varying float vY;
  float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    float top = vInfo.x, L = vInfo.y, a = vInfo.z;
    // each nearer layer is darker and bluer (aerial perspective): the far range sits just off the haze
    vec3 tone = mix(uZen, uFog, 0.45) * mix(0.82, 0.5, L * 0.5);
    vec3 c = mix(uFog, tone, mix(0.55, 0.9, L * 0.5));
    float below = top - vY; // how far under the crest (tan)
    #ifdef DETAIL
    // painterly: soft streaks running down the slopes and a broken, lighter crest band
    float st = vn(vec2(a * 60.0 + vY * 25.0, vY * 160.0)) * 0.6 + vn(vec2(a * 170.0, vY * 420.0)) * 0.4;
    c *= 0.93 + 0.12 * st;
    #endif
    // snow on the far peaks (by day and dusk; at night it stays a faint grey-blue)
    float snow = uSnow * step(L, 0.5) * smoothstep(0.11, 0.17, top) * smoothstep(0.03, 0.0, below - 0.004 * sin(a * 90.0));
    c = mix(c, mix(uFog * 1.12 + vec3(0.04), uFog * 1.05, uNight), snow * 0.7);
    // the sun side of each crest catches a little light (none at night)
    float sd = max(dot(vec2(sin(a), cos(a)), normalize(uSunDir.xz + vec2(1e-4))), 0.0);
    c += uSun * smoothstep(0.012, 0.0, below) * sd * (0.08 + 0.1 * uDusk) * (1.0 - uNight) * (1.0 - L * 0.25);
    // the base dissolves into the haze (deeper haze for the far layers)
    float m0 = L < 0.5 ? ${MIST[0][0]} : L < 1.5 ? ${MIST[1][0]} : ${MIST[2][0]};
    float m1 = L < 0.5 ? ${MIST[0][1]} : L < 1.5 ? ${MIST[1][1]} : ${MIST[2][1]};
    c = mix(c, uFog, 1.0 - smoothstep(m0, m1, vY));
    gl_FragColor = vec4(c, 1.0);
  }`;

const _sun = new THREE.Vector3();
export function createHorizon(engine, world) {
  const nv = 3 * (N + 1) * 2;
  const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = [];
  for (let l = 0; l < 3; l++) for (let i = 0; i <= N; i++) {
    const v = (l * (N + 1) + i) * 2;
    if (i < N) idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mobile = !!QUALITY.mobile;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, depthWrite: false, fog: false, side: THREE.DoubleSide,
    defines: mobile ? {} : { DETAIL: 1 },
    uniforms: { uFog: { value: new THREE.Color() }, uZen: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uNight: { value: 0 }, uDusk: { value: 0 }, uSnow: { value: 0 } },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'horizon';
  mesh.frustumCulled = false;
  mesh.renderOrder = -999; // right after the sky dome (-1000), before the world
  mesh.userData.noCamCollide = true;
  let built = null;
  const build = (id) => {
    const P = HORIZON[id] || HORIZON.valley;
    for (let l = 0; l < 3; l++) for (let i = 0; i <= N; i++) {
      const u = (i % N) / N, a = u * Math.PI * 2, top = profile(P, l, u);
      const sx = Math.sin(a) * R, sz = Math.cos(a) * R, v = (l * (N + 1) + i) * 2;
      pos.set([sx, BASE * R, sz, sx, top * R, sz], v * 3);
      col.set([top, l, a, top, l, a], v * 3);
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.aCol.needsUpdate = true;
    mat.uniforms.uSnow.value = P.snow;
    built = id;
  };
  mesh.onBeforeRender = () => {
    const id = world?.area && HORIZON[world.area] ? world.area : 'valley';
    if (id !== built) build(id);
    const u = mat.uniforms, sk = engine.sky?.material?.uniforms;
    u.uFog.value.copy(engine.scene.fog?.color || engine.scene.background);
    if (sk) { u.uZen.value.copy(sk.zenith.value); u.uNight.value = sk.uNight.value; u.uDusk.value = sk.uDusk.value; u.uSun.value.copy(sk.sunCol.value); }
    u.uSunDir.value.copy(engine.sunDir || _sun.set(0, 1, 0));
  };
  build('valley');
  return mesh;
}
