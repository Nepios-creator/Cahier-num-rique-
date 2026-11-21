/* v32 : paiement de l’accès au Cahier par mobile money (Fondeka). À charger après v6.js et adg-bridge.js.
   Parcours : un seul bouton « Payer l’abonnement » -> formule (mensuel, trimestriel, annuel ; francs ou dollars) -> code ambassadeur (facultatif)
   -> opérateur -> numéro mobile money -> confirmation du code PIN sur le téléphone -> l’application s’ouvre.
   Plus de choix « avec / sans ambassadeur ». Le code ambassadeur est transmis au serveur, qui lie la vente à l’ambassadeur (ADG).
   L’accès est ouvert par le webhook Fondeka (fonction « cn-fondeka-webhook »), jamais par le navigateur.
   À chaque ouverture, la date limite de l’accès est vérifiée (fonction serveur cn_acces_verifier). Aucun format de données modifié. */
(function () {
  'use strict';
  var PL = { m: { l: 'Mensuel', d: '30 jours' }, t: { l: 'Trimestriel', d: '90 jours' }, a: { l: 'Annuel', d: '365 jours' } };
  var OPS = [{ k: 'AIRTEL_MONEY_DRC', l: 'Airtel Money' }, { k: 'MPESA_DRC', l: 'M-Pesa' }, { k: 'ORANGE_MONEY_DRC', l: 'Orange Money' }];
  var PREFIX = '+243', POLL_MS = 5000, POLL_MAX = 60;   /* vérification toutes les 5 s pendant 5 minutes */
  var Q = null, QL = false, RUN = 0, S = { plan: 'm', cur: 'CDF', code: '', op: 'AIRTEL_MONEY_DRC', phone: '' };
  var $$ = function (s) { return document.querySelector(s); };
  var on = function (s, f) { var e = $$(s); if (e) e.onclick = f; };

  function css() {
    if ($$('#s32')) return;
    var s = document.createElement('style'); s.id = 's32';
    s.textContent = '.w32{display:grid;gap:12px;margin:10px 0}.w32 button.p{padding:16px;font-size:17px}' +
      '.dots32{display:flex;align-items:center;gap:6px}.dots32 i{width:26px;height:6px;border-radius:3px;background:var(--line)}.dots32 i.on{background:var(--acc)}.dots32 small{margin-left:auto;color:var(--mut)}' +
      '.seg32{display:flex;gap:4px;padding:4px;border-radius:16px;background:var(--card);border:1px solid var(--line)}.seg32 button{flex:1;border:0;box-shadow:none;background:transparent;padding:10px}.seg32 button.on{background:var(--acc);color:#fff}' +
      '.pl32,.op32{position:relative;display:flex;align-items:center;gap:14px;padding:16px;border-radius:20px;border:2px solid var(--line);background:var(--card);cursor:pointer}' +
      '.pl32.on,.op32.on{border-color:var(--acc);box-shadow:0 8px 22px #6366f133}.pl32 b,.op32 b{font:800 17px system-ui}.pl32 small{color:var(--mut)}' +
      '.pr32{margin-left:auto;text-align:right;display:grid}.pr32 b{font:800 20px system-ui}' +
      '.bd32{position:absolute;top:-10px;right:14px;background:#10b981;color:#fff;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px}' +
      '.ck32{margin-left:auto;width:26px;height:26px;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;font-size:14px;color:#fff}.op32.on .ck32{background:var(--acc);border-color:var(--acc)}' +
      '.rc32{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}.rc32:last-child{border-bottom:0}' +
      '.sp32{width:48px;height:48px;margin:6px auto 12px;border:5px solid var(--line);border-top-color:var(--acc);border-radius:50%;animation:r32 1s linear infinite}@keyframes r32{to{transform:rotate(360deg)}}' +
      '.ok32{width:64px;height:64px;margin:6px auto 10px;border-radius:50%;background:#10b981;color:#fff;display:grid;place-items:center;font-size:34px}';
    document.head.appendChild(s);
  }
  function say(t) { try { toast(t); } catch (e) {} }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fc(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FC'; }
  function usd(n) { return Number(n).toFixed(2).replace('.', ',') + ' $'; }
  function money(v, cur) { return v == null ? '…' : (cur === 'CDF' ? fc(v) : usd(v)); }
  function norm(v) {
    v = String(v || '').replace(/[\s().-]/g, '');
    if (/^\+/.test(v)) return v;
    if (/^00/.test(v)) return '+' + v.slice(2);
    if (/^243/.test(v)) return '+' + v;
    if (/^0[0-9]{9}$/.test(v)) return PREFIX + v.slice(1);
    if (/^[1-9][0-9]{8}$/.test(v)) return PREFIX + v;
    return v;
  }
  function validPhone(v) { return /^\+[1-9][0-9]{7,14}$/.test(v); }
  function errText(code, j) {
    var e = j && j.error;
    if (code === 401 || e === 'non_connecte') return 'Reconnectez-vous puis réessayez.';
    if (e === 'telephone_invalide') return 'Numéro invalide. Exemple : +243 81 234 5678.';
    if (e === 'moyen_invalide' || e === 'formule_invalide') return 'Choix invalide, réessayez.';
    if (e === 'code_invalide') return 'Code ambassadeur invalide (lettres, chiffres, - ou _).';
    if (e === 'trop_de_demandes') return 'Trop de demandes. Patientez une minute puis réessayez.';
    if (e === 'fondeka_non_configure') return 'Le paiement n’est pas encore activé côté serveur.';
    if (e === 'taux_indisponible') return 'Taux du dollar indisponible. Réessayez ou choisissez le franc (FC).';
    if (e === 'fondeka') return 'Fondeka a refusé la demande' + (j.detail ? ' : ' + j.detail : '') + '.';
    return 'Paiement indisponible pour le moment. Réessayez.';
  }
  function head(t) { return '<div class=top><img class=lg src=icon-192.png alt=""><h1>' + t + '</h1></div>'; }
  function fx(body) {
    return tok().then(function () {
      return fetch(SB + '/functions/v1/cn-fondeka-checkout', {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + D.s.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    });
  }
  function loadQ(done) {
    if (Q || QL) { if (done) done(); return; }
    QL = true;
    fx({ quote: true }).then(function (r) { return r.json().then(function (q) { return { ok: r.ok, q: q }; }); }).then(function (o) {
      if (o.ok && o.q && o.q.plans) Q = o.q;
    }).catch(function () {}).then(function () { QL = false; if (done) done(); });
  }
  function price(pk, cur) { var p = Q && Q.plans && Q.plans[pk]; if (!p) return null; return cur === 'CDF' ? p.cdf : p.usd; }
  function saving(pk) {
    var m = price('m', 'CDF'), p = price(pk, 'CDF'); if (!m || !p || pk === 'm') return 0;
    var v = Math.round((1 - p / ((pk === 't' ? 3 : 12) * m)) * 100); return v > 0 ? v : 0;
  }
  function adgLink() {
    try { var l = JSON.parse(localStorage.getItem('adg-link-v2')); return l && D.s && l.email === D.s.email ? l : null; } catch (e) { return null; }
  }
  /* Logos des réseaux (Airtel Money, M-Pesa, Orange Money), intégrés dans le fichier. */
  var LOGOS32 = {
    AIRTEL_MONEY_DRC: 'data:image/png;base64,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',
    MPESA_DRC: 'data:image/png;base64,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',
    ORANGE_MONEY_DRC: 'data:image/png;base64,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'
  };
  function logo(k) {
    return '<img src="' + (LOGOS32[k] || LOGOS32.ORANGE_MONEY_DRC) + '" width="52" height="52" alt="" style="width:52px;height:52px;object-fit:contain;border-radius:12px;background:#fff;flex:none">';
  }
  function frame(n, title, html) {
    css();
    app.innerHTML = head(title) + '<div class="w32"><div class="dots32">' + [1, 2, 3, 4].map(function (i) { return '<i class="' + (i <= n ? 'on' : '') + '"></i>'; }).join('') +
      '<small>Étape ' + n + ' sur 4</small></div>' + html + '</div>';
  }

  /* Écran d’accueil : un seul bouton */
  function home0() {
    RUN++; css(); loadQ(function () { var h = $$('#h32'); if (h && Q && Q.plans && Q.plans.m) h.textContent = 'Dès ' + fc(Q.plans.m.cdf); });
    app.innerHTML = head('Activez votre Cahier') + '<div class="w32"><div class="card"><small>Abonnement au Cahier numérique</small><h3 id="h32">Abonnement</h3><small>Mensuel, trimestriel ou annuel · paiement par mobile money (Airtel, M-Pesa, Orange)</small></div>' +
      '<p class="hint" id="e32"></p><button class="p" id="pay32">💳 Payer l’abonnement</button><button id="out32">Se déconnecter</button>' +
      '<p class="hint">Besoin d’aide ? answerdigitalofficiel@gmail.com</p></div>';
    on('#pay32', st1);
    on('#out32', function () { if (typeof window.v6out === 'function') window.v6out(); });
    try {
      tok().then(function () { return api('/rest/v1/rpc/cn_mon_acces', { m: 'POST', b: {} }); }).then(function (a) {
        var e = $$('#e32');
        if (e && a && a.acces_jusqu && new Date(a.acces_jusqu).getTime() < Date.now()) e.textContent = 'Votre accès a pris fin le ' + new Date(a.acces_jusqu).toLocaleDateString('fr-FR') + '. Renouvelez votre abonnement pour continuer.';
      }).catch(function () {});
    } catch (e) {}
  }

  /* Étape 1 : formule et devise */
  function st1() {
    var run = ++RUN;
    if (!Q) loadQ(function () { if (Q && run === RUN && $$('#n32')) st1(); });
    var alt = S.cur === 'CDF' ? 'USD' : 'CDF';
    var cards = ['m', 't', 'a'].map(function (k) {
      var sv = saving(k), a = price(k, alt);
      return '<div class="pl32' + (S.plan === k ? ' on' : '') + '" data-k="' + k + '">' + (k === 'a' ? '<i class="bd32">Meilleure offre</i>' : '') +
        '<div><b>' + PL[k].l + '</b><br><small>' + PL[k].d + (sv ? ' · −' + sv + ' %' : '') + '</small></div>' +
        '<div class="pr32"><b>' + money(price(k, S.cur), S.cur) + '</b><small>' + (a != null ? '≈ ' + money(a, alt) : '') + '</small></div></div>';
    }).join('');
    frame(1, 'Choisissez votre formule', '<div class="seg32"><button data-c="CDF" class="' + (S.cur === 'CDF' ? 'on' : '') + '">Francs (FC)</button><button data-c="USD" class="' + (S.cur === 'USD' ? 'on' : '') + '">Dollars ($)</button></div>' +
      cards + '<p class="hint">' + (Q && Q.rate ? 'Taux du jour : 1 $ = ' + fc(Q.rate) + '. ' : '') + 'Les montants dans l’autre devise suivent le taux du jour.</p><button class="p" id="n32">Continuer</button><button id="b32">Retour</button>');
    Array.prototype.forEach.call(document.querySelectorAll('.seg32 button'), function (b) { b.onclick = function () { S.cur = b.getAttribute('data-c'); st1(); }; });
    Array.prototype.forEach.call(document.querySelectorAll('.pl32'), function (c) { c.onclick = function () { S.plan = c.getAttribute('data-k'); st1(); }; });
    on('#n32', st2); on('#b32', home0);
  }

  /* Étape 2 : code ambassadeur (facultatif) */
  function st2() {
    RUN++;
    frame(2, 'Code ambassadeur', '<div class="card"><label>Code ambassadeur <small>(facultatif)</small><input id="c32" maxlength="30" autocapitalize="characters" autocomplete="off" placeholder="Ex. : ABC123" value="' + esc(S.code) + '"></label>' +
      '<p class="hint">Si un ambassadeur vous a présenté le Cahier, saisissez son code. Sinon, passez simplement à l’étape suivante.</p></div><p class="hint" id="m32"></p>' +
      '<button class="p" id="n32">Continuer</button><button id="b32">Retour</button>');
    on('#n32', function () {
      var c = ($$('#c32').value || '').trim().toUpperCase();
      if (c && !/^[A-Z0-9_-]{2,30}$/.test(c)) { $$('#m32').textContent = errText(0, { error: 'code_invalide' }); return; }
      S.code = c; st3();
    });
    on('#b32', st1);
  }

  /* Étape 3 : opérateur */
  function st3() {
    RUN++;
    frame(3, 'Votre opérateur', OPS.map(function (o) {
      return '<div class="op32' + (S.op === o.k ? ' on' : '') + '" data-k="' + o.k + '">' + logo(o.k) + '<b>' + o.l + '</b><span class="ck32">' + (S.op === o.k ? '✓' : '') + '</span></div>';
    }).join('') + '<button class="p" id="n32">Continuer</button><button id="b32">Retour</button>');
    Array.prototype.forEach.call(document.querySelectorAll('.op32'), function (c) { c.onclick = function () { S.op = c.getAttribute('data-k'); st3(); }; });
    on('#n32', st4); on('#b32', st2);
  }

  /* Étape 4 : numéro, récapitulatif et confirmation */
  function st4() {
    RUN++;
    var o = OPS.filter(function (x) { return x.k === S.op; })[0];
    frame(4, 'Confirmer le paiement', '<div class="card"><small>Récapitulatif</small>' +
      '<div class="rc32"><span>Formule</span><b>' + PL[S.plan].l + ' · ' + PL[S.plan].d + '</b></div>' +
      '<div class="rc32"><span>Opérateur</span><b>' + o.l + '</b></div>' + (S.code ? '<div class="rc32"><span>Code ambassadeur</span><b>' + esc(S.code) + '</b></div>' : '') +
      '<div class="rc32"><span>Montant</span><b>' + money(price(S.plan, S.cur), S.cur) + '</b></div></div>' +
      '<label>Numéro mobile money<input id="t32" type="tel" inputmode="tel" autocomplete="tel" placeholder="+243 81 234 5678" value="' + esc(S.phone) + '"></label>' +
      '<p class="hint">Vous recevrez une demande de confirmation sur ce numéro : saisissez votre code PIN mobile money pour valider le paiement.</p><p class="hint" id="m32"></p>' +
      '<button class="p" id="g32">Confirmer le paiement</button><button id="b32">Retour</button>');
    on('#b32', st3);
    var busy = false;
    on('#g32', async function () {
      if (busy) return;
      var phone = norm($$('#t32').value), msg = $$('#m32'), go = $$('#g32');
      S.phone = $$('#t32').value;
      if (!validPhone(phone)) { msg.textContent = 'Numéro invalide. Exemple : +243 81 234 5678.'; return; }
      busy = true; go.disabled = true; msg.textContent = 'Envoi de la demande…';
      try {
        var r = await fx({ phone: phone, method: S.op + (S.cur === 'CDF' ? '_CDF' : ''), plan: S.plan, ref_code: S.code });
        var j = {}; try { j = await r.json(); } catch (e) {}
        if (!r.ok || !j.order_reference) { msg.textContent = errText(r.status, j); busy = false; go.disabled = false; return; }
        waiting(j.order_reference, j.currency === 'CDF' ? fc(j.amount) : usd(j.amount), phone);
      } catch (e) { msg.textContent = 'Paiement indisponible : vérifiez votre connexion.'; busy = false; go.disabled = false; }
    });
  }

  /* Attente de la confirmation sur le téléphone, puis ouverture de l’application */
  async function waiting(order, amountTxt, phone) {
    var run = ++RUN;
    app.innerHTML = head('Validez sur votre téléphone') + '<div class="w32"><div class="card" style="text-align:center" id="c32"><div class="sp32"></div><h3>En attente de votre confirmation</h3>' +
      '<p class="hint">Une demande de ' + amountTxt + ' vient d’être envoyée au ' + esc(phone) + '. Saisissez votre code PIN mobile money pour confirmer.</p></div><p class="hint" id="m32"></p>' +
      '<button id="v32">J’ai payé · vérifier mon accès</button><button id="b32">Annuler</button></div>';
    on('#v32', function () { if (typeof window.v6gate === 'function') window.v6gate(); });
    on('#b32', st4);
    for (var i = 0; i < POLL_MAX; i++) {
      await sleep(POLL_MS);
      if (run !== RUN) return;   /* l’écran a changé : on arrête */
      try {
        await tok();
        var rows = await api('/rest/v1/cn_fondeka_payments?select=status&order_reference=eq.' + encodeURIComponent(order));
        if (rows && rows[0] && rows[0].status === 'failed') {
          var m = $$('#m32'); if (m) m.textContent = 'Paiement refusé ou annulé. Touchez Annuler pour réessayer.';
          var sp = $$('.sp32'); if (sp) sp.style.display = 'none';
          return;
        }
        var a = await api('/rest/v1/rpc/cn_mon_acces', { m: 'POST', b: {} });
        if (a && a.statut === 'valide') {
          app.innerHTML = head('Paiement confirmé') + '<div class="w32"><div class="card" style="text-align:center"><div class="ok32">✓</div><h3>Paiement confirmé</h3><p class="hint">Votre abonnement est actif. Ouverture de votre cahier…</p></div></div>';
          setTimeout(function () { if (typeof window.v6gate === 'function') window.v6gate(); }, 1200);
          return;
        }
      } catch (e) {}
    }
    if (run === RUN) { var m2 = $$('#m32'); if (m2) m2.textContent = 'Pas encore de confirmation. Si vous avez validé le paiement, l’accès s’ouvre automatiquement : touchez « J’ai payé » dans quelques minutes.'; }
  }

  /* L’écran d’attente d’accès ouvre directement le parcours de paiement (plus de choix avec / sans ambassadeur).
     Seules les personnes qui ont déjà envoyé une demande ADG gardent leur écran d’attente, avec un bouton pour payer en ligne. */
  var ow = window.v6wait;
  window.v6wait = function () {
    try {
      if (D && D.stt === 'suspendu') return ow ? ow.apply(this, arguments) : undefined;
      if (adgLink() && ow) {
        var r = ow.apply(this, arguments);
        var f = $$('#app .f');
        if (f && !$$('#x32')) {
          var b = document.createElement('button'); b.id = 'x32'; b.className = 'p'; b.type = 'button';
          b.textContent = '💳 Payer l’abonnement'; b.onclick = st1; f.insertBefore(b, f.firstChild);
        }
        return r;
      }
    } catch (e) {}
    return home0();
  };
  window.adgOpt = function () { return st1(); };
  var oR = window.adgReset;
  if (typeof oR === 'function') window.adgReset = function () { oR.apply(this, arguments); try { if (!adgLink()) home0(); } catch (e) {} };

  /* À chaque ouverture : un accès dont la date limite est dépassée repasse en attente avant la lecture du statut. */
  var og = window.v6gate;
  if (typeof og === 'function') window.v6gate = async function () {
    try { if (D && D.s) { await tok(); await api('/rest/v1/rpc/cn_acces_verifier', { m: 'POST', b: {} }); } } catch (e) {}
    return og.apply(this, arguments);
  };

  window.cnPay32 = { open: home0 };
})();
