// Quest objects in the world (shared OBJECTS): supply caches, blasting kegs, bundles of notes, slag valves and signal
// braziers. Each has an untouched and a done look; the done look shows once *you* have used it (or finished its quest).
// A soft sparkle marks the ones your active quests still need.
import * as THREE from 'three';
import { Builder, box, rbox, cyl, cone, sphere, torus, lathe, lumpy } from '../assets/kit.js';
import { fire, glowSprite, smoke } from '../assets/dynamic.js';
import { OBJECTS, QUESTS } from '/sunmere-play/shared/data.js';
import { buildHaulTrain } from '../assets/haulWagon.js';

const PI = Math.PI;

function build(kind, seed) {
  if (kind === 'ridgefire') kind = 'beacon'; // the ridge fires are the same stone braziers
  if (kind === 'rowbrake' || kind === 'rowice' || kind === 'farbrake') kind = 'engbrake'; // the Engine Rows' other brakes (Chapters 38-39)
  const a = new Builder(seed), d = new Builder(seed + 1); // a: untouched, d: done
  const dyn = { a: [], d: [] };
  if (kind === 'cache') {
    for (const [x, y, z, s] of [[-0.45, 0.3, 0, 0.6], [0.35, 0.3, 0.1, 0.6], [0, 0.85, 0.05, 0.5]]) a.add(rbox(s, s, s, 0.03), 'woodLight', { p: [x, y, z], r: [0, x, 0], uv: 'box', c: '#d8b888' });
    a.add(box(1.6, 0.04, 1.2), 'cloth', { p: [0, 1.12, 0], r: [0.12, 0.2, 0.05], c: '#4f6a34' });
    for (let i = 0; i < 3; i++) a.add(lathe([[0.001, 0], [0.18, 0.02], [0.22, 0.18], [0.12, 0.4], [0.001, 0.42]], 8), 'cloth', { p: [0.9, 0, -0.3 + i * 0.32], r: [PI / 2 - 0.2, i, 0], c: '#e8dcc0' });
    for (let i = 0; i < 8; i++) d.add(box(0.5, 0.04, 0.12), 'woodLight', { p: [Math.cos(i * 2.4) * 0.7, 0.03, Math.sin(i * 2.4) * 0.6], r: [0, i, 0], c: '#c8a878' });
    d.add(box(1.4, 0.03, 1.0), 'cloth', { p: [0.2, 0.02, 0.1], r: [0, 0.6, 0], c: '#3e5428' });
    for (let i = 0; i < 4; i++) d.add(sphere(0.25, 8, 6), 'cloth', { p: [Math.cos(i) * 0.4, 0.05, Math.sin(i * 1.7) * 0.4], s: [1, 0.2, 1], c: '#f4ecd8' });
  } else if (kind === 'keg') {
    for (const k of [a, d]) k.add(lathe([[0.001, 0], [0.32, 0], [0.38, 0.3], [0.37, 0.62], [0.32, 0.86], [0.001, 0.86]], 16), 'wood', { uv: 'box', us: 1.4, c: '#a06a3a' });
    for (const k of [a, d]) for (const y of [0.12, 0.74]) k.add(torus(0.35, 0.02, 6, 18), 'iron', { p: [0, y, 0], r: [PI / 2, 0, 0], c: 0xffffff });
    a.add(cyl(0.012, 0.012, 1.2, 5), 'leather', { p: [0.55, 0.5, 0.1], r: [0, 0, 1.2], c: '#3a2a1a' });
    const spark = glowSprite(0xff8030, 0.5, 0.9); spark.position.set(1.08, 0.75, 0.1); dyn.a.push(spark);
    d.add(cyl(0.012, 0.012, 0.25, 5), 'leather', { p: [0.28, 0.9, 0.05], r: [0, 0, 0.6], c: '#3a2a1a' });
  } else if (kind === 'notes') {
    for (const k of [a, d]) { k.add(rbox(0.9, 0.5, 0.6, 0.03), 'woodDark', { p: [0, 0.25, 0], uv: 'box', c: '#8a6a4a' }); k.add(rbox(0.5, 0.35, 0.2, 0.05), 'leather', { p: [0.65, 0.17, 0.2], r: [0, 0.4, 0], c: '#6a4a2a' }); }
    for (let i = 0; i < 5; i++) a.add(box(0.32, 0.01, 0.42), 'plaster', { p: [-0.15 + i * 0.07, 0.51 + i * 0.012, -0.02 + (i % 2) * 0.05], r: [0, i * 0.25, 0], c: '#f6eedc' });
    a.add(box(0.06, 0.08, 0.3), 'leather', { p: [0.2, 0.55, 0], c: '#5a3a1a' });
  } else if (kind === 'valve') {
    for (const k of [a, d]) {
      k.add(cyl(0.28, 0.28, 2.4, 14), 'dBrass', { p: [0, 1.2, -0.4], c: 0xffffff });
      k.add(cyl(0.34, 0.34, 0.5, 14), 'dIron', { p: [0, 1.2, -0.4], c: 0xffffff });
      k.add(cyl(0.06, 0.06, 0.5, 8), 'dIron', { p: [0, 1.2, -0.1], r: [PI / 2, 0, 0], c: 0xffffff });
    }
    const wheel = (k, rot) => { k.add(torus(0.42, 0.045, 8, 24), 'dIron', { p: [0, 1.2, 0.18], c: '#8a3a2a' }); for (let i = 0; i < 5; i++) { const t = rot + (i / 5) * PI * 2; k.add(box(0.04, 0.4, 0.04), 'dIron', { p: [Math.sin(t) * 0.2, 1.2 + Math.cos(t) * 0.2, 0.18], r: [0, 0, -t], c: '#8a3a2a' }); } };
    wheel(a, 0); wheel(d, 0.9);
    const st = smoke({ rate: 5, life: 1.5, size: 0.6, rise: 1.6, color: 0xe8e4e0, opacity: 0.4, spread: 0.3 }); st.position.set(0.3, 1.6, -0.1); dyn.a.push(st);
  } else if (kind === 'warbanner') {
    // a tall pole with a plain red cloth and a fringe; torn down, the pole lies snapped and the cloth is in the mud
    a.add(cyl(0.07, 0.09, 4.2, 8), 'woodDark', { p: [0, 2.1, 0], c: '#5a3a1e' });
    a.add(box(0.9, 0.06, 0.06), 'woodDark', { p: [0.42, 3.95, 0], c: '#5a3a1e' });
    a.add(box(0.82, 1.5, 0.03), 'cloth', { p: [0.46, 3.15, 0], c: '#8a2a20' });
    a.add(box(0.82, 0.16, 0.035), 'cloth', { p: [0.46, 2.36, 0], c: '#5a3a2a' });
    for (const k of [a, d]) k.add(cyl(0.22, 0.28, 0.3, 8), 'stoneDark', { p: [0, 0.15, 0], c: '#8a8478' });
    d.add(cyl(0.07, 0.09, 2.2, 8), 'woodDark', { p: [0.9, 0.12, 0.2], r: [0, 0, Math.PI / 2 - 0.08], c: '#5a3a1e' });
    d.add(box(0.82, 0.02, 1.4), 'cloth', { p: [-0.5, 0.03, 0.6], r: [0, 0.4, 0], c: '#6a2018' });
  } else if (kind === 'lockbox') {
    // an iron-bound box tucked under the roots, its lid shut; opened, the lid stands back and the papers are gone
    for (const k of [a, d]) {
      k.add(rbox(0.7, 0.36, 0.46, 0.03), 'woodLight', { p: [0, 0.18, 0], uv: 'box', c: '#b8885a' });
      for (const x of [-0.22, 0.22]) k.add(box(0.05, 0.38, 0.48), 'brass', { p: [x, 0.19, 0], c: 0xffffff });
    }
    a.add(rbox(0.72, 0.1, 0.48, 0.03), 'woodLight', { p: [0, 0.41, 0], uv: 'box', c: '#a87848' });
    a.add(box(0.08, 0.1, 0.03), 'brass', { p: [0, 0.3, 0.245], c: 0xffffff });
    d.add(rbox(0.72, 0.1, 0.48, 0.03), 'woodLight', { p: [0, 0.6, -0.3], r: [-1.2, 0, 0], uv: 'box', c: '#a87848' });
  } else if (kind === 'drawing') {
    // a rolled Makers' drawing in an open bronze tube, laid on a small dressed-stone plinth
    for (const k of [a, d]) k.add(rbox(0.8, 0.5, 0.55, 0.04), 'rock', { p: [0, 0.25, 0], uv: 'box', c: '#b4ab98' });
    a.add(cyl(0.07, 0.07, 0.6, 14), 'brass', { p: [0, 0.58, 0], r: [0, 0, PI / 2], c: '#c89660' });
    a.add(cyl(0.062, 0.062, 0.12, 14), 'plaster', { p: [0.34, 0.58, 0], r: [0, 0, PI / 2], c: '#f0e6cc' });
  } else if (kind === 'page') {
    // a weathered leather folio left on a flat stone, a few loose pages weighted under a pebble
    for (const k of [a, d]) k.add(rbox(0.9, 0.22, 0.7, 0.08), 'rock', { p: [0, 0.11, 0], uv: 'box', c: '#b0a898' });
    a.add(rbox(0.46, 0.05, 0.34, 0.02), 'leather', { p: [0, 0.25, 0], r: [0, 0.2, 0], c: '#5a3a1e' });
    for (let i = 0; i < 3; i++) a.add(box(0.3, 0.008, 0.4), 'plaster', { p: [-0.05 + i * 0.05, 0.285 + i * 0.006, 0.02], r: [0, 0.2 + i * 0.18, 0], c: '#f0e6cc' });
    a.add(sphere(0.06, 8, 6), 'rock', { p: [0.08, 0.31, 0.06], s: [1, 0.6, 1], c: '#8a8478' });
  } else if (kind === 'rod') {
    // untouched: a copper rod and a coil of cable left on a scorched patch; done: the rod driven in, cable run to the ground
    for (const k of [a, d]) k.add(cyl(0.9, 0.9, 0.02, 16), 'wDark', { p: [0, 0.01, 0], c: '#2a2a2a' });
    a.add(cyl(0.035, 0.035, 1.6, 8), 'wCopper', { p: [0.1, 0.06, 0], r: [0, 0, PI / 2 - 0.05] });
    a.add(torus(0.22, 0.03, 6, 16), 'wDark', { p: [-0.4, 0.04, 0.35], r: [PI / 2, 0, 0], c: '#3a3a3a' });
    a.add(torus(0.17, 0.03, 6, 16), 'wDark', { p: [-0.4, 0.08, 0.35], r: [PI / 2, 0, 0], c: '#3a3a3a' });
    a.add(rbox(0.3, 0.2, 0.2, 0.02), 'wood', { p: [0.5, 0.1, -0.4], c: '#7a5a3a' });
    const spark = glowSprite(0x9ad8ff, 0.7, 0.8); spark.position.set(0.7, 0.2, 0); dyn.a.push(spark);
    d.add(cyl(0.04, 0.04, 1.5, 8), 'wCopper', { p: [0, 0.75, 0] });
    d.add(cyl(0.09, 0.09, 0.08, 10), 'wBrass', { p: [0, 1.5, 0] });
    d.add(torus(0.12, 0.025, 6, 14), 'wDark', { p: [0, 0.3, 0], r: [PI / 2, 0, 0], c: '#3a3a3a' });
    d.add(cyl(0.02, 0.02, 1.2, 6), 'wDark', { p: [0.55, 0.05, 0.2], r: [0, 0.4, PI / 2], c: '#3a3a3a' });
  } else if (kind === 'engbrake') {
    // a wind engine's brake: a squared stone post with an iron lever on a pin; pinned, the lever lies down frozen to a hook with
    // the pin through it; released, the lever stands up and the pin lies in the snow
    for (const k of [a, d]) {
      k.add(rbox(0.6, 1.1, 0.6, 0.04), 'stoneDark', { p: [0, 0.55, 0], uv: 'box', c: '#a8a49c' });
      k.add(box(0.7, 0.12, 0.7), 'iron', { p: [0, 1.12, 0], c: '#5a5e64' });
      k.add(cyl(0.07, 0.07, 0.8, 10), 'iron', { p: [0, 1.0, 0.32], r: [0, 0, PI / 2], c: '#4a4e54' });
      k.add(box(0.12, 0.22, 0.12), 'iron', { p: [0, 0.62, 1.32], c: '#4a4e54' });
      k.add(rbox(0.9, 0.12, 0.6, 0.05), 'rock', { p: [0, 0.06, 1.2], c: '#9c988e' });
    }
    a.add(box(0.1, 0.1, 1.3), 'iron', { p: [0, 0.88, 0.95], r: [-0.22, 0, 0], c: '#6a3a2a' });
    a.add(cyl(0.035, 0.035, 0.36, 8), 'brass', { p: [0, 0.74, 1.32], r: [0, 0, PI / 2], c: '#c89660' });
    a.add(rbox(0.32, 0.12, 0.3, 0.05), 'ice', { p: [0, 0.75, 1.32], c: '#e0f0f8' });
    d.add(box(0.1, 1.3, 0.1), 'iron', { p: [0, 1.6, 0.35], r: [0.2, 0, 0], c: '#6a3a2a' });
    d.add(cyl(0.035, 0.035, 0.36, 8), 'brass', { p: [0.4, 0.03, 1.5], r: [0, 0.7, PI / 2], c: '#c89660' });
  } else if (kind === 'restrod') {
    // the twelfth rod's guide box (Chapter 40): a square iron box half sunk in the snow, the square rod running through it
    // along x (one bar through one block, nothing across it); packed with ice and its lid frozen shut, then cleared with the
    // lid hinged back and the rod bright where it runs free
    for (const k of [a, d]) {
      k.add(rbox(1.0, 0.6, 0.9, 0.04), 'iron', { p: [0, 0.18, 0], c: '#4a4e54' });
      k.add(box(1.08, 0.08, 0.98), 'iron', { p: [0, 0.02, 0], c: '#3a3e44' });
      for (const [x, z, sx, sz] of [[-1.0, 0.25, 2.2, 1.5], [0.95, -0.3, 1.8, 1.7], [0.2, 0.75, 2.6, 0.9]]) k.add(sphere(0.32, 8, 6), 'snowPack', { p: [x, -0.04, z], s: [sx, 0.32, sz], c: 0xffffff }); // drifted snow, heaped unevenly (never a ring of lumps)
      k.add(box(0.34, 0.06, 0.24), 'brass', { p: [-0.2, 0.3, 0.46], c: '#c8a060' }); // the Makers' brass label on its face
    }
    a.add(box(3.0, 0.18, 0.18), 'iron', { p: [0, 0.3, 0], c: '#5a5e64' });
    a.add(box(1.04, 0.08, 0.94), 'iron', { p: [0, 0.52, 0], c: '#55595e' });
    for (const sx of [-1, 1]) a.add(rbox(0.36, 0.4, 0.5, 0.08), 'ice', { p: [sx * 0.62, 0.3, 0], c: '#e0f0f8' }); // ice packed where the rod goes in
    a.add(rbox(0.7, 0.08, 0.5, 0.03), 'snowPack', { p: [0.1, 0.6, -0.1], r: [0, 0.2, 0], c: '#e8eef4' });
    d.add(box(3.0, 0.18, 0.18), 'iron', { p: [0, 0.3, 0], c: '#9aa0a6' });
    d.add(box(1.04, 0.08, 0.94), 'iron', { p: [0, 0.78, -0.62], r: [-1.25, 0, 0], c: '#55595e' });
    for (let i = 0; i < 6; i++) d.add(rbox(0.16, 0.1, 0.14, 0.03), 'ice', { p: [0.9 - i * 0.36, 0.0, 0.7 + (i % 2) * 0.2], r: [0, i, 0], c: '#e0f0f8' });
  } else if (kind === 'restbrake') {
    // the Great Governor's master lever outside the workshop (Chapter 40): a square iron lever stand on a stone footing where
    // the twelfth rod comes in out of the ground, a tall square lever on its pin; held, the lever lies down locked by a pin
    // through a brass keeper; released, it stands up and the pin hangs on its chain
    for (const k of [a, d]) {
      k.add(rbox(1.3, 0.3, 1.0, 0.04), 'stoneDark', { p: [0, 0.15, 0], uv: 'box', c: '#b0aca4' });
      k.add(rbox(0.8, 1.2, 0.7, 0.05), 'iron', { p: [0, 0.9, 0], c: '#4a4e54' });
      k.add(box(0.9, 0.1, 0.8), 'brass', { p: [0, 1.52, 0], c: '#b08a50' });
      k.add(box(0.2, 0.2, 1.6), 'iron', { p: [0, 0.2, -1.2], c: '#5a5e64' }); // the rod coming in out of the ground
      k.add(cyl(0.08, 0.08, 0.95, 10), 'iron', { p: [0, 1.4, 0.36], r: [0, 0, PI / 2], c: '#3a3e44' });
      k.add(box(0.36, 0.26, 0.03), 'brass', { p: [0.15, 0.95, 0.37], c: '#c8a060' }); // its brass label
      k.add(box(0.16, 0.5, 0.16), 'iron', { p: [0, 0.55, 1.45], c: '#4a4e54' }); // the keeper post
    }
    a.add(box(0.14, 0.14, 1.5), 'iron', { p: [0, 1.15, 1.05], r: [0.18, 0, 0], c: '#6a3a2a' });
    a.add(box(0.12, 0.14, 0.12), 'brass', { p: [0, 0.82, 1.56], c: '#c89660' }); // the locking pin's head (a block: a pin across the lever drew a + from above)
    d.add(box(0.14, 1.6, 0.14), 'iron', { p: [0, 2.15, 0.45], r: [0.15, 0, 0], c: '#6a3a2a' });
    d.add(cyl(0.04, 0.04, 0.4, 8), 'brass', { p: [0.16, 0.4, 1.5], r: [0, 0, 0.2], c: '#c89660' });
  } else if (kind === 'twscour') {
    // a scour sluice in the bank by the Sound's quay (Chapter 41): a short dressed-stone face with a square timber frame (two
    // posts and a flat lintel) and a plank hatch sliding in its grooves; silted, the hatch is down and a bank of grey silt lies
    // heaped against it; opened, the hatch hangs raised in the frame on a square peg, the silt dug away and the ground wet below
    for (const k of [a, d]) {
      k.add(rbox(2.6, 0.9, 0.8, 0.04), 'stoneDark', { p: [0, 0.3, -0.35], uv: 'box', c: '#8a8478' });
      for (const sx of [-0.78, 0.78]) k.add(box(0.24, 2.0, 0.28), 'beam', { p: [sx, 0.9, 0.12], c: '#4a3c30' });
      k.add(box(1.9, 0.24, 0.32), 'beam', { p: [0, 1.9, 0.12], c: '#4a3c30' });
      k.add(box(1.6, 0.14, 0.5), 'stoneDark', { p: [0, 0.02, 0.2], c: '#6e665e' }); // the sill
    }
    a.add(box(1.34, 1.05, 0.12), 'woodDark', { p: [0, 0.6, 0.12], c: '#3a3430' });
    a.add(sphere(0.6, 8, 6), 'rock', { p: [0.1, 0.05, 0.85], s: [1.9, 0.6, 1.3], c: '#6a6458' }); // silt heaped against it
    a.add(sphere(0.4, 8, 6), 'rock', { p: [-0.7, 0.0, 1.25], s: [1.4, 0.45, 1.1], c: '#5e5a50' });
    d.add(box(1.34, 1.05, 0.12), 'woodDark', { p: [0, 1.3, 0.12], c: '#3a3430' });
    d.add(box(0.14, 0.14, 0.42), 'wood', { p: [0.55, 0.74, 0.2], c: '#7a5a3a' }); // the peg it hangs on
    d.add(box(1.5, 0.02, 1.8), 'wDark', { p: [0, 0.015, 1.05], c: '#2e2a26' }); // wet ground where the ebb ran out
    d.add(sphere(0.35, 8, 6), 'rock', { p: [1.5, 0.0, 1.2], s: [1.5, 0.4, 1.0], c: '#6a6458' }); // the silt dug aside
  } else if (kind === 'rangeplate') {
    // Harl's watch range (the Powder Ledger): a square iron plate hung by two chains from a flat-topped frame of two posts;
    // knocked down, the plate lies dented in the straw at the foot of the frame
    for (const k of [a, d]) {
      for (const x of [-0.5, 0.5]) k.add(box(0.12, 1.5, 0.12), 'woodDark', { p: [x, 0.75, 0], c: '#6a4a2e' });
      k.add(box(1.24, 0.12, 0.14), 'woodDark', { p: [0, 1.54, 0], c: '#6a4a2e' });
      k.add(box(1.5, 0.04, 0.9), 'cloth', { p: [0, 0.02, 0.2], c: '#d8c48a' });
    }
    for (const x of [-0.18, 0.18]) a.add(box(0.025, 0.3, 0.025), 'iron', { p: [x, 1.33, 0], c: '#4a4e54' });
    a.add(box(0.56, 0.56, 0.04), 'iron', { p: [0, 0.92, 0], c: 0xffffff });
    for (const x of [-0.18, 0.18]) d.add(box(0.025, 0.14, 0.025), 'iron', { p: [x, 1.41, 0], c: '#4a4e54' });
    d.add(box(0.56, 0.04, 0.56), 'iron', { p: [0.08, 0.06, 0.45], r: [0.06, 0.35, 0.04], c: 0xd8d8d8 });
  } else if (kind === 'beacon') {
    for (const k of [a, d]) {
      k.add(rbox(0.9, 1.4, 0.9, 0.05), 'stoneDark', { p: [0, 0.7, 0], uv: 'box', c: '#c8c0b0' });
      k.add(lathe([[0.001, 0], [0.3, 0], [0.62, 0.32], [0.68, 0.44], [0.001, 0.3]], 14), 'iron', { p: [0, 1.4, 0], c: '#6a6460' });
      for (let i = 0; i < 6; i++) k.add(cyl(0.05, 0.05, 0.6, 5), 'wood', { p: [Math.cos(i) * 0.18, 1.62, Math.sin(i) * 0.18], r: [Math.sin(i) * 0.6, 0, Math.cos(i) * 0.6], c: '#7a5a3a' });
    }
    const f = fire(0.9, { light: false }); f.position.set(0, 1.6, 0); dyn.d.push(f);
    const g = glowSprite(0xffa040, 3.2, 0.6); g.position.set(0, 2.1, 0); dyn.d.push(g);
  } else if (kind === 'twflap') {
    // a tide flap on the creek bank below the Tide Mills (Chapter 42): a stone footing and sill, a square timber frame (two
    // posts and a flat lintel) and a heavy plank flap hung from a bronze pin along its top edge. Jammed, the flap stands
    // swung out over a drift log wedged under it and a heap of silt; freed, it hangs shut in its frame on two straight iron
    // straps, the silt dug away and the ground wet below. Everything runs along x or upright: nothing crossed
    for (const k of [a, d]) {
      k.add(rbox(2.4, 0.6, 0.7, 0.04), 'stoneDark', { p: [0, 0.2, -0.3], uv: 'box', c: '#8a8478' });
      for (const sx of [-0.8, 0.8]) k.add(box(0.24, 1.8, 0.28), 'beam', { p: [sx, 0.9, 0.1], c: '#3e342c' });
      k.add(box(1.9, 0.24, 0.32), 'beam', { p: [0, 1.8, 0.1], c: '#3e342c' });
      k.add(box(1.6, 0.14, 0.5), 'stoneDark', { p: [0, 0.02, 0.25], c: '#6e665e' }); // the sill
      k.add(cyl(0.05, 0.05, 1.5, 8), 'brass', { p: [0, 1.62, 0.3], r: [0, 0, PI / 2], c: '#a08a50' }); // the hinge pin
    }
    a.add(box(1.4, 1.4, 0.12), 'woodDark', { p: [0, 1.185, 0.85], r: [-0.9, 0, 0], c: '#3a302a' }); // swung out, jammed
    a.add(cyl(0.16, 0.16, 1.8, 8), 'wood', { p: [0, 0.16, 1.0], r: [0, 0, PI / 2], c: '#6a5440' }); // the drift log under it, along the frame
    a.add(sphere(0.6, 8, 6), 'rock', { p: [0.3, 0.02, 1.3], s: [1.8, 0.5, 1.1], c: '#6a6458' }); // silt
    d.add(box(1.4, 1.4, 0.12), 'woodDark', { p: [0, 0.92, 0.32], c: '#3a302a' }); // hanging shut
    for (const sx of [-0.45, 0.45]) d.add(box(0.08, 1.2, 0.03), 'iron', { p: [sx, 0.98, 0.39], c: '#4a4e54' }); // its straps, upright
    d.add(box(1.5, 0.02, 1.6), 'wDark', { p: [0, 0.015, 1.05], c: '#2e2a26' }); // wet ground
    d.add(sphere(0.35, 8, 6), 'rock', { p: [1.5, 0.0, 1.0], s: [1.5, 0.4, 1.0], c: '#6a6458' }); // the silt dug aside
  } else if (kind === 'twrace') {
    // a race head at the north end of a log pond (Chapter 43): two dressed-stone cheeks on a stone sill with an upright
    // stop-board slot in each (from above a plain block). Open, the slots stand empty; boarded, three tarred stop-boards lie
    // one on another between the cheeks
    for (const k of [a, d]) {
      for (const sx of [-1.1, 1.1]) {
        k.add(rbox(0.7, 1.4, 1.2, 0.04), 'stoneDark', { p: [sx, 0.55, 0], uv: 'box', c: '#8a8478' });
        k.add(box(0.1, 1.3, 0.16), 'wDark', { p: [sx * 0.7, 0.6, 0], c: '#1e1c1a' }); // the slot
      }
      k.add(box(1.6, 0.2, 1.2), 'stoneDark', { p: [0, 0.0, 0], c: '#6e665e' }); // the sill
    }
    a.add(box(1.5, 0.02, 1.1), 'wDark', { p: [0, 0.11, 0], c: '#2a2826' }); // the wet sill, the slots empty
    for (let i = 0; i < 3; i++) d.add(box(1.62, 0.3, 0.12), 'woodDark', { p: [0, 0.27 + i * 0.32, 0], c: i % 2 ? '#3a302a' : '#2e2622' });
  } else if (kind === 'twplant') {
    // a place in the valley's new row (Chapter 44): a square of turned earth with one straight stake. Untouched, three young
    // poles lie heeled in beside it, all one way (never crossed); planted, one young pole stands tied to the stake, a slim
    // tapering crown of needles (round from above, no points), the turned earth pressed down round it
    for (const k of [a, d]) {
      k.add(box(1.3, 0.06, 1.3), 'dirtPlain', { p: [0, 0.03, 0], uv: 'box', c: '#4e4234' });
      k.add(box(0.06, 0.9, 0.06), 'woodDark', { p: [0.3, 0.45, 0], c: '#7a6a52' });
    }
    a.add(box(0.5, 0.2, 0.5), 'dirtPlain', { p: [0, 0.1, -0.3], uv: 'box', c: '#5a4c3c' }); // the hole's spoil
    for (let i = 0; i < 3; i++) a.add(cyl(0.035, 0.05, 2.0, 6), 'woodDark', { p: [-0.9, 0.06, -0.3 + i * 0.16], r: [PI / 2, 0, 0], c: '#6a5440' });
    a.add(box(0.36, 0.14, 0.5), 'bushGreen', { p: [-0.9, 0.08, 0.7], c: '#3a4e2e' }); // their tops, still green
    d.add(cyl(0.04, 0.07, 2.0, 7), 'woodDark', { p: [0, 1.0, 0], c: '#6a5440' }); // (it stops under the upper crown's foot: no line across the pole near its tip)
    d.add(cone(0.5, 1.7, 9), 'bushGreen', { p: [0, 1.75, 0], c: '#5a8a46' });
    d.add(cone(0.34, 1.0, 9), 'bushGreen', { p: [0, 2.55, 0], c: '#6a9a52' });
    d.add(box(0.3, 0.05, 0.07), 'woodDark', { p: [0.15, 0.8, 0], c: '#b8a07a' }); // the tie to the stake
    d.add(box(1.1, 0.08, 1.1), 'dirtPlain', { p: [0, 0.07, 0], uv: 'box', c: '#3e3428' }); // pressed down
  } else if (kind === 'twhaul') {
    // the Makers' log haulier on its stand between the Tide Mills (Chapter 45), its wagon coupled behind: unwound, still and
    // chocked, moss and silt on its tracks; wound, the chocks out and stacked beside it, the haulier ticking over
    dyn.a.push(buildHaulTrain({ wound: false, seed: 1700 }));
    const T = buildHaulTrain({ wound: true, seed: 1710 }); const up = T.userData.update; T.userData.update = (dt) => up(dt, 0, 0); dyn.d.push(T);
    for (let i = 0; i < 4; i++) d.add(box(0.5, 0.26, 0.32), 'woodDark', { p: [1.7, 0.13 + Math.floor(i / 2) * 0.27, -3.2 - (i % 2) * 0.36], c: '#5a4634' }); // the chocks, stacked
  } else if (kind === 'rgspoil') {
    // a heap of a slip's spoil across the haul road (Chapter 45): red-brown mud with wet stones in it; dug off, a low smear of
    // mud pushed to the road's edge and a few stones lying beside it
    for (let i = 0; i < 5; i++) a.add(lumpy(sphere(0.7, 9, 6), 0.3, 1.6, seed + i, { flatBottom: 0 }), 'dirtPlain', { p: [-1.6 + i * 0.8, 0.05, (i % 2 ? 0.3 : -0.25)], s: [1.3, 0.55 + (i % 3) * 0.12, 1.1], uv: 'box', c: i % 2 ? '#6e4232' : '#7a4a36' });
    for (let i = 0; i < 4; i++) a.add(lumpy(sphere(0.22, 7, 5), 0.25, 2, seed + 9 + i), 'stoneDark', { p: [-1.3 + i * 0.9, 0.35, (i % 2 ? -0.5 : 0.55)], c: '#5e5c56' });
    d.add(box(3.6, 0.06, 0.8), 'dirtPlain', { p: [0, 0.03, 1.6], uv: 'box', c: '#6e4232' });
    for (let i = 0; i < 3; i++) d.add(lumpy(sphere(0.2, 7, 5), 0.25, 2, seed + 20 + i), 'stoneDark', { p: [-1 + i * 1.1, 0.1, 2.1], c: '#5e5c56' });
  } else if (kind === 'rgshelf') {
    // a seed bed on the shelf over the river (Chapter 45): a timber-edged bed along the shelf; buried, a long tongue of red mud
    // over it; cleared, dark earth and two straight rows of seedling tufts (single leaf cards, no rosettes)
    for (const k of [a, d]) {
      for (const sz of [-1, 1]) k.add(box(7, 0.24, 0.1), 'woodDark', { p: [0, 0.12, sz * 0.65], c: '#5e4c38' });
      for (const sx of [-1, 1]) k.add(box(0.1, 0.24, 1.3), 'woodDark', { p: [sx * 3.5, 0.12, 0], c: '#5e4c38' });
      k.add(box(6.9, 0.16, 1.2), 'dirtPlain', { p: [0, 0.1, 0], uv: 'box', c: '#3e3024' });
    }
    for (let i = 0; i < 4; i++) a.add(lumpy(sphere(0.8, 9, 6), 0.3, 1.6, seed + i, { flatBottom: 0 }), 'dirtPlain', { p: [-2.4 + i * 1.6, 0.12, 0.05], s: [1.4, 0.45, 1.0], uv: 'box', c: i % 2 ? '#6e4232' : '#7a4a36' });
    for (const sz of [-0.3, 0.3]) for (let x = -3.1; x < 3.2; x += 0.5) d.add(box(0.03, 0.26, 0.2), 'cloth', { p: [x, 0.3, sz], r: [0, 0.2, 0], c: '#6a9a52' });
  }
  const ga = a.build(), gd = d.build();
  for (const o of dyn.a) ga.add(o);
  for (const o of dyn.d) gd.add(o);
  ga.userData.dyn = dyn.a; gd.userData.dyn = dyn.d;
  return { ga, gd };
}

