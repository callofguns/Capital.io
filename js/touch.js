// =============================================================
//  touch.js — phone & tablet controls
//  On-screen joystick, pinch-to-zoom, swipe-down to close menus,
//  and "tap" wording instead of keyboard keys.
// =============================================================

// true on phones/tablets (a finger instead of a mouse)
const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;

// Joystick direction: dx/dy go from -1 to 1
const Joy = { id: null, cx: 0, cy: 0, dx: 0, dy: 0 };

function setupTouch() {
  document.body.classList.toggle('touch', IS_TOUCH);
  setupJoystick();
  setupPinchZoom();
  setupSwipeToClose();
  // turning the phone redraws the shop editor at the new size
  window.addEventListener('resize', () => { if (UI.editShop) renderShopEditor(); });
}

// ---------- Joystick ----------
function setupJoystick() {
  const base = $('joystick'), knob = $('joy-knob');
  const R = 42; // how far the knob can move (pixels)
  const move = e => {
    let dx = e.clientX - Joy.cx, dy = e.clientY - Joy.cy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    Joy.dx = dx / R; Joy.dy = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  base.addEventListener('pointerdown', e => {
    e.preventDefault();
    base.setPointerCapture(e.pointerId); // keep following the finger even outside the circle
    const r = base.getBoundingClientRect();
    Joy.id = e.pointerId; Joy.cx = r.left + r.width / 2; Joy.cy = r.top + r.height / 2;
    base.classList.add('active');
    move(e);
  });
  base.addEventListener('pointermove', e => { if (e.pointerId === Joy.id) move(e); });
  const end = e => {
    if (e.pointerId !== Joy.id) return;
    Joy.id = null; Joy.dx = 0; Joy.dy = 0;
    knob.style.transform = '';
    base.classList.remove('active');
  };
  base.addEventListener('pointerup', end);
  base.addEventListener('pointercancel', end);
}

// ---------- Pinch to zoom (two fingers on the map) ----------
function setupPinchZoom() {
  const fingers = new Map();
  let pinch = null;
  const spread = () => { const [a, b] = [...fingers.values()]; return dist(a.x, a.y, b.x, b.y); };
  canvas.addEventListener('pointerdown', e => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) {
      pinch = { d: spread(), z: Game.cam.zoom };
      pointerDown = null; // a pinch is not a tap, so don't walk anywhere
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && fingers.size === 2) Game.cam.zoom = clamp(pinch.z * spread() / pinch.d, 0.45, 2.2);
  });
  const lift = e => {
    fingers.delete(e.pointerId);
    if (fingers.size < 2 && pinch) { pinch = null; pointerDown = null; }
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);
}

// ---------- Swipe a menu down to close it (phones) ----------
function setupSwipeToClose() {
  const panel = $('panel'), head = panel.querySelector('.panel-head');
  let start = null;
  head.addEventListener('pointerdown', e => {
    if (!IS_TOUCH || e.target.closest('button')) return;
    start = e.clientY;
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', e => {
    if (start == null) return;
    const dy = Math.max(0, e.clientY - start);
    panel.style.transform = `translateY(${dy}px)`;
  });
  const end = e => {
    if (start == null) return;
    const dy = e.clientY - start;
    start = null;
    panel.style.transform = '';
    if (dy > 80) closePanel();
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
}

// ---------- Full screen (Android & desktop browsers) ----------
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => toast("Your browser won't let the game go full screen here", 'bad'));
}

// ---------- Words: "tap" instead of keyboard keys ----------
function controlText(s) {
  if (!IS_TOUCH) return s;
  return s
    .replace('(walk to the cart, press E)', '(walk to the cart, tap 🍳 Cook)')
    .replace('(press C at the cart)', '(tap 🧽 Clean at the cart)')
    .replace('press <kbd>E</kbd> to cook', 'tap the 🍳 <b>Cook</b> button');
}

function controlsList() {
  return IS_TOUCH
    ? `<li>🕹️ Use the joystick in the bottom-left, or just tap where you want to go</li>
       <li>🍳 Tap <b>Cook</b> at your cart to cook, and 🧽 <b>Clean</b> to scrub it</li>
       <li>🤏 Pinch with two fingers to zoom in and out</li>`
    : `<li>🚶 Walk with <kbd>WASD</kbd> or click where you want to go. Hold <kbd>Shift</kbd> to run</li>
       <li>🍳 Press <kbd>E</kbd> at your cart to cook and <kbd>C</kbd> to clean it</li>
       <li>🔍 Scroll your mouse wheel or use + and − to zoom</li>`;
}
