// The quest walk (v109): click (or tap) a quest in the tracker or the quest log and the hero walks there by themselves,
// round houses, walls, cliffs and water, and a faint trail of trodden prints on the ground shows the way ahead.
//  - where to: ui.questTargets() (the same points the map and minimap mark): the hand-in NPC when the quest is complete,
//    else the nearest objective area; a target across the sea, up the lift or in a dungeon you are not in gives the
//    pier, the lift keeper or the dungeon door instead (the walk stops there, and picks up again on the far side).
//  - how: a 2 m grid A* per outdoor area or dungeon, filled lazily and cached (shared/pathfind.js), round the shared house
//    walls and the client's static colliders (trees, rocks, buildings), in and out of houses by their doors.
//  - moving: steer() hands game.js a direction, which it walks exactly like a held key (the same collisions, the same
//    position updates to the server), at the mount's speed when riding. A key, the stick, a click on the ground or on
//    something, a skill, a hit taken or death ends it; so does arriving (within ~4 m).
//  - the trail: one instanced mesh of soft prints along the next ~36 m of the route, terrain-following, fading in and out,
//    with a slow glint running along; rebuilt four times a second. Shown while walking, and (Options: Quest trail) along
//    the tracked quest's route when you walk yourself. Never a cross, star or plus: plain soft ovals.
import * as THREE from 'three';
import { SETTINGS } from '../engine/settings.js';
import { PathGrid, outdoorTest, outdoorEdge, planOutdoor } from '/sunmere-play/shared/pathfind.js';
import { walkHeight, waterAt, worldGap, areaOf, roadDist, groundAt, WORLD, AREA_BY_ID } from '/sunmere-play/shared/terrain.js';
import { houseAt, housePush, houseCrosses } from '/sunmere-play/shared/houses.js';
import { dungeonAt, isFloor, CELL, DUNGEON_MIN_X } from '/sunmere-play/shared/dungeons.js';
import { QUESTS } from '/sunmere-play/shared/data.js';

const NAV = { walkHeight, waterAt, worldGap, areaOf, housePush, houseAt, houseCrosses, roadDist };
const MAX_MARKS = 56, SPACING = 0.82, AHEAD = 36;
// pale trodden dust, a touch of the tracker's brass in the glint (low saturation: part of the ground, not a UI line)
// (as gains over the ground's own colour: a print presses it darker and a little warmer, like trodden earth; the glint
// lifts it back toward the tracker's brass)
const ACCENT = new THREE.Color(0.95, 0.8, 0.45), PRINT = new THREE.Color(0.1, 0.075, 0.045);
// (v111) on dark ground (soot, forest floor, the Reach's black sand) a print lifts the ground instead: scuffed pale dust,
// a gain a little under 2 (a dim ground stays dim: it reads as a lighter mark, never a glow)
const LIFT = new THREE.Color(1.95, 1.8, 1.55);
// how pale the ground is under a print, from the terrain's paint (shared/terrain.js groundAt): +1 pale (village cobbles,
// sand, snow, salt), -1 dark (soot, forest floor, black sand and basalt), 0 grass, earth and floors
export function groundTone(x, z) {
  if (x >= DUNGEON_MIN_X || houseAt(x, z, true)) return 0;
  const g = groundAt(x, z), black = areaOf(x, z) === 'reach'; // (on the Reach the sand channel is black sand and ash)
  const pale = Math.max(g.cobble || 0, black ? 0 : g.sand || 0, g.snow || 0, (g.path || 0) * 0.35);
  const dark = Math.max(g.foundry || 0, (g.forest || 0) * 0.7, black ? Math.max(g.sand || 0, (g.rock || 0) * 0.6) : 0);
  return Math.max(-1, Math.min(1, pale - dark));
}

