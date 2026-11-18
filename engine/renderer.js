// Rendering core: renderer, scene, sun + sky light, stable shadows, post-processing.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { G, QUALITY, PASS } from './globals.js';
import { cloudTex } from './textures.js';
import { IS_MOBILE, setBgState } from './platform.js';
import { AtmospherePass } from './atmosphere.js';
import { patchCut } from './materials.js';
import { SETTINGS, FPS_EVENT, TOUCH_EVENT } from './settings.js';
import { createPacer, normalizeCap } from './pacer.js';
import { DynRes, ThermalGovernor } from './dynres.js';
import { hasDisplayPlugin, setPanelRate, watchRefresh, watchThermal } from './display.js';
import { SHADOW_LAYER, useShadowProxies } from '../game/layers.js';
import { freezeVersion } from '../game/freeze.js';
import { CoarseCull } from './coarse.js';
import { ShadowCache } from './shadowCache.js';

// soft sun shadows: more filter taps than three's 5 on the higher presets, and the Vogel disc turned by a hash of the
// shadow-map texel instead of the screen pixel. The shadow map is snapped to whole texels (updateShadow), so the filter
// pattern stays fixed to the ground and the soft edges no longer crawl when the camera moves.
{
  const taps = Math.max(5, Math.min(24, QUALITY.shadowTaps || 5)), C = THREE.ShaderChunk;
  const src = C.shadowmap_pars_fragment;
  const re = /float phi = interleavedGradientNoise\( gl_FragCoord\.xy \) \* PI2;\s*shadow = \(([\s\S]*?)\) \* 0\.2;/;
  if (re.test(src)) {
    C.shadowmap_pars_fragment = src.replace(re, `vec2 smT = floor( shadowCoord.xy * shadowMapSize );
				float phi = fract( 52.9829189 * fract( dot( smT, vec2( 0.06711056, 0.00583715 ) ) ) ) * PI2;
				shadow = 0.0;
				for ( int i = 0; i < ${taps}; i ++ ) shadow += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, ${taps}, phi ) * radius, shadowCoord.z ) );
				shadow /= ${taps}.0;`);
  }
}

// one shadow depth material per caster kind (perf): three draws every plain caster with one shared depth material, so a
// shadow pass that walks a skinned character, then its sword, then the next character's body re-derives the depth
// program at every switch between skinned, instanced, batched and plain (getParameters per draw). A skinned, instanced
// or batched caster with a plain material (no alpha cut-out, displacement or clipping, the cases three gives their own
// depth material) gets its kind's own MeshDepthMaterial after its first shadow draw: the same shader as before.
{
  const kinds = new Map();
  const plain = (m) => m && !Array.isArray(m) && !(m.alphaTest > 0) && !m.alphaMap && !m.displacementMap && !m.alphaToCoverage && !(m.clippingPlanes && m.clippingPlanes.length);
  for (const C of [THREE.SkinnedMesh, THREE.InstancedMesh, THREE.BatchedMesh]) {
    const base = C.prototype.onBeforeShadow, key = C.name;
    C.prototype.onBeforeShadow = function (renderer, object, camera, shadowCamera, geometry, depthMaterial, group) {
      base.call(this, renderer, object, camera, shadowCamera, geometry, depthMaterial, group);
      const cur = this.customDepthMaterial, ok = plain(this.material);
      if (cur === undefined) {
        if (!ok) return;
        let d = kinds.get(key);
        if (!d) { kinds.set(key, (d = new THREE.MeshDepthMaterial())); d.userData.kindDepth = true; }
        this.customDepthMaterial = d;
      } else if (!ok && cur.userData.kindDepth) this.customDepthMaterial = undefined; // its material changed to a cut-out
    };
  }
}

// the air of each outdoor area: height-fog density (per metre at the ground), its scale height, the volumetric sun
// strength, the morning mist and the most the fog may cover; bloom threshold (sunlit snow sits above the usual one)
const AIR = {
  valley: { fog: 0.0065, h: 7, vol: 0.0042, mist: 0.03, max: 0.5, bloom: 1.08 },
  reach: { fog: 0.011, h: 11, vol: 0.006, mist: 0.0, max: 0.6, bloom: 1.08 },
  rime: { fog: 0.008, h: 8, vol: 0.0035, mist: 0.02, max: 0.5, bloom: 1.3 },
  heights: { fog: 0.004, h: 6, vol: 0.003, mist: 0.0, max: 0.45, bloom: 1.75 },
  // the Russet Weald: a soft warm haze between the trunks, mist lying low (the hollows), a soft sun with no shafts of rays
  weald: { fog: 0.006, h: 4, vol: 0.0015, mist: 0.035, max: 0.45, bloom: 1.1 },
  indoor: { fog: 0.012, h: 3, vol: 0, mist: 0, max: 0.4, bloom: 1.08 },
};
const _sunNdc = new THREE.Vector3(), _fwd = new THREE.Vector3(), _lampAvg = new THREE.Color();
const _houseWarm = new THREE.Color(0xffd8a8), _hemiSave = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0), _right = new THREE.Vector3(), _sup = new THREE.Vector3(), _snap = new THREE.Vector3(), _fillOff = new THREE.Vector3(70, 55, -45), _dbs = new THREE.Vector2();

const SKY = {
  zenith: new THREE.Color('#3f74b8'),
  horizon: new THREE.Color('#e9cf9f'),
  ground: new THREE.Color('#4a5236'),
  sun: new THREE.Color('#ffe2b0'),
  haze: new THREE.Color('#b9b4a0'),
};

function makeSkyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: SKY.zenith }, horizon: { value: SKY.horizon }, ground: { value: SKY.ground },
      sunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() }, sunCol: { value: SKY.sun },
      uTime: G.time, uCover: { value: 0.42 }, uNight: { value: 0 }, uDusk: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith, horizon, ground, sunDir, sunCol;
      uniform float uTime, uCover, uNight, uDusk;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(horizon, zenith, pow(smoothstep(-0.02, 0.75, h), 0.65));
        c = mix(c, ground, smoothstep(0.0, -0.25, h));
        float sd = max(0.0, dot(d, sunDir));
        c += sunCol * (pow(sd, 900.0) * 6.0 + pow(sd, 18.0) * 0.35 + pow(sd, 3.0) * 0.08) * (1.0 - uNight);
        // a soft painted cloud deck: fbm projected on a high plane, drifting with the wind, thinning at the horizon
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.12) * 1.6 + vec2(uTime * 0.006, uTime * 0.0025);
          float n = fbm(uv) * 0.75 + fbm(uv * 2.7 + 3.1) * 0.25;
          float k = smoothstep(1.0 - uCover, 1.05 - uCover * 0.55, n) * smoothstep(0.02, 0.22, h);
          // lit from the sun side, shaded underneath; warm at dusk, dim blue-grey at night
          float lit = 0.72 + 0.28 * smoothstep(0.0, 1.0, sd) + (n - 0.5) * 0.35;
          vec3 cc = mix(vec3(0.97, 0.97, 0.95), vec3(1.0, 0.8, 0.5), uDusk * 0.7) * lit;
          cc = mix(cc, mix(horizon, zenith, 0.4) * 0.8, uCover * 0.45 - 0.15);
          cc = mix(cc, vec3(0.06, 0.08, 0.13), uNight * 0.93);
          c = mix(c, cc, k * 0.92);
        }
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), mat);
  m.frustumCulled = false;
  m.renderOrder = -1000;
  return m;
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.1 },
    contrast: { value: 1.04 },
    warmth: { value: 0.015 },
    vignette: { value: 0.2 },
    lift: { value: 0.006 },
    shadowTint: { value: new THREE.Vector3(-0.012, 0.004, 0.03) },
    lightTint: { value: new THREE.Vector3(0.014, 0.006, -0.01) },
    sharpen: { value: 0 },
    satHi: { value: 0 }, // (LF.1) saturation given back to the bright pixels (the lamp-lit pools and windows keep their warmth by night)
    res: G.resolution,
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float saturation, contrast, warmth, vignette, lift, satHi;
    uniform vec3 shadowTint, lightTint;
    uniform float sharpen; uniform vec2 res;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // gentle contrast-adaptive sharpening (4 taps), clamped to the neighbours so edges never ring
      if (sharpen > 0.0) {
        vec2 px = 1.0 / res;
        vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb, s = texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb;
        vec3 e = texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb, w = texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb;
        vec3 mn = min(c.rgb, min(min(n, s), min(e, w))), mx = max(c.rgb, max(max(n, s), max(e, w)));
        float amp = clamp(min(min(mn.g, 1.0 - mx.g) / max(mx.g, 1e-3), 1.0), 0.0, 1.0);
        c.rgb = clamp(c.rgb + (c.rgb - (n + s + e + w) * 0.25) * sharpen * 2.0 * sqrt(amp), mn, mx);
      }
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, saturation + satHi * smoothstep(0.2, 0.55, l));
      c.rgb = (c.rgb - 0.42) * contrast + 0.42;
      // split toning: cool, deep shadows and warm, golden highlights
      float sh = 1.0 - smoothstep(0.0, 0.45, l), hi = smoothstep(0.35, 0.95, l);
      c.rgb += shadowTint * sh + lightTint * hi;
      c.rgb += vec3(warmth, warmth * 0.4, -warmth * 0.6) * (1.0 - l) * 0.5;
      c.rgb = c.rgb * (1.0 - lift) + lift * vec3(0.10, 0.12, 0.2);
      vec2 q = vUv - 0.5;
      // a light vignette: frames the view without turning the corners to dusk
      float v = 1.0 - dot(q * vec2(0.85, 1.0), q * vec2(0.85, 1.0)) * vignette * 2.2;
      c.rgb *= mix(0.72, 1.0, smoothstep(0.0, 1.0, clamp(v, 0.0, 1.0)));
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
    }
  `,
};

const _cdir = new THREE.Vector3(), _cfoc = new THREE.Vector3();
const _rainFog = new THREE.Color('#7c868e'), _sandFog = new THREE.Color('#d0ad78'), _snowFog = new THREE.Color('#c4ccd8');
const _pourFog = new THREE.Color('#6e7a74'); // (the Rainward Gorge's downpours: a grey-green wall of rain)
const _dusk = new THREE.Color('#ffa456'), _moon = new THREE.Color('#90a9ea'), _nightFill = new THREE.Color('#42599e'), _nightSky = new THREE.Color('#2a3f72'), _nightGround = new THREE.Color('#16161c');
// twilight air: golden amber at dusk, a soft peach-gold at dawn (never rose: with the night blue laid over it, rose went magenta)
const _duskFog = new THREE.Color('#d6a462'), _dawnFog = new THREE.Color('#e4c49a'), _twFog = new THREE.Color(), _nightFog = new THREE.Color('#18223c'), _nightZen = new THREE.Color('#0a1022');
export class Engine {
  constructor(canvas) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }));
    r.setPixelRatio(QUALITY.pixelRatio);
    r.setSize(innerWidth, innerHeight, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.04;
    r.outputColorSpace = THREE.SRGBColorSpace;

    const scene = (this.scene = new THREE.Scene());
    scene.background = SKY.horizon.clone();
    // haze: the view only spans ~30-80 m, so the fog starts close and stays faint, deepening the top of the screen
    scene.fog = new THREE.Fog(SKY.haze.clone(), 34, 210);

    this.camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, QUALITY.far || 1200); // the fog hides all past ~300 m

    // Sun
    // a warm afternoon sun from the west, about 40 degrees up: shadows have shape without swallowing the ground
    this.sunDir = new THREE.Vector3(-0.7, 0.64, 0.3).normalize();
    const sun = (this.sun = new THREE.DirectionalLight(0xffeace, 3.25));
    sun.castShadow = true;
    sun.shadow.mapSize.set(QUALITY.shadowSize, QUALITY.shadowSize);
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3;
    this.shadowExtent = 42;
    const sc = sun.shadow.camera;
    sc.left = -this.shadowExtent; sc.right = this.shadowExtent; sc.top = this.shadowExtent; sc.bottom = -this.shadowExtent;
    sc.near = 1; sc.far = 300;
    scene.add(sun, sun.target);
    // B4: QUALITY.shadowHz > 0 redraws the shadow map that many times a second (Battery 15, Mobile Low 30) instead of every
    // frame; the box is re-centred only on the frames it is redrawn, so shadows never slide
    this.shadowHz = QUALITY.shadowHz || 0;
    if (this.shadowHz > 0) r.shadowMap.autoUpdate = false;
    this._shadowDue = true; this._shadowT = -1;
    // coarse culling (coarse.js): whole characters and static subtrees skipped by the camera and shadow passes they miss
    this.coarse = new CoarseCull(scene);
    // v115: the static shadow cache (shadowCache.js) draws the static casters only when they change, the rest every time
    { const sm = r.shadowMap, C = this.coarse, SC = (this.shadowCache = new ShadowCache(this, sm.render.bind(sm)));
      if (SC.on) sun.shadow.mapSize.set(SC.size, SC.size); // (the box is CACHE_MARGIN larger: the same texel size)
      C.isStatic = (o) => SC.isStaticTop(o);
      const orig = (l, s2, c2) => SC.render(l, s2, c2);
      sm.render = (lights, sc2, cam) => {
        // only the sun casts here; with any other shadow light the shadow pass keeps every subtree
        const only = lights.every((l) => l === this.sun || !l.castShadow);
        if (only) C.beginShadow();
        PASS.shadow = true;
        try { return orig(lights, sc2, cam); } finally { PASS.shadow = false; if (only) C.endShadow(); }
      }; }

    // cool sky bounce from the opposite side: shadows read blue, forms keep their shape
    this.fill = new THREE.DirectionalLight(0x86a6e0, 0.5);
    this.fill.position.set(0.7, 0.55, -0.45).multiplyScalar(100);
    scene.add(this.fill);
    // a strong blue sky term so shade reads cool and lit, not black
    this.hemi = new THREE.HemisphereLight(0xa8c4ee, 0x6a5a3c, 0.5);
    scene.add(this.hemi);

    // Sky dome + environment
    this.sky = makeSkyDome();
    this.sky.material.uniforms.sunDir.value.copy(this.sunDir);
    scene.add(this.sky);
    this.buildEnvironment();

    // Global uniforms
    G.cloudTex.value = cloudTex();

    // Post-processing
    // Mobile High asks for MSAA 2x: a GPU that cannot multisample the scene target gets the FXAA pass instead (the desktop
    // presets' 2x / 4x are always within reach there, so their look never changes)
    if (QUALITY.msaa > 0 && QUALITY.mobile) {
      const most = r.capabilities.maxSamples || 0;
      if (most < 2) { QUALITY.msaa = 0; QUALITY.fxaa = true; } else QUALITY.msaa = Math.min(QUALITY.msaa, most);
    }
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    // the air pass reads the scene depth: the main buffer keeps a depth texture on the presets that have it
    const rt = (this._rtMain = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: QUALITY.msaa, depthTexture: QUALITY.atmos ? new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType) : null }));
    this.composer = new EffectComposer(r, rt);
    // C1: only the scene render needs MSAA and the depth texture. The composer's second buffer was a clone of the first
    // (MSAA 4x + depth): it swaps buffers each pass, so the scene landed on either one. frame() now puts the scene on rt
    // every frame (readBuffer = rt at the start), so the second buffer is a plain one; a third plain buffer takes the one
    // pass that would otherwise write into the MSAA target (OutputPass after the air pass's swap, see _guardPasses)
    if (QUALITY.msaa > 0) {
      const plain = () => new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
      this.composer.renderTarget2.dispose();
      this.composer.renderTarget2 = plain(); this.composer.renderTarget2.texture.name = 'EffectComposer.rt2';
      this.composer.readBuffer = this.composer.renderTarget2;
      this._rtSpare = plain(); this._rtSpare.texture.name = 'EffectComposer.rt3';
    }
    this.composer.addPass(new RenderPass(scene, this.camera));
    // volumetric sun and lamp light, height fog and mist, cheap AO and the sun's glare (off on Low and Mobile)
    if (QUALITY.atmos) { this.atmos = new AtmospherePass(this, QUALITY.atmos); this.composer.addPass(this.atmos); }
    // ambient occlusion on High: contact shading where props, walls and characters meet the ground
    if (QUALITY.ao) this.addAO(scene, size);
    // threshold above the lit glass so tiny panes don't sparkle while the camera moves; glow sprites carry the halo
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.38, 0.75, 1.08);
    this.bloom.enabled = QUALITY.bloom;
    // the blur spreads whatever goes in: one NaN or infinite pixel from any shader (a stray normalize of a zero vector,
    // a half-float overflow; tested on the exponent bits, which no compiler folds away) used to smear into a flat dark block over most of the screen. Such a pixel adds no glow now
    { const m = this.bloom.materialHighPassFilter, k = 'vec4 texel = texture2D( tDiffuse, vUv );';
      if (m.fragmentShader.includes(k)) { m.fragmentShader = m.fragmentShader.replace(k, k + ' { uvec4 eb = floatBitsToUint( texel ) & 0x7f800000u; if ( any( equal( eb, uvec4( 0x7f800000u ) ) ) ) texel = vec4( 0.0 ); }'); m.needsUpdate = true; } }
    // C3: fewer blur levels on the phones (the widest, faintest halos); the rest of the glow is unchanged
    if (QUALITY.bloomMips > 0 && QUALITY.bloomMips < this.bloom.nMips) {
      const f = this.bloom.compositeMaterial.uniforms.bloomFactors.value;
      for (let i = QUALITY.bloomMips; i < f.length; i++) f[i] = 0;
      this.bloom.nMips = QUALITY.bloomMips;
    }
    // C4: the bloom's own passes run at a quarter size on the phones: half precision is plenty there (the full-size
    // output and grade passes and every scene shader keep highp: world positions, shadow coordinates, full-res UVs)
    if (IS_MOBILE) for (const m of [this.bloom.materialHighPassFilter, ...this.bloom.separableBlurMaterials, this.bloom.compositeMaterial]) if (m) m.precision = 'mediump';
    if (QUALITY.bloomScale && QUALITY.bloomScale !== 0.5) {
      // the pass halves whatever size it is given: scale it again for a cheaper (Mobile: quarter-size) glow
      const k = QUALITY.bloomScale * 2, setSize = this.bloom.setSize.bind(this.bloom);
      this.bloom.setSize = (w, h) => setSize(Math.max(2, Math.round(w * k)), Math.max(2, Math.round(h * k)));
    }
    this.composer.addPass(this.bloom);
    this.composer.addPass((this.output = new OutputPass()));
    this.grade = new ShaderPass(GradeShader);
    this.grade.uniforms.sharpen.value = QUALITY.sharpen || 0;
    this.composer.addPass(this.grade);
    // the phones without MSAA (Mobile, Mobile Low, Battery): FXAA on the graded image, the last pass. Never with MSAA (the
    // grade would then write into the multisampled scene target: _guardPasses only covers the OutputPass case)
    if (QUALITY.fxaa && !(QUALITY.msaa > 0)) { this.fxaa = new ShaderPass(FXAAShader); this.composer.addPass(this.fxaa); }
    this._guardPasses();
    this.baseSunDir = this.sunDir.clone();
    this._dawn = 0; this._tw = 0;

    this.timer = new THREE.Timer();
    this.updaters = new Set();
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  // GTAO, with see-through, alpha-cut and glowing things (canopies, grass cards, water, effects, the sky) hidden from
  // its depth and normal input, so they never cast solid black occlusion onto trunks and walls behind them
  addAO(scene, size) {
    // computed at half resolution (the soft result upsamples cleanly) to keep the cost low
    const ao = new GTAOPass(scene, this.camera, size.x >> 1, size.y >> 1);
    const setSize = ao.setSize.bind(ao);
    ao.setSize = (w, h) => setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.0, samples: 8, distanceFallOff: 1.0 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 3, rings: 2, samples: 8 });
    ao.blendIntensity = 0.85;
    patchCut(ao.normalMaterial); // the house cut-away is cut from the AO's own depth and normals too (no roof-shaped shading)
    const skip = (m) => !m || m.transparent || m.alphaTest > 0 || m.userData?.foliage || m.userData?.billboard || m.blending === THREE.AdditiveBlending || !m.depthWrite;
    let hidden = [], nextScan = 0;
    const scan = () => {
      hidden = [this.sky];
      scene.traverse((o) => {
        if (o === this.sky || !o.visible) return;
        if (o.isPoints || o.isSprite || o.isLine) { hidden.push(o); return; }
        if (!o.isMesh) return;
        const m = o.material;
        if (Array.isArray(m) ? m.some(skip) : skip(m)) hidden.push(o);
      });
    };
    const render = ao.render.bind(ao);
    ao.render = (...args) => {
      const now = performance.now();
      if (now > nextScan) { scan(); nextScan = now + 1200; }
      const was = hidden.map((o) => o.visible);
      for (const o of hidden) o.visible = false;
      try { render(...args); } finally { hidden.forEach((o, i) => { o.visible = was[i]; }); }
    };
    this.ao = ao;
    this.composer.addPass(ao);
  }

  // C1 (see the constructor): OutputPass writes into the spare plain buffer instead of the MSAA scene target, and the grade
  // reads it from there (only on the frames that happened, i.e. when the air pass's swap put the MSAA target in front)
  _guardPasses() {
    const spare = this._rtSpare, rt = this._rtMain;
    if (!spare) return;
    let redirected = false;
    const out = this.output, grade = this.grade, oRender = out.render.bind(out), gRender = grade.render.bind(grade);
    out.render = (r, w, rd, dt, m) => { redirected = w === rt; oRender(r, redirected ? spare : w, rd, dt, m); };
    grade.render = (r, w, rd, dt, m) => { const src = redirected && rd === rt ? spare : rd; redirected = false; gRender(r, w, src, dt, m); };
  }

  // C1 / 4K: on High at 3.5 MP or more (4K, 5K) the scene target drops from MSAA 4x to 2x: at that pixel density the edge
  // difference is not visible and the main pass is cheaper. Ultra keeps its full MSAA at any size.
  _msaaFor(px) {
    const q = QUALITY.msaa || 0;
    return q > 2 && SETTINGS.quality !== 'ultra' && px >= 3.5e6 ? 2 : q;
  }

  buildEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const dome = makeSkyDome();
    dome.material.uniforms.sunDir.value.copy(this.sunDir);
    envScene.add(dome);
    this.envRT = pmrem.fromScene(envScene, 0.035);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.6;
    pmrem.dispose();
    // a real sky for reflections (CC0, Poly Haven; client/assets/tex/CREDITS.txt): clouds and a bright horizon give
    // metal and glass something to mirror; the painted dome stays the visible background. Falls back silently.
    new HDRLoader().load('/sunmere-play/assets/tex/sky_1k.hdr', (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(this.renderer);
      const rt = pm.fromEquirectangular(tex);
      pm.dispose(); tex.dispose();
      this.envRT?.dispose(); this.envRT = rt;
      this.scene.environment = rt.texture;
    }, undefined, () => {});
  }

  // weather over the outdoor mood: rain greys and closes the fog and dims the sun; a sandstorm turns the air ochre
  // (squall: the Windward Heights' squalls of blown snow, 0..1, laid over the blizzard: the air closes in white to a few
  // tens of metres, enough to hide the next ridge, and the haze climbs well above the ground)
  // (pour: the Rainward Gorge's downpours, 0..1, laid over the rain: heavier than any valley rain and than the Heights'
  // squall, the air closes in grey-green to a few tens of metres, the sun all but gone, the cloud down on the walls)
  setWeather(rain, sand, night = 0, snow = 0, blizzard = 0, squall = 0, pour = 0) {
    if (!this._base) this._base = { sun: this.sun.intensity, sunC: this.sun.color.clone(), fill: this.fill.intensity, fillC: this.fill.color.clone(), hemi: this.hemi.intensity, hemiS: this.hemi.color.clone(), hemiG: this.hemi.groundColor.clone(), fog: this.scene.fog.color.clone(), near: this.scene.fog.near, far: this.scene.fog.far, env: this.scene.environmentIntensity, cloud: G.cloudAmount.value, wind: G.windStrength.value, zen: this.sky.material.uniforms.zenith.value.clone(), hor: this.sky.material.uniforms.horizon.value.clone() };
    // dawn or dusk: night falling means morning (the mist lies thickest then); eased so it never jumps
    if (this._nPrev !== undefined && night !== this._nPrev) this._dawnT = night < this._nPrev ? 1 : 0;
    this._nPrev = night;
    this._dawn += ((window.MORNING_FORCE ?? this._dawnT ?? 0) - this._dawn) * 0.02;
    G.night.value = night;
    if (this._indoor) return;
    const B = this._base, tw = Math.min(1, night * (1 - night) * 4); // twilight peaks halfway into dusk and dawn
    this._tw = tw;
    // the sun sinks toward the hills at twilight (long golden shadows, a sun you can face) and climbs back as the moon
    this.setSunElevation(THREE.MathUtils.lerp(B.el ?? 40, 13, tw * tw * (3 - 2 * tw))); // (el: an area's own noon height, the Weald's low autumn sun)
    // the night's colours come in late (nk): halfway into twilight the light is still gold, not gold and moon-blue mixed
    // (which read pink); by full night it is a dim moonlit blue with the lamps doing the warm work
    const nk = THREE.MathUtils.smoothstep(night, 0.3, 1);
    _twFog.copy(_duskFog).lerp(_dawnFog, this._dawn);
    this._squall = squall;
    this.sun.intensity = B.sun * (1 - 0.42 * rain - 0.4 * sand - 0.25 * snow - 0.35 * blizzard) * (1 - 0.3 * squall) * (1 - 0.35 * pour) * (1 - 0.91 * night);
    this.sun.color.copy(B.sunC).lerp(_dusk, tw * (0.6 - 0.25 * this._dawn)).lerp(_moon, nk);
    this.fill.intensity = B.fill * (1 - 0.25 * rain) * (1 - 0.5 * night - 0.12 * nk); // (LF.1: a deeper blue night, the lamps doing the warm work)
    this.fill.color.copy(B.fillC).lerp(_nightFill, nk);
    this.hemi.intensity = B.hemi * (1 + 0.9 * rain + 0.2 * sand) * (1 - 0.5 * night - 0.16 * nk);
    this.hemi.color.copy(B.hemiS).lerp(_nightSky, nk); this.hemi.groundColor.copy(B.hemiG).lerp(_nightGround, nk);
    const fc = B.fog.clone().lerp(_rainFog, rain * 0.8).lerp(_pourFog, pour * 0.5).lerp(_snowFog, Math.min(1, snow * 0.6 + blizzard * 0.35 + squall * 0.4)).lerp(_sandFog, sand * 0.85).lerp(_twFog, tw * (0.45 + 0.15 * this._dawn)).lerp(_nightFog, nk * 0.9);
    this._nk = nk;
    this.scene.fog.color.copy(fc); this.scene.background.copy(fc);
    this.scene.fog.near = B.near * (1 - 0.45 * rain - 0.65 * sand - 0.35 * snow) * (1 - 0.6 * blizzard) * (1 - 0.6 * squall) * (1 - 0.25 * pour) * (1 - 0.15 * night);
    this.scene.fog.far = B.far * (1 - 0.4 * rain - 0.55 * sand - 0.3 * snow) * (1 - 0.55 * blizzard) * (1 - 0.6 * squall) * (1 - 0.25 * pour) * (1 - 0.15 * night);
    this.scene.environmentIntensity = B.env * (1 + 0.25 * rain) * (1 - 0.78 * night - 0.08 * nk);
    const u = this.sky.material.uniforms;
    if (u.zenith.value === B.zen || !this._skyOwn) { u.zenith.value = B.zen.clone(); u.horizon.value = B.hor.clone(); this._skyOwn = true; }
    u.zenith.value.copy(B.zen).lerp(_nightZen, nk); u.horizon.value.copy(B.hor).lerp(_twFog, tw * 0.5).lerp(_nightFog, nk);
    G.cloudAmount.value = B.cloud + 0.45 * rain * (1 - 0.6 * pour); // (a downpour is one even grey: no dark cloud shadows racing over the gorge floor)
    this._rain = Math.max(rain, sand * 0.8, blizzard * 0.8);
    // the ground soaks quickly in rain and dries slowly (called every frame)
    { const tgt = Math.min(1, rain * 1.3), w = G.wet.value; G.wet.value = w + (tgt - w) * (tgt > w ? 0.02 : 0.003); }
    u.uCover.value = Math.min(0.92, 0.42 + 0.45 * rain + 0.25 * snow - 0.2 * sand); u.uNight.value = night; u.uDusk.value = tw;
    G.windStrength.value = B.wind + 0.22 * rain + 0.3 * sand + 0.45 * blizzard;
  }

  // the outdoor mood each area starts from (weather, dusk and night are laid over it): 'valley', or 'reach' for the Cinder
  // Reach, a warmer, ashier haze under a smoky sky
  setOutdoorTheme(theme = 'valley') {
    if (theme === (this._theme || 'valley')) return;
    if (!this._base) { const was = this._indoor; this._indoor = null; this.setWeather(0, 0, G.night.value, 0); this._indoor = was; }
    this._themes = this._themes || { valley: this._base };
    if (!this._themes[theme]) {
      const V = this._themes.valley, c = (h) => new THREE.Color(h);
      this._themes[theme] = theme === 'reach'
        ? { ...V, sun: V.sun * 0.9, sunC: c('#ffdcb4'), fill: V.fill * 0.8, fillC: c('#9a8c96'), hemi: V.hemi * 1.05, hemiS: c('#aaa6a4'), hemiG: c('#2c221e'),
          fog: c('#8a8580'), near: V.near * 0.9, far: V.far * 0.88, env: V.env * 0.85, cloud: V.cloud + 0.12, zen: c('#56647a'), hor: c('#c4a088') }
        // the Rime Steps: a low, pale sun, cold blue shadows off the snow, a white-blue haze and a washed-out sky
        : theme === 'rime'
          ? { ...V, sun: V.sun * 0.8, sunC: c('#eaf0ff'), fill: V.fill * 0.95, fillC: c('#8aa6d0'), hemi: V.hemi * 0.9, hemiS: c('#b4c8e2'), hemiG: c('#465464'),
            fog: c('#a2b4c8'), near: V.near * 1.1, far: V.far * 1.05, env: V.env * 0.9, cloud: V.cloud + 0.1, zen: c('#5a80ac'), hor: c('#cddae6') }
          // the Windward Heights: above the cloud, a bright hard sun in a deep cold-blue sky, blue fill off the snow, clear
          // thin air (the fog far off), a hard wind
          : theme === 'heights'
            ? { ...V, sun: V.sun * 1.08, sunC: c('#f6f9ff'), fill: V.fill * 1.05, fillC: c('#9cb8e0'), hemi: V.hemi * 1.0, hemiS: c('#c6d8f0'), hemiG: c('#5c6a7c'),
              fog: c('#c4d4e6'), near: V.near * 1.5, far: V.far * 1.45, env: V.env * 1.0, cloud: V.cloud + 0.06, wind: V.wind + 0.45, zen: c('#3a66a8'), hor: c('#dfe9f5') }
            // Tidewater Sound: a grey sea light, a soft sun through a high haze, grey-green shadows off the water and the mud, a
            // salt mist out over the Sound
            : theme === 'tidewater'
              ? { ...V, sun: V.sun * 0.9, sunC: c('#fff0dc'), fill: V.fill * 0.95, fillC: c('#94a8b0'), hemi: V.hemi * 1.0, hemiS: c('#b4c2c6'), hemiG: c('#3c4034'),
                fog: c('#aab6b8'), near: V.near * 1.15, far: V.far * 1.2, env: V.env * 0.9, cloud: V.cloud + 0.14, zen: c('#62788e'), hor: c('#c6cfd0') }
              // the Rainward Gorge: a soft green-grey light down between the walls even when it is dry, the sun through a
              // wet haze, green shadows off the moss and the timber, a grey low cloud that closes the far end of the gorge
              : theme === 'rainward'
                ? { ...V, sun: V.sun * 0.78, sunC: c('#f4f0e2'), fill: V.fill * 1.0, fillC: c('#8ea89a'), hemi: V.hemi * 1.08, hemiS: c('#aebcb4'), hemiG: c('#2e3a28'),
                  fog: c('#9aa8a2'), near: V.near * 1.0, far: V.far * 0.95, env: V.env * 0.85, cloud: V.cloud + 0.06, zen: c('#6a7a84'), hor: c('#b8c2bc') }
                // the Russet Weald: a low warm autumn sun (soft, through a haze: no disc of rays), copper light off the leaves, warm
                // brown shadows, a pale gold haze down the rides
                : theme === 'weald'
                  ? { ...V, sun: V.sun * 0.82, sunC: c('#ffd8a8'), fill: V.fill * 0.95, fillC: c('#a08a78'), hemi: V.hemi * 1.0, hemiS: c('#c8b49a'), hemiG: c('#3a2a1c'),
                    fog: c('#c4ae92'), near: V.near * 0.95, far: V.far * 0.92, env: V.env * 0.85, cloud: V.cloud + 0.08, zen: c('#7a8aa0'), hor: c('#dcc6a4'), el: 24 }
                : V;
    }
    this._theme = theme;
    this._base = this._themes[theme];
  }

  // underground mood: no sky, a dim warm key, dark close fog; the torches bring the light
  setIndoor(theme) {
    if (theme === this._indoor) return;
    // entering the world inside a dungeon: take the outdoor base (setWeather's _base) from the outdoor lights first, or it
    // would be read from the dim underground ones and every outdoor area stays dark and nearly shadowless for the session
    if (theme && !this._base) { const was = this._indoor; this._indoor = null; this.setWeather(0, 0, G.night.value, 0); this._indoor = was; }
    this._indoor = theme;
    if (theme) this.setSunElevation(40); // the dungeons keep their fixed key light
    if (!this._outdoor) this._outdoor = { sun: this.sun.intensity, sunC: this.sun.color.clone(), fill: this.fill.intensity, hemi: this.hemi.intensity, hemiS: this.hemi.color.clone(), hemiG: this.hemi.groundColor.clone(), env: this.scene.environmentIntensity, fog: this.scene.fog.color.clone(), near: this.scene.fog.near, far: this.scene.fog.far, bg: this.scene.background.clone(), cloud: G.cloudAmount.value };
    const o = this._outdoor;
    if (!theme) {
      this.sun.intensity = o.sun; this.sun.color.copy(o.sunC); this.fill.intensity = o.fill; this.hemi.intensity = o.hemi; this.hemi.color.copy(o.hemiS); this.hemi.groundColor.copy(o.hemiG);
      this.scene.environmentIntensity = o.env; this.scene.fog.color.copy(o.fog); this.scene.fog.near = o.near; this.scene.fog.far = o.far; this.scene.background.copy(o.bg); this.sky.visible = true; G.cloudAmount.value = o.cloud;
      return;
    }
    const tint = { warren: ['#ffc890', '#2a2016', '#16110c'], mine: ['#ffc890', '#2a2016', '#16110c'], vault: ['#ffd8a0', '#3a2a18', '#1c150e'], foundry: ['#ffb070', '#2e1a10', '#140c08'], storm: ['#d0e4ff', '#2e3a4c', '#141c28'], deep: ['#e8e2d0', '#2a2e2a', '#101412'], ore: ['#ffc088', '#2c201a', '#120d0b'], furnace: ['#ffb070', '#2e1c14', '#120c0a'], sluice: ['#e4eef8', '#34404c', '#0e161c'], dam: ['#eaf2fa', '#3a4652', '#101a22'], pump: ['#f2ecdf', '#3c4248', '#12171b'], mills: ['#ece8de', '#3a3e3c', '#111614'], seagate: ['#e8ecea', '#3a403e', '#101615'], cutting: ['#f2f2ea', '#4a4e44', '#30362f'], adits: ['#efe6d6', '#3e3a34', '#14110e'], lofts: ['#ffe4c0', '#4a3a2a', '#18120c'], workshop: ['#ffe8c8', '#3e3428', '#16120e'] }[theme] || ['#ffc890', '#2a2016', '#16110c'];
    this.sun.intensity = theme === 'cutting' ? 2.1 : theme === 'ore' ? 1.35 : theme === 'furnace' ? 1.45 : theme === 'sluice' ? 1.4 : theme === 'workshop' || theme === 'lofts' ? 1.7 : theme === 'dam' || theme === 'pump' || theme === 'mills' || theme === 'seagate' || theme === 'adits' || theme === 'cutting' ? 1.55 : theme === 'mine' || theme === 'warren' ? 0.75 : theme === 'deep' ? 1.0 : theme === 'storm' ? 0.85 : 0.55; this.sun.color.set(tint[0]); this.fill.intensity = 0.12;
    this.hemi.intensity = theme === 'cutting' ? 2.8 : theme === 'ore' ? 1.9 : theme === 'furnace' ? 2.05 : theme === 'sluice' ? 1.95 : theme === 'workshop' || theme === 'lofts' ? 2.45 : theme === 'dam' || theme === 'pump' || theme === 'mills' || theme === 'seagate' || theme === 'adits' || theme === 'cutting' ? 2.15 : theme === 'mine' || theme === 'warren' ? 0.85 : theme === 'deep' ? 1.25 : theme === 'storm' ? 0.95 : 0.6; this.hemi.color.set(theme === 'sluice' || theme === 'dam' || theme === 'pump' || theme === 'mills' || theme === 'seagate' || theme === 'adits' || theme === 'cutting' ? '#9aa6b2' : theme === 'workshop' || theme === 'lofts' ? '#b0a08a' : '#9a8a74'); this.hemi.groundColor.set(tint[1]);
    this.scene.environmentIntensity = theme === 'ore' || theme === 'furnace' ? 0.3 : theme === 'sluice' ? 0.34 : theme === 'dam' || theme === 'pump' || theme === 'mills' || theme === 'seagate' || theme === 'adits' || theme === 'cutting' ? 0.38 : theme === 'workshop' || theme === 'lofts' ? 0.36 : 0.14; // black basalt needs more fill to read
    this.scene.fog.color.set(tint[2]); this.scene.fog.near = 22; this.scene.fog.far = 95;
    this.scene.background.set(tint[2]); this.sky.visible = false; G.cloudAmount.value = 0;
  }

  // standing in a house (world.house): the sky light lifts by up to 25% toward a warm lamp colour and the exposure by 0.08,
  // eased over 0.4 s (frame() applies it around the render only, so the weather and night code never see it compound)
  setHouseLight(k) { this._houseWant = Math.max(0, Math.min(1, k || 0)); }

  // turn the sun to this elevation (degrees) on its fixed bearing; the sky, the water and the shafts share the vector
  setSunElevation(deg) {
    if (Math.abs(deg - (this._sunEl ?? 40)) < 0.02) return;
    this._sunEl = deg;
    const b = this.baseSunDir, hz = Math.hypot(b.x, b.z), e = THREE.MathUtils.degToRad(deg);
    this.sunDir.set((b.x / hz) * Math.cos(e), Math.sin(e), (b.z / hz) * Math.cos(e)).normalize();
    this.sky.material.uniforms.sunDir.value.copy(this.sunDir);
  }

  // the air pass, every frame: fog from the area's mood and the weather, the sun's light and where it sits on screen
  updateAtmos() {
    const A = this.atmos;
    if (!A) return;
    const cu = A.compMat.uniforms, vu = A.volMat.uniforms;
    const air = AIR[this._indoor ? 'indoor' : this._theme || 'valley'] || AIR.valley;
    const night = G.night.value, tw = this._indoor ? 0 : this._tw, rain = this._rain || 0;
    // the fog sits on the ground under the hero (valleys below fill up, the hills above stay clear)
    const base = G.playerPos.value.y - 0.5;
    vu.uFogBase.value = cu.uFogBase.value = base;
    const sq = this._indoor ? 0 : this._squall || 0;
    vu.uFogH.value = cu.uFogH.value = air.h * (1 + 2.5 * sq);
    cu.uMistBase.value = base - 0.6;
    cu.uFogDen.value = air.fog * (1 + 1.4 * rain + 0.3 * tw + 3.5 * sq) * (this._indoor ? 1 : 1 + 0.3 * night);
    cu.uFogMax.value = air.max + (0.8 - air.max) * sq;
    // no haze over the hero and the ground round them (the camera rides 3-32 m out); it builds beyond
    cu.uFogStart.value = this._indoor ? 0 : Math.min(30, this.camera.position.distanceTo(G.playerPos.value) * 0.85) * (1 - 0.2 * sq);
    vu.uStart.value = cu.uFogStart.value * 0.7;
    cu.uMist.value = this._indoor ? 0 : air.mist * (0.25 + 1.75 * this._dawn * (0.4 + 0.6 * Math.max(tw, night * 0.6))) * (1 - 0.6 * rain);
    // the fog takes the sky's own haze colour (themes, weather, dusk and night already set it)
    cu.uFogCol.value.copy(this.scene.fog.color).multiplyScalar(this._indoor ? 1.6 : 1.0);
    cu.uSunCol.value.copy(this.sun.color).multiplyScalar(this.sun.intensity);
    // volumetric sun: subtle at noon, strong and golden at dusk and dawn, a faint moon glow by night
    cu.uVolK.value = this._indoor ? 0 : air.vol * (1 + 2.6 * tw) * (1 - 0.65 * rain);
    cu.uPhaseG.value = 0.5 + 0.2 * tw;
    vu.uMaxDist.value = 95;
    // lamps and fires in the air (the world's light pool publishes them, already faded in and out)
    const L = G.airLamps, n = Math.min(L.length, A.lamps.length);
    _lampAvg.setRGB(0, 0, 0); let wsum = 0;
    for (let i = 0; i < n; i++) { const l = L[i]; A.lamps[i].set(l.x, l.y, l.z, l.w); _lampAvg.r += l.c.r * l.w; _lampAvg.g += l.c.g * l.w; _lampAvg.b += l.c.b * l.w; wsum += l.w; }
    vu.uLampN.value = n;
    if (wsum > 1e-4) cu.uLampCol.value.setRGB(_lampAvg.r / wsum, _lampAvg.g / wsum, _lampAvg.b / wsum);
    cu.uLampK.value = this._indoor ? 0.1 : 0.12 * (0.35 + 0.45 * night); // (judge: less lamp haze by night, so the pools read as pools, not yellow fog)
    // the sun on screen: glare and soft round ghosts when it is in view (and the sky around it is), a warm veil when close
    const cam = this.camera;
    cam.getWorldDirection(_fwd);
    const facing = _fwd.dot(this.sunDir);
    _sunNdc.copy(cam.position).addScaledVector(this.sunDir, 1000).project(cam);
    const out = Math.max(Math.abs(_sunNdc.x), Math.abs(_sunNdc.y)) - 1;
    const day = this._indoor ? 0 : 1 - night;
    cu.uSunUV.value.set(_sunNdc.x * 0.5 + 0.5, _sunNdc.y * 0.5 + 0.5, facing > 0 ? day * (1 - THREE.MathUtils.smoothstep(out, 0, 0.35)) : 0);
    cu.uGlare.value = facing > 0 ? 0.022 * Math.pow(facing, 3) * day * (1 + 1.5 * tw) * (1 - 0.7 * rain) : 0;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(w, h);
    this.composer.setPixelRatio?.(QUALITY.pixelRatio);
    const size = this.renderer.getDrawingBufferSize(_dbs);
    G.resolution.value.set(size.x, size.y);
    this.fxaa?.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
    this._rtSpare?.setSize(size.x, size.y);
    const rt = this._rtMain, ms = this._msaaFor(size.x * size.y);
    if (rt && rt.samples !== ms) { rt.samples = ms; rt.dispose(); } // re-allocated on the next render with the new count
  }

  // dynamic resolution (dynres.js): the render pixel ratio (the HUD is DOM and stays sharp).
  // v117: the change is held until the start of the next engine.frame and done there, straight before that frame draws.
  // A resize reallocates the canvas's drawing buffer (empty); DynRes decides after a frame has been drawn (its sample
  // follows the frame in the pacer callback), so resizing on the spot threw that frame away and the phone showed an empty
  // canvas (the dark page background) for one frame on every scale change: the "flicker to black every few seconds"
  setRenderScale(r) { this._pendingScale = r; }
  _applyRenderScale() {
    const r = this._pendingScale;
    this._pendingScale = undefined;
    if (r === undefined || Math.abs(r - this.renderer.getPixelRatio()) < 1e-3) return;
    QUALITY.pixelRatio = r;
    this.renderer.setPixelRatio(r);
    this.resize(); // renderer size, composer size + ratio, bloom / air pass buffers, G.resolution
  }

  // B1 switch, for world.js once its shadow proxies are built (client/game/layers.js buildShadowProxies, before slimStatic):
  // the shadow camera sees SHADOW_LAYER as well as layer 0 (characters, fx and dynamic props keep casting from layer 0),
  // the proxies start to cast and their sources stop. Call again with more proxies (a dungeon built later); on = false
  // puts those sources back. The layer is only on while some proxies are on (static casters must never cast twice).
  useShadowProxies(list, on = true) {
    const arr = (Array.isArray(list) ? list : [list]).filter(Boolean);
    for (const P of arr) useShadowProxies(P, on);
    this._coarseV = (this._coarseV || 0) + 1000003; // casters changed: coarse.js rescans its chunks
    const cur = new Set(this._proxies || []);
    for (const P of arr) { if (on) cur.add(P); else cur.delete(P); }
    this._proxies = [...cur];
    const L = this.sun.shadow.camera.layers;
    if (this._proxies.length) L.enable(SHADOW_LAYER); else L.disable(SHADOW_LAYER);
    return this._proxies.length;
  }

  // F3 shader warm-up, for game.js: behind the loading screen and after a zone / dungeon teleport, compile every program
  // the scene will need (three uses KHR_parallel_shader_compile when present, so this does not block).
  // o.transparent: objects whose materials an effect turns transparent later (fx.js fadeSelf on the player's character):
  // their transparent variants are compiled too, on throw-away clones, so the real materials never change on screen.
  async warmup(root = this.scene, o = {}) {
    const r = this.renderer, cam = this.camera;
    // (the glow field's stand-ins carry a material for the lamp scan but no geometry, which three's compile cannot take:
    // they are left out for the synchronous part of compileAsync, which is where it walks the scene)
    const glows = [];
    root.traverse((o) => { if (o.isGlowPoint && o.material) { glows.push([o, o.material]); o.material = undefined; } });
    let p;
    try { p = r.compileAsync(root, cam, this.scene); } catch (e) { console.warn('[warmup]', e?.message || e); } finally { for (const [o, m] of glows) o.material = m; }
    try { await p; } catch (e) { console.warn('[warmup]', e?.message || e); }
    const src = o.transparent ? (Array.isArray(o.transparent) ? o.transparent : [o.transparent]) : [];
    if (!src.length) return;
    const tmp = new THREE.Scene(), made = [];
    for (const s of src) s?.traverse?.((m) => {
      if (!m.isMesh || !m.material) return;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).filter((x) => !x.transparent);
      if (!mats.length) return;
      const c = m.clone(false);
      const cl = mats.map((x) => { const y = x.clone(); y.transparent = true; made.push(y); return y; });
      c.material = cl.length === 1 ? cl[0] : cl;
      c.matrixWorld.copy(m.matrixWorld); c.matrixAutoUpdate = false; c.matrixWorldAutoUpdate = false;
      tmp.add(c);
    });
    try { if (tmp.children.length) await r.compileAsync(tmp, cam, this.scene); } catch (e) { console.warn('[warmup]', e?.message || e); }
    // (the clones are kept, not disposed: disposing the last material on a program frees the program, and the fade would
    // compile it again; one set per warmed character, replaced on the next warm-up of it)
    finally { const k = (this._warmKeep ||= new Map()); for (const s of src) { const old = k.get(s); k.set(s, made); if (old) for (const y of old) y.dispose(); } }
  }

  // behind the loading screen: draw every mesh under root once (hidden ones too, no culling, the shadow proxies too) into
  // a 1x1 target, one child of root at a time, so each geometry and texture is on the GPU and each program built before
  // play starts. The first look at an area or dungeon then no longer stalls on its uploads, and on phones every slimmed
  // mesh (engine/slim.js) drops its JS copy now instead of holding it until first drawn: the never-visited dungeons and
  // areas otherwise kept ~0.5 GB of vertex arrays on the JS heap. Visibility, culling and layers are put back exactly.
  async preupload(root = this.scene) {
    const r = this.renderer, cam = this.camera, t0 = performance.now();
    const kids = root.children.slice(), kidVis = kids.map((k) => k.visible);
    const rt = new THREE.WebGLRenderTarget(1, 1), sm = r.shadowMap, au = sm.autoUpdate, nu = sm.needsUpdate, prev = r.getRenderTarget(), lay = cam.layers.mask;
    let shown = 0;
    try {
      sm.autoUpdate = false; sm.needsUpdate = false;
      cam.layers.enable(SHADOW_LAYER);
      for (const c of kids) {
        const flips = [], cull = [];
        c.traverse((o) => {
          if (o.visible === false) { o.visible = true; if (o.visible) flips.push(o); }
          if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.frustumCulled) { o.frustumCulled = false; cull.push(o); }
        });
        for (const k of kids) k.visible = k === c || k.isLight; // (the pooled lights stay on: every program is built for the full light set it will draw with)
        try { r.setRenderTarget(rt); r.render(this.scene, cam); }
        catch (e) { console.warn('[preupload]', e?.message || e); }
        finally {
          r.setRenderTarget(prev);
          for (const o of flips) o.visible = false;
          for (const o of cull) o.frustumCulled = true;
          shown += flips.length;
        }
        await new Promise((res) => setTimeout(res, 0)); // let the GPU drain between chunks
      }
    } finally {
      kids.forEach((k, i) => { k.visible = kidVis[i]; });
      cam.layers.mask = lay;
      sm.autoUpdate = au; sm.needsUpdate = nu || au;
      r.setRenderTarget(prev);
      rt.dispose();
    }
    return { shown, ms: Math.round(performance.now() - t0) };
  }

  // Keep the shadow map centred on `focus` and snapped to whole texels so it never shimmers.
  updateShadow(focus, extent = this.shadowExtent) {
    if (!this._shadowDue) return; // B4: a throttled map keeps its box until it is redrawn
    const sun = this.sun, sc = sun.shadow.camera;
    // a low (zoomed-in) camera looks across the ground toward the skyline: widen the shadow box and push its
    // centre ahead of the hero so the visible ground keeps its shadows
    const cd = this.camera.getWorldDirection(_cdir), lowK = THREE.MathUtils.clamp((0.72 - -cd.y) / 0.4, 0, 1);
    if (lowK > 0) {
      extent = Math.max(extent, THREE.MathUtils.lerp(extent, 34, lowK));
      _cdir.y = 0; if (_cdir.lengthSq() > 1e-6) _cdir.normalize();
      focus = _cfoc.copy(focus).addScaledVector(_cdir, extent * 0.55 * lowK);
    }
    // B3: the phones keep a smaller box (game.js asks for up to 80 m zoomed out), so the map's texels are not spread thin
    if (QUALITY.shadowMaxExtent) extent = Math.min(extent, QUALITY.shadowMaxExtent);
    extent = Math.round(extent); // only rebuild the projection on whole-metre changes
    if (extent !== this.shadowExtent && !this.shadowCache.on) {
      this.shadowExtent = extent;
      sc.left = -extent; sc.right = extent; sc.top = extent; sc.bottom = -extent;
      sc.updateProjectionMatrix();
    }
    if (this.shadowCache.on) { // v115: the cached box (shadowCache.js place): re-centred only when the view leaves it
      const c = this.shadowCache.place(focus, extent);
      this.shadowExtent = extent;
      this.fill.target.position.copy(c); this.fill.position.copy(c).add(_fillOff); this.fill.target.updateMatrixWorld();
      sun.target.updateMatrixWorld();
      return;
    }
    const texel = (extent * 2) / sun.shadow.mapSize.x;
    const dir = this.sunDir;
    const right = _right.crossVectors(_up, dir).normalize();
    const up = _sup.crossVectors(dir, right).normalize();
    const fr = focus.dot(right), fu = focus.dot(up), fd = focus.dot(dir);
    const sr = Math.round(fr / texel) * texel, su = Math.round(fu / texel) * texel;
    const snapped = _snap.copy(right).multiplyScalar(sr).addScaledVector(up, su).addScaledVector(dir, fd);
    sun.target.position.copy(snapped);
    sun.position.copy(snapped).addScaledVector(dir, 150);
    this.fill.target.position.copy(snapped); this.fill.position.copy(snapped).add(_fillOff); this.fill.target.updateMatrixWorld();
    sun.target.updateMatrixWorld();
  }

  frame() {
    if (this._pendingScale !== undefined) this._applyRenderScale(); // (v117: resize and draw in the same frame)
    this.timer.update();
    const dt = Math.min(0.1, this.timer.getDelta());
    G.time.value += dt;
    // B4: is the shadow map redrawn this frame? (every frame unless QUALITY.shadowHz throttles it)
    if (this.shadowHz > 0) {
      const T = 1 / this.shadowHz;
      this._shadowAcc = (this._shadowAcc ?? T) + dt;
      this._shadowDue = this._shadowAcc + dt * 0.5 >= T;
      if (this._shadowDue) this._shadowAcc = Math.min(T, Math.max(0, this._shadowAcc - T));
      this.renderer.shadowMap.needsUpdate = this._shadowDue;
    }
    G.cloudOffset.value.x += dt * 0.0016;
    G.cloudOffset.value.y += dt * 0.0009;
    // one broken system must never freeze the whole game: keep rendering and report each distinct error once
    for (const u of this.updaters) {
      try { u(dt); } catch (e) {
        const key = String(e?.message || e);
        this._errs = this._errs || new Set();
        if (!this._errs.has(key)) { this._errs.add(key); console.error('[frame]', e?.stack || e); (window.__frameErrors = window.__frameErrors || []).push(key); }
      }
    }
    this.sky.position.copy(this.camera.position);
    // the Heights' sunlit snow sits above the usual bloom threshold over the whole field (mean ~1.2): raise it out there,
    // or the bloom washes the screen white whenever a cloud shadow moves off
    this.bloom.threshold = Math.max((AIR[this._indoor ? 'indoor' : this._theme || 'valley'] || AIR.valley).bloom, this._brightGround && !this._indoor ? 1.75 : 0);
    { // and a little less exposure over that white ground, eased so walking onto it never pops
      const want = (this._brightGround && !this._indoor ? 0.84 : 1.04) + 0.08 * (this._houseK || 0), r = this.renderer; r.toneMappingExposure += (want - r.toneMappingExposure) * Math.min(1, dt * 1.5); }
    // the house lift (setHouseLight), eased linearly over 0.4 s
    { const w = this._houseWant || 0, k = this._houseK || 0; this._houseK = w > k ? Math.min(w, k + dt / 0.4) : Math.max(w, k - dt / 0.4); }
    // moonlight drains colour: the grade cools and desaturates by night (outdoors only; dungeons keep their own look)
    { const nk = this._indoor ? 0 : this._nk || 0, gu = this.grade.uniforms; gu.saturation.value = 1.1 - 0.64 * nk; gu.satHi.value = 0.6 * nk; gu.vignette.value = 0.2 + 0.1 * nk; gu.shadowTint.value.set(-0.012 - 0.02 * nk, 0.004 - 0.002 * nk, 0.03 + 0.055 * nk); gu.lift.value = 0.006 + 0.018 * nk; } // (judge: the grass greys to moonlit blue-grey, the darks lift to a blue haze, not black)
    this.updateAtmos();
    // the house cut-away faces the camera that is about to draw (camera forward on the ground)
    if (G.cutOn.value > 0.5) { this.camera.getWorldDirection(_fwd); if (Math.hypot(_fwd.x, _fwd.z) > 1e-4) G.cutDir.value.set(_fwd.x, _fwd.z).normalize(); }
    // (the sky light and the image-based ambient are the scene's ambient: both lift)
    const hk = this._indoor ? 0 : this._houseK || 0, hemi = this.hemi, hi = hemi.intensity, ei = this.scene.environmentIntensity;
    if (hk > 0.001) { _hemiSave.copy(hemi.color); hemi.intensity = hi * (1 + 0.25 * hk); hemi.color.lerp(_houseWarm, 0.25 * hk); this.scene.environmentIntensity = ei * (1 + 0.25 * hk); }
    if (this._rtSpare) { const c = this.composer; c.readBuffer = this._rtMain; c.writeBuffer = c.renderTarget2; } // C1: the scene always lands on the MSAA target
    { const sm = this.renderer.shadowMap, on = sm.enabled && (sm.autoUpdate || sm.needsUpdate);
      // v115: will the static casters be drawn into the shadow map this frame (shadowCache.js)? coarse.js then skips the
      // static-only subtrees outside the view on the frames they are not
      this.coarse.staticOn = on ? this.shadowCache.prepare() : false;
      this.coarse.begin(this.camera, this.sun, sm.enabled && (sm.autoUpdate || sm.needsUpdate), freezeVersion() + (this._coarseV || 0), performance.now()); }
    try { this.composer.render(dt); } finally { this.coarse.end(); if (hk > 0.001) { hemi.intensity = hi; hemi.color.copy(_hemiSave); this.scene.environmentIntensity = ei; } }
    return dt;
  }

  // the frame cap in force (A1): SETTINGS.fpsCap (the one frame-cap setting; touch.fps is its alias), 30 under Battery
  // saver or while the phone runs hot. ?fps=<n> overrides it (bench runs: ?fps=0 measures uncapped)
  wantCap() {
    const q = /[?&]fps=(\d+)/.exec(location.search);
    if (q) return normalizeCap(+q[1], 0);
    let c = normalizeCap(SETTINGS.fpsCap, IS_MOBILE ? 60 : 0);
    if (SETTINGS.battery || this._hot) c = c ? Math.min(c, 30) : 30;
    return c;
  }

  // the frame loop, on the pacer (pacer.js): the cap (phones 60, the desktop every vsync = the monitor's rate), no drawing
  // while hidden or minimised (the world keeps ticking), 30 fps on the desktop while another window has focus, dynamic
  // resolution on the phones (A3) and, in the app, the panel's refresh rate and the thermal governor (display.js)
  start(cb) {
    // SHOT / bench runs (?test=1) never throttle: they draw off-screen and unfocused
    const test = /[?&]test=1\b/.test(location.search);
    const frame = () => this.frame(); // (not bound once: the bench wraps engine.frame on the instance later)
    const base = QUALITY.pixelRatio, floor = () => (SETTINGS.battery || this._hot ? 0.65 : QUALITY.dynResMin ?? 0.75);
    // phones: dynamic resolution between the floor and the preset's ratio; ?dynres=0 turns it off (bench)
    const dr = (this.dynres = IS_MOBILE && SETTINGS.dynRes !== false && !/[?&]dynres=0\b/.test(location.search)
      ? new DynRes({ min: Math.min(floor(), base), max: base, apply: (r) => this.setRenderScale(r) }) : null);
    // the desktop: Electron keeps document.hidden false (backgroundThrottling:false), so desktop/main.js tells the page
    // when the window is minimised (window.__sunmereMinimised + a 'sunmere:winstate' event)
    const isHidden = () => document.hidden || !!window.__sunmereMinimised;
    const pacer = (this.pacer = createPacer({
      cap: this.wantCap(),
      blurCap: IS_MOBILE || test ? 0 : 30, // the desktop: 30 fps while another window has focus (A2)
      pauseHidden: IS_MOBILE || !test, // stop drawing while hidden / minimised; the world keeps ticking
      isHidden,
      onResume: () => { this.timer.update(); dr?.reset(performance.now()); },
      onVisibility: (s) => setBgState(s.hidden, s.focused), // platform.js bgState() / BG_EVENT for the sim and the minimap
      onFrame: (now, dtMs, info) => {
        const t0 = performance.now();
        cb?.(frame);
        if (dr && now >= (this._drHold || 0)) { dr.setBudget(info.budgetMs || 1000 / 60); dr.sample({ now, intervalMs: dtMs, missed: info.missed, cpuMs: performance.now() - t0, gpuMs: this.gpuMs }); }
      },
    }));
    addEventListener('sunmere:winstate', () => pacer.visibilityChanged());
    // a live cap change (options, Battery saver, the thermal tier): the pacer, and in the app the panel's refresh rate
    // (60 Hz for a 60 or 30 cap, so the panel stops waking 120 times a second)
    const applyCap = (force) => {
      const c = this.wantCap();
      if (!force && c === pacer.cap) return;
      pacer.setCap(c);
      if (hasDisplayPlugin()) setPanelRate(c).then((hz) => { if (hz > 0) pacer.setRefreshHz(hz); });
    };
    this.applyCap = applyCap;
    // after a teleport (game.js): back to the preset's ratio, and 2.5 s of arrival (uploads, spawns) left unjudged
    this.afterTeleport = () => { if (!dr) return; const t = performance.now(); this._drHold = t + 2500; dr.force(dr.max, t); dr.reset(t + 2500); };
    addEventListener(FPS_EVENT, () => { dr?.setRange(Math.min(floor(), base), null); applyCap(); });
    // the touch options row writes SETTINGS.touch.fps (an alias of SETTINGS.fpsCap), then fires TOUCH_EVENT
    addEventListener(TOUCH_EVENT, () => applyCap());
    if (hasDisplayPlugin()) {
      applyCap(true);
      watchRefresh((hz) => pacer.setRefreshHz(hz));
      // thermal governor (A3): at MODERATE (or headroom > 0.8) drop to the Battery tier live: 30 fps, ratio 0.65..1.0;
      // back after 60 s cool
      this.thermal = new ThermalGovernor({ onChange: (hot, t) => {
        this._hot = hot;
        dr?.setRange(Math.min(floor(), base), hot ? Math.min(base, 1) : base);
        applyCap();
        console.warn('[thermal]', hot ? 'hot: battery tier' : 'cool: normal tier', JSON.stringify(t));
      } });
      watchThermal(this.thermal);
    }
    // phones can take the GPU away from a backgrounded app. The slimmed world geometry (engine/slim.js) has no JS copy to
    // upload again, so when the GPU comes back the page saves and starts afresh rather than drawing a black screen
    if (IS_MOBILE) {
      const cv = this.renderer.domElement;
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('[mobile] graphics context lost'); });
      cv.addEventListener('webglcontextrestored', () => { try { window.game?.net?.saveNow?.(); } catch { /* saved on hide too */ } setTimeout(() => location.reload(), 300); });
    }
    pacer.start();
  }
}
