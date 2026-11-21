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
  /* Pastilles aux couleurs des réseaux (dessin simplifié, pas le logo officiel). */
  function logo(k) {
    var s = '<svg viewBox="0 0 56 56" width="52" height="52" aria-hidden="true">';
    if (k === 'AIRTEL_MONEY_DRC') s += '<rect width="56" height="56" rx="14" fill="#e40000"/><text x="28" y="34" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="15" fill="#fff">airtel</text>';
    else if (k === 'MPESA_DRC') s += '<rect width="56" height="56" rx="14" fill="#1faa4b"/><text x="28" y="33" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="13" fill="#fff">M-PESA</text>';
    else s += '<rect width="56" height="56" rx="6" fill="#ff7900"/><text x="5" y="51" font-family="Arial,sans-serif" font-weight="700" font-size="11" fill="#fff">orange</text>';
    return s + '</svg>';
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
