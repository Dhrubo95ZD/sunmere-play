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

// the region plates: a padded box round each region's nodes (drawn soft, behind the roads)
const REGION_BOX = (() => {
  const out = {};
  for (const n of TREE_NODES) { if (n.region === 'bridge') continue; const b = (out[n.region] ||= { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }); b.x0 = Math.min(b.x0, n.x); b.y0 = Math.min(b.y0, n.y); b.x1 = Math.max(b.x1, n.x); b.y1 = Math.max(b.y1, n.y); }
  return out;
})();
const REGION_TINT = { knight: '#4a6aa8', warden: '#7a6a4a', sandblade: '#b08a40', ranger: '#4a8a5a', deadeye: '#8a5a3a', chemist: '#4a8a8a', herbalist: '#6a9a4a', common: '#8a7a5a' };

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
  const imgs = {};
  for (const c of Object.keys(CLASSES)) { const im = new Image(); im.onload = () => { S.dirty = true; }; im.src = `/sunmere-play/ui/classes/${c}.webp`; imgs[c] = im; }

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
  const rr = (x, y, w2, h2, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w2, y, x + w2, y + h2, r); ctx.arcTo(x + w2, y + h2, x, y + h2, r); ctx.arcTo(x, y + h2, x, y, r); ctx.arcTo(x, y, x + w2, y, r); ctx.closePath(); };
  function draw() {
    const s = S.cam.s, d = S.dpr, T = tree(), st = stagedSet(), C = cls();
    const have = (id) => id === TREE_START[C] || !!T[id], stg = (id) => !!st[id], own = (id) => have(id) || stg(id);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, S.H); g.addColorStop(0, INK.parch); g.addColorStop(1, INK.parch2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
    ctx.setTransform(d * s, 0, 0, d * s, d * (S.W / 2 - S.cam.x * s), d * (S.H / 2 - S.cam.y * s));
    // region plates and names (UI text)
    for (const [r, b] of Object.entries(REGION_BOX)) {
      const pad = 70; ctx.globalAlpha = r === C ? 0.16 : 0.08; ctx.fillStyle = REGION_TINT[r] || '#8a7a5a';
      rr(b.x0 - pad, b.y0 - pad, b.x1 - b.x0 + pad * 2, b.y1 - b.y0 + pad * 2, 60); ctx.fill();
      ctx.globalAlpha = r === C ? 0.85 : 0.55; ctx.fillStyle = INK.text; ctx.font = `700 ${Math.round(30 / Math.max(0.6, s))}px Georgia, serif`;
      ctx.fillText((TREE_REGIONS[r]?.name || r).toUpperCase(), b.x0 - pad + 24, b.y0 - pad + 40 / Math.max(0.6, s));
    }
    ctx.globalAlpha = 1;
    // roads: held brass, staged teal, within reach dashed brass, the rest grey ink
    const lw = 1 / s;
    for (const [a, b] of TREE_LINKS) {
      const A = TREE_BY_ID[a], B = TREE_BY_ID[b], oa = own(a), ob = own(b);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
      if (have(a) && have(b)) { ctx.strokeStyle = INK.held; ctx.lineWidth = Math.max(7, 4 * lw); ctx.setLineDash([]); }
      else if (oa && ob) { ctx.strokeStyle = INK.staged; ctx.lineWidth = Math.max(6, 3.5 * lw); ctx.setLineDash([]); }
      else if (oa || ob) { ctx.strokeStyle = INK.reach; ctx.lineWidth = Math.max(4, 2.5 * lw); ctx.setLineDash([12, 9]); }
      else { ctx.strokeStyle = INK.road; ctx.lineWidth = Math.max(3, 2 * lw); ctx.setLineDash([]); }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // the previewed road (hover or the selected place): a wide pale band under the nodes
    if (S.path?.length) {
      ctx.strokeStyle = 'rgba(255,250,225,0.9)'; ctx.lineWidth = Math.max(12, 7 * lw); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const first = TREE_BY_ID[S.path[0]], prev = first.adj.map((k) => TREE_BY_ID[k]).find((n) => own(n.id));
      ctx.beginPath(); if (prev) ctx.moveTo(prev.x, prev.y); else ctx.moveTo(first.x, first.y);
      for (const id of S.path) { const n = TREE_BY_ID[id]; ctx.lineTo(n.x, n.y); }
      ctx.stroke(); ctx.lineCap = 'butt';
    }
    // nodes
    const showNames = s > 0.62;
    for (const n of S.extra ? TREE_NODES.concat(S.extra) : TREE_NODES) {
      const [bw, bh] = SZ[n.kind], x = n.x - bw / 2, y = n.y - bh / 2, H = own(n.id), sg = stg(n.id);
      const reach = !H && (n.adj || []).some(own), lit = S.match?.has(n.id);
      if (lit) { ctx.shadowColor = '#4fe0d0'; ctx.shadowBlur = 22 * d * s; }
      ctx.fillStyle = n.kind === 'start' ? CLASSES[n.cls]?.color || '#777' : sg ? '#9ee0d4' : H ? (n.kind === 'keystone' ? '#e0703a' : INK.heldHi) : n.kind === 'keystone' ? (reach ? '#9a6a50' : '#7d6a5c') : reach ? '#c9bb98' : n.region === C ? '#a7a08f' : '#b5ae9c';
      rr(x, y, bw, bh, Math.min(bw, bh) * 0.24); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = lit || S.sel === n.id || S.hover === n.id ? 4 : 2;
      ctx.strokeStyle = S.sel === n.id || S.hover === n.id ? '#ffffff' : lit ? '#2aa69a' : H ? '#6a4a14' : reach ? '#7a5a26' : '#5a5246';
      ctx.stroke();
      if (n.kind === 'notable' || n.kind === 'fusion' || n.kind === 'triad') { // a bevel: a lighter inner plate, offset up-left
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; rr(x + 5, y + 5, bw - 14, bh - 14, 5); ctx.fill();
      }
      if (n.kind === 'fusion' || n.kind === 'triad') { ctx.fillStyle = 'rgba(60,40,10,0.55)'; ctx.fillRect(x + bw * 0.3, y + bh * 0.62, bw * 0.4, bh * 0.12); ctx.fillRect(x + bw * 0.3, y + bh * 0.26, bw * 0.4, bh * 0.12); }
      if (n.kind === 'form') { // split in two: its two options
        ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(n.x, y + 4); ctx.lineTo(n.x, y + bh - 4); ctx.stroke();
        if (H && n.form) { const cur = formOpt(n, you().forms || {}, you().done || {}), left = cur.id === n.form.opts[0].id; ctx.fillStyle = 'rgba(90,60,10,0.35)'; rr(left ? n.x + 2 : x + 2, y + 2, bw / 2 - 4, bh - 4, 5); ctx.fill(); }
      }
      if (n.kind === 'start') { const im = imgs[n.cls]; if (im?.complete && im.naturalWidth) { ctx.save(); rr(x + 4, y + 4, bw - 8, bh - 8, 8); ctx.clip(); ctx.drawImage(im, x + 4, y + 4, bw - 8, bh - 8); ctx.restore(); } }
      if (showNames && n.kind !== 'small' && n.kind !== 'start' && (n.kind !== 'form' || s > 0.95 || S.hover === n.id || S.sel === n.id)) { // (Form names only up close: two options read long)
        ctx.fillStyle = INK.text; ctx.font = `600 ${Math.round(clamp(13 / s, 13, 24))}px Georgia, serif`; ctx.textAlign = 'center';
        ctx.fillText(n.name.replace(/ or .*/, n.kind === 'form' ? ' / ' + n.name.split(' or ')[1] : ''), n.x, n.y + bh / 2 + 18 / Math.min(1, s));
        ctx.textAlign = 'left';
      }
    }
    // the previewed road's cost, by its end
    if (S.path?.length) {
      const end = TREE_BY_ID[S.path[S.path.length - 1]], n = S.path.length, ok = n <= avail();
      const tx = end.x + SZ[end.kind][0] / 2 + 10, ty = end.y - SZ[end.kind][1] / 2 - 8, f = Math.round(clamp(15 / s, 14, 30));
      ctx.font = `700 ${f}px Georgia, serif`;
      const label = `${n} point${n > 1 ? 's' : ''}`, tw = ctx.measureText(label).width;
      ctx.fillStyle = ok ? 'rgba(30,60,50,0.88)' : 'rgba(110,30,20,0.88)'; rr(tx - 6, ty - f, tw + 12, f + 8, 6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(label, tx, ty);
    }
    S.frames++;
  }
  let raf = 0, live = true;
  const loop = () => { if (!live) return; raf = requestAnimationFrame(loop); if (S.dirty || S.force) { S.dirty = false; draw(); } };

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
  };
  resize(); home(); sync(); loop();
  requestAnimationFrame(resize);
  return w;
}
