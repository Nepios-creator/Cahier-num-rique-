/* v19 : scanneur fidèle.
   1) Amélioration d'image DOUCE : l'éclairage est égalisé (ombres, reflets) et le contraste relevé, sans jamais
      transformer la page en noir et blanc dur (l'ancien traitement effaçait les lignes fines).
   2) « Convertir en texte » : lecture par l'IA (service cn-scan) qui recopie le texte tel qu'il est imprimé,
      avec ses grands et petits titres, ses listes, son gras et son italique, sans rien ajouter.
      Si l'IA n'est pas joignable, l'ancienne lecture sur l'appareil sert de secours.
   3) « Insérer comme image » : image améliorée, en meilleure qualité. */
(function () {
  var V19 = { html: '', forT: null, busy: 0 };

  /* ---- 1. Amélioration d'image douce ---- */
  window.enh = function (c) {
    var W = c.width, H = c.height, x = c.getContext('2d'), d = x.getImageData(0, 0, W, H), a = d.data;
    /* 1) éclairage du papier : estimé sur une version réduite, en ignorant l'encre (filtre « max » puis lissage) */
    var sc = 8, w = Math.max(2, Math.ceil(W / sc)), h = Math.max(2, Math.ceil(H / sc)), sm = document.createElement('canvas'); sm.width = w; sm.height = h;
    var sx = sm.getContext('2d'); sx.imageSmoothingEnabled = true; sx.drawImage(c, 0, 0, w, h);
    var sd = sx.getImageData(0, 0, w, h), q = sd.data, g = new Float32Array(w * h), i, j, X, Y;
    for (i = 0; i < w * h; i++) g[i] = q[i * 4] * .3 + q[i * 4 + 1] * .59 + q[i * 4 + 2] * .11;
    function pass(src, rad, mode) { /* filtre séparable : max (mode 1) ou moyenne (mode 0) */
      var tmp = new Float32Array(w * h), out = new Float32Array(w * h), v, k, n;
      for (Y = 0; Y < h; Y++) for (X = 0; X < w; X++) { v = mode ? 0 : 0; n = 0; for (k = -rad; k <= rad; k++) { var xx = X + k; if (xx < 0 || xx >= w) continue; var t = src[Y * w + xx]; if (mode) { if (t > v) v = t; } else { v += t; n++; } } tmp[Y * w + X] = mode ? v : v / n; }
      for (Y = 0; Y < h; Y++) for (X = 0; X < w; X++) { v = 0; n = 0; for (k = -rad; k <= rad; k++) { var yy = Y + k; if (yy < 0 || yy >= h) continue; var t2 = tmp[yy * w + X]; if (mode) { if (t2 > v) v = t2; } else { v += t2; n++; } } out[Y * w + X] = mode ? v : v / n; }
      return out;
    }
    var bg = pass(pass(g, 4, 1), 3, 0);
    for (i = 0; i < w * h; i++) { q[i * 4] = q[i * 4 + 1] = q[i * 4 + 2] = Math.max(1, Math.min(255, bg[i])); q[i * 4 + 3] = 255; }
    sx.putImageData(sd, 0, 0);
    var big = document.createElement('canvas'); big.width = W; big.height = H; var bx = big.getContext('2d'); bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high'; bx.drawImage(sm, 0, 0, W, H);
    var B = bx.getImageData(0, 0, W, H).data;
    /* 2) le papier devient blanc ; l'encre garde sa vraie profondeur et ses couleurs ; léger renforcement des traits */
    for (i = 0, j = 0; i < W * H; i++, j += 4) {
      var f = 250 / (B[j] + 2);
      for (var t3 = 0; t3 < 3; t3++) { var v2 = a[j + t3] * f; v2 = v2 > 255 ? 255 : v2; a[j + t3] = 255 * Math.pow(v2 / 255, 1.25); }
    }
    x.putImageData(d, 0, 0);
  };

  /* ---- 3. Insérer comme image : meilleure qualité ---- */
  window.scanImg = function () {
    var h = SC.map(function (s) {
      var k = Math.min(1, 1600 / s.c.width), c = document.createElement('canvas');
      c.width = Math.round(s.c.width * k); c.height = Math.round(s.c.height * k);
      c.getContext('2d').drawImage(s.c, 0, 0, c.width, c.height);
      return '<img src="' + c.toDataURL('image/jpeg', .88) + '" style="max-width:100%;border-radius:12px"><br>';
    }).join('');
    putH(h); $('#sc').remove(); SC = [];
  };

  /* ---- 2. Markdown -> HTML du cahier (h3 = grand titre, h4 = petit titre) ---- */
  function e(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function inl(s) {
    s = e(s);
    s = s.replace(/\*\*\*([^*\n]+?)\*\*\*/g, '<b><i>$1</i></b>').replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>').replace(/__([^_\n]+?)__/g, '<b>$1</b>')
      .replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>').replace(/(^|[\s(])_([^_\n]+?)_(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>');
    return s.replace(/\*+/g, '').replace(/\s{2,}/g, ' ');      /* astérisques résiduels : jamais affichés */
  }
  function md2html(md) {
    var L = String(md).replace(/\r/g, '').split('\n'), out = [], para = [], list = null;
    function flushP() { if (para.length) { out.push('<p>' + inl(para.join(' ').replace(/(\w)- (\w)/g, '$1$2')) + '</p>'); para = []; } }
    function flushL() { if (list) { out.push('<' + list.t + '>' + list.i.map(function (x) { return '<li>' + inl(x) + '</li>'; }).join('') + '</' + list.t + '>'); list = null; } }
    L.forEach(function (raw) {
      var s = raw.replace(/\s+$/, ''), m;
      if (!s.trim()) { flushP(); flushL(); return; }
      if ((m = /^\s*(#{1,6})\s+(.*)$/.exec(s))) { flushP(); flushL(); var t = m[2].replace(/[#*_]+/g, '').trim(); if (t) out.push((m[1].length == 1 ? '<h3>' : '<h4>') + e(t) + (m[1].length == 1 ? '</h3>' : '</h4>')); return; }
      if (/^\s*\|?\s*:?-{2,}/.test(s) && /\|/.test(s)) return;                       /* séparateur de tableau */
      if (/^\s*\|/.test(s)) { flushP(); flushL(); out.push('<p>' + inl(s.replace(/^\s*\||\|\s*$/g, '').split('|').map(function (c) { return c.trim(); }).filter(Boolean).join(' — ')) + '</p>'); return; }
      if ((m = /^\s*[-*•+]\s+(.*)$/.exec(s))) { flushP(); if (!list || list.t != 'ul') { flushL(); list = { t: 'ul', i: [] }; } list.i.push(m[1]); return; }
      if ((m = /^\s*(\d{1,3})[.)]\s+(.*)$/.exec(s))) { flushP(); if (!list || list.t != 'ol') { flushL(); list = { t: 'ol', i: [] }; } list.i.push(m[2]); return; }
      flushL(); para.push(s.trim());
    });
    flushP(); flushL();
    return out.join('');
  }
  window.v19md2html = md2html;

  /* ---- Conversion en texte (IA) ---- */
  var ocr0 = window.scanOcr;
  window.scanOcr = async function () {
    if (V19.busy) return;
    if (!SC.length) return;
    if (typeof D == 'undefined' || !D.s) { toast('Connexion requise : lecture sur l’appareil utilisée'); return ocr0(); }
    V19.busy = 1;
    try {
      var pages = [], q, left = null;
      for (var i = 0; i < SC.length; i += 3) {
        toast('Lecture fidèle des pages ' + (i + 1) + (SC.length > 1 ? '–' + Math.min(SC.length, i + 3) + ' / ' + SC.length : '') + '… (10 à 40 secondes)');
        var imgs = SC.slice(i, i + 3).map(function (s) {
          var k = Math.min(1, 2000 / Math.max(s.c.width, s.c.height)), c = document.createElement('canvas');
          c.width = Math.round(s.c.width * k); c.height = Math.round(s.c.height * k); c.getContext('2d').drawImage(s.c, 0, 0, c.width, c.height);
          return c.toDataURL('image/jpeg', .86);
        });
        await tok();
        var r = await fetch(SB + '/functions/v1/cn-scan', { method: 'POST', headers: Object.assign({}, stH(), { 'Content-Type': 'application/json' }), body: JSON.stringify({ images: imgs }) });
        var j = {}; try { j = await r.json(); } catch (x) {}
        if (!r.ok || j.error) { var er = new Error(j.error || ('erreur ' + r.status)); er.code = j.error; throw er; }
        pages = pages.concat(j.pages || []); left = j.restant;
      }
      var md = pages.filter(function (p) { return p && p.trim(); }).join('\n\n');
      if (!md.replace(/[^\p{L}\p{N}]/gu, '').length) { toast('Aucun texte reconnu : photographiez la page à plat, bien éclairée, en remplissant le cadre.'); V19.busy = 0; return; }
      V19.html = md2html(md);
      scT = V19.html.replace(/<\/(p|h3|h4|li)>/g, '\n').replace(/<[^>]+>/g, '').trim() || '(Aucun texte reconnu)';
      V19.forT = scT; V19.left = left;
      scanUI();
    } catch (x) {
      V19.busy = 0;
      var code = x && x.code;
      if (code == 'limite') toast('Limite de 30 pages IA par jour atteinte : lecture sur l’appareil utilisée.');
      else if (code == 'non_valide') toast('Compte non activé : lecture sur l’appareil utilisée.');
      else toast('Lecture IA indisponible : lecture sur l’appareil utilisée.');
      V19.html = ''; return ocr0();
    }
    V19.busy = 0;
  };

  /* L'aperçu montre le texte fidèle, modifiable, avec ses titres et listes */
  var ui0 = window.scanUI;
  window.scanUI = function () {
    ui0();
    try {
      if (!V19.html || V19.forT !== scT) { if (V19.forT !== scT) V19.html = ''; return; }
      var so = document.getElementById('so'); if (!so) return;
      var bar = so.previousElementSibling; if (bar && bar.querySelector && bar.querySelector('.ch')) bar.remove();
      var d = document.createElement('div'); d.id = 'so'; d.contentEditable = 'true';
      d.style.cssText = 'min-height:160px;max-height:46vh;overflow:auto;box-sizing:border-box;border-radius:14px;border:1px solid var(--line);background:#fbfbfe;color:#1b1d2e;padding:12px 16px;line-height:1.6;font-size:16px;word-break:break-word';
      d.innerHTML = V19.html;
      so.replaceWith(d);
      d.insertAdjacentHTML('beforebegin', '<p class=hint>Texte recopié par l’IA tel qu’il est imprimé (titres, listes, gras). Relisez et corrigez si besoin avant d’insérer.' +
        (typeof V19.left == 'number' ? ' Pages IA restantes aujourd’hui : ' + V19.left + '/30.' : '') + '</p>');
    } catch (x) {}
  };
})();
