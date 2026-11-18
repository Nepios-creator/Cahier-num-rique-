/* v28 : suivi de la lecture dans le texte, lecture qui continue quand on quitte la page, reprise après une coupure.
   À charger après v27.js. Aucun format de données modifié (seule la position de lecture est mémorisée sur l'appareil :
   localStorage « cn_lecture » et « cn_lecture_q »).
   1) Le passage lu est surligné dans la page (et la page défile pour le garder à l'écran). Rien n'est modifié dans le texte de la page.
   2) Quitter la page (flèche de retour) ne coupe plus la lecture. Une petite barre de commandes reste à l'écran
      (précédent, pause/reprise, suivant, stop) tant qu'on n'est pas sur la page lue.
      Appuyer sur 🔊 dans une autre page arrête la lecture en cours et lit cette page-là.
   3) La position est mémorisée : après une coupure (écran, navigateur fermé…), « Reprendre la lecture » repart du même passage. */
(function () {
  'use strict';
  if (typeof V9 === 'undefined' || typeof window.v9start !== 'function' || typeof window.lire !== 'function') return;

  var syn = window.speechSynthesis, KEY = 'cn_lecture', KQ = 'cn_lecture_q', DAY = 864e5;
  var SRC = null;                                           /* d'où vient la lecture : { pid, titre, hl, n } */

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  function pctOf(i, n) { return n ? Math.min(100, Math.round(Math.min(i, n) * 100 / n)) : 0; }

  /* ---------- Origine de la lecture ---------- */
  function titleChunks() {
    var o = [];
    try {
      [cur && cur.cours, pg && pg.chap, pg && pg.sujet].filter(Boolean).forEach(function (x) {
        x = String(x); o = o.concat(v9chunks(v9end.test(x.trim()) ? x : x.trim() + '.'));
      });
    } catch (e) {}
    return o;
  }
  var start0 = window.v9start;
  window.v9start = function (q) {
    try {
      var tc = titleChunks(), n = 0;
      if (tc.length && q.length >= tc.length && tc.every(function (c, i) { return q[i] === c; })) n = tc.length;
      SRC = { pid: (pg && pg.id) || null, titre: String((pg && (pg.sujet || pg.chap)) || (cur && cur.cours) || 'Page'), hl: !window.__v28cpv, n: window.__v28cpv ? 0 : n };
    } catch (e) { SRC = { pid: null, titre: 'Page', hl: false, n: 0 }; }
    return start0.apply(this, arguments);
  };
  var cpv0 = window.cpv;
  if (typeof cpv0 === 'function') window.cpv = function () { window.__v28cpv = 1; try { return cpv0.apply(this, arguments); } finally { window.__v28cpv = 0; } };

  /* Bascule lecture/pause d'origine (utilisée par la barre de commandes et l'écran verrouillé) */
  var lire0 = window.lire;
  window.cnToggle = lire0;
  window.lire = function () {
    try {                                                   /* 🔊 dans une autre page : on lit cette page-là */
      if (V9.st && SRC && SRC.pid && pg && pg.id !== SRC.pid && document.getElementById('ed')) window.stopL();
    } catch (e) {}
    return lire0.apply(this, arguments);
  };

  /* Quitter la page ne coupe plus la lecture (le bouton ⏹ et le démarrage d'une autre lecture, eux, l'arrêtent toujours) */
  var close0 = window.closeP;
  if (typeof close0 === 'function') window.closeP = function () {
    var keep = V9.st === 1 || V9.st === 2, s0 = window.stopL;
    if (keep) window.stopL = function () {};
    try { return close0.apply(this, arguments); } finally { if (keep) window.stopL = s0; }
  };

  /* ---------- Surlignage du passage lu ---------- */
  var HL = { q: null, ed: null, sig: '', map: null, pos: [], cur: -2, last: -1 }, lastUser = 0;
  ['touchstart', 'wheel', 'pointerdown'].forEach(function (ev) { window.addEventListener(ev, function () { lastUser = Date.now(); }, { passive: true, capture: true }); });
  var canHL = !!(window.CSS && CSS.highlights && typeof window.Highlight === 'function');
  (function () {
    var s = el('style'); s.textContent = '::highlight(v28){background-color:rgba(250,204,21,.5)}'; document.head.appendChild(s);
  })();

  function buildMap(ed) {
    var nodes = [], ni = [], no = [], txt = [];
    var w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.parentElement && n.parentElement.closest('script,style,audio,video,canvas') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var n;
    while ((n = w.nextNode())) {
      var v = n.nodeValue, k = nodes.length; nodes.push(n);
      for (var j = 0; j < v.length; j++) {
        var c = v.charAt(j);
        if (/[\s ]/.test(c)) continue;
        ni.push(k); no.push(j); txt.push(c);
      }
    }
    return { nodes: nodes, ni: ni, no: no, s: txt.join('') };
  }
  function strip(s) { return String(s).replace(/[\s ]+/g, ''); }
  function locate(i) {                                      /* retrouve le passage i dans le texte de la page (dans l'ordre) */
    var m = HL.map, k = HL.last;
    while (k < i) {
      k++;
      var c = strip(V9.q[k]), from = 0, p = null;
      for (var b = k - 1; b >= 0; b--) if (HL.pos[b]) { from = HL.pos[b][1]; break; }
      if (c && k >= SRC.n) {
        var idx = m.s.indexOf(c, from), len = c.length;
        if (idx < 0 && c.slice(-1) === '.') { len--; idx = len ? m.s.indexOf(c.slice(0, len), from) : -1; }
        if (idx >= 0) p = [idx, idx + len];
      }
      HL.pos[k] = p;
    }
    HL.last = Math.max(HL.last, i);
    return HL.pos[i];
  }
  function clearHl() { if (HL.cur !== -2) { try { if (canHL) CSS.highlights.delete('v28'); } catch (e) {} HL.cur = -2; HL.q = null; HL.ed = null; } }

  function hl(st) {
    var ed = document.getElementById('ed');
    if (!(st && SRC && SRC.hl && ed && pg && pg.id === SRC.pid && V9.q && V9.q.length)) return clearHl();
    var sig = ed.textContent.length + '|' + ed.childNodes.length;
    if (HL.q !== V9.q || HL.ed !== ed || HL.sig !== sig) { HL.q = V9.q; HL.ed = ed; HL.sig = sig; HL.map = buildMap(ed); HL.pos = []; HL.last = -1; HL.cur = -1; }
    var i = Math.min(V9.i, V9.q.length - 1);
    if (i === HL.cur) return;
    HL.cur = i;
    var p = locate(i);
    if (!p) { try { if (canHL) CSS.highlights.delete('v28'); } catch (e) {} return; }
    var m = HL.map, r = document.createRange();
    r.setStart(m.nodes[m.ni[p[0]]], m.no[p[0]]);
    r.setEnd(m.nodes[m.ni[p[1] - 1]], m.no[p[1] - 1] + 1);
    try { if (canHL) CSS.highlights.set('v28', new Highlight(r)); } catch (e) {}
    try {                                                   /* garde le passage à l'écran, sauf si on est en train de faire défiler soi-même */
      if (Date.now() - lastUser > 8000) {
        var b = r.getBoundingClientRect(), H = window.innerHeight || 700;
        if (b.top < 90 || b.bottom > H - 130) window.scrollBy({ top: b.top - H * 0.35, behavior: 'smooth' });
        var sc = ed.closest('[style*="overflow"],.scb') || null;
        if (sc && sc.scrollHeight > sc.clientHeight) { var q = sc.getBoundingClientRect(); if (b.top < q.top + 40 || b.bottom > q.bottom - 60) sc.scrollTop += b.top - q.top - q.height * 0.3; }
      }
    } catch (e) {}
  }

  /* ---------- Barre de commandes (seulement quand on n'est pas sur la page lue) ---------- */
  var bar = null, barTx = null, barBt = null;
  function btn(t, label, fn) {
    var b = el('button', 'all:unset;cursor:pointer;padding:6px 9px;font:800 18px/1 system-ui;color:#fff;-webkit-tap-highlight-color:transparent', t);
    b.setAttribute('aria-label', label); b.onclick = function (e) { try { e.stopPropagation(); fn(); } catch (x) {} }; return b;
  }
  function step(d) { try { if (window.cnLecteur) window.cnLecteur.jump(d); } catch (e) {} }
  function mini(st) {
    var away = st && SRC && !(document.getElementById('ed') && pg && pg.id === SRC.pid);
    if (!away) { if (bar) { bar.remove(); bar = null; } return; }
    if (!bar) {
      bar = el('div', 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:119;background:#1e293b;color:#fff;border-radius:999px;padding:3px 8px;box-shadow:0 6px 20px #0007;display:flex;align-items:center;gap:0;max-width:94vw');
      bar.id = 'v28b';
      barTx = el('span', 'font:700 14px/1.1 system-ui;padding:0 8px;max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap');
      barBt = btn('⏸', 'Pause ou reprise', function () { lire0(); });
      bar.appendChild(el('span', 'padding-left:6px;font-size:16px', '🔊')); bar.appendChild(barTx);
      bar.appendChild(btn('⏮', 'Passage précédent', function () { step(-1); }));
      bar.appendChild(barBt);
      bar.appendChild(btn('⏭', 'Passage suivant', function () { step(1); }));
      bar.appendChild(btn('⏹', 'Arrêter la lecture', function () { window.stopL(); }));
      document.body.appendChild(bar);
    }
    barTx.textContent = SRC.titre;
    barBt.textContent = st === 1 ? '⏸' : '▶️';
  }

  /* ---------- Mémorisation de la position et reprise ---------- */
  var saved = { q: null, key: '', was: 0 };
  function persist(st) {
    if (st && SRC) {
      if (saved.q !== V9.q) {
        saved.q = V9.q; var js = JSON.stringify(V9.q);
        if (js.length < 600000) lsSet(KQ, js); else lsSet(KQ, null);
        saved.key = '';
      }
      var k = V9.i + '|' + st;
      if (k !== saved.key) { saved.key = k; lsSet(KEY, JSON.stringify({ i: V9.i, n: V9.q.length, src: SRC, t: Date.now() })); }
    } else if (saved.was && !st && V9.i === 0) {            /* lecture terminée normalement : plus rien à reprendre */
      lsSet(KEY, null); lsSet(KQ, null); saved.q = null;
    }
    saved.was = st;
  }
  function load() {
    try {
      var s = JSON.parse(lsGet(KEY) || 'null'), q = JSON.parse(lsGet(KQ) || 'null');
      if (!s || !q || !q.length || Date.now() - s.t > 3 * DAY || !(s.i > 0 || s.i === 0 && s.n > 0)) return null;
      s.q = q; return s;
    } catch (e) { return null; }
  }
  function resume() {
    var s = load(); if (!s) return;
    try { if (typeof V8 != 'undefined' && V8.st) v8stop(); } catch (e) {}
    try { syn.cancel(); syn.resume(); } catch (e) {}
    try { if (window.cnNeural && window.cnNeural.unlock) window.cnNeural.unlock(); } catch (e) {}
    SRC = s.src || { pid: null, titre: 'Lecture', hl: false, n: 0 };
    V9.q = s.q; V9.i = Math.max(0, Math.min(s.q.length - 1, s.i)); V9.st = 1; V9.id++;
    ui('⏸'); v9hold(1); v9run();
  }
  window.cnReprendre = resume;

  var chip = null;
  function showChip() {
    try {
      if (V9.st || chip) return; var s = load(); if (!s || s.i <= 0) return;
      chip = el('div', 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:119;background:#1e293b;color:#fff;border-radius:16px;padding:8px 10px;box-shadow:0 6px 20px #0007;display:flex;align-items:center;gap:6px;max-width:94vw');
      chip.id = 'v28c';
      var go = btn('▶ Reprendre la lecture (' + pctOf(s.i, s.n) + ' %)', 'Reprendre la lecture', function () { chip.remove(); chip = null; resume(); });
      go.style.font = '700 14px/1.2 system-ui';
      chip.appendChild(go);
      chip.appendChild(btn('✕', 'Fermer', function () { chip.remove(); chip = null; }));
      document.body.appendChild(chip);
      setTimeout(function () { if (chip) { chip.remove(); chip = null; } }, 20000);
    } catch (e) {}
  }
  setTimeout(showChip, 2500);

  var menu0 = window.menu;
  if (typeof menu0 === 'function') {
    window.menu = function () {
      var r = menu0.apply(this, arguments);
      try {
        var b = document.querySelector('button[onclick="th()"]'), s = V9.st ? null : load();
        if (b && s && s.i > 0 && !document.getElementById('v28m')) {
          var q = document.createElement('button'); q.id = 'v28m'; q.textContent = '▶ Reprendre la lecture (' + pctOf(s.i, s.n) + ' %)';
          q.onclick = function () { resume(); }; b.before(q);
        }
      } catch (e) {}
      return r;
    };
  }

  /* ---------- Boucle de mise à jour ---------- */
  setInterval(function () {
    try { var st = V9.st; persist(st); mini(st); hl(st); if (st && chip) { chip.remove(); chip = null; } } catch (e) {}
  }, 400);

  window.cnSuivi = { state: function () { return { src: SRC, hl: HL }; }, resume: resume };
})();
