/* v31 : abonnement Premium par mobile money (Fondeka). À charger après v30.js. Aucun format de données modifié.
   Intercepte seulement le bouton « S’abonner » de l’écran Révision & Examen (v13.js) et ouvre une fenêtre :
   moyen de paiement + numéro mobile money -> fonction Supabase « cn-fondeka-checkout » -> demande de paiement sur le téléphone.
   L’activation du Premium est faite par le webhook Fondeka (fonction « cn-fondeka-webhook »), jamais par le navigateur.
   Tant que la liste METHODS ci-dessous est vide, ce fichier ne fait RIEN et l’ancien bouton (Stripe) reste inchangé.
   POUR ACTIVER : remplir METHODS avec les noms EXACTS du catalogue Fondeka (champ n, MAJUSCULES, chiffres et _ seulement), ex. { n: 'NOM_EXACT', l: 'Libellé affiché' }. */
(function () {
  'use strict';
  var METHODS = [
    /* { n: 'NOM_EXACT_FONDEKA', l: 'Airtel Money' }, */
  ];
  var PREFIX = '+243';                     /* indicatif utilisé si le numéro est saisi sans « + » (RDC) */
  var POLL_MS = 5000, POLL_MAX = 60;       /* vérification toutes les 5 s pendant 5 minutes */

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
  function validMethod(n) { return /^[A-Z0-9_]{3,60}$/.test(n); }
  function errText(code, j) {
    var e = j && j.error;
    if (code === 401 || e === 'non_connecte') return 'Reconnectez-vous (☁️) puis réessayez.';
    if (e === 'telephone_invalide') return 'Numéro invalide. Exemple : +243 81 234 5678.';
    if (e === 'moyen_invalide') return 'Moyen de paiement invalide.';
    if (e === 'trop_de_demandes') return 'Trop de demandes. Patientez une minute puis réessayez.';
    if (e === 'fondeka_non_configure') return 'Le paiement n’est pas encore activé côté serveur.';
    if (e === 'fondeka') return 'Fondeka a refusé la demande' + (j.detail ? ' : ' + j.detail : '') + '.';
    return 'Paiement indisponible pour le moment. Réessayez.';
  }

  var dlg = null, alive = false;
  function close() { alive = false; if (dlg) { try { dlg.remove(); } catch (e) {} } dlg = null; }

  async function status() { await tok(); return api('/rest/v1/rpc/cn_premium_status', { m: 'POST', b: {} }); }

  function open() {
    try {
      if (!D || !D.s) return say('Connectez-vous (☁️) pour vous abonner');
      close();
      dlg = document.createElement('div');
      dlg.id = 'cn31';
      dlg.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:290;background:#000a;display:flex';
      var box = document.createElement('div'); box.className = 'scb'; box.style.width = '100%';
      var h = document.createElement('b'); h.style.fontSize = '18px'; h.textContent = '💳 Abonnement Premium'; box.appendChild(h);
      var p = document.createElement('p'); p.className = 'hint'; p.style.margin = '8px 0';
      p.textContent = 'Paiement par mobile money. Vous recevrez une demande de confirmation sur votre téléphone ; le Premium s’active automatiquement dès que le paiement est confirmé (30 jours).';
      box.appendChild(p);
      var f = document.createElement('div'); f.className = 'f';
      var l1 = document.createElement('label'); l1.textContent = 'Moyen de paiement';
      var sel = document.createElement('select'); sel.style.cssText = 'font:inherit;padding:12px;border-radius:14px;border:1px solid var(--line);background:var(--card);color:var(--ink)';
      METHODS.forEach(function (m) { var o = document.createElement('option'); o.value = m.n; o.textContent = m.l; sel.appendChild(o); });
      l1.appendChild(sel); f.appendChild(l1);
      var l2 = document.createElement('label'); l2.textContent = 'Numéro mobile money';
      var ph = document.createElement('input'); ph.type = 'tel'; ph.placeholder = '+243 81 234 5678'; ph.autocomplete = 'tel'; ph.inputMode = 'tel';
      l2.appendChild(ph); f.appendChild(l2);
      var go = document.createElement('button'); go.type = 'button'; go.className = 'p'; go.textContent = 'Payer'; f.appendChild(go);
      var msg = document.createElement('p'); msg.className = 'hint'; msg.style.margin = '4px 0'; f.appendChild(msg);
      var cl = document.createElement('button'); cl.type = 'button'; cl.textContent = 'Fermer'; f.appendChild(cl);
      box.appendChild(f); dlg.appendChild(box); document.body.appendChild(dlg);
      cl.onclick = close;
      alive = true;
      var busy = false;
      go.onclick = async function () {
        if (busy) return;
        var phone = norm(ph.value), method = sel.value;
        if (!validPhone(phone)) { msg.textContent = 'Numéro invalide. Exemple : +243 81 234 5678.'; return; }
        if (!validMethod(method)) { msg.textContent = 'Moyen de paiement invalide.'; return; }
        busy = true; go.disabled = true; msg.textContent = 'Envoi de la demande…';
        try {
          var prev = '';
          try { var s0 = await status(); prev = String((s0 && s0.current_period_end) || ''); } catch (e) {}
          await tok();
          var r = await fetch(SB + '/functions/v1/cn-fondeka-checkout', {
            method: 'POST',
            headers: { apikey: KEY, Authorization: 'Bearer ' + D.s.access_token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phone, method: method })
          });
          var j = {}; try { j = await r.json(); } catch (e) {}
          if (!r.ok || !j.order_reference) { msg.textContent = errText(r.status, j); busy = false; go.disabled = false; return; }
          msg.textContent = '✅ Demande envoyée. Validez le paiement sur votre téléphone (code PIN), puis patientez ici…';
          var order = j.order_reference;
          for (var i = 0; i < POLL_MAX && alive; i++) {
            await sleep(POLL_MS);
            if (!alive) return;
            try {
              var rows = await api('/rest/v1/cn_fondeka_payments?select=status&order_reference=eq.' + encodeURIComponent(order));
              if (rows && rows[0] && rows[0].status === 'failed') { msg.textContent = 'Paiement refusé ou annulé. Vous pouvez réessayer.'; busy = false; go.disabled = false; return; }
              var s = await status();
              if (s && s.status === 'active' && String(s.current_period_end || '') !== prev) {
                say('Premium activé 🎉'); close();
                try { if (document.getElementById('v13o') && window.v13close && window.v13open) { window.v13close(); window.v13open(); } } catch (e) {}
                return;
              }
            } catch (e) {}
          }
          if (alive) { msg.textContent = 'Pas encore de confirmation. Si vous avez validé le paiement, l’activation est automatique : rouvrez l’application dans quelques minutes.'; busy = false; go.disabled = false; }
        } catch (e) { msg.textContent = 'Paiement indisponible : vérifiez votre connexion.'; busy = false; go.disabled = false; }
      };
    } catch (e) { say('Paiement indisponible'); }
  }

  document.addEventListener('click', function (e) {
    try {
      if (!METHODS.length) return;
      var b = e.target && e.target.closest && e.target.closest('#v13o [data-a="sub"]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation(); open();
    } catch (x) {}
  }, true);

  window.cnFondeka = { open: open, methods: function () { return METHODS.slice(); } };
})();
