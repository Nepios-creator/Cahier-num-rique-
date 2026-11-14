/* Cahier numérique v15 : envoi DANS l'application uniquement.
   Destinataire : e-mail OU numéro de téléphone d'un compte existant. Notes, leçons, audios, PDF et Word.
   Les fichiers passent par un stockage privé (40 Mo max), lisible seulement par l'expéditeur et le destinataire,
   et sont supprimés quand le destinataire les enregistre ou les ignore. À charger APRÈS v14.js. */
(function () {
  'use strict';
  var MAXB = 40 * 1048576, DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  var KI = { note: '📝', lecon: '📘', audio: '🎙', pdf: '📕', doc: '📄' };
  function msg(e) {
    var m = String(e && (e.message || e) || '');
    if (/destinataire_inconnu/.test(m)) return 'Ce destinataire n’utilise pas l’application';
    if (/destinataire_ambigu/.test(m)) return 'Plusieurs comptes ont ce numéro : utilisez l’e-mail';
    if (/propre_adresse/.test(m)) return 'C’est votre propre compte';
    if (/limite_envois/.test(m)) return 'Limite d’envois atteinte pour aujourd’hui';
    return 'Envoi impossible (hors ligne ou compte non validé)';
  }
  var delFile = function (p) { return fetch(SB + '/storage/v1/object/cn-partages/' + p, { method: 'DELETE', headers: stH() }).catch(function () {}); };

  window.v11mail = async function () {
    var S = v11sel(), q = (($('#v11e') || {}).value || '').trim(), o = V11.it;
    if (!S.length) return toast('Cochez au moins un élément');
    var mail = /^\S+@\S+\.\S+$/.test(q), tel = q.replace(/\D/g, '');
    if (!mail && tel.length < 8) return toast('Indiquez un e-mail ou un numéro de téléphone valide');
    if (!D.s) return toast('Connectez-vous d’abord');
    if (mail && q.toLowerCase() == D.s.email.toLowerCase()) return toast('C’est votre propre adresse');
    var dest = mail ? { vers_email: q.toLowerCase() } : { vers_email: '', vers_tel: q }, n = 0, skip = 0;
    try {
      await tok();
      for (var i = 0; i < S.length; i++) {
        var k = S[i], t = k[0], id = k.slice(2), row, up = null;
        if (t == 'n' || t == 'l') {
          var x = (t == 'n' ? o.n : o.l).find(function (a) { return a.id == id; }); if (!x) continue;
          row = { kind: t == 'l' ? 'lecon' : 'note', titre: (t == 'l' ? 'Leçon : ' : 'Note : ') + x.t + ' · ' + cur.cours, chap: x.ch, sujet: x.t, html: clean(x.h || '').slice(0, 150000) };
        } else {
          var au = t == 'a', it = (au ? o.a : o.d).find(function (a) { return a.id == id; });
          var b = it && await fget(au ? id : 'doc:' + id);
          if (!b || b.size > MAXB) { skip++; continue; }
          var pdf = !au && it.ty == 'pdf';
          var mime = b.type || (au ? 'audio/webm' : pdf ? 'application/pdf' : DOCX);
          var e = au ? (/mp4|aac|m4a/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : /mpeg|mp3/.test(mime) ? 'mp3' : 'webm') : (pdf ? 'pdf' : 'docx');
          var path = uidT() + '/' + uid() + '.' + e;
          var r = await fetch(SB + '/storage/v1/object/cn-partages/' + path, { method: 'POST', headers: Object.assign(stH(), { 'Content-Type': mime, 'x-upsert': 'false' }), body: b });
          if (!r.ok) throw { message: 'upload' };
          up = path;
          row = { kind: au ? 'audio' : pdf ? 'pdf' : 'doc', titre: (au ? 'Audio : ' : 'Document : ') + it.t + ' · ' + cur.cours, chap: '', sujet: it.t, html: '', nom: it.t + '.' + e, fichier_path: path, mime: mime, taille: b.size };
        }
        try { await api('/rest/v1/cn_partages', { m: 'POST', h: { Prefer: 'return=minimal' }, b: Object.assign(row, dest) }); n++; }
        catch (er) { if (up) delFile(up); throw er; }
      }
      toast(n ? n + ' élément(s) envoyé(s)' + (skip ? ' · ' + skip + ' non envoyé(s) (absent de cet appareil ou plus de 40 Mo)' : '') : 'Rien n’a pu être envoyé (fichier absent de cet appareil ou plus de 40 Mo)');
      if (n) v11close();
    } catch (er) { toast(msg(er) + (n ? ' · ' + n + ' déjà envoyé(s)' : '')); }
  };

  window.v6inbox = async function () {
    app.innerHTML = '<header><button onclick=home()>‹</button><h1>Notes reçues</h1></header><div id=v6l><p class=hint>Chargement…</p></div>';
    try {
      await tok(); v6R = await api('/rest/v1/cn_partages?select=*&order=cree_le.desc&limit=50');
      $('#v6l').innerHTML = v6R.map(function (x) {
        var f = !!x.fichier_path;
        return '<div class=rs><b>' + (KI[x.kind] || '📝') + ' ' + esc(x.titre || 'Note') + '</b><small>De ' + esc(x.de_email) + ' · ' + dt(x.cree_le) + (f ? ' · ' + Math.max(1, Math.round((x.taille || 0) / 1024)) + ' Ko' : '') + '</small>' +
          (f ? '' : '<span>' + esc(txt(x.html).slice(0, 160)) + '…</span>') +
          '<div><button class=ch onclick="v6keep(\'' + x.id + '\')">＋ Enregistrer dans mon cahier</button><button class=ch onclick="v6drop(\'' + x.id + '\')">Ignorer</button></div></div>';
      }).join('') || '<p class=hint>Rien reçu. Quand un collègue vous envoie une note, une leçon, un audio ou un document, cela apparaît ici.</p>';
    } catch (e) { $('#v6l').innerHTML = '<p class=hint>Impossible de charger (hors ligne ?).</p>'; }
  };

  var keep0 = window.v6keep, drop0 = window.v6drop;
  window.v6keep = async function (id) {
    var x = (v6R || []).find(function (a) { return a.id == id; });
    if (!x || !x.fichier_path) return keep0.apply(this, arguments);
    try {
      var r = await fetch(SB + '/storage/v1/object/authenticated/cn-partages/' + x.fichier_path, { headers: stH() });
      if (!r.ok) throw 0;
      var b = await r.blob(), n = Date.now(), fid = uid();
      var c = D.c.find(function (k) { return !k.del && k.cours == 'Notes reçues'; });
      if (!c) { c = { id: uid(), cours: 'Notes reçues', prof: 'Collègues', color: COL[4], pages: [], u: n, d: 1 }; D.c.unshift(c); }
      var nm = (x.nom || '').replace(/\.[^.]+$/, '') || x.sujet || 'Fichier reçu', mime = x.mime || b.type;
      if (x.kind == 'audio') {
        await fput(fid, new Blob([b], { type: mime || 'audio/webm' }));
        c.pages.push({ id: uid(), chap: x.titre || 'Audio reçu', sujet: 'De ' + x.de_email, start: n, end: n, html: '', att: [{ id: fid, k: 'a', n: nm, t: n, d: 1, m: mime || 'audio/webm' }], u: n, d: 1 });
      } else {
        await v8put('doc:' + fid, new Blob([b], { type: mime }));
        (c.docs = c.docs || []).push({ id: fid, n: nm, t: x.kind == 'pdf' ? 'pdf' : 'docx', s: b.size, a: n });
      }
      c.u = n; c.d = 1; raw();
      await delFile(x.fichier_path);
      try { await api('/rest/v1/cn_partages?id=eq.' + id, { m: 'DELETE' }); } catch (e) {}
      toast('Enregistré dans le cahier « Notes reçues »'); setTimeout(sync, 500); v6inbox();
    } catch (e) { toast('Impossible de récupérer le fichier (hors ligne ?)'); }
  };
  window.v6drop = async function (id) {
    var x = (v6R || []).find(function (a) { return a.id == id; });
    if (x && x.fichier_path) await delFile(x.fichier_path);
    return drop0.apply(this, arguments);
  };

  /* Connexion / inscription : mêmes règles qu'avant, mais messages clairs en français (au lieu de l'anglais brut du serveur) */
  window.v6auth = window.auth = async function (login) {
    var em = ($('#em').value || '').trim().toLowerCase(), pw = $('#pw').value;
    if (!em || pw.length < 6) return toast('E-mail et mot de passe (6 caractères min.)');
    try {
      var j = await api(login ? '/auth/v1/token?grant_type=password' : '/auth/v1/signup', { m: 'POST', b: { email: em, password: pw } }, 0);
      if (!j.access_token) return v6login('Compte créé : confirmez votre e-mail, puis connectez-vous.');
      setS(j); raw(); v6enter(j.user.id, j.user.email, function () { raw(); v6gate(); });
    } catch (e) {
      var m = String(e && (e.msg || e.error_description || e.message) || '');
      if (/invalid login/i.test(m)) m = 'E-mail ou mot de passe incorrect. Si vous avez déjà un compte, vérifiez le mot de passe ; sinon touchez « Créer un compte ».';
      else if (/already registered/i.test(m)) m = 'Un compte existe déjà avec cet e-mail : touchez « Se connecter » avec votre mot de passe (mot de passe oublié : contactez l’administration).';
      else if (/rate limit|too many/i.test(m)) m = 'Trop d’essais : patientez quelques minutes puis réessayez.';
      toast(m || 'Échec de connexion');
    }
  };
})();
