/* v29 : 1) pause / reprise de l'enregistrement audio (même fichier, on continue là où on s'était arrêté)
         2) réduction de bruit réglable : avant (réglage du micro du téléphone) et après (version nettoyée d'un enregistrement).
   À charger après v28.js. Aucun format de données modifié : la version nettoyée est un NOUVEL enregistrement (WAV) ajouté
   à côté de l'original, qui n'est jamais modifié ni supprimé.
   Réduction « après » : soustraction spectrale (STFT 2048 / pas 512, fenêtre en sinus, profil du bruit pris dans les passages
   les plus calmes, lissage temporel et fréquentiel pour éviter le bruit « métallique », plancher de gain réglable). */
(function () {
  'use strict';
  var ua = navigator.userAgent || '';
  var IOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var CAP_MIN = 15;                                          /* durée maximale traitée (mémoire du téléphone) */

  function q(s) { return document.querySelector(s); }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function say(t) { try { toast(t); } catch (e) {} }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return h ? h + ':' + pad(m) + ':' + pad(x) : pad(m) + ':' + pad(x);
  }
  function esc2(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* =====================  1) PAUSE / REPRISE  ===================== */
  var T = { acc: 0, last: 0, paused: false, btn: null };

  function elapsed() { return T.acc + (T.paused ? 0 : Date.now() - T.last); }
  function removeBtn() { if (T.btn) { try { T.btn.remove(); } catch (e) {} } T.btn = null; }

  function paint() {
    try {
      var el = document.getElementById('v11t0');
      if (!el) { T.paused = false; removeBtn(); return; }      /* l'enregistrement est terminé */
      var f = fmt(elapsed() / 1000);
      el.style.background = T.paused ? '#475569' : '#dc2626';
      el.innerHTML = (T.paused ? '<span style="font-size:16px">⏸</span>' : '<span style="width:10px;height:10px;border-radius:50%;background:#fff;animation:v11b 1s infinite"></span>') + f + (T.paused ? ' · pause' : '');
      var r = q('#rc'); if (r) r.textContent = (T.paused ? '⏸ ' : '⏺ ') + f + ' · Stop';
      if (T.btn) T.btn.textContent = T.paused ? '▶ Reprendre' : '⏸ Pause';
    } catch (e) {}
  }

  function toggle() {
    try {
      if (typeof mr === 'undefined' || !mr) return;
      if (mr.state === 'recording') {
        mr.pause();
        if (mr.state !== 'paused') return say('Pause impossible sur cet appareil');
        T.acc += Date.now() - T.last; T.paused = true;
        say('Enregistrement en pause — touchez « Reprendre » pour continuer');
      } else if (mr.state === 'paused') {
        mr.resume();
        if (mr.state !== 'recording') return say('Reprise impossible : arrêtez puis relancez un enregistrement');
        T.last = Date.now(); T.paused = false;
      }
      paint();
    } catch (e) { say('Pause impossible sur cet appareil'); }
  }

  try {
    var start0 = window.v11tStart, stop0 = window.v11tStop;
    if (typeof start0 === 'function') {
      window.v11tStart = function () {
        start0.apply(this, arguments);
        try {
          T.acc = 0; T.last = Date.now(); T.paused = false; removeBtn();
          if (typeof V11 !== 'undefined' && V11) { if (V11.ti) clearInterval(V11.ti); V11.ti = setInterval(paint, 250); }
          var b = document.createElement('button');
          b.id = 'cn29p'; b.type = 'button'; b.textContent = '⏸ Pause';
          b.setAttribute('aria-label', 'Mettre l’enregistrement en pause ou le reprendre');
          b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(58px + env(safe-area-inset-top,0px));z-index:121;border:0;border-radius:999px;padding:11px 22px;font:800 16px/1 system-ui;background:#fff;color:#111;box-shadow:0 6px 20px #0006;-webkit-tap-highlight-color:transparent;cursor:pointer';
          b.onclick = function (e) { try { e.stopPropagation(); } catch (z) {} toggle(); };
          document.body.appendChild(b); T.btn = b;
          paint();
        } catch (e) {}
      };
    }
    if (typeof stop0 === 'function') {
      window.v11tStop = function () {
        try { stop0.apply(this, arguments); } catch (e) {}
        T.paused = false; removeBtn();
      };
    }
  } catch (e) {}

  /* Le bouton 🎙 / « Stop » : en pause, il ARRÊTE l'enregistrement (au lieu d'en démarrer un nouveau) */
  try {
    var rec0 = window.rec;
    if (typeof rec0 === 'function') {
      window.rec = function () {
        try { if (typeof mr !== 'undefined' && mr && mr.state === 'paused') { mr.stop(); return; } } catch (e) {}
        return rec0.apply(this, arguments);
      };
    }
  } catch (e) {}

  /* =====================  2) RÉDUCTION DE BRUIT  ===================== */

  /* ---- 2a) avant : réglage du micro du téléphone (suppression de bruit du navigateur) ---- */
  function liveOn() { return lsGet('cn_nr_live', '0') === '1'; }
  function wrapGum() {
    try {
      var md = navigator.mediaDevices;
      if (!md || !md.getUserMedia || md.getUserMedia.__cn29 || IOS) return;
      var g = md.getUserMedia.bind(md);
      var w = function (c) {
        try {
          if (liveOn() && c && c.audio === true) {
            var nc = Object.assign({}, c, { audio: { channelCount: { ideal: 1 }, sampleRate: { ideal: 48000 }, echoCancellation: { ideal: true }, noiseSuppression: { ideal: true }, autoGainControl: { ideal: true } } });
            return g(nc).catch(function () { return g(c); });
          }
        } catch (e) {}
        return g(c);
      };
      w.__cn29 = 1; md.getUserMedia = w;
    } catch (e) {}
  }
  wrapGum(); setTimeout(wrapGum, 2500); setTimeout(wrapGum, 8000);   /* v11 installe aussi son enveloppe : on se remet par-dessus si besoin */

  /* ---- 2b) après : traitement spectral ---- */
  function makeFFT(n) {
    var lg = Math.round(Math.log(n) / Math.LN2), rev = new Uint16Array(n), cs = new Float32Array(n / 2), sn = new Float32Array(n / 2), i, b, r;
    for (i = 0; i < n; i++) { r = 0; for (b = 0; b < lg; b++) r |= ((i >> b) & 1) << (lg - 1 - b); rev[i] = r; }
    for (i = 0; i < n / 2; i++) { cs[i] = Math.cos(2 * Math.PI * i / n); sn[i] = -Math.sin(2 * Math.PI * i / n); }
    return function (re, im, inv) {
      var i, j, k, size, half, step, a, bb, wr, wi, tr, ti, t;
      for (i = 0; i < n; i++) { j = rev[i]; if (j > i) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (size = 2; size <= n; size <<= 1) {
        half = size >> 1; step = n / size;
        for (i = 0; i < n; i += size) {
          for (j = 0, k = 0; j < half; j++, k += step) {
            wr = cs[k]; wi = inv ? -sn[k] : sn[k]; a = i + j; bb = a + half;
            tr = re[bb] * wr - im[bb] * wi; ti = re[bb] * wi + im[bb] * wr;
            re[bb] = re[a] - tr; im[bb] = im[a] - ti; re[a] += tr; im[a] += ti;
          }
        }
      }
    };
  }

  var N = 2048, H = 512, B = N / 2 + 1;
  var WIN = new Float32Array(N); for (var wi0 = 0; wi0 < N; wi0++) WIN[wi0] = Math.sin(Math.PI * (wi0 + 0.5) / N);
  var FFT = null;

  /* Profil du bruit : spectre de puissance moyen des passages les plus calmes de l'enregistrement. */
  function noiseProfile(x) {
    if (!FFT) FFT = makeFFT(N);
    var blk = 1024, nb = Math.floor(x.length / blk) - 1, i, k, n;
    if (nb < 4) return null;
    var e = new Float64Array(nb + 1);
    for (i = 0; i <= nb && (i + 1) * blk <= x.length; i++) { var s = 0, o = i * blk; for (n = 0; n < blk; n++) s += x[o + n] * x[o + n]; e[i] = s; }
    var idx = []; for (i = 0; i < nb; i++) { var en = e[i] + e[i + 1]; if (en > 1e-9) idx.push(i); }
    if (idx.length < 4) return null;
    idx.sort(function (a, b) { return (e[a] + e[a + 1]) - (e[b] + e[b + 1]); });
    var take = Math.max(8, Math.min(400, Math.round(idx.length * 0.1))); if (take > idx.length) take = idx.length;
    var P = new Float64Array(B), re = new Float32Array(N), im = new Float32Array(N), c = 0;
    for (var t = 0; t < take; t++) {
      var st = idx[t] * blk; if (st + N > x.length) continue;
      for (n = 0; n < N; n++) { re[n] = x[st + n] * WIN[n]; im[n] = 0; }
      FFT(re, im, false);
      for (k = 0; k < B; k++) P[k] += re[k] * re[k] + im[k] * im[k];
      c++;
    }
    if (!c) return null;
    var out = new Float32Array(B);
    for (k = 0; k < B; k++) {                                /* moyenne + lissage fréquentiel (5 points) */
      var a = 0, m = 0;
      for (var d = -2; d <= 2; d++) { var kk = k + d; if (kk >= 0 && kk < B) { a += P[kk]; m++; } }
      out[k] = Math.max(1e-12, 1.3 * a / m / c);
    }
    return out;
  }

  /* Traite x[start, end) ; sink(Int16Array) reçoit le résultat dans l'ordre. force : 0..1 */
  async function denoise(x, noise, force, start, end, sink, progress, ctl) {
    if (!FFT) FFT = makeFFT(N);
    var alpha = 1 + 1.5 * force, gmin = Math.pow(10, -(8 + 22 * force) / 20);
    var re = new Float32Array(N), im = new Float32Array(N), ob = new Float32Array(N);
    var prev = new Float32Array(B).fill(1), g = new Float32Array(B), gs = new Float32Array(B);
    var oc = new Int16Array(65536), on = 0, len = x.length, k, n;
    function flush() { if (on) { sink(oc.slice(0, on)); on = 0; } }
    var f0 = start - (N - H), total = Math.ceil((end - f0) / H), fr = 0;
    for (var f = f0; f < end; f += H, fr++) {
      for (n = 0; n < N; n++) { var p = f + n; re[n] = (p >= 0 && p < len) ? x[p] * WIN[n] : 0; im[n] = 0; }
      FFT(re, im, false);
      for (k = 0; k < B; k++) {
        var pw = re[k] * re[k] + im[k] * im[k], gg = 1 - alpha * noise[k] / (pw + 1e-20);
        if (gg < gmin) gg = gmin; if (gg > 1) gg = 1;
        gs[k] = gg > prev[k] ? 0.6 * gg + 0.4 * prev[k] : 0.2 * gg + 0.8 * prev[k];   /* attaque rapide (début des mots), relâchement lent */
      }
      for (k = 0; k < B; k++) {                              /* lissage fréquentiel 1-2-1 */
        var a = gs[k > 0 ? k - 1 : 0], c = gs[k < B - 1 ? k + 1 : B - 1];
        g[k] = 0.25 * a + 0.5 * gs[k] + 0.25 * c;
      }
      prev.set(gs);
      for (k = 0; k < B; k++) { re[k] *= g[k]; im[k] *= g[k]; }
      for (k = 1; k < N / 2; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
      FFT(re, im, true);
      for (n = 0; n < N; n++) ob[n] += re[n] * WIN[n] * (0.5 / N);
      for (n = 0; n < H; n++) {                              /* échantillons f..f+H terminés */
        var pos = f + n;
        if (pos >= start && pos < end) {
          var v = ob[n]; v = v > 1 ? 1 : v < -1 ? -1 : v;
          oc[on++] = v < 0 ? Math.round(v * 32768) : Math.round(v * 32767);
          if (on === oc.length) flush();
        }
      }
      ob.copyWithin(0, H); ob.fill(0, N - H);
      if ((fr & 31) === 31) {
        if (progress) progress(fr / total);
        if (ctl && ctl.stop) { flush(); return false; }
        await new Promise(function (r) { setTimeout(r, 0); });
      }
    }
    flush(); if (progress) progress(1);
    return true;
  }

  function wavBlob(parts, nSamples, sr) {
    var h = new DataView(new ArrayBuffer(44));
    function w(o, t) { for (var i = 0; i < t.length; i++) h.setUint8(o + i, t.charCodeAt(i)); }
    w(0, 'RIFF'); h.setUint32(4, 36 + nSamples * 2, true); w(8, 'WAVEfmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
    h.setUint32(24, sr, true); h.setUint32(28, sr * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true); w(36, 'data'); h.setUint32(40, nSamples * 2, true);
    return new Blob([h.buffer].concat(parts), { type: 'audio/wav' });
  }
  function toInt16(x, a, b) {
    var o = new Int16Array(b - a);
    for (var i = a; i < b; i++) { var v = x[i]; v = v > 1 ? 1 : v < -1 ? -1 : v; o[i - a] = v < 0 ? Math.round(v * 32768) : Math.round(v * 32767); }
    return o;
  }

  async function decodeBlob(blob) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('no_audio');
    var ctx = new AC(), ab = await blob.arrayBuffer();
    var buf = await new Promise(function (res, rej) { var p = ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); });
    try { ctx.close(); } catch (e) {}
    var x = buf.getChannelData(0);
    if (buf.numberOfChannels > 1) {
      var y = new Float32Array(x.length), c, i, k = buf.numberOfChannels;
      for (c = 0; c < k; c++) { var d = buf.getChannelData(c); for (i = 0; i < y.length; i++) y[i] += d[i] / k; }
      x = y;
    }
    return { x: x, sr: buf.sampleRate };
  }

  /* Fenêtre de 12 s la plus « vivante » (voix + silences) pour l'écoute d'essai */
  function previewRange(x, sr) {
    var win = Math.min(x.length, Math.round(12 * sr)), blk = Math.round(sr / 2), nb = Math.floor(x.length / blk), best = 0, bi = 0, i;
    var e = new Float64Array(nb);
    for (i = 0; i < nb; i++) { var s = 0, o = i * blk; for (var n = 0; n < blk; n += 4) s += x[o + n] * x[o + n]; e[i] = s; }
    var w = Math.max(1, Math.round(win / blk)), cur = 0;
    for (i = 0; i < nb; i++) { cur += e[i]; if (i >= w) cur -= e[i - w]; if (i >= w - 1 && cur > best) { best = cur; bi = i - w + 1; } }
    var a = Math.max(0, bi * blk); return [a, Math.min(x.length, a + win)];
  }

  /* ---- fenêtre de réglage ---- */
  var DLG = null;
  function closeDlg() { if (DLG) { DLG.ctl.stop = true; try { DLG.el.remove(); } catch (e) {} try { DLG.urls.forEach(function (u) { URL.revokeObjectURL(u); }); } catch (e) {} try { DLG.wl && DLG.wl.release(); } catch (e) {} DLG = null; } }

  function label(v) { return v < 25 ? 'léger' : v < 55 ? 'équilibré' : v < 80 ? 'fort' : 'très fort'; }

  async function openNR(pid, aid) {
    try {
      closeDlg();
      var p = null, a = null;
      try {
        if (pid) p = cur.pages.find(function (z) { return z.id == pid; });
        else p = pg;
        a = p && (p.att || []).find(function (z) { return z.id == aid; });
      } catch (e) {}
      var el = document.createElement('div');
      el.id = 'cn29nr';
      el.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:270;background:#000a;display:flex';
      var force0 = Math.max(0, Math.min(100, parseInt(lsGet('cn_nr_force', '50'), 10) || 50));
      var dur = a ? (a.d || 0) : 0;
      el.innerHTML = '<div class=scb style="width:100%">' +
        '<b style="font-size:18px">🔇 Réduction de bruit</b>' +
        (a ? '<p class=hint style="margin:8px 0">Enregistrement : <b>' + esc2(a.n) + '</b>' + (dur ? ' · ' + Math.ceil(dur / 60) + ' min' : '') + '</p>' +
          '<label style="display:block;margin:10px 0 4px;font-weight:700">Force : <span id=nr1v></span></label>' +
          '<input id=nr1 type=range min=0 max=100 step=5 value=' + force0 + ' style="width:100%">' +
          '<div style="display:flex;justify-content:space-between" class=hint><span>Garde tout</span><span>Supprime plus de bruit</span></div>' +
          '<p class=hint style="margin:8px 0">Le bruit de fond constant (ventilateur, souffle, bourdonnement, salle) est atténué ; la voix est conservée. L’original n’est jamais modifié : une <b>nouvelle version « sans bruit »</b> est ajoutée à côté. Au-delà de 80 %, la voix peut devenir un peu métallique : écoutez l’extrait d’abord.</p>' +
          '<div class=f><button id=nr2 type=button>🎧 Écouter un extrait (12 s)</button></div>' +
          '<div id=nr3 style="display:none"><p class=hint style="margin:6px 0 2px">Avant</p><audio id=nr3a controls style="width:100%"></audio><p class=hint style="margin:6px 0 2px">Après</p><audio id=nr3b controls style="width:100%"></audio></div>' +
          '<div id=nr4 class=hint style="margin:8px 0;display:none"></div>' +
          '<div class=f><button id=nr5 class=p type=button>Créer la version sans bruit</button></div>'
          : '<p class=hint style="margin:8px 0">Pour nettoyer un enregistrement existant, touchez « 🔇 Bruit » à côté de l’enregistrement (classeur audio de la page).</p>') +
        '<hr style="border:0;border-top:1px solid var(--line);margin:12px 0">' +
        '<label style="display:flex;gap:10px;align-items:flex-start"><input id=nr6 type=checkbox ' + (liveOn() ? 'checked' : '') + ' style="width:22px;height:22px;flex:none"><span><b>Pendant l’enregistrement</b> : réduction de bruit du téléphone<br><span class=hint>S’applique aux prochains enregistrements. La qualité dépend du téléphone et peut atténuer légèrement la voix ; la version « sans bruit » ci-dessus est plus fine. ' + (IOS ? 'Non disponible sur iPhone.' : '') + '</span></span></label>' +
        '<div class=f><button id=nr7 type=button>Fermer</button></div></div>';
      document.body.appendChild(el);
      var D = DLG = { el: el, ctl: { stop: false }, urls: [], wl: null }, dec = null, noise = null, busy = false;
      function $d(s) { return el.querySelector(s); }
      function force() { var s = $d('#nr1'); return s ? s.value / 100 : 0.5; }
      var sl = $d('#nr1'), lab = $d('#nr1v');
      function showLab() { if (sl && lab) lab.textContent = sl.value + ' % (' + label(+sl.value) + ')'; }
      if (sl) { showLab(); sl.oninput = function () { showLab(); lsSet('cn_nr_force', sl.value); var t = $d('#nr3'); if (t) t.style.display = 'none'; }; }
      $d('#nr6').onchange = function () { lsSet('cn_nr_live', this.checked ? '1' : '0'); wrapGum(); say(this.checked ? 'Réduction de bruit activée pour les prochains enregistrements' : 'Réduction de bruit du téléphone désactivée'); };
      $d('#nr7').onclick = closeDlg;
      el.addEventListener('click', function (e) { if (e.target === el && !busy) closeDlg(); });
      if (!a) return;

      var info = $d('#nr4');
      function msg(t) { info.style.display = t ? 'block' : 'none'; info.textContent = t || ''; }
      function lock(on) { busy = on; ['#nr2', '#nr5'].forEach(function (s) { var b = $d(s); if (b) b.disabled = on; }); if (sl) sl.disabled = on; }
      async function prepare() {
        if (dec && noise) return true;
        if (dur && dur > CAP_MIN * 60) { msg('Cet enregistrement dure ' + Math.ceil(dur / 60) + ' min : la réduction de bruit est limitée à ' + CAP_MIN + ' min par fichier (mémoire du téléphone).'); return false; }
        msg('Lecture de l’enregistrement…');
        var blob = await fget(a.id);
        if (!blob) { msg('Audio absent de cet appareil.'); return false; }
        dec = await decodeBlob(blob);
        if (D !== DLG) return false;
        if (dec.x.length / dec.sr > CAP_MIN * 60 + 20) { msg('Cet enregistrement dure ' + Math.ceil(dec.x.length / dec.sr / 60) + ' min : limite de ' + CAP_MIN + ' min par fichier.'); dec = null; return false; }
        msg('Analyse du bruit de fond…');
        await new Promise(function (r) { setTimeout(r, 20); });
        noise = noiseProfile(dec.x);
        if (!noise) { msg('Impossible de repérer le bruit de fond (enregistrement trop court ou silencieux).'); dec = null; return false; }
        return true;
      }

      $d('#nr2').onclick = async function () {
        if (busy) return; lock(true);
        try {
          if (!(await prepare()) || D !== DLG) return lock(false);
          var r = previewRange(dec.x, dec.sr), parts = [], n = 0;
          msg('Calcul de l’extrait…');
          await denoise(dec.x, noise, force(), r[0], r[1], function (c) { parts.push(c); n += c.length; }, null, D.ctl);
          if (D !== DLG) return;
          var ua2 = URL.createObjectURL(wavBlob([toInt16(dec.x, r[0], r[1])], r[1] - r[0], dec.sr)), ub = URL.createObjectURL(wavBlob(parts, n, dec.sr));
          D.urls.push(ua2, ub);
          $d('#nr3a').src = ua2; $d('#nr3b').src = ub; $d('#nr3').style.display = 'block'; msg('');
        } catch (e) { msg('Extrait impossible : ' + (e && e.message ? String(e.message).slice(0, 80) : 'mémoire insuffisante ou format non lisible')); dec = null; }
        lock(false);
      };

      $d('#nr5').onclick = async function () {
        if (busy) return; lock(true);
        try {
          D.wl = null; try { D.wl = await navigator.wakeLock.request('screen'); } catch (e) {}
          if (!(await prepare()) || D !== DLG) return lock(false);
          var parts = [], n = 0, t0 = Date.now();
          var ok = await denoise(dec.x, noise, force(), 0, dec.x.length, function (c) { parts.push(c); n += c.length; }, function (f) {
            var s = (Date.now() - t0) / 1000, rest = f > 0.02 ? Math.round(s / f - s) : 0;
            msg('Nettoyage : ' + Math.round(f * 100) + ' %' + (rest ? ' · encore ~' + (rest > 90 ? Math.ceil(rest / 60) + ' min' : rest + ' s') : '') + ' — gardez l’écran allumé');
          }, D.ctl);
          if (!ok || D !== DLG) return;
          var blob = wavBlob(parts, n, dec.sr), nid = uid();
          await fput(nid, blob);
          var nx = { id: nid, k: 'a', n: a.n + ' (sans bruit)', t: Date.now(), d: Math.round(n / dec.sr), m: 'audio/wav' };
          (p.att = p.att || []).push(nx); p.u = Date.now(); p.d = 1; raw(); setTimeout(function () { try { sync(); } catch (e) {} }, 3000);
          try { if (pg == p) atts(); } catch (e) {} try { clas(); } catch (e) {}
          say('Version sans bruit ajoutée au classeur audio');
          closeDlg();
          return;
        } catch (e) { msg('Nettoyage impossible : ' + (e && e.message ? String(e.message).slice(0, 80) : 'mémoire insuffisante') + '. L’original est intact.'); dec = null; }
        try { D.wl && D.wl.release(); } catch (e) {}
        lock(false);
      };
    } catch (e) { say('Réduction de bruit indisponible'); }
  }
  window.cnNR = openNR;

  /* ---- boutons dans le classeur audio et sur les pastilles d'enregistrement ---- */
  function decorate() {
    var cl = q('#cl');
    if (cl) {
      cl.querySelectorAll('.rs').forEach(function (r) {
        if (r.querySelector('.cn29')) return;
        var ren = r.querySelector('button[onclick^="ren("]'); if (!ren) return;
        var m = /ren\('([^']*)','([^']*)'\)/.exec(ren.getAttribute('onclick') || ''); if (!m) return;
        var b = document.createElement('button'); b.className = 'ch cn29'; b.textContent = '🔇 Bruit';
        b.setAttribute('onclick', "cnNR('" + m[1] + "','" + m[2] + "')");
        ren.parentNode.insertBefore(b, ren.nextSibling);
      });
      if (!cl.querySelector('.cn29s')) {
        var s = document.createElement('button'); s.className = 'ch cn29s'; s.type = 'button'; s.textContent = '🔇 Réglage du bruit (enregistrement)';
        s.setAttribute('onclick', 'cnNR()');
        cl.insertBefore(s, cl.firstChild);
      }
    }
    var at = q('#at');
    if (at) {
      at.querySelectorAll('.ch2').forEach(function (c) {
        if (c.querySelector('.cn29')) return;
        var m = /opn\('([^']*)','a'\)/.exec(c.getAttribute('onclick') || ''); if (!m) return;
        var bs = c.querySelectorAll('b'), last = bs[bs.length - 1]; if (!last) return;
        var b = document.createElement('b'); b.className = 'cn29'; b.textContent = '🔇'; b.setAttribute('aria-label', 'Réduire le bruit');
        b.setAttribute('onclick', "event.stopPropagation();cnNR(null,'" + m[1] + "')");
        c.insertBefore(b, last); c.insertBefore(document.createTextNode(' '), last);
      });
    }
  }
  try {
    var clas0 = window.clas, atts0 = window.atts;
    if (typeof clas0 === 'function') window.clas = function () { var r = clas0.apply(this, arguments); try { decorate(); } catch (e) {} return r; };
    if (typeof atts0 === 'function') window.atts = function () { var r = atts0.apply(this, arguments); try { decorate(); } catch (e) {} return r; };
  } catch (e) {}

  window.cnRec = { toggle: toggle, denoise: denoise, noiseProfile: noiseProfile, wavBlob: wavBlob };
})();
