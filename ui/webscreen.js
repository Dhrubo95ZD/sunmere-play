// The Skill Web screen (combat_design.md 4.1, 4.5, 6.2; stage S6). A full-screen canvas over the game: the Web as a
// surveyor's map on parchment, seen from straight above, every node a rounded square (keystones wide plates, Forms split in
// two, the class starts plain plates with the class picture). Region names are UI text, never text in art.
//   desktop: drag to pan, the wheel zooms round the pointer, hover shows a card (what the node does, the fusions it
//            changes, the road to it and its point cost) and lights that road; a click stages the road; right-click hands
//            a held leaf back
//   phones:  drag and pinch; a tap or a long press opens the bottom sheet with Take the road / Hand back (44 px targets)
//   both:    a search box lights the matching places; Apply sends every staged road at once (all or nothing on the server),
//            Undo takes the last staged road back; "Suggested path" stages one of three builds (shared/treeBuilds.js) as
//            far as the points reach; two saved Webs (the loadouts); Clear the Web
// Drawing is on demand (a dirty flag in a rAF loop), so an idle screen costs nothing; a pan or pinch redraws each frame.
import { CLASSES } from '/sunmere-play/shared/classes.js';
import { TREE_NODES, TREE_LINKS, TREE_BY_ID, TREE_MAP, TREE_START, TREE_REGIONS } from '/sunmere-play/shared/tree.js';
import { pathTo, isLeaf, formOpt, formAllowed, leafRefundCost, treeResetCost, treeMods, webEff } from '/sunmere-play/shared/treeMods.js';
import { KEYSTONES, effName } from '/sunmere-play/shared/keystones.js';
import { FUSIONS, FUSION_BY_ID, skillOf } from '/sunmere-play/shared/fusions.js';
import { describeEffect } from '/sunmere-play/shared/talents.js';
import { TREE_BUILDS, buildSteps } from '/sunmere-play/shared/treeBuilds.js';
import { skillIcon } from './icons.js';
import { haptic } from './combathud.js';
import { IS_TOUCH } from '../engine/platform.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// node sizes in map units (rounded squares only; keystones wide)
const SZ = { small: [22, 22], notable: [34, 34], form: [38, 34], fusion: [34, 34], triad: [40, 40], keystone: [62, 42], start: [52, 52] };
const KIND = { small: 'Road', notable: 'Notable', form: 'Form', fusion: 'Fusion notable', triad: 'Triad notable', keystone: 'Keystone', start: 'Class start' };
const INK = { parch: '#eadcb8', parch2: '#d9c79c', road: '#8f8676', held: '#c8962e', heldHi: '#ffe08a', reach: '#9a7a46', staged: '#4fb3a6', lock: '#a39a88', text: '#4a3820' };
const money = (c) => { const g = Math.floor(c / 10000), s = Math.floor((c % 10000) / 100), cp = c % 100; return ((g ? `${g}g ` : '') + (s ? `${s}s ` : '') + (cp || (!g && !s) ? `${cp}c` : '')).trim(); };
const effText = (e) => (e[0] === 'link' ? `link windows +${e[1]} s` : e[0] === 'brk' ? `${Math.round(e[1] * 100)}% more poise damage` : e[0] === 'fuse' ? `fusions ${Math.round(e[1] * 100)}% stronger` : e[0] === 'range' ? `${Math.round(e[1] * 100)}% more range` : e[0] === 'fu' ? `unlocks ${FUSION_BY_ID[e[1]]?.name || e[1]}` : e[0] === 'key' || e[0] === 'hook' || e[0] === 'flag' ? '' : (() => { try { return describeEffect(e); } catch { return ''; } })());

// the region plates: a padded box round each region's nodes (the painted region art and its inked border sit on it)
const REGION_BOX = (() => {
  const out = {};
  for (const n of TREE_NODES) { if (n.region === 'bridge') continue; const b = (out[n.region] ||= { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }); b.x0 = Math.min(b.x0, n.x); b.y0 = Math.min(b.y0, n.y); b.x1 = Math.max(b.x1, n.x); b.y1 = Math.max(b.y1, n.y); }
  return out;
})();
// where each region's name sits: class names on the top of their inked border; the Common Ground's in the open field of
// its band farthest from any node and clear of the class regions
const LABEL_AT = (() => {
  const out = {};
  for (const [r, b] of Object.entries(REGION_BOX)) {
    if (r !== 'common') { out[r] = [(b.x0 + b.x1) / 2, b.y0 - 95]; continue; }
    let best = [(b.x0 + b.x1) / 2, b.y0], bs = -1;
    for (let fy = 0.1; fy <= 0.9; fy += 0.1) for (let fx = 0.2; fx <= 0.8; fx += 0.05) {
      const x = b.x0 + (b.x1 - b.x0) * fx, y = b.y0 + (b.y1 - b.y0) * fy;
      if (Object.entries(REGION_BOX).some(([k, o]) => k !== 'common' && x > o.x0 - 420 && x < o.x1 + 420 && y > o.y0 - 200 && y < o.y1 + 200)) continue;
      let m = Infinity; for (const n of TREE_NODES) m = Math.min(m, Math.abs(n.x - x) / 4 + Math.abs(n.y - y)); // (a wide name: vertical room counts most)
      if (m > bs) { bs = m; best = [x, y]; }
    }
    out[r] = best;
  }
  return out;
})();
const REGION_TINT = { knight: '#4a6aa8', warden: '#7a6a4a', sandblade: '#b08a40', ranger: '#4a8a5a', deadeye: '#8a5a3a', chemist: '#4a8a8a', herbalist: '#6a9a4a', common: '#8a7a5a' };

