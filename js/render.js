// =============================================================
//  render.js — draws everything on the <canvas>
// =============================================================

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
let canvas, ctx, lightCanvas, lightCtx, miniCanvas, miniCtx, miniBase;
let viewW = 0, viewH = 0, dpr = 1;

function initRenderer() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  lightCanvas = document.createElement('canvas');
  lightCtx = lightCanvas.getContext('2d');
  miniCanvas = document.getElementById('minimap');
  miniCtx = miniCanvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewW = window.innerWidth; viewH = window.innerHeight;
  canvas.width = viewW * dpr; canvas.height = viewH * dpr;
  canvas.style.width = viewW + 'px'; canvas.style.height = viewH + 'px';
  lightCanvas.width = viewW; lightCanvas.height = viewH;
}

// ---------- The static map picture (drawn once) ----------
function buildWorldCanvas() {
  const c = document.createElement('canvas');
  c.width = MAP_W * TILE; c.height = MAP_H * TILE;
  const g = c.getContext('2d');
  const rng = mulberry32(World.seed ^ 0x5bd1e995);
  const fountainTiles = new Set();
  for (const f of World.fountains) {
    const fx = f.x / TILE, fy = f.y / TILE;
    for (let y = fy - 1; y <= fy; y++) for (let x = fx - 1; x <= fx; x++) fountainTiles.add(tIdx(x, y));
  }
  const speckle = (px, py, dark, light, n = 5) => {
    for (let i = 0; i < n; i++) { g.fillStyle = rng() < 0.5 ? dark : light; g.fillRect(px + rng() * 30, py + rng() * 30, 2, 2); }
  };

  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    let t = tileAt(x, y);
    const px = x * TILE, py = y * TILE, mx = x % BLOCK, my = y % BLOCK;
    if (fountainTiles.has(tIdx(x, y))) t = T.PLAZA;
    switch (t) {
      case T.GRASS: case T.TREE: case T.FIELD: {
        const city = inCityArea(x, y) && t !== T.FIELD;
        g.fillStyle = city ? '#6bab5a' : '#8cbf62'; g.fillRect(px, py, TILE, TILE);
        speckle(px, py, city ? '#5c9a4c' : '#7aad53', city ? '#7dbb69' : '#9ccc72');
        break;
      }
      case T.ROAD: case T.CROSS: {
        g.fillStyle = '#3a3f47'; g.fillRect(px, py, TILE, TILE);
        g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(px + rng() * 28, py + rng() * 28, 4, 4);
        const horiz = my < 2 && mx >= 2, vert = mx < 2 && my >= 2;
        if (t === T.CROSS) {
          g.fillStyle = 'rgba(245,245,245,0.85)';
          for (let k = 0; k < 4; k++) {
            if (horiz) g.fillRect(px + 4, py + 2 + k * 8, TILE - 8, 4);
            else g.fillRect(px + 2 + k * 8, py + 4, 4, TILE - 8);
          }
        } else {
          g.fillStyle = '#e9c46a';
          if (horiz && my === 0) { g.fillRect(px + 3, py + TILE - 1, 11, 2); g.fillRect(px + 19, py + TILE - 1, 11, 2); }
          if (vert && mx === 0) { g.fillRect(px + TILE - 1, py + 3, 2, 11); g.fillRect(px + TILE - 1, py + 19, 2, 11); }
          g.fillStyle = 'rgba(255,255,255,0.25)';
          if (horiz && my === 0) g.fillRect(px, py + 2, TILE, 1);
          if (horiz && my === 1) g.fillRect(px, py + TILE - 3, TILE, 1);
          if (vert && mx === 0) g.fillRect(px + 2, py, 1, TILE);
          if (vert && mx === 1) g.fillRect(px + TILE - 3, py, 1, TILE);
        }
        break;
      }
      case T.DIRT: {
        g.fillStyle = '#b08d5f'; g.fillRect(px, py, TILE, TILE);
        speckle(px, py, '#9a7a4f', '#c29f70', 6);
        break;
      }
      case T.SIDEWALK: {
        g.fillStyle = '#cfc9bd'; g.fillRect(px, py, TILE, TILE);
        g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        g.fillStyle = '#9d978b';
        const isRoad = tt => tt === T.ROAD || tt === T.CROSS;
        if (isRoad(tileAt(x, y - 1))) g.fillRect(px, py, TILE, 3);
        if (isRoad(tileAt(x, y + 1))) g.fillRect(px, py + TILE - 3, TILE, 3);
        if (isRoad(tileAt(x - 1, y))) g.fillRect(px, py, 3, TILE);
        if (isRoad(tileAt(x + 1, y))) g.fillRect(px + TILE - 3, py, 3, TILE);
        break;
      }
      case T.PATH: {
        g.fillStyle = '#dcc9a0'; g.fillRect(px, py, TILE, TILE);
        speckle(px, py, '#c9b58a', '#e8d9b5', 4);
        break;
      }
      case T.PLAZA: {
        g.fillStyle = (x + y) % 2 ? '#e0d9cc' : '#d5cdbf'; g.fillRect(px, py, TILE, TILE);
        break;
      }
      case T.WATER: {
        g.fillStyle = '#4a90c9'; g.fillRect(px, py, TILE, TILE);
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
        for (let i = 0; i < 2; i++) {
          const wx = px + 6 + rng() * 16, wy = py + 8 + rng() * 16;
          g.beginPath(); g.arc(wx, wy, 4, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
        }
        g.fillStyle = 'rgba(20,60,110,0.5)';
        if (!isWaterTile(x, y - 1)) g.fillRect(px, py, TILE, 3);
        if (!isWaterTile(x - 1, y)) g.fillRect(px, py, 3, TILE);
        break;
      }
      case T.BUILDING: {
        g.fillStyle = '#a8a296'; g.fillRect(px, py, TILE, TILE);
        break;
      }
    }
  }

  // Fountains
  for (const f of World.fountains) {
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(f.x + 3, f.y + 4, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#bdb4a2'; g.beginPath(); g.arc(f.x, f.y, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5aa9e6'; g.beginPath(); g.arc(f.x, f.y, 24, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#bdb4a2'; g.beginPath(); g.arc(f.x, f.y, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8f4fd'; g.beginPath(); g.arc(f.x, f.y, 4, 0, Math.PI * 2); g.fill();
  }

  // Buildings (top-down with a little front wall so they look 3D)
  for (const b of World.buildings) {
    const brng = mulberry32((b.seedV * 1e9) | 0);
    const px = b.x * TILE + 3, py = b.y * TILE + 3, w = b.w * TILE - 6, h = b.h * TILE - 6;
    const wall = 6 + b.floors * 3;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px + 5, py + 6, w, h);
    g.fillStyle = shade(b.roof, -45); g.fillRect(px, py + h - wall, w, wall);
    for (let wx = px + 5; wx < px + w - 9; wx += 11) {
      g.fillStyle = brng() < 0.5 ? '#f3e6a8' : '#2b2d42';
      g.fillRect(wx, py + h - wall + 3, 6, Math.max(3, wall - 7));
    }
    g.fillStyle = '#3d2b1f'; g.fillRect(px + w / 2 - 5, py + h - 9, 10, 9);
    g.fillStyle = b.roof; g.fillRect(px, py, w, h - wall);
    g.strokeStyle = shade(b.roof, 30); g.lineWidth = 2; g.strokeRect(px + 2, py + 2, w - 4, h - wall - 4);
    g.strokeStyle = shade(b.roof, -20); g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, w - 1, h - wall - 1);
    for (let i = 0; i < b.acs; i++) {
      const ax = px + 8 + brng() * Math.max(1, w - 30), ay = py + 8 + brng() * Math.max(1, h - wall - 28);
      g.fillStyle = '#d9d9d9'; g.fillRect(ax, ay, 14, 11);
      g.strokeStyle = '#8a8a8a'; g.strokeRect(ax + 0.5, ay + 0.5, 13, 10);
      g.fillStyle = '#9a9a9a'; g.beginPath(); g.arc(ax + 7, ay + 5.5, 3.5, 0, Math.PI * 2); g.fill();
    }
    if (b.w * b.h >= 20 && brng() < 0.5) { // solar panels
      g.fillStyle = '#1d3557';
      for (let i = 0; i < 3; i++) g.fillRect(px + w - 24, py + 8 + i * 9, 16, 7);
    }
  }

  // Trees
  for (const t of World.trees) {
    const cx = t.x * TILE + 16 + t.ox, cy = t.y * TILE + 16 + t.oy;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx + 4, cy + 6, t.r, t.r * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = t.c; g.beginPath(); g.arc(cx, cy, t.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = shade(t.c, 22); g.beginPath(); g.arc(cx - 3, cy - 3, t.r * 0.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = shade(t.c, 45); g.beginPath(); g.arc(cx - 5, cy - 5, t.r * 0.22, 0, Math.PI * 2); g.fill();
  }

  World.canvas = c;
  buildMinimapBase();
}

function isWaterTile(x, y) { return tileAt(x, y) === T.WATER; }

function buildMinimapBase() {
  miniBase = document.createElement('canvas');
  miniBase.width = MAP_W * 2; miniBase.height = MAP_H * 2;
  miniBase.getContext('2d').drawImage(World.canvas, 0, 0, miniBase.width, miniBase.height);
}

// ---------- Little people ----------
function drawPerson(x, y, o) {
  const bob = o.moving ? Math.sin(o.anim * 12) * 1.3 : 0;
  ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + 7, 7.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  // legs
  if (o.moving) {
    const s = Math.sin(o.anim * 12) * 2.5;
    ctx.fillStyle = '#2b2d42';
    ctx.fillRect(x - 4, y + 2 + s * 0.3, 3, 5); ctx.fillRect(x + 1, y + 2 - s * 0.3, 3, 5);
  }
  ctx.fillStyle = o.shirt;
  ctx.beginPath(); ctx.ellipse(x, y + bob, 7.5, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (o.apron) { ctx.fillStyle = '#f8f9fa'; ctx.fillRect(x - 3.5, y - 2 + bob, 7, 7); }
  ctx.fillStyle = o.skin;
  ctx.beginPath(); ctx.arc(x, y - 7 + bob, 5.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = o.hair;
  ctx.beginPath(); ctx.arc(x - (o.face || 1) * 0.8, y - 8.5 + bob, 5.2, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
  if (o.hat) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 16 + bob, 10, 5); ctx.beginPath(); ctx.arc(x, y - 16 + bob, 5, Math.PI, 0); ctx.fill(); }
  ctx.globalAlpha = 1;
}

function drawBubble(x, y, emoji) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.roundRect(x - 11, y - 12, 22, 20, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 3, y + 7); ctx.lineTo(x, y + 12); ctx.lineTo(x + 3, y + 7); ctx.fill();
  ctx.font = `13px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y - 1);
}

// ---------- Carts ----------
function drawCart(c) {
  const C = CUISINES[c.cuisine];
  const cx = c.x * TILE + TILE / 2, cy = c.y * TILE + TILE / 2 + 2;
  const own = !c.rival;
  const open = c._ghost ? true : cartOpen(c);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(cx + 2, cy + 8, 17, 6, 0, 0, Math.PI * 2); ctx.fill();
  // body
  ctx.fillStyle = '#f1faee'; ctx.strokeStyle = '#6c757d'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(cx - 14, cy - 5, 28, 15, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.color; ctx.fillRect(cx - 14, cy + 4, 28, 3);
  ctx.fillStyle = '#343a40';
  ctx.beginPath(); ctx.arc(cx - 9, cy + 11, 3, 0, Math.PI * 2); ctx.arc(cx + 9, cy + 11, 3, 0, Math.PI * 2); ctx.fill();
  // dirt
  if (own && c.dirt > 8) {
    const spots = Math.floor(c.dirt / 14) + 1, r = mulberry32(c.id * 97);
    ctx.fillStyle = 'rgba(92,64,40,0.75)';
    for (let i = 0; i < spots; i++) { ctx.beginPath(); ctx.arc(cx - 12 + r() * 24, cy - 3 + r() * 11, 1.5 + r() * 2, 0, Math.PI * 2); ctx.fill(); }
  }
  // umbrella
  const ux = cx, uy = cy - 12, R = 15;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : C.color;
    ctx.beginPath(); ctx.moveTo(ux, uy); ctx.arc(ux, uy, R, i * Math.PI / 4, (i + 1) * Math.PI / 4); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ux, uy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(ux, uy, 2, 0, Math.PI * 2); ctx.fill();
  // food icon
  ctx.font = `14px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(C.emoji, cx, cy - 34);
  // status tags
  ctx.font = 'bold 9px system-ui, sans-serif';
  if (own) {
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(cx + 13, cy - 24, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b4e00'; ctx.fillText('★', cx + 13, cy - 23.5);
  }
  if (!open) tag(cx, cy + 22, own && cartPortions(c) < 1 ? 'OUT OF STOCK' : 'CLOSED', own && cartPortions(c) < 1 ? '#d62828' : '#495057');
  else if (c._queue.length) tag(cx, cy + 22, `${c._queue.length} waiting`, own ? '#2a9d8f' : '#6c757d');
  // cooking progress
  const prog = c._cleaning ? 1 - c._cleaning / 5 : c._cook;
  if (prog > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(cx - 14, cy - 44, 28, 4);
    ctx.fillStyle = c._cleaning ? '#4cc9f0' : '#ffd166'; ctx.fillRect(cx - 14, cy - 44, 28 * prog, 4);
  }
}

function tag(x, y, text, bg) {
  ctx.font = 'bold 9px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 6, w, 12, 4); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 0.5);
}

// ---------- Plots ----------
function drawPlot(P) {
  const st = S.plots[P.id];
  const px = P.x * TILE, py = P.y * TILE, w = P.w * TILE, h = P.h * TILE;
  if (!st) {
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
    ctx.strokeRect(px + 4, py + 4, w - 8, h - 8); ctx.setLineDash([]);
    // "for sale" sign
    const sx = px + w / 2, sy = py + h / 2;
    ctx.fillStyle = '#7f5539'; ctx.fillRect(sx - 1.5, sy - 4, 3, 16);
    ctx.fillStyle = '#fff8e7'; ctx.strokeStyle = '#7f5539'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(sx - 24, sy - 20, 48, 20, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9b2226'; ctx.font = 'bold 8px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('FOR SALE', sx, sy - 14.5);
    ctx.fillStyle = '#333'; ctx.fillText('$' + P.price, sx, sy - 5.5);
    return;
  }
  if (st.type === 'farm') {
    const now = Date.now();
    for (let i = 0; i < st.crops.length; i++) {
      const tx = px + (i % P.w) * TILE, ty = py + Math.floor(i / P.w) * TILE;
      ctx.fillStyle = '#6b4f35'; ctx.fillRect(tx + 1, ty + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = '#5a412b';
      for (let k = 0; k < 4; k++) ctx.fillRect(tx + 3, ty + 5 + k * 7, TILE - 6, 2);
      const cr = st.crops[i];
      if (!cr) continue;
      const p = (now - cr.t) / (GOODS[cr.c].grow * 1000);
      const ccx = tx + TILE / 2, ccy = ty + TILE / 2;
      if (p >= 1) {
        ctx.font = `18px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(GOODS[cr.c].emoji, ccx, ccy + Math.sin(Game.t * 3 + i) * 1.2);
      } else {
        ctx.strokeStyle = p < 0.5 ? '#95d5b2' : '#52b788'; ctx.lineWidth = 2;
        const hgt = 3 + p * 10;
        for (const dx of [-7, 0, 7]) {
          ctx.beginPath(); ctx.moveTo(ccx + dx, ccy + 6); ctx.lineTo(ccx + dx, ccy + 6 - hgt); ctx.stroke();
          if (p > 0.4) { ctx.beginPath(); ctx.moveTo(ccx + dx, ccy + 6 - hgt * 0.6); ctx.lineTo(ccx + dx + 4, ccy + 2 - hgt * 0.6); ctx.stroke(); }
        }
      }
    }
  } else if (st.type === 'ranch') {
    // fence
    ctx.strokeStyle = '#8b5e34'; ctx.lineWidth = 3;
    ctx.strokeRect(px + 3, py + 3, w - 6, h - 6);
    ctx.fillStyle = '#6f4518';
    for (let fx = px + 3; fx <= px + w - 3; fx += 16) { ctx.fillRect(fx - 2, py + 1, 4, 5); ctx.fillRect(fx - 2, py + h - 6, 4, 5); }
    for (let fy = py + 3; fy <= py + h - 3; fy += 16) { ctx.fillRect(px + 1, fy - 2, 5, 4); ctx.fillRect(px + w - 6, fy - 2, 5, 4); }
    // trough
    ctx.fillStyle = '#7f5539'; ctx.fillRect(px + 10, py + 10, 40, 12);
    ctx.fillStyle = '#ffd166'; ctx.fillRect(px + 12, py + 12, 36 * (st.trough / TROUGH_MAX), 8);
    ctx.font = `20px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const a of st.animals) {
      if (a._x == null) continue;
      ctx.save(); ctx.translate(a._x, a._y); if (a._face === 1) ctx.scale(-1, 1);
      ctx.fillText(ANIMALS[a.kind].emoji, 0, 0); ctx.restore();
    }
    const out = Object.values(st.output).reduce((s, v) => s + v, 0);
    if (out > 0) tag(px + w - 30, py + 16, `${out} ready`, '#2a9d8f');
  } else {
    ctx.strokeStyle = 'rgba(255,209,102,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(px + 3, py + 3, w - 6, h - 6);
    tag(px + w / 2, py + h / 2, 'YOUR LAND', '#bc6c25');
  }
  const wk = workerFor('plot', P.id);
  if (wk) drawPerson(px + w - 18, py + h - 18, { shirt: wk.shirt, skin: wk.skin, hair: wk.hair, moving: true, anim: Game.t * 0.4, hat: false });
}

function drawBuildingOverlay(b) {
  if (shopAt(b.id)) return; // shops draw themselves (shops.js)
  const owned = !!S.buildings[b.id];
  const px = b.x * TILE + 3, py = b.y * TILE + 3, w = b.w * TILE - 6;
  if (!owned && b.forRent) { tag(px + w / 2, py + 14, 'FOR RENT ' + fmtMoney(b.leasePerMin) + '/min', '#1d3557'); return; }
  if (!owned && !b.forSale) return;
  if (owned) {
    ctx.fillStyle = '#6c757d'; ctx.fillRect(px + 10, py + 6, 2, 18);
    ctx.fillStyle = '#2a9d8f'; ctx.beginPath(); ctx.moveTo(px + 12, py + 6); ctx.lineTo(px + 26, py + 11); ctx.lineTo(px + 12, py + 16); ctx.fill();
    tag(px + w / 2, py + 14, 'YOURS · +' + fmtMoney(b.rentPerMin) + '/min', '#2a9d8f');
  } else {
    tag(px + w / 2, py + 14, 'FOR SALE ' + fmtMoney(b.price), '#9b2226');
  }
}

function drawCar(c) {
  const horiz = c.lane.axis === 'x';
  const x = horiz ? c.pos : c.lane.fixed, y = horiz ? c.lane.fixed : c.pos;
  ctx.save(); ctx.translate(x, y);
  if (!horiz) ctx.rotate(Math.PI / 2);
  if (c.lane.dir < 0) ctx.rotate(Math.PI);
  const L = c.len, W = 14;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-L / 2 + 2, -W / 2 + 3, L, W);
  ctx.fillStyle = c.color; ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, 4); ctx.fill();
  ctx.fillStyle = 'rgba(30,40,60,0.8)'; ctx.fillRect(L / 2 - 10, -W / 2 + 2, 5, W - 4); ctx.fillRect(-L / 2 + 3, -W / 2 + 2, 4, W - 4);
  ctx.fillStyle = shade(c.color, 25); ctx.fillRect(-L / 2 + 8, -W / 2 + 3, L - 19, W - 6);
  ctx.fillStyle = '#fff3b0'; ctx.fillRect(L / 2 - 2, -W / 2 + 1, 2, 3); ctx.fillRect(L / 2 - 2, W / 2 - 4, 2, 3);
  ctx.restore();
}

// ---------- Day / night ----------
function darknessAt(h) {
  if (h >= 7 && h < 18) return 0;
  if (h >= 18 && h < 21) return (h - 18) / 3 * 0.65;
  if (h >= 21 || h < 5) return 0.65;
  return (7 - h) / 2 * 0.65;
}

// ---------- Main draw ----------
function render() {
  const cam = Game.cam, z = cam.zoom;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#8cbf62'; ctx.fillRect(0, 0, viewW, viewH);

  const halfW = viewW / 2 / z, halfH = viewH / 2 / z;
  cam.x = clamp(cam.x, Math.min(halfW, MAP_W * TILE / 2), Math.max(MAP_W * TILE - halfW, MAP_W * TILE / 2));
  cam.y = clamp(cam.y, Math.min(halfH, MAP_H * TILE / 2), Math.max(MAP_H * TILE - halfH, MAP_H * TILE / 2));
  const vx0 = cam.x - halfW, vy0 = cam.y - halfH, vx1 = cam.x + halfW, vy1 = cam.y + halfH;
  const onScreen = (x, y, m = 64) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

  ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (viewW / 2 - cam.x * z), dpr * (viewH / 2 - cam.y * z));
  ctx.imageSmoothingEnabled = z < 1;

  const sx = Math.max(0, Math.floor(vx0)), sy = Math.max(0, Math.floor(vy0));
  const sw = Math.min(World.canvas.width - sx, Math.ceil(vx1 - sx) + 1), sh = Math.min(World.canvas.height - sy, Math.ceil(vy1 - sy) + 1);
  if (sw > 0 && sh > 0) ctx.drawImage(World.canvas, sx, sy, sw, sh, sx, sy, sw, sh);

  for (const P of World.plots) if (onScreen(P.x * TILE + 80, P.y * TILE + 80, 120)) drawPlot(P);
  for (const b of World.buildings) if (onScreen(b.x * TILE, b.y * TILE, 300)) drawBuildingOverlay(b);
  for (const sh of S.shops) { const b = shopBuilding(sh); if (onScreen(b.x * TILE, b.y * TILE, 300)) drawShop(sh); }
  for (const c of Game.cars) {
    const x = c.lane.axis === 'x' ? c.pos : c.lane.fixed, y = c.lane.axis === 'x' ? c.lane.fixed : c.pos;
    if (onScreen(x, y)) drawCar(c);
  }

  // placement ghost
  if (UI.placement && UI.hoverTile) {
    const { x, y } = UI.hoverTile, ok = validCartSpot(x, y, UI.placement.cartId);
    ctx.fillStyle = ok ? 'rgba(80,220,120,0.35)' : 'rgba(230,60,60,0.35)';
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    ctx.globalAlpha = 0.7;
    drawCart({ cuisine: UI.placement.cuisine, x, y, rival: false, upgrades: { queue: 0 }, _queue: [], _cook: 0, dirt: 0, id: 0, stock: {}, _ghost: true, price: 0 });
    ctx.globalAlpha = 1;
  }

  // Everything that stands up is sorted by y so things overlap correctly
  const list = [];
  for (const c of allCarts()) if (onScreen(c.x * TILE, c.y * TILE)) list.push({ y: c.y * TILE + 20, f: () => drawCart(c) });
  for (const c of S.carts) {
    const w = workerFor('cart', c.id);
    if (w && onScreen(c.x * TILE, c.y * TILE)) list.push({ y: c.y * TILE + 10, f: () => drawPerson(c.x * TILE + TILE / 2 + 17, c.y * TILE + 12, { shirt: w.shirt, skin: w.skin, hair: w.hair, apron: true, hat: true, face: -1, moving: c._cook > 0, anim: Game.t }) });
  }
  for (const n of Game.npcs) if (n.state !== 'inShop' && onScreen(n.x, n.y)) list.push({ y: n.y, f: () => { drawPerson(n.x, n.y, { ...n, moving: n.path.length > 0 }); if (n.bubbleT > 0 && n.bubble) drawBubble(n.x, n.y - 26, n.bubble); } });
  const p = Game.player;
  list.push({ y: p.y, f: () => drawPlayer(p) });
  list.sort((a, b) => a.y - b.y);
  for (const it of list) it.f();

  // floating money
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of Game.floats) {
    ctx.globalAlpha = clamp(1.6 - f.t, 0, 1);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // night
  const dark = darknessAt((S.clock / 60) % 24);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (Settings.night && dark > 0.01) {
    const lc = lightCtx;
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, viewW, viewH);
    lc.fillStyle = `rgba(12,18,48,${dark})`; lc.fillRect(0, 0, viewW, viewH);
    lc.globalCompositeOperation = 'destination-out';
    const light = (wx, wy, r) => {
      const x = (wx - cam.x) * z + viewW / 2, y = (wy - cam.y) * z + viewH / 2, rr = r * z;
      if (x < -rr || y < -rr || x > viewW + rr || y > viewH + rr) return;
      const gr = lc.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = gr; lc.beginPath(); lc.arc(x, y, rr, 0, Math.PI * 2); lc.fill();
    };
    for (const l of World.lamps) light(l.x, l.y, 110);
    for (const c of allCarts()) light(c.x * TILE + 16, c.y * TILE + 10, 75);
    light(p.x, p.y, 60);
    ctx.drawImage(lightCanvas, 0, 0, viewW * dpr, viewH * dpr);
  }
}

function drawPlayer(p) {
  ctx.strokeStyle = 'rgba(255,209,102,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 7, 11, 5, 0, 0, Math.PI * 2); ctx.stroke();
  drawPerson(p.x, p.y, { shirt: '#ffb703', skin: '#f1c27d', hair: '#3d2b1f', moving: p.moving, anim: p.anim, face: p.face });
  ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3; ctx.strokeText(S.name, p.x, p.y - 22);
  ctx.fillStyle = '#ffd166'; ctx.fillText(S.name, p.x, p.y - 22);
  if (p.path.length) {
    const last = p.path[p.path.length - 1];
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(last.x * TILE + 16, last.y * TILE + 16, 6 + Math.sin(Game.t * 6) * 1.5, 0, Math.PI * 2); ctx.stroke();
  }
}

// ---------- Minimap ----------
function renderMinimap() {
  const m = miniCtx, W = miniCanvas.width, H = miniCanvas.height;
  m.clearRect(0, 0, W, H);
  m.drawImage(miniBase, 0, 0, W, H);
  const sx = W / (MAP_W * TILE), sy = H / (MAP_H * TILE);
  m.fillStyle = 'rgba(80,220,120,0.6)';
  for (const id in S.plots) { const P = World.plots[id]; m.fillRect(P.x * TILE * sx, P.y * TILE * sy, P.w * TILE * sx, P.h * TILE * sy); }
  m.fillStyle = 'rgba(42,157,143,0.9)';
  for (const id in S.buildings) { const b = World.buildings[id]; m.fillRect(b.x * TILE * sx, b.y * TILE * sy, b.w * TILE * sx, b.h * TILE * sy); }
  m.fillStyle = '#ff8c42';
  for (const sh of S.shops) { const b = shopBuilding(sh); m.fillRect(b.x * TILE * sx, b.y * TILE * sy, b.w * TILE * sx, b.h * TILE * sy); }
  for (const r of World.rivals) { m.fillStyle = '#adb5bd'; m.fillRect(r.x * TILE * sx - 1.5, r.y * TILE * sy - 1.5, 3, 3); }
  for (const c of S.carts) { m.fillStyle = '#ffd166'; m.beginPath(); m.arc((c.x + 0.5) * TILE * sx, (c.y + 0.5) * TILE * sy, 3, 0, Math.PI * 2); m.fill(); }
  const z = Game.cam.zoom;
  m.strokeStyle = 'rgba(255,255,255,0.8)'; m.lineWidth = 1;
  m.strokeRect((Game.cam.x - viewW / 2 / z) * sx, (Game.cam.y - viewH / 2 / z) * sy, viewW / z * sx, viewH / z * sy);
  m.fillStyle = '#ff006e'; m.beginPath(); m.arc(Game.player.x * sx, Game.player.y * sy, 3.5, 0, Math.PI * 2); m.fill();
  m.strokeStyle = '#fff'; m.stroke();
}
