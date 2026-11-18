/* v26 : la lecture continue (et ne saute rien) quand l'écran s'éteint ou que l'application passe en arrière-plan.
   À charger après v25.js. Aucun format de données modifié.
   1) Voix du téléphone : v9say() passait au morceau suivant dès que le navigateur suspendait la voix (garde-fou de 6 s),
      ce qui faisait « perdre » du texte écran éteint. Ici : en arrière-plan on ne saute plus, on relance la voix
      (resume) puis, au retour, on redit le morceau en cours s'il n'a pas été lu.
   2) Commandes de lecture de l'écran verrouillé / notification (lecture, pause, stop).
   Le démarrage, la pause, la reprise et le stop restent ceux de v9.js (même V9, même lire()). */
(function () {
  'use strict';
  var ss = window.speechSynthesis;
  if (!ss || typeof window.SpeechSynthesisUtterance !== 'function' || typeof V9 === 'undefined' || typeof window.v9run !== 'function') return;

  var CFG = { base: 6000, per: 130, retries: 3 };
  var cur = null;                                           /* morceau en cours de lecture : { retry } */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* Dit un morceau. Valeur rendue : 0 = lu (ou abandonné après plusieurs échecs), 1 = interrompu (pause, stop, autre lecture). */
  function say(t, id) {
    return new Promise(function (res) {
      var done = false, to = null, gen = 0, tries = 0;
      function fin(v) { if (done) return; done = true; clearTimeout(to); if (cur && cur.id === id) cur = null; res(v); }
      function live() { return !done && id === V9.id && V9.st === 1; }
      function arm() {
        clearTimeout(to);
        to = setTimeout(function () {
          if (done) return;
          if (!live()) return fin(1);
          if (document.hidden || ss.paused) { try { ss.resume(); } catch (e) {} arm(); return; }   /* arrière-plan : on attend, on ne saute pas */
          try { ss.cancel(); } catch (e) {}                 /* la voix ne répond plus (écran allumé) : on passe au morceau suivant */
          fin(0);
        }, CFG.base + t.length * CFG.per);
      }
      function go() {
        var my = ++gen, u = new SpeechSynthesisUtterance(t);
        u.lang = 'fr-FR'; u.rate = .95;
        u.onend = function () { if (my === gen) fin(0); };
        u.onerror = function (e) {
          if (my !== gen || done) return;
          var er = e && e.error;
          if (er === 'canceled' || er === 'interrupted') return fin(1);
          if (live() && ++tries <= CFG.retries) { gen++; setTimeout(function () { if (live()) go(); }, 400); return; }
          fin(0);
        };
        window.__v9u = u;
        try { ss.speak(u); } catch (e) { fin(0); }
      }
      cur = {
        id: id,
        retry: function () {                                /* relance le même morceau (la voix a été coupée en arrière-plan) */
          if (!live()) return;
          gen++; try { ss.cancel(); } catch (e) {}
          setTimeout(function () { if (live()) { go(); arm(); } }, 80);
        },
        rearm: arm,
        stalled: function () { return live() && !ss.speaking && !ss.pending; }
      };
      go(); arm();
    });
  }

  async function nativeRun() {
    var id = V9.id;
    await sleep(80);
    while (id === V9.id && V9.st === 1 && V9.i < V9.q.length) {
      var ext = await say(V9.q[V9.i], id);
      if (id !== V9.id || V9.st !== 1) return;
      if (ext) { V9.st = 0; ui('🔊'); v9hold(0); return; }  /* interrompu par une autre lecture */
      V9.i++;
    }
    if (id === V9.id && V9.st === 1) { V9.st = 0; V9.i = 0; ui('🔊'); v9hold(0); }
  }
  window.cnNativeRun = nativeRun;                           /* v25 l'utilise pour la voix du téléphone */

  /* Retour au premier plan : si la voix a été coupée pendant que l'écran était éteint, on redit le morceau en cours. */
  function back() {
    try {
      if (document.hidden || V9.st !== 1) return;
      try {                                                 /* voix naturelle : le système a mis le son en pause pendant que l'écran était éteint */
        var n = window.cnNeural, c = n && n.state.cur, a = n && n.audio && n.audio();
        if (c && c.playing && a && a.paused && !a.ended) { var pr = a.play(); if (pr && pr.catch) pr.catch(function () {}); }
      } catch (e) {}
      if (!cur) return;
      if (ss.paused) { try { ss.resume(); } catch (e) {} }
      cur.rearm();                                          /* laisse le temps de vérifier avant tout garde-fou */
      setTimeout(function () { try { if (cur && !document.hidden && cur.stalled()) cur.retry(); } catch (e) {} }, 400);
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', back);
  window.addEventListener('pageshow', back);
  window.addEventListener('focus', back);

  /* Commandes de l'écran verrouillé */
  try {
    var ms = navigator.mediaSession;
    if (ms && ms.setActionHandler) {
      var h = function (n, f) { try { ms.setActionHandler(n, f); } catch (e) {} };
      h('play', function () { try { if (V9.st === 2) (window.cnToggle || window.lire)(); } catch (e) {} });
      h('pause', function () { try { if (V9.st === 1) window.lire(); } catch (e) {} });
      h('stop', function () { try { if (V9.st !== 0 && typeof stopL === 'function') stopL(); } catch (e) {} });
    }
  } catch (e) {}

  window.cnNative = { cfg: CFG };
})();
