/* v32 : paiement de l’accès au Cahier par mobile money (Fondeka). À charger après v6.js et adg-bridge.js.
   Remplace l’option « Sans ambassadeur » (paiement manuel avec preuve) par un paiement en ligne automatique : 4000 FC pour 30 jours (ou l’équivalent en dollars).
   L’option « Avec un ambassadeur » reste inchangée. L’accès est ouvert par le webhook Fondeka (fonction « cn-fondeka-webhook »), jamais par le navigateur.
   À chaque ouverture, la date limite de l’accès est vérifiée (fonction serveur cn_acces_verifier). Aucun format de données modifié. */
(function () {
  'use strict';
  var METHODS = [
    { n: 'AIRTEL_MONEY_DRC_CDF', l: 'Airtel Money — francs (FC)' },
    { n: 'MPESA_DRC_CDF', l: 'M-Pesa — francs (FC)' },
    { n: 'ORANGE_MONEY_DRC_CDF', l: 'Orange Money — francs (FC)' },
    { n: 'AIRTEL_MONEY_DRC', l: 'Airtel Money — dollars ($)' },
    { n: 'MPESA_DRC', l: 'M-Pesa — dollars ($)' },
    { n: 'ORANGE_MONEY_DRC', l: 'Orange Money — dollars ($)' },
  ];
  var PREFIX = '+243', POLL_MS = 5000, POLL_MAX = 60;   /* vérification toutes les 5 s pendant 5 minutes */
  var $$ = function (s) { return document.querySelector(s); };

  function say(t) { try { toast(t); } catch (e) {} }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
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
    if (e === 'moyen_invalide') return 'Moyen de paiement invalide.';
    if (e === 'trop_de_demandes') return 'Trop de demandes. Patientez une minute puis réessayez.';
    if (e === 'fondeka_non_configure') return 'Le paiement n’est pas encore activé côté serveur.';
    if (e === 'taux_indisponible') return 'Taux du dollar indisponible. Réessayez ou payez en francs (FC).';
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

  function pay() {
    try {
      if (!D || !D.s) return say('Connectez-vous d’abord');
      app.innerHTML = head('Payer mon accès') + '<div class=f><div class=card><small>Abonnement de 30 jours</small><h3 id=f32p>…</h3><small id=f32n></small></div>' +
        '<p class=hint id=f32e></p>' +
        '<p class=hint>Paiement par mobile money. Vous recevrez une demande de confirmation sur votre téléphone ; l’accès s’ouvre automatiquement dès que le paiement est confirmé.</p>' +
        '<label>Moyen de paiement<select id=f32m style="font:inherit;padding:12px;border-radius:14px;border:1px solid var(--line);background:var(--card);color:var(--ink)">' +
        METHODS.map(function (m) { return '<option value="' + m.n + '">' + esc(m.l) + '</option>'; }).join('') + '</select></label>' +
        '<label>Numéro mobile money<input id=f32t type=tel inputmode=tel autocomplete=tel placeholder="+243 81 234 5678"></label>' +
        '<button class=p id=f32g>Payer</button><p class=hint id=f32s></p>' +
        '<button id=f32v>J’ai payé · vérifier mon accès</button><button id=f32r>Retour</button></div>';

      /* prix du jour (francs et dollars) */
      fx({ quote: true }).then(function (r) { return r.json().then(function (q) { return { ok: r.ok, q: q }; }); }).then(function (o) {
        var p = $$('#f32p'), n = $$('#f32n');
        if (!o.ok || !o.q || !o.q.cdf) { if (p) p.textContent = 'Prix indisponible'; return; }
        if (p) p.textContent = o.q.cdf + ' FC';
        if (n) n.textContent = o.q.usd ? 'ou ' + String(o.q.usd).replace('.', ',') + ' $ au taux du jour' : '';
      }).catch(function () { var p = $$('#f32p'); if (p) p.textContent = 'Prix indisponible'; });

      /* abonnement terminé ? */
      tok().then(function () { return api('/rest/v1/rpc/cn_mon_acces', { m: 'POST', b: {} }); }).then(function (a) {
        var e = $$('#f32e');
        if (e && a && a.acces_jusqu && new Date(a.acces_jusqu).getTime() < Date.now()) {
          e.textContent = 'Votre accès a pris fin le ' + new Date(a.acces_jusqu).toLocaleDateString('fr-FR') + '. Payez pour le renouveler.';
        }
      }).catch(function () {});

      $$('#f32r').onclick = function () { if (typeof window.v6wait === 'function') window.v6wait(); };
      $$('#f32v').onclick = function () { if (typeof window.v6gate === 'function') window.v6gate(); };
      var busy = false;
      $$('#f32g').onclick = async function () {
        if (busy) return;
        var phone = norm($$('#f32t').value), method = $$('#f32m').value, msg = $$('#f32s'), go = $$('#f32g');
        if (!validPhone(phone)) { msg.textContent = 'Numéro invalide. Exemple : +243 81 234 5678.'; return; }
        busy = true; go.disabled = true; msg.textContent = 'Envoi de la demande…';
        try {
          var r = await fx({ phone: phone, method: method });
          var j = {}; try { j = await r.json(); } catch (e) {}
          if (!r.ok || !j.order_reference) { msg.textContent = errText(r.status, j); busy = false; go.disabled = false; return; }
          msg.textContent = '✅ Demande de ' + j.amount + ' ' + j.currency + ' envoyée. Validez le paiement sur votre téléphone (code PIN), puis patientez ici…';
          var order = j.order_reference;
          for (var i = 0; i < POLL_MAX; i++) {
            await sleep(POLL_MS);
            if (!$$('#f32g')) return;   /* l’écran a changé : on arrête */
            try {
              await tok();
              var rows = await api('/rest/v1/cn_fondeka_payments?select=status&order_reference=eq.' + encodeURIComponent(order));
              if (rows && rows[0] && rows[0].status === 'failed') { msg.textContent = 'Paiement refusé ou annulé. Vous pouvez réessayer.'; busy = false; go.disabled = false; return; }
              var a = await api('/rest/v1/rpc/cn_mon_acces', { m: 'POST', b: {} });
              if (a && a.statut === 'valide') { say('Paiement confirmé 🎉'); if (typeof window.v6gate === 'function') window.v6gate(); return; }
            } catch (e) {}
          }
          msg.textContent = 'Pas encore de confirmation. Si vous avez validé le paiement, l’accès s’ouvre automatiquement : touchez « J’ai payé » dans quelques minutes.';
          busy = false; go.disabled = false;
        } catch (e) { msg.textContent = 'Paiement indisponible : vérifiez votre connexion.'; busy = false; go.disabled = false; }
      };
    } catch (e) { say('Paiement indisponible'); }
  }

  /* « 2. Sans ambassadeur » ouvre désormais le paiement Fondeka ; « 1. Avec un ambassadeur » reste celui d’ADG. */
  var oo = window.adgOpt;
  window.adgOpt = function (n) { if (n === 2) return pay(); return typeof oo === 'function' ? oo.apply(this, arguments) : undefined; };
  var ow = window.v6wait;
  if (typeof ow === 'function') window.v6wait = function () {
    var r = ow.apply(this, arguments);
    try { var b = document.querySelector('button[onclick="adgOpt(2)"]'); if (b) b.textContent = '2. Sans ambassadeur : payer en ligne (mobile money)'; } catch (e) {}
    return r;
  };

  /* À chaque ouverture : un accès dont la date limite est dépassée repasse en attente avant la lecture du statut. */
  var og = window.v6gate;
  if (typeof og === 'function') window.v6gate = async function () {
    try { if (D && D.s) { await tok(); await api('/rest/v1/rpc/cn_acces_verifier', { m: 'POST', b: {} }); } } catch (e) {}
    return og.apply(this, arguments);
  };

  window.cnPay32 = { open: pay, methods: function () { return METHODS.slice(); } };
})();
