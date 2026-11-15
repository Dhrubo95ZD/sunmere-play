// What you have selected, and what is under the mouse, made easy to see:
//  - an animated ground ring sized to the body (red: aggressive or fighting, yellow: passive until struck,
//    green: friendly NPCs and players, grey: a body), tilted to the slope under it;
//  - a soft outline (inverted hull) and a fresnel rim on the model itself, sharing the model's geometry and skeleton
//    (a couple of extra draws for one character, no extra render pass);
//  - a small turning marker over the head (a plain pyramid pointing down);
//  - mob nameplates turn yellow for passive foes (data-mood on the plate, see hud.css).
// Hover gets a fainter ring and rim only. Mobs at or below the hero's level + 2 do not attack on sight.
import * as THREE from 'three';
import { MOBS } from '/sunmere-play/shared/data.js';

const COLORS = { hostile: new THREE.Color('#ff3b2a'), passive: new THREE.Color('#ffd23a'), friendly: new THREE.Color('#5ee860'), dead: new THREE.Color('#a8a8a8') };
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3();

// passive (does not attack on sight) vs aggressive, by the same rule the server uses
export function moodOf(v, you) {
  if (!v) return null;
  if (v.ty === 'n' || v.ty === 'p') return 'friendly';
  if (v.dead) return 'dead';
  const d = v.data || {}, def = v.def || MOBS[d.k] || {};
  if (d.t) return 'hostile'; // in a fight (with anyone)
  if (def.passive || def.dummy) return 'passive';
  const lvl = you?.level || 1;
  return (d.l || 1) <= lvl + 2 ? 'passive' : 'hostile';
}

function ringMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uAlpha: { value: 1 }, uArcs: { value: 1 }, uW: { value: 0.09 }, uR: { value: 1 }, uPush: { value: 0.45 } },
    // the ring's depth is pulled toward the camera along the view ray (same spot on screen): it reads over the grass
    // blades round the feet, but walls and hills still hide it
    vertexShader: /* glsl */`uniform float uPush; varying vec2 vUv; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.xyz *= max(0.05, 1.0 - uPush / max(length(mv.xyz), 1e-3)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uTime, uAlpha, uArcs, uW, uR;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv * 2.0 - 1.0) * 1.6; // 1.0 = the ring radius, the quad reaches 1.6
        float r = length(p);
        float w = uW / uR; // band half-width, constant in metres whatever the size
        float d = abs(r - 1.0);
        float band = 1.0 - smoothstep(w * 0.55, w, d);
        float rim = (1.0 - smoothstep(w, w * 1.9, d)) * (1.0 - band); // a dark edge so it reads on bright ground
        float fill = smoothstep(1.0, 0.2, r) * smoothstep(0.0, 0.9, r) * 0.16;
        float glow = exp(-pow((r - 1.0) / (w * 3.5), 2.0)) * 0.35;
        // three short arcs running round just outside the band (curved dashes, nothing radiating)
        float a = atan(p.y, p.x);
        float arcs = smoothstep(0.55, 0.8, sin(a * 3.0 - uTime * 1.8)) * (1.0 - smoothstep(w * 0.25, w * 0.6, abs(r - 1.0 - w * 2.6))) * uArcs;
        float pulse = 0.82 + 0.18 * sin(uTime * 4.2);
        vec3 col = mix(uColor, vec3(1.0), band * 0.18);
        float alpha = band * pulse + arcs * 0.95 + glow + fill;
        vec3 c = mix(col, col * 0.12, rim / max(alpha + rim, 1e-3));
        float o = clamp(alpha + rim * 0.55, 0.0, 1.0) * uAlpha * smoothstep(1.6, 1.45, r);
        if (o < 0.004) discard;
        gl_FragColor = vec4(c, o);
      }`,
  });
}

