// =============================================================
//  settings.js — player settings (saved separately from the game,
//  so they stay the same even if you start over)
// =============================================================

const SETTINGS_KEY = 'capitalio_settings';
const SETTINGS_DEFAULT = {
  minimap: true,     // show the minimap
  night: true,       // darker nights with street lights
  floats: true,      // floating "+$9" money numbers
  tooltips: true,    // info when hovering over things
  alwaysRun: false,  // run without holding Shift
  crowd: 'normal',   // how many people walk around: calm / normal / busy
  autosave: 15,      // seconds between autosaves
};
const CROWD_LEVELS = { calm: 0.6, normal: 1, busy: 1.4 };

let Settings = loadSettings();

function loadSettings() {
  try {
    return { ...SETTINGS_DEFAULT, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch (e) { return { ...SETTINGS_DEFAULT }; }
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(Settings)); } catch (e) { /* ignore */ }
  applySettings();
}

function applySettings() {
  document.body.classList.toggle('no-minimap', !Settings.minimap);
  if (!Settings.tooltips) $('tooltip').classList.add('hidden');
}

// ---------- Backups: download / load your save as a file ----------
function exportSave() {
  saveGame();
  const blob = new Blob([localStorage.getItem(SAVE_KEY)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `capitalio-${S.name.replace(/[^a-z0-9]/gi, '_')}-${GAME_VERSION}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Save file downloaded 📥', 'good');
}

function importSave(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let s;
    try { s = JSON.parse(reader.result); } catch (e) { s = null; }
    if (!s || s.v !== 1 || !s.carts || !s.seed) { toast("That file isn't a Capital.io save", 'bad'); return; }
    if (!confirm(`Load the save for "${s.name}"? Your current game will be replaced.`)) return;
    Game.noSave = true; // stop the current game saving over it while the page reloads
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    location.reload();
  };
  reader.readAsText(file);
}
