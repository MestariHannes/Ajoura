'use strict';
// AJOURA moved to https://ajoura-app.github.io/ on 19 October 2026. Every page at this old address loads this script.
// Data saved in a browser belongs to its address, so the first visit packs this device's AJOURA data (localStorage keys
// and the IndexedDB 'ajoura' store), gzips it and hands it to the new address's siirto.html in the URL fragment, in
// pieces when it is large (siirto.html sends the browser back here for the next piece). Nothing is deleted here.
(() => {
  const NEW = 'https://ajoura-app.github.io/';
  const PIECE = 500000;
  const SKIP = ['ajoura-session', 'ajoura-sync-base', 'ajoura-synced-at', 'ajoura-muutettu'];
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const lang = (() => { const l = get('ajoura-lang'); return l === 'sv' || l === 'en' ? l : 'fi'; })();
  const T = {
    fi: { moving: 'AJOURA on muuttanut uuteen osoitteeseen. Siirretään tietojasi…', ios: 'AJOURA on muuttanut uuteen osoitteeseen',
      iosSteps: ['Tallenna varmuuskopio alla olevasta napista.', 'Avaa Safarissa ajoura-app.github.io ja lisää se Koti-valikkoon.', 'Valitse uudessa sovelluksessa Minä → Palauta varmuuskopio.'],
      iosLogin: 'Jos olet kirjautunut, riittää että kirjaudut uudessa osoitteessa.', save: 'Tallenna varmuuskopio', go: 'Avaa uusi osoite', fail: 'Siirto ei onnistunut. Tallenna varmuuskopio ja palauta se uudessa osoitteessa.' },
    sv: { moving: 'AJOURA har flyttat till en ny adress. Dina uppgifter flyttas…', ios: 'AJOURA har flyttat till en ny adress',
      iosSteps: ['Spara en säkerhetskopia med knappen nedan.', 'Öppna ajoura-app.github.io i Safari och lägg till den på hemskärmen.', 'Välj Jag → Återställ säkerhetskopia i den nya appen.'],
      iosLogin: 'Om du är inloggad räcker det att logga in på den nya adressen.', save: 'Spara säkerhetskopia', go: 'Öppna den nya adressen', fail: 'Flytten misslyckades. Spara en säkerhetskopia och återställ den på den nya adressen.' },
    en: { moving: 'AJOURA has moved to a new address. Moving your data…', ios: 'AJOURA has moved to a new address',
      iosSteps: ['Save a backup with the button below.', 'Open ajoura-app.github.io in Safari and add it to your Home Screen.', 'In the new app choose Me → Restore backup.'],
      iosLogin: 'If you are signed in, just sign in at the new address.', save: 'Save backup', go: 'Open the new address', fail: 'The move did not work. Save a backup and restore it at the new address.' }
  }[lang];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const out = document.getElementById('muutto');
  const show = html => { if (out) out.innerHTML = html; };
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };

  // Where to land at the new address: the same page, query and hash (history links for buyers keep working).
  const page = location.pathname.replace(/^.*\/Ajoura\//i, '').replace(/^.*\//, '');
  const hash = location.hash;
  const continuing = /^#ajoura-muutto=([a-z0-9]{8,24})\.(\d{1,3})$/.exec(hash);
  if (hash === '#ajoura-muutto-uudelleen') set('ajoura-muutettu', null);
  const keepHash = continuing || /^#ajoura-muutto/.test(hash) ? '' : hash;
  const to = continuing ? (get('ajoura-muutto-to') || 'app.html') : page + location.search + keepHash;
  const forward = () => location.replace(NEW + to);

  // The old service worker cached this site; drop it so the old pages are not served from the cache again.
  try { if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {}); } catch (e) {}
  try { if (window.caches) caches.keys().then(ks => ks.filter(k => k.startsWith('ajoura-pwa-')).forEach(k => caches.delete(k))).catch(() => {}); } catch (e) {}

  const readIdb = () => new Promise(ok => {
    let r; try { r = indexedDB.open('ajoura', 1); } catch (e) { ok({}); return; }
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onerror = () => ok({});
    r.onsuccess = () => {
      const db = r.result, kv = {};
      try {
        const t = db.transaction('kv', 'readonly'), s = t.objectStore('kv'), c = s.openCursor();
        c.onsuccess = () => { const cur = c.result; if (cur) { kv[String(cur.key)] = cur.value; cur.continue(); } };
        t.oncomplete = () => { db.close(); ok(kv); };
        t.onerror = t.onabort = () => { db.close(); ok({}); };
      } catch (e) { db.close(); ok({}); }
    };
  });

  async function gather() {
    const ls = {};
    try { Object.keys(localStorage).sort().forEach(k => { if (/^ajoura-/.test(k) && !SKIP.includes(k) && k !== 'ajoura-muutto-to') ls[k] = localStorage.getItem(k); }); } catch (e) {}
    const kv = await readIdb();
    return { v: 1, ls, kv };
  }
  const hasData = pack => Object.keys(pack.kv).length > 0 || Object.keys(pack.ls).some(k => k !== 'ajoura-lang' && k !== 'ajoura-device');

  async function encode(pack) {
    const bytes = new TextEncoder().encode(JSON.stringify(pack));
    let z = false, data = bytes;
    if (window.CompressionStream) {
      try { data = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); z = true; } catch (e) { data = bytes; z = false; }
    }
    let bin = ''; for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
    return { z, s: btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
  }

  async function send(pack, id, i) {
    const { z, s } = await encode(pack);
    const n = Math.max(1, Math.ceil(s.length / PIECE));
    if (i >= n) throw new Error('piece');
    if (i === n - 1) set('ajoura-muutettu', String(Date.now()));
    const q = new URLSearchParams({ id, i: String(i), n: String(n), h: fnv(s), z: z ? '1' : '0', l: lang, to });
    location.replace(`${NEW}siirto.html#${q.toString()}&d=${s.slice(i * PIECE, (i + 1) * PIECE)}`);
  }

  // A backup file in the app's own format (Minä → Palauta varmuuskopio reads it).
  function backupFile(pack) {
    let g = pack.kv['ajoura-app-v2'];
    if (!g) try { g = JSON.parse(pack.ls['ajoura-app-v2'] || 'null'); } catch (e) { g = null; }
    if (!g || !Array.isArray(g.cars)) return null;
    return JSON.stringify({ app: 'AJOURA', version: 1, saved: new Date().toISOString(), cars: g.cars, profile: g.profile }, null, 1);
  }

  function iosScreen(pack, note) {
    const file = backupFile(pack);
    show(`<h1>${esc(T.ios)}</h1>${note ? `<p>${esc(note)}</p>` : ''}<ol>${T.iosSteps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p>${esc(T.iosLogin)}</p>
      ${file ? `<p><button class="btn" data-save>${esc(T.save)}</button></p>` : ''}<p><a class="btn ghost" href="${NEW}app.html">${esc(T.go)}</a></p>`);
    if (file && out) out.addEventListener('click', ev => {
      if (!ev.target.closest('[data-save]')) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
      a.download = 'ajoura-varmuuskopio-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove();
    });
  }

  async function run() {
    if (!continuing && get('ajoura-muutettu')) { forward(); return; }
    const pack = await gather();
    if (!hasData(pack)) { forward(); return; }
    // An iPhone home-screen app keeps its own storage, apart from Safari, so the data travels as a backup file there.
    if (!continuing && navigator.standalone === true) { iosScreen(pack); return; }
    show(`<h1>${esc(T.moving)}</h1>`);
    let id, i;
    if (continuing) { id = continuing[1]; i = Number(continuing[2]); }
    else { id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); i = 0; set('ajoura-muutto-to', to); }
    await send(pack, id, i);
  }
  run().catch(async () => { try { iosScreen(await gather(), T.fail); } catch (e) { forward(); } });
})();
