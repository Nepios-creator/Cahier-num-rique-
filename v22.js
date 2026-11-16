/* v22 : annonces de l'administration pour tous les utilisateurs + carte automatique « Nouveautés » à chaque mise à jour.
   À charger après maj.js et v21.js. */
(function () {
  'use strict';
  var LS = window.localStorage;
  function g(k) { try { return LS.getItem(k); } catch (e) { return null; } }
  function s(k, v) { try { LS.setItem(k, v); } catch (e) {} }
  var ICON = { info: 'ℹ️', important: '🔔', maj: '✨' }, NOM = { info: 'Information', important: 'Important', maj: 'Mise à jour' };
  var COL = { info: '#2f80ed', important: '#e67e22', maj: '#27ae60' };

  var css = document.createElement('style');
  css.textContent = '#v22o{position:fixed;inset:0;z-index:70;background:#000a;display:flex;animation:v22f .2s}' +
    '#v22o .scb{animation:v22u .3s cubic-bezier(.2,.9,.3,1)}' +
    '@keyframes v22f{from{opacity:0}to{opacity:1}}@keyframes v22u{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}' +
    '.v22c{border-radius:18px;padding:14px 16px;margin:10px 0;background:var(--card);border:1px solid var(--line);border-left:5px solid var(--c,#2f80ed)}' +
    '.v22c b{display:block;font:800 17px/1.3 system-ui}.v22c small{color:var(--mut)}.v22c p{margin:6px 0 0;font:500 15px/1.5 system-ui;white-space:normal}' +
    '.v22c ul{margin:6px 0 0;padding-left:20px;font:500 15px/1.6 system-ui}' +
    '.v22h{display:flex;align-items:center;gap:10px;margin-bottom:4px}.v22h i{font-style:normal;font-size:28px}' +
    '#v22b{margin:10px 0;padding:12px 14px;border-radius:14px;background:var(--card);border:1px solid var(--line);font-weight:700;cursor:pointer}';
  document.head.appendChild(css);

  function seen() { try { return JSON.parse(g('cn_ann_vu') || '[]'); } catch (e) { return []; } }
  function mark(ids) { var a = seen(); ids.forEach(function (i) { if (a.indexOf(i) < 0) a.push(i); }); s('cn_ann_vu', JSON.stringify(a.slice(-200))); }
  function fmt(t) { return esc(t).replace(/\n/g, '<br>'); }
  function dtx(t) { try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }

  function sheet(title, inner, ok, okLabel) {
    var old = document.getElementById('v22o'); if (old) old.remove();
    var o = document.createElement('div'); o.id = 'v22o';
    o.innerHTML = '<div class=scb><div class=drh><b style="font:800 20px system-ui">' + title + '</b><button id=v22x>✕</button></div>' + inner +
      '<div class=f><button class=p id=v22k>' + (okLabel || 'J’ai compris') + '</button></div></div>';
    document.body.appendChild(o);
    var close = function () { o.remove(); if (ok) ok(); };
    o.querySelector('#v22x').onclick = close; o.querySelector('#v22k').onclick = close;
    o.addEventListener('click', function (e) { if (e.target === o) close(); });
  }
  function card(a) {
    return '<div class=v22c style="--c:' + (COL[a.type] || COL.info) + '"><div class=v22h><i>' + (ICON[a.type] || 'ℹ️') + '</i><div><b>' + esc(a.titre) + '</b><small>' + (NOM[a.type] || 'Information') + ' · ' + dtx(a.cree_le) + '</small></div></div><p>' + fmt(a.corps) + '</p></div>';
  }

  /* 1. Carte automatique « Nouveautés » à chaque nouvelle version. */
  function maj() {
    var M = window.CN_MAJ; if (!M || !M.v) return false;
    var last = g('cn_maj_v');
    if (last === M.v) return false;
    s('cn_maj_v', M.v);
    if (!last) return false; /* première installation : rien à annoncer */
    var li = (M.notes || []).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    sheet('✨ ' + esc(M.titre || 'Nouveautés'), '<div class=v22c style="--c:' + COL.maj + '"><b>Le cahier vient d’être mis à jour</b><ul>' + li + '</ul></div>', null, 'Super, merci !');
    return true;
  }

  /* 2. Annonces de l'équipe. */
  var busy = false;
  async function fetchAnn() {
    var r = await api('/rest/v1/cn_annonces?select=id,titre,corps,type,cree_le&order=cree_le.desc&limit=30');
    return Array.isArray(r) ? r : [];
  }
  async function check() {
    if (busy || !D.s || !D.ok || document.getElementById('v22o') || document.getElementById('ak')) return;
    busy = true;
    try {
      await tok();
      var all = await fetchAnn(), vu = seen();
      var nw = all.filter(function (a) { return vu.indexOf(a.id) < 0; });
      if (!all.length) return;
      if (!g('cn_ann_init')) { /* premier lancement : on ne montre pas tout l'historique */
        s('cn_ann_init', '1'); mark(all.map(function (a) { return a.id; })); nw = []; 
      }
      if (nw.length) sheet('📣 ' + (nw.length > 1 ? nw.length + ' nouvelles informations' : 'Nouvelle information'), nw.map(card).join(''), function () { mark(nw.map(function (a) { return a.id; })); });
    } catch (e) {} finally { busy = false; }
  }
  function run() { if (!maj()) check(); }

  var h0 = window.home;
  window.home = function () { var r = h0.apply(this, arguments); setTimeout(run, 1200); return r; };
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(check, 800); });
  setInterval(function () { if (!document.hidden) check(); }, 10 * 60 * 1000);

  /* 3. Historique des annonces (Réglages). */
  window.v22hist = async function () {
    try { await tok(); var all = await fetchAnn(); mark(all.map(function (a) { return a.id; }));
      sheet('📣 Annonces', all.length ? all.map(card).join('') : '<p class=hint>Aucune annonce pour le moment.</p>', null, 'Fermer');
    } catch (e) { toast('Hors ligne'); }
  };
  var m0 = window.menu;
  window.menu = function () { m0.apply(this, arguments);
    var b = document.querySelector('button[onclick="th()"]');
    if (b && !document.getElementById('v22m')) { var q = document.createElement('button'); q.id = 'v22m'; q.className = 'p'; q.textContent = '📣 Annonces et nouveautés'; q.onclick = window.v22hist; b.before(q); }
  };

  /* 4. Administration : écrire et envoyer une annonce. */
  var a0 = window.v6admin;
  window.v6admin = async function () {
    var r = await a0.apply(this, arguments);
    var box = document.getElementById('v6a');
    if (box && D.adm && !document.getElementById('v22a')) {
      var b = document.createElement('button'); b.id = 'v22a'; b.className = 'p'; b.textContent = '📣 Envoyer une annonce à tous';
      b.onclick = compose; box.before(b);
    }
    return r;
  };
  async function compose() {
    var list = [];
    try { await tok(); list = await api('/rest/v1/cn_annonces?select=id,titre,type,cree_le,actif&order=cree_le.desc&limit=10'); } catch (e) {}
    var o = document.createElement('div'); o.id = 'ak';
    o.innerHTML = '<div class=scb><div class=drh><b>📣 Annonce à tous les utilisateurs</b><button id=v22cx>✕</button></div><div class=f>' +
      '<label>Titre<input id=v22t maxlength=120 placeholder="Ex. Maintenance ce soir"></label>' +
      '<label>Message<textarea id=v22m2 rows=5 maxlength=2000 style="width:100%;box-sizing:border-box;font:inherit;border-radius:14px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:10px"></textarea></label>' +
      '<label>Type<select id=v22ty><option value=info>ℹ️ Information</option><option value=important>🔔 Important</option><option value=maj>✨ Mise à jour</option></select></label>' +
      '<label>Visible pendant<select id=v22d><option value=7>7 jours</option><option value=30>30 jours</option><option value=0>Sans limite</option></select></label>' +
      '<button class=p id=v22s>Envoyer à tous</button></div>' +
      (list.length ? '<p class=hint style="margin-top:14px"><b>Dernières annonces</b></p>' + list.map(function (a) {
        return '<div class=rs><b>' + esc(a.titre) + '</b><small>' + (NOM[a.type] || '') + ' · ' + dtx(a.cree_le) + (a.actif ? '' : ' · retirée') + '</small>' + (a.actif ? '<button class=ch data-id="' + a.id + '">Retirer</button>' : '') + '</div>';
      }).join('') : '') + '</div>';
    document.body.appendChild(o);
    o.querySelector('#v22cx').onclick = function () { o.remove(); };
    Array.prototype.forEach.call(o.querySelectorAll('button[data-id]'), function (bt) {
      bt.onclick = async function () { try { await api('/rest/v1/cn_annonces?id=eq.' + bt.dataset.id, { m: 'PATCH', h: { Prefer: 'return=minimal' }, b: { actif: false } }); toast('Annonce retirée'); o.remove(); } catch (e) { toast('Action impossible'); } };
    });
    o.querySelector('#v22s').onclick = async function () {
      var t = o.querySelector('#v22t').value.trim(), c = o.querySelector('#v22m2').value.trim();
      if (!t || !c) return toast('Titre et message obligatoires');
      var d = +o.querySelector('#v22d').value, body = { titre: t, corps: c, type: o.querySelector('#v22ty').value };
      if (d) body.expire_le = new Date(Date.now() + d * 864e5).toISOString();
      try { await tok(); await api('/rest/v1/cn_annonces', { m: 'POST', h: { Prefer: 'return=minimal' }, b: body }); toast('Annonce envoyée à tous les utilisateurs'); o.remove(); }
      catch (e) { toast('Envoi impossible'); }
    };
  }
})();
