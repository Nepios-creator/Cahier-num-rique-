/* v21 : envoi d'une page par e-mail OU téléphone, envoi d'un cahier entier (au choix : pages seules ou avec détails),
   numéro de téléphone enregistré dans le compte, réception groupée des cahiers. À charger après v20.js. */
(function () {
  'use strict';
  var MAXB = 40 * 1048576, DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  function msg(e) {
    var m = String(e && (e.message || e.msg || e) || '');
    if (/destinataire_inconnu/.test(m)) return 'Aucun compte trouvé. Vérifiez l’e-mail, ou demandez à cette personne d’enregistrer son numéro (⋯ → Mon numéro).';
    if (/destinataire_ambigu/.test(m)) return 'Plusieurs comptes ont ce numéro : utilisez l’e-mail';
    if (/propre_adresse/.test(m)) return 'C’est votre propre compte';
    if (/limite_envois/.test(m)) return 'Limite d’envois atteinte pour aujourd’hui';
    if (/trop_volumineux/.test(m)) return 'Cahier trop volumineux : envoyez-le sans les détails ou en plusieurs fois';
    return 'Envoi impossible (hors ligne ou compte non validé)';
  }
  function dest(q) {
    q = (q || '').trim();
    var mail = /^\S+@\S+\.\S+$/.test(q), tel = q.replace(/\D/g, '');
    if (!mail && tel.length < 8) return { err: 'Indiquez un e-mail ou un numéro de téléphone valide' };
    if (!D.s) return { err: 'Connectez-vous d’abord' };
    if (mail && q.toLowerCase() == D.s.email.toLowerCase()) return { err: 'C’est votre propre adresse' };
    return mail ? { d: { vers_email: q.toLowerCase() } } : { d: { vers_email: '', vers_tel: q } };
  }
  var delFile = function (p) { return fetch(SB + '/storage/v1/object/cn-partages/' + p, { method: 'DELETE', headers: stH() }).catch(function () {}); };

  /* ---------- 1. Envoyer une page : e-mail ou téléphone ---------- */
  window.v6share = function () {
    var e = $('#ed'); if (e && e.isContentEditable) { pg.html = e.innerHTML; save(); }
    modal('<b>Envoyer cette page à un collègue</b><div class=f><label>E-mail ou numéro de téléphone<input id=v6to autocomplete=off placeholder="E-mail ou téléphone"></label><p class=hint>Il doit utiliser l’application avec ce compte. Seul le texte est envoyé, sans images.</p></div>', function () {
      var r = dest($('#v6to').value); if (r.err) { toast(r.err); return false; }
      window.v6send(r.d);
    });
    $('#eo').textContent = 'Envoyer';
  };
  window.v6send = async function (d) {
    if (typeof d == 'string') d = /^\S+@\S+\.\S+$/.test(d) ? { vers_email: d.toLowerCase() } : { vers_email: '', vers_tel: d };
    if (!D.s) return toast('Connectez-vous d’abord');
    try {
      await tok();
      await api('/rest/v1/cn_partages', { m: 'POST', h: { Prefer: 'return=minimal' }, b: Object.assign({ titre: cur.cours + ' · p.' + (cur.pages.indexOf(pg) + 1), chap: pg.chap || '', sujet: pg.sujet || '', html: clean(pg.html || '').slice(0, 150000) }, d) });
      toast('Page envoyée');
    } catch (e) { toast(msg(e)); }
  };

  /* ---------- 2. Mon numéro (compte) ---------- */
  async function telDlg(first) {
    if (document.getElementById('v21tel')) return;
    var cur0 = ''; try { await tok(); var r = await api('/rest/v1/cn_profils?select=telephone'); cur0 = (r[0] && r[0].telephone) || ''; } catch (e) {}
    if (first && cur0) return;
    var o = document.createElement('div'); o.id = 'ak'; o.dataset.v6 = 'dlg';
    o.innerHTML = '<div class=scb id=v21tel><b>📞 Mon numéro de téléphone</b><p class=hint>' + (first ? 'Ajoutez votre numéro : vos collègues pourront vous envoyer des pages et des cahiers avec votre numéro, sans connaître votre e-mail. ' : '') + 'Il n’est utilisé que pour retrouver votre compte lors d’un envoi.</p><div class=f><label>Numéro<input id=v21n type=tel inputmode=tel autocomplete=tel value="' + esc(cur0) + '" placeholder="09…"></label><button class=p id=v21ok>Enregistrer</button><button id=v21x>' + (first ? 'Plus tard' : 'Fermer') + '</button></div></div>';
    document.body.appendChild(o);
    o.querySelector('#v21x').onclick = function () { o.remove(); };
    o.querySelector('#v21ok').onclick = async function () {
      var v = o.querySelector('#v21n').value.trim();
      if (v && v.replace(/\D/g, '').length < 8) return toast('Numéro invalide');
      try { await api('/rest/v1/rpc/cn_definir_telephone', { m: 'POST', b: { p_tel: v } }); toast(v ? 'Numéro enregistré' : 'Numéro retiré'); o.remove(); }
      catch (e) { toast('Impossible d’enregistrer (hors ligne ?)'); }
    };
  }
  var menu0 = window.menu;
  window.menu = function () {
    var r = menu0.apply(this, arguments);
    try { var f = document.querySelector('.f'); if (f && D.s) { var b = document.createElement('button'); b.textContent = '📞 Mon numéro (pour recevoir des envois)'; b.onclick = function () { telDlg(false); }; f.insertBefore(b, f.querySelector('hr') || null); } } catch (e) {}
    return r;
  };
  var g0 = window.v6gate;
  window.v6gate = async function () {
    var r = await g0.apply(this, arguments);
    try {
      if (D.ok && D.s) {
        var k = 'cn-tel-ask', t = +localStorage.getItem(k) || 0;
        if (Date.now() - t > 3 * 864e5) { localStorage.setItem(k, String(Date.now())); setTimeout(function () { telDlg(true); }, 2500); }
      }
    } catch (e) {}
    return r;
  };

  /* ---------- 3. Envoyer un cahier ---------- */
  function ext(m, au, pdf) { return au ? (/mp4|aac|m4a/.test(m) ? 'm4a' : /ogg/.test(m) ? 'ogg' : /wav/.test(m) ? 'wav' : /mpeg|mp3/.test(m) ? 'mp3' : 'webm') : (pdf ? 'pdf' : 'docx'); }
  async function upload(b, mime, e) {
    var path = uidT() + '/' + uid() + '.' + e;
    var r = await fetch(SB + '/storage/v1/object/cn-partages/' + path, { method: 'POST', headers: Object.assign(stH(), { 'Content-Type': mime, 'x-upsert': 'false' }), body: b });
    if (!r.ok) throw { message: 'upload' };
    return path;
  }
  window.v21cahier = function () {
    if (!cur) return;
    var np = cur.pages.length, nc = 0, na = 0, nd = (cur.docs || []).length, nt = 0;
    cur.pages.forEach(function (p) { nc += (p.cpl || []).length; na += (p.att || []).filter(function (x) { return x.k == 'a' && x.st != 'rec'; }).length; nt += (p.tags || []).length; });
    var o = document.createElement('div'); o.id = 'ak'; o.dataset.v6 = 'dlg';
    var cb = function (id, l, n) { return n ? '<label style="display:flex;gap:10px;align-items:center;margin:8px 0"><input type=checkbox id=' + id + ' style="width:22px;height:22px;flex:none"><span>' + l + ' <small class=hint>(' + n + ')</small></span></label>' : ''; };
    o.innerHTML = '<div class=scb><b>📤 Envoyer le cahier « ' + esc(cur.cours) + ' »</b><p class=hint>Les ' + np + ' page(s) sont toujours envoyées. Cochez les détails à ajouter :</p>' +
      cb('v21c', 'Notes complémentaires et leçons', nc) + cb('v21t', 'Étiquettes', nt) + cb('v21a', 'Audios', na) + cb('v21d', 'PDF et Word', nd) +
      '<div class=f style="margin-top:10px"><label>Destinataire (e-mail ou téléphone)<input id=v21to autocomplete=off placeholder="E-mail ou téléphone"></label><button class=p id=v21go>📥 Envoyer le cahier</button><button id=v21x>Annuler</button></div></div>';
    document.body.appendChild(o);
    o.querySelector('#v21x').onclick = function () { o.remove(); };
    o.querySelector('#v21go').onclick = async function () {
      var btn = this, r = dest(o.querySelector('#v21to').value); if (r.err) return toast(r.err);
      var inc = function (id) { var e = o.querySelector('#' + id); return !!(e && e.checked); };
      var wc = inc('v21c'), wt = inc('v21t'), wa = inc('v21a'), wd = inc('v21d');
      btn.disabled = true; btn.textContent = 'Envoi en cours…';
      var grp = uid(), n = 0, skip = 0, files = [];
      try {
        /* Audios, PDF et Word : plus de stockage en ligne, ils partent par le partage du téléphone. Les pages (texte) partent ensuite. */
        var FS = [];
        if (wa) for (var i0 = 0; i0 < cur.pages.length; i0++) for (var j0 = 0; j0 < (cur.pages[i0].att || []).length; j0++) {
          var x0 = cur.pages[i0].att[j0]; if (x0.k != 'a' || x0.st == 'rec') continue;
          var b0 = await fget(x0.id); if (!b0) { skip++; continue; }
          var m0 = b0.type || 'audio/webm'; FS.push(new File([b0], (x0.n || 'Audio') + '.' + ext(m0, true), { type: m0 }));
        }
        if (wd) for (var k0 = 0; k0 < (cur.docs || []).length; k0++) {
          var d0 = cur.docs[k0], bb0 = await fget('doc:' + d0.id); if (!bb0) { skip++; continue; }
          var pdf0 = d0.t == 'pdf', m1 = bb0.type || (pdf0 ? 'application/pdf' : DOCX); FS.push(new File([bb0], d0.n + '.' + ext(m1, false, pdf0), { type: m1 }));
        }
        if (FS.length) await window.v31partager(FS);
        await tok();
        var e = $('#ed'); if (e && e.isContentEditable && pg) { pg.html = e.innerHTML; }
        for (var i = 0; i < cur.pages.length; i++) {
          var p = cur.pages[i], meta = { cours: cur.cours, prof: cur.prof || '', color: cur.color, idx: i + 1, total: cur.pages.length, start: p.start, end: p.end };
          if (wt) meta.tags = p.tags || [];
          if (wc) meta.cpl = (p.cpl || []).map(function (x) { return { t: x.t, h: clean(x.h || ''), k: x.k }; });
          await api('/rest/v1/cn_partages', { m: 'POST', h: { Prefer: 'return=minimal' }, b: Object.assign({ kind: 'page', groupe: grp, ordre: i + 1, titre: cur.cours, chap: p.chap || '', sujet: p.sujet || '', html: clean(p.html || '').slice(0, 150000), meta: meta }, r.d) });
          n++;
          if (wa) for (var j = 0; j < (p.att || []).length; j++) {
            var x = p.att[j]; if (x.k != 'a' || x.st == 'rec') continue;
            var b = await fget(x.id); if (!b || b.size > MAXB) { skip++; continue; }
            var mime = b.type || 'audio/webm', e2 = ext(mime, true), path = await upload(b, mime, e2); files.push(path);
            await api('/rest/v1/cn_partages', { m: 'POST', h: { Prefer: 'return=minimal' }, b: Object.assign({ kind: 'audio', groupe: grp, ordre: i + 1, titre: 'Audio : ' + (x.n || 'Enregistrement') + ' · ' + cur.cours, chap: '', sujet: x.n || '', html: '', nom: (x.n || 'Audio') + '.' + e2, fichier_path: path, mime: mime, taille: b.size }, r.d) });
          }
        }
        if (wd) for (var k = 0; k < (cur.docs || []).length; k++) {
          var d = cur.docs[k], bb = await fget('doc:' + d.id); if (!bb || bb.size > MAXB) { skip++; continue; }
          var pdf = d.t == 'pdf', m2 = bb.type || (pdf ? 'application/pdf' : DOCX), e3 = ext(m2, false, pdf), p3 = await upload(bb, m2, e3); files.push(p3);
          await api('/rest/v1/cn_partages', { m: 'POST', h: { Prefer: 'return=minimal' }, b: Object.assign({ kind: pdf ? 'pdf' : 'doc', groupe: grp, ordre: 0, titre: 'Document : ' + d.n + ' · ' + cur.cours, chap: '', sujet: d.n, html: '', nom: d.n + '.' + e3, fichier_path: p3, mime: m2, taille: bb.size }, r.d) });
        }
        toast('Cahier envoyé (' + cur.pages.length + ' page(s))' + (skip ? ' · ' + skip + ' fichier(s) non envoyé(s) (absent de cet appareil ou plus de 40 Mo)' : ''));
        o.remove();
      } catch (er) { files.forEach(delFile); toast(msg(er) + (n ? ' · envoi partiel, réessayez' : '')); btn.disabled = false; btn.textContent = '📥 Envoyer le cahier'; }
    };
  };
  function addBtn() {
    var box = document.querySelector('#v18tools .f') || document.querySelector('.f');
    if (!box || document.getElementById('v21b') || !cur) return;
    var b = document.createElement('button'); b.id = 'v21b'; b.textContent = '📤 Envoyer ce cahier à un collègue'; b.setAttribute('onclick', 'v21cahier()');
    box.insertBefore(b, box.firstChild);
  }
  var ob = window.openB;
  window.openB = function () {
    var r = ob.apply(this, arguments);
    [300, 1200, 2200].forEach(function (t) { setTimeout(function () { try { addBtn(); } catch (e) {} }, t); });
    return r;
  };

  /* ---------- 4. Réception : les cahiers arrivent groupés ---------- */
  var KI = { note: '📝', lecon: '📘', audio: '🎙', pdf: '📕', doc: '📄', page: '📄' };
  function groups(R) {
    var G = {}, out = [];
    R.forEach(function (x) { if (x.groupe) { (G[x.groupe] = G[x.groupe] || []).push(x); } else out.push({ one: x, t: new Date(x.cree_le).getTime() }); });
    Object.keys(G).forEach(function (k) { out.push({ g: k, rows: G[k], t: Math.max.apply(null, G[k].map(function (x) { return new Date(x.cree_le).getTime(); })) }); });
    return out.sort(function (a, b) { return b.t - a.t; });
  }
  window.v6inbox = async function () {
    app.innerHTML = '<header><button onclick=home()>‹</button><h1>Notes reçues</h1></header><div id=v6l><p class=hint>Chargement…</p></div>';
    try {
      await tok(); v6R = await api('/rest/v1/cn_partages?select=*&order=cree_le.desc&limit=400');
      $('#v6l').innerHTML = groups(v6R).map(function (e) {
        if (e.g) {
          var pg0 = e.rows.filter(function (x) { return x.kind == 'page'; }), au = e.rows.filter(function (x) { return x.kind == 'audio'; }).length, dc = e.rows.filter(function (x) { return x.kind == 'pdf' || x.kind == 'doc'; }).length;
          var cpl = pg0.reduce(function (s, x) { return s + ((x.meta && x.meta.cpl) || []).length; }, 0), f = e.rows[0];
          return '<div class=rs><b>📚 Cahier « ' + esc((pg0[0] && pg0[0].titre) || 'Cahier') + ' »</b><small>De ' + esc(f.de_email) + ' · ' + dt(f.cree_le) + '</small><span>' + pg0.length + ' page(s)' + (cpl ? ' · ' + cpl + ' note(s) complémentaire(s)' : '') + (au ? ' · ' + au + ' audio(s)' : '') + (dc ? ' · ' + dc + ' document(s)' : '') + '</span>' +
            '<div><button class=ch onclick="v21keepG(\'' + e.g + '\')">＋ Enregistrer le cahier</button><button class=ch onclick="v21dropG(\'' + e.g + '\')">Ignorer</button></div></div>';
        }
        var x = e.one, f2 = !!x.fichier_path;
        return '<div class=rs><b>' + (KI[x.kind] || '📝') + ' ' + esc(x.titre || 'Note') + '</b><small>De ' + esc(x.de_email) + ' · ' + dt(x.cree_le) + (f2 ? ' · ' + Math.max(1, Math.round((x.taille || 0) / 1024)) + ' Ko' : '') + '</small>' +
          (f2 ? '' : '<span>' + esc(txt(x.html).slice(0, 160)) + '…</span>') +
          '<div><button class=ch onclick="v6keep(\'' + x.id + '\')">＋ Enregistrer dans mon cahier</button><button class=ch onclick="v6drop(\'' + x.id + '\')">Ignorer</button></div></div>';
      }).join('') || '<p class=hint>Rien reçu. Quand un collègue vous envoie une page, un cahier, un audio ou un document, cela apparaît ici.</p>';
    } catch (er) { $('#v6l').innerHTML = '<p class=hint>Impossible de charger (hors ligne ?).</p>'; }
  };
  window.v6badge = async function () {
    if (!D.s || !D.ok) return;
    try { await tok(); var r = await api('/rest/v1/cn_partages?select=id,groupe&limit=400'), b = $('#v6ib'), s = {}, n = 0;
      r.forEach(function (x) { if (x.groupe) { if (!s[x.groupe]) { s[x.groupe] = 1; n++; } } else n++; });
      if (b && n) b.textContent = '📥 ' + n; } catch (e) {}
  };
  window.v21dropG = async function (g) {
    var rows = (v6R || []).filter(function (x) { return x.groupe == g; });
    for (var i = 0; i < rows.length; i++) if (rows[i].fichier_path) await delFile(rows[i].fichier_path);
    try { await api('/rest/v1/cn_partages?groupe=eq.' + encodeURIComponent(g), { m: 'DELETE' }); } catch (e) {}
    v6inbox();
  };
  window.v21keepG = async function (g) {
    var rows = (v6R || []).filter(function (x) { return x.groupe == g; }).sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
    var P = rows.filter(function (x) { return x.kind == 'page'; });
    if (!P.length) return toast('Cahier vide');
    try {
      var n = Date.now(), m0 = P[0].meta || {}, c = { id: uid(), cours: m0.cours || P[0].titre || 'Cahier reçu', prof: m0.prof || ('De ' + P[0].de_email), color: m0.color || COL[4], pages: [], docs: [], u: n, d: 1 };
      if (D.c.some(function (k) { return !k.del && k.cours == c.cours; })) c.cours += ' (reçu)';
      var byIdx = {};
      P.forEach(function (x) {
        var m = x.meta || {}, pgo = { id: uid(), chap: x.chap || '', sujet: x.sujet || '', start: m.start || n, end: m.end || n, html: clean(x.html || ''), u: n, d: 1 };
        if (m.tags && m.tags.length) pgo.tags = m.tags;
        if (m.cpl && m.cpl.length) pgo.cpl = m.cpl.map(function (z) { return { id: uid(), t: z.t || 'Complément', h: clean(z.h || ''), k: z.k || 'ia', d: n }; });
        c.pages.push(pgo); byIdx[x.ordre] = pgo;
      });
      var F = rows.filter(function (x) { return x.kind != 'page'; });
      for (var i = 0; i < F.length; i++) {
        var x = F[i], r = await fetch(SB + '/storage/v1/object/authenticated/cn-partages/' + x.fichier_path, { headers: stH() });
        if (!r.ok) throw 0;
        var b = await r.blob(), fid = uid(), nm = (x.nom || '').replace(/\.[^.]+$/, '') || x.sujet || 'Fichier reçu', mime = x.mime || b.type;
        if (x.kind == 'audio') {
          await fput(fid, new Blob([b], { type: mime || 'audio/webm' }));
          var tp = byIdx[x.ordre] || c.pages[0]; (tp.att = tp.att || []).push({ id: fid, k: 'a', n: nm, t: n, d: 1, m: mime || 'audio/webm' });
        } else {
          await v8put('doc:' + fid, new Blob([b], { type: mime }));
          c.docs.push({ id: fid, n: nm, t: x.kind == 'pdf' ? 'pdf' : 'docx', s: b.size, a: n });
        }
      }
      D.c.unshift(c); raw();
      for (var j = 0; j < F.length; j++) await delFile(F[j].fichier_path);
      try { await api('/rest/v1/cn_partages?groupe=eq.' + encodeURIComponent(g), { m: 'DELETE' }); } catch (e) {}
      toast('Cahier « ' + c.cours + ' » enregistré'); setTimeout(sync, 500); home();
    } catch (e) { toast('Impossible de récupérer le cahier (hors ligne ?)'); }
  };
})();
