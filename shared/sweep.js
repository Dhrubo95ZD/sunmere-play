// v108: a skill's root motion (a dash, a leap, a hop back such as the Deadeye's Recoil Jump) moved the hero in one go
// per frame, and the wall push afterwards could shove a hero who had got past a thin wall's middle out the far side.
// sweepMove walks the move in short steps and pushes out of the walls after each one, the way walking does, and stops
// at the first step that a wall turns back (or that passes into a house wall), so a push never carries anyone through.
//   pos      {x, z}, changed in place
//   dx, dz   the whole move this frame
//   push     (pos, radius) => void: pushes pos out of the solid things (the client's world.collide, or housePush)
//   crosses  (x0, z0, x1, z1) => bool: optional, true when the straight step passes into a wall (houseCrosses)
// returns true when the move was cut short by something solid.
export function sweepMove(pos, dx, dz, radius, push, crosses, step = 0.2) {
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) { push(pos, radius); return false; }
  const n = Math.max(1, Math.ceil(len / step)), sx = dx / n, sz = dz / n, sl = len / n;
  for (let i = 0; i < n; i++) {
    const px = pos.x, pz = pos.z;
    pos.x += sx; pos.z += sz;
    if (crosses && crosses(px, pz, pos.x, pos.z)) { pos.x = px; pos.z = pz; push(pos, radius); return true; }
    push(pos, radius);
    // how far the step really went along the move: a wall that took back most of it is where the move ends
    const along = ((pos.x - px) * sx + (pos.z - pz) * sz) / sl;
    if (along < sl * 0.35) return true;
  }
  return false;
}
