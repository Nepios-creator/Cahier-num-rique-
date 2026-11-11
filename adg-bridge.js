/* ADG Ambassadeurs — pont avec le Cahier numérique (v2).
   Après la création du compte, le client choisit : 1. Avec un ambassadeur  2. Sans ambassadeur.
   - Avec : il choisit le code de son ambassadeur, qui reçoit un formulaire à remplir dans ADG.
   - Sans : il paie par mobile money (numéros gérés dans ADG), puis envoie sa preuve.
   L'administration valide dans ADG ; le compte du Cahier se débloque alors tout seul (cn_adg_sync).
   À charger APRÈS v12.js. */
(function () {
  'use strict';
  var U = 'https://kearpnvypzztnnltmrpp.supabase.co';
  var K = 'sb_publishable_whfpzyuXH1Qup_q2h5wPdg_QY9uKqpA';
  var APP = 'Cahier numérique';
  var LS = 'adg-link-v2';
  var oapi = window.api, ovw = window.v6wait, og = window.v6gate;
  var info = { price: 4, currency: '$', pay_info: '' }, lastSt = '';

  var E = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $$ = function (s) { return document.querySelector(s); };
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return ''; };
  var email = function () { try { return D.s.email; } catch (e) { return ''; } };
  var say = function (m) { try { if (typeof toast === 'function') return toast(m); } catch (e) {} alert(m); };

  /* ---------- Réseau ADG ---------- */
  function rpc(fn, body) {
    return fetch(U + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.text().then(function (t) { var j; try { j = JSON.parse(t); } catch (e) { j = t; } if (!r.ok) throw new Error((j && j.message) || 'adg'); return j; }); });
  }
  function shrink(file) {
    return createImageBitmap(file).then(function (bm) {
      var k = Math.min(1, 1280 / Math.max(bm.width, bm.height)), c = document.createElement('canvas');
      c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
      c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.82); });
    }).catch(function () { return file; });
  }
  function upload(file) {
    return shrink(file).then(function (blob) {
      var ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[blob.type];
      if (!ext) throw new Error('Utilisez une capture d’écran (JPG ou PNG).');
      if (blob.size > 3 * 1024 * 1024) throw new Error('Image trop lourde.');
      var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);
      var name = id + '.' + ext;
      return fetch(U + '/storage/v1/object/proofs/' + name, { method: 'POST', headers: { apikey: K, 'Content-Type': blob.type, 'x-upsert': 'false' }, body: blob })
        .then(function (r) { if (!r.ok) throw new Error('Envoi de l’image impossible. Réessayez.'); return U + '/storage/v1/object/public/proofs/' + name; });
    });
  }

  /* ---------- Lien entre ce compte et la demande ADG ---------- */
  function getLink() { try { var l = JSON.parse(ls(LS)); return l && l.email === email() ? l : null; } catch (e) { return null; } }
  function setLink(l) { l.email = email(); ls(LS, JSON.stringify(l)); if (typeof oapi === 'function') oapi('/rest/v1/rpc/cn_adg_link', { m: 'POST', b: { p_sale: l.id } }).catch(function () {}); }

  /* ---------- Écrans ---------- */
  var head = function (t) { return '<div class=top><img class=lg src=icon-192.png alt=""><h1>' + t + '</h1></div>'; };
  var priceHtml = function () {
    return '<small>Prix de l’application</small><h3>' + E(info.price) + ' ' + E(info.currency) + '</h3>' + (info.pay_info ? '<small>' + E(info.pay_info) + '</small>' : '');
  };
  function loadInfo() {
    rpc('get_app_info', { p_app_name: APP }).then(function (r) { if (r && r[0]) { info = r[0]; var b = $$('#adgprice'); if (b) b.innerHTML = priceHtml(); } }).catch(function () {});
  }
  function render() {
    var l = getLink(); if (l) return waitScreen(l);
    app.innerHTML = head('Activez votre Cahier') + '<div class=f><div class=card id=adgprice>' + priceHtml() + '</div>' +
      '<p>Compte : <b>' + E(email()) + '</b><br>Comment souhaitez-vous payer ?</p>' +
      '<button class=p onclick="adgOpt(1)">1. Avec un ambassadeur</button><button class=p style="margin-top:8px" onclick="adgOpt(2)">2. Sans ambassadeur</button>' +
      '<button onclick="v6out()">Se déconnecter</button></div>';
    loadInfo();
  }
  window.v6wait = function () { if (typeof D !== 'undefined' && D.stt === 'suspendu' && ovw) return ovw.apply(this, arguments); render(); };

  window.adgOpt = function (n) { if (n === 1) optAmb(); else optDirect(); };

  /* --- 1. Avec un ambassadeur --- */
  var codes = [];
  function optAmb() {
    app.innerHTML = head('Choisir mon ambassadeur') + '<div class=f><p>Choisissez le code de votre ambassadeur. Il recevra votre demande et remplira votre formulaire.</p>' +
      '<input id=adgq placeholder="Rechercher un code (ex: AMB-…)" autocapitalize=characters autocomplete=off oninput="adgFilter()"><div id=adgl><p class=hint>Chargement…</p></div>' +
      '<button onclick="v6wait()">Retour</button></div>';
    rpc('list_ambassadors').then(function (r) { codes = (r || []).map(function (x) { return x.code; }); adgFilter(); }).catch(function () { var l = $$('#adgl'); if (l) l.innerHTML = '<p class=hint>Connexion impossible, réessayez.</p>'; });
  }
  window.adgFilter = function () {
    var q = (($$('#adgq') || {}).value || '').toUpperCase().trim(), l = $$('#adgl'); if (!l) return;
    var f = codes.filter(function (c) { return !q || c.indexOf(q) > -1; });
    l.innerHTML = f.length ? f.map(function (c) { return '<button class=card style="display:block;width:100%;text-align:left;margin:6px 0" onclick="adgPick(\'' + E(c) + '\')"><b>' + E(c) + '</b></button>'; }).join('') : '<p class=hint>Aucun ambassadeur trouvé.</p>';
  };
  window.adgPick = function (code) {
    if (!confirm('Choisir l’ambassadeur ' + code + ' ?')) return;
    app.innerHTML = '<p class=hint style="padding:60px 0;text-align:center">Envoi de votre demande…</p>';
    rpc('create_client_request', { p_app_name: APP, p_code: code, p_client_email: email() }).then(function (rid) {
      setLink({ id: rid, kind: 'amb', code: code }); render();
    }).catch(function () { say('Envoi impossible : vérifiez votre connexion et réessayez'); optAmb(); });
  };

  /* --- 2. Sans ambassadeur : mobile money --- */
  function optDirect() {
    app.innerHTML = head('Paiement mobile money') + '<div class=f><div class=card id=adgprice>' + priceHtml() + '</div>' +
      '<label>Numéro de paiement<input id=adgnum readonly placeholder="Touchez pour voir les numéros" onclick="adgNums()"></label><div id=adgnums hidden></div>' +
      '<p class=hint>Indiquez l’adresse e-mail de votre compte avec le paiement.</p>' +
      '<label>Nom complet<input id=adgn autocomplete=name></label>' +
      '<label>Numéro de téléphone<input id=adgt type=tel inputmode=tel autocomplete=tel></label>' +
      '<label>Capture d’écran de la preuve de paiement (obligatoire)<input id=adgf type=file accept="image/*"></label>' +
      '<button class=p id=adgs onclick="adgSend()">Envoyer ma preuve</button><button onclick="v6wait()">Retour</button></div>';
    loadInfo();
  }
  window.adgNums = function () {
    var b = $$('#adgnums'); if (!b) return;
    if (!b.hidden) { b.hidden = true; return; }
    b.hidden = false; b.innerHTML = '<p class=hint>Chargement…</p>';
    rpc('get_payment_numbers').then(function (r) {
      if (!r || !r.length) { b.innerHTML = '<p class=hint>Aucun numéro disponible pour le moment. Contactez answerdigitalofficiel@gmail.com.</p>'; return; }
      var by = {}; r.forEach(function (x) { (by[x.network] = by[x.network] || []).push(x); });
      b.innerHTML = Object.keys(by).map(function (n) {
        return '<div class=card><small>' + E(n) + '</small>' + by[n].map(function (x) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px"><div><h3 style="margin:0">' + E(x.number) + '</h3>' + (x.label ? '<small>' + E(x.label) + '</small>' : '') + '</div><button type=button style="width:auto;padding:8px 14px" onclick="adgCopy(\'' + E(x.number) + '\',this)">Copier</button></div>';
        }).join('') + '</div>';
      }).join('');
    }).catch(function () { b.innerHTML = '<p class=hint>Connexion impossible, réessayez.</p>'; });
  };
  window.adgCopy = function (num, btn) {
    var done = function () { btn.textContent = 'Copié ✓'; var i = $$('#adgnum'); if (i) i.value = num; setTimeout(function () { btn.textContent = 'Copier'; }, 2000); };
    try { navigator.clipboard.writeText(num).then(done, function () { fb(); }); } catch (e) { fb(); }
    function fb() { var t = document.createElement('textarea'); t.value = num; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); done(); }
  };
  window.adgSend = function () {
    var n = ($$('#adgn').value || '').trim(), t = ($$('#adgt').value || '').trim(), f = ($$('#adgf').files || [])[0];
    if (n.length < 3) return say('Indiquez votre nom complet');
    if (t.replace(/\D/g, '').length < 8) return say('Indiquez un numéro de téléphone valide');
    if (!f) return say('Ajoutez la capture d’écran de votre paiement');
    var b = $$('#adgs'); b.disabled = true; b.textContent = 'Envoi en cours…';
    upload(f).then(function (url) {
      return rpc('register_sale', { p_ref_code: '', p_app_name: APP, p_client_name: n, p_client_phone: t, p_method: 'mobile_money', p_amount: null, p_proof_url: url });
    }).then(function (sid) { setLink({ id: sid, kind: 'direct' }); render(); })
      .catch(function (e) { b.disabled = false; b.textContent = 'Envoyer ma preuve'; say(/Image|capture|Utilisez/.test(e.message || '') ? e.message : 'Envoi impossible : vérifiez votre connexion et réessayez'); });
  };

  /* --- Attente de validation --- */
  function waitScreen(l) {
    app.innerHTML = head(l.kind === 'amb' ? 'Demande envoyée' : 'Preuve envoyée') + '<div class=f><div class=card><h3 id=adgst>Vérification…</h3>' +
      '<small>' + (l.kind === 'amb' ? 'Ambassadeur : ' + E(l.code) + '. ' : '') + 'Votre accès s’ouvrira automatiquement dès que l’administration aura validé votre paiement.</small><br><small>Compte : ' + E(email()) + '</small></div>' +
      '<button class=p onclick="adgCheck(1)">Vérifier mon accès</button><button id=adgreset onclick="adgReset()" hidden>Recommencer</button><button onclick="v6out()">Se déconnecter</button></div>';
    adgCheck();
  }
  var TXT = {
    awaiting_form: function (l) { return '⏳ ' + (l.code ? 'Votre ambassadeur ' + E(l.code) + ' a été notifié et va remplir votre formulaire.' : 'En attente.'); },
    pending: function () { return '⏳ Formulaire reçu : en attente de validation de l’administration.'; },
    validated: function () { return '✅ Paiement validé ! Ouverture…'; },
    rejected: function () { return '❌ Demande refusée. Vous pouvez recommencer.'; },
    unknown: function () { return 'Demande introuvable. Vous pouvez recommencer.'; }
  };
  window.adgCheck = function (manual) {
    var l = getLink(), el = $$('#adgst'); if (!l || !el) return;
    rpc('get_link_status', { p_id: l.id }).then(function (st) {
      st = String(st); lastSt = st; var e2 = $$('#adgst'); if (!e2) return;
      e2.innerHTML = (TXT[st] || TXT.unknown)(l);
      var rb = $$('#adgreset'); if (rb) rb.hidden = !(st === 'rejected' || st === 'unknown' || st === 'awaiting_form');
      if (st === 'validated' && typeof window.v6gate === 'function') window.v6gate();
    }).catch(function () { if (manual) say('Pas de connexion. Réessayez.'); });
  };
  window.adgReset = function () {
    if (lastSt === 'awaiting_form' && !confirm('Annuler cette demande et choisir une autre option ?')) return;
    ls(LS, null); render();
  };
  setInterval(function () { if (!document.hidden && $$('#adgst')) window.adgCheck(); }, 8000);

  /* ---------- Déblocage : le serveur du Cahier interroge ADG avant de lire le statut ---------- */
  function sync() {
    try { if (!D || !D.s || D.ok || typeof oapi !== 'function') return Promise.resolve(); } catch (e) { return Promise.resolve(); }
    return oapi('/rest/v1/rpc/cn_adg_sync', { m: 'POST', b: {} }).catch(function () {});
  }
  if (typeof og === 'function') window.v6gate = async function () { await sync(); return og.apply(this, arguments); };

  /* ---------- Afficher / masquer le mot de passe (connexion et inscription du Cahier) ---------- */
  function eyes() {
    var list = document.querySelectorAll('input[type=password]');
    for (var k = 0; k < list.length; k++) (function (i) {
      if (i.dataset.eye) return; i.dataset.eye = 1;
      var w = document.createElement('span'); w.style.cssText = 'position:relative;display:block';
      i.parentNode.insertBefore(w, i); w.appendChild(i); i.style.paddingRight = '46px';
      var b = document.createElement('button'); b.type = 'button'; b.textContent = '👁'; b.setAttribute('aria-label', 'Afficher ou masquer le mot de passe');
      b.style.cssText = 'position:absolute;right:4px;top:50%;transform:translateY(-50%);background:none;border:0;font-size:18px;padding:8px;width:auto;min-width:0;margin:0;color:inherit;box-shadow:none';
      b.onclick = function () { var s = i.type === 'password'; i.type = s ? 'text' : 'password'; b.textContent = s ? '🙈' : '👁'; };
      w.appendChild(b);
    })(list[k]);
  }
  try { new MutationObserver(eyes).observe(document.body || document.documentElement, { childList: true, subtree: true }); eyes(); } catch (e) {}
})();