// ---------------------------------------------------------------------------------------------- CR.9 art
// The map is painted once into an offscreen sheet (client/ui/web/: the parchment base and one Codex-painted region per
// class and the Common Ground, feathered in, with an inked border round each class region and an inked frame), so a
// frame is one drawImage for the map, a few batched road strokes and one drawImage per node (each node's framed icon is
// a cached sprite per kind, state and icon). Sources and prompts: art_src/web/. No text in any image: names are UI text.
const ART = '/sunmere-play/ui/web/';
const ICON_SHEET = 4; // icons.webp: a 4 x 4 sheet of painted node icons (art_src/web/icons.png)
// sheet cells: 0 breastplate, 1 short blade, 2 whetstone, 3 dust sweep, 4 padded vest, 5 cracked plate, 6 kettle,
// 7 pouch, 8 hourglass, 9 hot ingot, 10 bandage, 11 boot, 12 clasp, 13 (unused), 14 iron block, 15 spyglass
const NOTE_ICON = { armor: 0, vs: 0, sk: 1, dmg: 1, haste: 1, crit: 2, critdmg: 2, aoe: 3, area: 3, hp: 4, lastStand: 4, brk: 5, tag: 5, skfx: 5, regen: 6, cost: 7, link: 8, dot: 9, heal: 10, speed: 11, fuse: 12, flag: 15, range: 15 };
const KEY_ICON = { cinder_landing: 9, oathbound: 0, iron_comet: 11, chainwork: 12, long_breath: 8, clean_link: 12, hair_trigger: 1, heavy_hand: 5, quick_feet: 11, momentum: 3, last_reserves: 4 };
function iconCell(n) {
  if (n.kind === 'keystone') {
    if (KEY_ICON[n.id] !== undefined) return KEY_ICON[n.id];
    const t = (n.id + ' ' + (KEYSTONES[n.id]?.desc || '')).toLowerCase();
    return /cinder|heat|burn/.test(t) ? 9 : /parry|guard|shield/.test(t) ? 0 : /window|breath/.test(t) ? 8 : /link|chain/.test(t) ? 12 : /dodge|leap/.test(t) ? 11 : /poise|heavy/.test(t) ? 5 : /health|heal/.test(t) ? 4 : /haste/.test(t) ? 3 : 14;
  }
  const k = n.e?.[0]?.[0];
  if (k === 'hook') return /breath/i.test(n.name) ? 6 : /rolling|start/i.test(n.name) ? 11 : 0;
  return NOTE_ICON[k] ?? 14;
}
// node frames per state: outer ink rim, bevel light/dark, enamel fill, baked glow, and a filter for painted icons
const NST = {
  held: { rim: '#4a2e08', b1: '#fff0b0', b2: '#b07a1e', f1: '#fff1b8', f2: '#d9a23a', glow: 'rgba(255,196,80,0.9)', fil: 'none' },
  staged: { rim: '#0a3430', b1: '#d8fff6', b2: '#2a9a8e', f1: '#d2fbf2', f2: '#4fb3a6', glow: 'rgba(80,230,210,0.85)', fil: 'saturate(1.05)' },
  reach: { rim: '#4a3216', b1: '#f6e2a8', b2: '#8a6a34', f1: '#f2e6c4', f2: '#cdb88a', glow: null, fil: 'saturate(0.7) brightness(0.9)' },
  lock: { rim: '#4a3c2c', b1: '#c4b89e', b2: '#7a6e5a', f1: '#d2c8b0', f2: '#a69c86', glow: null, fil: 'grayscale(0.8) sepia(0.45) brightness(1.05) contrast(0.7)' },
};
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
const SPAD = 9; // sprite padding (map units) for the baked glow

