/* v27 : compteur de lecture à l'écran + carte de lecture sur l'écran verrouillé (progression, précédent / pause / suivant).
   À charger après v26.js. Aucun format de données modifié.
   - Bandeau bleu en haut de l'écran pendant la lecture d'une page / de notes : temps de lecture, avancement en %, ⏮ ⏯ ⏭.
   - Écran verrouillé (Media Session) : titre « Lecture · 35 % », durée de lecture, boutons précédent / suivant / pause.
   Fonctionne avec la voix du téléphone et la voix naturelle (même V9, même lire()). */
(function () {
  'use strict';
  if (typeof V9 === 'undefined' || typeof window.lire !== 'function') return;

  var el = null, tx = null, bt = null, acc = 0, last = 0, prevSt = 0, key = '', metaT = 0;
  var syn = window.speechSynthesis;

  function fmt(s) {
    s = Math.max(0, Math.floor(s / 1000));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return h ? h + ':' + p(m) + ':' + p(x) : p(m) + ':' + p(x);
  }
  function pct() { var n = (V9.q && V9.q.length) || 0; return n ? Math.min(100, Math.round(Math.min(V9.i, n) * 100 / n)) : 0; }

  function css() {
    if (document.getElementById('v27c')) return;
    var s = document.createElement('style'); s.id = 'v27c';
    s.textContent = '@keyframes v27b{50%{opacity:.25}}#v27t button{all:unset;cursor:pointer;padding:4px 8px;font:800 17px/1 system-ui;color:#fff;-webkit-tap-highlight-color:transparent}';
    document.head.appendChild(s);
  }
  function btn(txt, label, fn) {
    var b = document.createElement('button'); b.textContent = txt; b.setAttribute('aria-label', label);
    b.onclick = function (e) { try { e.stopPropagation(); fn(); } catch (x) {} };
    return b;
  }
  function build() {
    css();
    el = document.createElement('div'); el.id = 'v27t';
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);z-index:119;color:#fff;border-radius:999px;padding:4px 6px;font:800 17px/1 system-ui;font-variant-numeric:tabular-nums;box-shadow:0 6px 20px #0006;display:flex;align-items:center;gap:2px';
    tx = document.createElement('span'); tx.style.cssText = 'padding:0 6px;white-space:nowrap';
    bt = btn('⏸', 'Pause ou reprise', function () { window.lire(); });
    el.appendChild(btn('⏮', 'Passage précédent', function () { jump(-1); }));
    el.appendChild(bt); el.appendChild(tx);
    el.appendChild(btn('⏭', 'Passage suivant', function () { jump(1); }));
    document.body.appendChild(el);
  }
  function drop() { if (el) { try { el.remove(); } catch (e) {} } el = tx = bt = null; }

  /* Passage précédent / suivant (un « morceau » de la file de lecture de v9) */
  function jump(d) {
    try {
      if (!V9.st || !V9.q || !V9.q.length) return;
      var i = Math.max(0, Math.min(V9.q.length - 1, V9.i + d));
      V9.i = i;
      if (V9.st === 1) {
        V9.id++;
        try { if (syn) { syn.cancel(); syn.resume(); } } catch (e) {}
        window.v9run();
      }
      tick(true);
    } catch (e) {}
  }

  function media(st, force) {
    try {
      var ms = navigator.mediaSession; if (!ms) return;
      var k = st + '|' + V9.i + '|' + ((V9.q && V9.q.length) || 0), now = Date.now();
      if (!force && k === key && now - metaT < 10000) return;
      key = k; metaT = now;
      if (typeof MediaMetadata === 'function') {
        var album = ''; try { album = (typeof pg !== 'undefined' && pg && (pg.sujet || pg.chap)) || ''; } catch (e) {}
        ms.metadata = new MediaMetadata({
          title: 'Lecture · ' + pct() + ' %', artist: 'Cahier numérique · ' + fmt(acc), album: album,
          artwork: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }]
        });
      }
      ms.playbackState = st === 2 ? 'paused' : 'playing';
    } catch (e) {}
  }

  function tick(force) {
    try {
      var st = V9.st, now = Date.now();
      if (!st) { if (el) drop(); if (prevSt) { acc = 0; last = 0; key = ''; } prevSt = 0; return; }
      if (!prevSt) { acc = 0; last = 0; }                        /* nouvelle lecture */
      prevSt = st;
      if (st === 1 && last) acc += now - last;
      last = now;
      if (el) drop();                                            /* plus de bandeau minuteur à l'écran */
      media(st, force === true);
    } catch (e) {}
  }
  setInterval(tick, 300);

  /* Écran verrouillé : précédent / suivant (lecture, pause et stop sont déjà gérés par v26) */
  try {
    var ms = navigator.mediaSession;
    if (ms && ms.setActionHandler) {
      try { ms.setActionHandler('previoustrack', function () { jump(-1); }); } catch (e) {}
      try { ms.setActionHandler('nexttrack', function () { jump(1); }); } catch (e) {}
    }
  } catch (e) {}

  window.cnLecteur = { tick: tick, jump: jump };
})();
