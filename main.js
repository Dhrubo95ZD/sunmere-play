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
  // (21 Nov) right after an update a browser can still hold old copies of some files that point to files the update
  // removed: the import then fails. Reload once, asking the browser to fetch everything fresh.
  let mod;
  try { mod = await import('./game/game.js'); } catch (e) {
    let tried = false; try { tried = sessionStorage.getItem('sunmere:freshload') === '1'; sessionStorage.setItem('sunmere:freshload', '1'); } catch {}
    if (!tried) {
      try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch {}
      const u = new URL(location.href); u.searchParams.set('fresh', Date.now().toString(36)); location.replace(u.toString());
      await new Promise(() => {}); // wait for the reload
    }
    throw e;
  }
  try { sessionStorage.removeItem('sunmere:freshload'); } catch {}
  mod.startGame();
}
