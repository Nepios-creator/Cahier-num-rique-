/* v36 : « Tout sélectionner » limité au texte de la page ouverte + bouton « Copier tout ». À charger après v35.js. Surcouche : aucun fichier existant n’est modifié. */
(function(){
var st=document.createElement('style');
st.textContent='.ed .eh,.ed .eh *,.ed .tb,.ed .tb *,.ed .meta,.ed .v18s,.ed .v18s *,.ed .v18t,.ed .v18t *{-webkit-user-select:none;user-select:none}.ed .sheet,.ed .sheet *,.ed textarea,.ed input{-webkit-user-select:text;user-select:text}.ed #cp,.ed #cp *{-webkit-user-select:text!important;user-select:text!important}.ed #cp button{-webkit-user-select:none!important;user-select:none!important}#cpall{flex:none;white-space:nowrap}';
document.head.appendChild(st);
function ed(){return document.getElementById('ed')}
var lastT=null;
['pointerdown','touchstart','mousedown','contextmenu','focusin'].forEach(function(n){document.addEventListener(n,function(ev){lastT=ev.target},true)});
function zone(){var a=lastT;if(a&&a.nodeType===1&&a.closest){var c=a.closest('#cp');if(c)return c;if(a.closest('#ak,#sc'))return 'modal'}var s=getSelection();if(s&&s.rangeCount){var n=s.anchorNode;n=n&&n.nodeType===1?n:(n&&n.parentElement);if(n&&n.closest){var c2=n.closest('#cp');if(c2)return c2}}return null}
function clampTo(c){var s=getSelection();if(!s||!s.rangeCount||s.isCollapsed)return;var r=s.getRangeAt(0);if(c.contains(r.startContainer)&&c.contains(r.endContainer))return;if(!r.intersectsNode(c))return;try{var n=r.cloneRange();if(!c.contains(r.startContainer))n.setStart(c,0);if(!c.contains(r.endContainer))n.setEnd(c,c.childNodes.length);s.removeAllRanges();s.addRange(n)}catch(x){}}
function inField(){var a=document.activeElement;return !!a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT')}
function selAll(){var e=ed();if(!e)return false;var r=document.createRange();r.selectNodeContents(e);var s=getSelection();s.removeAllRanges();s.addRange(r);return true}
document.addEventListener('keydown',function(ev){
if(!(ev.ctrlKey||ev.metaKey)||String(ev.key).toLowerCase()!=='a')return;
if(inField()||!ed())return;var z=zone();if(z==='modal')return;if(z){ev.preventDefault();var zr=document.createRange();zr.selectNodeContents(z);var zs=getSelection();zs.removeAllRanges();zs.addRange(zr);return}
ev.preventDefault();selAll();
},true);
document.addEventListener('selectionchange',function(){
var e=ed();if(!e||inField())return;var z=zone();if(z==='modal')return;if(z){clampTo(z);return}
var s=getSelection();if(!s||!s.rangeCount||s.isCollapsed)return;
var r=s.getRangeAt(0);
if(e.contains(r.startContainer)&&e.contains(r.endContainer))return;
if(!r.intersectsNode(e))return;
try{var n=r.cloneRange();if(!e.contains(r.startContainer))n.setStart(e,0);if(!e.contains(r.endContainer))n.setEnd(e,e.childNodes.length);s.removeAllRanges();s.addRange(n)}catch(x){}
});
function copyAll(){
var e=ed();if(!e)return;
var t=(e.innerText||e.textContent||'').replace(/\u00a0/g,' ').trim();
if(!t){toast('Rien à copier');return}
var ok=function(){toast('Texte de la page copié')};
var fb=function(){var a=document.createElement('textarea');a.value=t;a.setAttribute('readonly','');a.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.appendChild(a);a.select();a.setSelectionRange(0,t.length);var d=false;try{d=document.execCommand('copy')}catch(x){}a.remove();if(d)ok();else toast('Copie impossible sur cet appareil')};
if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,fb);else fb();
}
function addBtn(){return;
var tb=document.querySelector('.ed .tb');
if(!tb||document.getElementById('cpall'))return;
var b=document.createElement('button');b.id='cpall';b.type='button';b.textContent='📋 Copier tout';
b.onpointerdown=function(ev){ev.preventDefault()};
b.onclick=copyAll;
tb.insertBefore(b,tb.firstChild);
}
try{new MutationObserver(function(){addBtn()}).observe(document.body,{childList:true,subtree:true})}catch(x){}
addBtn();
})();