// a Makers' brass label node (Chapter 40, item c40_tag): a small labelled crate on the hollow floor, a square brass plate
// wired to its face, a soft glow so it can be found
export function brassTagNode() {
  const b = new Builder(80);
  b.add(rbox(0.8, 0.6, 0.7, 0.03), 'woodLight', { p: [0, 0.3, 0], r: [0, 0.3, 0], uv: 'box', c: '#c8a07a' });
  for (const y of [0.15, 0.45]) b.add(box(0.84, 0.08, 0.74), 'woodLight', { p: [0, y, 0], r: [0, 0.3, 0], c: '#a07a58' });
  b.add(box(0.34, 0.26, 0.03), 'brass', { p: [Math.sin(0.3) * 0.37, 0.32, Math.cos(0.3) * 0.37], r: [0, 0.3, 0], c: '#e0b868' });
  b.add(box(0.02, 0.14, 0.02), 'iron', { p: [Math.sin(0.3) * 0.37, 0.5, Math.cos(0.3) * 0.37], c: '#4a4e54' }); // its wire
  b.add(sphere(0.25, 8, 6), 'snowPack', { p: [-0.4, 0.0, -0.2], s: [1.6, 0.35, 1.3], c: 0xffffff });
  const g = b.build();
  const gl = glowSprite(0xfff0c8, 1.6, 0.5); gl.position.y = 0.8; g.add(gl);
  g.userData.update = (dt, t) => gl.userData.update(dt, t);
  return g;
}

