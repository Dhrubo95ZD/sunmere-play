// Painted item icons for gear: every weapon, off-hand and armour type, drawn in a 100 x 100 box and scaled.
// `tint` picks the material: 0 iron, 1 steel, 2 brass, 3 storm-forged (cloth: undyed, blue, red, dark blue).
// Rules kept: no crosses, stars, crescents or faces; shields carry plain bands and a round boss only.

const METALS = [
  ['#ececec', '#9c9c9c', '#3a3a3a'], // iron
  ['#ffffff', '#c6d0dc', '#4a5564'], // steel
  ['#fff2c0', '#dcaa48', '#5a3a10'], // brass
  ['#eaf6ff', '#7e9edc', '#1c2a58'], // storm-forged
];
const CLOTH = ['#9a8662', '#4a6aa0', '#9a3c2c', '#3a4a86'];
const WOOD = ['#d4a46a', '#8e5c30', '#4a2a12'];
const LEATHER = ['#b88050', '#7c4a24', '#3a200c'];
const GOLD = ['#fff4b8', '#e2b444', '#7a5212'];

function grad(x, x0, y0, x1, y1, st) { const g = x.createLinearGradient(x0, y0, x1, y1); st.forEach((c, i) => g.addColorStop(i / (st.length - 1), c)); return g; }
function poly(x, pts) { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); }
function ink(x, w = 2.4) { x.lineWidth = w; x.strokeStyle = 'rgba(12,8,4,0.92)'; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(); }
function fillInk(x, fill, w) { x.fillStyle = fill; x.fill(); ink(x, w); }
function shadow(x, on) { if (on) { x.shadowColor = 'rgba(0,0,0,0.55)'; x.shadowBlur = 7; x.shadowOffsetY = 3; } else { x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0; } }
function shine(x, x0, y0, x1, y1, a = 0.7) { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.lineWidth = 1.6; x.strokeStyle = `rgba(255,255,255,${a})`; x.stroke(); }
function rot(x, cx, cy, a, fn) { x.save(); x.translate(cx, cy); x.rotate(a); fn(); x.restore(); }

// a grip wrapped in leather, along the local y axis from y0 to y1
function grip(x, y0, y1, w = 7) {
  x.beginPath(); x.rect(-w / 2, y0, w, y1 - y0); fillInk(x, grad(x, -w / 2, 0, w / 2, 0, LEATHER), 2);
  for (let y = y0 + 3; y < y1 - 1; y += 4) { x.beginPath(); x.moveTo(-w / 2, y); x.lineTo(w / 2, y + 2); x.lineWidth = 1.2; x.strokeStyle = 'rgba(30,14,4,0.8)'; x.stroke(); }
}
function pistolIcon(x, t, short) {
  const M = METALS[t], band = t >= 2 ? GOLD : t === 1 ? ['#fff2c0', '#c8a050', '#5a3a10'] : [M[0], M[1], M[2]];
  rot(x, 50, 54, -Math.PI / 12, () => {
    const L = short ? 46 : 60, x0 = -22;
    shadow(x, true);
    // stock: the grip sweeping down and back to the butt, the forestock under the barrel
    x.beginPath(); x.moveTo(x0 - 2, -10); x.lineTo(x0 + 18, -10); x.lineTo(x0 + 16, -2); x.lineTo(x0 + 2, 2); x.lineTo(x0 - 12, 26); x.lineTo(x0 - 26, 22); x.lineTo(x0 - 14, -2); x.closePath();
    fillInk(x, grad(x, x0 - 26, 0, x0 + 18, 0, short ? ['#9a5a30', '#5a3018', '#2a140a'] : WOOD));
    x.beginPath(); x.rect(x0 + 14, -9, L - 12, 6); fillInk(x, grad(x, 0, -9, 0, -3, WOOD), 1.8);
    shadow(x, false);
    // barrel
    x.beginPath(); x.rect(x0 + 4, -19, L, 10); fillInk(x, grad(x, 0, -19, 0, -9, [M[0], M[1], M[2]]));
    shine(x, x0 + 6, -16.5, x0 + L + 2, -16.5, 0.6);
    for (const bx of short ? [L * 0.6] : [L * 0.45, L * 0.82]) { x.beginPath(); x.rect(x0 + 4 + bx, -20.5, 5, 13); fillInk(x, grad(x, 0, -20, 0, -8, band), 1.4); }
    x.beginPath(); x.rect(x0 + L + 1, -20, 4, 12); fillInk(x, grad(x, 0, -20, 0, -8, band), 1.4);
    // lock plate, solid-disc hammer, trigger guard and trigger
    x.beginPath(); x.roundRect(x0 + 2, -12, 16, 8, 2); fillInk(x, grad(x, 0, -12, 0, -4, [M[0], M[1], M[2]]), 1.4);
    x.beginPath(); x.arc(x0 + 4, -21, 4.5, 0, Math.PI * 2); fillInk(x, grad(x, x0, -25, x0 + 8, -17, [M[0], M[1], M[2]]), 1.4);
    x.beginPath(); x.arc(x0 + 10, 0, 6, 0, Math.PI); x.lineWidth = 2.6; x.strokeStyle = band[1]; x.stroke();
    x.beginPath(); x.moveTo(x0 + 10, -2); x.lineTo(x0 + 8, 4); x.lineWidth = 2; x.strokeStyle = '#2a2a2a'; x.stroke();
    x.beginPath(); x.roundRect(x0 - 27, 20, 15, 7, 2); fillInk(x, grad(x, 0, 20, 0, 27, band), 1.4);
  });
}
function pommel(x, y, r = 5) { x.beginPath(); x.arc(0, y, r, 0, Math.PI * 2); fillInk(x, grad(x, -r, y - r, r, y + r, GOLD), 2); }

