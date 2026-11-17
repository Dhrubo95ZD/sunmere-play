// Weather: rain over the green lands, sandstorms over the Sunscar. The state is a pure function of the shared server
// clock and the place you stand, so every player sees the same sky without any network traffic.
//   weatherAt(x, z, t) -> { rain, sand } in 0..1
//   createRain() -> slanted rain streaks drawn around the camera focus in one instanced draw call
import * as THREE from 'three';
import { vnoise, smoothstep } from '/sunmere-play/shared/noise.js';
import { desertWeight, highreachWeight, snowWeight, inReach, inRime, inHeights, inRainward, inWeald } from '/sunmere-play/shared/terrain.js';
import { rainLevel } from '/sunmere-play/shared/rainward.js';
import { galeLevel } from '/sunmere-play/shared/weald.js';
import { DUNGEON_MIN_X } from '/sunmere-play/shared/dungeons.js';
import { G } from './globals.js';

export function weatherAt(x, z, t) {
  if (x >= DUNGEON_MIN_X) return { rain: 0, sand: 0, snow: 0, ash: 0 };
  // the Cinder Reach: no rain or storms, but a light fall of ash drifts down most of the time, heavier when the cone breathes
  if (inReach(x, z)) {
    const a = vnoise(t / 180, 5.3, 816) * 0.7 + vnoise(t / 60, 6.1, 817) * 0.3;
    return { rain: 0, sand: 0, snow: 0, ash: 0.3 + smoothstep(0.5, 0.75, a) * 0.45 };
  }
  // the Rime Steps: never rain; snow most of the time, and now and then a blizzard blows down off the glacier
  if (inRime(x, z)) {
    const a = vnoise(t / 240, 8.3, 818) * 0.7 + vnoise(t / 75, 9.1, 819) * 0.3;
    const blizzard = smoothstep(0.64, 0.78, a);
    return { rain: 0, sand: 0, ash: 0, snow: Math.min(1, 0.4 + smoothstep(0.4, 0.64, a) * 0.3 + blizzard * 0.3), blizzard };
  }
  // the Windward Heights: clear and bright above the cloud, but the wind never stops: snow blown off the drifts most of the
  // time (gale: the flakes drive sideways), and now and then a squall of it thick enough to hide the next ridge
  if (inHeights(x, z)) {
    const a = vnoise(t / 200, 10.3, 821) * 0.7 + vnoise(t / 65, 11.7, 822) * 0.3;
    const blizzard = smoothstep(0.7, 0.84, a) * 0.85;
    return { rain: 0, sand: 0, ash: 0, snow: Math.min(1, 0.32 + smoothstep(0.45, 0.7, a) * 0.2 + blizzard * 0.3), blizzard, gale: 1 };
  }
  // the Rainward Gorge: its own rain on the world clock, the same for every player (shared/rainward.js rainLevel): dry
  // spells and downpours (pour: heavier than any valley rain, the air closes in grey-green: renderer setWeather's pour)
  if (inRainward(x, z)) {
    const r = rainLevel(t);
    return { rain: r, sand: 0, snow: 0, ash: 0, pour: r };
  }
  // the Russet Weald: dry (the far side of the range), but a gale on the world clock, the same for every player
  // (shared/weald.js galeLevel): calm spells and gales that strip the leaves and throw the half-cut standards down
  if (inWeald(x, z)) return { rain: 0, sand: 0, snow: 0, ash: 0, gale: galeLevel(t) };
  const desert = desertWeight(x, z);
  // slow fronts: about a quarter of the time it rains in the green lands, a fifth of the time the desert blows
  const a = vnoise(t / 260, 3.7, 811) * 0.7 + vnoise(t / 90, 1.3, 812) * 0.3;
  const b = vnoise(t / 220, 7.1, 813) * 0.7 + vnoise(t / 70, 2.9, 814) * 0.3;
  const wet = smoothstep(0.58, 0.72, a) * (1 - desert);
  // up on the Highreach plateau the same fronts come down as snow, and a light flurry falls most of the time
  const hw = Math.max(highreachWeight(x, z), snowWeight(x, z));
  return { ash: 0, rain: wet * (1 - hw), sand: smoothstep(0.6, 0.74, b) * desert, snow: hw * Math.min(1, 0.32 + wet * 0.8 + (vnoise(t / 50, 4.4, 815) - 0.5) * 0.3) };
}

// day and night: a 24-minute day (about 13 min of sun, a dusk, 5 min of night, a dawn), shared by everyone
export function nightAt(t) {
  const p = ((t / 1440 + 0.12) % 1 + 1) % 1;
  return smoothstep(0.55, 0.66, p) * (1 - smoothstep(0.88, 0.98, p));
}