// a tar barrel node (Chapter 41, item c41_tar): a barrel lying on its side on the shingle where a spring tide left it (lying,
// so from above it reads as a bar with straight hoop bands, never a disc in a ring), a smear of tar, a soft glint to spot it by
export function tarBarrelNode() {
  const b = new Builder(81);
  // (dressing pass) a straight cask with flush hoop bands set in from the ends: seen end on, its plain end is its whole
  // outline (the bulged staves and proud hoops drew a disc inside a ring)
  b.add(cyl(0.33, 0.33, 0.82, 14), 'wood', { p: [0, 0.3, 0], r: [0, 0, -PI / 2], uv: 'box', us: 1.4, c: '#5a3e26' });
  for (const x of [-0.22, 0.22]) b.add(cyl(0.334, 0.334, 0.07, 14), 'iron', { p: [x, 0.3, 0], r: [0, 0, PI / 2], c: '#4a4e54' });
  b.add(box(0.7, 0.02, 0.4), 'wDark', { p: [0.15, 0.01, 0.45], r: [0, 0.3, 0], c: '#141210' });
  const g = b.build();
  const gl = glowSprite(0xfff0c8, 1.5, 0.45); gl.position.y = 0.9; g.add(gl);
  g.userData.update = (dt, t) => gl.userData.update(dt, t);
  return g;
}
// a stop-board node (Chapter 43, item c43_board): two heavy tarred planks lying one on the other on the pond bank, side by
// side and the same way (never crossed), a soft glint to spot them by
export function stopBoardNode() {
  const b = new Builder(83);
  b.add(box(1.6, 0.12, 0.34), 'woodDark', { p: [0, 0.06, 0], r: [0, 0.4, 0], c: '#6a5440' });
  b.add(box(1.5, 0.12, 0.34), 'woodDark', { p: [0.06, 0.18, 0.04], r: [0, 0.44, 0], c: '#5a4634' });
  b.add(box(0.6, 0.02, 0.4), 'wDark', { p: [-0.3, 0.01, 0.4], r: [0, 0.4, 0], c: '#141210' });
  const g = b.build();
  const gl = glowSprite(0xfff0c8, 1.5, 0.45); gl.position.y = 0.8; g.add(gl);
  g.userData.update = (dt, t) => gl.userData.update(dt, t);
  return g;
}
// a yarn hank node (Chapter 41, item c41_yarn): a straight hank of bast yarn lying flat in the salt grass, its strands side by
// side and a tie near each end (never coiled: a coil reads as a ring from above), a soft glint to spot it by
export function yarnHankNode() {
  const b = new Builder(82);
  const ry = 0.5, c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i < 6; i++) { const o = ((i % 3) - 1) * 0.1, y = 0.06 + Math.floor(i / 3) * 0.09; b.add(cyl(0.05, 0.05, 1.3, 6), 'cloth', { p: [-s * o, y, -c * o], r: [0, ry, PI / 2], order: 'YXZ', c: i % 2 ? '#8a7656' : '#7a684c' }); }
  for (const t of [-0.5, 0.5]) b.add(box(0.06, 0.26, 0.38), 'cloth', { p: [c * t, 0.1, -s * t], r: [0, ry, 0], c: '#4a3e30' });
  const g = b.build();
  const gl = glowSprite(0xfff0c8, 1.5, 0.45); gl.position.y = 0.8; g.add(gl);
  g.userData.update = (dt, t) => gl.userData.update(dt, t);
  return g;
}

