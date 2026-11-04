// =============================================================
//  sound.js: sound effects + background music
//  All the files live in /audio (free CC0 sounds, see audio/CREDITS.md).
//
//  Browsers only allow sound after you tap or click something, so
//  nothing plays until your first tap. When the game is opened as a
//  file (double-clicking index.html) we use plain <audio> elements;
//  when it's on a website we use the Web Audio API, which is faster
//  and lets iPhones change the volume.
// =============================================================

const SFX = ['click', 'switch', 'cash', 'coin', 'coin-soft', 'success', 'done', 'scrub'];
const MUSIC = [
  { file: 'music-bossa-nova', name: 'Bossa Nova' },
  { file: 'music-feel-good-island', name: 'Feel Good Island' },
  { file: 'music-lofi-jam', name: 'Funky Lofi Jam' },
];
const LOOPS = { sizzle: 0.55, rain: 0.8, city: 0.6 }; // background loops and how loud they are
const VOLUMES = [[0.35, 'Quiet'], [0.7, 'Normal'], [1, 'Loud']];
const audioUrl = f => `audio/${f}.mp3`;

const Snd = {
  ready: false, web: false, ctx: null, master: null, bufs: {}, last: {},
  music: null, musicGain: null, musicFails: 0, track: Math.floor(Math.random() * MUSIC.length),
  loops: {}, // name -> { el, gain }
};

// ---------- Getting started (on your first tap or key press) ----------
function setupSound() {
  const unlock = () => {
    if (Snd.ready) return;
    Snd.ready = true;
    Snd.web = location.protocol !== 'file:' && !!(window.AudioContext || window.webkitAudioContext);
    if (Snd.web) {
      try {
        Snd.ctx = new (window.AudioContext || window.webkitAudioContext)();
        Snd.ctx.resume();
        for (const f of SFX) {
          fetch(audioUrl(f)).then(r => r.arrayBuffer()).then(b => Snd.ctx.decodeAudioData(b)).then(buf => { Snd.bufs[f] = buf; }).catch(() => {});
        }
      } catch (e) { Snd.web = false; }
    }
    updateMusic(); // music has to start right here, inside the tap, or iPhones block it
    updateLoops();
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  // a soft click for every button
  document.addEventListener('click', e => {
    const b = e.target.closest('button, [data-act], [data-open]');
    if (!b || b.disabled) return;
    playSound(b.classList.contains('switch') ? 'switch' : 'click', { vol: 0.7, gap: 0.04 });
  }, true);

  // pause everything when you switch to another tab or app
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (Snd.music) Snd.music.pause(); for (const k in Snd.loops) Snd.loops[k].el.pause(); }
    else { updateMusic(); updateLoops(); }
  });
}

// An <audio> element. On websites it goes through a volume knob (gain node), so iPhones can change its volume.
function makeAudio(src, loop) {
  const el = new Audio(src);
  el.loop = loop; el.preload = 'auto';
  let gain = null;
  if (Snd.web && Snd.ctx) {
    try {
      const node = Snd.ctx.createMediaElementSource(el);
      gain = Snd.ctx.createGain();
      node.connect(gain).connect(Snd.ctx.destination);
    } catch (e) { gain = null; }
  }
  return { el, gain };
}
function setVol(a, v) {
  if (a.gain) a.gain.gain.value = v; else a.el.volume = clamp(v, 0, 1);
}

// ---------- Sound effects ----------
// name: one of SFX. vol: 0..1. rate: speed/pitch. gap: don't repeat faster than this (seconds)
function playSound(name, { vol = 1, rate = 1, gap = 0.08 } = {}) {
  if (!Snd.ready || !Settings.sound || document.hidden) return;
  const now = performance.now() / 1000;
  if (Snd.last[name] && now - Snd.last[name] < gap) return;
  Snd.last[name] = now;
  const v = vol * Settings.sfxVol;
  if (Snd.web && Snd.bufs[name]) {
    const src = Snd.ctx.createBufferSource(), g = Snd.ctx.createGain();
    src.buffer = Snd.bufs[name]; src.playbackRate.value = rate; g.gain.value = v;
    src.connect(g).connect(Snd.ctx.destination);
    src.start();
  } else if (!Snd.web) {
    const a = new Audio(audioUrl(name));
    a.volume = clamp(v, 0, 1); a.playbackRate = rate;
    a.play().catch(() => {});
  }
}

// a quiet coin for sales your workers make, but only if they're on your screen
function playSaleNear(tx, ty) {
  if (dist(tx, ty, Game.player.x / TILE, Game.player.y / TILE) > 14) return;
  playSound('coin-soft', { vol: 0.5, gap: 0.35 });
}

// ---------- Music ----------
function updateMusic() {
  if (!Snd.ready) return;
  const want = Settings.music && !document.hidden;
  if (!want) { if (Snd.music) Snd.music.el.pause(); return; }
  if (!Snd.music) {
    Snd.music = makeAudio(audioUrl(MUSIC[Snd.track].file), false);
    Snd.music.el.addEventListener('ended', () => nextSong());
    // a song that can't load (for example offline) is skipped, but we stop after trying them all
    Snd.music.el.addEventListener('error', () => { if (++Snd.musicFails < MUSIC.length) nextSong(); });
    Snd.music.el.addEventListener('playing', () => { Snd.musicFails = 0; });
  }
  setVol(Snd.music, 0.6 * Settings.musicVol);
  if (Snd.music.el.paused) Snd.music.el.play().catch(() => {});
}

function nextSong() {
  Snd.track = (Snd.track + 1) % MUSIC.length;
  if (Snd.music) { Snd.music.el.pause(); Snd.music.el.src = audioUrl(MUSIC[Snd.track].file); }
  if (Settings.music && Snd.music) Snd.music.el.play().catch(() => {});
  if (UI.panelKey === 'help') renderPanel();
}

// ---------- Background loops: sizzling, rain, city noise ----------
function wantLoop(name) {
  if (!Snd.ready || !Settings.sound || document.hidden) return false;
  if (name === 'sizzle') return !!Minigame.active && Minigame.kind !== 'scrub';
  if (name === 'rain') return Game.running && typeof isRaining === 'function' && S && S.events && isRaining();
  if (name === 'city') return Game.running && Settings.citySounds;
  return false;
}

function updateLoops() {
  for (const name in LOOPS) {
    const on = wantLoop(name);
    let a = Snd.loops[name];
    if (on && !a) a = Snd.loops[name] = makeAudio(audioUrl(name), true);
    if (!a) continue;
    if (on) {
      setVol(a, LOOPS[name] * Settings.sfxVol);
      if (a.el.paused) a.el.play().catch(() => {});
    } else if (!a.el.paused) a.el.pause();
  }
}
