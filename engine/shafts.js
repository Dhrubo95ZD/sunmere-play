// Sun haze: soft additive patches of lit air in the gaps in the canopy (RF.3: these were long slanting beams with
// streaks, which read as rays; now each is a short, wide oval of warm haze with no streaks and no hard edges).
// Each patch is a camera-facing card leaning along the sun (so it reads as a volume from any angle) and
// brightens and dims as cloud shadows drift over it.
import * as THREE from 'three';
import { G } from './globals.js';

export function createShafts(spots, sunDir) {
  const base = new THREE.PlaneGeometry(1, 1, 1, 2); // (RF.3) a smooth oval needs no long strip
  base.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const n = spots.length;
  const iPos = new Float32Array(n * 3), iSize = new Float32Array(n * 4);
  spots.forEach((s, i) => {
    iPos.set([s.x, s.y, s.z], i * 3);
    iSize.set([s.w, s.len, s.k, Math.random() * 100], i * 4);
  });
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
  geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(iSize, 4));
  geo.instanceCount = n;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uSun: { value: sunDir }, // shared with the engine (kept normalised there): follows the sun down at dusk
      uColor: { value: new THREE.Color('#ffd08a') },
      uTime: G.time,
      uCloudTex: G.cloudTex,
      uCloudOffset: G.cloudOffset,
      uStrength: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 iPos; attribute vec4 iSize;
      uniform vec3 uSun; uniform float uTime; uniform sampler2D uCloudTex; uniform vec2 uCloudOffset;
      varying vec2 vUv; varying float vInt; varying float vSeed;
      void main() {
        vec3 axis = normalize(uSun);
        float L = min(iSize.y, iSize.x * 1.5); // short: a patch, never a long beam
        vec3 mid = iPos + axis * L * 0.5;
        vec3 toCam = normalize(cameraPosition - mid);
        vec3 side = cross(axis, toCam);
        float facing = length(side);
        side /= max(facing, 1e-3);
        vec3 wp = iPos + axis * (position.y * L) + side * position.x * iSize.x * 1.6;
        // slight sway with the canopy
        wp.xz += vec2(sin(uTime * 0.6 + iSize.w), cos(uTime * 0.5 + iSize.w * 1.3)) * 0.25 * position.y;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mv;
        float cl = texture2D(uCloudTex, iPos.xz * 0.0026 + uCloudOffset).r;
        float dist = -mv.z;
        vInt = iSize.z * clamp(1.0 - cl * 0.75, 0.0, 1.0) * (0.8 + 0.2 * sin(uTime * 0.35 + iSize.w))
             * smoothstep(0.12, 0.45, facing) * (1.0 - smoothstep(110.0, 220.0, dist)) * smoothstep(6.0, 16.0, dist);
        vUv = uv; vSeed = iSize.w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime, uStrength;
      varying vec2 vUv; varying float vInt; varying float vSeed;
      float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
      float vn(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
      void main() {
        // a soft oval: a smooth falloff from the middle in every direction, no bands, streaks or edges
        vec2 q = (vUv - vec2(0.5, 0.42)) * vec2(2.0, 2.2);
        float r2 = dot(q, q);
        float a = exp(-r2 * 2.6) * (1.0 - smoothstep(0.75, 1.0, r2)) * (0.85 + 0.15 * vn(vSeed + uTime * 0.05)) * vInt * uStrength;
        vec3 c = mix(uColor, vec3(1.0, 0.96, 0.85), 0.3);
        gl_FragColor = vec4(c * a * 0.26, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.userData.spots = spots;
  return mesh;
}
