// Stylised water: lake surface with depth tint, shore foam, sky fresnel and sun glints; waterfall ribbon with mist.
import * as THREE from 'three';
import { LAKE, WATERFALL, WORLD, STREAM, streamLevel } from '/sunmere-play/shared/terrain.js';
import { G } from './globals.js';

// UniformsUtils.merge copies every uniform; put the shared ones back so time, night and clouds reach the water
function linkG(u) { u.uTime = G.time; u.uNight = G.night; u.uCloudTex = G.cloudTex; u.uCloudOffset = G.cloudOffset; u.uCloudAmount = G.cloudAmount; return u; }
import { waterNormalTex, waterfallTex, puffTex } from './textures.js';
import { smoke } from '../assets/dynamic.js';

export function createLake(terrain, sunDir) {
  const geo = new THREE.CircleGeometry(LAKE.r + 12, 96);
  geo.rotateX(-Math.PI / 2);
  return waterSheet(terrain, sunDir, geo, LAKE.x, LAKE.z);
}
// the sea east of the Harrow Coast: one big sheet out to the horizon (the shader only draws it where the ground is below it)
// rect { x, z, w, h } gives another sea its own sheet (the Cinder Reach: centred on the island, depth from its own terrain)
export function createSea(terrain, sunDir, rect = { x: 380 + 450, z: 40, w: 900, h: 1100 }) {
  const geo = new THREE.PlaneGeometry(rect.w, rect.h, 1, 1);
  geo.rotateX(-Math.PI / 2);
  return waterSheet(terrain, sunDir, geo, rect.x, rect.z);
}
function waterSheet(terrain, sunDir, geo, px, pz) {
  const nTex = waterNormalTex();
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: linkG(THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: G.time, uNight: G.night, tNormal: { value: nTex }, tHeight: { value: terrain.heightTex },
        uHeightUV: { value: terrain.uHeightUV.value.clone() },
        uSun: { value: sunDir }, // shared with the engine: follows the sun down at dusk
        uDeep: { value: new THREE.Color('#14495a') }, uShallow: { value: new THREE.Color('#3f8f8c') },
        uSky: { value: new THREE.Color('#8fb0c8') }, uFoam: { value: new THREE.Color('#d8e2dc') },
        uCloudTex: G.cloudTex, uCloudOffset: G.cloudOffset, uCloudAmount: G.cloudAmount,
      },
    ])),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
        uniform float uNight;
      #include <fog_pars_fragment>
      uniform float uTime; uniform sampler2D tNormal; uniform sampler2D tHeight; uniform vec4 uHeightUV; uniform vec3 uSun;
      uniform vec3 uDeep, uShallow, uSky, uFoam;
      uniform sampler2D uCloudTex; uniform vec2 uCloudOffset; uniform float uCloudAmount;
      varying vec3 vW;
      void main() {
        float ground = texture2D(tHeight, (vW.xz - uHeightUV.xy) * uHeightUV.zw).r;
        float depth = max(0.0, vW.y - ground);
        if (depth <= 0.0) discard;
        vec2 uv = vW.xz * 0.12;
        vec3 n1 = texture2D(tNormal, uv + vec2(uTime * 0.021, uTime * 0.013)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(tNormal, uv * 1.7 - vec2(uTime * 0.017, -uTime * 0.025)).xyz * 2.0 - 1.0;
        vec3 n = normalize(vec3((n1.xy + n2.xy) * 0.35, 1.0)).xzy;
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(clamp(1.0 - dot(n, V), 0.0, 1.0), 3.0); // (clamped: dot() can round past 1, and pow() of a negative is NaN)
        float d = smoothstep(0.0, 2.2, depth);
        vec3 col = mix(uShallow, uDeep, d);
        col = mix(col, uSky, fres * 0.55);
        // sun glints
        vec3 H = normalize(uSun + V);
        // capped and kept under the bloom threshold: the raised sun mirrors into the middle of the default view
        float spec = min(pow(max(0.0, dot(n, H)), 220.0) * 0.9, 0.32);
        col += vec3(1.0, 0.95, 0.85) * spec;
        // caustic-like shimmer in the shallows
        float sh = texture2D(tNormal, vW.xz * 0.35 + uTime * 0.04).r;
        col += (1.0 - d) * smoothstep(0.55, 0.8, sh) * 0.12;
        // shore foam: animated bands where the water thins out
        float f = smoothstep(0.42, 0.0, depth);
        float bands = sin(depth * 26.0 - uTime * 2.2 + n1.x * 3.0) * 0.5 + 0.5;
        // the swash: the waterline slides up and back on a slow cycle (staggered along the shore), with a foam lip on its edge
        float sw = (sin(uTime * 0.8 + vW.z * 0.045 + vW.x * 0.02) * 0.5 + 0.5) * 0.07;
        float edge = depth - sw;
        if (edge <= 0.0) discard;
        float lip = smoothstep(0.035, 0.0, edge) * (0.6 + 0.4 * smoothstep(0.03, 0.07, sw));
        float foam = f * (0.55 + 0.45 * bands) + smoothstep(0.12, 0.0, depth) + lip;
        foam *= smoothstep(0.3, 0.6, texture2D(tNormal, vW.xz * 0.6 + uTime * 0.03).g + 0.25);
        col = mix(col, uFoam, clamp(foam, 0.0, 1.0));
        float cl = texture2D(uCloudTex, vW.xz * 0.0026 + uCloudOffset).r;
        col *= 1.0 - cl * uCloudAmount;
        float alpha = clamp(0.55 + d * 0.4 + fres * 0.2 + foam, 0.0, 0.96) * smoothstep(0.0, 0.03, edge);
        gl_FragColor = vec4(min(col, vec3(0.98)) * (1.0 - 0.8 * smoothstep(0.25, 1.0, uNight)), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(px, WORLD.water + 0.02, pz);
  mesh.renderOrder = 2;
  return mesh;
}

// o (another fall than the glade's, e.g. the Rainward Gorge's): { x, z (the lip), top, foot (the pool's level), w (width),
// ry (the way it falls: 0 toward +z, as the glade's), lip (how far it runs over the lip), mist (0..1) }; the group stands
// at (x, 0, z) turned ry, so it can be moved and turned like any object
export function createWaterfall(terrain, o = null) {
  const g = new THREE.Group();
  const top = o ? o.top : WATERFALL.top, foot = o ? o.foot : 0, lip = o?.lip ?? 5;
  // ribbon following the lip and the fall
  const pts = [];
  const x = o ? 0 : WATERFALL.x, z0 = o ? -lip - 1 : WATERFALL.z - 6;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    // flows forward over the lip, then drops with gravity
    const zz = z0 + Math.min(t * 5, 1) * lip + Math.max(0, t - 0.2) * 3.5;
    const yy = top + 0.3 - Math.pow(Math.max(0, t - 0.15) / 0.85, 1.6) * (top - foot + 0.2) - Math.min(t, 0.15) * 0.4;
    pts.push(new THREE.Vector3(x, yy, zz));
  }
  const W = o?.w ?? 6;
  const pos = [], uv = [], idx = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) acc += pts[i].distanceTo(pts[i - 1]);
    const wv = W * (1 + i / pts.length * 0.25);
    for (let j = 0; j <= 8; j++) {
      const s = j / 8 - 0.5;
      const bulge = Math.cos(s * Math.PI) * 0.35;
      pos.push(pts[i].x + s * wv, pts[i].y, pts[i].z + bulge);
      uv.push(j / 8 * 2, acc / 6);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < 8; j++) {
    const a = i * 9 + j, b = a + 9;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const tex = waterfallTex();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { tMap: { value: tex }, uTime: G.time, uNight: G.night },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
        uniform float uNight;
      uniform sampler2D tMap; uniform float uTime; varying vec2 vUv;
      void main() {
        vec4 a = texture2D(tMap, vec2(vUv.x, vUv.y - uTime * 0.9));
        vec4 b = texture2D(tMap, vec2(vUv.x * 1.3 + 0.37, vUv.y * 0.8 - uTime * 1.35));
        vec3 c = mix(a.rgb, b.rgb, 0.5);
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(2.0, 1.82, vUv.x);
        float al = max(a.a, b.a) * edge;
        gl_FragColor = vec4((c * 1.1) * (1.0 - 0.8 * smoothstep(0.25, 1.0, uNight)), al * 0.92);
        #include <colorspace_fragment>
      }
    `,
  });
  const ribbon = new THREE.Mesh(geo, mat);
  ribbon.renderOrder = 3;
  g.add(ribbon);
  // mist + splash at the base
  const mk = o?.mist ?? 1;
  const mist = smoke({ rate: 7 * mk, life: 2.6, size: 2.6, rise: 1.6, color: 0xeef8ff, opacity: 0.5, spread: 2.5 * Math.max(1, W / 6) });
  mist.position.set(x, foot + 0.2, pts[pts.length - 1].z);
  g.add(mist);
  const mist2 = smoke({ rate: 3 * mk, life: 3.5, size: 4.5, rise: 0.6, color: 0xe6f6ff, opacity: 0.25, spread: 4 * Math.max(1, W / 6) });
  mist2.position.set(x, foot + 0.5, pts[pts.length - 1].z + 2);
  g.add(mist2);
  if (o) { g.position.set(o.x, 0, o.z); g.rotation.y = o.ry || 0; g.userData.ribbon = ribbon; }
  g.userData.update = (dt, t) => { mist.userData.update(dt, t); mist2.userData.update(dt, t); };
  return g;
}

// The village stream: a ribbon along the stream line at its (stepped) water level. Normals flow downstream,
// foam gathers at the banks and turns to white water on the falls; the ribbon is clipped where the bank rises
// above the surface (depth from the terrain height texture). The pond at the end uses the same material.
export function createStream(terrain, sunDir) {
  const P = STREAM.pts.map(([x, z]) => new THREE.Vector2(x, z));
  // resample every 0.7 m with smoothed tangents
  const samples = [];
  let acc = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], L = a.distanceTo(b);
    const n = Math.max(1, Math.ceil(L / 0.7));
    for (let k = 0; k < n; k++) samples.push({ p: a.clone().lerp(b, k / n), s: acc + (k / n) * L });
    acc += L;
  }
  samples.push({ p: P[P.length - 1].clone(), s: acc });
  // extend a little past both ends so the ribbon reaches under the falls and into the pond
  const HW = 4.6, pos = [], uv = [], slope = [], idx = [];
  samples.forEach((sm, i) => {
    const a = samples[Math.max(0, i - 3)].p, b = samples[Math.min(samples.length - 1, i + 3)].p;
    const t = b.clone().sub(a).normalize();
    const nrm = new THREE.Vector2(-t.y, t.x);
    const y = streamLevel(sm.s);
    const dy = Math.abs(streamLevel(sm.s + 0.6) - streamLevel(sm.s - 0.6)) / 1.2;
    for (let j = 0; j <= 6; j++) {
      const u = j / 6 - 0.5;
      pos.push(sm.p.x + nrm.x * u * 2 * HW, y, sm.p.y + nrm.y * u * 2 * HW);
      uv.push(sm.s, u);
      slope.push(dy);
    }
  });
  // wound so the faces point up (the ribbon is seen from above)
  for (let i = 0; i < samples.length - 1; i++) for (let j = 0; j < 6; j++) { const a = i * 7 + j, c = a + 7; idx.push(a, a + 1, c, c, a + 1, c + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('slope', new THREE.Float32BufferAttribute(slope, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = streamMaterial(terrain, sunDir, 1);
  // the ribbon's end runs into the pond: where both sheets were drawn the water doubled up into a darker wedge with the
  // ribbon's straight end edge showing; the ribbon now fades out inside the pond and the pond sheet carries it alone
  mat.uniforms.uPond.value.set(STREAM.pond.x, STREAM.pond.z, STREAM.pond.r + 3.5);
  const ribbon = new THREE.Mesh(geo, mat);
  ribbon.renderOrder = 2;
  const g = new THREE.Group();
  g.add(ribbon);
  // pond
  const pr = STREAM.pond.r + 3.5;
  const pg = new THREE.CircleGeometry(pr, 64);
  pg.rotateX(-Math.PI / 2);
  const pu = pg.attributes.position;
  const puv = new Float32Array(pu.count * 2), psl = new Float32Array(pu.count);
  for (let i = 0; i < pu.count; i++) { puv[i * 2] = pu.getX(i) * 0.3; puv[i * 2 + 1] = pu.getZ(i) * 0.05; }
  pg.setAttribute('uv', new THREE.BufferAttribute(puv, 2));
  pg.setAttribute('slope', new THREE.BufferAttribute(psl, 1));
  const pond = new THREE.Mesh(pg, streamMaterial(terrain, sunDir, 0.08));
  pond.position.set(STREAM.pond.x, streamLevel(1e4) + 0.002, STREAM.pond.z);
  pond.renderOrder = 2;
  g.add(pond);
  return g;
}

// running water along polylines whose surface follows the ground (the Rime Steps' meltwater channels): levelAt(x, z) gives
// the surface at a centre point, or null where the channel is frozen or meets the sea (the ribbon breaks there). Glacier blue.
export function createChannels(terrain, sunDir, lines, levelAt, HW = 3.2) {
  const pos = [], uv = [], slope = [], idx = [];
  for (const line of lines) {
    const P = line.map(([x, z]) => new THREE.Vector2(x, z)), S = [];
    let acc = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], L = a.distanceTo(b), n = Math.max(1, Math.ceil(L / 0.8));
      for (let k = 0; k < n; k++) S.push({ p: a.clone().lerp(b, k / n), s: acc + (k / n) * L });
      acc += L;
    }
    S.push({ p: P[P.length - 1].clone(), s: acc });
    for (const sm of S) sm.y = levelAt(sm.p.x, sm.p.y);
    let prev = -1;
    S.forEach((sm, i) => {
      if (sm.y === null) { prev = -1; return; }
      const a = S[Math.max(0, i - 3)].p, b = S[Math.min(S.length - 1, i + 3)].p, t = b.clone().sub(a).normalize(), nrm = new THREE.Vector2(-t.y, t.x);
      const ya = S[Math.max(0, i - 1)].y, yb = S[Math.min(S.length - 1, i + 1)].y;
      const dy = ya !== null && yb !== null ? Math.abs(yb - ya) / 1.6 : 0;
      const base = pos.length / 3;
      for (let j = 0; j <= 4; j++) { const u = j / 4 - 0.5; pos.push(sm.p.x + nrm.x * u * 2 * HW, sm.y, sm.p.y + nrm.y * u * 2 * HW); uv.push(sm.s, u); slope.push(Math.min(0.025, dy * 0.25)); }
      if (prev >= 0) for (let j = 0; j < 4; j++) { const p0 = prev + j, c = base + j; idx.push(p0, p0 + 1, c, c, p0 + 1, c + 1); }
      prev = base;
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('slope', new THREE.Float32BufferAttribute(slope, 1));
  geo.setIndex(idx);
  // the ribbon's faces may point either way (the lines run west and east): draw both sides
  geo.computeVertexNormals();
  const mat = streamMaterial(terrain, sunDir, 1);
  mat.side = THREE.DoubleSide;
  mat.uniforms.uDeep.value.set('#0c3c52'); mat.uniforms.uShallow.value.set('#4a9ab0'); mat.uniforms.uSky.value.set('#c4dcec'); mat.uniforms.uFoam.value.set('#eef6fa');
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0.01; m.renderOrder = 2;
  return m;
}

function streamMaterial(terrain, sunDir, flow) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: linkG(THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: G.time, uNight: G.night, tNormal: { value: waterNormalTex() }, tHeight: { value: terrain.heightTex },
        uHeightUV: { value: terrain.uHeightUV.value.clone() },
        uSun: { value: sunDir }, uFlow: { value: flow }, uPond: { value: new THREE.Vector3(0, 0, 0) }, // uSun is shared with the engine: it follows the sun down at dusk
        uDeep: { value: new THREE.Color('#0e3540') }, uShallow: { value: new THREE.Color('#2e6e66') },
        uSky: { value: new THREE.Color('#9ab8cc') }, uFoam: { value: new THREE.Color('#dfe8e4') },
        uCloudTex: G.cloudTex, uCloudOffset: G.cloudOffset, uCloudAmount: G.cloudAmount,
      },
    ])),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float slope;
      varying vec3 vW; varying vec2 vUv; varying float vSlope;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vUv = uv; vSlope = slope;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
        uniform float uNight;
      #include <fog_pars_fragment>
      uniform float uTime, uFlow; uniform vec3 uPond; uniform sampler2D tNormal; uniform sampler2D tHeight; uniform vec4 uHeightUV; uniform vec3 uSun;
      uniform vec3 uDeep, uShallow, uSky, uFoam;
      uniform sampler2D uCloudTex; uniform vec2 uCloudOffset; uniform float uCloudAmount;
      varying vec3 vW; varying vec2 vUv; varying float vSlope;
      void main() {
        float ground = texture2D(tHeight, (vW.xz - uHeightUV.xy) * uHeightUV.zw).r;
        float depth = max(0.0, vW.y - ground);
        if (depth <= 0.0) discard;
        float speed = uFlow * (0.35 + vSlope * 3.0);
        vec2 f1 = vec2(vUv.x * 0.16 - uTime * speed * 0.55, vUv.y * 0.9);
        vec2 f2 = vec2(vUv.x * 0.27 - uTime * speed * 0.8 + 0.37, vUv.y * 1.6 + 0.2);
        vec3 n1 = texture2D(tNormal, f1).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(tNormal, f2).xyz * 2.0 - 1.0;
        vec3 n = normalize(vec3((n1.xy + n2.xy) * (0.4 + vSlope * 2.0), 1.0)).xzy;
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(clamp(1.0 - dot(n, V), 0.0, 1.0), 3.0); // (clamped: dot() can round past 1, and pow() of a negative is NaN)
        float d = smoothstep(0.05, 0.85, depth);
        vec3 col = mix(uShallow, uDeep, d);
        // broken sky reflection drifting with the current
        float refl = texture2D(tNormal, vec2(vUv.x * 0.05 - uTime * speed * 0.2, vUv.y * 0.35 + 0.5)).b;
        col = mix(col, uSky, fres * 0.45 + smoothstep(0.62, 0.9, refl) * 0.12);
        vec3 H = normalize(uSun + V);
        // capped and kept under the bloom threshold: the raised sun mirrors into the middle of the default view
        col += vec3(1.0, 0.95, 0.85) * min(pow(max(0.0, dot(n, H)), 200.0) * 0.8, 0.3);
        // pebbles glimpsed through the shallows
        float sh = texture2D(tNormal, vW.xz * 0.4 + vec2(uTime * 0.03, 0.0)).r;
        col += (1.0 - d) * smoothstep(0.55, 0.8, sh) * 0.1;
        // foam: a thin broken line at the banks; on the falls, streaks stretched along the flow (not a sheet)
        float bank = smoothstep(0.2, 0.0, depth);
        float bands = sin(depth * 34.0 - uTime * 2.4 + n1.x * 3.0) * 0.5 + 0.5;
        float falls = smoothstep(0.03, 0.14, vSlope);
        float streak = texture2D(tNormal, vec2(vUv.x * 0.9 - uTime * 1.6, vUv.y * 2.6)).g * 0.6 + texture2D(tNormal, vec2(vUv.x * 1.7 - uTime * 2.3 + 0.3, vUv.y * 5.0)).r * 0.4;
        float below = smoothstep(0.0, 0.05, vSlope) * (1.0 - falls);
        float foam = bank * (0.35 + 0.45 * bands) * smoothstep(0.3, 0.6, texture2D(tNormal, f1 * 1.7).g + 0.2)
                   + falls * smoothstep(0.48, 0.72, streak) * 0.9 + below * smoothstep(0.6, 0.8, streak) * 0.5
                   + smoothstep(0.06, 0.0, depth) * 0.6;
        col = mix(col, uFoam, clamp(foam, 0.0, 1.0));
        float cl = texture2D(uCloudTex, vW.xz * 0.0026 + uCloudOffset).r;
        col *= 1.0 - cl * uCloudAmount;
        float alpha = clamp(0.42 + d * 0.45 + fres * 0.15 + foam, 0.0, 0.93) * smoothstep(0.0, 0.06, depth);
        if (uPond.z > 0.0) { alpha *= smoothstep(uPond.z - 4.0, uPond.z - 0.5, length(vW.xz - uPond.xy)); if (alpha < 0.004) discard; }
        gl_FragColor = vec4(min(col, vec3(0.98)) * (1.0 - 0.8 * smoothstep(0.25, 1.0, uNight)), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}