// outline (back faces pushed out along the normal) and rim (front faces, fresnel, additive); both skin like the model
function hullMaterial(rim) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: rim ? THREE.FrontSide : THREE.BackSide,
    blending: rim ? THREE.AdditiveBlending : THREE.NormalBlending, depthFunc: THREE.LessEqualDepth,
    uniforms: { uColor: { value: new THREE.Color() }, uA: { value: 1 }, uW: { value: rim ? 0.006 : 0.035 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <batching_pars_vertex>
      #include <skinning_pars_vertex>
      uniform float uW;
      varying vec3 vN; varying vec3 vV;
      void main() {
        #include <batching_vertex>
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        transformed += normalize(normal) * uW;
        #include <skinning_vertex>
        #include <project_vertex>
        vN = normalize(transformedNormal); vV = normalize(-mvPosition.xyz);
      }`,
    fragmentShader: rim ? /* glsl */`
      uniform vec3 uColor; uniform float uA; varying vec3 vN; varying vec3 vV;
      void main() { float f = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2); gl_FragColor = vec4(uColor * f * uA, 1.0); }`
      : /* glsl */`uniform vec3 uColor; uniform float uA; void main() { gl_FragColor = vec4(uColor, uA); }`,
  });
}

class Highlight {
  constructor(scene, strong) {
    this.strong = strong;
    this.ringMat = ringMaterial();
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.renderOrder = 3; this.ring.visible = false; this.ring.frustumCulled = false;
    scene.add(this.ring);
    this.hullMat = hullMaterial(false); this.rimMat = hullMaterial(true);
    if (strong) {
      this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.34, 4, 1).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false }));
      this.marker.renderOrder = 4; this.marker.visible = false;
      scene.add(this.marker);
    }
    this.view = null; this.hulls = []; this.sig = 0; this.checkT = 0; this.fade = 0;
  }
  sources(v) {
    const out = [], skip = new Set([v.marker, v.sparkle].filter(Boolean));
    const walk = (o) => {
      if (skip.has(o) || o.visible === false || o.userData.isHull) return;
      if (o.isMesh && !o.isInstancedMesh && o.geometry?.attributes?.normal) {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m && !m.transparent && m.visible !== false) out.push(o);
      }
      for (const c of o.children) walk(c);
    };
    walk(v.root);
    return out;
  }
  clearHulls() { for (const h of this.hulls) h.parent?.remove(h); this.hulls = []; }
  build(v) {
    this.clearHulls();
    const src = this.sources(v);
    this.sig = src.length; this.gen = v.char?.userData.mergeGen | 0;
    const mats = this.strong ? [this.hullMat, this.rimMat] : [this.rimMat];
    for (const s of src) for (const mat of mats) {
      let h;
      // (a merged character, assets/charMerge.js: the front part only, not its double-sided cloth's back copies)
      if (s.isSkinnedMesh) { h = new THREE.SkinnedMesh(s.geometry.userData.hullGeo || s.geometry, mat); h.bind(s.skeleton, s.bindMatrix); h.bindMode = s.bindMode; }
      else h = new THREE.Mesh(s.geometry, mat);
      h.userData.isHull = true; h.frustumCulled = false; h.castShadow = h.receiveShadow = false; h.renderOrder = mat === this.rimMat ? 2 : 1;
      s.add(h); this.hulls.push(h);
    }
  }
  set(v) {
    if (v === this.view) return;
    this.clearHulls(); this.view = v; this.fade = 0;
    if (v) this.build(v);
  }
  update(dt, t, you, heightAt) {
    const v = this.view;
    if (!v || !v.root.parent || v.root.visible === false) { if (v && !v.root.parent) this.set(null); this.ring.visible = false; if (this.marker) this.marker.visible = false; return; }
    this.fade = Math.min(1, this.fade + dt * 6);
    this.checkT -= dt;
    if ((v.char?.userData.mergeGen | 0) !== this.gen) this.build(v); // (v115: a player merged or taken apart, charMerge.js)
    if (this.checkT <= 0) { this.checkT = 0.8; if (this.sources(v).length !== this.sig) this.build(v); } // gear swaps, mounting
    const mood = moodOf(v, you), col = COLORS[mood] || COLORS.passive;
    const S = this.strong, a = this.fade;
    // the ring: sized to the body, at the feet, tilted to the ground when it stands on open ground
    const R = Math.max(0.6, (v.radius || 0.5) * 1.15 + 0.3) * (v.mounted ? 1.5 : 1);
    const p = v.root.position;
    this.ring.visible = true;
    this.ring.position.set(p.x, p.y + 0.05, p.z);
    this.ring.scale.setScalar(R * 1.6);
    const h0 = heightAt ? heightAt(p.x, p.z) : p.y;
    if (heightAt && Math.abs(h0 - p.y) < 0.35) {
      const e = Math.min(R, 1.6);
      _n.set(heightAt(p.x - e, p.z) - heightAt(p.x + e, p.z), 2 * e, heightAt(p.x, p.z - e) - heightAt(p.x, p.z + e)).normalize();
      this.ring.quaternion.copy(_q.setFromUnitVectors(_up, _n));
      this.ring.position.y = h0 + 0.05;
    } else this.ring.quaternion.identity();
    const U = this.ringMat.uniforms;
    U.uColor.value.copy(col); U.uTime.value = t; U.uR.value = R; U.uW.value = S ? 0.085 : 0.05; U.uPush.value = S ? 0.45 : 0.3;
    U.uArcs.value = S && mood !== 'dead' ? 1 : 0; U.uAlpha.value = (S ? 1 : 0.65) * a;
    // the model: outline and rim in the mood colour, the rim breathing a little
    this.hullMat.uniforms.uColor.value.copy(col).multiplyScalar(0.9); this.hullMat.uniforms.uA.value = 0.62 * a;
    this.rimMat.uniforms.uColor.value.copy(col); this.rimMat.uniforms.uA.value = (S ? 0.55 + 0.12 * Math.sin(t * 3.4) : 0.4) * a * (mood === 'dead' ? 0.4 : mood === 'friendly' || v.ty !== 'm' ? 0.35 : 1); // (a soft edge on friendlies: a strong green rim read as a ghost)
    if (this.marker) {
      const M = this.marker;
      M.visible = !v.marker && !v.dead; // quest givers already wear a marker there
      M.position.set(p.x, p.y + (v.height || 2) * (v.root.scale?.y || 1) + 1.05 + Math.sin(t * 3) * 0.07, p.z);
      M.rotation.y = t * 1.6;
      M.material.color.copy(col); M.material.opacity = 0.95 * a;
    }
  }
}

export class TargetFX {
  constructor(scene, heightAt) {
    this.heightAt = heightAt;
    this.sel = new Highlight(scene, true);
    this.hov = new Highlight(scene, false);
    this.t = 0; this.plateT = 0;
  }
  // F3: the outline and rim materials compiled behind the loading screen, on a plain and on a skinned mesh (characters are
  // skinned, machines are not), so the first target does not stall on a shader build. The stand-ins share the materials
  // and are dropped afterwards (the materials themselves live on in the highlights)
  async warm(renderer, camera, litBy) {
    const tmp = new THREE.Scene(), geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const si = new Float32Array(geo.attributes.position.count * 4), sw = si.slice().fill(0);
    for (let i = 0; i < sw.length; i += 4) sw[i] = 1;
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    const bone = new THREE.Bone(), skel = new THREE.Skeleton([bone]);
    for (const H of [this.sel, this.hov]) for (const m of [H.hullMat, H.rimMat]) {
      const a = new THREE.Mesh(geo, m), b = new THREE.SkinnedMesh(geo, m);
      b.add(bone.clone()); b.bind(skel); tmp.add(a, b);
      tmp.add(new THREE.Mesh(geo, H.ringMat));
      if (H.marker) tmp.add(new THREE.Mesh(geo, H.marker.material));
    }
    tmp.add(bone);
    try { await renderer.compileAsync(tmp, camera, litBy); } catch (e) { console.warn('[targetfx warm]', e?.message || e); }
    finally { tmp.clear(); }
  }
  // target / hover: EntityViews (or null); ui: the game's UI (its nameplates get a data-mood)
  update(dt, target, hover, you, ui) {
    this.t += dt;
    this.sel.set(target || null);
    this.hov.set(hover && hover !== target ? hover : null);
    this.sel.update(dt, this.t, you, this.heightAt);
    this.hov.update(dt, this.t, you, this.heightAt);
    // mob nameplates: passive foes read yellow, aggressive ones red (a few times a second is plenty)
    this.plateT -= dt;
    if (this.plateT <= 0 && ui?.plates && ui.g?.entities) {
      this.plateT = 0.25;
      for (const [id, el] of ui.plates) {
        const v = ui.g.entities.get(id);
        const m = v && v.ty === 'm' ? moodOf(v, you) : '';
        if (el.dataset.mood !== m) el.dataset.mood = m;
      }
    }
  }
}
