/* v30 : avertissement avec compte à rebours + demande d'explication (recours) + décisions de l'administrateur.
   À charger après v29.js. Aucun format de données modifié. Rien ne s'affiche tant qu'aucun avertissement n'est enregistré
   pour le compte (table cn_avertissements, voir supabase/migrations/20261119000000_cn_avertissements.sql).
   - À l'ouverture du cahier : pastille « ⚠️ J HH:MM:SS » ; en la touchant, le texte complet et le formulaire de recours.
   - À l'échéance : le serveur suspend le compte (cn_profils.statut = 'suspendu', écran « Compte suspendu » existant) ;
     le formulaire de recours reste disponible sur cet écran.
   - Administration : section « Avertissements » (lever / prolonger / confirmer la suspension), avant comme après la suspension.
   En cas d'erreur réseau ou serveur, rien n'est bloqué par ce fichier : seul le serveur décide de la suspension. */
(function () {
  'use strict';
  if (typeof api !== 'function' || typeof window.v6gate !== 'function') return;

  var KEY = 'cn_av_cache';
  var AV = null, skew = 0, pill = null, tick = 0, dlg = null, expiring = 0, failed = false;

  function esc2(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(t) { try { toast(t); } catch (e) {} }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function lsGet() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function lsSet(v) { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) {} }
  function now() { return Date.now() + skew; }
  function remain() { return AV && AV.echeance ? Date.parse(AV.echeance) - now() : 0; }
  function clock(ms) {
    ms = Math.max(0, ms); var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return (d ? d + ' j ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s % 60);
  }
  function dateFr(iso) { try { return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }); } catch (e) { return iso; } }
  function live() { return AV && (AV.etat === 'actif' || AV.etat === 'recours'); }

  /* ---- lecture de mon avertissement (undefined = erreur : on ne change rien) ---- */
  async function mine() {
    try {
      if (!D || !D.s) return undefined;
      await tok();
      var r = await api('/rest/v1/rpc/cn_av_moi', { m: 'POST', b: {} }), x = r && r[0];
      failed = false;
      if (!x) { AV = null; lsSet(null); return null; }
      skew = Date.parse(x.maintenant) - Date.now();
      AV = x; lsSet({ echeance: x.echeance, etat: x.etat, debut: x.debut });
      return x;
    } catch (e) { failed = true; return undefined; }
  }

  /* ---- pastille de compte à rebours ---- */
  function dropPill() { if (tick) { clearInterval(tick); tick = 0; } if (pill) { try { pill.remove(); } catch (e) {} } pill = null; }
  function showPill() {
    dropPill();
    if (!live()) return;
    pill = document.createElement('button');
    pill.type = 'button'; pill.id = 'cn30p'; pill.setAttribute('aria-label', 'Avertissement : voir le détail et envoyer ma demande d’explication');
    pill.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(8px + env(safe-area-inset-top,0px));z-index:110;border:0;border-radius:999px;padding:8px 16px;font:800 15px/1 system-ui;font-variant-numeric:tabular-nums;background:#b45309;color:#fff;box-shadow:0 6px 20px #0006;cursor:pointer;-webkit-tap-highlight-color:transparent;max-width:92vw;white-space:nowrap';
    pill.onclick = openDlg;
    document.body.appendChild(pill);
    var paint = function () {
      if (!pill) return;
      var r = remain();
      pill.textContent = '⚠️ Avertissement · ' + (r > 0 ? clock(r) : 'échéance atteinte');
      if (r <= 0) expire();
    };
    paint(); tick = setInterval(paint, 1000);
  }

  /* échéance atteinte : le serveur applique la suspension ; on relit et on bascule sur l'écran « Compte suspendu » */
  async function expire() {
    if (expiring) return; expiring = 1;
    try {
      var x = await mine();
      if (x && (x.etat === 'suspendu' || x.etat === 'confirme')) {
        dropPill(); closeDlg();
        try { D.stt = 'suspendu'; D.ok = 0; D.adm = 0; raw(); } catch (e) {}
        try { v6wait(); } catch (e) {}
      }
    } catch (e) {}
    setTimeout(function () { expiring = 0; }, 30000);
  }

  /* ---- fenêtre : texte complet + demande d'explication ---- */
  function closeDlg() { if (dlg) { try { dlg.remove(); } catch (e) {} } dlg = null; }
  function formHtml(canSend) {
    if (!canSend) return '';
    return '<label style="display:block;margin:12px 0 4px;font-weight:700">Votre demande d’explication</label>' +
      '<textarea id=cn30t rows=6 maxlength=2000 style="width:100%;box-sizing:border-box;padding:10px;border-radius:12px;border:1px solid var(--line);font:inherit" placeholder="Expliquez pourquoi vous n’avez pas encore travaillé et ce que vous comptez faire."></textarea>' +
      '<div class=f><button id=cn30s class=p type=button>' + (AV && AV.recours ? 'Mettre à jour ma demande' : 'Envoyer ma demande d’explication') + '</button></div>';
  }
  function bodyHtml() {
    var r = remain(), s = AV && (AV.etat === 'suspendu' || AV.etat === 'confirme');
    return '<b style="font-size:18px">⚠️ Avertissement de l’administration</b>' +
      '<p style="margin:10px 0">Le Cahier numérique vous a été offert pour que vous travailliez et réalisiez de <b>vraies ventes</b> avec ADG. À ce jour, aucune vente validée ni objectif journalier n’est enregistré pour votre compte.</p>' +
      (s ? '<p style="margin:10px 0"><b>Votre compte est suspendu</b> dans le Cahier numérique et dans ADG. Vous pouvez encore envoyer votre demande d’explication : l’administration décidera de votre sort.</p>'
        : '<p style="margin:10px 0">Sans explication de votre part, votre compte sera <b>suspendu définitivement</b> dans le Cahier numérique et dans ADG le <b>' + esc2(dateFr(AV.echeance)) + '</b>.</p>' +
          '<div id=cn30c style="font:800 28px/1.2 system-ui;font-variant-numeric:tabular-nums;color:#b45309;text-align:center;margin:8px 0">' + esc2(clock(r)) + '</div>' +
          '<p style="margin:10px 0">Vous pouvez envoyer une demande d’explication avant cette date. L’administration examine chaque demande et décide du sort de chaque compte.</p>') +
      (AV && AV.decision ? '<p class=hint style="margin:8px 0">Message de l’administration : ' + esc2(AV.decision) + '</p>' : '') +
      (AV && AV.recours_le ? '<p class=hint style="margin:8px 0">✅ Demande envoyée le ' + esc2(dateFr(AV.recours_le)) + '. Vous pouvez la modifier tant que l’administration n’a pas décidé.</p>' : '');
  }
  function openDlg() {
    try {
      if (!AV) return; closeDlg();
      dlg = document.createElement('div');
      dlg.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:280;background:#000a;display:flex';
      var can = AV.etat !== 'confirme' && AV.etat !== 'leve';
      dlg.innerHTML = '<div class=scb style="width:100%">' + bodyHtml() + formHtml(can) + '<div class=f><button id=cn30x type=button>Fermer</button></div></div>';
      document.body.appendChild(dlg);
      var t = dlg.querySelector('#cn30t'); if (t && AV.recours) t.value = AV.recours;
      dlg.querySelector('#cn30x').onclick = closeDlg;
      var c = dlg.querySelector('#cn30c');
      if (c) { var iv = setInterval(function () { if (!dlg || !dlg.contains(c)) return clearInterval(iv); c.textContent = clock(remain()); }, 1000); }
      var b = dlg.querySelector('#cn30s');
      if (b) b.onclick = async function () {
        var txt = (dlg.querySelector('#cn30t').value || '').trim();
        if (txt.length < 10) return say('Écrivez quelques phrases pour expliquer votre situation (10 caractères minimum)');
        b.disabled = true;
        try { await tok(); await api('/rest/v1/rpc/cn_av_recours', { m: 'POST', b: { p_texte: txt } }); say('Demande d’explication envoyée à l’administration'); await mine(); showPill(); openDlg(); }
        catch (e) { b.disabled = false; say('Envoi impossible : vérifiez votre connexion et réessayez'); }
      };
    } catch (e) {}
  }

  /* ---- après la vérification d'accès du cahier ---- */
  function after() {
    try {
      if (!D || !D.ok) { dropPill(); return; }
      if (!failed && AV === null) { dropPill(); return; }
      if (!AV || failed) { var c = lsGet(); if (c && c.echeance) { AV = { etat: c.etat, echeance: c.echeance, debut: c.debut }; skew = 0; } }
      if (live()) showPill(); else dropPill();
    } catch (e) {}
  }
  var gate0 = window.v6gate;
  window.v6gate = async function () {
    try { if (D && D.s) await mine(); } catch (e) {}            /* le serveur applique d'abord une suspension arrivée à échéance */
    var r = await gate0.apply(this, arguments);
    after();
    return r;
  };

  /* ---- écran « Compte suspendu » : on garde la possibilité d'écrire à l'administration ---- */
  try {
    var wait0 = window.v6wait;
    if (typeof wait0 === 'function') window.v6wait = function () {
      var r = wait0.apply(this, arguments);
      try {
        if (D && D.stt === 'suspendu' && D.s) mine().then(function (x) {
          if (!x || (x.etat !== 'suspendu' && x.etat !== 'confirme')) return;
          var host = document.createElement('div'); host.className = 'f';
          host.innerHTML = '<button id=cn30w type=button class=p>' + (x.etat === 'confirme' ? 'Voir la décision' : 'Envoyer ma demande d’explication') + '</button>';
          app.appendChild(host); host.querySelector('#cn30w').onclick = openDlg;
        });
      } catch (e) {}
      return r;
    };
  } catch (e) {}

  /* ---- administration ---- */
  var LAB = { actif: '⏳ En attente de réponse', recours: '✉️ Demande reçue — à traiter', suspendu: '⛔ Suspendu (automatique)', confirme: '⛔ Suspension confirmée', leve: '✅ Levé' };
  async function decide(id, action, jours, note) {
    try { await tok(); await api('/rest/v1/rpc/cn_av_admin_decider', { m: 'POST', b: { p_user: id, p_action: action, p_jours: jours || 4, p_note: note || null } }); say('Décision enregistrée'); v6admin(); }
    catch (e) { say('Action impossible'); }
  }
  window.cnAvDecide = function (id, action) {
    try {
      if (action === 'prolonger') return ask('Prolonger le délai de combien de jours ?', '4', function (n) { var j = parseInt(n, 10); if (j > 0) decide(id, 'prolonger', j, null); });
      ask(action === 'lever' ? 'Lever l’avertissement et rétablir le compte — message (facultatif)' : 'Confirmer la suspension définitive — message (facultatif)', '', function (n) { decide(id, action, 4, n); });
    } catch (e) {}
  };
  async function renderAdmin() {
    try {
      var host = document.getElementById('cn30a');
      if (!host) { var base = document.getElementById('v6a'); if (!base) return; host = document.createElement('div'); host.id = 'cn30a'; base.parentNode.insertBefore(host, base); }
      await tok();
      var r = await api('/rest/v1/rpc/cn_av_admin_liste', { m: 'POST', b: {} });
      if (!r || !r.length) { host.innerHTML = ''; return; }
      skew = Date.parse(r[0].maintenant) - Date.now();
      host.innerHTML = '<h2 style="margin:12px 0 4px">⚠️ Avertissements (' + r.length + ')</h2>' + r.map(function (u) {
        var left = u.etat === 'actif' || u.etat === 'recours' ? ' · il reste ' + clock(Date.parse(u.echeance) - now()) : '';
        return '<div class=rs><b>' + esc2(u.nom || u.email || '') + '</b><small>' + esc2(u.email || '') + ' · ' + (LAB[u.etat] || esc2(u.etat)) + left + '</small>' +
          (u.recours ? '<p style="margin:6px 0;padding:8px;border-radius:10px;background:var(--line)"><b>Demande du ' + esc2(dateFr(u.recours_le)) + ' :</b><br>' + esc2(u.recours).replace(/\n/g, '<br>') + '</p>' : '<small>Aucune demande d’explication.</small>') +
          (u.decision ? '<small>Votre message : ' + esc2(u.decision) + '</small>' : '') +
          '<div><button class=ch onclick="cnAvDecide(\'' + u.user_id + '\',\'lever\')">✅ Lever / rétablir</button><button class=ch onclick="cnAvDecide(\'' + u.user_id + '\',\'prolonger\')">⏳ Prolonger</button>' +
          (u.etat !== 'confirme' ? '<button class=ch onclick="cnAvDecide(\'' + u.user_id + '\',\'confirmer\')">⛔ Confirmer la suspension</button>' : '') + '</div></div>';
      }).join('');
    } catch (e) {}
  }
  try {
    var adm0 = window.v6admin;
    if (typeof adm0 === 'function') window.v6admin = function () { var r = adm0.apply(this, arguments); try { renderAdmin(); } catch (e) {} return r; };
  } catch (e) {}

  window.cnAv = { mine: mine, open: openDlg, state: function () { return AV; } };
})();
