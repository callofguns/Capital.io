// =============================================================
//  install.js: "Install the game" (add it to your desktop or home screen)
//  Chrome and Edge give us an install pop-up we can open from a button.
//  Other browsers do it from their own menus, so we show the steps instead.
// =============================================================

const Install = { prompt: null };

const isInstalledApp = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches
  || matchMedia('(display-mode: minimal-ui)').matches || navigator.standalone === true;

function setupInstall() {
  // the service worker only works when the game is on a website (not when you open the file)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); // we show our own button instead
    Install.prompt = e;
    updateInstallButtons();
  });
  window.addEventListener('appinstalled', () => {
    Install.prompt = null;
    updateInstallButtons();
    toast('🎉 Installed! You can open Capital.io from your desktop, Start menu or app list now.', 'good');
  });
  $('install-btn').onclick = installGame;
  $('install-btn').textContent = IS_TOUCH ? '📲 Install the game (add it to your home screen)' : '💻 Install the game (add it to your desktop)';
  updateInstallButtons();
}

// show the button unless the game is already running as an installed app
const canOfferInstall = () => !isInstalledApp() && location.protocol !== 'file:';
function updateInstallButtons() {
  $('install-btn').classList.toggle('hidden', !canOfferInstall());
  if (UI.panelKey === 'help') renderPanel();
}

function installGame() {
  if (Install.prompt) {
    Install.prompt.prompt();
    Install.prompt.userChoice.then(() => { Install.prompt = null; updateInstallButtons(); });
    return;
  }
  showInstallSteps();
}

// which browser are you on? (only used to show the right steps)
function browserKind() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Edg\//.test(ua)) return 'edge';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua) && /Macintosh/.test(ua)) return 'safari-mac';
  return 'other';
}

function showInstallSteps() {
  const steps = {
    chrome: ['Look at the right end of the address bar (where the website link is) for a little <b>install icon</b> (a screen with an arrow). Click it, then click <b>Install</b>.',
      'No icon? Click the <b>⋮</b> menu (top right), then <b>Cast, save and share</b>, then <b>Install page as app</b>.'],
    edge: ['Click the <b>install icon</b> at the right end of the address bar, then <b>Install</b>.',
      'Or click the <b>…</b> menu (top right), then <b>Apps</b>, then <b>Install this site as an app</b>.'],
    'safari-mac': ['In the menu bar at the top of the screen, click <b>File</b>, then <b>Add to Dock</b>.', 'Capital.io shows up in your Dock and Launchpad like any other app.'],
    firefox: ["Firefox on computers can't install websites as apps. Open this page in <b>Chrome</b> or <b>Edge</b> instead, then use the install button there."],
    ios: ['Tap the <b>Share</b> button (the square with an arrow) at the bottom of Safari.', 'Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.'],
    android: ['Tap the <b>⋮</b> menu (top right).', 'Tap <b>Install app</b> or <b>Add to Home screen</b>.'],
    other: ["Look in your browser's menu for <b>Install</b>, <b>Install app</b> or <b>Add to Home Screen</b>.", 'If you can\'t find it, Chrome and Edge both support installing.'],
  }[browserKind()];
  showModal(`<div class="mg-title">💻 Install Capital.io</div>
    <p class="muted">Installing puts the game on your desktop (or home screen) like a normal app. It opens in its own window without the browser bars, and it even works without internet.</p>
    <ol class="install-steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
    <button class="btn big" onclick="closeModal()">Got it</button>`);
  $('modal').classList.add('over-title'); // the start screen sits on top of normal pop-ups
}