const P = {
  // ------------------------------------------------------------------ weapons (diagonal, hilt bottom-left)
  w_sword(x, t) {
    rot(x, 50, 52, Math.PI / 4, () => {
      const M = METALS[t];
      shadow(x, true);
      poly(x, [[-6, 18], [6, 18], [6, -36], [0, -46], [-6, -36]]); fillInk(x, grad(x, -6, 0, 6, 0, [M[0], M[1], M[2]]));
      shadow(x, false);
      x.beginPath(); x.moveTo(0, 14); x.lineTo(0, -38); x.lineWidth = 1.4; x.strokeStyle = 'rgba(40,40,50,0.6)'; x.stroke();
      shine(x, -3.5, 14, -3.5, -34);
      x.beginPath(); x.rect(-16, 17, 32, 6); fillInk(x, grad(x, 0, 17, 0, 23, GOLD));
      grip(x, 23, 40); pommel(x, 44);
    });
  },
  w_scimitar(x, t) {
    rot(x, 48, 54, Math.PI / 4, () => {
      const M = METALS[t];
      shadow(x, true);
      x.beginPath(); x.moveTo(-5, 16); x.lineTo(5, 16); x.bezierCurveTo(8, -4, 4, -26, 16, -44); x.bezierCurveTo(2, -30, -6, -10, -5, 16); x.closePath();
      fillInk(x, grad(x, -6, 0, 14, 0, [M[0], M[1], M[2]]));
      shadow(x, false);
      x.beginPath(); x.moveTo(-2, 12); x.bezierCurveTo(0, -6, -2, -20, 10, -38); x.lineWidth = 1.6; x.strokeStyle = 'rgba(255,255,255,0.65)'; x.stroke();
      x.beginPath(); x.ellipse(0, 18, 12, 4, 0, 0, Math.PI * 2); fillInk(x, grad(x, 0, 14, 0, 22, GOLD));
      grip(x, 21, 38); pommel(x, 41, 4.5);
    });
  },
  w_axe(x, t) {
    rot(x, 50, 52, Math.PI / 4, () => {
      const M = METALS[t];
      x.beginPath(); x.rect(-4, -40, 8, 84); fillInk(x, grad(x, -4, 0, 4, 0, WOOD));
      shadow(x, true);
      // a bearded axe head on the right of the haft: flat top, long cutting edge, the beard sweeping down
      poly(x, [[3, -38], [20, -40], [30, -34], [33, -20], [30, -6], [22, 2], [14, -10], [3, -16]]);
      fillInk(x, grad(x, 0, -40, 32, 0, [M[0], M[1], M[2]]));
      shadow(x, false);
      x.beginPath(); x.moveTo(29, -32); x.lineTo(31, -20); x.lineTo(28, -8); x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,0.7)'; x.stroke();
      for (const y of [-34, -20]) { x.beginPath(); x.arc(7, y, 1.6, 0, Math.PI * 2); x.fillStyle = '#2a2a2a'; x.fill(); }
      grip(x, 22, 40, 8);
    });
  },
  w_mace(x, t) {
    rot(x, 50, 54, Math.PI / 4, () => {
      const M = METALS[t], fM = grad(x, -14, 0, 14, 0, [M[0], M[1], M[2]]);
      grip(x, 4, 40, 7);
      x.beginPath(); x.rect(-3.5, -14, 7, 20); fillInk(x, grad(x, -3.5, 0, 3.5, 0, [M[0], M[1], M[2]]));
      shadow(x, true);
      // a flanged head seen from the side: two flanges jutting left and right, a rounded core and a cap
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 6, -40); x.bezierCurveTo(s * 20, -36, s * 20, -20, s * 6, -16); x.closePath(); fillInk(x, fM, 2); }
      x.beginPath(); x.ellipse(0, -28, 9, 15, 0, 0, Math.PI * 2); fillInk(x, fM, 2.2);
      shadow(x, false);
      x.beginPath(); x.moveTo(0, -42); x.lineTo(0, -14); x.lineWidth = 1.6; x.strokeStyle = 'rgba(20,20,30,0.5)'; x.stroke();
      x.beginPath(); x.arc(0, -45, 4, 0, Math.PI * 2); fillInk(x, grad(x, -4, -49, 4, -41, GOLD), 1.6);
      x.beginPath(); x.rect(-10, -15, 20, 4); fillInk(x, grad(x, 0, -15, 0, -11, GOLD), 1.6);
      shine(x, -4, -38, -4, -20, 0.8);
      pommel(x, 43, 4);
    });
  },
  w_hammer(x, t) {
    rot(x, 50, 54, Math.PI / 4, () => {
      const M = METALS[t];
      x.beginPath(); x.rect(-4, -30, 8, 74); fillInk(x, grad(x, -4, 0, 4, 0, WOOD));
      shadow(x, true);
      x.beginPath(); x.roundRect(-24, -46, 48, 22, 3); fillInk(x, grad(x, 0, -46, 0, -24, [M[0], M[1], M[2]]));
      shadow(x, false);
      for (const bx of [-17, 17]) { x.beginPath(); x.rect(bx - 2, -47, 4, 24); fillInk(x, grad(x, 0, -47, 0, -23, GOLD), 1.4); }
      shine(x, -20, -42, 20, -42, 0.75);
      grip(x, 24, 44, 9);
    });
  },
  w_bow(x, t) {
    rot(x, 50, 50, Math.PI / 4, () => {
      const lim = t === 3 ? ['#9ab0e0', '#3a4a7a', '#141c3a'] : t === 2 ? ['#ffe6a0', '#b07830', '#4a2a0c'] : WOOD;
      // recurve limbs bending away from the string
      x.beginPath(); x.moveTo(-3, 0); x.bezierCurveTo(-14, -18, -10, -34, -2, -46); x.bezierCurveTo(-6, -44, -10, -42, -12, -46);
      x.bezierCurveTo(-18, -30, -20, -16, -9, 0); x.closePath(); fillInk(x, grad(x, -20, 0, 0, 0, lim));
      x.beginPath(); x.moveTo(-3, 0); x.bezierCurveTo(-14, 18, -10, 34, -2, 46); x.bezierCurveTo(-6, 44, -10, 42, -12, 46);
      x.bezierCurveTo(-18, 30, -20, 16, -9, 0); x.closePath(); fillInk(x, grad(x, -20, 0, 0, 0, lim));
      x.beginPath(); x.moveTo(-4, -46); x.lineTo(-4, 46); x.lineWidth = 1.2; x.strokeStyle = '#e8e0c8'; x.stroke();
      x.beginPath(); x.roundRect(-11, -7, 7, 14, 2); fillInk(x, grad(x, -11, 0, -4, 0, LEATHER), 1.6);
      // an arrow on the string
      x.beginPath(); x.moveTo(-4, 0); x.lineTo(30, 0); x.lineWidth = 2; x.strokeStyle = '#6a4a2a'; x.stroke();
      poly(x, [[30, -3.5], [38, 0], [30, 3.5]]); fillInk(x, grad(x, 30, 0, 38, 0, METALS[1]), 1.2);
      poly(x, [[-2, 0], [4, -4], [8, -4], [4, 0], [8, 4], [4, 4]]); x.fillStyle = '#d8d0b8'; x.fill();
    });
  },
  w_rod(x, t) {
    rot(x, 50, 52, Math.PI / 4, () => {
      x.beginPath(); x.rect(-4, -30, 8, 70); fillInk(x, grad(x, -4, 0, 4, 0, GOLD));
      for (let y = -24; y < 6; y += 5) { x.beginPath(); x.ellipse(0, y, 7, 2.2, 0, 0, Math.PI * 2); fillInk(x, grad(x, -7, 0, 7, 0, ['#ffc8a0', '#c86a3a', '#5a2a10']), 1.2); }
      x.beginPath(); x.rect(-8, -36, 16, 7); fillInk(x, grad(x, 0, -36, 0, -29, METALS[1]), 1.6);
      // a glass capacitor bulb, glowing blue
      const gl = x.createRadialGradient(0, -46, 1, 0, -46, 14); gl.addColorStop(0, 'rgba(200,240,255,1)'); gl.addColorStop(0.5, 'rgba(90,170,255,0.9)'); gl.addColorStop(1, 'rgba(40,90,200,0)');
      x.fillStyle = gl; x.beginPath(); x.arc(0, -46, 14, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.ellipse(0, -45, 7, 9, 0, 0, Math.PI * 2); x.fillStyle = 'rgba(180,230,255,0.55)'; x.fill(); ink(x, 1.6);
      grip(x, 12, 30, 9); pommel(x, 43, 4);
    });
  },
  w_staff(x, t) {
    rot(x, 50, 50, Math.PI / 4, () => {
      x.beginPath(); x.moveTo(-3, 48); x.bezierCurveTo(-5, 20, 4, -10, -2, -40); x.bezierCurveTo(2, -44, 6, -44, 7, -40); x.bezierCurveTo(10, -10, 2, 20, 4, 48); x.closePath();
      fillInk(x, grad(x, -5, 0, 7, 0, WOOD));
      for (const [y, s] of [[-14, 1], [12, -1]]) { x.beginPath(); x.ellipse(1 + s, y, 4.5, 2.5, 0.4, 0, Math.PI * 2); x.fillStyle = '#5a3418'; x.fill(); }
      // leaves bound near the head
      for (const [ax, ay, r] of [[-8, -34, -0.6], [10, -30, 0.7], [-6, -24, -1.1]]) {
        rot(x, ax, ay, r, () => { x.beginPath(); x.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2); fillInk(x, grad(x, -4, 0, 4, 0, ['#b8f070', '#5aa030', '#2a5a14']), 1.4); });
      }
      x.beginPath(); x.rect(-5, -20, 12, 4); fillInk(x, grad(x, 0, -20, 0, -16, GOLD), 1.4);
    });
  },
  // a black-powder pistol seen side-on, barrel to the right: walnut stock, octagonal barrel with two bands, a solid-disc
  // hammer, an arc of trigger guard (a single pistol: never two crossed)
  w_pistol(x, t) { pistolIcon(x, t, false); },
  // ------------------------------------------------------------------ off-hands
  o_sidearm(x, t) { pistolIcon(x, t, true); },
  o_shield(x, t) {
    const M = METALS[t];
    shadow(x, true);
    x.beginPath(); x.moveTo(18, 16); x.lineTo(82, 16); x.bezierCurveTo(84, 54, 70, 76, 50, 90); x.bezierCurveTo(30, 76, 16, 54, 18, 16); x.closePath();
    fillInk(x, grad(x, 18, 16, 82, 90, [M[0], M[1], M[2]]), 3);
    shadow(x, false);
    x.beginPath(); x.moveTo(25, 22); x.lineTo(75, 22); x.bezierCurveTo(76, 54, 64, 72, 50, 82); x.bezierCurveTo(36, 72, 24, 54, 25, 22); x.closePath();
    fillInk(x, grad(x, 25, 22, 75, 82, t === 3 ? ['#5a7ad0', '#2a3a80', '#141c40'] : t === 2 ? ['#c84a3a', '#8a2a1e', '#4a120a'] : ['#4a6ab0', '#2a4280', '#122040']), 2);
    // one diagonal band and a plain boss
    x.save(); x.clip(); x.beginPath(); x.moveTo(20, 30); x.lineTo(32, 22); x.lineTo(84, 74); x.lineTo(72, 82); x.closePath(); x.fillStyle = grad(x, 20, 20, 80, 80, GOLD); x.fill(); x.restore();
    x.beginPath(); x.arc(50, 46, 9, 0, Math.PI * 2); fillInk(x, grad(x, 41, 37, 59, 55, [M[0], M[1], M[2]]), 2);
    shine(x, 22, 20, 46, 20, 0.6);
  },
  o_quiver(x) {
    rot(x, 52, 52, Math.PI / 5, () => {
      for (const ax of [-6, 0, 6]) { x.beginPath(); x.moveTo(ax, -20); x.lineTo(ax, -40); x.lineWidth = 2; x.strokeStyle = '#6a4a2a'; x.stroke(); poly(x, [[ax - 3, -38], [ax, -48], [ax + 3, -38]]); x.fillStyle = ['#e8e0c8', '#c84a3a', '#e8e0c8'][(ax + 6) / 6]; x.fill(); ink(x, 1.2); }
      shadow(x, true);
      x.beginPath(); x.roundRect(-11, -24, 22, 66, 6); fillInk(x, grad(x, -11, 0, 11, 0, LEATHER), 2.4);
      shadow(x, false);
      for (const y of [-18, 30]) { x.beginPath(); x.rect(-12, y, 24, 5); fillInk(x, grad(x, 0, y, 0, y + 5, GOLD), 1.4); }
      x.beginPath(); x.moveTo(-6, -8); x.lineTo(-6, 26); x.lineWidth = 1; x.setLineDash([2, 2]); x.strokeStyle = 'rgba(255,220,160,0.6)'; x.stroke(); x.setLineDash([]);
    });
  },
  o_bandolier(x) {
    rot(x, 50, 50, -Math.PI / 5, () => {
      x.beginPath(); x.roundRect(-46, -8, 92, 16, 4); fillInk(x, grad(x, 0, -8, 0, 8, LEATHER), 2.2);
      ['#7ad85a', '#e85a4a', '#5aa8ff'].forEach((c, i) => {
        const fx = -24 + i * 24;
        x.beginPath(); x.roundRect(fx - 6, -24, 12, 30, 5); fillInk(x, 'rgba(220,240,255,0.35)', 1.8);
        x.beginPath(); x.roundRect(fx - 5, -12, 10, 17, 4); x.fillStyle = c; x.fill();
        x.beginPath(); x.rect(fx - 4, -30, 8, 6); fillInk(x, '#8a5a2a', 1.4);
        x.beginPath(); x.moveTo(fx - 3, -20); x.lineTo(fx - 3, 0); x.lineWidth = 1.4; x.strokeStyle = 'rgba(255,255,255,0.6)'; x.stroke();
      });
      for (const fx of [-36, 36]) { x.beginPath(); x.rect(fx - 4, -9, 8, 18); fillInk(x, grad(x, 0, -9, 0, 9, GOLD), 1.2); }
    });
  },
  o_dagger(x, t) {
    rot(x, 50, 52, Math.PI / 4, () => {
      const M = METALS[t];
      shadow(x, true);
      poly(x, [[-6, 6], [6, 6], [5, -26], [0, -40], [-5, -26]]); fillInk(x, grad(x, -6, 0, 6, 0, [M[0], M[1], M[2]]));
      shadow(x, false);
      shine(x, -2.5, 4, -2.5, -28);
      x.beginPath(); x.roundRect(-14, 5, 28, 6, 3); fillInk(x, grad(x, 0, 5, 0, 11, GOLD));
      grip(x, 11, 30, 7); pommel(x, 34, 4.5);
    });
  },
  o_pouch(x) {
    shadow(x, true);
    x.beginPath(); x.moveTo(30, 36); x.bezierCurveTo(14, 50, 16, 86, 50, 88); x.bezierCurveTo(84, 86, 86, 50, 70, 36); x.closePath();
    fillInk(x, grad(x, 20, 36, 80, 88, LEATHER), 2.6);
    shadow(x, false);
    x.beginPath(); x.moveTo(30, 36); x.bezierCurveTo(40, 30, 60, 30, 70, 36); x.lineWidth = 3; x.strokeStyle = '#d8c090'; x.stroke(); ink(x, 1);
    for (const [ax, ay, r] of [[44, 22, -0.5], [56, 20, 0.5], [50, 16, 0]]) rot(x, ax, ay, r, () => { x.beginPath(); x.ellipse(0, 0, 4, 10, 0, 0, Math.PI * 2); fillInk(x, grad(x, -4, 0, 4, 0, ['#c0f080', '#5aa030', '#2a5a14']), 1.4); });
    x.beginPath(); x.moveTo(36, 56); x.bezierCurveTo(44, 62, 56, 62, 64, 56); x.lineWidth = 1.4; x.setLineDash([3, 3]); x.strokeStyle = 'rgba(255,220,170,0.7)'; x.stroke(); x.setLineDash([]);
    x.beginPath(); x.arc(50, 70, 4, 0, Math.PI * 2); fillInk(x, grad(x, 46, 66, 54, 74, GOLD), 1.4);
  },
  // ------------------------------------------------------------------ armour
  a_head(x, t, w) {
    const M = METALS[t];
    shadow(x, true);
    if (w === 'cloth') {
      x.beginPath(); x.moveTo(50, 12); x.bezierCurveTo(80, 14, 86, 50, 80, 84); x.lineTo(20, 84); x.bezierCurveTo(14, 50, 20, 14, 50, 12); x.closePath();
      fillInk(x, grad(x, 20, 12, 80, 84, [CLOTH[t], shadeHex(CLOTH[t], 0.7), shadeHex(CLOTH[t], 0.4)]), 2.6);
      shadow(x, false);
      x.beginPath(); x.ellipse(50, 56, 18, 22, 0, 0, Math.PI * 2); x.fillStyle = '#120c08'; x.fill(); ink(x, 2);
      x.beginPath(); x.moveTo(30, 84); x.bezierCurveTo(36, 74, 64, 74, 70, 84); x.lineWidth = 1.4; x.setLineDash([3, 3]); x.strokeStyle = 'rgba(255,230,190,0.6)'; x.stroke(); x.setLineDash([]);
      return;
    }
    x.beginPath(); x.moveTo(24, 82); x.lineTo(22, 40); x.bezierCurveTo(22, 14, 78, 14, 78, 40); x.lineTo(76, 82); x.closePath();
    fillInk(x, grad(x, 22, 14, 78, 82, w === 'mail' ? [shadeHex(M[1], 1.05), shadeHex(M[1], 0.7), M[2]] : [M[0], M[1], M[2]]), 2.8);
    shadow(x, false);
    if (w === 'mail') {
      x.save(); x.clip(); x.strokeStyle = 'rgba(30,30,40,0.45)'; x.lineWidth = 1; for (let y = 20; y < 84; y += 5) for (let xx = 20 + (y % 10 ? 2.5 : 0); xx < 80; xx += 5) { x.beginPath(); x.arc(xx, y, 2.2, 0, Math.PI * 2); x.stroke(); } x.restore();
      x.beginPath(); x.ellipse(50, 50, 15, 18, 0, 0, Math.PI * 2); x.fillStyle = '#100a06'; x.fill(); ink(x, 2);
    } else {
      // one horizontal visor slit (no T or cross), a brow band and rivets
      x.beginPath(); x.roundRect(28, 44, 44, 7, 3); x.fillStyle = '#0c0806'; x.fill(); ink(x, 1.6);
      x.beginPath(); x.rect(22, 34, 56, 5); fillInk(x, grad(x, 0, 34, 0, 39, GOLD), 1.4);
      for (const rx of [30, 40, 60, 70]) { x.beginPath(); x.arc(rx, 64, 1.8, 0, Math.PI * 2); x.fillStyle = '#2a2a2a'; x.fill(); }
      shine(x, 30, 22, 42, 18, 0.8);
    }
  },
  a_shoulders(x, t, w) {
    const M = METALS[t], f = w === 'cloth' ? [CLOTH[t], shadeHex(CLOTH[t], 0.7), shadeHex(CLOTH[t], 0.4)] : [M[0], M[1], M[2]];
    for (const s of [-1, 1]) {
      x.save(); x.translate(50 + s * 22, 50); x.scale(s, 1);
      shadow(x, true);
      x.beginPath(); x.moveTo(-14, -14); x.bezierCurveTo(10, -26, 24, -8, 22, 16); x.bezierCurveTo(10, 10, -6, 12, -18, 18); x.bezierCurveTo(-22, 4, -20, -8, -14, -14); x.closePath();
      fillInk(x, grad(x, -18, -20, 22, 18, f), 2.4);
      shadow(x, false);
      if (w !== 'cloth') for (const k of [0, 1]) { x.beginPath(); x.moveTo(-14 + k * 4, 2 + k * 8); x.bezierCurveTo(4, -6 + k * 8, 14, 0 + k * 8, 18, 14 + k * 4); x.lineWidth = 2.2; x.strokeStyle = 'rgba(20,14,8,0.7)'; x.stroke(); }
      else { x.beginPath(); x.moveTo(-16, 14); x.bezierCurveTo(-2, 8, 10, 10, 20, 15); x.lineWidth = 3; x.strokeStyle = '#d8c090'; x.stroke(); }
      x.beginPath(); x.arc(0, -6, 3, 0, Math.PI * 2); fillInk(x, grad(x, -3, -9, 3, -3, GOLD), 1.2);
      x.restore();
    }
  },
  a_chest(x, t, w) {
    const M = METALS[t];
    const f = w === 'cloth' ? [shadeHex(CLOTH[t], 1.2), CLOTH[t], shadeHex(CLOTH[t], 0.45)] : w === 'mail' ? [shadeHex(M[1], 1.05), shadeHex(M[1], 0.7), M[2]] : [M[0], M[1], M[2]];
    shadow(x, true);
    x.beginPath(); x.moveTo(30, 14); x.lineTo(40, 20); x.lineTo(60, 20); x.lineTo(70, 14); x.lineTo(86, 26); x.lineTo(78, 42); x.lineTo(74, 40); x.lineTo(74, 86); x.lineTo(26, 86); x.lineTo(26, 40); x.lineTo(22, 42); x.lineTo(14, 26); x.closePath();
    fillInk(x, grad(x, 14, 14, 86, 86, f), 2.8);
    shadow(x, false);
    x.save(); x.clip();
    if (w === 'mail') { x.strokeStyle = 'rgba(30,30,40,0.45)'; x.lineWidth = 1; for (let y = 20; y < 88; y += 5) for (let xx = 14 + (y % 10 ? 2.5 : 0); xx < 88; xx += 5) { x.beginPath(); x.arc(xx, y, 2.2, 0, Math.PI * 2); x.stroke(); } }
    if (w === 'plate') { x.beginPath(); x.moveTo(26, 50); x.bezierCurveTo(40, 58, 60, 58, 74, 50); x.lineWidth = 2; x.strokeStyle = 'rgba(20,14,8,0.6)'; x.stroke(); x.beginPath(); x.moveTo(26, 66); x.bezierCurveTo(40, 72, 60, 72, 74, 66); x.stroke(); shine(x, 34, 30, 44, 26, 0.8); }
    if (w === 'cloth') { for (const by of [34, 46, 58, 70]) { x.beginPath(); x.arc(50, by, 2.2, 0, Math.PI * 2); fillInk(x, grad(x, 48, by - 2, 52, by + 2, GOLD), 1); } x.beginPath(); x.moveTo(50, 22); x.lineTo(50, 86); x.lineWidth = 1.2; x.setLineDash([3, 3]); x.strokeStyle = 'rgba(255,230,190,0.5)'; x.stroke(); x.setLineDash([]); }
    x.beginPath(); x.rect(24, 78, 52, 6); x.fillStyle = grad(x, 0, 78, 0, 84, w === 'cloth' ? LEATHER : GOLD); x.fill();
    x.restore();
    x.beginPath(); x.moveTo(40, 20); x.bezierCurveTo(44, 28, 56, 28, 60, 20); x.lineWidth = 2.2; x.strokeStyle = 'rgba(12,8,4,0.9)'; x.stroke();
  },
  a_hands(x, t, w) {
    const M = METALS[t];
    const f = w === 'cloth' ? [shadeHex(CLOTH[t], 1.2), CLOTH[t], shadeHex(CLOTH[t], 0.45)] : w === 'mail' ? LEATHER : [M[0], M[1], M[2]];
    shadow(x, true);
    // a gauntlet seen from the back of the hand, fingers together
    x.beginPath(); x.moveTo(30, 88); x.lineTo(28, 60); x.bezierCurveTo(24, 46, 28, 30, 34, 22); x.lineTo(42, 18); x.lineTo(52, 16); x.lineTo(62, 18); x.lineTo(70, 24); x.bezierCurveTo(74, 36, 72, 48, 80, 52); x.bezierCurveTo(84, 58, 76, 64, 70, 60); x.lineTo(70, 88); x.closePath();
    fillInk(x, grad(x, 24, 16, 84, 88, f), 2.6);
    shadow(x, false);
    for (const fx of [40, 50, 60]) { x.beginPath(); x.moveTo(fx, 20); x.lineTo(fx + 1, 46); x.lineWidth = 1.6; x.strokeStyle = 'rgba(12,8,4,0.6)'; x.stroke(); }
    x.beginPath(); x.roundRect(26, 64, 46, 24, 4); fillInk(x, grad(x, 26, 64, 72, 88, w === 'plate' ? [M[0], M[1], M[2]] : LEATHER), 2.2);
    x.beginPath(); x.rect(26, 64, 46, 4); x.fillStyle = grad(x, 0, 64, 0, 68, GOLD); x.fill();
  },
  a_legs(x, t, w) {
    const M = METALS[t];
    const f = w === 'cloth' ? [shadeHex(CLOTH[t], 1.2), CLOTH[t], shadeHex(CLOTH[t], 0.45)] : w === 'mail' ? [shadeHex(M[1], 1.05), shadeHex(M[1], 0.7), M[2]] : [M[0], M[1], M[2]];
    shadow(x, true);
    x.beginPath(); x.moveTo(26, 12); x.lineTo(74, 12); x.lineTo(78, 88); x.lineTo(56, 88); x.lineTo(50, 40); x.lineTo(44, 88); x.lineTo(22, 88); x.closePath();
    fillInk(x, grad(x, 22, 12, 78, 88, f), 2.6);
    shadow(x, false);
    x.beginPath(); x.rect(25, 12, 50, 8); fillInk(x, grad(x, 0, 12, 0, 20, LEATHER), 1.6);
    if (w === 'plate') for (const kx of [34, 66]) { x.beginPath(); x.ellipse(kx, 54, 8, 6, 0, 0, Math.PI * 2); fillInk(x, grad(x, kx - 8, 48, kx + 8, 60, [M[0], M[1], M[2]]), 1.6); }
    if (w === 'mail') { x.save(); poly(x, [[26, 20], [74, 20], [78, 88], [56, 88], [50, 40], [44, 88], [22, 88]]); x.clip(); x.strokeStyle = 'rgba(30,30,40,0.45)'; x.lineWidth = 1; for (let y = 22; y < 88; y += 5) for (let xx = 20 + (y % 10 ? 2.5 : 0); xx < 80; xx += 5) { x.beginPath(); x.arc(xx, y, 2.2, 0, Math.PI * 2); x.stroke(); } x.restore(); }
    if (w === 'cloth') { x.beginPath(); x.moveTo(36, 22); x.lineTo(32, 86); x.moveTo(64, 22); x.lineTo(68, 86); x.lineWidth = 1.2; x.setLineDash([3, 3]); x.strokeStyle = 'rgba(255,230,190,0.5)'; x.stroke(); x.setLineDash([]); }
  },
  a_feet(x, t, w) {
    const M = METALS[t];
    const f = w === 'cloth' ? [shadeHex(CLOTH[t], 1.2), CLOTH[t], shadeHex(CLOTH[t], 0.45)] : w === 'mail' ? LEATHER : [M[0], M[1], M[2]];
    for (const [ox, oy] of [[-10, -4], [8, 6]]) {
      x.save(); x.translate(ox, oy);
      shadow(x, true);
      x.beginPath(); x.moveTo(34, 16); x.lineTo(58, 16); x.lineTo(58, 60); x.bezierCurveTo(70, 62, 84, 66, 84, 78); x.lineTo(30, 80); x.lineTo(30, 60); x.closePath();
      fillInk(x, grad(x, 30, 16, 84, 80, f), 2.6);
      shadow(x, false);
      x.beginPath(); x.rect(29, 76, 56, 6); fillInk(x, '#2a1a0c', 1.6);
      if (w === 'plate') for (const y of [30, 42]) { x.beginPath(); x.moveTo(34, y); x.lineTo(58, y); x.lineWidth = 1.8; x.strokeStyle = 'rgba(20,14,8,0.6)'; x.stroke(); }
      x.beginPath(); x.rect(33, 16, 26, 5); x.fillStyle = grad(x, 0, 16, 0, 21, GOLD); x.fill();
      x.restore();
    }
  },
  a_back(x, t) {
    shadow(x, true);
    x.beginPath(); x.moveTo(36, 14); x.lineTo(64, 14); x.bezierCurveTo(76, 40, 84, 70, 86, 90); x.bezierCurveTo(70, 84, 60, 92, 50, 86); x.bezierCurveTo(40, 92, 30, 84, 14, 90); x.bezierCurveTo(16, 70, 24, 40, 36, 14); x.closePath();
    fillInk(x, grad(x, 14, 14, 86, 90, [shadeHex(CLOTH[t], 1.25), CLOTH[t], shadeHex(CLOTH[t], 0.4)]), 2.6);
    shadow(x, false);
    for (const fx of [38, 50, 62]) { x.beginPath(); x.moveTo(fx, 20); x.bezierCurveTo(fx - 2, 50, fx + 2, 70, fx, 86); x.lineWidth = 1.6; x.strokeStyle = 'rgba(10,6,4,0.35)'; x.stroke(); }
    x.beginPath(); x.rect(34, 12, 32, 7); fillInk(x, grad(x, 0, 12, 0, 19, LEATHER), 1.6);
    x.beginPath(); x.arc(50, 15, 4.5, 0, Math.PI * 2); fillInk(x, grad(x, 46, 11, 54, 19, GOLD), 1.6);
  },
  t_trinket(x, t) {
    const M = t === 0 ? ['#ffd0a0', '#c8763a', '#5a2a10'] : t === 1 ? METALS[1] : t === 2 ? GOLD : ['#e8f4ff', '#6a8ac8', '#1a2a58'];
    // a locket on a short chain
    x.beginPath(); x.moveTo(30, 10); x.bezierCurveTo(30, 30, 70, 30, 70, 10); x.lineWidth = 2.4; x.setLineDash([3, 2]); x.strokeStyle = M[1]; x.stroke(); x.setLineDash([]);
    x.beginPath(); x.rect(46, 24, 8, 8); fillInk(x, grad(x, 46, 24, 54, 32, M), 1.4);
    shadow(x, true);
    x.beginPath(); x.ellipse(50, 58, 24, 28, 0, 0, Math.PI * 2); fillInk(x, grad(x, 26, 30, 74, 86, M), 2.8);
    shadow(x, false);
    x.beginPath(); x.ellipse(50, 58, 16, 20, 0, 0, Math.PI * 2); x.lineWidth = 2; x.strokeStyle = 'rgba(20,12,4,0.55)'; x.stroke();
    const gem = x.createRadialGradient(46, 54, 1, 50, 58, 10); gem.addColorStop(0, '#ffffff'); gem.addColorStop(0.4, ['#ff7a5a', '#7ad8ff', '#7aff9a', '#b48aff'][t]); gem.addColorStop(1, '#1a1020');
    x.beginPath(); x.ellipse(50, 58, 8, 10, 0, 0, Math.PI * 2); x.fillStyle = gem; x.fill(); ink(x, 1.6);
    shine(x, 34, 44, 40, 38, 0.8);
  },
};

