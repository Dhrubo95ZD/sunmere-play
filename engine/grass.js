// GPU grass field that wraps around the camera focus. Density and colour come from the terrain splat maps;
// tufts sway with travelling gusts and bend away from nearby characters.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, QUALITY } from './globals.js';
import { patchWorld } from './materials.js';
import { grassCardTex, lavenderCardTex, flowerCardTex } from './textures.js';
import { mulberry32 } from '/sunmere-play/shared/noise.js';

function atlas() {
  // 2x2 atlas: tall grass, short grass, flowers, lavender
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const tall = grassCardTex('tall', ['#3c5a20', '#6c8e2e', '#a6bd4c', '#dcdd80'], { blades: 80, h: 0.98 });
  const short = grassCardTex('short', ['#40601f', '#78983a', '#b0c45a', '#e4e294'], { blades: 60, h: 0.7 });
  x.drawImage(tall.map.image, 0, 0, 256, 256);
  x.drawImage(short.map.image, 256, 0, 256, 256);
  x.drawImage(flowerCardTex().map.image, 0, 256, 256, 256);
  x.drawImage(lavenderCardTex().map.image, 256, 256, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(4, QUALITY.anisotropy || 4);
  return t;
}

export function createGrass(terrain) {
  const N = Math.round(52000 * QUALITY.grassDensity);
  const TILE = QUALITY.grassTile || 74; // the Mobile preset keeps a smaller field around the hero
  // D11: a tuft is three crossed cards of 3 bending segments (18 triangles); the phone presets (QUALITY.grassLod) use two
  // crossed cards of 2 segments (8 triangles), less than half the vertex and overdraw work on the tiled GPU
  const lite = QUALITY.grassLod ?? !!QUALITY.mobile;
  const a = new THREE.PlaneGeometry(1.0, 0.8, 1, lite ? 2 : 3); a.translate(0, 0.4, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const c2 = a.clone(); c2.rotateY(Math.PI / 4);
  const base = mergeGeometries(lite ? [a, b] : [a, b, c2]);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  for (const k of ['position', 'normal', 'uv']) geo.setAttribute(k, base.attributes[k]);
  const off = new Float32Array(N * 2), rnd = new Float32Array(N * 4);
  const rng = mulberry32(777);
  for (let i = 0; i < N; i++) {
    off[i * 2] = rng() * TILE; off[i * 2 + 1] = rng() * TILE;
    rnd[i * 4] = rng(); rnd[i * 4 + 1] = rng(); rnd[i * 4 + 2] = rng(); rnd[i * 4 + 3] = rng();
  }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 2));
  geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 4));
  geo.instanceCount = N;

  const mat = new THREE.MeshStandardMaterial({ map: atlas(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95, envMapIntensity: 0.6 });
  mat.alphaToCoverage = true;
  patchWorld(mat, { cloud: true, noFlip: true });
  const basePatch = mat.onBeforeCompile;
  const uniforms = {
    uFocus: { value: new THREE.Vector2() },
    uTile: { value: TILE },
    tHeight: { value: terrain.heightTex },
    tSplatA: { value: terrain.splatA },
    tSplatB: { value: terrain.splatB },
    uWorld: terrain.uWorld, uHeightUV: terrain.uHeightUV,
    uPush: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, -999, 0, 0)) },
  };
  mat.onBeforeCompile = (shader) => {
    basePatch(shader);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec2 aOffset; attribute vec4 aRand;
        uniform vec2 uFocus; uniform float uTile; uniform sampler2D tHeight; uniform sampler2D tSplatA; uniform sampler2D tSplatB;
        uniform vec4 uWorld; uniform vec4 uHeightUV; uniform vec4 uPush[8];
        varying vec3 vGrassCol;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 cell = aOffset + floor((uFocus - aOffset) / uTile + 0.5) * uTile;
        float dist = length(cell - uFocus);
        // D11: a tuft that will not show (outside the round field, the square tile's corners are ~21% of the instances, or
        // too sparse for its ground) skips the rest of the shader: same picture, far less vertex work
        float show = 0.0, hgt = 0.0;
        vec4 sa = vec4(0.0), sb = vec4(0.0);
        if (dist < uTile * 0.5) {
          vec2 suv = (cell - uWorld.xy) * uWorld.zw;
          sa = texture2D(tSplatA, suv);
          sb = texture2D(tSplatB, suv);
          float dens = clamp(1.0 - sa.g * 1.7 - sa.b * 1.6 - sb.g * 2.5 - sa.r * 1.45 - sb.b * 1.6, 0.0, 1.0);
          dens *= mix(1.0, 0.6, sb.r) * (1.0 - smoothstep(0.12, 0.45, sb.a));
          float edge = 1.0 - smoothstep(uTile * 0.34, uTile * 0.5, dist);
          show = step(aRand.w, dens) * edge;
          if (show > 0.0) { hgt = texture2D(tHeight, (cell - uHeightUV.xy) * uHeightUV.zw).r; if (hgt < 0.15) show = 0.0; }
        }
        if (show <= 0.0) { transformed = vec3(cell.x, -1.0e4, cell.y); vMapUv = vec2(0.0); vGrassCol = vec3(0.0); }
        else {
          // tuft type from the atlas: 0 tall, 1 short, 2 flowers, 3 lavender
          float lush = sa.a;
          float flowerChance = mix(0.035, 0.16, lush) * (1.0 - sb.r) * (1.0 - sa.r);
          float type = aRand.z < flowerChance ? (aRand.z < flowerChance * mix(0.3, 0.6, lush) ? 3.0 : 2.0) : (aRand.y > 0.55 ? 1.0 : 0.0);
          vec2 cellUv = vec2(mod(type, 2.0), 1.0 - floor(type / 2.0)) * 0.5;
          vMapUv = uv * 0.5 + cellUv;
          float rot = aRand.x * 6.2831;
          float sc = (0.55 + aRand.y * 0.55) * show * mix(1.0, 1.3, lush) * mix(1.0, 0.8, sa.r);
          if (type >= 2.0) sc *= 0.85;
          vec3 p = position * sc;
          float cr = cos(rot), sr = sin(rot);
          p.xz = vec2(cr * p.x - sr * p.z, sr * p.x + cr * p.z);
          float tip = clamp(position.y / 0.8, 0.0, 1.0);
          // wind: travelling gust fronts + per-tuft flutter
          float ph = dot(cell, vec2(0.071, 0.053));
          float gust = 0.5 + 0.5 * sin(uTime * 0.42 - dot(cell, uWindDir) * 0.035) * (0.65 + 0.35 * sin(uTime * 0.13 + cell.x * 0.017));
          float sway = sin(uTime * 1.9 + ph * 6.0 + aRand.z * 4.0) * 0.5 + 0.55;
          float flick = sin(uTime * 7.0 + aRand.x * 30.0) * 0.06;
          vec2 wv = uWindDir * (sway * gust * 0.32 + flick) * uWindStrength;
          // characters part the grass as they walk through it
          vec2 pushV = vec2(0.0); float flat_ = 0.0;
          for (int i = 0; i < 8; i++) {
            vec4 P = uPush[i];
            vec2 dd = cell - P.xz;
            float dl = length(dd);
            float k = (1.0 - smoothstep(P.w * 0.25, P.w, dl)) * step(abs(P.y - hgt), 2.5);
            pushV += normalize(dd + 1e-4) * k * 0.65;
            flat_ = max(flat_, k);
          }
          p.xz += (wv + pushV) * tip * tip * sc;
          p.y *= 1.0 - flat_ * 0.5 * tip;
          transformed = vec3(cell.x, hgt - 0.03, cell.y) + p;
          // colour: meadow / lush / forest / dry, with per-tuft variation
          vec3 meadow = vec3(0.95, 1.0, 0.82);
          vec3 lushC = vec3(0.78, 1.08, 0.72);
          vec3 forestC = vec3(0.62, 0.7, 0.45);
          vec3 dryC = vec3(1.25, 1.05, 0.6);
          vec3 col = mix(meadow, lushC, lush);
          col = mix(col, forestC, sb.r * 0.8);
          col = mix(col, dryC, clamp(sa.r * 1.4 + sa.g * 0.6, 0.0, 1.0));
          col *= 0.82 + aRand.y * 0.3;
          if (type >= 2.0) col = vec3(1.0);
          vGrassCol = col * mix(0.55, 1.08, tip);
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrassCol;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= vGrassCol;');
  };
  mat.customProgramCacheKey = () => 'grassfield';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.setFocus = (x, z) => uniforms.uFocus.value.set(x, z);
  mesh.userData.setPushers = (list) => {
    for (let i = 0; i < 8; i++) {
      const p = list[i];
      if (p) uniforms.uPush.value[i].set(p.x, p.y, p.z, p.r || 1.6); else uniforms.uPush.value[i].set(0, -999, 0, 0);
    }
  };
  return mesh;
}
