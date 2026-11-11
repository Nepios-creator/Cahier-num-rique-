/* ADG — verrou d'activation (Answer Digital)
   Fichier générique : seule la zone CFG change d'une application vendue à l'autre.
   Le client envoie une demande → l'admin valide dans ADG Ambassadeurs → l'application se débloque seule. */
(function () {
  'use strict';

  /* ====== CONFIGURATION (à adapter pour chaque application) ====== */
  var CFG = {
    app: 'Cahier numérique', // nom EXACT dans l'onglet Apps d'ADG Ambassadeurs
    title: 'Cahier numérique',
    url: 'https://kearpnvypzztnnltmrpp.supabase.co',
    key: 'sb_publishable_whfpzyuXH1Qup_q2h5wPdg_QY9uKqpA',
    store: 'adg-lic-v1',
    // Clients existants (déjà des cahiers sur l'appareil) : jamais bloqués
    legacy: function () {
      try { var d = JSON.parse(localStorage.getItem('cahier-num-v1')); return !!(d && d.c && d.c.length); } catch (e) { return false; }
    }
  };
  /* =============================================================== */

  var lic = null, ov = null, timer = null, info = { price: 0, currency: '$', pay_info: '' }, lastRecheck = 0, inerted = [];
  var $ = function (s) { return ov && ov.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var load = function () { try { return JSON.parse(localStorage.getItem(CFG.store)); } catch (e) { return null; } };
  var save = function (o) { try { localStorage.setItem(CFG.store, JSON.stringify(o)); } catch (e) {} };

  /* ---------- Code de parrainage (lien ?ref=AMB-XXXXX) ---------- */
  try {
    var q = new URLSearchParams(location.search).get('ref');
    if (q) localStorage.setItem('adg-ref', q.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20));
  } catch (e) {}
  var getRef = function () { try { return localStorage.getItem('adg-ref') || ''; } catch (e) { return ''; } };

  /* ---------- Réseau ---------- */
  function rpc(fn, body) {
    return fetch(CFG.url + '/rest/v1/rpc/' + fn, {
      method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { j = t; }
        if (!r.ok) throw new Error((j && j.message) || 'Erreur');
        return j;
      });
    });
  }
  function shrink(file) {
    return createImageBitmap(file).then(function (bm) {
      var k = Math.min(1, 1280 / Math.max(bm.width, bm.height)), c = document.createElement('canvas');
      c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
      c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.82); });
    }).catch(function () { return file; });
  }
  function upload(blob) {
    var ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[blob.type];
    if (!ext) return Promise.reject(new Error('Utilisez une capture d\'écran (JPG ou PNG).'));
    if (blob.size > 3 * 1024 * 1024) return Promise.reject(new Error('Image trop lourde. Faites une capture d\'écran plutôt qu\'une photo.'));
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    var name = id + '.' + ext;
    return fetch(CFG.url + '/storage/v1/object/proofs/' + name, {
      method: 'POST', headers: { apikey: CFG.key, 'Content-Type': blob.type, 'x-upsert': 'false' }, body: blob
    }).then(function (r) {
      if (!r.ok) throw new Error('Envoi de l\'image impossible. Réessayez.');
      return CFG.url + '/storage/v1/object/public/proofs/' + name;
    });
  }
  function msg(x) {
    var m = (x && x.message) || '';
    if (/failed to fetch|network|load failed/i.test(m)) return 'Pas de connexion internet. Réessayez.';
    if (/Trop de demandes/.test(m)) return 'Vous avez déjà plusieurs demandes en attente. Patientez ou contactez Answer Digital.';
    if (/Nom invalide/.test(m)) return 'Nom invalide.';
    if (/Telephone invalide/.test(m)) return 'Numéro de téléphone invalide.';
    if (/Application inconnue/.test(m)) return 'Application momentanément indisponible. Contactez Answer Digital.';
    if (/image|capture|Image|Utilisez/.test(m)) return m;
    return 'Une erreur est survenue. Réessayez.';
  }

  /* ---------- Style & logo ---------- */
  var CELLS = [[2,0,'#a3e635'],[3,0,'#bef264'],[4,0,'#bef264'],[1,1,'#4ade80'],[2,1,'#a3e635'],[3,1,'#a3e635'],[4,1,'#bef264'],[1,2,'#4ade80'],[2,2,'#4ade80'],[3,2,'#a3e635'],[0,3,'#2dd4bf'],[1,3,'#2dd4bf'],[2,3,'#4ade80'],[0,4,'#22d3ee']];
  var LOGO = function (s) {
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 325 325" aria-label="Answer Digital">' + CELLS.map(function (a) {
      return '<rect x="' + a[0] * 67 + '" y="' + a[1] * 67 + '" width="58" height="58" rx="13" fill="' + a[2] + '"/>';
    }).join('') + '</svg>';
  };
  function css() {
    if (document.getElementById('adg-css')) return;
    var s = document.createElement('style'); s.id = 'adg-css';
    s.textContent = '#adg{position:fixed;inset:0;z-index:2147483000;overflow:auto;-webkit-overflow-scrolling:touch;background:var(--bg,#f3f4fb);color:var(--ink,#12142b);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:max(18px,env(safe-area-inset-top)) 16px max(18px,env(safe-area-inset-bottom))}' +
      '#adg *{box-sizing:border-box}#adg .w{max-width:440px;margin:0 auto}' +
      '#adg h1{font:800 22px/1.25 system-ui,-apple-system,sans-serif;margin:14px 0 6px}#adg p{margin:6px 0}' +
      '#adg .m{color:var(--mut,#12142b99);font-size:14px}' +
      '#adg .box{background:var(--card,#fff);border:1px solid var(--line,#12142b1a);border-radius:14px;padding:12px 14px;margin:12px 0}' +
      '#adg .pr{font-weight:800;font-size:20px;color:var(--acc,#4f46e5)}#adg .pi{white-space:pre-wrap;font-size:14px;margin-top:4px}' +
      '#adg label{display:block;font-weight:600;font-size:14px;margin-top:10px}' +
      '#adg input[type=text],#adg input[type=tel],#adg input[type=file]{display:block;width:100%;margin-top:4px;padding:12px;border:1px solid var(--line,#12142b1a);border-radius:12px;background:var(--card,#fff);color:inherit;font:inherit;font-weight:400}' +
      '#adg .seg{display:flex;gap:8px;margin-top:12px}#adg .seg label{flex:1;margin:0;display:flex;align-items:center;gap:8px;border:1px solid var(--line,#12142b1a);border-radius:12px;padding:11px;background:var(--card,#fff);font-weight:600}' +
      '#adg .seg input{width:auto;margin:0}' +
      '#adg button{font:inherit;font-weight:700;cursor:pointer}#adg .p{display:block;width:100%;margin-top:14px;padding:14px;border:0;border-radius:14px;background:var(--acc,#4f46e5);color:#fff}' +
      '#adg .p[disabled]{opacity:.6}#adg .s{display:block;width:100%;margin-top:10px;padding:12px;border:1px solid var(--line,#12142b1a);border-radius:14px;background:transparent;color:inherit}' +
      '#adg a{color:var(--acc,#4f46e5);font-weight:600;cursor:pointer;text-decoration:underline}#adg .e{color:#dc2626;font-size:14px;min-height:20px;margin-top:8px}' +
      '#adg .ok{width:64px;height:64px;border-radius:50%;background:#16a34a;color:#fff;font-size:34px;display:flex;align-items:center;justify-content:center;margin:26px auto 0}' +
      '#adg .c{text-align:center}#adg .code{font:800 30px/1.2 ui-monospace,Menlo,monospace;letter-spacing:4px;margin:12px 0;color:var(--acc,#4f46e5)}' +
      '#adg .sp{width:22px;height:22px;border:3px solid var(--line,#12142b1a);border-top-color:var(--acc,#4f46e5);border-radius:50%;animation:adgs 1s linear infinite;margin:16px auto 0}@keyframes adgs{to{transform:rotate(360deg)}}' +
      '#adg .by{display:flex;align-items:center;justify-content:center;gap:8px;margin:26px 0 6px;font-size:12px;color:var(--mut,#12142b99)}#adg .hd{display:flex;align-items:center;gap:10px}';
    document.head.appendChild(s);
  }
  var by = function () { return '<div class="by">' + LOGO(18) + '<span>Propulsé par <b>Answer Digital</b></span></div>'; };

  /* ---------- Verrouillage de l'écran ---------- */
  function lock() {
    css();
    if (!ov) { ov = document.createElement('div'); ov.id = 'adg'; document.body.appendChild(ov); }
    inerted = [];
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el !== ov && !el.hasAttribute('inert')) { el.setAttribute('inert', ''); inerted.push(el); }
    });
    document.documentElement.style.overflow = 'hidden';
    if (lic && lic.st === 'pending') pending(); else if (lic && lic.st === 'rejected') rejected(); else form();
  }
  function unlock(showCode) {
    stop();
    inerted.forEach(function (el) { el.removeAttribute('inert'); }); inerted = [];
    document.documentElement.style.overflow = '';
    if (ov) { ov.remove(); ov = null; }
    if (showCode && lic && lic.code) codeModal();
  }
  function codeModal() {
    css();
    var m = document.createElement('div'); m.id = 'adg';
    m.innerHTML = '<div class="w c"><div class="ok">✓</div><h1>Paiement confirmé !</h1><p>Votre ' + esc(CFG.title) + ' est activé.</p>' +
      '<div class="box"><p class="m">Votre code d\'accès (notez-le ou faites une capture d\'écran)</p><div class="code">' + esc(lic.code) + '</div>' +
      '<p class="m">Il permet de réactiver l\'application si vous changez de téléphone.</p></div>' +
      '<button class="p" id="adg-go">Commencer</button>' + by() + '</div>';
    document.body.appendChild(m);
    m.querySelector('#adg-go').onclick = function () { m.remove(); };
  }

  /* ---------- Écran 1 : demande d'activation ---------- */
  function infoHtml() {
    var p = info.price > 0 ? '<div class="pr">' + esc(Number(info.price)) + ' ' + esc(info.currency) + '</div>' : '';
    return p + (info.pay_info ? '<div class="pi">' + esc(info.pay_info) + '</div>' : '');
  }
  function form() {
    stop();
    ov.innerHTML = '<div class="w"><div class="hd">' + LOGO(40) + '<div><b>' + esc(CFG.title) + '</b><div class="m">by Answer Digital</div></div></div>' +
      '<h1>Activez votre ' + esc(CFG.title) + '</h1><p class="m">Envoyez votre demande d\'activation. Elle est validée par Answer Digital et l\'application se débloque toute seule.</p>' +
      '<div class="box" id="adg-info">' + infoHtml() + '</div>' +
      '<form id="adg-f" novalidate><label>Nom complet<input type="text" id="adg-n" autocomplete="name"></label>' +
      '<label>Téléphone<input type="tel" id="adg-t" autocomplete="tel" placeholder="+243 …"></label>' +
      '<label>Code ambassadeur (si vous en avez un)<input type="text" id="adg-r" autocapitalize="characters" placeholder="AMB-XXXXX" value="' + esc(getRef()) + '"></label>' +
      '<div class="seg"><label><input type="radio" name="adg-m" value="mobile_money" checked> 📱 Mobile money</label><label><input type="radio" name="adg-m" value="cash"> 💵 Cash</label></div>' +
      '<div id="adg-mm"><label>Capture d\'écran de votre paiement<input type="file" id="adg-file" accept="image/*"></label></div>' +
      '<p id="adg-cash" class="m" hidden>Remettez le montant à votre ambassadeur. Il confirmera votre paiement et votre application sera activée.</p>' +
      '<div class="e" id="adg-e"></div><button class="p" id="adg-sub">Envoyer ma demande</button></form>' +
      '<p class="c m" style="margin-top:16px"><a id="adg-have">J\'ai déjà un code d\'accès</a></p>' + by() + '</div>';
    Array.prototype.forEach.call(ov.querySelectorAll('input[name=adg-m]'), function (r) {
      r.onchange = function () { var c = $('input[name=adg-m]:checked').value === 'cash'; $('#adg-mm').hidden = c; $('#adg-cash').hidden = !c; };
    });
    $('#adg-f').onsubmit = submit;
    $('#adg-have').onclick = have;
    rpc('get_app_info', { p_app_name: CFG.app }).then(function (r) {
      if (r && r[0]) { info = r[0]; var b = $('#adg-info'); if (b) b.innerHTML = infoHtml(); }
    }).catch(function () {});
  }
  function submit(e) {
    e.preventDefault();
    var err = function (t) { var x = $('#adg-e'); if (x) x.textContent = t; };
    var name = $('#adg-n').value.trim(), phone = $('#adg-t').value.trim(), ref = $('#adg-r').value.trim().toUpperCase();
    var method = $('input[name=adg-m]:checked').value, f = $('#adg-file').files[0];
    if (name.length < 2) return err('Entrez votre nom complet.');
    if (phone.replace(/\D/g, '').length < 6) return err('Entrez un numéro de téléphone valide.');
    if (method === 'mobile_money' && !f) return err('Ajoutez la capture d\'écran de votre paiement.');
    err(''); var b = $('#adg-sub'); b.disabled = true; b.textContent = 'Envoi en cours…';
    var step = method === 'mobile_money' ? shrink(f).then(upload) : Promise.resolve(null);
    step.then(function (proof) {
      return rpc('register_sale', { p_ref_code: ref, p_app_name: CFG.app, p_client_name: name, p_client_phone: phone, p_method: method, p_amount: null, p_proof_url: proof });
    }).then(function (sid) {
      try { localStorage.setItem('adg-ref', ref); } catch (x) {}
      lic = { sid: sid, st: 'pending', name: name, m: method }; save(lic);
      pending(); start();
    }).catch(function (x) { err(msg(x)); b.disabled = false; b.textContent = 'Envoyer ma demande'; });
  }

  /* ---------- Écran 2 : en attente de validation ---------- */
  function pending() {
    ov.innerHTML = '<div class="w c"><div class="ok" style="background:var(--acc,#4f46e5)">⏳</div><h1>Demande envoyée</h1>' +
      '<p>Merci' + (lic.name ? ' <b>' + esc(lic.name.split(' ')[0]) + '</b>' : '') + '. Nous vérifions votre paiement.</p>' +
      '<p class="m">Cet écran se débloquera <b>automatiquement</b> dès la validation.<br>' + (lic.m === 'cash' ? 'Paiement cash : après confirmation par votre ambassadeur.' : 'Mobile money : généralement en quelques minutes.') + '</p>' +
      '<div class="sp"></div><p class="m" id="adg-st" style="margin-top:12px"></p>' +
      '<button class="s" id="adg-chk">Vérifier maintenant</button>' +
      '<p class="m" style="margin-top:18px"><a id="adg-new">Faire une nouvelle demande</a></p>' + by() + '</div>';
    $('#adg-chk').onclick = function () { check(true); };
    $('#adg-new').onclick = function () { if (confirm('Annuler cette demande et en faire une nouvelle ?')) { lic = null; try { localStorage.removeItem(CFG.store); } catch (e) {} form(); } };
  }
  function rejected() {
    stop();
    ov.innerHTML = '<div class="w c"><div class="ok" style="background:#dc2626">!</div><h1>Paiement non confirmé</h1>' +
      '<p>Votre demande n\'a pas pu être validée. Contactez votre ambassadeur ou Answer Digital, puis refaites une demande.</p>' +
      '<button class="p" id="adg-new">Nouvelle demande</button>' + by() + '</div>';
    $('#adg-new').onclick = function () { lic = null; try { localStorage.removeItem(CFG.store); } catch (e) {} form(); };
  }

  /* ---------- Écran 3 : retrouver son accès avec un code ---------- */
  function have() {
    ov.innerHTML = '<div class="w"><h1>Retrouver mon accès</h1><p class="m">Entrez le code d\'accès reçu lors de votre activation.</p>' +
      '<label>Code d\'accès<input type="text" id="adg-c" autocapitalize="characters" autocomplete="off" placeholder="XXXXXXXX"></label>' +
      '<div class="e" id="adg-e"></div><button class="p" id="adg-ok">Retrouver mon accès</button><button class="s" id="adg-back">Retour</button>' +
      '<p class="m" style="margin-top:16px">Ancien utilisateur sans code ? Contactez Answer Digital.</p>' + by() + '</div>';
    $('#adg-back').onclick = form;
    $('#adg-ok').onclick = function () {
      var c = $('#adg-c').value.trim(), e = $('#adg-e'), b = $('#adg-ok');
      if (c.length < 4) { e.textContent = 'Entrez votre code.'; return; }
      e.textContent = ''; b.disabled = true;
      rpc('claim_access', { p_code: c, p_app_name: CFG.app }).then(function (r) {
        var row = r && r[0];
        if (!row) { e.textContent = 'Code introuvable. Vérifiez-le ou contactez Answer Digital.'; b.disabled = false; return; }
        lic = { sid: row.sale_id, st: 'validated', code: row.access_code }; save(lic); unlock(false);
      }).catch(function (x) { e.textContent = msg(x); b.disabled = false; });
    };
  }

  /* ---------- Vérification du statut ---------- */
  function check(manual) {
    if (!lic || !lic.sid) return;
    var say = function (t) { var s = $('#adg-st'); if (s) s.textContent = t; };
    rpc('get_sale_info', { p_sale_id: lic.sid }).then(function (r) {
      var row = r && r[0];
      if (!row) { if (manual) say('Demande introuvable.'); return; }
      if (row.status === 'validated') { lic.st = 'validated'; lic.code = row.access_code; save(lic); unlock(true); }
      else if (row.status === 'rejected') { lic.st = 'rejected'; save(lic); if (ov) rejected(); }
      else if (manual) say('Toujours en cours de vérification…');
    }).catch(function () { if (manual) say('Pas de connexion. Réessayez.'); });
  }
  function start() { stop(); timer = setInterval(function () { if (!document.hidden) check(false); }, 8000); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  // Application déjà activée : on vérifie de temps en temps que l'accès est toujours valide (hors ligne = on laisse passer)
  function recheck() {
    if (!lic || lic.legacy || !lic.sid || lic.st !== 'validated') return;
    if (Date.now() - lastRecheck < 60000) return; lastRecheck = Date.now();
    rpc('get_sale_info', { p_sale_id: lic.sid }).then(function (r) {
      var row = r && r[0];
      if (row && row.status !== 'validated') { lic.st = row.status; save(lic); lock(); if (lic.st === 'pending') start(); }
    }).catch(function () {});
  }

  /* ---------- Démarrage ---------- */
  lic = load();
  if (!lic && CFG.legacy()) { lic = { st: 'validated', legacy: 1 }; save(lic); }
  if (lic && lic.st === 'validated') {
    recheck();
    window.addEventListener('online', recheck);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) recheck(); });
  } else {
    lock();
    if (lic && lic.st === 'pending') { check(false); start(); }
    window.addEventListener('online', function () { if (lic && lic.st === 'pending') check(false); });
  }
})();