// a seed tray node (Chapter 45, item c45_tray): a shallow square timber tray of seedlings lying where a slip left it, two
// straight rows of single leaf cards in dark earth, a smear of red mud, a soft glint to spot it by
export function seedTrayNode() {
  const b = new Builder(84);
  for (const sz of [-1, 1]) b.add(box(0.9, 0.14, 0.05), 'woodLight', { p: [-Math.sin(0.3) * sz * 0.3, 0.07, Math.cos(0.3) * sz * 0.3], r: [0, 0.3, 0], c: '#8a6e52' });
  for (const sx of [-1, 1]) b.add(box(0.05, 0.14, 0.62), 'woodLight', { p: [Math.cos(0.3) * sx * 0.45, 0.07, -Math.sin(0.3) * sx * 0.45], r: [0, 0.3, 0], c: '#8a6e52' }); // square, end boards too
  b.add(box(0.86, 0.08, 0.58), 'dirtPlain', { p: [0, 0.06, 0], r: [0, 0.3, 0], uv: 'box', c: '#3e3024' });
  for (const o of [-0.13, 0.13]) for (let x = -0.35; x <= 0.36; x += 0.14) b.add(box(0.02, 0.16, 0.1), 'cloth', { p: [Math.cos(0.3) * x + Math.sin(0.3) * o, 0.16, -Math.sin(0.3) * x + Math.cos(0.3) * o], r: [0, 0.3, 0], c: '#8ac460' });
  b.add(box(0.7, 0.02, 0.5), 'dirtPlain', { p: [-0.3, 0.01, 0.4], r: [0, 0.3, 0], uv: 'box', c: '#6e4232' });
  const g = b.build();
  const gl = glowSprite(0xfff0c8, 1.5, 0.45); gl.position.y = 0.8; g.add(gl);
  g.userData.update = (dt, t) => gl.userData.update(dt, t);
  return g;
}