export function openWebScreen(ui) {
  const w = el('div', 'window w-web');
  w.innerHTML = `<div class="ws-top">
      <b class="ws-title">Skill Web</b><span class="ws-pts"></span>
      <input class="ws-search" type="search" placeholder="Search the Web" maxlength="30" aria-label="Search the Web">
      <div class="ws-sets"></div>
      <div class="ws-sug"><button class="ws-sugb">Suggested path</button><div class="ws-sugl hidden"></div></div>
      <span class="ws-sp"></span>
      <button class="ws-undo">Undo</button><button class="ws-apply">Apply</button><button class="ws-reset"></button><button class="wx" aria-label="Close">✕</button>
    </div>
    <canvas class="ws-cv"></canvas>
    <div class="ws-zoom"><button data-z="1" aria-label="Zoom in">+</button><button data-z="-1" aria-label="Zoom out">&minus;</button><button data-z="0">Start</button></div>
    <div class="ws-legend"><i class="lg-held"></i>Yours <i class="lg-staged"></i>Staged <i class="lg-reach"></i>Within reach <i class="lg-lock"></i>Not yet</div>
    <div class="ws-card hidden"></div>`;
  ui.root.appendChild(w);
  const cv = $('.ws-cv', w), ctx = cv.getContext('2d'), card = $('.ws-card', w), search = $('.ws-search', w);
  const S = { staged: [], hover: null, sel: null, path: null, match: null, cam: { x: 0, y: 0, s: 1 }, dirty: true, W: 0, H: 0, dpr: 1, extra: null, frames: 0, effCache: new Map(), applying: null };
  const you = () => ui.you, cls = () => ui.you.cls, tree = () => ui.you.tree || {};
  const stagedSet = () => { const o = {}; for (const g of S.staged) for (const id of g) o[id] = 1; return o; };
  const allocNow = () => ({ ...tree(), ...stagedSet() });
  const stagedN = () => S.staged.reduce((a, g) => a + g.length, 0);
  const avail = () => (you().treePts || 0) - stagedN();
  const held = (id) => id === TREE_START[cls()] || !!tree()[id];
  // images: class pictures (starts), skill and fusion icons (Forms, fusion notables), the icon sheet and the map art
  const IMG = new Map();
  const img = (src, cb) => { let im = IMG.get(src); if (!im) { im = new Image(); im.decoding = 'async'; im.onload = () => { S.dirty = true; cb?.(); }; im.onerror = () => { im.bad = true; cb?.(); }; im.src = src; IMG.set(src, im); } return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const imgs = {};
  for (const c of Object.keys(CLASSES)) imgs[c] = img(`/sunmere-play/ui/classes/${c}.webp`);
  const sheet = img(ART + 'icons.webp');
  const REGION_ART = ['common', ...Object.keys(REGION_BOX).filter((r) => r !== 'common')];
  { let left = REGION_ART.length + 1; const one = () => { if (--left === 0) S.bgDirty = true; }; img(ART + 'base.webp', one); for (const r of REGION_ART) img(ART + r + '.webp', one); }
  if (document.fonts?.load) Promise.all(['800 40px Cinzel', '700 20px "Alegreya Sans"'].map((f) => document.fonts.load(f).catch(() => 0))).then(() => { S.dirty = true; });

  // ------------------------------------------------------------------ view
  const resize = () => {
    const r = cv.getBoundingClientRect();
    S.dpr = Math.min(devicePixelRatio || 1, 2);
    S.W = Math.max(1, r.width); S.H = Math.max(1, r.height);
    cv.width = Math.round(S.W * S.dpr); cv.height = Math.round(S.H * S.dpr);
    S.dirty = true;
  };
  const home = () => { const st = TREE_BY_ID[TREE_START[cls()]]; S.cam.s = IS_TOUCH ? 0.52 : clamp(S.H / 1450, 0.3, 1.2); /* (phones closer in: finger-sized places) */ S.cam.x = st.x + 330; S.cam.y = st.y + 260; S.dirty = true; };
  const toScreen = (x, y) => [(x - S.cam.x) * S.cam.s + S.W / 2, (y - S.cam.y) * S.cam.s + S.H / 2];
  const toWorld = (sx, sy) => [(sx - S.W / 2) / S.cam.s + S.cam.x, (sy - S.H / 2) / S.cam.s + S.cam.y];
  const zoomAt = (k, sx, sy) => {
    const [wx, wy] = toWorld(sx, sy);
    S.cam.s = clamp(S.cam.s * k, 0.18, 2.6);
    const [nx, ny] = toWorld(sx, sy);
    S.cam.x += wx - nx; S.cam.y += wy - ny; clampCam(); S.dirty = true;
  };
  const clampCam = () => { S.cam.x = clamp(S.cam.x, -200, TREE_MAP.w + 200); S.cam.y = clamp(S.cam.y, -200, TREE_MAP.h + 200); };
  const nodeAt = (sx, sy) => {
    const [x, y] = toWorld(sx, sy), pad = (IS_TOUCH ? 22 : 8) / S.cam.s; // (44 px finger targets on phones)
    let best = null, bd = Infinity;
    for (const n of TREE_NODES) {
      const [bw, bh] = SZ[n.kind], dx = Math.abs(n.x - x) - bw / 2, dy = Math.abs(n.y - y) - bh / 2;
      if (dx > pad || dy > pad) continue;
      const d = Math.max(dx, dy);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };

  // ------------------------------------------------------------------ drawing
  const rrx = (c, x, y, w2, h2, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w2, y, x + w2, y + h2, r); c.arcTo(x + w2, y + h2, x, y + h2, r); c.arcTo(x, y + h2, x, y, r); c.arcTo(x, y, x + w2, y, r); c.closePath(); };
  const rr = (x, y, w2, h2, r) => rrx(ctx, x, y, w2, h2, r);

  // ---- the map sheet: parchment, the painted regions, inked region borders and frame (built once per open)
  const BG = { x0: -260, y0: -260, x1: TREE_MAP.w + 260, y1: TREE_MAP.h + 260 }, bgK = IS_TOUCH ? 0.4 : 0.5;
  let bg = null;
  function buildBg() {
    S.bgDirty = false;
    const c = document.createElement('canvas'); c.width = Math.round((BG.x1 - BG.x0) * bgK); c.height = Math.round((BG.y1 - BG.y0) * bgK);
    const g = c.getContext('2d'), W2 = BG.x1 - BG.x0, H2 = BG.y1 - BG.y0;
    g.setTransform(bgK, 0, 0, bgK, -BG.x0 * bgK, -BG.y0 * bgK);
    const base = IMG.get(ART + 'base.webp');
    if (ok(base)) g.drawImage(base, BG.x0, BG.y0, W2, H2);
    else { const lg = g.createLinearGradient(0, BG.y0, 0, BG.y1); lg.addColorStop(0, INK.parch); lg.addColorStop(1, INK.parch2); g.fillStyle = lg; g.fillRect(BG.x0, BG.y0, W2, H2); }
    // painted regions (keyed to alpha and cropped to the painted island, art_src/web/install.py): each covers its region's
    // nodes and runs a little past the inked border, its aspect kept within 1.35x of the painting's; the long Common
    // Ground band takes two copies side by side (the second mirrored)
    const place = (r, b, flip) => {
      const im = IMG.get(ART + r + '.webp'); if (!ok(im)) return;
      let w2 = b.x1 - b.x0 + 300, h2 = b.y1 - b.y0 + 300; const a = w2 / h2, A = im.naturalWidth / im.naturalHeight;
      if (a < A / 1.35) w2 = h2 * A / 1.35; else if (a > A * 1.35) h2 = w2 / (A * 1.35);
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      g.save(); g.globalAlpha = r === 'common' ? 0.8 : 0.9; g.translate(cx, cy); if (flip) g.scale(-1, 1);
      g.drawImage(im, -w2 / 2, -h2 / 2, w2, h2);
      g.restore();
    };
    for (const r of REGION_ART) {
      const b = REGION_BOX[r]; if (!b) continue;
      if (r === 'common') { const mid = (b.x0 + b.x1) / 2; place(r, { ...b, x1: mid + 150 }, false); place(r, { ...b, x0: mid - 150 }, true); }
      else place(r, b, false);
    }
    // inked borders round the class regions (a surveyor's dash-dot boundary), never round the shared band
    g.lineJoin = 'round';
    for (const [r, b] of Object.entries(REGION_BOX)) {
      if (r === 'common') continue;
      const pad = 95;
      g.setLineDash([]); g.strokeStyle = 'rgba(250,236,200,0.55)'; g.lineWidth = 12; rrx(g, b.x0 - pad, b.y0 - pad, b.x1 - b.x0 + pad * 2, b.y1 - b.y0 + pad * 2, 80); g.stroke();
      g.setLineDash([30, 12, 6, 12]); g.strokeStyle = 'rgba(70,44,18,0.6)'; g.lineWidth = 4.5; g.stroke();
    }
    g.setLineDash([]);
    // the sheet's edge: a soft burn toward the borders, then a double inked frame
    g.setTransform(1, 0, 0, 1, 0, 0);
    const vg = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.42, c.width / 2, c.height / 2, Math.hypot(c.width, c.height) / 2);
    vg.addColorStop(0, 'rgba(120,70,20,0)'); vg.addColorStop(1, 'rgba(110,60,15,0.42)');
    g.globalCompositeOperation = 'multiply'; g.fillStyle = vg; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over';
    g.setTransform(bgK, 0, 0, bgK, -BG.x0 * bgK, -BG.y0 * bgK);
    g.strokeStyle = 'rgba(64,40,16,0.8)'; g.lineWidth = 12; g.strokeRect(BG.x0 + 70, BG.y0 + 70, W2 - 140, H2 - 140);
    g.lineWidth = 3.5; g.strokeRect(BG.x0 + 98, BG.y0 + 98, W2 - 196, H2 - 196);
    bg = c; S.dirty = true;
  }

  // ---- node sprites: the framed icon of each kind in each state, painted once and cached (glows baked in)
  const SPR = new Map();
  const nodeIcon = (n) => {
    if (n.kind === 'start') return imgs[n.cls];
    if (n.kind === 'form') return n.form?.skill ? img(`/sunmere-play/ui/icons/${n.form.skill}.webp`) : null;
    if (n.kind === 'fusion' || n.kind === 'triad') { const f = n.e?.find((e) => e[0] === 'fu'); return f ? img(`/sunmere-play/ui/icons/${f[1]}.webp`) : null; }
    return null;
  };
  function sprite(n, state) {
    const ic = nodeIcon(n), cell = n.kind === 'notable' || n.kind === 'keystone' ? iconCell(n) : -1;
    const icOk = ic ? ok(ic) : cell >= 0 ? ok(sheet) : false, mine = n.kind === 'start' && n.cls === cls();
    const R = Math.max(2, Math.round(S.dpr * 2)), key = `${R}|${n.kind}|${state}|${ic ? ic.src : cell}|${icOk ? 1 : 0}|${n.kind === 'start' ? n.cls + (mine ? '*' : '') : ''}`;
    let c = SPR.get(key); if (c) return c;
    const [bw, bh] = SZ[n.kind], P = SPAD;
    c = document.createElement('canvas'); c.width = Math.ceil((bw + P * 2) * R); c.height = Math.ceil((bh + P * 2) * R);
    const g = c.getContext('2d'); g.scale(R, R); g.translate(P, P);
    const st = NST[state], cc = n.kind === 'start' ? CLASSES[n.cls]?.color || '#888888' : null;
    const rad = Math.min(bw, bh) * (n.kind === 'small' ? 0.3 : 0.22), bd = n.kind === 'small' ? 3.5 : n.kind === 'keystone' ? 6 : n.kind === 'start' ? 6 : 5;
    // glow (held, staged and the hero's own start); a rounded-square glow, never a ring
    const glow = n.kind === 'start' ? (mine ? cc : null) : st.glow;
    if (glow) { g.save(); g.shadowColor = glow; g.shadowBlur = (n.kind === 'small' ? 6 : 9) * R; rrx(g, 0, 0, bw, bh, rad); g.fillStyle = st.rim; g.fill(); g.restore(); }
    // outer ink rim, then the bevel (light from the upper left)
    rrx(g, 0, 0, bw, bh, rad); g.fillStyle = n.kind === 'start' ? shade(cc, -0.6) : st.rim; g.fill();
    const bv = g.createLinearGradient(0, 0, bw, bh);
    if (n.kind === 'start') { bv.addColorStop(0, shade(cc, mine ? 0.55 : 0.2)); bv.addColorStop(1, shade(cc, mine ? -0.25 : -0.45)); }
    else if (n.kind === 'fusion' || n.kind === 'triad') { bv.addColorStop(0, st.b1); bv.addColorStop(0.5, state === 'lock' ? '#7a8a86' : '#6fd8c8'); bv.addColorStop(1, st.b2); }
    else { bv.addColorStop(0, st.b1); bv.addColorStop(1, st.b2); }
    rrx(g, 1.4, 1.4, bw - 2.8, bh - 2.8, rad * 0.85); g.fillStyle = bv; g.fill();
    if (n.kind === 'triad') { g.strokeStyle = st.rim; g.lineWidth = 0.9; rrx(g, 3.2, 3.2, bw - 6.4, bh - 6.4, rad * 0.7); g.stroke(); }
    if (n.kind === 'keystone') { // a heavier frame: a second inked line and brass corner caps
      g.strokeStyle = st.rim; g.lineWidth = 1; rrx(g, 3.4, 3.4, bw - 6.8, bh - 6.8, rad * 0.6); g.stroke();
      g.fillStyle = state === 'lock' ? '#8a8070' : '#f2cf72';
      for (const [x, y] of [[0.8, 0.8], [bw - 6.8, 0.8], [0.8, bh - 6.8], [bw - 6.8, bh - 6.8]]) { rrx(g, x, y, 6, 6, 1.6); g.fill(); }
    }
    // the inner plate: the icon (clipped) or enamel
    const ix = bd, iy = bd, iw = bw - bd * 2, ih = bh - bd * 2, ir = Math.max(1.5, rad * 0.55);
    g.save(); rrx(g, ix, iy, iw, ih, ir); g.clip();
    const en = g.createLinearGradient(0, iy, 0, iy + ih); en.addColorStop(0, st.f1); en.addColorStop(1, st.f2);
    g.fillStyle = en; g.fillRect(ix, iy, iw, ih);
    if (icOk) {
      g.filter = n.kind === 'start' ? (mine ? 'none' : 'grayscale(0.55) brightness(0.72)') : st.fil;
      if (cell >= 0) { const cw = sheet.naturalWidth / ICON_SHEET, sx = (cell % ICON_SHEET) * cw, sy = Math.floor(cell / ICON_SHEET) * cw, k = iw / ih; // (a centre crop to the plate's shape)
        const sw = k >= 1 ? cw : cw * k, sh = k >= 1 ? cw / k : cw; g.drawImage(sheet, sx + (cw - sw) / 2, sy + (cw - sh) / 2, sw, sh, ix, iy, iw, ih); }
      else g.drawImage(ic, ix, iy, iw, ih);
      g.filter = 'none';
      if (state !== 'held' && n.kind !== 'start') { g.fillStyle = state === 'staged' ? 'rgba(80,220,200,0.22)' : state === 'reach' ? 'rgba(240,226,190,0.16)' : 'rgba(214,200,168,0.4)'; g.fillRect(ix, iy, iw, ih); } // (locked icons fade into the parchment)
    } else if (n.kind === 'small') { // a small gem: a soft highlight up top
      const hl = g.createLinearGradient(0, iy, 0, iy + ih * 0.6); hl.addColorStop(0, 'rgba(255,255,255,0.55)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = hl; g.fillRect(ix, iy, iw, ih * 0.6);
    }
    // inner shadow line and a glassy sheen on the top half
    g.strokeStyle = 'rgba(20,10,0,0.55)'; g.lineWidth = 1.2; rrx(g, ix, iy, iw, ih, ir); g.stroke();
    if (n.kind !== 'small') { const sh = g.createLinearGradient(0, iy, 0, iy + ih * 0.5); sh.addColorStop(0, 'rgba(255,255,255,0.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(ix, iy, iw, ih * 0.5); }
    g.restore();
    if (n.kind === 'form') { // split in two: a bronze divider shows its two options
      g.fillStyle = st.rim; g.fillRect(bw / 2 - 1.3, iy, 2.6, ih); g.fillStyle = st.b1; g.fillRect(bw / 2 - 0.4, iy, 0.8, ih);
    }
    SPR.set(key, c);
    return c;
  }

  // ---- one frame
  function draw() {
    if (S.bgDirty) buildBg();
    const s = S.cam.s, d = S.dpr, T = tree(), st = stagedSet(), C = cls(), now = performance.now();
    const have = (id) => id === TREE_START[C] || !!T[id], stg = (id) => !!st[id], own = (id) => have(id) || stg(id);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#1b130b'; ctx.fillRect(0, 0, S.W, S.H); // (the table round the map)
    ctx.setTransform(d * s, 0, 0, d * s, d * (S.W / 2 - S.cam.x * s), d * (S.H / 2 - S.cam.y * s));
    if (bg) ctx.drawImage(bg, BG.x0, BG.y0, BG.x1 - BG.x0, BG.y1 - BG.y0);
    else { ctx.fillStyle = INK.parch; ctx.fillRect(BG.x0, BG.y0, BG.x1 - BG.x0, BG.y1 - BG.y0); }
    // roads, batched per state: inked double-line roads; reach dashed brass; staged teal and held brass glow softly
    const lw = 1 / s, G = { held: new Path2D(), staged: new Path2D(), reach: new Path2D(), lock: new Path2D() };
    for (const [a, b] of TREE_LINKS) {
      const A = TREE_BY_ID[a], B = TREE_BY_ID[b], oa = own(a), ob = own(b);
      const p = have(a) && have(b) ? G.held : oa && ob ? G.staged : oa || ob ? G.reach : G.lock;
      p.moveTo(A.x, A.y); p.lineTo(B.x, B.y);
    }
    const W0 = Math.max(3.2, 2 * lw);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(58,38,18,0.62)'; ctx.lineWidth = W0 * 1.9; ctx.stroke(G.lock);
    ctx.strokeStyle = 'rgba(240,226,190,0.9)'; ctx.lineWidth = W0 * 0.8; ctx.stroke(G.lock);
    ctx.strokeStyle = 'rgba(74,48,18,0.75)'; ctx.lineWidth = W0 * 2; ctx.stroke(G.reach);
    ctx.setLineDash([W0 * 3.2, W0 * 2.2]); ctx.strokeStyle = '#f0c868'; ctx.lineWidth = W0 * 1.05; ctx.stroke(G.reach); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(80,230,210,0.22)'; ctx.lineWidth = W0 * 5; ctx.stroke(G.staged);
    ctx.strokeStyle = '#0d4a44'; ctx.lineWidth = W0 * 2.2; ctx.stroke(G.staged);
    ctx.strokeStyle = '#7ff0e0'; ctx.lineWidth = W0 * 1.2; ctx.stroke(G.staged);
    ctx.strokeStyle = 'rgba(255,200,90,0.26)'; ctx.lineWidth = W0 * 5.5; ctx.stroke(G.held);
    ctx.strokeStyle = '#5a3608'; ctx.lineWidth = W0 * 2.4; ctx.stroke(G.held);
    ctx.strokeStyle = '#f2c050'; ctx.lineWidth = W0 * 1.35; ctx.stroke(G.held);
    ctx.strokeStyle = 'rgba(255,248,210,0.85)'; ctx.lineWidth = W0 * 0.4; ctx.stroke(G.held);
    // the previewed road (hover or the selected place): a soft breathing glow, wide and pale, under the nodes
    if (S.path?.length) {
      const first = TREE_BY_ID[S.path[0]], prev = first.adj.map((k) => TREE_BY_ID[k]).find((n) => own(n.id));
      const pp = new Path2D(); if (prev) pp.moveTo(prev.x, prev.y); else pp.moveTo(first.x, first.y);
      for (const id of S.path) { const n = TREE_BY_ID[id]; pp.lineTo(n.x, n.y); }
      const k = 0.75 + 0.25 * Math.sin(now / 320), okp = S.path.length <= avail(), col = okp ? '255,240,190' : '255,150,120';
      ctx.strokeStyle = `rgba(${col},${0.13 * k})`; ctx.lineWidth = Math.max(40, 22 * lw); ctx.stroke(pp);
      ctx.strokeStyle = `rgba(${col},${0.26 * k})`; ctx.lineWidth = Math.max(22, 12 * lw); ctx.stroke(pp);
      ctx.strokeStyle = `rgba(${col},${0.9})`; ctx.lineWidth = Math.max(8, 4.5 * lw); ctx.stroke(pp);
    }
    ctx.lineCap = 'butt';
    // region names (UI text in the game's fonts, never in the art): Cinzel caps with a parchment halo and inked rules
    for (const r of Object.keys(REGION_BOX)) {
      const f = clamp(24 / s, 26, 110), mine = r === C, name = (TREE_REGIONS[r]?.name || r).toUpperCase();
      const [x, y0] = LABEL_AT[r], y = r === 'common' ? y0 : y0 - f * 0.15;
      ctx.font = `800 ${Math.round(f)}px Cinzel, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(f * 0.16)}px`;
      const tw = ctx.measureText(name).width, ink = mine ? shade(CLASSES[r]?.color || '#3a2812', -0.45) : '#3a2812';
      ctx.globalAlpha = mine ? 1 : 0.85;
      ctx.lineWidth = f * 0.22; ctx.strokeStyle = 'rgba(246,234,204,0.85)'; ctx.strokeText(name, x, y);
      ctx.fillStyle = ink; ctx.fillText(name, x, y);
      ctx.fillRect(x - tw / 2 - f * 2.1, y - f * 0.04, f * 1.6, Math.max(2, f * 0.07)); ctx.fillRect(x + tw / 2 + f * 0.5, y - f * 0.04, f * 1.6, Math.max(2, f * 0.07));
      if (mine) { ctx.fillStyle = CLASSES[r]?.color || ink; ctx.fillRect(x - tw / 2, y + f * 0.55, tw, Math.max(2.5, f * 0.08)); }
      ctx.globalAlpha = 1;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    ctx.textBaseline = 'alphabetic';
    // nodes: one cached sprite each, then the live marks (search glow, hover/selected ring, the chosen Form half)
    const showNames = s > 0.62, pulse = 0.6 + 0.4 * Math.sin(now / 260);
    const vx0 = S.cam.x - S.W / 2 / s - 80, vx1 = S.cam.x + S.W / 2 / s + 80, vy0 = S.cam.y - S.H / 2 / s - 80, vy1 = S.cam.y + S.H / 2 / s + 80;
    ctx.font = `700 ${Math.round(clamp(13 / s, 13, 24))}px "Alegreya Sans", Georgia, sans-serif`; ctx.textAlign = 'center';
    for (const n of S.extra ? TREE_NODES.concat(S.extra) : TREE_NODES) {
      if (n.x < vx0 || n.x > vx1 || n.y < vy0 || n.y > vy1) continue; // (off screen)
      const [bw, bh] = SZ[n.kind], x = n.x - bw / 2, y = n.y - bh / 2, H = own(n.id), sg = stg(n.id);
      const reach = !H && (n.adj || []).some(own), lit = S.match?.has(n.id);
      const state = n.kind === 'start' ? 'lock' : sg ? 'staged' : H ? 'held' : reach ? 'reach' : 'lock';
      if (lit) { ctx.strokeStyle = `rgba(80,235,215,${0.3 * pulse})`; ctx.lineWidth = 16; rr(x - 6, y - 6, bw + 12, bh + 12, 12); ctx.stroke(); }
      ctx.drawImage(sprite(n, state), x - SPAD, y - SPAD, bw + SPAD * 2, bh + SPAD * 2);
      if (lit) { ctx.strokeStyle = '#3fe0cc'; ctx.lineWidth = Math.max(2.5, 1.5 * lw); rr(x - 3, y - 3, bw + 6, bh + 6, 8); ctx.stroke(); }
      if (S.sel === n.id || S.hover === n.id) { ctx.strokeStyle = 'rgba(255,250,230,0.35)'; ctx.lineWidth = Math.max(9, 5 * lw); rr(x - 3, y - 3, bw + 6, bh + 6, 8); ctx.stroke(); ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = Math.max(2.5, 1.6 * lw); ctx.stroke(); }
      if (n.kind === 'form' && H && n.form) { const cur = formOpt(n, you().forms || {}, you().done || {}), left = cur.id === n.form.opts[0].id; ctx.fillStyle = '#ffe08a'; ctx.strokeStyle = '#4a2e08'; ctx.lineWidth = 1.2; rr(left ? x + 4 : n.x + 2, y + bh + 2.5, bw / 2 - 6, 4.5, 2); ctx.fill(); ctx.stroke(); }
      if (showNames && n.kind !== 'small' && n.kind !== 'start' && (n.kind !== 'form' || s > 0.95 || S.hover === n.id || S.sel === n.id)) { // (Form names only up close: two options read long)
        const t = n.name.replace(/ or .*/, n.kind === 'form' ? ' / ' + n.name.split(' or ')[1] : ''), ty = n.y + bh / 2 + 18 / Math.min(1, s);
        ctx.lineWidth = Math.max(3, 3 / s); ctx.strokeStyle = 'rgba(246,234,204,0.9)'; ctx.strokeText(t, n.x, ty);
        ctx.fillStyle = H ? '#5a3608' : INK.text; ctx.fillText(t, n.x, ty);
      }
    }
    ctx.textAlign = 'left';
    // the previewed road's cost, by its end: a small inked plate
    if (S.path?.length) {
      const end = TREE_BY_ID[S.path[S.path.length - 1]], n = S.path.length, okp = n <= avail();
      const tx = end.x + SZ[end.kind][0] / 2 + 12, ty = end.y - SZ[end.kind][1] / 2 - 8, f = Math.round(clamp(15 / s, 14, 30));
      ctx.font = `700 ${f}px Cinzel, Georgia, serif`;
      const label = `${n} point${n > 1 ? 's' : ''}`, tw = ctx.measureText(label).width;
      ctx.fillStyle = okp ? 'rgba(18,44,40,0.92)' : 'rgba(96,26,16,0.92)'; rr(tx - 7, ty - f - 1, tw + 14, f + 10, 5); ctx.fill();
      ctx.strokeStyle = okp ? '#e8c060' : '#ff9a70'; ctx.lineWidth = Math.max(1.5, 1.2 / s); ctx.stroke();
      ctx.fillStyle = okp ? '#fff3cc' : '#ffe0d0'; ctx.fillText(label, tx, ty);
    }
    S.frames++;
    S.anim = !!(S.path?.length || S.match?.size); // (the path and search glows breathe: keep drawing while they show)
  }
  let raf = 0, live = true;
  const loop = () => { if (!live) return; raf = requestAnimationFrame(loop); if (S.dirty || S.force || S.anim) { S.dirty = false; draw(); } };

  // ------------------------------------------------------------------ what a node does (the card and the sheet)
  // fusions a node changes: compile the hero's kit with and without it and compare each fusion (cached per tree state)
  const changedBy = (n) => {
    const key = n.id + '|' + JSON.stringify(allocNow()) + '|' + JSON.stringify(you().forms || {});
    if (S.effCache.has(key)) return S.effCache.get(key);
    const y = you(), with_ = { ...allocNow(), [n.id]: 1 }, without = { ...allocNow() }; delete without[n.id];
    const mk = (t) => { try { return webEff({ ...y, tree: t }, treeMods(y.cls, t, { forms: y.forms, done: y.done })); } catch { return {}; } };
    const A = mk(with_), B = mk(without), out = [];
    for (const f of FUSIONS[y.cls] || []) { const a = A[f.id], b = B[f.id]; if (a && b && JSON.stringify(a) !== JSON.stringify(b)) out.push(a.name !== b.name ? `${b.name} becomes ${a.name}` : a.name); }
    S.effCache.set(key, out);
    return out;
  };
  function cardHtml(n, sheet) {
    const y = you(), C = cls(), T = tree(), H = held(n.id), sg = !!stagedSet()[n.id];
    const where = n.region === 'common' ? 'Common Ground' : n.region === 'bridge' ? 'Bridge' : TREE_REGIONS[n.region]?.name || '';
    const L = [`<div class="wc-h"><b>${n.name}</b><span>${KIND[n.kind]} · ${where}</span></div>`];
    if (n.kind === 'keystone') { const K = KEYSTONES[n.id]; L.push(`<div class="wc-d">${K.desc}</div><div class="wc-price">Price: ${K.price}</div>`); for (const [fid, r] of Object.entries(K.renames || {})) L.push(`<div class="wc-ren">${FUSION_BY_ID[fid]?.name || fid} becomes <b>${r.name}</b></div>`); }
    else if (n.kind === 'form') {
      const cur = formOpt(n, y.forms || {}, y.done || {}), sk = skillOf(n.form.skill);
      L.push(`<div class="wc-sk"><img src="${skillIcon(sk)}" alt="">Changes ${sk?.name}${H ? '' : ' (pick freely once you hold it)'}</div>`);
      for (const o of n.form.opts) { const okCh = formAllowed(n, o.id, y.done || {}); L.push(`<div class="wc-opt ${H && cur.id === o.id ? 'on' : ''}"><b>${o.name}</b>${H && cur.id === o.id ? ' <em>chosen</em>' : ''}<div>${o.desc}</div>${H && cur.id !== o.id ? `<button class="wc-form" data-opt="${o.id}" ${okCh ? '' : 'disabled'}>${okCh ? 'Switch to ' + o.name : 'Not open yet'}</button>` : ''}</div>`); }
      const fz = (FUSIONS[C] || []).filter((f) => f.from === n.form.skill || f.to === n.form.skill).map((f) => f.name);
      if (fz.length) L.push(`<div class="wc-fz">Fusions built from it: ${fz.join(', ')}</div>`);
    } else if (n.desc) L.push(`<div class="wc-d">${n.desc}</div>`);
    const ex = n.desc || n.kind === 'keystone' ? [] : (n.e || []).map(effText).filter(Boolean); // (a notable's own words say it; road nodes list their numbers)
    if (ex.length) L.push(`<div class="wc-d">${ex.join('; ')}.</div>`);
    if (n.kind !== 'start' && n.kind !== 'small') { const ch = changedBy(n); if (ch.length) L.push(`<div class="wc-fz">Changes: ${ch.join(', ')}</div>`); }
    const btn = [];
    if (H && n.kind !== 'start') {
      const leaf = isLeaf(C, T, n.id), free = !!y.treeFree;
      L.push(`<div class="wc-own">Yours</div>`);
      if (leaf) btn.push(`<button class="wc-back">Hand back${free ? ' (free)' : ` (${money(leafRefundCost(y.level))}, in a town)`}</button>`);
    } else if (sg) { L.push('<div class="wc-own st">Staged: press Apply to take it</div>'); btn.push('<button class="wc-unstage">Unstage</button>'); }
    else if (n.kind !== 'start') {
      const p = pathTo(C, allocNow(), n.id);
      if (p) { const ok = p.length <= avail(); L.push(`<div class="wc-path ${ok ? '' : 'short'}">Road to here: ${p.length} point${p.length > 1 ? 's' : ''} (you have ${avail()})</div>`); if (ok && sheet) btn.push(`<button class="wc-take">Take the road (${p.length})</button>`); }
      else L.push('<div class="wc-path short">Not joined to your roads.</div>');
    }
    if (sheet) btn.push('<button class="wc-close">Close</button>');
    if (!sheet && !H && !sg && n.kind !== 'start') L.push(`<div class="wc-hint">Click to stage the road · Apply to take it</div>`);
    if (!sheet && H && isLeaf(C, T, n.id)) L.push('<div class="wc-hint">Right-click to hand it back</div>');
    const B = btn.length ? `<div class="wc-btns">${btn.join('')}</div>` : '';
    return sheet ? L[0] + B + L.slice(1).join('') : L.join('') + B; // (on the bottom sheet the buttons come first, above the fold)
  }
  const showCard = (n, sx, sy, sheet) => {
    if (!n) { card.classList.add('hidden'); return; }
    card.innerHTML = cardHtml(n, sheet);
    card.classList.remove('hidden');
    card.classList.toggle('sheet', !!sheet);
    if (!sheet) placeCard(sx, sy);
    else { card.style.left = ''; card.style.top = ''; }
    wireCard(n);
  };
  function wireCard(n) {
    const C = cls();
    card.querySelector('.wc-take')?.addEventListener('click', () => { stage(n); showCard(n, 0, 0, true); });
    card.querySelector('.wc-unstage')?.addEventListener('click', () => { unstage(n.id); showCard(n, 0, 0, IS_TOUCH); });
    card.querySelector('.wc-back')?.addEventListener('click', () => { ui.g.send({ t: 'treeRefund', id: n.id }); ui.g.sfx?.play('ui'); card.classList.add('hidden'); });
    card.querySelector('.wc-close')?.addEventListener('click', () => { S.sel = null; S.path = null; card.classList.add('hidden'); S.dirty = true; });
    card.querySelectorAll('.wc-form').forEach((b) => b.addEventListener('click', () => { ui.g.send({ t: 'treeForm', id: n.id, opt: b.dataset.opt }); ui.g.sfx?.play('ui'); }));
    void C;
  }

  // ------------------------------------------------------------------ staging, Apply, Undo, Suggested path
  function stage(n) {
    if (held(n.id) || stagedSet()[n.id] || n.kind === 'start') return false;
    const p = pathTo(cls(), allocNow(), n.id);
    if (!p) { ui.error('That is not joined to your roads.'); return false; }
    if (p.length > avail()) { ui.error(`That road needs ${p.length} points; you have ${avail()}.`); return false; }
    S.staged.push(p); S.path = null; S.dirty = true; ui.g.sfx?.play('ui'); haptic('light');
    sync(); return true;
  }
  function unstage(id) { const i = S.staged.findIndex((g) => g.includes(id)); if (i >= 0) { S.staged.splice(i); S.dirty = true; sync(); } }
  const apply = () => { const ids = S.staged.flat(); if (!ids.length) return; S.applying = ids; ui.g.send({ t: 'tree', ids }); ui.g.sfx?.play('ui'); };
  const undo = () => { if (S.staged.pop()) { S.dirty = true; sync(); ui.g.sfx?.play('ui'); } };
  const suggest = (id) => {
    const steps = buildSteps(cls(), id, { ...tree() }, you().treePts || 0, pathTo);
    S.staged = steps.length ? [steps] : []; S.dirty = true; sync();
    $('.ws-sugl', w).classList.add('hidden');
    if (!steps.length) ui.error('Nothing more of that path fits your points yet.');
    else { const last = TREE_BY_ID[steps[steps.length - 1]]; S.cam.x = (S.cam.x + last.x) / 2; S.cam.y = (S.cam.y + last.y) / 2; }
  };
  function sync() {
    const y = you(), n = stagedN(), pts = y.treePts || 0, spent = Object.keys(tree()).length;
    $('.ws-pts', w).innerHTML = `Points <b class="${pts - n ? 'free' : ''}">${pts - n}</b>${n ? ` <em>(${n} staged)</em>` : ''} · ${spent} taken${y.treeFree ? ' · respec free' : ''}`;
    $('.ws-apply', w).disabled = !n; $('.ws-undo', w).disabled = !n;
    $('.ws-apply', w).classList.toggle('hot', !!n);
    const rs = $('.ws-reset', w); rs.style.display = spent ? '' : 'none'; if (!rs.dataset.sure) rs.textContent = `Clear the Web (${y.treeFree ? 'free' : money(treeResetCost(y.level))})`;
    const L = y.webSets || null, lo = y.lo || 0;
    $('.ws-sets', w).innerHTML = [0, 1].map((i) => `<button class="ws-set ${i === lo ? 'on' : ''}" data-i="${i}" ${i !== lo && y.level < 10 ? 'disabled title="Opens at level 10"' : ''}>Web ${i + 1}${i === lo ? '' : ` (${L?.[i] ?? 0})`}</button>`).join('');
    w.querySelectorAll('.ws-set').forEach((b) => (b.onclick = () => { if (!b.classList.contains('on')) ui.g.send({ t: 'loadout', i: Number(b.dataset.i) }); }));
    $('.ws-sugl', w).innerHTML = (TREE_BUILDS[cls()] || []).map((b) => `<button data-b="${b.id}"><b>${b.name}</b><span>${b.desc}</span></button>`).join('') || '<em>No suggested paths for this class yet.</em>';
    w.querySelectorAll('.ws-sugl button').forEach((b) => (b.onclick = () => suggest(b.dataset.b)));
  }

  // ------------------------------------------------------------------ input
  const P = new Map(); let drag = null, pinch = null, lp = 0;
  const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture?.(e.pointerId);
    const [x, y] = local(e);
    P.set(e.pointerId, { x, y });
    $('.ws-sugl', w).classList.add('hidden');
    if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: S.cam.s }; drag = null; clearTimeout(lp); return; }
    drag = { x, y, cx: S.cam.x, cy: S.cam.y, moved: false, t: performance.now(), btn: e.button };
    clearTimeout(lp);
    if (e.pointerType === 'touch') lp = setTimeout(() => { const n = nodeAt(x, y); if (n && drag && !drag.moved) { drag.long = true; select(n); haptic('light'); } }, 480);
  });
  cv.addEventListener('pointermove', (e) => {
    const [x, y] = local(e);
    if (P.has(e.pointerId)) P.set(e.pointerId, { x, y });
    if (pinch && P.size >= 2) {
      const [a, b] = [...P.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((pinch.s * d / pinch.d) / S.cam.s, (a.x + b.x) / 2, (a.y + b.y) / 2); return;
    }
    if (drag) {
      if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) > 6) { drag.moved = true; clearTimeout(lp); }
      if (drag.moved) { S.cam.x = drag.cx - (x - drag.x) / S.cam.s; S.cam.y = drag.cy - (y - drag.y) / S.cam.s; clampCam(); S.dirty = true; }
      return;
    }
    if (e.pointerType === 'mouse') hoverAt(x, y);
  });
  const end = (e) => {
    P.delete(e.pointerId);
    if (P.size < 2) pinch = null;
    clearTimeout(lp);
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved || d.long || e.type === 'pointercancel') return;
    const [x, y] = local(e), n = nodeAt(x, y);
    if (e.pointerType !== 'mouse') { if (n) select(n); else { S.sel = null; S.path = null; card.classList.add('hidden'); S.dirty = true; } return; }
    if (d.btn === 2) { if (n && held(n.id) && isLeaf(cls(), tree(), n.id)) { ui.g.send({ t: 'treeRefund', id: n.id }); ui.g.sfx?.play('ui'); } else if (n && stagedSet()[n.id]) unstage(n.id); return; }
    if (!n) return;
    if (held(n.id) || stagedSet()[n.id]) { S.sel = n.id; showCard(n, x, y, false); S.dirty = true; return; }
    stage(n); hoverAt(x, y, true);
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerleave', () => { if (!drag && S.hover) { S.hover = null; S.path = S.sel ? S.path : null; card.classList.add('hidden'); S.dirty = true; } });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = local(e); zoomAt(Math.pow(1.0015, -e.deltaY), x, y); }, { passive: false });
  function hoverAt(x, y, force) {
    const n = nodeAt(x, y), id = n?.id || null;
    S.hx = x; S.hy = y;
    if (id === S.hover && !force) { if (n && !card.classList.contains('hidden')) placeCard(x, y); return; }
    S.hover = id;
    S.path = n && !held(n.id) && !stagedSet()[n.id] && n.kind !== 'start' ? pathTo(cls(), allocNow(), n.id) : null;
    showCard(n, x, y, false);
    S.dirty = true;
  }
  // the card beside the pointer, on the side away from the node's cost label (right and below, else left or above)
  function placeCard(x, y) {
    const r = card.getBoundingClientRect(), wr = w.getBoundingClientRect();
    let L = x + 40, T = y + 28;
    if (L + r.width > wr.width - 8) L = x - r.width - 40;
    if (T + r.height > wr.height - 8) T = y - r.height - 28;
    card.style.left = clamp(L, 8, wr.width - r.width - 8) + 'px'; card.style.top = clamp(T, 54, wr.height - r.height - 8) + 'px';
  }
  function select(n) {
    S.sel = n.id;
    S.path = !held(n.id) && !stagedSet()[n.id] && n.kind !== 'start' ? pathTo(cls(), allocNow(), n.id) : null;
    showCard(n, 0, 0, true); S.dirty = true;
  }
  search.addEventListener('keydown', (e) => e.stopPropagation());
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    S.match = q.length < 2 ? null : new Set(TREE_NODES.filter((n) => [n.name, n.desc, n.kind === 'keystone' ? KEYSTONES[n.id]?.desc : '', ...(n.form?.opts || []).map((o) => o.name + ' ' + o.desc), ...(n.e || []).map(effText)].join(' ').toLowerCase().includes(q)).map((n) => n.id));
    // the first match comes into view
    const first = S.match && [...S.match].map((id) => TREE_BY_ID[id]).sort((a, b) => (a.region === cls() ? -1 : 0) - (b.region === cls() ? -1 : 0))[0];
    if (first) { const [sx, sy] = toScreen(first.x, first.y); if (sx < 40 || sy < 60 || sx > S.W - 40 || sy > S.H - 40) { S.cam.x = first.x; S.cam.y = first.y; } }
    S.dirty = true;
  });
  $('.ws-zoom', w).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const z = Number(b.dataset.z); if (!z) home(); else zoomAt(z > 0 ? 1.25 : 0.8, S.W / 2, S.H / 2); });
  $('.ws-apply', w).onclick = apply; $('.ws-undo', w).onclick = undo;
  $('.ws-sugb', w).onclick = () => $('.ws-sugl', w).classList.toggle('hidden');
  const rs = $('.ws-reset', w);
  rs.onclick = () => { if (rs.dataset.sure) { ui.g.send({ t: 'treeReset' }); rs.dataset.sure = ''; S.staged = []; } else { rs.dataset.sure = '1'; rs.textContent = IS_TOUCH ? 'Tap again to clear' : 'Click again to clear'; } };
  const close = () => { live = false; cancelAnimationFrame(raf); removeEventListener('resize', resize); w.remove(); ui.hideTip(); ui.windows.talents = null; };
  $('.wx', w).onclick = close;
  const remove0 = w.remove.bind(w);
  w.remove = () => { live = false; cancelAnimationFrame(raf); removeEventListener('resize', resize); remove0(); };
  addEventListener('resize', resize);
  // a new state from the server (ui.setYou refreshes open windows): staged roads now held drop out; the card follows
  w.refresh = () => {
    if (!ui.you?.web) return;
    const T = tree();
    S.staged = S.staged.map((g) => g.filter((id) => !T[id])).filter((g) => g.length);
    if (S.applying && S.applying.every((id) => T[id])) { S.applying = null; haptic('medium'); }
    if (S.staged.length && S.staged.flat().some((id) => !pathTo(cls(), { ...T, ...stagedSet() }, id) && !stagedSet()[id])) S.staged = [];
    S.effCache.clear(); S.dirty = true; sync();
    const keep = S.sel || S.hover, k = keep && TREE_BY_ID[keep];
    S.path = k && !held(k.id) && !stagedSet()[k.id] && k.kind !== 'start' ? pathTo(cls(), allocNow(), k.id) : null;
    if (k && !card.classList.contains('hidden')) showCard(k, S.hx || 0, S.hy || 0, card.classList.contains('sheet'));
  };
  // test and bench hooks (the off-screen checks): stage/apply by id, and a pan-and-zoom bench that redraws every frame,
  // optionally with extra copies of the map's nodes (to measure the full 436-node Web before the other regions are filled)
  w.api = { S, stage: (id) => stage(TREE_BY_ID[id]), apply, undo, suggest, select: (id) => select(TREE_BY_ID[id]), home, draw,
    toScreen: (id) => { const n = TREE_BY_ID[id], r = cv.getBoundingClientRect(), [x, y] = toScreen(n.x, n.y); return [r.left + x, r.top + y]; },
    bench(secs = 5, total = 0) {
      S.extra = null;
      if (total > TREE_NODES.length) { S.extra = []; for (let i = 0; S.extra.length < total - TREE_NODES.length; i++) { const n = TREE_NODES[i % TREE_NODES.length]; S.extra.push({ ...n, id: n.id + '~' + i, x: n.x + 37 + (i % 7) * 9, y: n.y + 41 + (i % 5) * 7, adj: [] }); } }
      return new Promise((res) => {
        const t0 = performance.now(), times = []; let last = t0; S.force = true;
        const step = (t) => {
          times.push(t - last); last = t;
          const k = (t - t0) / 1000; S.cam.x = 1400 + Math.sin(k * 0.9) * 900; S.cam.y = 1200 + Math.cos(k * 0.7) * 600; S.cam.s = 0.5 + 0.35 * Math.sin(k * 1.3);
          if (t - t0 < secs * 1000) requestAnimationFrame(step);
          else { S.force = false; S.extra = null; S.dirty = true; times.shift(); times.sort((a, b) => a - b); const avg = times.reduce((a, b) => a + b, 0) / times.length; res({ nodes: total || TREE_NODES.length, frames: times.length, fps: +(1000 / avg).toFixed(1), p50: +times[times.length >> 1].toFixed(2), p95: +times[Math.floor(times.length * 0.95)].toFixed(2), worst: +times[times.length - 1].toFixed(2) }); }
        };
        requestAnimationFrame(step);
      });
    },
    drawCost() { const t = performance.now(); for (let i = 0; i < 20; i++) draw(); return +((performance.now() - t) / 20).toFixed(3); },
    sheet: () => bg, // (the painted map sheet, for checks)
  };
  resize(); home(); sync(); loop();
  requestAnimationFrame(resize);
  return w;
}