function trailMaterial() {
  return new THREE.ShaderMaterial({
    // multiplied into the ground under it (dst * src, in the HDR target before tone mapping): a print presses whatever lies
    // there darker by the same share in any light (a plain alpha blend of a fixed colour barely showed on the lit HDR
    // ground); the glint, a little over 1, lifts it
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uTime: { value: 0 }, uS0: { value: 0 }, uEnd: { value: AHEAD }, uP: { value: new THREE.Vector3() }, uAccent: { value: ACCENT }, uPrint: { value: PRINT }, uLift: { value: LIFT }, uA: { value: 0 }, uPush: { value: 1.1 } },
    vertexShader: /* glsl */`
      attribute float aS, aT;
      uniform float uS0, uPush;
      varying vec2 vUv; varying float vS, vT; varying vec3 vW;
      void main() {
        vUv = uv; vS = aS; vT = aT;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        mv.xyz *= max(0.05, 1.0 - uPush / max(length(mv.xyz), 1e-3)); // (pulled toward the camera along the view ray, same spot on screen: it reads over the grass blades, as the target ring does; walls and hills still hide it)
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uS0, uEnd, uA; uniform vec3 uP, uAccent, uPrint, uLift;
      varying vec2 vUv; varying float vS, vT; varying vec3 vW;
      void main() {
        // a soft print: an oval, a little wider at the front, pressed darker at its rim than in the middle
        vec2 p = vUv * 2.0 - 1.0;
        p.x *= 1.0 + 0.25 * p.y;
        float r = length(p);
        float body = 1.0 - smoothstep(0.72, 1.0, r);
        if (body < 0.01) discard;
        float rim = smoothstep(0.25, 0.8, r) * body;
        float ahead = vS - uS0;
        float fade = smoothstep(0.6, 2.5, length(vW.xz - uP.xz)) * (1.0 - smoothstep(uEnd - 14.0, uEnd, ahead)) * (0.75 + 0.25 * smoothstep(12.0, 2.0, ahead));
        // a slow glint running along the trail, every 14 m
        float ph = mod(ahead - uTime * 4.5, 14.0);
        float glint = exp(-ph * ph / 3.0) + exp(-(14.0 - ph) * (14.0 - ph) / 3.0);
        // (the lit ground sits high on the tone curve, where only a strong share reads at all)
        // (v111) tinted by the ground: pressed harder on pale stone and sand (a pale lit ground sits highest on the curve),
        // lifted to pale dust on dark ground
        float pale = max(vT, 0.0), dark = max(-vT, 0.0);
        float k = min(0.92 + 0.05 * pale, (0.86 * body + 0.1 * rim) * fade * uA * (1.0 + 0.55 * pale));
        float g = glint * body * fade * uA;
        if (k < 0.004 && g < 0.004) discard;
        vec3 c = mix(mix(vec3(1.0), uPrint, k), mix(vec3(1.0), uLift, k), dark);
        gl_FragColor = vec4(mix(c, uAccent * 1.6, g * 0.85), 1.0);
      }`,
  });
}

