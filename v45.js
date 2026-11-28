/* v45 : fin d'abonnement. A charger en dernier.
   1) Quand l'abonnement d'une personne est termine : deux choix (se reabonner / consulter ses notes).
   2) Mode consultation : notes et audios en lecture seule ; rien ne peut etre modifie, enregistre, envoye ni recu.
   3) Administration : section "Abonnements termines" + bouton pour provoquer la fin d'abonnement d'un compte (test).
   Surcouche : aucun fichier existant n'est modifie, aucun format de donnees ne change.
   Les comptes jamais abonnes gardent exactement le parcours d'origine. */
(function () {
  'use strict';
  var CONSULT = false, RUN = 0, SYNC0 = null, END0 = '';
  var VIEW = { n: 'list', c: '', p: '' };
  var $$ = function (s) { return document.querySelector(s); };
  var on = function (s, f) { var e = $$(s); if (e) e.onclick = f; };
  function say(t) { try { toast(t); } catch (e) {} }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fr(d) { try { return d ? new Date(d).toLocaleDateString('fr-FR') : ''; } catch (e) { return ''; } }
  function em() { try { return D && D.s ? String(D.s.email || '').toLowerCase() : ''; } catch (e) { return ''; } }
  function marked() { try { return !!localStorage.getItem('cn45e:' + em()); } catch (e) { return false; } }
  function mark(v) { try { if (v) localStorage.setItem('cn45e:' + em(), String(Date.now())); else localStorage.removeItem('cn45e:' + em()); } catch (e) {} }
  function nzf(s) { try { return nz(s); } catch (e) { return String(s || '').toLowerCase(); } }
  function txtf(h) { try { return txt(h); } catch (e) { return String(h || '').replace(/<[^>]+>/g, ' '); } }

  /* Aucune alerte de securite "acces non valide" pour une personne dont l'abonnement est termine : elle ne doit jamais etre avertie ni bannie pour avoir consulte ses notes. */
  var API0 = window.api;
  if (typeof API0 === 'function') window.api = function (p) {
    try { if (typeof p === 'string' && p.indexOf('/rpc/cn_alerte_acces') > -1 && (CONSULT || marked())) return Promise.resolve(null); } catch (e) {}
    return API0.apply(this, arguments);
  };

  function css() {
    if ($$('#s45')) return;
    var s = document.createElement('style'); s.id = 's45';
    s.textContent = '.w45{display:grid;gap:12px;margin:10px 0}.w45 button.p{padding:16px;font-size:17px}' +
      '.b45{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 14px;border-radius:14px;background:#f59e0b22;border:1px solid #f59e0b88;margin:10px 0;font-size:14px}.b45 button{margin-left:auto}' +
      '.r45{display:flex;flex-direction:column;gap:2px;padding:14px;border-radius:16px;border:1px solid var(--line);background:var(--card);cursor:pointer;margin:8px 0}.r45 small{color:var(--mut)}' +
      '.n45{padding:14px;border-radius:16px;border:1px solid var(--line);background:var(--card);line-height:1.6;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}.n45 img{max-width:100%;height:auto}' +
      '.a45{padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:var(--card);margin:8px 0;display:grid;gap:6px}';
    document.head.appendChild(s);
  }
  function head(t) { return '<div class=top><img class=lg src=icon-192.png alt=""><h1>' + t + '</h1></div>'; }
  function hdr(t) { return '<header><button id="bk45" type="button">\u2039</button><h1>' + E(t) + '</h1></header>'; }
  function banner() {
    return '<div class="b45"><span>\ud83d\udd12 Mode consultation : votre abonnement est termin\u00e9. R\u00e9abonnez-vous pour profiter pleinement de votre cahier (\u00e9crire, enregistrer, dicter, partager\u2026).</span><button class="p" id="rb45" type="button">Se r\u00e9abonner</button></div>';
  }

  /* ---------- \u00c9cran des deux choix ---------- */
  function ended(until) {
    RUN++; css(); if (until) END0 = until;
    app.innerHTML = head('Abonnement termin\u00e9') + '<div class="w45"><div class="card"><small>Votre abonnement au Cahier num\u00e9rique est termin\u00e9' + (END0 ? ' depuis le ' + E(fr(END0)) : '') + '.</small><h3>Que souhaitez-vous faire ?</h3></div>' +
      '<button class="p" id="r45" type="button">\ud83d\udd04 Se r\u00e9abonner</button><button id="c45" type="button">\ud83d\udcd6 Consulter mes notes</button>' +
      '<p class="hint">En consultation, vos notes et vos audios restent visibles, mais rien ne peut \u00eatre modifi\u00e9, enregistr\u00e9, envoy\u00e9 ni re\u00e7u.</p></div>';
    on('#r45', resub); on('#c45', consult);
  }
  function resub() {
    leave();
    try {
      if (typeof window.adgOpt === 'function') return window.adgOpt();
      if (window.cnPay32 && typeof window.cnPay32.open === 'function') return window.cnPay32.open();
    } catch (e) {}
    say('Paiement indisponible pour le moment.');
  }
  function consult() {
    if (!CONSULT) { CONSULT = true; SYNC0 = window.sync; window.sync = function () { return Promise.resolve(); }; }
    VIEW = { n: 'list', c: '', p: '' }; draw();
  }
  function leave() {
    if (CONSULT) { CONSULT = false; if (SYNC0) window.sync = SYNC0; SYNC0 = null; }
  }

  /* ---------- Consultation en lecture seule ---------- */
  function cahiers() { return (D.c || []).filter(function (c) { return !c.del; }); }
  function cah(id) { return (D.c || []).filter(function (c) { return String(c.id) === String(id); })[0]; }
  function pag(c, id) { return c ? (c.pages || []).filter(function (p) { return String(p.id) === String(id); })[0] : null; }
  function lastU(c) { var m = c.u || 0; (c.pages || []).forEach(function (p) { m = Math.max(m, p.u || p.start || 0); }); return m; }
  function clean(h) {
    var doc = new DOMParser().parseFromString('<div>' + String(h || '') + '</div>', 'text/html'), r = doc.body.firstChild;
    if (!r) return '';
    Array.prototype.forEach.call(r.querySelectorAll('script,iframe,object,embed,link,meta,style,form,input,textarea,button,select'), function (e) { e.remove(); });
    Array.prototype.forEach.call(r.querySelectorAll('*'), function (e) {
      Array.prototype.slice.call(e.attributes).forEach(function (a) {
        var n = a.name.toLowerCase(), v = String(a.value || '');
        if (n.indexOf('on') === 0 || n === 'contenteditable' || (/^(href|src|xlink:href|formaction)$/.test(n) && /^\s*javascript:/i.test(v))) e.removeAttribute(a.name);
      });
      if (e.tagName === 'A') { e.setAttribute('target', '_blank'); e.setAttribute('rel', 'noopener'); }
    });
    return r.innerHTML;
  }
  function rowC(c) {
    return '<div class="r45" data-go="c" data-c="' + E(c.id) + '"><b>' + E(c.cours) + '</b><small>' + E(c.prof || 'Professeur non indiqu\u00e9') + ' \u00b7 ' + (c.pages || []).length + ' page(s)</small></div>';
  }
  function rowP(c, p, i) {
    return '<div class="r45" data-go="p" data-c="' + E(c.id) + '" data-p="' + E(p.id) + '"><b>Page ' + (i + 1) + (p.chap ? ' \u00b7 ' + E(p.chap) : '') + '</b><small>' + E(p.sujet || '') + (p.u || p.start ? ' \u00b7 ' + E(fr(p.u || p.start)) : '') + '</small></div>';
  }
  function rowA(x, i) {
    return '<div class="a45"><b>\ud83c\udf99 ' + E(x.n || 'Enregistrement') + '</b><small>Page ' + (i + 1) + (x.d ? ' \u00b7 ' + Math.ceil(x.d / 60) + ' min' : '') + '</small><button type="button" class="ch" data-a="' + E(x.id) + '">\u25b6 \u00c9couter</button><div class="pl45"></div></div>';
  }
  function audios(c, only) {
    var o = '';
    (c.pages || []).forEach(function (p, i) {
      if (only && p !== only) return;
      (p.att || []).forEach(function (x) { if (x && x.k === 'a' && x.st !== 'rec') o += rowA(x, i); });
    });
    return o;
  }
  function draw() {
    css();
    if (VIEW.n === 'cahier') cahierV(); else if (VIEW.n === 'page') pageV(); else listV();
    wire(); try { window.scrollTo(0, 0); } catch (e) {}
  }
  function listV() {
    var L = cahiers().sort(function (a, b) { return lastU(b) - lastU(a); });
    app.innerHTML = '<div id="v45r">' + hdr('Mes notes') + banner() +
      '<div class="sb"><input id="q45" type="search" placeholder="Rechercher dans mes cours et mes notes\u2026"></div><div id="res45"></div>' +
      '<div id="l45">' + (L.length ? L.map(rowC).join('') : '<p class="hint">Aucun cahier sur cet appareil.</p>') + '</div>' +
      '<p class="hint"><button id="lo45" type="button" class="ch">Se d\u00e9connecter</button></p></div>';
    var q = $$('#q45'); if (q) q.oninput = function () { search(q.value); };
  }
  function search(v) {
    v = nzf(String(v || '').trim()); var r = $$('#res45'), l = $$('#l45'); if (!r || !l) return;
    if (!v) { r.innerHTML = ''; l.style.display = ''; return; }
    l.style.display = 'none'; var o = '';
    cahiers().forEach(function (c) {
      if (nzf(String(c.cours || '') + ' ' + String(c.prof || '')).indexOf(v) >= 0) o += rowC(c);
      (c.pages || []).forEach(function (p, i) {
        if (nzf(String(p.chap || '') + ' ' + String(p.sujet || '') + ' ' + txtf(p.html)).indexOf(v) >= 0) o += rowP(c, p, i);
      });
    });
    r.innerHTML = o || '<p class="hint">Aucun r\u00e9sultat.</p>';
  }
  function cahierV() {
    var c = cah(VIEW.c); if (!c) { VIEW.n = 'list'; return listV(); }
    var ps = c.pages || [], a = audios(c);
    app.innerHTML = '<div id="v45r">' + hdr(c.cours) + banner() +
      '<p class="hint">' + E(c.prof || 'Professeur non indiqu\u00e9') + ' \u00b7 ' + ps.length + ' page(s)</p>' +
      (ps.length ? ps.map(function (p, i) { return rowP(c, p, i); }).join('') : '<p class="hint">Aucune page.</p>') +
      (a ? '<h3>Classeur audio</h3>' + a : '') + '</div>';
  }
  function pageV() {
    var c = cah(VIEW.c), p = pag(c, VIEW.p); if (!p) { VIEW.n = 'cahier'; return cahierV(); }
    var ps = c.pages || [], i = ps.indexOf(p), pv = ps[i - 1], nx = ps[i + 1], h = clean(p.html), a = audios(c, p);
    app.innerHTML = '<div id="v45r">' + hdr('Page ' + (i + 1)) + banner() +
      '<p class="hint">' + E(c.cours) + (p.chap ? ' \u00b7 ' + E(p.chap) : '') + (p.sujet ? ' \u00b7 ' + E(p.sujet) : '') + (p.u || p.start ? ' \u00b7 ' + E(fr(p.u || p.start)) : '') + '</p>' +
      '<div class="n45">' + (txtf(h).trim() || /<img/i.test(h) ? h : '<p class="hint">(page vide)</p>') + '</div>' +
      (a ? '<h3>Audios de cette page</h3>' + a : '') +
      '<div style="display:flex;gap:8px;margin:12px 0">' +
      (pv ? '<button type="button" class="ch" data-go="p" data-c="' + E(c.id) + '" data-p="' + E(pv.id) + '">\u2039 Page pr\u00e9c\u00e9dente</button>' : '') +
      (nx ? '<button type="button" class="ch" data-go="p" data-c="' + E(c.id) + '" data-p="' + E(nx.id) + '">Page suivante \u203a</button>' : '') + '</div></div>';
  }
  async function play(id, host) {
    try {
      var b = await fget(id);
      if (!b) return say('Cet audio n\u2019est pas sur cet appareil');
      if (host) host.innerHTML = '<audio controls autoplay playsinline src="' + URL.createObjectURL(b) + '" style="width:100%"></audio>';
    } catch (e) { say('Lecture impossible'); }
  }
  function back() {
    if (VIEW.n === 'page') { VIEW.n = 'cahier'; return draw(); }
    if (VIEW.n === 'cahier') { VIEW.n = 'list'; return draw(); }
    ended();
  }
  function wire() {
    var r = $$('#v45r'); if (!r) return;
    r.onclick = function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-go],[data-a],#bk45,#rb45,#lo45') : null; if (!t) return;
      if (t.id === 'rb45') return resub();
      if (t.id === 'bk45') return back();
      if (t.id === 'lo45') { leave(); if (typeof window.v6out === 'function') window.v6out(); return; }
      if (t.hasAttribute('data-a')) return play(t.getAttribute('data-a'), t.parentNode.querySelector('.pl45'));
      var g = t.getAttribute('data-go');
      if (g === 'c') { VIEW = { n: 'cahier', c: t.getAttribute('data-c'), p: '' }; draw(); }
      else if (g === 'p') { VIEW = { n: 'page', c: t.getAttribute('data-c'), p: t.getAttribute('data-p') }; draw(); }
    };
  }

  /* ---------- Detection de la fin d'abonnement ---------- */
  function check() {
    return tok().then(function () { return api('/rest/v1/rpc/cn_mon_acces', { m: 'POST', b: {} }); }).then(function (a) {
      var u = a && a.acces_jusqu, past = !!u && new Date(u).getTime() < Date.now();
      if (past && a.statut !== 'suspendu') { mark(true); return { ended: true, until: u }; }
      mark(false); return { ended: false };
    }).catch(function () { return { ended: marked() }; });
  }
  var W0 = window.v6wait;
  if (typeof W0 === 'function') window.v6wait = function () {
    var self = this, args = arguments;
    try { if (!D || !D.s || D.stt === 'suspendu') return W0.apply(self, args); } catch (e) { return W0.apply(self, args); }
    if (CONSULT) return;
    var run = ++RUN;
    app.innerHTML = '<p class="hint" style="padding:60px 0;text-align:center">V\u00e9rification de votre acc\u00e8s\u2026</p>';
    check().then(function (r) { if (run !== RUN) return; if (r.ended) ended(r.until); else W0.apply(self, args); });
  };
  var G0 = window.v6gate;
  if (typeof G0 === 'function') window.v6gate = function () {
    try { if (CONSULT) { if (D && D.ok) { leave(); mark(false); } else return Promise.resolve(); } } catch (e) {}
    return G0.apply(this, arguments);
  };

  /* ---------- Administration : abonnements termines + fin d'abonnement provoquee (essai) ---------- */
  async function rp(n, b) { await tok(); return api('/rest/v1/rpc/' + n, { m: 'POST', b: b || {} }); }
  function absent(e) { return /PGRST202|404|Could not find|does not exist/i.test(String(e && (e.message || e.msg || e.error || '')) + ' ' + String(e && e.code)); }
  async function loadAdm() {
    var l = $$('#cn45l'), t = $$('#cn45t'); if (!l || !t) return;
    try {
      var fin = (await rp('cn_admin_abonnements_termines')) || [];
      l.innerHTML = (fin.length ? '<b>Comptes \u00e0 r\u00e9abonner (' + fin.length + ')</b>' : '<p class="hint">Aucun abonnement termin\u00e9 pour le moment.</p>') +
        fin.map(function (u) { return '<div class="rs"><b>' + E(u.email) + '</b><small>Fin le ' + E(fr(u.acces_jusqu)) + '</small><div><button class="ch" type="button" data-r="' + E(u.user_id) + '">\u21a9 R\u00e9tablir 30 jours</button></div></div>'; }).join('');
      var all = (await rp('cn_admin_liste')) || [];
      var ok = all.filter(function (u) { return u.statut === 'valide'; });
      t.innerHTML = '<div style="display:flex;gap:6px;margin:6px 0"><select id="cn45s" style="flex:1"><option value="">Choisir un compte valid\u00e9\u2026</option>' +
        ok.map(function (u) { return '<option value="' + E(u.user_id) + '">' + E(u.email) + '</option>'; }).join('') + '</select><button class="ch" type="button" id="cn45b">Terminer son abonnement</button></div>';
    } catch (e) {
      l.innerHTML = '<p class="hint">' + (absent(e) ? 'Fonctions serveur absentes : ex\u00e9cutez une fois le fichier supabase/migrations/20261128000000_cn_fin_abonnement.sql dans le SQL Editor de Supabase.' : 'Liste indisponible.') + '</p>';
      t.innerHTML = '';
    }
  }
  async function adminBox() {
    var base = $$('#v6a'); if (!base || $$('#cn45')) return;
    if (typeof D === 'undefined' || !D.adm) return;
    var box = document.createElement('div'); box.id = 'cn45';
    box.innerHTML = '<div class="card" style="margin:8px 0"><h3 style="margin:0 0 6px">\u23f3 Abonnements termin\u00e9s</h3>' +
      '<p class="hint" style="margin:0 0 8px">Les comptes dont l\u2019abonnement est termin\u00e9 apparaissent ici automatiquement. Vous pouvez aussi provoquer la fin d\u2019abonnement d\u2019un compte pour essayer l\u2019\u00e9cran qu\u2019il verra (vous pourrez le r\u00e9tablir ensuite).</p>' +
      '<div id="cn45t"></div><div id="cn45l"><p class="hint">Chargement\u2026</p></div></div>';
    var w = $$('#cn37'), ref = w || base; ref.parentNode.insertBefore(box, ref);
    box.onclick = async function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('#cn45b,[data-r]') : null; if (!t) return;
      try {
        if (t.id === 'cn45b') {
          var s = $$('#cn45s'), id = s && s.value; if (!id) return say('Choisissez un compte.');
          if (!confirm('Provoquer la fin d\u2019abonnement de ' + s.options[s.selectedIndex].text + ' ? Cette personne verra l\u2019\u00e9cran \u00ab abonnement termin\u00e9 \u00bb jusqu\u2019\u00e0 son r\u00e9abonnement ou jusqu\u2019\u00e0 ce que vous la r\u00e9tablissiez ici.')) return;
          await rp('cn_admin_forcer_fin', { p_user: id }); say('Abonnement termin\u00e9 pour ce compte');
        } else {
          await rp('cn_admin_retablir_abo', { p_user: t.getAttribute('data-r'), p_jours: 30 }); say('Acc\u00e8s r\u00e9tabli pour 30 jours');
        }
        loadAdm();
      } catch (e) { say(absent(e) ? 'Fonction serveur absente : ex\u00e9cutez le fichier SQL v45.' : 'Action impossible'); }
    };
    loadAdm();
  }
  var A0 = window.v6admin;
  if (typeof A0 === 'function') window.v6admin = async function () {
    var r = await A0.apply(this, arguments);
    try { await adminBox(); } catch (e) {}
    return r;
  };
})();