export class QuestObjects {
  constructor(scene, heightAt) {
    this.list = OBJECTS.map((o, i) => {
      const root = new THREE.Group();
      root.position.set(o.x, heightAt(o.x, o.z), o.z);
      root.rotation.y = o.ry || 0;
      const { ga, gd } = build(o.kind, 600 + i * 3);
      root.add(ga, gd);
      gd.visible = false;
      const spark = glowSprite(0xfff0a0, 1.2, 0.8);
      spark.position.y = 1.6; spark.visible = false;
      root.add(spark);
      scene.add(root);
      return { ...o, root, ga, gd, spark, done: false, need: false };
    });
  }

  // which objects this player has used, and which their active quests still need
  refresh(you) {
    const used = new Set(), needKinds = new Set(), doneKinds = new Set();
    for (const [qid, q] of Object.entries(you.quests || {})) {
      const Q = QUESTS[qid];
      if (!Q?.goal.use) continue;
      for (const id of q.used || []) used.add(id);
      if (q.n < Q.goal.n) needKinds.add(Q.goal.use);
    }
    for (const qid of Object.keys(you.done || {})) { const Q = QUESTS[qid]; if (Q?.goal.use) doneKinds.add(Q.goal.use); }
    const pages = new Set(you.ledger || []), achC = this.achC || {};
    for (const o of this.list) {
      o.done = o.kind === 'page' ? pages.has(o.id) : o.kind === 'drawing' ? !!achC['drw:' + o.id] : used.has(o.id) || doneKinds.has(o.kind);
      o.need = !o.done && (o.kind === 'page' || o.kind === 'drawing' || needKinds.has(o.kind));
      o.ga.visible = !o.done; o.gd.visible = o.done;
      o.spark.visible = o.need;
    }
  }

