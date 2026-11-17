/* v25 : voix « naturelle » (Piper, synthèse neuronale locale) RÉSERVÉE AUX ADMINISTRATEURS, avec bascule automatique
   sur la voix du téléphone (v24) en cas de problème, puis retour automatique quand tout refonctionne.
   À charger après v24.js. Aucun format de données modifié.
   Principe : on n'enveloppe que la boucle de lecture v9run() (page et notes complémentaires).
   Pause, reprise et stop gardent la logique de v9.js ; on ajoute seulement des crochets sur speechSynthesis.cancel().
   Les lecteurs PDF/Word (v8) et examens (v13) gardent la voix du téléphone.
   Le texte lu ne quitte JAMAIS l'appareil : seuls les fichiers de la bibliothèque et de la voix sont téléchargés (jsDelivr, Hugging Face). */
(function () {
  'use strict';
  var ss = window.speechSynthesis;
  if (!ss || typeof window.v9run !== 'function' || typeof V9 === 'undefined') return;

  var CFG = {
    voice: 'fr_FR-siwis-medium',
    lib: 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/dist/piper-tts-web.js',
    ort: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.min.mjs',
    firstMs: 60000,   /* délai max avant le premier son (chargement + création de la session + 1re phrase) */
    nextMs: 30000,    /* délai max pour chaque morceau suivant */
    coolMin: 120000,  /* après un problème : 2 min, puis 4, 8… */
    coolMax: 900000,  /* … jusqu'à 15 min */
    first: 70,        /* 1er morceau court : le son démarre plus vite */
    max: 130,         /* taille max des autres morceaux (caractères) */
    ahead: 2          /* morceaux calculés d'avance pendant la lecture */
  };
  var INST = 'cn_neural_inst', ON = 'cn_neural_on', RATE = 'cn_neural_rate';

  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function noop() {}
  function admin() { try { return typeof D !== 'undefined' && !!(D && D.adm); } catch (e) { return false; } }
  function rate() { var r = parseFloat(lsGet(RATE)); return (r >= .7 && r <= 1.2) ? r : .9; }
  function canNeural() {
    try { return admin() && lsGet(INST) === '1' && lsGet(ON) !== '0' && Date.now() >= NS.until && typeof WebAssembly === 'object'; }
    catch (e) { return false; }
  }

  /* ---------- État ---------- */
  var E = { tts: null, libP: null, session: null, sessP: null, mapped: false, ortBase: '' };
  var NS = { fails: 0, until: 0, why: '', told: 0 };            /* problème en cours (voix du téléphone) */
  var S = { epoch: 0, cache: new Map(), q: Promise.resolve(), cur: null, held: false, wake: null };
  var A = null;

  function noteFail(err) {
    NS.fails++; NS.why = String((err && err.message) || err || 'erreur').slice(0, 90);
    var wait = Math.min(CFG.coolMax, CFG.coolMin * Math.pow(2, NS.fails - 1));
    NS.until = Date.now() + wait;
    try { console.warn('[v25] voix naturelle suspendue :', NS.why); } catch (e) {}
    if (Date.now() - NS.told > wait) { NS.told = Date.now(); try { toast('Voix naturelle indisponible : voix du téléphone utilisée.'); } catch (e) {} }
  }
  function okAgain() { NS.fails = 0; NS.until = 0; NS.why = ''; }
  window.addEventListener('online', function () { if (NS.fails) NS.until = 0; });   /* le réseau revient : on réessaie */

  /* ---------- Découpage en petits morceaux (le 1er est court pour démarrer vite) ---------- */
  function cut(s, lim) {
    var best = -1, res = [/[.!?…]["»”)]?\s/g, /[;:]\s/g, /,\s/g];
    for (var r = 0; r < res.length && best < 0; r++) {
      var re = res[r], m, last = -1; re.lastIndex = 0;
      while ((m = re.exec(s)) && m.index < lim) last = m.index + m[0].length;
      if (last >= Math.min(30, lim * .4)) best = last;
    }
    if (best < 0) { best = s.lastIndexOf(' ', lim); if (best < 20) best = lim; }
    return best;
  }
  function split(t, firstMax, max) {
    var out = [], s = String(t || '').replace(/\s+/g, ' ').trim(), lim = firstMax;
    while (s.length > lim) { var k = cut(s, lim); out.push(s.slice(0, k).trim()); s = s.slice(k).trim(); lim = max; }
    if (s) out.push(s);
    return out.filter(function (x) { return /[\p{L}\p{N}]/u.test(x); });
  }
  function pcs(i) { return split(V9.q[i], i === 0 ? CFG.first : CFG.max, CFG.max); }

  /* ---------- Chargement de la bibliothèque et de la voix ---------- */
  function loadLibs() {
    if (E.tts) return Promise.resolve(E.tts);
    if (E.libP) return E.libP;
    E.libP = new Promise(function (res, rej) {
      try {
        if (!E.mapped) {
          var im = document.createElement('script'); im.type = 'importmap';
          im.textContent = JSON.stringify({ imports: { 'onnxruntime-web': CFG.ort } });
          document.head.appendChild(im); E.mapped = true;
        }
        E.ortBase = CFG.ort.replace(/[^\/]*$/, '');
        import(CFG.lib).then(res, rej);
      } catch (e) { rej(e); }
    }).then(function (m) { E.tts = m; return m; });
    E.libP.catch(function () { E.libP = null; });
    return E.libP;
  }
  function engine() {
    if (E.session) return Promise.resolve(E.session);
    if (E.sessP) return E.sessP;
    E.sessP = loadLibs().then(function (t) {
      return t.stored().then(function (st) {
        if (!st || st.indexOf(CFG.voice) < 0) { lsSet(INST, ''); throw new Error('voix non installée'); }
        var d = (t.TtsSession && t.TtsSession.WASM_LOCATIONS) || {};
        return t.TtsSession.create({ voiceId: CFG.voice, wasmPaths: { onnxWasm: E.ortBase, piperData: d.piperData, piperWasm: d.piperWasm }, logger: noop, progress: noop });
      });
    }).then(function (s) { E.session = s; return s; });
    E.sessP.catch(function () { E.sessP = null; });
    return E.sessP;
  }
  function resetEngine() { S.epoch++; S.q = Promise.resolve(); S.cache.clear(); E.session = null; E.sessP = null; }

  /* Synthèse d'un morceau : file unique (un seul calcul à la fois), résultat gardé en mémoire (relecture sans recalcul). */
  function want(text) {
    var hit = S.cache.get(text); if (hit) return hit;
    var ep = S.epoch;
    var pr = S.q.then(function () {
      if (ep !== S.epoch) throw new Error('annulé');
      return engine().then(function (s) { return s.predict(text); });
    }).then(function (b) {
      if (!b || !(b.size > 1000)) throw new Error('audio vide');
      return b;
    });
    S.q = pr.catch(noop);
    S.cache.set(text, pr);
    pr.catch(function () { if (S.cache.get(text) === pr) S.cache.delete(text); });
    if (S.cache.size > 80) { var n = 0; S.cache.forEach(function (v, k) { if (n++ < 20) S.cache.delete(k); }); }
    return pr;
  }
  function prefetch(i, p, n) {
    var k = 0;
    while (k < n && i < V9.q.length) {
      var ps = pcs(i);
      if (p < ps.length) { want(ps[p]); k++; p++; } else { i++; p = 0; }
    }
  }
  function withTimeout(p, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error('délai dépassé')); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }

  /* ---------- Lecture audio ---------- */
  function audio() {
    if (!A) { A = new Audio(); A.preload = 'auto'; try { A.preservesPitch = true; } catch (e) {} }
    return A;
  }
  /* Safari/iPhone : l'élément audio doit être activé pendant le geste (le tap). Fichier silencieux fabriqué à la volée. */
  function unlock() {
    var n = 400, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    function w(o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
    var a = audio(); a.src = URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
    var pr = a.play(); if (pr && pr.catch) pr.catch(noop);
  }
  function release(c) { if (c && c.url) { try { URL.revokeObjectURL(c.url); } catch (e) {} c.url = null; } }

  function playOne(blob, resume) {
    var a = audio();
    return new Promise(function (res) {
      var done = false, c = S.cur;
      function fin(r) {
        if (done) return; done = true; a.onended = a.onerror = null; S.wake = null;
        if (r !== 'wake') { if (c) c.playing = false; release(c); }
        res(r);
      }
      if (!resume) { c.url = URL.createObjectURL(blob); a.src = c.url; }
      try { a.defaultPlaybackRate = rate(); a.playbackRate = rate(); } catch (e) {}
      c.playing = true;
      a.onended = function () { fin('end'); };
      a.onerror = function () { fin('error'); };
      S.wake = function () { fin('wake'); };
      var pr = a.play(); if (pr && pr.catch) pr.catch(function () { if (!done) fin('error'); });
    });
  }

  /* Arrêt complet du son naturel (stop, nouvelle lecture) */
  function discard() {
    S.epoch++;
    var c = S.cur; S.cur = null; S.held = false;
    if (S.wake) S.wake();
    try { if (A) A.pause(); } catch (e) {}
    release(c);
  }

  /* Crochet : v9.js appelle speechSynthesis.cancel() pour la pause (V9.st==2), le stop et le démarrage d'une nouvelle lecture. */
  var cancel0 = ss.cancel.bind(ss);
  ss.cancel = function () {
    try {
      if (S.cur) {
        if (V9.st === 2) {                                   /* PAUSE : on garde la position exacte dans le morceau */
          S.held = !!S.cur.playing;
          if (S.wake) S.wake();
          try { if (A) A.pause(); } catch (e) {}
        } else discard();                                    /* STOP ou nouvelle lecture */
      }
    } catch (e) {}
    return cancel0.apply(ss, arguments);
  };

  /* ---------- Boucle de lecture (remplace v9run pour les administrateurs) ---------- */
  var run0 = window.v9run;
  /* Voix du téléphone : boucle de v26 (ne saute rien en arrière-plan) si présente, sinon celle de v9.js */
  function nat() { return (typeof window.cnNativeRun === 'function' ? window.cnNativeRun : run0).apply(window, arguments); }

  function fallback(i, ps, p, err) {
    noteFail(err);
    var rest = ps.slice(p).join(' ');
    if (rest && i < V9.q.length) V9.q[i] = rest;             /* la voix du téléphone reprend exactement ici, sans répéter ni sauter */
    var c = S.cur; S.cur = null; S.held = false; release(c);
    try { if (A) A.pause(); } catch (e) {}
    resetEngine();
    return nat();
  }

  async function neuralRun() {
    var id = V9.id, startP = 0, resume = false, c0 = S.cur;
    if (c0 && c0.q === V9.q && c0.i === V9.i) { startP = c0.p; resume = S.held; }      /* reprise après pause */
    else if (c0) { discard(); }
    S.held = false;
    if (!E.session && !resume) { try { toast('Préparation de la voix naturelle…'); } catch (e) {} }
    while (id === V9.id && V9.st === 1 && V9.i < V9.q.length) {
      var i = V9.i, ps = pcs(i);
      for (var p = startP; p < ps.length; p++) {
        startP = 0;
        S.cur = { q: V9.q, i: i, p: p, playing: false, url: null };
        var blob = null;
        if (!resume) {
          prefetch(i, p, CFG.ahead + 1);
          try { blob = await withTimeout(want(ps[p]), E.session ? CFG.nextMs : CFG.firstMs); }
          catch (e) { if (id !== V9.id || V9.st !== 1) return; return fallback(i, ps, p, e); }
          if (id !== V9.id || V9.st !== 1) return;
        }
        var r = await playOne(blob, resume); resume = false;
        if (id !== V9.id || V9.st !== 1) return;             /* pause ou stop : déjà géré par le crochet */
        if (r === 'error') return fallback(i, ps, p, new Error('lecture audio impossible'));
        if (NS.fails) okAgain();
      }
      V9.i++;
    }
    S.cur = null;
    if (id === V9.id && V9.st === 1) { V9.st = 0; V9.i = 0; ui('🔊'); v9hold(0); }
  }

  window.v9run = function () {
    var id = V9.id;
    try {
      if (canNeural()) {
        return neuralRun().catch(function (e) {
          if (id !== V9.id || V9.st !== 1) return;
          try { noteFail(e); var c = S.cur; S.cur = null; S.held = false; release(c); resetEngine(); } catch (x) {}
          return nat();
        });
      }
    } catch (e) {}
    try { if (S.cur) discard(); } catch (e) {}              /* voix naturelle indisponible : on repart sur la voix du téléphone */
    return run0.apply(this, arguments);
  };

  /* Activation audio pendant le tap (iPhone) : seulement au DÉMARRAGE (pas pour pause/reprise, qui garderaient la position) */
  ['lire', 'cpv'].forEach(function (nm) {
    var f0 = window[nm]; if (typeof f0 !== 'function') return;
    window[nm] = function () { try { if (V9.st === 0 && canNeural()) unlock(); } catch (e) {} return f0.apply(this, arguments); };
  });

  /* ---------- Installation, test, suppression ---------- */
  function install(say) {
    return loadLibs().then(function (t) {
      say('Téléchargement de la voix…');
      return t.download(CFG.voice, function (p) { if (p && p.total) say('Téléchargement de la voix… ' + Math.round(p.loaded * 100 / p.total) + ' %'); });
    }).then(function () { say('Préparation du moteur (quelques secondes)…'); E.session = null; E.sessP = null; return engine(); })
      .then(function (s) { say('Test de la voix…'); return s.predict('Bonjour.'); })
      .then(function (b) { if (!b || !(b.size > 1000)) throw new Error('audio vide'); lsSet(INST, '1'); okAgain(); });
  }
  function sample() {
    return want('Bonjour, voici la voix naturelle du cahier numérique.').then(function (b) {
      try { if (typeof stopL === 'function') stopL(); } catch (e) {}
      discard();
      var a = audio(); var u = URL.createObjectURL(b); a.src = u;
      try { a.playbackRate = rate(); } catch (e) {}
      a.onended = function () { try { URL.revokeObjectURL(u); } catch (e) {} };
      return a.play();
    });
  }

  /* ---------- Panneau de réglages (administrateurs) ---------- */
  function hhmm(t) { try { return new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function statusText() {
    if (lsGet(INST) !== '1') return 'Non installée sur cet appareil. Le téléchargement pèse plusieurs dizaines de Mo : utilisez le Wi‑Fi si possible.';
    if (lsGet(ON) === '0') return 'Désactivée : la voix du téléphone est utilisée.';
    if (NS.until > Date.now()) return 'Suspendue après un problème (' + NS.why + '). La voix du téléphone est utilisée. Nouvel essai automatique vers ' + hhmm(NS.until) + '.';
    return 'Active : la lecture des pages et des notes utilise cette voix. En cas de problème, la voix du téléphone prend le relais, puis la voix naturelle revient d’elle-même.';
  }
  function openPanel() {
    var old = document.getElementById('v25o'); if (old) old.remove();
    var o = document.createElement('div'); o.id = 'v25o'; o.style.cssText = 'position:fixed;inset:0;z-index:70;background:#000a;display:flex';
    var r = rate();
    o.innerHTML = '<div class=scb><div class=drh><b style="font:800 20px system-ui">🗣 Voix naturelle</b><button id=v25x>✕</button></div><div class=f>' +
      '<p class=hint>Réservé aux administrateurs (test). Fonctionne sur l’appareil, sans envoyer vos textes.</p>' +
      '<p class=hint id=v25s></p>' +
      '<button class=p id=v25i>Installer la voix</button>' +
      '<label style="display:flex;gap:8px;align-items:center"><input type=checkbox id=v25c> Utiliser la voix naturelle pour la lecture</label>' +
      '<label>Vitesse<select id=v25r><option value=".8">Lente</option><option value=".9">Normale (recommandée)</option><option value="1">Rapide</option></select></label>' +
      '<button id=v25t>Écouter un exemple</button>' +
      '<button id=v25a>Réessayer maintenant</button>' +
      '<button id=v25d>Supprimer la voix de cet appareil</button>' +
      '<p class=hint id=v25m></p>' +
      '<p class=hint>Voix « siwis » (base de données SIWIS), licence CC BY 4.0. Moteur : Piper, onnxruntime-web.</p>' +
      '</div></div>';
    document.body.appendChild(o);
    function q(id) { return o.querySelector('#' + id); }
    function msg(t) { q('v25m').textContent = t || ''; }
    function refresh() {
      var inst = lsGet(INST) === '1';
      q('v25s').textContent = statusText();
      q('v25i').style.display = inst ? 'none' : '';
      q('v25c').parentNode.style.display = inst ? '' : 'none';
      q('v25r').parentNode.style.display = inst ? '' : 'none';
      q('v25t').style.display = inst ? '' : 'none';
      q('v25d').style.display = inst ? '' : 'none';
      q('v25a').style.display = (inst && NS.until > Date.now()) ? '' : 'none';
      q('v25c').checked = lsGet(ON) !== '0';
      q('v25r').value = String(r === .9 ? '.9' : r === .8 ? '.8' : r === 1 ? '1' : '.9');
    }
    refresh();
    var close = function () { try { if (A && !(S.cur)) A.pause(); } catch (e) {} o.remove(); };
    q('v25x').onclick = close;
    o.addEventListener('click', function (e) { if (e.target === o) close(); });
    q('v25c').onchange = function () { lsSet(ON, this.checked ? '' : '0'); refresh(); };
    q('v25r').onchange = function () { r = parseFloat(this.value) || .9; lsSet(RATE, String(r)); };
    q('v25i').onclick = function () {
      q('v25i').disabled = true; msg('Installation…');
      install(msg).then(function () { msg('Voix installée.'); refresh(); })
        .catch(function (e) { msg('Échec : ' + ((e && e.message) || e) + '. Vérifiez la connexion puis réessayez.'); })
        .then(function () { q('v25i').disabled = false; });
    };
    q('v25t').onclick = function () {
      msg('Préparation…');
      sample().then(function () { msg(''); }).catch(function (e) { msg('Impossible : ' + ((e && e.message) || e)); });
    };
    q('v25a').onclick = function () { okAgain(); refresh(); msg('Nouvel essai à la prochaine lecture.'); };
    q('v25d').onclick = function () {
      msg('Suppression…');
      (E.tts ? Promise.resolve(E.tts) : loadLibs()).then(function (t) { return t.remove(CFG.voice); })
        .catch(noop).then(function () { lsSet(INST, ''); resetEngine(); msg('Voix supprimée.'); refresh(); });
    };
  }

  var m0 = window.menu;
  if (typeof m0 === 'function') {
    window.menu = function () {
      var r = m0.apply(this, arguments);
      try {
        var b = document.querySelector('button[onclick="th()"]');
        if (b && admin() && !document.getElementById('v25m')) {
          var q = document.createElement('button'); q.id = 'v25m'; q.textContent = '🗣 Voix naturelle (administrateurs)'; q.onclick = openPanel; b.before(q);
        }
      } catch (e) {}
      return r;
    };
  }

  window.v25voix = openPanel;
  window.cnNeural = { cfg: CFG, ns: NS, state: S, engineState: E, canNeural: canNeural, split: split, install: install };
})();
