// Entry point: asset gallery (?gallery) or the game.
const params = new URLSearchParams(location.search);

window.addEventListener('error', (e) => {
  const m = document.querySelector('#loading .msg');
  if (m) m.textContent = 'Error: ' + e.message;
});

if (params.has('gallery')) {
  const { startGallery } = await import('./gallery.js');
  startGallery();
} else {
  const { startGame } = await import('./game/game.js');
  startGame();
}