  usable() { return this.list.filter((o) => o.need); }

  used(id, mine, fx, sfx) {
    const o = this.list.find((x) => x.id === id);
    if (!o) return;
    const p = o.root.position.clone().setY(o.root.position.y + 0.8);
    if (o.kind === 'cache') { fx.emit('shards', p, { n: 18, color: '#c8a878' }); fx.emit('dust', p, { n: 8 }); sfx?.play('thud'); }
    else if (o.kind === 'keg') { fx.emit('smoke', p, { n: 6, size: 0.6 }); sfx?.play('ui'); }
    else if (o.kind === 'notes' || o.kind === 'page') { fx.emit('motes', p, { n: 14, color: '#fff4d0' }); sfx?.play('ui'); }
    else if (o.kind === 'valve') { fx.emit('smoke', p.setY(p.y + 0.6), { n: 10, color: '#e8e4e0', size: 0.8 }); sfx?.play('clang'); }
    else if (o.kind === 'warbanner') { fx.emit('dust', p, { n: 10 }); sfx?.play('thud'); }
    else if (o.kind === 'restrod') { fx.emit('shards', p.setY(p.y - 0.3), { n: 16, color: '#e0f0f8' }); fx.emit('dust', p, { n: 6 }); sfx?.play('clang'); }
    else if (o.kind === 'restbrake') { fx.emit('sparks', p.setY(p.y + 0.6), { n: 10, color: '#ffd090' }); fx.emit('smoke', p, { n: 4, size: 0.6, color: '#e8e4e0' }); sfx?.play('clang'); }
    else if (o.kind === 'engbrake' || o.kind === 'rowbrake' || o.kind === 'rowice' || o.kind === 'farbrake') { fx.emit('shards', p.setY(p.y + 0.3), { n: 14, color: '#e0f0f8' }); sfx?.play('clang'); }
    else if (o.kind === 'twplant') { fx.emit('dust', p.setY(p.y - 0.4), { n: 10, color: '#5a4c3c' }); sfx?.play('thud'); }
    else if (o.kind === 'twflap' || o.kind === 'twrace') { fx.emit('dust', p.setY(p.y - 0.3), { n: 10, color: '#8a8478' }); sfx?.play('thud'); }
    else if (o.kind === 'twhaul') { fx.emit('smoke', p.setY(p.y + 1.6), { n: 8, color: '#8a8884', size: 0.6 }); fx.emit('dust', p.setY(p.y - 2.0), { n: 10, color: '#5a5148' }); sfx?.play('chain'); }
    else if (o.kind === 'rgspoil' || o.kind === 'rgshelf') { fx.emit('dust', p.setY(p.y - 0.4), { n: 12, color: '#6e4232' }); sfx?.play('thud'); }
    else if (o.kind === 'twscour') { fx.emit('dust', p.setY(p.y - 0.4), { n: 12, color: '#8a8478' }); fx.emit('shards', p, { n: 8, color: '#6a6458' }); sfx?.play('thud'); }
    else if (o.kind === 'rangeplate') { fx.emit('sparks', p.setY(p.y + 0.15), { n: 8, color: '#ffd090' }); fx.emit('smoke', p, { n: 3, size: 0.5, color: '#c8c4bc' }); sfx?.play('shot'); sfx?.play('clang'); }
    else if (o.kind === 'beacon' || o.kind === 'ridgefire') { fx.emit('flame', p.setY(p.y + 1.0), { n: 14 }); fx.emit('embers', p, { n: 20 }); sfx?.play('ui'); }
    if (mine) { o.done = true; o.need = false; o.ga.visible = false; o.gd.visible = true; o.spark.visible = false; }
  }

  update(dt, t, focus) {
    for (const o of this.list) {
      if ((o.x - focus.x) ** 2 + (o.z - focus.z) ** 2 > 80 * 80) continue;
      const g = o.done ? o.gd : o.ga;
      for (const d of g.userData.dyn) d.userData.update?.(dt, t);
      if (o.spark.visible) { o.spark.userData.update(dt, t); o.spark.position.y = 1.6 + Math.sin(t * 2.5) * 0.12; }
    }
  }
}
