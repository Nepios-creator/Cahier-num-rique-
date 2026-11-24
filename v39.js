/* v39 : appui long dans les Notes complémentaires = sélection du mot (fiable) + barre « Tout sélectionner / Copier » quand du texte y est sélectionné. À charger après v38.js. Surcouche : aucun fichier existant n’est modifié. */
(function(){
var tm=0,sx=0,sy=0,bar=null;
function el(n){return n&&n.nodeType===3?n.parentElement:n}
function cpOf(n){n=el(n);return n&&n.closest?n.closest('#cp'):null}
function bodyOf(n){n=el(n);return n&&n.closest?n.closest('#cp > div > div + div'):null}
function rangeAt(x,y){if(document.caretRangeFromPoint)return document.caretRangeFromPoint(x,y);if(document.caretPositionFromPoint){var p=document.caretPositionFromPoint(x,y);if(p){var r=document.createRange();r.setStart(p.offsetNode,p.offset);r.collapse(true);return r}}return null}
function selWord(x,y){var r=rangeAt(x,y);if(!r||!cpOf(r.startContainer))return false;var s=getSelection();s.removeAllRanges();s.addRange(r);if(s.modify){s.modify('move','backward','word');s.modify('extend','forward','word')}else if(r.startContainer.nodeType===3){r.selectNodeContents(r.startContainer);s.removeAllRanges();s.addRange(r)}return !s.isCollapsed}
function clr(){if(tm){clearTimeout(tm);tm=0}}
document.addEventListener('touchstart',function(e){clr();if(e.touches.length!==1)return;var t=e.touches[0],n=e.target;if(!bodyOf(n))return;var q=el(n);if(q&&q.closest&&q.closest('button,a,input,textarea'))return;sx=t.clientX;sy=t.clientY;tm=setTimeout(function(){tm=0;selWord(sx,sy);sync()},420)},{passive:true,capture:true});
document.addEventListener('touchmove',function(e){if(!tm)return;var t=e.touches[0];if(Math.abs(t.clientX-sx)>10||Math.abs(t.clientY-sy)>10)clr()},{passive:true,capture:true});
['touchend','touchcancel'].forEach(function(n){document.addEventListener(n,clr,{passive:true,capture:true})});
function mk(t,f){var b=document.createElement('button');b.type='button';b.textContent=t;b.style.cssText='border:0;border-radius:18px;padding:10px 14px;font:600 14px system-ui,sans-serif;background:#fff;color:#111';b.onpointerdown=function(e){e.preventDefault()};b.onclick=f;return b}
function ok(){try{toast('Texte copié')}catch(x){}}
function copySel(){var s=getSelection(),t=s?s.toString():'';if(!t)return;var fb=function(){try{document.execCommand('copy');ok()}catch(x){}};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,fb);else fb()}
function allCp(){var c=document.getElementById('cp');if(!c)return;var r=document.createRange();r.selectNodeContents(c);var s=getSelection();s.removeAllRanges();s.addRange(r);sync()}
function sync(){var s=getSelection(),on=!!(s&&s.rangeCount&&!s.isCollapsed&&cpOf(s.anchorNode)&&cpOf(s.focusNode));
if(on&&!bar){bar=document.createElement('div');bar.id='cn39';bar.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 16px);z-index:99999;display:flex;gap:8px;padding:8px;border-radius:24px;background:rgba(30,30,30,.92);box-shadow:0 4px 16px rgba(0,0,0,.35)';bar.appendChild(mk('Tout sélectionner',allCp));bar.appendChild(mk('Copier',copySel));document.body.appendChild(bar)}
else if(!on&&bar){bar.remove();bar=null}}
document.addEventListener('selectionchange',sync);
})();
