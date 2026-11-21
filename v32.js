/* v32 : paiement de l’accès au Cahier par mobile money (Fondeka). À charger après v6.js et adg-bridge.js.
   Un seul écran de paiement (plus de choix « avec / sans ambassadeur ») : formule (mensuel, trimestriel, annuel), devise (francs ou dollars),
   opérateur, numéro mobile money et, en option, un code ambassadeur (la vente est alors liée à l’ambassadeur côté ADG par le serveur).
   L’accès est ouvert par le webhook Fondeka (fonction « cn-fondeka-webhook »), jamais par le navigateur.
   À chaque ouverture, la date limite de l’accès est vérifiée (fonction serveur cn_acces_verifier). Aucun format de données modifié. */
(function () {
  'use strict';
  var PL = { m: { l: 'Mensuel', d: '30 jours' }, t: { l: 'Trimestriel', d: '90 jours' }, a: { l: 'Annuel', d: '365 jours' } };
  var OPS = [['AIRTEL_MONEY_DRC', 'Airtel Money'], ['MPESA_DRC', 'M-Pesa'], ['ORANGE_MONEY_DRC', 'Orange Money']];
  var PREFIX = '+243', POLL_MS = 5000, POLL_MAX = 60;   /* vérification toutes les 5 s pendant 5 minutes */
  var Q = null;
  var $$ = function (s) { return document.querySelector(s); };
  var SEL = 'style="font:inherit;padding:12px;border-radius:14px;border:1px solid var(--line);background:var(--card);color:var(--ink)"';

  function say(t) { try { toast(t); } catch (e) {} }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fc(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FC'; }
  function usd(n) { return n.toFixed(2).replace('.', ',') + ' $'; }
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
  function price(pk, cur) {
    var p = Q && Q.plans && Q.plans[pk];
    if (!p) return null;
    return cur === 'CDF' ? p.cdf : p.usd;
  }
  function priceTxt(pk, cur) { var v = price(pk, cur); return v == null ? '…' : (cur === 'CDF' ? fc(v) : usd(v)); }
  function refresh() {
    var c = $$('#f32c'), l = $$('#f32l'); if (!c || !l) return;
    var cur = c.value;
    Array.prototype.forEach.call(l.options, function (o) { o.textContent = PL[o.value].l + ' · ' + PL[o.value].d + ' · ' + priceTxt(o.value, cur); });
    var p = $$('#f32p'); if (p) p.textContent = priceTxt(l.value, cur);
    var n = $$('#f32n'); if (n) n.textContent = Q && Q.rate ? 'Taux du jour : 1 $ = ' + fc(Q.rate) : '';
  }
  function adgLink() {
    try { var l = JSON.parse(localStorage.getItem('adg-link-v2')); return l && D.s && l.email === D.s.email ? l : null; } catch (e) { return null; }
  }

  function pay() {
    try {
      if (!D || !D.s) return say('Connectez-vous d’abord');
      app.innerHTML = head('Payer mon accès') + '<div class=f><div class=card><small>Montant à payer</small><h3 id=f32p>…</h3><small id=f32n></small></div>' +
        '<p class=hint id=f32e></p>' +
        '<label>Formule<select id=f32l ' + SEL + '>' + Object.keys(PL).map(function (k) { return '<option value="' + k + '">' + PL[k].l + '</option>'; }).join('') + '</select></label>' +
        '<label>Payer en<select id=f32c ' + SEL + '><option value="CDF">Francs congolais (FC)</option><option value="USD">Dollars ($)</option></select></label>' +
        '<label>Opérateur<select id=f32m ' + SEL + '>' + OPS.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<label>Numéro mobile money<input id=f32t type=tel inputmode=tel autocomplete=tel placeholder="+243 81 234 5678"></label>' +
        '<label>Code ambassadeur (facultatif)<input id=f32a maxlength=30 autocapitalize=characters autocomplete=off placeholder="Laisser vide si vous n’en avez pas"></label>' +
        '<p class=hint>Vous recevrez une demande de confirmation sur votre téléphone ; l’accès s’ouvre automatiquement dès que le paiement est confirmé.</p>' +
        '<button class=p id=f32g>Payer</button><p class=hint id=f32s></p>' +
        '<button id=f32v>J’ai payé · vérifier mon accès</button><button onclick="v6out()">Se déconnecter</button></div>';
      refresh();
      $$('#f32l').onchange = refresh; $$('#f32c').onchange = refresh;

      /* prix du jour (trois formules, francs et dollars) */
      fx({ quote: true }).then(function (r) { return r.json().then(function (q) { return { ok: r.ok, q: q }; }); }).then(function (o) {
        if (o.ok && o.q && o.q.plans) { Q = o.q; refresh(); }
        else { var p = $$('#f32p'); if (p) p.textContent = 'Prix indisponible'; }
      }).catch(function () { var p = $$('#f32p'); if (p) p.textContent = 'Prix indisponible'; });

      /* abonnement terminé ? */
      tok().then(function () { return api('/rest/v1/rpc/cn_mon_acces', { m: 'POST', b: {} }); }).then(function (a) {
        var e = $$('#f32e');
        if (e && a && a.acces_jusqu && new Date(a.acces_jusqu).getTime() < Date.now()) {
          e.textContent = 'Votre accès a pris fin le ' + new Date(a.acces_jusqu).toLocaleDateString('fr-FR') + '. Payez pour le renouveler.';
        }
      }).catch(function () {});

      $$('#f32v').onclick = function () { if (typeof window.v6gate === 'function') window.v6gate(); };
      var busy = false;
      $$('#f32g').onclick = async function () {
        if (busy) return;
        var phone = norm($$('#f32t').value), msg = $$('#f32s'), go = $$('#f32g');
        var cur = $$('#f32c').value, plan = $$('#f32l').value;
        var method = $$('#f32m').value + (cur === 'CDF' ? '_CDF' : '');
        var code = ($$('#f32a').value || '').trim().toUpperCase();
        if (!validPhone(phone)) { msg.textContent = 'Numéro invalide. Exemple : +243 81 234 5678.'; return; }
        if (code && !/^[A-Z0-9_-]{2,30}$/.test(code)) { msg.textContent = errText(0, { error: 'code_invalide' }); return; }
        busy = true; go.disabled = true; msg.textContent = 'Envoi de la demande…';
        try {
          var r = await fx({ phone: phone, method: method, plan: plan, ref_code: code });
          var j = {}; try { j = await r.json(); } catch (e) {}
          if (!r.ok || !j.order_reference) { msg.textContent = errText(r.status, j); busy = false; go.disabled = false; return; }
          msg.textContent = '✅ Demande de ' + (j.currency === 'CDF' ? fc(j.amount) : usd(Number(j.amount))) + ' envoyée. Validez le paiement sur votre téléphone (code PIN), puis patientez ici…';
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

  /* Le choix « avec / sans ambassadeur » disparaît : l’écran d’attente ouvre directement le paiement.
     Seules les personnes qui ont déjà envoyé une demande ADG gardent leur écran d’attente (avec un bouton pour payer en ligne). */
  var ow = window.v6wait;
  window.v6wait = function () {
    try {
      if (D && D.stt === 'suspendu') return ow ? ow.apply(this, arguments) : undefined;
      if (adgLink() && ow) {
        var r = ow.apply(this, arguments);
        var f = $$('#app .f');
        if (f && !$$('#f32x')) {
          var b = document.createElement('button'); b.id = 'f32x'; b.className = 'p'; b.type = 'button';
          b.textContent = 'Payer en ligne (mobile money)'; b.onclick = pay; f.appendChild(b);
        }
        return r;
      }
    } catch (e) {}
    return pay();
  };
  window.adgOpt = function () { return pay(); };
  var oR = window.adgReset;
  if (typeof oR === 'function') window.adgReset = function () { oR.apply(this, arguments); try { if (!adgLink()) pay(); } catch (e) {} };

  /* À chaque ouverture : un accès dont la date limite est dépassée repasse en attente avant la lecture du statut. */
  var og = window.v6gate;
  if (typeof og === 'function') window.v6gate = async function () {
    try { if (D && D.s) { await tok(); await api('/rest/v1/rpc/cn_acces_verifier', { m: 'POST', b: {} }); } } catch (e) {}
    return og.apply(this, arguments);
  };

  window.cnPay32 = { open: pay };
})();
