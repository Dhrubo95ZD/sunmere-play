// Entry point: asset gallery (?gallery) or the game.
const params = new URLSearchParams(location.search);

window.addEventListener('error', (e) => {
  const m = document.querySelector('#loading .msg');
  if (m) m.textContent = 'Error: ' + e.message;
});

// the update check (Android app, packaged Windows app): runs beside the loading, shows Update required over everything
if (!params.has('gallery')) import('./game/update.js').then((m) => m.startUpdateCheck()).catch((e) => console.warn('[update]', e));

if (params.has('gallery')) {
  const { startGallery } = await import('./gallery.js');
  startGallery();
} else {
  const { startGame } = await import('./game/game.js');
  startGame();
}