export class QuestWalk {
  // o: { scene, world, ui, game, heightAt, busy }
  constructor(o) {
    Object.assign(this, o);
    this.grids = new Map();
    this.qid = null; this.path = null; this.wp = 1; this.goal = null; this.passive = null; this.resume = null;
    this.tick = 0; this.trailT = 0; this.replanT = 0; this.stuckT = 0; this.stuckRef = null; this.stuckN = 0; this.alpha = 0;
    const geo = new THREE.PlaneGeometry(0.28, 0.48).rotateX(-Math.PI / 2);
    this.aS = new THREE.InstancedBufferAttribute(new Float32Array(MAX_MARKS), 1);
    geo.setAttribute('aS', this.aS);
    this.aT = new THREE.InstancedBufferAttribute(new Float32Array(MAX_MARKS), 1); // (v111: the ground's tone under each print)
    geo.setAttribute('aT', this.aT);
    this.mat = trailMaterial();
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX_MARKS);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.visible = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.mesh);
  }
  get active() { return !!this.qid; }

  // ------------------------------------------------------------------ the grids
  gridFor(x, z) {
    const D = x >= DUNGEON_MIN_X ? dungeonAt(x, z) : null;
    const key = D ? 'd:' + D.id : areaOf(x, z);
    if (key === 'dungeon') return null;
    let g = this.grids.get(key);
    if (g) return g;
    const W = this.world, probe = { x: 0, z: 0 };
    // the client's static colliders (trees, rocks, buildings and walls): blocked when a walker there would be pushed
    const solid = (x, z, r) => { probe.x = x; probe.z = z; W.collide(probe, r); return Math.abs(probe.x - x) + Math.abs(probe.z - z) > 0.02; };
    if (D) {
      // a dungeon: its own floor grid, the cells lined up with its 2 m floor cells
      g = new PathGrid({ minX: D.ox, minZ: D.oz, maxX: D.ox + D.nx * CELL, maxZ: D.oz + D.nz * CELL, cell: CELL, test: (x, z) => (isFloor(D, x, z) && !solid(x, z, 0.4) ? 1 : 0) });
      g.area = key; g.dungeon = D;
    } else {
      const B = key === 'valley' ? WORLD : AREA_BY_ID[key]?.box;
      if (!B) return null;
      const extra = (x, z) => solid(x, z, 0.75);
      const thin = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 0.6)); for (let s = 1; s < n; s++) if (solid(x0 + (x1 - x0) * (s / n), z0 + (z1 - z0) * (s / n), 0.3)) return true; return false; };
      g = new PathGrid({ minX: B.minX, minZ: B.minZ, maxX: B.maxX, maxZ: B.maxZ, cell: 2, test: outdoorTest(key, NAV, extra), edge: outdoorEdge(NAV, thin) });
      g.area = key;
    }
    this.grids.set(key, g);
    return g;
  }
  plan(from, to) {
    const g = this.gridFor(from.x, from.z);
    if (!g) return null;
    // the static colliders changed (a house's yard props and furniture are built as you come near, and freed again):
    // what the grid knows is out of date, so it is tested afresh as the search reaches it
    const W = this.world, sig = W.colliders.length + ':' + W.boxes.length;
    if (g.sig !== sig) { if (g.sig) g.reset(); g.sig = sig; }
    if (g.dungeon) { const P = g.find(from.x, from.z, to.x, to.z, { water: true, partial: true }); return P ? { pts: P, partial: false } : null; }
    return planOutdoor(g, from.x, from.z, to.x, to.z, NAV, { maxNodes: 120000 });
  }

  // ------------------------------------------------------------------ where a quest wants you
  targetOf(qid) { return this.ui.questTargets().find((t) => t.qid === qid) || null; }
  // the quest the tracker shows first: the Main Story (when it is shown), else the first tracked quest
  trackedQid() {
    const ui = this.ui, y = ui.you; if (!y) return null;
    const S = ui.storyNow();
    if (S && S.at?.qid && !ui.untracked.has('msq') && (S.state === 'active' || S.state === 'ready' || S.state === 'offer')) return S.at.qid;
    return Object.keys(y.quests || {}).find((id) => !ui.untracked.has(id)) || null;
  }

  // ------------------------------------------------------------------ start / stop
  start(qid) {
    const me = this.game.playerPos();
    const t = this.targetOf(qid);
    const name = QUESTS[qid]?.name || 'the quest';
    if (!t) { this.ui.error(`${name}: nowhere to walk to just now.`); return false; }
    if (this.game.you?.dead) { this.ui.error('Not while you are defeated.'); return false; }
    this.qid = qid; this.resume = null; this.stuckN = 0; this.passive = null;
    if (!this.replan(me, t)) { this.qid = null; this.ui.error(`${name}: no way there from here.`); this.ui.renderTracker(); return false; }
    if (this.arrived(me)) { this.finish(true); return true; }
    this.ui.chat(`Travelling to <b>${name}</b>${t.door ? ' (by way of the crossing)' : ''}. Move to stop.`, '#d8c690');
    this.ui.renderTracker();
    return true;
  }
  stop(why) {
    if (!this.qid) return;
    this.qid = null; this.path = null; this.goal = null;
    if (why === 'manual' || why === 'combat' || why === 'dead') this.resume = null;
    if (why === 'combat') this.ui.chat('Travelling stopped: you are in a fight.', '#d8c690');
    this.ui.renderTracker();
  }
  finish(ok) {
    const t = this.goal, qid = this.qid;
    this.stop('arrived');
    if (!ok || !t) return;
    const name = QUESTS[qid]?.name || 'the quest';
    if (t.door) {
      // a crossing point: carry on once you are over the water, up the lift or through the door
      this.resume = { qid, area: this.areaKey(this.game.playerPos()), until: performance.now() + 240000 };
      this.ui.chat(`${name}: the way goes on from here. Speak to whoever runs the crossing (or step through), and the walk picks up on the far side.`, '#d8c690');
    } else this.ui.chat(`You have arrived: <b>${name}</b>.`, '#d8c690');
  }
  areaKey(p) { const D = p.x >= DUNGEON_MIN_X ? dungeonAt(p.x, p.z) : null; return D ? 'd:' + D.id : areaOf(p.x, p.z); }
  arrived(p) {
    const t = this.goal; if (!t) return false;
    const d = Math.hypot(t.x - p.x, t.z - p.z), H = houseAt(t.x, t.z, false);
    if (H) return d < 2.2 || (houseAt(p.x, p.z, false)?.id === H.id && d < 3.5);
    return d < (t.door ? 2.5 : 4);
  }
  replan(me, t) {
    const R = this.plan(me, t);
    if (!R || R.pts.length < 2) return false;
    this.path = R.pts; this.wp = 1; this.goal = { ...t }; this.partial = R.partial;
    this.replanT = 0; this.stuckRef = { x: me.x, z: me.z }; this.stuckT = 0;
    this.trailDirty = true;
    return true;
  }

  // ------------------------------------------------------------------ each frame
  // the direction to walk this frame (a THREE.Vector3 on the ground), or null
  steer(me, out) {
    const P = this.path; if (!this.qid || !P) return null;
    // skip waypoints already reached (or passed: past the next one's bisector)
    while (this.wp < P.length) {
      const [x, z] = P[this.wp], d = Math.hypot(x - me.x, z - me.z);
      if (d < (this.wp === P.length - 1 ? 0.3 : 0.9)) { this.wp++; continue; }
      if (this.wp < P.length - 1) {
        const [ax, az] = P[this.wp - 1], ux = x - ax, uz = z - az;
        if ((me.x - ax) * ux + (me.z - az) * uz > ux * ux + uz * uz) { this.wp++; continue; }
      }
      break;
    }
    if (this.wp >= P.length) return null;
    const [x, z] = P[this.wp];
    out.set(x - me.x, 0, z - me.z);
    return out.lengthSq() > 1e-6 ? out : null;
  }
  // is the next waypoint a house door or room, close ahead? (riders get off there)
  nextIndoors(me) {
    const P = this.path; if (!P || this.wp >= P.length) return false;
    const [x, z] = P[this.wp];
    return Math.hypot(x - me.x, z - me.z) < 3.5 && !!houseAt(x, z, true);
  }
  // timers: arrival, the target moving (a quest step done), getting stuck, the crossing resume; and the trail
  update(dt, me) {
    const y = this.game.you;
    this.tick += dt;
    if (this.qid) {
      if (y?.dead) this.stop('dead');
      else if (this.arrived(me)) this.finish(true);
      else {
        this.replanT += dt; this.stuckT += dt;
        if (this.replanT > 1) {
          this.replanT = 0;
          const t = this.targetOf(this.qid);
          if (!t) { this.finish(true); }
          else if (Math.hypot(t.x - this.goal.x, t.z - this.goal.z) > 3 || t.door !== this.goal.door || (this.path && this.wp >= this.path.length)) this.replan(me, t);
          else {
            // pushed off the route (a villager, a cart): plan again from here
            const [ax, az] = this.path[Math.max(0, this.wp - 1)], [bx, bz] = this.path[Math.min(this.path.length - 1, this.wp)];
            if (segDist(me.x, me.z, ax, az, bx, bz) > 4) this.replan(me, t);
          }
        }
        if (this.qid && this.stuckT > 2.5) {
          const moved = Math.hypot(me.x - this.stuckRef.x, me.z - this.stuckRef.z);
          this.stuckT = 0; this.stuckRef = { x: me.x, z: me.z };
          if (moved < 1 && !this.game.casting) {
            // stuck on something the grid did not know: mark round the hero blocked-unknown and plan again
            if (++this.stuckN > 3) { this.ui.chat('Travelling stopped: the way is blocked.', '#d8c690'); this.stop('stuck'); }
            else { const g = this.gridFor(me.x, me.z); g?.forget(me.x, me.z, 3); const t = this.targetOf(this.qid); if (!t || !this.replan(me, t)) this.stop('stuck'); }
          } else this.stuckN = 0;
        }
      }
    } else if (this.resume) {
      // after a crossing: the walk carries on in the new area
      if (performance.now() > this.resume.until || !y?.quests?.[this.resume.qid] && !this.targetOf(this.resume.qid)) this.resume = null;
      else if (this.areaKey(me) !== this.resume.area && !this.busy?.()) { const q = this.resume.qid; this.resume = null; this.start(q); }
    }
    this.updateTrail(dt, me);
  }

  // ------------------------------------------------------------------ the trail
  updateTrail(dt, me) {
    const want = this.qid ? 1 : SETTINGS.questTrail !== false && !dungeonAt(me.x, me.z) && this.passiveTrail(dt, me) ? 0.8 : 0;
    const on = want > 0; // (the setting covers the trail when you walk yourself; a quest walk always shows its way)
    this.alpha += ((on ? want : 0) - this.alpha) * Math.min(1, dt * 3);
    // (the prints press the ground darker by a share, and dim ground shows a share more: lighter by night and underground)
    const E = this.game.engine, sun = E?.sun && E._base ? Math.min(1, E.sun.intensity / Math.max(0.01, E._base.sun)) : 1;
    this.mat.uniforms.uA.value = this.alpha * (0.6 + 0.4 * sun);
    this.mat.uniforms.uTime.value = this.tick;
    this.mat.uniforms.uP.value.set(me.x, me.y, me.z);
    this.mesh.visible = this.alpha > 0.01 && this.mesh.count > 0;
    if (!on && this.alpha < 0.01) return;
    this.trailT += dt;
    if (this.trailT < 0.25 && !this.trailDirty) return;
    this.trailT = 0; this.trailDirty = false;
    const P = this.qid ? this.path : this.passive?.path;
    if (!P || P.length < 2) { this.mesh.count = 0; return; }
    this.layTrail(P, me, this.qid ? this.wp : 1);
  }
  // when walking yourself: the tracked quest's route, planned again every few seconds or after a long way
  passiveTrail(dt, me) {
    const qid = this.trackedQid();
    if (!qid) { this.passive = null; return false; }
    const S = this.passive;
    const now = performance.now();
    if (S) S.t = (now - S.t0) / 1000;
    if (!S || S.qid !== qid || S.t > 4 || Math.hypot(me.x - S.x, me.z - S.z) > 8) {
      if (S && S.qid === qid && S.t < 1.2) return !!S.path; // (at most about once a second)
      const t = this.targetOf(qid);
      let path = null;
      if (t && Math.hypot(t.x - me.x, t.z - me.z) > 6) { this.goal = t; const R = this.plan(me, t); this.goal = null; path = R?.pts || null; }
      this.passive = { qid, t: 0, t0: now, x: me.x, z: me.z, path };
      this.trailDirty = true;
    }
    const p = this.passive.path;
    if (!p) return false;
    const E = p[p.length - 1];
    return Math.hypot(E[0] - me.x, E[1] - me.z) > 5;
  }
  layTrail(P, me, wp) {
    // where the hero is along the route: the nearest point on the legs round the current waypoint
    let s0 = 0, best = 1e18, bestI = 1, bestT = 0;
    const lens = [0];
    for (let i = 1; i < P.length; i++) lens.push(lens[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    for (let i = Math.max(1, wp - 2); i < Math.min(P.length, wp + 3); i++) {
      const [ax, az] = P[i - 1], [bx, bz] = P[i], ux = bx - ax, uz = bz - az, L2 = ux * ux + uz * uz || 1;
      const t = Math.max(0, Math.min(1, ((me.x - ax) * ux + (me.z - az) * uz) / L2)), px = ax + ux * t, pz = az + uz * t, d = (px - me.x) ** 2 + (pz - me.z) ** 2;
      if (d < best) { best = d; bestI = i; bestT = t; }
    }
    s0 = lens[bestI - 1] + (lens[bestI] - lens[bestI - 1]) * bestT;
    const total = lens[lens.length - 1], end = Math.min(total, s0 + AHEAD);
    this.mat.uniforms.uS0.value = s0; this.mat.uniforms.uEnd.value = Math.max(6, end - s0);
    // prints from a metre ahead, stepping SPACING apart, left and right of the line in turn
    const m = new THREE.Matrix4(), fwd = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3(), pos = new THREE.Vector3();
    let n = 0, seg = bestI;
    const first = Math.ceil((s0 + 0.8) / SPACING) * SPACING;
    for (let s = first; s <= end && n < MAX_MARKS; s += SPACING) {
      while (seg < P.length - 1 && lens[seg] < s) seg++;
      const [ax, az] = P[seg - 1], [bx, bz] = P[seg], L = lens[seg] - lens[seg - 1] || 1, t = (s - lens[seg - 1]) / L;
      const k = Math.round(s / SPACING), side = k % 2 ? 0.15 : -0.15;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      const x = ax + (bx - ax) * t - dz * side, z = az + (bz - az) * t + dx * side;
      const nrm = this.normal(x, z);
      up.copy(nrm); fwd.set(dx, 0, dz); fwd.addScaledVector(up, -fwd.dot(up)).normalize();
      right.crossVectors(up, fwd).normalize();
      // (each print turned a touch, the way feet land)
      const tw = (k % 2 ? 0.12 : -0.12);
      const c = Math.cos(tw), sn = Math.sin(tw);
      const f2 = fwd.clone().multiplyScalar(c).addScaledVector(right, sn), r2 = right.clone().multiplyScalar(c).addScaledVector(fwd, -sn);
      pos.set(x, this.heightAt(x, z) + 0.035, z);
      m.makeBasis(r2, up, f2).setPosition(pos);
      this.mesh.setMatrixAt(n, m);
      this.aS.array[n] = s;
      this.aT.array[n] = groundTone(x, z);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true; this.aS.needsUpdate = true; this.aT.needsUpdate = true;
  }
  normal(x, z) {
    if (x >= DUNGEON_MIN_X || houseAt(x, z, true)) return new THREE.Vector3(0, 1, 0);
    // (from the walked surface, so a print on a bridge or a pier lies flat on the deck, not tilted like the bank below)
    const h = this.heightAt, e = 0.5;
    return new THREE.Vector3(h(x - e, z) - h(x + e, z), 2 * e, h(x, z - e) - h(x, z + e)).normalize();
  }
}

function segDist(px, pz, ax, az, bx, bz) {
  const ux = bx - ax, uz = bz - az, L2 = ux * ux + uz * uz || 1, t = Math.max(0, Math.min(1, ((px - ax) * ux + (pz - az) * uz) / L2));
  return Math.hypot(px - ax - ux * t, pz - az - uz * t);
}