const GEM_COL = { red: ['#ffb0a0', '#d83a2a', '#5a0a08'], grey: ['#f0f0f0', '#8a8a92', '#2a2a30'], green: ['#d8ffb0', '#5ac83a', '#14400a'], blue: ['#d8f0ff', '#3a8aff', '#0a1c58'], gold: ['#fff4c0', '#e8b030', '#5a3808'], amber: ['#ffe0a0', '#e88a2a', '#5a2808'] };
for (const [k, c] of Object.entries(GEM_COL)) {
  P['gem_' + k] = (x) => {
    shadow(x, true);
    x.beginPath(); x.ellipse(50, 52, 30, 26, 0, 0, Math.PI * 2); fillInk(x, grad(x, 20, 26, 80, 78, GOLD), 2.6);
    shadow(x, false);
    const g = x.createRadialGradient(42, 42, 2, 50, 52, 26); g.addColorStop(0, c[0]); g.addColorStop(0.45, c[1]); g.addColorStop(1, c[2]);
    x.beginPath(); x.ellipse(50, 52, 22, 18, 0, 0, Math.PI * 2); x.fillStyle = g; x.fill(); ink(x, 2);
    x.beginPath(); x.ellipse(42, 44, 7, 4, -0.5, 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,0.75)'; x.fill();
  };
}
function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return '#' + c((n >> 16) & 255) + c((n >> 8) & 255) + c(n & 255);
}