// soft flakes drifting down around the camera focus, one instanced draw call
export function createSnow(n = 2200) {
  const quad = new THREE.PlaneGeometry(0.09, 0.09);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  const off = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { off[i * 4] = Math.random() * 44; off[i * 4 + 1] = Math.random() * 20; off[i * 4 + 2] = Math.random() * 44; off[i * 4 + 3] = Math.random(); }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: G.time, uFocus: { value: new THREE.Vector3() }, uAmount: { value: 0 }, uWind: { value: new THREE.Vector2(0.6, 0.2) }, uNight: G.night, uColor: { value: new THREE.Color(0.96, 0.97, 1.0) }, uFall: { value: 1 }, uSize: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec4 aOff;
      uniform float uTime, uAmount, uFall, uSize; uniform vec3 uFocus; uniform vec2 uWind;
      varying float vA; varying vec2 vUv;
      void main() {
        float H = 20.0;
        float y = mod(aOff.y - uTime * (1.2 + aOff.w * 1.1) * uFall, H);
        vec3 w = vec3(uFocus.x + mod(aOff.x - uFocus.x, 44.0) - 22.0, uFocus.y + y - 5.0, uFocus.z + mod(aOff.z - uFocus.z, 44.0) - 22.0);
        w.xz += uWind * (H - y) * 0.12 + vec2(sin(uTime * 0.9 + aOff.w * 31.0), cos(uTime * 0.7 + aOff.w * 17.0)) * 0.35;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        // (in a squall, uSize > 1: the flakes come bigger and stretch out along the wind into driven streaks)
        float k = clamp(uSize - 1.0, 0.0, 2.0), s = (0.7 + aOff.w * 0.8) * (1.0 + k * 0.25);
        vec3 ax = right, ay = up;
        if (k > 0.0) {
          vec3 wd = vec3(uWind.x, -0.12, uWind.y);
          vec3 sx = right * dot(wd, right) + up * dot(wd, up) + right * 0.002;
          ax = normalize(sx); ay = normalize(cross(cross(right, up), ax));
        }
        vec3 p = w + (ax * position.x * (1.0 + k * 3.0) + ay * position.y * (1.0 - k * 0.2)) * s;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        // flakes right in front of the lens would be big soft blobs: fade them out
        vA = (aOff.w < uAmount ? 1.0 : 0.0) * smoothstep(4.0, 8.0, -mv.z);
        vUv = uv;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight; uniform vec3 uColor;
      varying float vA; varying vec2 vUv;
      void main() {
        if (vA < 0.02) discard;
        float d = length(vUv - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.2, d);
        gl_FragColor = vec4(uColor * (1.0 - 0.55 * uNight), 0.85 * a * vA);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  mesh.userData.set = (focus, amount, wind, size = 1) => { mat.uniforms.uFocus.value.copy(focus); mat.uniforms.uAmount.value = amount; mat.uniforms.uSize.value = size; if (wind) mat.uniforms.uWind.value.set(wind.x * 0.6, wind.y * 0.6); mesh.visible = amount > 0.01; };
  // ash instead of snow: grey flecks that fall slower
  mesh.userData.setKind = (ash) => { mat.uniforms.uColor.value.setRGB(...(ash ? [0.3, 0.29, 0.28] : [0.96, 0.97, 1.0])); mat.uniforms.uFall.value = ash ? 0.45 : 1; };
  return mesh;
}

export function createRain(n = 2600) {
  const quad = new THREE.PlaneGeometry(0.022, 0.5); // short, thin streaks (long bright ones read as beams of light)
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  const off = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { off[i * 4] = Math.random() * 48; off[i * 4 + 1] = Math.random() * 24; off[i * 4 + 2] = Math.random() * 48; off[i * 4 + 3] = Math.random(); }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: G.time, uFocus: { value: new THREE.Vector3() }, uAmount: { value: 0 }, uWind: { value: new THREE.Vector2(0.6, 0.2) }, uHeavy: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aOff;
      uniform float uTime, uAmount, uHeavy; uniform vec3 uFocus; uniform vec2 uWind;
      varying float vA; varying vec2 vUv;
      void main() {
        float H = 24.0;
        float y = mod(aOff.y - uTime * (17.0 + aOff.w * 7.0), H);
        vec3 w = vec3(uFocus.x + mod(aOff.x - uFocus.x, 48.0) - 24.0, uFocus.y + y - 6.0, uFocus.z + mod(aOff.z - uFocus.z, 48.0) - 24.0);
        w.xz += uWind * (H - y) * 0.05;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        // (a downpour, uHeavy > 0: longer, faster streaks; the Rainward Gorge)
        vec3 p = w + right * position.x * (1.0 + uHeavy * 0.5) + vec3(uWind.x, 1.0, uWind.y) * position.y * (1.0 + uHeavy * 0.7);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        // drops right at the lens smear into big bright bars: fade them, and thin the far ones out too
        vA = (aOff.w < uAmount ? 1.0 : 0.0) * smoothstep(2.5, 6.0, -mv.z) * (1.0 - smoothstep(26.0, 40.0, -mv.z));
        vUv = uv;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uHeavy; varying float vA; varying vec2 vUv;
      void main() {
        if (vA < 0.02) discard;
        float a = (1.0 + uHeavy * 0.35) * (1.0 - abs(vUv.x - 0.5) * 2.0) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        gl_FragColor = vec4(0.62, 0.68, 0.74, 0.3 * a * vA); // kept well under the bloom threshold
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  mesh.userData.set = (focus, amount, wind, heavy = 0) => { mat.uniforms.uFocus.value.copy(focus); mat.uniforms.uAmount.value = amount; mat.uniforms.uHeavy.value = heavy; if (wind) mat.uniforms.uWind.value.set(wind.x * 0.6, wind.y * 0.6); mesh.visible = amount > 0.01; };
  return mesh;
}
