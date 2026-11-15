/* v20 : sécurité d'accès, appareil unique, agenda synchronisé, alertes administrateur. */
(function () {
  var DEV = (function () {
    try {
      var d = localStorage.getItem('cn-device');
      if (!d || d.length < 16) { d = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)); localStorage.setItem('cn-device', d); }
      return d;
    } catch (e) { return 'tmp-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
  })();

  /* 1. Chaque requête vers le serveur porte l'identifiant de cet appareil (contrôlé côté base). */
  var of = window.fetch;
  window.fetch = function (u, o) {
    try {
      if (typeof u == 'string' && u.indexOf(SB) == 0 && u.indexOf('/functions/v1/') < 0) { /* pas pour les fonctions IA : l'en-tête y bloquerait la requête (CORS) */
        o = o || {}; var h = new Headers(o.headers || {}); h.set('x-device-id', DEV); o.headers = h;
      }
    } catch (e) {}
    return of.call(this, u, o);
  };

  function rpc(n, b) { return api('/rest/v1/rpc/' + n, { m: 'POST', b: b || {} }); }
  function devName() { return (navigator.userAgent || '').replace(/\s+/g, ' ').slice(0, 110); }

  /* 2. Verrouillage : aucun cahier n'est affiché sans compte validé. */
  function nb() { var a = document.getElementById('app'); return a && a.querySelector('.shelf,.ed,#ed,.hero,#cl,#v8l,#v6l,#v6a'); }
  function lock(msg) {
    try { if (!D.s) { D.ok = 0; D.adm = 0; raw(); v6login(msg); } else { D.ok = 0; raw(); v6gate(); } } catch (e) {}
  }
  function guard() {
    if (document.getElementById('sp') && !D.s) return;
    if (nb() && (!D.s || !D.ok)) lock();
  }
  setInterval(guard, 700);
  ['focus', 'pageshow', 'visibilitychange', 'online'].forEach(function (ev) { addEventListener(ev, function () { guard(); recheck(); }); });

  /* 3. Remise à zéro locale d'un appareil remplacé (les données restent dans le compte). */
  function wipe(msg) {
    try {
      var keys = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('cn-user-') == 0) keys.push(k); }
      keys.forEach(function (k) { localStorage.removeItem(k); });
      localStorage.removeItem('cn-user-ancien-appareil');
    } catch (e) {}
    D.s = null; D.ok = 0; D.adm = 0; D.own = null; D.ev = []; D.evd = []; v6vide(); raw(); v6login(msg);
  }

  var busy = 0, claiming = 0;
  async function recheck() {
    if (!D.s || busy || claiming || fresh || document.hidden) return; busy = 1;
    try {
      await tok();
      var v = await rpc('cn_appareil_verifier', { p_device: DEV });
      if (v == 'remplace') return wipe('Ce compte est maintenant utilisé sur un autre téléphone. Vos notes sont conservées dans votre compte : reconnectez-vous ici pour reprendre (l’autre téléphone sera alors déconnecté).');
      var r = await api('/rest/v1/cn_profils?select=statut,est_admin'), p = r[0];
      D.stt = p ? p.statut : 'en_attente'; var was = D.ok; D.ok = D.stt == 'valide'; D.adm = !!(p && p.est_admin && D.ok); D.chk = Date.now(); raw();
      if (!D.ok) { try { rpc('cn_alerte_acces', { p_kind: 'acces_non_valide', p_detail: { statut: D.stt } }); } catch (e) {} lock(); }
      else if (!was) v6gate();
    } catch (e) {
      if (e && (e.code == 401 || e.code == 403 || e.error_code == 'refresh_token_not_found' || /refresh|jwt/i.test(String(e.message || e.msg || '')))) {
        D.s = null; D.ok = 0; D.adm = 0; raw(); v6login('Session expirée : reconnectez-vous.');
      } else { // hors ligne : tolérance de 7 jours
        if (!D.chk) { D.chk = Date.now(); raw(); }
        if (Date.now() - D.chk > 7 * 864e5) { D.ok = 0; raw(); lock(); }
      }
    } finally { busy = 0; }
  }
  setInterval(recheck, 120000);

  /* 4. À la connexion (et seulement là) cet appareil devient l'appareil actif du compte. */
  var fresh = 0, oa = window.v6auth;
  window.v6auth = window.auth = function () { fresh = 1; setTimeout(function () { fresh = 0; }, 30000); return oa.apply(this, arguments); };
  var oe = window.v6enter;
  window.v6enter = async function (id, email, after) {
    if (fresh) { fresh = 0; claiming = 1; try { await rpc('cn_appareil_reclamer', { p_device: DEV, p_nom: devName() }); } catch (e) {} claiming = 0; }
    return oe.call(this, id, email, after);
  };

  /* 5. Verrou au démarrage et à l'ouverture. */
  var og = window.v6gate;
  window.v6gate = async function () {
    var r = await og.apply(this, arguments);
    try { await pull(); alerts(); } catch (e) {}
    return r;
  };
  window.hideSp = function () {
    var e = document.getElementById('sp');
    if (e && !e.dataset.x) { e.dataset.x = 1; e.classList.add('off'); setTimeout(function () { e.remove(); }, 600); window.v6gate(); }
  };
  setTimeout(function () { if (D.s) recheck(); }, 1500);

  /* 6. Agenda et préférences : stockés dans le compte (fusion par identifiant). */
  async function pull() {
    if (!D.s || !D.ok) return;
    await tok();
    var r = await api('/rest/v1/cn_donnees?select=ev,prefs'), row = r[0], del = D.evd || [];
    var m = {}; (row && row.ev || []).concat(D.ev || []).forEach(function (e) { if (e && e.id && del.indexOf(e.id) < 0) m[e.id] = e; });
    D.ev = Object.keys(m).map(function (k) { return m[k]; });
    if (row && row.prefs && row.prefs.sort && !D.sort) D.sort = row.prefs.sort;
    raw(); await push();
  }
  async function push() {
    if (!D.s || !D.ok) return;
    try { await tok(); await api('/rest/v1/cn_donnees?on_conflict=user_id', { m: 'POST', h: { Prefer: 'resolution=merge-duplicates' }, b: { user_id: uidT(), ev: D.ev || [], prefs: { sort: D.sort || null }, updated_at: new Date().toISOString() } }); } catch (e) {}
  }
  var oadd = window.addE, odel = window.delE;
  window.addE = function () { var r = oadd.apply(this, arguments); push(); return r; };
  window.delE = function (id) { (D.evd = D.evd || []).push(id); var r = odel.apply(this, arguments); push(); return r; };

  /* 7. Alertes de sécurité pour l'administrateur. */
  var LB = { changement_appareil: 'Changement de téléphone', ancien_appareil_bloque: 'Ancien téléphone bloqué', session_invalide: 'Session invalide', acces_non_valide: 'Accès tenté sans validation' };
  async function alerts() {
    if (!D.adm || document.getElementById('v20al')) return;
    try {
      var r = await api('/rest/v1/cn_alertes?select=id,at,kind,user_id,detail&vue=eq.false&order=at.desc&limit=30');
      if (!r.length) return;
      var d = document.createElement('div'); d.id = 'v20al';
      d.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:14px;background:#c0392b22;border:1px solid #c0392b66;font-weight:700;cursor:pointer';
      d.textContent = '🔔 ' + r.length + ' alerte(s) de sécurité — touchez pour voir';
      d.onclick = function () {
        var o = document.createElement('div'); o.id = 'ak'; o.dataset.v6 = 'dlg';
        o.innerHTML = '<div class=scb><b>Alertes de sécurité</b><div style="max-height:55vh;overflow:auto;margin:8px 0">' + r.map(function (a) {
          return '<p class=hint><b>' + esc(LB[a.kind] || a.kind) + '</b> · ' + new Date(a.at).toLocaleString('fr-FR') + '<br>' + esc(String(a.user_id || '').slice(0, 8)) + ' ' + esc(JSON.stringify(a.detail || {})) + '</p>';
        }).join('') + '</div><div class=f><button class=p id=v20ok>Marquer comme vues</button><button id=v20x>Fermer</button></div></div>';
        document.body.appendChild(o);
        o.querySelector('#v20x').onclick = function () { o.remove(); };
        o.querySelector('#v20ok').onclick = async function () {
          try { await api('/rest/v1/cn_alertes?vue=eq.false', { m: 'PATCH', b: { vue: true } }); } catch (e) {}
          o.remove(); d.remove();
        };
      };
      var h = document.querySelector('.top'); if (h) h.insertAdjacentElement('afterend', d);
    } catch (e) {}
  }
})();
