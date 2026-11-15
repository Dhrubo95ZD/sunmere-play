// Terrain: height grid, splat maps, chunked mesh with a height-blended 7-layer ground shader.
import * as THREE from 'three';
import { WORLD, heightAt, groundAt, deckAt } from '/sunmere-play/shared/terrain.js';
import { DUNGEON_MIN_X } from '/sunmere-play/shared/dungeons.js';
import { G, QUALITY } from './globals.js';
import { patchWorld } from './materials.js';
import * as T from './textures.js';

const LAYERS = ['grass', 'forest', 'lush', 'dirt', 'cobble', 'sand', 'rock'];
const LAYER_SCALE = [6.5, 7.0, 6.5, 6.0, 6.2, 8.0, 10.0]; // metres per texture tile

function texData(tex, S) {
  // read a canvas texture into RGBA bytes at size S (tiling smaller canvases)
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d', { willReadFrequently: true });
  const img = tex.image;
  const n = Math.max(1, Math.round(S / img.width));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) x.drawImage(img, i * S / n, j * S / n, S / n, S / n);
  return x.getImageData(0, 0, S, S).data;
}

function arrayTexture(list, S, srgb) {
  const data = new Uint8Array(S * S * 4 * list.length);
  list.forEach((d, i) => data.set(d, i * S * S * 4));
  const t = new THREE.DataArrayTexture(data, S, S, list.length);
  t.format = THREE.RGBAFormat;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = QUALITY.anisotropy || 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// the seven ground layers as GPU texture arrays: about 75 MB (19 MB at the Mobile preset's 512), so built once and shared by every Terrain (the valley and the
// Cinder Reach); each terrain gets its own look from uniforms (layer tints, the base layer, glowing seams)
let SHARED = null;
function sharedLayers() {
  if (SHARED) return SHARED;
  const S = QUALITY.texSize || 1024; // 512 on the Mobile preset: a quarter of the memory
  const sets = [T.grassTex(), T.forestFloorTex(), T.lushTex(), T.dirtTex(), T.cobbleTex(), T.sandTex(), T.rockTex()];
  // albedo with the painted height in alpha (drives height blending)
  const alb = sets.map((s) => texData(s.map, S));
  const nrm = sets.map((s) => texData(s.normalMap, S));
  // write height (approx from normal-map-less luminance of albedo detail) into alpha
  for (const d of alb) for (let i = 0; i < d.length; i += 4) d[i + 3] = Math.min(255, (d[i] * 0.3 + d[i + 1] * 0.5 + d[i + 2] * 0.2) * 1.4);
  SHARED = { tAlb: arrayTexture(alb, S, true), tNrm: arrayTexture(nrm, S, false), normalMap: sets[0].normalMap };
  return SHARED;
}

// per-terrain looks: tint and desaturation per layer (grass, forest, lush, dirt, cobble, sand, rock), the base layer under
// everything, and whether the lush channel carries glowing seams instead of lush grass
const THEMES = {
  valley: { tint: Array(7).fill([1, 1, 1]), desat: Array(7).fill(0), base: 0, seam: 0 },
  // the Cinder Reach: ash-grey dirt as the base, black sand, dark basalt, grey paving; lush = glowing seams in the lava
  reach: {
    tint: [[0.5, 0.49, 0.48], [0.5, 0.49, 0.48], [0.5, 0.49, 0.48], [0.74, 0.72, 0.7], [0.86, 0.85, 0.83], [0.36, 0.355, 0.35], [0.46, 0.45, 0.44]],
    desat: [1, 1, 1, 1, 0.9, 1, 0.95], base: 3, seam: 1,
  },
  // the Rime Steps: snow over dark frost-bitten rock; lush = blue ice (laid over the snow), path = trodden snow, sand = grey
  // shingle, cobble = pale stone paving swept of snow
  rime: {
    tint: [[0.8, 0.84, 0.9], [0.8, 0.84, 0.9], [0.8, 0.84, 0.9], [0.78, 0.8, 0.84], [0.86, 0.9, 0.96], [0.6, 0.62, 0.65], [0.44, 0.47, 0.53]],
    desat: [1, 1, 1, 0.85, 0.85, 1, 0.9], base: 6, seam: 0, rime: 1,
  },
  // the Windward Heights: wind-packed snow (brighter, scoured into long streaks along the west wind) over bare grey rock,
  // rime feathered on the rock, glazed ice on the open drifts (the lush channel, as on the Rime Steps), grey stone pads
  heights: {
    tint: [[0.84, 0.88, 0.94], [0.84, 0.88, 0.94], [0.84, 0.88, 0.94], [0.8, 0.82, 0.86], [0.8, 0.83, 0.88], [0.6, 0.62, 0.65], [0.52, 0.54, 0.58]],
    desat: [1, 1, 1, 0.9, 0.9, 1, 0.92], base: 6, seam: 0, rime: 1, scour: 1,
  },
  // Tidewater Sound: salt-burnt grass (dry, yellowed and greyed) as the base, grey shingle, grey-brown rock, the planted rows'
  // dark green ground on the lush channel and needles on the forest channel; mud = wet mud on the snow channel (snow is 0
  // there), dark, smooth and glossy where the tide has just left it
  tidewater: {
    tint: [[1.18, 0.96, 0.56], [0.62, 0.58, 0.5], [0.42, 0.6, 0.4], [0.82, 0.76, 0.66], [0.86, 0.86, 0.84], [0.66, 0.66, 0.66], [0.62, 0.6, 0.58]],
    desat: [0.72, 0.3, 0.25, 0.4, 0.7, 1, 0.8], base: 0, seam: 0, mud: 1,
  },
  // the Rainward Gorge: deep wet green grass as the base, dark wet rock, moss on the lush channel, needles under the planted
  // timber, dark wet earth in the seed beds and on the road, grey river gravel, grey Makers' stone; mud = red-brown mud on
  // the snow channel (mudTint warms the Sound's grey mud)
  rainward: {
    tint: [[0.38, 0.56, 0.32], [0.5, 0.46, 0.38], [0.4, 0.6, 0.36], [0.56, 0.45, 0.36], [0.72, 0.74, 0.72], [0.6, 0.62, 0.62], [0.38, 0.4, 0.39]],
    desat: [0.3, 0.3, 0.25, 0.3, 0.6, 1, 0.75], base: 0, seam: 0, mud: 1, mudTint: [1.32, 0.86, 0.62],
  },
};

export class Terrain {
  // opts: { minX, maxX, minZ, maxZ, cell, height(x,z), ground(x,z), chunks, segs, theme } (the valley by default)
  constructor(opts = {}) {
    // the grid covers the world rectangle at 1.25 m: the old valley's grid points (-320 + k * 1.25) all land on this grid too
    this.minX = opts.minX ?? WORLD.minX; this.minZ = opts.minZ ?? WORLD.minZ; this.maxX = opts.maxX ?? WORLD.maxX; this.maxZ = opts.maxZ ?? WORLD.maxZ;
    this.sizeX = this.maxX - this.minX; this.sizeZ = this.maxZ - this.minZ;
    this.cell = opts.cell ?? 1.25;
    this.heightFn = opts.height || heightAt; this.groundFn = opts.ground || groundAt;
    this.theme = opts.theme || 'valley';
    this.alts = []; // the other outdoor areas' terrains (the Cinder Reach, the Rime Steps): lookups inside their boxes go to them
    this.nx = Math.round(this.sizeX / this.cell); this.nz = Math.round(this.sizeZ / this.cell);
    const Rx = (this.Rx = this.nx + 1), Rz = (this.Rz = this.nz + 1);
    this.h = new Float32Array(Rx * Rz);
    for (let j = 0; j < Rz; j++) for (let i = 0; i < Rx; i++) this.h[j * Rx + i] = this.heightFn(this.minX + i * this.cell, this.minZ + j * this.cell);
    // world -> texture transforms shared with grass and water: splats are cell-centred, the height texture vertex-centred
    this.uWorld = { value: new THREE.Vector4(this.minX, this.minZ, 1 / this.sizeX, 1 / this.sizeZ) };
    this.uHeightUV = { value: new THREE.Vector4(this.minX - this.cell / 2, this.minZ - this.cell / 2, 1 / (Rx * this.cell), 1 / (Rz * this.cell)) };
    this.buildSplat();
    this.buildHeightTexture();
    this.material = this.buildMaterial();
    this.group = new THREE.Group();
    this.buildChunks(opts.chunks ?? 10, opts.segs ?? 57);
  }

  inBox(x, z) { return x >= this.minX && x <= this.maxX && z >= this.minZ && z <= this.maxZ; }
  // the area terrain answering for (x, z), or null (this one)
  altAt(x, z) { const A = this.alts; for (let i = 0; i < A.length; i++) if (A[i].inBox(x, z)) return A[i]; return null; }
  // older callers set and read a single alt
  get alt() { return this.alts[0] || null; }
  set alt(t) { if (t && !this.alts.includes(t)) this.alts.push(t); }
  // bilinear height lookup
  height(x, z) {
    if (x >= DUNGEON_MIN_X) return 0; // dungeon interiors: flat floors
    if (this.alts.length) { const a = this.altAt(x, z); if (a) return a.height(x, z); }
    const fx = (x - this.minX) / this.cell, fz = (z - this.minZ) / this.cell;
    const i = Math.max(0, Math.min(this.nx - 1, Math.floor(fx))), j = Math.max(0, Math.min(this.nz - 1, Math.floor(fz)));
    const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fz - j));
    const R = this.Rx, h = this.h;
    const a = h[j * R + i], b = h[j * R + i + 1], c = h[(j + 1) * R + i], d = h[(j + 1) * R + i + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  // where a character stands: the ground, or a built deck above it (terrace, stairs, bridges)
  walk(x, z) { return Math.max(this.height(x, z), deckAt(x, z)); }
  normal(x, z, out = new THREE.Vector3()) {
    if (this.alts.length) { const a = this.altAt(x, z); if (a) return a.normal(x, z, out); }
    const e = this.cell;
    return out.set(this.height(x - e, z) - this.height(x + e, z), 2 * e, this.height(x, z - e) - this.height(x, z + e)).normalize();
  }

  buildSplat() {
    const NX = this.nx, NZ = this.nz;
    const a = new Uint8Array(NX * NZ * 4), b = new Uint8Array(NX * NZ * 4);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const x = this.minX + (i + 0.5) * this.cell, z = this.minZ + (j + 0.5) * this.cell;
      const g = this.groundFn(x, z);
      const k = (j * NX + i) * 4;
      a[k] = g.sand * 255; a[k + 1] = g.path * 255; a[k + 2] = g.rock * 255; a[k + 3] = g.lush * 255;
      b[k] = g.forest * 255; b[k + 1] = g.cobble * 255; b[k + 2] = (g.foundry || 0) * 255; b[k + 3] = (g.snow || g.mud || 0) * 255; // (Tidewater Sound carries its mud in the snow channel)
    }
    const mk = (d) => {
      const t = new THREE.DataTexture(d, NX, NZ, THREE.RGBAFormat);
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
      return t;
    };
    this.splatA = mk(a);
    this.splatB = mk(b);
    this.splatDataA = a; this.splatDataB = b;
  }

  // turn a rotated rectangle (centre x, z, half sizes hw, hd, rotation ry as on an Object3D) to bare tilled earth: the dirt
  // layer shows and no grass grows there (a garden plot's beds were drowned in meadow grass). Call before the first frame.
  paintEarth(x, z, hw, hd, ry = 0, amt = 0.75) {
    const a = this.splatDataA, c = Math.cos(ry), s = Math.sin(ry), r = Math.hypot(hw, hd) + this.cell;
    const i0 = Math.max(0, Math.floor((x - r - this.minX) / this.cell)), i1 = Math.min(this.nx - 1, Math.ceil((x + r - this.minX) / this.cell));
    const j0 = Math.max(0, Math.floor((z - r - this.minZ) / this.cell)), j1 = Math.min(this.nz - 1, Math.ceil((z + r - this.minZ) / this.cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = this.minX + (i + 0.5) * this.cell - x, dz = this.minZ + (j + 0.5) * this.cell - z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c; // world -> the rectangle's own frame
      const k = Math.min(1, Math.max(0, 1 + Math.min(hw - Math.abs(lx), hd - Math.abs(lz)) / this.cell)); // soft one-cell rim
      const q = (j * this.nx + i) * 4 + 1;
      a[q] = Math.max(a[q], Math.round(255 * amt * k));
    }
    this.splatA.needsUpdate = true;
  }

  // ground type at a point (for footstep sounds, grass density...)
  groundWeights(x, z) {
    if (this.alts.length) { const a = this.altAt(x, z); if (a) return a.groundWeights(x, z); }
    const i = Math.max(0, Math.min(this.nx - 1, Math.floor((x - this.minX) / this.cell)));
    const j = Math.max(0, Math.min(this.nz - 1, Math.floor((z - this.minZ) / this.cell)));
    const k = (j * this.nx + i) * 4, a = this.splatDataA, b = this.splatDataB;
    return { sand: a[k] / 255, path: a[k + 1] / 255, rock: a[k + 2] / 255, lush: a[k + 3] / 255, forest: b[k] / 255, cobble: b[k + 1] / 255, foundry: b[k + 2] / 255, snow: b[k + 3] / 255 };
  }

  buildHeightTexture() {
    const t = new THREE.DataTexture(this.h, this.Rx, this.Rz, THREE.RedFormat, THREE.FloatType);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    this.heightTex = t;
  }

  buildMaterial() {
    const { tAlb, tNrm, normalMap } = sharedLayers();
    const TH = THEMES[this.theme] || THEMES.valley;
    const m = new THREE.MeshStandardMaterial({ roughness: 0.94, metalness: 0, normalMap });
    m.normalScale.set(1, 1);
    patchWorld(m, { cloud: true });
    const base = m.onBeforeCompile;
    m.onBeforeCompile = (shader) => {
      base(shader);
      Object.assign(shader.uniforms, {
        tAlb: { value: tAlb }, tNrm: { value: tNrm }, tSplatA: { value: this.splatA }, tSplatB: { value: this.splatB },
        uLayerScale: { value: LAYER_SCALE }, uWorld: this.uWorld, uWet: G.wet,
        uTint: { value: TH.tint.map((c) => new THREE.Vector3(...c)) }, uDesat: { value: TH.desat }, uBase: { value: TH.base }, uSeam: { value: TH.seam }, uRime: { value: TH.rime || 0 }, uScour: { value: TH.scour || 0 }, uMud: { value: TH.mud || 0 }, uMudTint: { value: new THREE.Vector3(...(TH.mudTint || [1, 1, 1])) },
      });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWN;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          precision highp sampler2DArray;
          uniform sampler2DArray tAlb; uniform sampler2DArray tNrm;
          uniform sampler2D tSplatA; uniform sampler2D tSplatB;
          uniform float uLayerScale[7]; uniform vec4 uWorld; uniform float uWet; float gWet;
          uniform float uTime; uniform vec3 uTint[7]; uniform float uDesat[7]; uniform float uBase; uniform float uSeam; uniform float uRime; uniform float uScour; uniform float uMud; uniform vec3 uMudTint; float gMud = 0.0; vec3 gSeam = vec3(0.0); float gSeamK = 0.0; float gIce = 0.0;
          varying vec3 vWN;
          vec3 gNrm;
          float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
          // two rotated scales blended by a large noise to kill visible tiling
          vec4 sampleL(float i, vec2 wuv) {
            vec2 uv = wuv / uLayerScale[int(i)];
            vec4 a = texture(tAlb, vec3(uv, i));
            vec4 b = texture(tAlb, vec3(mat2(0.8, -0.6, 0.6, 0.8) * uv * 0.37 + 0.31, i));
            float m = texture(tAlb, vec3(wuv / 211.0, 0.0)).g;
            vec4 o = mix(a, b, smoothstep(0.3, 0.7, m) * 0.65);
            int k = int(i);
            o.rgb = mix(o.rgb, vec3(dot(o.rgb, vec3(0.3, 0.55, 0.15))), uDesat[k]) * uTint[k];
            return o;
          }
          vec3 sampleN(float i, vec2 wuv) { return texture(tNrm, vec3(wuv / uLayerScale[int(i)], i)).xyz * 2.0 - 1.0; }
          void blendLayer(inout vec4 acc, inout vec3 nacc, float i, float w, vec2 wuv) {
            if (w < 0.004) return;
            vec4 s = sampleL(i, wuv);
            // height blend: the higher painted detail wins the transition
            float t = clamp((w * 1.6 - 0.3) + (s.a - acc.a) * 0.9, 0.0, 1.0);
            t = smoothstep(0.0, 1.0, t);
            acc = mix(acc, s, t);
            nacc = mix(nacc, sampleN(i, wuv), t);
          }
        `)
        .replace('#include <map_fragment>', `
          {
            vec2 wuv = vec2(vWPos.x, -vWPos.z);
            vec2 suv = (vWPos.xz - uWorld.xy) * uWorld.zw;
            vec4 sa = texture2D(tSplatA, suv);
            vec4 sb = texture2D(tSplatB, suv);
            vec4 acc = sampleL(uBase, wuv);
            vec3 nacc = sampleN(uBase, wuv);
            float slope = 1.0 - smoothstep(0.62, 0.84, vWN.y);
            blendLayer(acc, nacc, 1.0, sb.r, wuv);
            blendLayer(acc, nacc, 2.0, sa.a * (1.0 - uSeam) * (1.0 - uRime), wuv);
            blendLayer(acc, nacc, 3.0, sa.g * (1.0 - sb.g), wuv);
            blendLayer(acc, nacc, 4.0, sb.g * max(sa.g, 0.6), wuv);
            blendLayer(acc, nacc, 5.0, sa.r, wuv);
            blendLayer(acc, nacc, 6.0, max(sa.b, slope), wuv);
            // large-scale painterly colour variation
            float macro = texture(tAlb, vec3(wuv / 97.0, 0.0)).g;
            float macro2 = texture(tAlb, vec3(wuv / 431.0, 2.0)).r;
            acc.rgb *= 0.86 + macro * 0.32;
            // soot and ash over the foundry yard
            acc.rgb = mix(acc.rgb, acc.rgb * vec3(0.58, 0.54, 0.52), sb.b * smoothstep(0.25, 0.75, macro2 + 0.3));
            acc.rgb = mix(acc.rgb, acc.rgb * vec3(1.06, 1.02, 0.86), smoothstep(0.3, 0.7, macro2) * 0.5);
            // (Tidewater Sound, second dressing pass) the salt grass in swathes of drier straw and greener grey-green some
            // 20 m across, so the base grass's mottle no longer reads as one even repeat over the open ground
            if (uMud > 0.5) {
              float gk = (1.0 - sa.r) * (1.0 - sa.g) * (1.0 - sb.g) * (1.0 - sb.b) * (1.0 - max(sa.b, slope)) * (1.0 - sb.r) * (1.0 - sa.a * 0.6);
              float sw = texture(tAlb, vec3(wuv / 41.0 + vec2(macro2 * 2.3, macro * 0.7), 5.0)).g;
              acc.rgb = mix(acc.rgb, acc.rgb * mix(vec3(0.84, 0.97, 0.88), vec3(1.08, 1.0, 0.82), smoothstep(0.38, 0.62, sw)), gk * 0.75);
            }
            // snow settles on the flats and in the hollows of the painted detail; steep rock stays bare
            // (the Rime Steps: paving is swept, tracks are trodden down, flat rock keeps snow only in its hollows)
            float snowIn = sb.a * (1.0 - uMud) * (1.0 - uRime * (sb.g * (0.9 - 0.45 * uScour) + sa.g * (0.5 - 0.3 * uScour) + sa.b * 0.35)); // (the Heights' wind packs snow into the paving joints and over the tracks)
            float snowK = smoothstep(0.12, 0.7, snowIn * (1.0 - slope * 0.85) + (0.5 - acc.a) * 0.35);
            // (the Rime Steps' snow is a touch greyer and bluer, and keeps more of the painted relief, so it never blows out)
            vec3 snowC = mix(vec3(0.86, 0.9, 0.96), vec3(0.74, 0.79, 0.87), uRime) * (0.9 + macro * 0.16);
            // (the Windward Heights: the wind packs the snow hard and bright and scours it into long streaks along the west wind,
            // shallow ridges with blue in their troughs)
            if (uScour > 0.5) {
              float st = texture(tAlb, vec3(vec2(wuv.x / 53.0, wuv.y / 3.4) + vec2(0.0, macro * 0.8), 0.0)).g;
              float st2 = texture(tAlb, vec3(vec2(wuv.x / 23.0, wuv.y / 1.6) + 0.37, 2.0)).g;
              float ridge = smoothstep(0.35, 0.75, st * 0.65 + st2 * 0.45);
              snowC = mix(vec3(0.78, 0.84, 0.93), vec3(0.95, 0.97, 1.0), ridge) * (0.94 + macro * 0.1);
              nacc = mix(nacc, vec3(0.0, (ridge - 0.5) * 0.5, 1.0), snowK * 0.5);
            }
            acc.rgb = mix(acc.rgb, snowC, snowK);
            nacc = mix(nacc, vec3(0.0, 0.0, 1.0), snowK * (0.7 - 0.4 * uRime));
            // wet sand: the band of beach just above the sea and lake, darker, cooler and smoother where the swash reaches
            float wet = sa.r * (1.0 - smoothstep(${(WORLD.water + 0.04).toFixed(3)}, ${(WORLD.water + 0.9).toFixed(3)}, vWPos.y));
            acc.rgb = mix(acc.rgb, acc.rgb * vec3(0.66, 0.68, 0.72), wet * 0.85);
            nacc = mix(nacc, vec3(0.0, 0.0, 1.0), wet * 0.5);
            // wet mud (Tidewater Sound, the snow channel): dark grey-brown, smooth, with pale streaks where it dries, glossy below
            // the highest tide; the shingle there stays dark and wet up to the same line
            if (uMud > 0.5) {
              float mk = smoothstep(0.08, 0.65, sb.a + (0.5 - acc.a) * 0.2);
              float tideWet = 1.0 - smoothstep(1.1, 1.7, vWPos.y);
              float streak = texture(tAlb, vec3(vec2(wuv.x / 9.0, wuv.y / 31.0) + macro * 0.4, 3.0)).g;
              vec3 mudC = mix(vec3(0.17, 0.155, 0.13), vec3(0.3, 0.27, 0.22), smoothstep(0.35, 0.75, streak * 0.6 + macro * 0.5));
              mudC = mix(mudC, mudC * 0.72, tideWet) * uMudTint;
              acc.rgb = mix(acc.rgb, mudC, mk);
              nacc = mix(nacc, vec3(0.0, 0.0, 1.0), mk * (0.55 + 0.35 * tideWet));
              gMud = mk * (0.35 + 0.65 * tideWet);
              acc.rgb = mix(acc.rgb, acc.rgb * vec3(0.7, 0.72, 0.74), sa.r * tideWet * (1.0 - mk) * 0.8);
            }
            // rain: flat ground darkens and goes glossy (snow and steep rock stay as they are)
            gWet = uWet * (1.0 - snowK) * (1.0 - slope * 0.7);
            acc.rgb *= 1.0 - 0.28 * gWet;
            nacc = mix(nacc, vec3(0.0, 0.0, 1.0), gWet * 0.35);
            // glowing seams (the Cinder Reach): thin cracks of heat through dark glassy rock, pulsing slowly
            gSeamK = uSeam * sa.a;
            // thin: only the low cracks in the rock's painted detail glow, and only along the middle of a seam
            float crack = smoothstep(0.5, 0.9, gSeamK) * (0.45 + 0.55 * smoothstep(0.35, 0.6, 1.0 - acc.a));
            gSeam = vec3(1.0, 0.32, 0.06) * crack * (0.9 + 0.3 * sin(uTime * 0.9 + vWPos.x * 0.21 + vWPos.z * 0.17)) * 1.1;
            acc.rgb = mix(acc.rgb, acc.rgb * vec3(0.42, 0.38, 0.37), smoothstep(0.0, 0.5, gSeamK));
            // ice (the Rime Steps, on the lush channel): blue-white, glassy and smooth, darker where it is deep, with pale cracks
            // and a frost bloom at its edges; frost dusts the bare rock too
            if (uRime > 0.5) {
              gIce = smoothstep(0.08, 0.6, sa.a);
              float deep = texture(tAlb, vec3(wuv / 37.0, 6.0)).a;
              vec3 iceC = mix(vec3(0.36, 0.58, 0.74), vec3(0.74, 0.86, 0.94), smoothstep(0.25, 0.75, deep * 0.7 + macro * 0.5));
              float cr = texture(tAlb, vec3(wuv / 13.0, 6.0)).a;
              iceC = mix(iceC, vec3(0.9, 0.95, 1.0), smoothstep(0.06, 0.0, abs(cr - 0.52)) * 0.7);
              iceC = mix(iceC, vec3(0.88, 0.93, 0.98), smoothstep(0.6, 0.15, sa.a) * 0.6);
              acc.rgb = mix(acc.rgb, iceC, gIce);
              nacc = mix(nacc, vec3(0.0, 0.0, 1.0), gIce * 0.85);
              float frost = sa.b * (1.0 - snowK) * smoothstep(0.35, 0.65, acc.a);
              acc.rgb = mix(acc.rgb, vec3(0.8, 0.86, 0.92), frost * 0.45);
              acc.rgb *= vec3(0.96, 0.98, 1.03);
            }
            diffuseColor.rgb *= acc.rgb;
            gNrm = normalize(nacc);
          }
        `)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.3, gWet * 0.75);
          roughnessFactor = mix(roughnessFactor, 0.42, smoothstep(0.0, 0.5, gSeamK));
          roughnessFactor = mix(roughnessFactor, 0.16, gIce);
          roughnessFactor = mix(roughnessFactor, 0.24, gMud);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += gSeam;`)
        .replace('#include <normal_fragment_maps>', `
          {
            vec3 mapN = gNrm;
            mapN.xy *= normalScale;
            normal = normalize(tbn * mapN);
          }
        `);
    };
    m.customProgramCacheKey = () => 'terrain';
    return m;
  }

  buildChunks(nc, segs) {
    const csx = this.sizeX / nc, csz = this.sizeZ / nc;
    for (let cj = 0; cj < nc; cj++) for (let ci = 0; ci < nc; ci++) {
      const g = new THREE.PlaneGeometry(csx, csz, segs, segs);
      g.rotateX(-Math.PI / 2);
      const x0 = this.minX + (ci + 0.5) * csx, z0 = this.minZ + (cj + 0.5) * csz;
      g.translate(x0, 0, z0);
      const p = g.attributes.position, nr = g.attributes.normal, n = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        p.setY(i, this.height(x, z));
        this.normal(x, z, n);
        nr.setXYZ(i, n.x, n.y, n.z);
      }
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const mesh = new THREE.Mesh(g, this.material);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.group.add(mesh);
    }
  }
}
