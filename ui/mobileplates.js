// Nameplates on phones and tablets (spec section 4): fewer, larger, never piled up. Pure functions, no imports from the
// game, so node can test them; ui.js updatePlates calls them when IS_MOBILE (the desktop never does).
//
//   plateRules(v, dist, { targetId, nearestNpcId, isMobile, mode, playerNames }) -> { show, title, hp }
//     v     an entity view (v.id, v.ty 'n' | 'm' | 'p', v.dead, v.data.h)
//     dist  metres from the HERO (not the camera: the camera sits 9-26 m back on a phone)
//     mode  SETTINGS.touch.plates ('off' | 'few' | 'all'), playerNames SETTINGS.touch.playerNames
//     show  draw a plate at all; title  the <title> line (only the target and the nearest NPC within 8 m);
//     hp    the plate's bar (foes and players when damaged or targeted; NPCs never)
//
//   declutter(list, W, H, avoidRects, { max }) -> the shown items
//     list  [{ el, x, y, w, h, tg, dist }]: x, y the anchor (bottom centre) in px, w, h the plate size
//     Keeps the target and the nearest `max` others (6), nearest first; hides a plate (visibility: hidden) that meets a
//     HUD rect (game.touch.hudRects()) or that still overlaps a placed one after one lift of its own height. Sets
//     it.hidden and, when lifted, it.y; the caller then places the shown ones (translate to x, y) and runs the
//     occlusion ray only for them (7 at most).
//
//   nearestNpc(views, heroPos, maxD = 8) -> id of the nearest living NPC within maxD m, or null
export const PLATES = Object.freeze({
  few: { npc: 22, hostile: 35, max: 6 },
  all: { npc: 40, hostile: 50, max: 12 },
  off: { npc: 0, hostile: 0, max: 0 },
  TITLE_RANGE: 8, LIFT_GAP: 2, PAD: 6,
});

export function plateRules(v, dist, { targetId = null, nearestNpcId = null, isMobile = true, mode = 'few', playerNames = false } = {}) {
  const damaged = (v?.data?.h ?? 1) < 1;
  if (!isMobile) return { show: true, title: true, hp: v?.ty !== 'n' && !v?.dead };
  if (!v) return { show: false, title: false, hp: false };
  const tg = targetId != null && v.id === targetId;
  if (tg) return { show: true, title: true, hp: v.ty !== 'n' && !v.dead };
  const R = PLATES[mode] || PLATES.few;
  let show = false;
  if (v.ty === 'n') show = dist <= R.npc;
  else if (v.ty === 'm') show = dist <= R.hostile;
  else if (v.ty === 'p') show = !!playerNames && dist <= R.npc;
  const title = show && v.id === nearestNpcId;
  const hp = show && v.ty !== 'n' && !v.dead && damaged;
  return { show, title, hp };
}

export function nearestNpc(views, heroPos, maxD = PLATES.TITLE_RANGE) {
  if (!heroPos) return null;
  let best = null, bd = maxD;
  for (const v of views || []) {
    if (!v || v.ty !== 'n' || v.dead || v.root?.visible === false || !v.pos) continue;
    const d = Math.hypot(v.pos.x - heroPos.x, v.pos.z - heroPos.z);
    if (d <= bd) { bd = d; best = v.id; }
  }
  return best;
}

const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const box = (x, y, w, h) => ({ left: x - w / 2, right: x + w / 2, top: y - h, bottom: y });
const setVis = (it, on) => { const e = it.el || it.p; if (e?.style) e.style.visibility = on ? '' : 'hidden'; };

export function declutter(list, W, H, avoidRects = [], { max = PLATES.few.max } = {}) {
  const items = [...(list || [])].sort((a, b) => (!!b.tg - !!a.tg) || a.dist - b.dist);
  const placed = [], shown = [], avoid = (avoidRects || []).filter(Boolean);
  let others = 0;
  for (const it of items) {
    it.hidden = true;
    const w = it.w || 80, h = it.h || 30;
    if (!it.tg && others >= max) { setVis(it, false); continue; }
    // inside the screen (the caller clamps x the same way)
    const x = Math.min(W - PLATES.PAD - w / 2, Math.max(PLATES.PAD + w / 2, it.x));
    let y = Math.min(H, Math.max(h, it.y)), b = box(x, y, w, h);
    if (placed.some((q) => meets(b, q))) {
      // one step up: just above the lowest placed plate it meets, if that is no more than one plate height
      let best = null;
      for (const q of placed) {
        if (!meets(b, q)) continue;
        const c = q.top - PLATES.LIFT_GAP;
        if (y - c <= h + 4 && c >= h && !placed.some((r) => meets(box(x, c, w, h), r)) && (best === null || c > best)) best = c;
      }
      if (best === null) { setVis(it, false); continue; }
      y = best; b = box(x, y, w, h);
    }
    if (avoid.some((r) => meets(b, r))) { setVis(it, false); continue; }
    it.hidden = false; it.x = x; it.y = y;
    placed.push(b); shown.push(it); setVis(it, true);
    if (!it.tg) others++;
  }
  return shown;
}
