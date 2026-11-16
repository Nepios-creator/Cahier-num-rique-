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
      var id = uid(), k = 0, q = Promise.resolve();
      try { wl = await Promise.race([navigator.wakeLock.request('screen'), new Promise(function (r) { setTimeout(r, 1500); })]); } catch (e) {}
      var r = makeRecorder(st);
      mr = r;
      var x = { id: id, k: 'a', n: name, st: 'rec', t: Date.now(), d: 0, m: (r.mimeType || (IOS ? 'audio/mp4' : 'audio/webm')).split(';')[0] };
      (P0.att = P0.att || []).push(x); P0.u = Date.now(); P0.d = 1; save(); if (pg == P0) atts();

      r.ondataavailable = function (e) {
        if (e.data && e.data.size) {
          var n = k++; x.d = k;
          /* l'échec d'une écriture ne doit jamais bloquer la fin de l'enregistrement */
          q = q.then(function () {
            return Promise.race([fput(id + '#' + String(n).padStart(6, '0'), e.data), new Promise(function (res) { setTimeout(res, 20000); })]);
          }).catch(function () {});
        }
      };
      r.onstop = async function () {
        try { st.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        try { wl && wl.release(); } catch (e) {}
        try { if (typeof v11tStop == 'function') v11tStop(); } catch (e) {}
        await q;
        if (!k) {
          /* rien n'a été capté : on retire l'entrée vide au lieu de laisser un faux enregistrement */
          P0.att = (P0.att || []).filter(function (a) { return a != x; }); raw();
          var rc0 = $('#rc'); if (rc0) rc0.textContent = '🎙'; if (!IOS && !dOn) keep(0); if (pg == P0) atts(); clas();
          return toast('Aucun son enregistré : vérifiez le micro et réessayez');
        }
        await fin(x); P0.u = Date.now(); P0.d = 1; raw(); setTimeout(sync, 3000);
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