// a painter for an icon key, or null: 'w_sword', 'o_shield', 'a_plate_chest', 'a_back', 't_trinket', each with an optional '~tint'
export function itemPainter(key) {
  const [base, tt] = String(key).split('~');
  const tint = Math.max(0, Math.min(3, Number(tt) || 0));
  const m = /^a_(plate|mail|cloth)_(head|shoulders|chest|hands|legs|feet)$/.exec(base);
  if (m) return (x, S) => { x.save(); x.scale(S / 100, S / 100); P['a_' + m[2]](x, tint, m[1]); x.restore(); };
  if (!P[base]) return null;
  return (x, S) => { x.save(); x.scale(S / 100, S / 100); P[base](x, tint); x.restore(); };
}
// older hand-made items used plain slot names: show them with the new art
export const LEGACY_ICON = { helm: 'a_plate_head~1', cloak: 'a_back~1', shield: 'o_shield~1', sword: 'w_sword~1', head: 'a_plate_head~1', chest: 'a_plate_chest~1', legs: 'a_plate_legs~1', shoulders: 'a_plate_shoulders~1', hands: 'a_plate_hands~1', gloves: 'a_mail_hands~1', feet: 'a_mail_feet~1', boots: 'a_mail_feet~1', boot: 'a_mail_feet~0', cloak_item: 'a_back~1', back: 'a_back~1', trinket: 't_trinket~2', charm: 't_trinket~3', offhand: 'o_shield~1' };
