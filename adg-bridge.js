/* ADG Ambassadeurs — pont avec le flux de paiement existant du Cahier numérique.
   - Ajoute le champ « Code ambassadeur » aux formulaires de preuve et de cash.
   - Envoie aussi la demande à ADG (vente + preuve) pour l'attribution et les points.
   - Quand l'admin valide dans ADG, débloque le compte Cahier (via cn_adg_sync côté serveur).
   Ne remplace rien : il ne fait qu'ajouter. À charger APRÈS v12.js. */
(function () {
  'use strict';
  var U = 'https://kearpnvypzztnnltmrpp.supabase.co';
  var K = 'sb_publishable_whfpzyuXH1Qup_q2h5wPdg_QY9uKqpA';
  var APP = 'Cahier numérique';

  /* ---------- Code ambassadeur : lien ?ref=AMB-XXXXX mémorisé ---------- */
  var clean = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20); };
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return ''; };
  try { var q = new URLSearchParams(location.search).get('ref'); if (q) ls('adg-ref', clean(q)); } catch (e) {}
  var getRef = function () { return clean(ls('adg-ref') || ''); };

  /* ---------- Réseau ADG ---------- */
  function rpc(fn, body) {
    return fetch(U + '/rest/v1/rpc/' + fn, {
      method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { j = t; }
        if (!r.ok) throw new Error((j && j.message) || 'adg');
        return j;
      });
    });
  }
  function upload(blob) {
    var ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[blob.type];
    if (!ext || blob.size > 3 * 1024 * 1024) return Promise.resolve(null);
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    var name = id + '.' + ext;
    return fetch(U + '/storage/v1/object/proofs/' + name, {
      method: 'POST', headers: { apikey: K, 'Content-Type': blob.type, 'x-upsert': 'false' }, body: blob
    }).then(function (r) { return r.ok ? U + '/storage/v1/object/public/proofs/' + name : null; }).catch(function () { return null; });
  }

  /* ---------- 1) Champ « Code ambassadeur » dans les formulaires ---------- */
  var refVal = null;
  function inject() {
    var btn = document.getElementById('v7s') || document.getElementById('v11s');
    if (!btn || document.getElementById('adgref')) return;
    var lab = document.createElement('label');
    lab.innerHTML = 'Code ambassadeur (si vous en avez un)<input id="adgref" autocapitalize="characters" autocomplete="off" placeholder="AMB-XXXXX">';
    btn.parentNode.insertBefore(lab, btn);
    var inp = lab.querySelector('input');
    inp.value = refVal != null ? refVal : getRef();
    inp.addEventListener('input', function () { refVal = clean(inp.value); });
  }
  try {
    new MutationObserver(inject).observe(document.body || document.documentElement, { childList: true, subtree: true });
    inject();
  } catch (e) {}

  /* ---------- 2) Capture de la preuve + envoi de la vente à ADG ---------- */
  var proofBlob = null, ofetch = window.fetch;
  window.fetch = function (u, o) {
    try { if (o && o.method === 'POST' && String(u).indexOf('/object/cn-preuves/') > -1 && o.body instanceof Blob) proofBlob = o.body; } catch (e) {}
    return ofetch.apply(this, arguments);
  };

  var oapi = window.api;
  function register(b) {
    var ref = clean(refVal != null ? refVal : getRef());
    if (ref) ls('adg-ref', ref);
    var cash = b.preuve_path === 'cash';
    var job = { n: b.nom, t: b.telephone, m: cash ? 'cash' : 'mobile_money', r: ref, b: cash ? null : proofBlob };
    proofBlob = null;
    attempt(job, 0);
  }
  function attempt(job, k) {
    Promise.resolve(job.b ? (job.proof || (job.proof = upload(job.b))) : null).then(function (proof) {
      return rpc('register_sale', { p_ref_code: job.r, p_app_name: APP, p_client_name: job.n, p_client_phone: job.t, p_method: job.m, p_amount: null, p_proof_url: proof });
    }).then(function (sid) {
      ls('adg-sale', sid);
      return oapi('/rest/v1/rpc/cn_adg_link', { m: 'POST', b: { p_sale: sid } }).catch(function () {});
    }).catch(function () { if (k < 3) setTimeout(function () { attempt(job, k + 1); }, 4000 * (k + 1)); });
  }
  if (typeof oapi === 'function') {
    window.api = async function (p, o) {
      var r = await oapi.apply(this, arguments);
      try { if (o && o.m === 'POST' && String(p).indexOf('/rest/v1/cn_paiements') === 0 && o.b) register(o.b); } catch (e) {}
      return r;
    };
  }

  /* ---------- 3) Déblocage quand ADG a validé ---------- */
  function sync() {
    try { if (!D || !D.s || D.ok || typeof oapi !== 'function') return Promise.resolve(); } catch (e) { return Promise.resolve(); }
    return oapi('/rest/v1/rpc/cn_adg_sync', { m: 'POST', b: {} }).catch(function () {});
  }
  var og = window.v6gate;
  if (typeof og === 'function') {
    window.v6gate = async function () { await sync(); return og.apply(this, arguments); };
  }
  setInterval(function () {
    try {
      if (document.hidden || !D || !D.s || D.ok || !document.getElementById('app')) return;
      var t = document.getElementById('app').textContent || '';
      if (!/en attente|Preuve envoyée|Paiement en attente/i.test(t)) return;
      sync().then(function () { return oapi('/rest/v1/cn_profils?select=statut'); }).then(function (r) {
        if (r && r[0] && r[0].statut === 'valide' && typeof window.v6gate === 'function') window.v6gate();
      }).catch(function () {});
    } catch (e) {}
  }, 10000);
})();
