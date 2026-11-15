/* v17 : la sélection de texte reste dans la zone de contenu.
   « Tout sélectionner » (Ctrl+A ou menu du téléphone) ne prend plus les onglets, boutons, barres et en-têtes :
   - dans une page : uniquement le texte de la page ;
   - ailleurs : uniquement le bloc de texte concerné.
   Les barres, boutons et en-têtes ne sont plus sélectionnables. */
(function () {
  var Z = '#ed,.v13md,.v13q,.card,.rs,.lh,textarea,input,[contenteditable]';

  var st = document.createElement('style');
  st.textContent =
    '.top,.eh,.tb,.sb,.tabs,nav,button,summary,.ch,.v13tm,.hint{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}' +
    '#ed,.v13md,.v13q,.card,.rs,.lh,textarea,input,[contenteditable]{-webkit-user-select:text;user-select:text}';
  document.head.appendChild(st);

  function zoneOf(n) {
    var el = n && (n.nodeType === 1 ? n : n.parentElement);
    return el && el.closest ? el.closest(Z) : null;
  }
  function whole(z) {
    var s = getSelection(), r = document.createRange();
    r.selectNodeContents(z); s.removeAllRanges(); s.addRange(r);
  }

  /* Ctrl/Cmd + A */
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || String(e.key).toLowerCase() !== 'a') return;
    var a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
    var ed = document.getElementById('ed'), s = getSelection();
    var z = zoneOf(s.anchorNode) || zoneOf(a) || ed || document.querySelector('.v13md,.card');
    e.preventDefault();
    if (z) whole(z);
  }, true);

  /* « Sélectionner tout » du menu du téléphone, ou glissement hors zone : on ramène la sélection dans la zone */
  var busy = 0;
  document.addEventListener('selectionchange', function () {
    if (busy) return;
    var s = getSelection();
    if (!s || !s.rangeCount || s.isCollapsed) return;
    var r = s.getRangeAt(0), ed = document.getElementById('ed');
    var zs = zoneOf(r.startContainer), ze = zoneOf(r.endContainer);
    if (zs && zs === ze) return;
    busy = 1;
    try {
      if (ed && r.intersectsNode(ed) && (zs === ed || ze === ed || (!zs && !ze) || zs !== ze)) whole(ed);
      else if (zs) { r.setEnd(zs, zs.childNodes.length); s.removeAllRanges(); s.addRange(r); }
      else if (ze) { r.setStart(ze, 0); s.removeAllRanges(); s.addRange(r); }
      else s.removeAllRanges();
    } catch (x) {}
    setTimeout(function () { busy = 0; }, 0);
  });
})();
