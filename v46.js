/* v46 : rappels de fin d'abonnement + dates. A charger apres v45.
   1) Date de fin d'abonnement en bas de la liste des cahiers.
   2) Notifications "Compris" a l'ouverture : forfait 1 an -> 3 mois, 1 mois, 2 semaines, 5 jours ;
      forfait 3 mois -> 1 mois, 2 semaines, 5 jours ; forfait 1 mois -> 2 semaines, 5 jours.
      A 1 jour : compte a rebours fixe, visible jusqu'a la fermeture du cahier.
   3) Administration : date d'inscription et de fin d'abonnement de chaque membre.
   Surcouche : aucun fichier existant n'est modifie. */
(function () {
  'use strict';
  var DAY = 864e5, END = 0, PLAN = 1, TICK = null, OBS = null, SHOWING = false, DATES = null, AIV = null;
  var ST = { 12: [90, 30, 14, 5], 3: [30, 14, 5], 1: [14, 5] };
  var $$ = function (s) { return document.querySelector(s); };
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function em() { try { return D && D.s ? String(D.s.email || '').toLowerCase() : ''; } catch (e) { return ''; } }
  function fr(ms) { try { return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
  function frs(v) { try { return v ? new Date(v).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; } catch (e) { return ''; } }
  function clk(ms) { var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x; }
  function reste(d) { if (d >= 60) return 'environ ' + Math.round(d / 30) + ' mois'; if (d >= 25) return 'environ 1 mois'; if (d >= 10) return 'environ ' + Math.round(d / 7) + ' semaines'; return Math.max(2, Math.ceil(d)) + ' jours'; }

  /* ---------- Date de fin en bas de la liste des cahiers ---------- */
  function mount() {
    var sh = $$('#sh'); if (!sh || !END || $$('#d46')) return;
    var d = document.createElement('div'); d.id = 'd46';
    d.style.cssText = 'margin:12px 0;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--card);font-size:14px;text-align:center;line-height:1.45';
    d.innerHTML = '\u23f3 Votre abonnement est valable jusqu\u2019au <b>' + E(fr(END)) + '</b>';
    sh.parentNode.insertBefore(d, sh.nextSibling);
  }

  /* ---------- Compte a rebours fixe (dernier jour) ---------- */
  function pill() {
    var left = END - Date.now(), p = $$('#p46');
    if (!END || left <= 0 || left > DAY) { if (p) p.remove(); return; }
    if (!p) {
      p = document.createElement('div'); p.id = 'p46';
      p.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px) + 6px);left:50%;transform:translateX(-50%);z-index:9998;padding:5px 12px;border-radius:999px;background:#dc2626;color:#fff;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none;white-space:nowrap';
      document.body.appendChild(p);
    }
    p.textContent = '\u23f3 Fin de l\u2019abonnement dans ' + clk(left);
  }
  function tick() {
    try {
      if (typeof D === 'undefined' || !D.ok) { var p = $$('#p46'); if (p) p.remove(); return; }
      pill();
    } catch (e) {}
  }

  /* ---------- Notifications "Compris" ---------- */
  function kkey() { return 'cn46k:' + em() + ':' + END; }
  function acked() { try { var v = localStorage.getItem(kkey()); return v === null ? null : +v; } catch (e) { return null; } }
  function ack(t) { try { localStorage.setItem(kkey(), String(t)); } catch (e) {} }
  function stage() {
    var days = (END - Date.now()) / DAY; if (days <= 1) return null;
    var L = ST[PLAN] || ST[1], st = null;
    L.forEach(function (t) { if (days <= t && (st === null || t < st)) st = t; });
    return st;
  }
  function modal(st) {
    if (SHOWING || $$('#m46')) return; SHOWING = true;
    var days = (END - Date.now()) / DAY, o = document.createElement('div'); o.id = 'm46';
    o.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px';
    o.innerHTML = '<div style="max-width:420px;width:100%;box-sizing:border-box;background:var(--card);border-radius:20px;padding:22px 20px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.35)"><div style="font-size:34px">\u23f3</div><h3 style="margin:8px 0 6px;font-size:18px">Votre abonnement se termine bient\u00f4t</h3><p style="margin:0 0 16px;font-size:15px;line-height:1.5">Il vous reste ' + reste(days) + '. Votre abonnement prend fin le <b>' + E(fr(END)) + '</b>. R\u00e9abonnez-vous avant cette date pour continuer \u00e0 utiliser pleinement votre cahier.</p><button id="k46" type="button" class="p" style="width:100%;padding:14px;font-size:16px">Compris</button></div>';
    document.body.appendChild(o);
    o.querySelector('#k46').onclick = function () { ack(st); o.remove(); SHOWING = false; };
  }
  async function init() {
    try {
      if (typeof D === 'undefined' || !D.ok || !D.s) return;
      await tok();
      var a = await api('/rest/v1/rpc/cn_mon_abonnement', { m: 'POST', b: {} });
      var ms = a && a.acces_jusqu ? new Date(a.acces_jusqu).getTime() : 0;
      if (!ms) { END = 0; var p = $$('#p46'); if (p) p.remove(); var d = $$('#d46'); if (d) d.remove(); return; }
      END = ms; PLAN = (a.plan_mois | 0) || 1;
      mount(); pill();
      if (!TICK) TICK = setInterval(tick, 1000);
      if (!OBS && typeof app !== 'undefined') { OBS = new MutationObserver(mount); OBS.observe(app, { childList: true }); }
      var st = stage();
      if (st !== null) { var k = acked(); if (k === null || st < k) modal(st); }
    } catch (e) {}
  }
  var G0 = window.v6gate;
  if (typeof G0 === 'function') window.v6gate = function () {
    var r = G0.apply(this, arguments);
    try { Promise.resolve(r).then(function () { setTimeout(init, 300); }); } catch (e) {}
    return r;
  };

  /* ---------- Administration : dates d'inscription et de fin ---------- */
  function decorate() {
    if (!DATES) return;
    Array.prototype.forEach.call(document.querySelectorAll('#v6a .rs, #cn37 .rs'), function (r) {
      if (r.querySelector('.d46') || (r.closest && r.closest('#cn45'))) return;
      var b = r.querySelector('b'), e = b ? b.textContent.trim().toLowerCase() : '', u = DATES[e];
      if (!u) { var tx = r.textContent.toLowerCase(), k = Object.keys(DATES).filter(function (x) { return x && tx.indexOf(x) >= 0; })[0]; u = k ? DATES[k] : null; }
      if (!u) return;
      var fin = u.acces_jusqu ? new Date(u.acces_jusqu).getTime() : 0, d = document.createElement('div');
      d.className = 'd46'; d.style.cssText = 'font-size:12.5px;opacity:.9;margin:4px 0;line-height:1.4';
      d.innerHTML = '\ud83d\udcc5 Inscrit le <b>' + E(frs(u.cree_le)) + '</b> \u00b7 ' + (fin ? 'Fin d\u2019abonnement : <b style="' + (fin < Date.now() ? 'color:#dc2626' : '') + '">' + E(frs(fin)) + '</b>' : 'Sans date de fin');
      var s = r.querySelector('small');
      if (s && s.parentNode) s.parentNode.insertBefore(d, s.nextSibling); else r.insertBefore(d, r.children[1] || null);
    });
  }
  function startAdm() {
    tok().then(function () { return api('/rest/v1/rpc/cn_admin_dates', { m: 'POST', b: {} }); }).then(function (r) {
      var m = {}; (r || []).forEach(function (u) { m[String(u.email || '').toLowerCase()] = u; }); DATES = m; decorate();
    }).catch(function () {});
    var n = 0; clearInterval(AIV);
    AIV = setInterval(function () {
      if (!$$('#v6a') && !$$('#cn37')) { if (++n > 3) clearInterval(AIV); return; }
      n = 0; decorate();
    }, 1500);
  }
  var A0 = window.v6admin;
  if (typeof A0 === 'function') window.v6admin = async function () {
    var r = await A0.apply(this, arguments);
    try { startAdm(); } catch (e) {}
    return r;
  };
})();
