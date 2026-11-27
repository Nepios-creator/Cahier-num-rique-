/* v23 — enregistrement audio fiable (iPhone, Android bas de gamme) :
   formats adaptés, essais successifs, erreurs précises, pas de boucle audio « anti-veille » sur iPhone. */
(function () {
  'use strict';
  var ua = navigator.userAgent || '';
  var IOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* MediaRecorder d'origine (v11 l'enveloppe dans une sous-classe qui peut échouer sur certains appareils) */
  function baseMR() {
    var M = window.MediaRecorder;
    if (!M) return null;
    try {
      var p = Object.getPrototypeOf(M);
      if (p && p.name === 'MediaRecorder' && p !== Function.prototype) return p;
    } catch (e) {}
    return M;
  }

  function message(e) {
    var n = (e && e.name) || '';
    if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError')
      return IOS
        ? 'Micro bloqué. Sur iPhone : Réglages > Safari > Micro > Autoriser (ou Réglages > Cahier numérique), puis rouvrez le cahier.'
        : 'Micro bloqué. Autorisez le micro pour ce site (cadenas près de l’adresse > Autorisations), puis réessayez.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Aucun micro détecté sur cet appareil.';
    if (n === 'NotReadableError' || n === 'AbortError' || n === 'TrackStartError')
      return 'Le micro est utilisé par une autre application (appel, WhatsApp…). Fermez-la puis réessayez.';
    if (!window.MediaRecorder) return 'Ce navigateur ne peut pas enregistrer l’audio : mettez à jour iOS ou Chrome.';
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia))
      return 'Micro indisponible : ouvrez le cahier depuis son adresse https (pas dans une fenêtre intégrée).';
    return 'Enregistrement impossible (' + (n || 'erreur') + (e && e.message ? ' : ' + String(e.message).slice(0, 80) : '') + ')';
  }

  function getStream() {
    var md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) return Promise.reject(new Error('no_media'));
    /* iPhone : contraintes minimales (les réglages avancés y provoquent des échecs) ; ailleurs : wrapper v11 (haute qualité + repli) */
    return IOS ? md.getUserMedia({ audio: {} }) : md.getUserMedia({ audio: true });
  }

  function makeRecorder(st) {
    var M = baseMR();
    if (!M) throw new Error('MediaRecorder absent');
    var types = IOS
      ? ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', '']
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', ''];
    var last;
    for (var i = 0; i < types.length; i++) {
      var t = types[i], ok = true;
      try { if (t && M.isTypeSupported && !M.isTypeSupported(t)) ok = false; } catch (e) {}
      if (!ok) continue;
      /* 1) avec format (+ débit sur Android), 2) avec format seul */
      var opts = [];
      if (t) { if (!IOS) opts.push({ mimeType: t, audioBitsPerSecond: 96000 }); opts.push({ mimeType: t }); } else opts.push(undefined);
      for (var j = 0; j < opts.length; j++) {
        try { return opts[j] ? new M(st, opts[j]) : new M(st); } catch (e) { last = e; }
      }
    }
    throw last || new Error('enregistreur_indisponible');
  }

  window.recGo = async function (name, P0) {
    var st = null;
    try {
      if (!window.MediaRecorder) throw new Error('no_recorder');
      st = await getStream();
      var id = uid(), k = 0, q = Promise.resolve(), mem = [], lost = 0;
      try { wl = await Promise.race([navigator.wakeLock.request('screen'), new Promise(function (r) { setTimeout(r, 1500); })]); } catch (e) {}
      var r = makeRecorder(st);
      mr = r;
      var x = { id: id, k: 'a', n: name, st: 'rec', t: Date.now(), d: 0, m: (r.mimeType || (IOS ? 'audio/mp4' : 'audio/webm')).split(';')[0] };
      (P0.att = P0.att || []).push(x); P0.u = Date.now(); P0.d = 1; save(); if (pg == P0) atts();

      try { st.getAudioTracks().forEach(function (t) { t.addEventListener('mute', function () { try { toast('Le t\u00e9l\u00e9phone a coup\u00e9 le micro : l\u2019enregistrement ne capte plus le son'); } catch (z) {} }); t.addEventListener('unmute', function () { try { toast('Micro r\u00e9tabli'); } catch (z) {} }); t.addEventListener('ended', function () { try { toast('Le micro s\u2019est arr\u00eat\u00e9 : relancez l\u2019enregistrement'); } catch (z) {} }); }); } catch (e) {}
      r.ondataavailable = function (e) {
        if (e.data && e.data.size) {
          var n = k++; x.d = k; mem[n] = e.data;
          /* l'échec d'une écriture ne doit jamais bloquer la fin de l'enregistrement */
          q = q.then(function () {
            return Promise.race([fput(id + '#' + String(n).padStart(6, '0'), e.data), new Promise(function (res) { setTimeout(res, 20000); })]).then(function (okw) { if (okw) mem[n] = null; else lost = 1; });
          }).catch(function () {});
        }
      };
      var fin2 = async function () { var pending = 0, j; for (j = 0; j < k; j++) { if (mem[j]) pending = 1; } if (!pending && !lost) return fin(x); var parts = [], dead = 0, i, b; for (i = 0; i < k; i++) { b = mem[i]; if (!b && !dead) { try { b = await Promise.race([fget(id + '#' + String(i).padStart(6, '0')), new Promise(function (res) { setTimeout(function () { res('T'); }, 4000); })]); } catch (e) {} if (b === 'T') { dead = 1; b = null; } } if (b) parts.push(b); } if (!parts.length) return fin(x); var blob = new Blob(parts, { type: x.m || 'audio/webm' }); var ok = false; try { ok = await Promise.race([fput(id, blob).then(function () { return true; }), new Promise(function (res) { setTimeout(function () { res(false); }, 30000); })]); } catch (e) {} if (!ok) { try { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = String(x.n || 'cours').replace(/[^\w\-]+/g, '_') + '.' + (/mp4|aac/.test(x.m || '') ? 'm4a' : 'webm'); document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1000); toast('Stockage indisponible : l\u2019audio a \u00e9t\u00e9 t\u00e9l\u00e9charg\u00e9 pour ne pas \u00eatre perdu'); } catch (e) {} } x.d = parts.length; delete x.st; };
      r.onstop = async function () {
        try { st.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        try { wl && wl.release(); } catch (e) {}
        try { if (typeof v11tStop == 'function') v11tStop(); } catch (e) {}
        await Promise.race([q, new Promise(function (res) { setTimeout(res, 8000); })]);
        if (!k) {
          /* rien n'a été capté : on retire l'entrée vide au lieu de laisser un faux enregistrement */
          P0.att = (P0.att || []).filter(function (a) { return a != x; }); raw();
          var rc0 = $('#rc'); if (rc0) rc0.textContent = '🎙'; if (!IOS && !dOn) keep(0); if (pg == P0) atts(); clas();
          return toast('Aucun son enregistré : vérifiez le micro et réessayez');
        }
        await fin2(); P0.u = Date.now(); P0.d = 1; raw(); setTimeout(sync, 3000);
        var rc = $('#rc'); if (rc) rc.textContent = '🎙';
        if (!IOS && !dOn) keep(0);
        if (pg == P0) atts(); clas(); toast('Enregistrement ajouté au classeur audio');
      };
      r.onerror = function (e) {
        try { toast(message(e && e.error)); } catch (z) {}
        try { if (r.state != 'inactive') r.stop(); } catch (z) {}
      };
      try { if (typeof v11tStart == 'function') v11tStart(); } catch (e) {}
      try { r.start(1000); } catch (e) { r.start(); }
      /* anti-veille : la boucle audio silencieuse perturbe le micro sur iPhone, on ne l'y utilise pas */
      if (!IOS) keep(1);
      var rb = $('#rc'); if (rb) rb.textContent = '⏺ Stop';
      /* si aucun morceau n'arrive après 6 s, on prévient (micro coupé / muet) */
      setTimeout(function () { if (mr === r && r.state == 'recording' && !k) toast('Aucun son reçu pour l’instant : vérifiez que le micro n’est pas coupé'); }, 6000);
    } catch (e) {
      try { st && st.getTracks().forEach(function (t) { t.stop(); }); } catch (z) {}
      try { if (typeof v11tStop == 'function') v11tStop(); } catch (z) {}
      toast(message(e));
    }
  };
})();
