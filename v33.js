/* v33 — Administration : offrir un accès gratuit (compte e-mail + mot de passe, sans paiement).
   Réservé à l'administrateur : le serveur (fonction cn-admin-offrir) revérifie le rôle, ce panneau n'est qu'une commodité. */
(function () {
  'use strict';
  var FN = SB + '/functions/v1/cn-admin-offrir';
  function esc2(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(m) { try { toast(m); } catch (e) { alert(m); } }
  function fr(d) { try { return new Date(d).toLocaleDateString('fr-FR'); } catch (e) { return ''; } }
  var ERR = {
    email_invalide: 'Adresse e-mail invalide.',
    mot_de_passe_invalide: 'Mot de passe : 8 caractères minimum.',
    duree_invalide: 'Durée invalide (nombre de jours, ou laissez vide pour illimité).',
    compte_admin: 'Ce compte est un compte administrateur.',
    creation_impossible: 'Création impossible (réessayez dans un instant).',
    interdit: 'Action réservée à l’administrateur.',
    non_offert: 'Ce compte n’a pas été offert par vous.',
    mdp_impossible: 'Changement de mot de passe impossible.'
  };
  async function call(body) {
    await tok();
    var r = await fetch(FN, { method: 'POST', headers: Object.assign({}, stH(), { 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok || j.error) { var err = new Error(j.error || ('erreur ' + r.status)); err.code = j.error; throw err; }
    return j;
  }
  function genPass() {
    var a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', o = '', b = new Uint32Array(10);
    crypto.getRandomValues(b); for (var i = 0; i < b.length; i++) o += a[b[i] % a.length];
    return o;
  }
  var last = null; // dernier compte créé (pour copier les coordonnées)

  window.cnOffrirGen = function () { var p = document.getElementById('cn33p'); if (p) p.value = genPass(); };
  window.cnOffrirCopy = async function () {
    if (!last) return;
    var t = 'Cahier numérique — vos accès\nE-mail : ' + last.email + (last.password ? '\nMot de passe : ' + last.password : '') + '\nConnectez-vous sur ' + location.origin + location.pathname.replace(/[^/]*$/, '');
    try { await navigator.clipboard.writeText(t); say('Coordonnées copiées'); } catch (e) { prompt('Copiez ces coordonnées :', t); }
  };
  window.cnOffrirOk = async function () {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
    var email = g('cn33e').trim(), pw = g('cn33p'), nom = g('cn33n').trim(), jours = g('cn33j').trim();
    if (!email) return say('Saisissez l’adresse e-mail.');
    var btn = document.getElementById('cn33b'); if (btn) { btn.disabled = true; btn.textContent = 'Création…'; }
    try {
      var j = await call({ action: 'creer', email: email, password: pw, nom: nom, jours: jours });
      last = { email: j.email, password: j.existait ? '' : pw };
      var m = document.getElementById('cn33m');
      if (m) m.innerHTML = '<div class=card style="margin:10px 0"><b>✅ ' + (j.existait ? 'Compte existant : accès offert' : 'Compte créé et validé') + '</b><p style="margin:6px 0">E-mail : <b>' + esc2(j.email) + '</b>' +
        (j.existait ? '<br><small>Cette personne avait déjà un compte : son mot de passe n’a pas été modifié.</small>' : '<br>Mot de passe : <b>' + esc2(pw) + '</b>') +
        '<br><small>' + (j.jusqu ? 'Accès jusqu’au ' + esc2(fr(j.jusqu)) : 'Accès illimité') + '</small></p><button class=ch onclick="cnOffrirCopy()">📋 Copier les coordonnées</button></div>';
      ['cn33e', 'cn33p', 'cn33n', 'cn33j'].forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; });
      loadList();
    } catch (e) { say(ERR[e.code] || 'Action impossible : vérifiez votre connexion.'); }
    if (btn) { btn.disabled = false; btn.textContent = '🎁 Offrir l’accès'; }
  };
  window.cnOffrirRetirer = async function (id) {
    if (!confirm('Retirer l’accès de ce compte ? La personne ne pourra plus utiliser le cahier.')) return;
    try { await call({ action: 'retirer', user_id: id }); say('Accès retiré'); loadList(); } catch (e) { say(ERR[e.code] || 'Action impossible'); }
  };
  window.cnOffrirMdp = async function (id) {
    var p = prompt('Nouveau mot de passe pour ce compte (8 caractères minimum) :', genPass());
    if (!p) return;
    try { await call({ action: 'mdp', user_id: id, password: p }); last = null; say('Mot de passe modifié : ' + p); } catch (e) { say(ERR[e.code] || 'Action impossible'); }
  };
  window.cnOffrirRetablir = async function (id, email) {
    try { await call({ action: 'creer', email: email, password: '' }); say('Accès rétabli'); loadList(); } catch (e) { say(ERR[e.code] || 'Action impossible'); }
  };

  async function loadList() {
    var host = document.getElementById('cn33l'); if (!host) return;
    try {
      var j = await call({ action: 'liste' }), L = j.offerts || [];
      host.innerHTML = L.length ? '<h3 style="margin:12px 0 4px">Accès offerts (' + L.length + ')</h3>' + L.map(function (o) {
        var actif = o.statut === 'valide';
        var etat = o.retire_le || o.statut === 'suspendu' ? '⛔ Retiré' : actif ? '✅ Actif' : '⏳ ' + esc2(o.statut);
        return '<div class=rs><b>' + esc2(o.email) + '</b><small>' + (o.nom ? esc2(o.nom) + ' · ' : '') + etat + ' · offert le ' + esc2(fr(o.offert_le)) + ' · ' + (o.acces_jusqu ? 'jusqu’au ' + esc2(fr(o.acces_jusqu)) : 'illimité') + '</small><div>' +
          (actif ? '<button class=ch onclick="cnOffrirRetirer(\'' + esc2(o.user_id) + '\')">⛔ Retirer l’accès</button>' : '<button class=ch onclick="cnOffrirRetablir(\'' + esc2(o.user_id) + '\',\'' + esc2(o.email) + '\')">✅ Rétablir</button>') +
          '<button class=ch onclick="cnOffrirMdp(\'' + esc2(o.user_id) + '\')">🔑 Nouveau mot de passe</button></div></div>';
      }).join('') : '<p class=hint>Aucun accès offert pour le moment.</p>';
    } catch (e) { host.innerHTML = '<p class=hint>Liste indisponible.</p>'; }
  }

  function render() {
    var base = document.getElementById('v6a'); if (!base || document.getElementById('cn33')) return;
    var box = document.createElement('div'); box.id = 'cn33';
    box.innerHTML = '<div class=card style="margin:8px 0"><h3 style="margin:0 0 6px">🎁 Offrir un accès gratuit</h3>' +
      '<p class=hint style="margin:0 0 8px">Créez un compte (e-mail + mot de passe) déjà validé : la personne se connecte directement, sans paiement. Si elle a déjà un compte, son accès est simplement ouvert.</p>' +
      '<input id=cn33e type=email autocomplete=off placeholder="Adresse e-mail" style="width:100%;margin:4px 0">' +
      '<div style="display:flex;gap:6px;margin:4px 0"><input id=cn33p type=text autocomplete=off placeholder="Mot de passe (8 caractères min.)" style="flex:1"><button type=button class=ch onclick="cnOffrirGen()">🎲 Générer</button></div>' +
      '<input id=cn33n type=text autocomplete=off placeholder="Nom (facultatif)" style="width:100%;margin:4px 0">' +
      '<input id=cn33j type=number min=1 inputmode=numeric placeholder="Durée en jours (vide = illimité)" style="width:100%;margin:4px 0">' +
      '<button id=cn33b class=p onclick="cnOffrirOk()">🎁 Offrir l’accès</button><div id=cn33m></div></div><div id=cn33l></div>';
    base.parentNode.insertBefore(box, base);
    loadList();
  }

  try {
    var adm0 = window.v6admin;
    if (typeof adm0 === 'function') window.v6admin = function () { var r = adm0.apply(this, arguments); try { render(); } catch (e) {} return r; };
  } catch (e) {}
})();
