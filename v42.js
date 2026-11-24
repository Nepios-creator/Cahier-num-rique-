/* v42 : boutons « Copier » et « Écouter » dans chaque bloc Indice de la page (leçon complète, notes complétées). La lecture utilise le moteur audio du cahier (cpv) ; rien n’est enregistré en plus. À charger après v41.js. */
(function(){
var st=document.createElement('style');
st.textContent='[data-cn42]{display:inline-block;padding:4px 10px;border:1px solid #c7d2fe;border-radius:12px;font-size:13px;color:#4338ca;cursor:pointer;background:#fff;margin-right:6px;-webkit-user-select:none;user-select:none}[data-cn42=copy]::before{content:"📋 Copier"}[data-cn42=listen]::before{content:"🎧 Écouter"}[data-cn42=listen].on::before{content:"⏹ Arrêter"}';
document.head.appendChild(st);
var poll=0;
function say(m){try{toast(m)}catch(e){}}
function clean(blk){var c=blk.cloneNode(true);Array.prototype.forEach.call(c.querySelectorAll('[data-ind-del],[data-cn42]'),function(n){n.remove()});return c}
function textOf(blk){var c=clean(blk);
Array.prototype.forEach.call(c.querySelectorAll('br'),function(b){b.replaceWith('\n')});
Array.prototype.forEach.call(c.querySelectorAll('h1,h2,h3,h4,h5,h6,p,div,li,tr,blockquote,pre,ul,ol,table'),function(e){e.prepend('\n');e.append('\n')});
return (c.textContent||'').replace(/\u00a0/g,' ').split('\n').map(function(s){return s.replace(/\s+/g,' ').trim()}).filter(Boolean).join('\n')}
function copyText(t){
var ok=function(){say('Texte copié')};
var fb=function(){var a=document.createElement('textarea');a.value=t;a.setAttribute('readonly','');a.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.appendChild(a);a.select();a.setSelectionRange(0,t.length);var d=false;try{d=document.execCommand('copy')}catch(x){}a.remove();if(d)ok();else say('Copie impossible sur cet appareil')};
if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,fb);else fb()}
function idle(){try{return (typeof V9==='undefined'||V9.st===0)&&!(window.speechSynthesis&&window.speechSynthesis.speaking)}catch(e){return true}}
function clearOn(){Array.prototype.forEach.call(document.querySelectorAll('[data-cn42].on'),function(n){n.classList.remove('on')})}
function watch(){clearInterval(poll);poll=setInterval(function(){if(idle()){clearInterval(poll);poll=0;clearOn()}},800)}
function listen(blk,btn){
if(btn.classList.contains('on')){try{stopL()}catch(e){}clearOn();return}
if(typeof window.cpv!=='function'||typeof pg==='undefined'||!pg){say('Lecture audio non disponible');return}
var lab=blk.parentNode&&blk.parentNode.querySelector('[data-ind-h] span'),lecon=lab&&/le[cç]on/i.test(lab.textContent);
var c=clean(blk),id='cn42-'+Date.now(),had=Object.prototype.hasOwnProperty.call(pg,'cpl'),old=pg.cpl;
pg.cpl=(old||[]).concat([{id:id,t:lecon?'Leçon complète':'Notes complétées',h:c.innerHTML,k:'x'}]);
try{window.cpv(id)}finally{if(had)pg.cpl=old;else delete pg.cpl}
clearOn();btn.classList.add('on');watch()}
document.addEventListener('click',function(ev){
var t=ev.target&&ev.target.closest&&ev.target.closest('[data-cn42]');if(!t)return;
ev.preventDefault();ev.stopPropagation();
var blk=t.closest('[data-ind-b]');if(!blk)return;
if(t.getAttribute('data-cn42')==='copy'){var x=textOf(blk);if(!x){say('Rien à copier');return}copyText(x)}else listen(blk,t)
},true);
function ensure(){
if(!poll)clearOn();
Array.prototype.forEach.call(document.querySelectorAll('#ed [data-ind-b]'),function(b){
if(b.querySelector('[data-cn42]'))return;
var del=b.querySelector('[data-ind-del]'),row=del?del.parentNode:null;
if(!row){row=document.createElement('div');row.style.cssText='text-align:right;margin-top:6px';b.appendChild(row)}
var c1=document.createElement('span');c1.setAttribute('data-cn42','copy');c1.setAttribute('contenteditable','false');
var c2=document.createElement('span');c2.setAttribute('data-cn42','listen');c2.setAttribute('contenteditable','false');
row.insertBefore(c1,del||null);row.insertBefore(c2,del||null)
})}
var q=0;
try{new MutationObserver(function(){if(q)return;q=requestAnimationFrame(function(){q=0;ensure()})}).observe(document.body,{childList:true,subtree:true})}catch(x){}
ensure();
})();
