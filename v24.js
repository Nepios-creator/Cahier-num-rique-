/* v24 : meilleure voix française native pour toute la lecture à voix haute.
   À charger après v23.js. Aucun format de données modifié (seul le choix de voix est mémorisé : localStorage « cn_voix »).
   Principe : on enveloppe speechSynthesis.speak() — point de passage unique de v9 (page, notes), v8 (PDF/Word) et v13 (examens).
   Le découpage en morceaux, la pause, la reprise et le stop restent ceux des fichiers existants. */
(function () {
  'use strict';
  var ss = window.speechSynthesis;
  if (!ss || typeof window.SpeechSynthesisUtterance !== 'function') return;

  var KEY = 'cn_voix', ua = navigator.userAgent || '';
  var IOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var ANDROID = /Android/i.test(ua);
  var NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy)\b/i;

  function lsGet() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function lsSet(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {} }

  /* ---------- Liste et score des voix ---------- */
  var voices = [];
  function refresh() {
    try {
      voices = (ss.getVoices() || []).filter(function (v) { return /^fr/i.test(v.lang || ''); });
    } catch (e) { voices = []; }
    return voices.length;
  }
  function score(v) {
    var s = 0, n = v.name || '', l = (v.lang || '').replace('_', '-');
    try {
      if (/^fr-FR$/i.test(l)) s += 30; else if (/^fr-(CA|BE|CH)$/i.test(l)) s += 10; else s += 5;
      if (/premium|enhanced|neural|natural|am[ée]lior/i.test(n)) s += 50;
      if (/google/i.test(n)) s += 25;
      if (ANDROID && v.localService === false) s += 20;
      if (IOS && /am[ée]lie|audrey|thomas|marie|aur[ée]lie/i.test(n)) s += 15;
      if (/compact/i.test(n)) s -= 10;
      if (NOVELTY.test(n)) s -= 40;
      if (v.default) s += 1;
    } catch (e) {}
    return s;
  }
  function ranked() { return voices.slice().sort(function (a, b) { return score(b) - score(a); }); }
  function byId(id) {
    if (!id) return null;
    for (var i = 0; i < voices.length; i++) if (voices[i].voiceURI === id || voices[i].name === id) return voices[i];
    return null;
  }
  /* Voix choisie : celle de l'utilisateur si elle existe encore, sinon la meilleure (« Automatique »). */
  function pick() { return byId(lsGet()) || ranked()[0] || null; }

  /* Chrome Android : la liste est vide au premier appel et arrive plus tard. */
  refresh();
  try { ss.addEventListener('voiceschanged', refresh); } catch (e) {}
  var tries = 0;
  (function retry() { if (voices.length || tries++ > 8) return; setTimeout(function () { refresh(); retry(); }, 400 * tries); })();

  /* ---------- Helper commun ---------- */
  function utter(text, opts) {
    var u = new SpeechSynthesisUtterance(text); opts = opts || {};
    u.lang = 'fr-FR'; u.rate = opts.rate || .95;
    try { var v = opts.voice || pick(); if (v) { u.voice = v; if (v.lang) u.lang = v.lang; } } catch (e) {}
    u.__v24 = 1; return u;
  }

  /* Point de passage unique : v9say, v8say et v13speak appellent tous speechSynthesis.speak(u). */
  try {
    var speak0 = ss.speak.bind(ss);
    ss.speak = function (u) {
      try {
        if (u && !u.__v24 && /^fr/i.test(u.lang || 'fr-FR')) {
          if (!voices.length) refresh();
          var v = pick();
          if (v) { u.voice = v; if (v.lang) u.lang = v.lang; }
        }
      } catch (e) {}
      return speak0(u);
    };
  } catch (e) {}

  window.cnVoix = { list: function () { refresh(); return ranked(); }, best: pick, utter: utter, score: score };

  /* ---------- Sélecteur dans les réglages ---------- */
  function label(v) {
    var t = v.name + ' (' + v.lang + ')';
    if (v.localService === false) t += ' · réseau';
    return t;
  }
  function open() {
    refresh();
    var cur = lsGet(), list = ranked(), old = document.getElementById('v24o'); if (old) old.remove();
    var o = document.createElement('div'); o.id = 'v24o'; o.style.cssText = 'position:fixed;inset:0;z-index:70;background:#000a;display:flex';
    var opts = '<option value="">Automatique (recommandé)</option>' + list.map(function (v) {
      return '<option value="' + esc(v.voiceURI || v.name) + '"' + ((v.voiceURI === cur || v.name === cur) ? ' selected' : '') + '>' + esc(label(v)) + '</option>';
    }).join('');
    o.innerHTML = '<div class=scb><div class=drh><b style="font:800 20px system-ui">🔊 Voix de lecture</b><button id=v24x>✕</button></div><div class=f>' +
      (list.length ? '<label>Voix<select id=v24s>' + opts + '</select></label><button class=p id=v24t>Écouter un exemple</button>' +
        '<p class=hint id=v24i></p>' : '<p class=hint>Aucune voix française n’a été trouvée sur cet appareil. La voix par défaut sera utilisée.</p>') +
      (IOS ? '<p class=hint>Sur iPhone, des voix plus naturelles (Enhanced ou Premium) peuvent être téléchargées dans Réglages › Accessibilité › Contenu énoncé › Voix. Les voix Siri ne sont pas accessibles aux applications web.</p>' : '') +
      '</div></div>';
    document.body.appendChild(o);
    var close = function () { try { ss.cancel(); } catch (e) {} o.remove(); };
    o.querySelector('#v24x').onclick = close;
    o.addEventListener('click', function (e) { if (e.target === o) close(); });
    var sel = o.querySelector('#v24s'), inf = o.querySelector('#v24i');
    if (!sel) return;
    var shown = function () { var v = byId(sel.value) || ranked()[0]; if (inf && v) inf.textContent = 'Voix utilisée : ' + label(v); };
    shown();
    sel.onchange = function () { lsSet(sel.value); shown(); };
    o.querySelector('#v24t').onclick = function () {
      try {
        try { if (typeof stopL === 'function') stopL(); } catch (e) {}
        ss.cancel();
        ss.speak(utter('Bonjour, voici un exemple de lecture à voix haute de votre cahier.', { voice: byId(sel.value) || ranked()[0] }));
      } catch (e) { try { toast('Lecture impossible'); } catch (e2) {} }
    };
  }
  window.v24voix = open;

  var m0 = window.menu;
  if (typeof m0 === 'function') {
    window.menu = function () {
      var r = m0.apply(this, arguments);
      try {
        var b = document.querySelector('button[onclick="th()"]');
        if (b && !document.getElementById('v24m')) {
          var q = document.createElement('button'); q.id = 'v24m'; q.textContent = '🔊 Voix de lecture'; q.onclick = open; b.before(q);
        }
      } catch (e) {}
      return r;
    };
  }
})();
