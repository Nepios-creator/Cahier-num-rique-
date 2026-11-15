/* v16 : mise en forme automatique des notes.
   Bouton « ✨ Structurer » dans la barre d'outils de la page : l'IA détecte titres, sous-titres, listes et termes clés
   dans un texte écrit en désordre, SANS rien ajouter ni retirer. Aperçu avant remplacement (rien n'est modifié sans accord).
   Les images, dessins et formules de la page sont conservés et replacés à la fin. */
(function () {
  var busy = 0;

  function plain(h) {
    var d = document.createElement('div'); d.innerHTML = h;
    d.querySelectorAll('img,.v14m,[data-tex]').forEach(function (n) { n.remove(); });
    d.querySelectorAll('br').forEach(function (b) { b.replaceWith('\n'); });
    d.querySelectorAll('div,p,li,h1,h2,h3,h4,tr').forEach(function (n) { n.insertAdjacentText('afterend', '\n'); });
    return d.textContent.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function media(e) {
    var o = [];
    e.querySelectorAll('img,.v14m,[data-tex]').forEach(function (n) {
      if (n.closest('.v14m') && !n.classList.contains('v14m')) return;
      o.push(n.outerHTML);
    });
    return o;
  }
  function close() { var o = document.getElementById('v16o'); if (o) o.remove(); }

  window.v16go = async function () {
    var e = $('#ed');
    if (!e || !e.isContentEditable) return toast('Ouvrez une page en écriture');
    if (!D.s) return toast('Connectez-vous pour utiliser l’IA');
    if (busy) return;
    var t = plain(e.innerHTML);
    if (t.length < 20) return toast('Écrivez d’abord un peu de texte dans la page');
    busy = 1; toast('Mise en forme en cours… (10 à 30 secondes)');
    var md = media(e);
    try {
      var j = await v6call({ mode: 'structure', notes: t, cours: cur.cours, chap: pg.chap || '', sujet: pg.sujet || '' });
      if (j.error) {
        busy = 0;
        return toast(j.error == 'texte_trop_court' ? 'Écrivez d’abord un peu de texte dans la page' : v6err(j));
      }
      var h = clean(j.text || '');
      if (!txt(h).trim()) { busy = 0; return toast('Mise en forme impossible : réessayez.'); }
      var o = document.createElement('div'); o.id = 'v16o';
      o.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:99998;background:var(--bg,#f4f4ff);display:flex;flex-direction:column;padding:12px';
      o.innerHTML = '<div style="flex:none;font-weight:700;padding:6px 2px">✨ Note structurée — aperçu</div>' +
        '<div class=card style="flex:1;overflow:auto;font-size:15px;line-height:1.6">' + h +
        (md.length ? '<p class=hint>' + md.length + ' image(s)/formule(s) de la page seront conservées à la fin.</p>' : '') + '</div>' +
        (typeof v6left == 'function' ? v6left(j) : '') +
        '<div class=f style="flex:none"><button class=p id=v16ok>✅ Remplacer ma note</button><button id=v16no>✕ Annuler (ma note reste inchangée)</button></div>';
      document.body.appendChild(o);
      o.querySelector('#v16no').onclick = close;
      o.querySelector('#v16ok').onclick = function () {
        var ed = $('#ed');
        if (!ed || !ed.isContentEditable) { close(); return toast('Page fermée : rien n’a été modifié'); }
        ed.innerHTML = h + (md.length ? '<h4>Éléments conservés</h4><p>' + md.join('<br>') + '</p>' : '');
        pg.html = ed.innerHTML; save(); close(); toast('Note structurée ✅');
      };
    } catch (x) {
      toast('Mise en forme impossible : ' + String((x && x.message) || x));
    }
    busy = 0;
  };

  var d16 = window.draw;
  window.draw = function (a, b) {
    d16.apply(this, arguments);
    try {
      var tb = $('.tb'), e = $('#ed');
      if (tb && e && e.isContentEditable && !tb.querySelector('.v16x')) {
        tb.insertAdjacentHTML('afterbegin', P('v16go()', '✨ Structurer').replace('<button', '<button class=v16x'));
      }
    } catch (x) {}
  };
})();
