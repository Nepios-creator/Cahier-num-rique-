/* v18 : interface plus claire (rien n'est supprimé, tout est regroupé).
   - Écran du cahier : d'abord l'essentiel (nouvelle page, réviser, examen, pages) ; audios, documents PDF/Word,
     sauvegarde et partage sont rangés dans des sections repliables.
   - Écran de page : l'éditeur passe en premier ; outils, pièces jointes (audios, notes complémentaires, étiquettes)
     sont dans deux panneaux repliables ; « Supprimer la page » est tout à la fin du panneau Outils. */
(function () {
  var st = document.createElement('style');
  st.textContent =
    '.v18g{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.v18g button{margin:0;min-height:48px}.v18g .p{grid-column:1/-1}' +
    'details.v18d{background:var(--card);border:1px solid var(--line);border-radius:16px;margin:10px 0;overflow:hidden}' +
    'details.v18d>summary{list-style:none;cursor:pointer;padding:14px 16px;font-weight:700;display:flex;gap:8px;align-items:center;-webkit-user-select:none;user-select:none}' +
    'details.v18d>summary::-webkit-details-marker{display:none}' +
    'details.v18d>summary span{flex:1}details.v18d>summary small{opacity:.6;font-weight:600}' +
    'details.v18d>summary::after{content:"\\25BE";opacity:.55;transition:transform .2s}details.v18d[open]>summary::after{transform:rotate(180deg)}' +
    'details.v18d>.v18b{padding:0 12px 12px}details.v18d .f{margin:0}' +
    '.hero.v18c{padding:16px 20px;border-radius:22px;box-shadow:0 8px 22px #0003}.hero.v18c h2{font-size:26px;margin:8px 0 4px}' +
    '.hero.v18c .lg{width:30px;height:30px}.hero.v18c small{margin-top:4px}.hero.v18c br{display:none}' +
    '.v18s{display:flex;align-items:center;gap:8px;flex:none;padding:2px 0 6px}' +
    '.v18s .meta{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0}' +
    '.v18s button{flex:none;padding:6px 12px;border-radius:20px;font-size:13px;height:auto;min-width:0}' +
    '.v18p,.v18t{display:none;flex:none;max-height:40vh;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:10px;margin-bottom:8px}' +
    '.v18p.on,.v18t.on{display:block}.v18p #tgs{overflow-x:auto}.v18p #at{max-height:none}' +
    '.v18t .gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}' +
    '.v18t .gr button{height:auto;min-height:44px;margin:0;text-align:left;font-size:14px;min-width:0;padding:8px 12px}' +
    '.v18t .dz{margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)}' +
    '.v18t .dz button{width:100%;height:auto;min-height:44px;color:#c0392b;border:1px solid #c0392b66;background:transparent;box-shadow:none}' +
    '.tb .v18o{font-weight:700}';
  document.head.appendChild(st);

  var NP = 'onpointerdown="event.preventDefault()"';
  var LABELS = [[/lire\(/, ' Lire à voix haute'], [/stopL/, ' Arrêter la lecture'], [/^fs\(/, ' Plein écran'],
    [/#fi/, ' Photo'], [/dark\(/, ' Mode sombre']];

  window.v18tog = function (w) {
    var p = document.getElementById('v18p'), t = document.getElementById('v18t');
    var a = w == 'p' ? p : t, o = w == 'p' ? t : p;
    if (o) o.classList.remove('on');
    if (a) a.classList.toggle('on');
  };

  function mk(title, node) {
    var d = document.createElement('details'); d.className = 'v18d';
    var s = document.createElement('summary'); s.innerHTML = '<span>' + title + '</span><small></small>';
    var b = document.createElement('div'); b.className = 'v18b'; b.appendChild(node);
    d.appendChild(s); d.appendChild(b);
    function up() { var c = node.querySelectorAll('.rs').length; s.lastChild.textContent = c ? c : ''; }
    up(); try { new MutationObserver(up).observe(node, { childList: true, subtree: true }); } catch (e) {}
    return d;
  }

  /* ---------- Écran du cahier ---------- */
  function cahier() {
    var h = document.querySelector('.hero');
    if (!h || h.dataset.v18) return;
    var f = app.querySelector('.f'); if (!f) return;
    h.dataset.v18 = 1; h.classList.add('v18c');
    var main = { newP: null, rev: null, v13: null }, rest = [];
    [].slice.call(f.children).forEach(function (b) {
      var oc = b.getAttribute('onclick') || '';
      if (/^newP\(/.test(oc)) main.newP = b;
      else if (/^rev\(/.test(oc)) main.rev = b;
      else if (b.id == 'v13bt') main.v13 = b;
      else rest.push(b);
    });
    var g = document.createElement('div'); g.className = 'v18g';
    [main.newP, main.rev, main.v13].forEach(function (b) { if (b) g.appendChild(b); });
    var tools = document.createElement('div'); tools.className = 'f';
    rest.forEach(function (b) { tools.appendChild(b); });
    f.replaceWith(g);

    var lhs = [].slice.call(app.querySelectorAll('.lh')), lhA, lhD;
    lhs.forEach(function (x) { if (/audio/i.test(x.textContent)) lhA = x; else if (/PDF|Word/i.test(x.textContent)) lhD = x; });
    var cl = document.getElementById('cl'), dl = document.getElementById('v8l');
    if (lhA) lhA.remove(); if (lhD) lhD.remove();
    if (cl) app.appendChild(mk('🎙 Classeur audio', cl));
    if (dl) app.appendChild(mk('📚 Documents PDF / Word', dl));
    var dt = mk('🧰 Sauvegarde et partage', tools); dt.id = 'v18tools'; app.appendChild(dt);
  }
  function sweep() { // boutons ajoutés tardivement par d'autres scripts
    var d = document.getElementById('v18tools'); if (!d) return;
    var box = d.querySelector('.f');
    ['v10gd', 'v11sd', 'v13bt'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b && !b.closest('.v18g') && !b.closest('details')) box.appendChild(b);
    });
  }
  var ob = window.openB;
  window.openB = function () {
    var r = ob.apply(this, arguments);
    try { cahier(); setTimeout(function () { try { cahier(); sweep(); } catch (e) {} }, 900); } catch (e) {}
    return r;
  };

  /* ---------- Écran de page ---------- */
  function cnt() {
    var n = document.getElementById('v18n'); if (!n || typeof pg == 'undefined' || !pg) return;
    var a = pg.att || [], au = a.filter(function (x) { return x.k == 'a'; }).length;
    var ot = a.length - au + (pg.cpl || []).length, tg = (pg.tags || []).length;
    var rec = a.some(function (x) { return x.st == 'rec'; });
    var s = [pg.fav ? '★' : '', au ? '🎙 ' + au : '', ot ? '📎 ' + ot : '', tg ? '# ' + tg : ''].filter(Boolean).join(' · ');
    n.textContent = (rec ? '🔴 ' : '') + (s || 'Étiquettes');
  }
  function page() {
    var ed = document.querySelector('.ed'); if (!ed) return;
    var tb = ed.querySelector('.tb'); if (!tb || tb.dataset.v18) return;
    tb.dataset.v18 = 1;
    var keep = [], tools = [], del = null;
    [].slice.call(tb.children).forEach(function (n) {
      var oc = n.getAttribute('onclick') || '';
      if (/v10delP/.test(oc)) del = n;
      else if (n.tagName == 'I' || n.classList.contains('d') || /^(cmd\(|v65num|v14|bro\(|rec\(|dic\()/.test(oc)) keep.push(n);
      else tools.push(n);
    });
    // panneau Outils
    var t = document.createElement('div'); t.className = 'v18t'; t.id = 'v18t';
    var gr = document.createElement('div'); gr.className = 'gr';
    tools.forEach(function (b) {
      var oc = b.getAttribute('onclick') || '';
      if (b.textContent.replace(/\s/g, '').length <= 3) {
        for (var i = 0; i < LABELS.length; i++) if (LABELS[i][0].test(oc)) { b.insertAdjacentText('beforeend', LABELS[i][1]); break; }
      }
      gr.appendChild(b);
    });
    t.appendChild(gr);
    if (del) {
      var dz = document.createElement('div'); dz.className = 'dz';
      del.textContent = '🗑 Supprimer la page'; dz.appendChild(del); t.appendChild(dz);
    }
    t.addEventListener('click', function (e) { if (e.target.closest('button')) setTimeout(function () { t.classList.remove('on'); }, 60); });
    // barre : Outils d'abord, puis mise en forme et aides à l'écriture
    tb.innerHTML = '';
    var ob = document.createElement('button'); ob.className = 'v18o'; ob.setAttribute('onpointerdown', 'event.preventDefault()');
    ob.setAttribute('onclick', "v18tog('t')"); ob.textContent = '⚙ Outils';
    tb.appendChild(ob); keep.forEach(function (n) { tb.appendChild(n); });
    // bandeau d'infos + panneau pièces jointes
    var meta = ed.querySelector('.meta'), tgs = document.getElementById('tgs'), at = document.getElementById('at'), cp = document.getElementById('cp');
    var s = document.createElement('div'); s.className = 'v18s';
    if (meta) s.appendChild(meta);
    var chip = document.createElement('button'); chip.setAttribute('onpointerdown', 'event.preventDefault()');
    chip.setAttribute('onclick', "v18tog('p')"); chip.innerHTML = '<span id=v18n></span> ▾'; s.appendChild(chip);
    var p = document.createElement('div'); p.className = 'v18p'; p.id = 'v18p';
    [tgs, at, cp].forEach(function (x) { if (x) p.appendChild(x); });
    tb.insertAdjacentElement('afterend', t);
    t.insertAdjacentElement('afterend', s);
    s.insertAdjacentElement('afterend', p);
    cnt();
    [tgs, at, cp].forEach(function (x) { if (x) try { new MutationObserver(cnt).observe(x, { childList: true, subtree: true }); } catch (e) {} });
  }
  var d18 = window.draw;
  window.draw = function () {
    var r = d18.apply(this, arguments);
    try { page(); } catch (e) {}
    return r;
  };
})();
