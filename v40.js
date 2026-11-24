/* v40 : bouton « Copier » en bas de chaque note complétée / leçon (à côté de Lire, Replier, Supprimer) : copie tout le texte de la note en un clic. À charger après v39.js. Surcouche : aucun fichier existant n’est modifié. */
(function(){
function say(m){try{toast(m)}catch(e){}}
function copyText(t,b){
var ok=function(){say('Note copiée');var o=b.textContent;b.textContent='✓ Copié';setTimeout(function(){b.textContent=o},1500)};
var fb=function(){var a=document.createElement('textarea');a.value=t;a.setAttribute('readonly','');a.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.appendChild(a);a.select();a.setSelectionRange(0,t.length);var d=false;try{d=document.execCommand('copy')}catch(x){}a.remove();if(d)ok();else say('Copie impossible sur cet appareil')};
if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,fb);else fb()}
function ensure(){
var cp=document.getElementById('cp');if(!cp)return;
Array.prototype.forEach.call(cp.querySelectorAll(':scope > div > div + div'),function(body){
if(body.querySelector('[data-cn40]'))return;
var bc=body.firstElementChild,act=body.lastElementChild;
if(!bc||!act||bc===act)return;
var btns=act.querySelectorAll('button');if(!btns.length)return;
var rep=null;Array.prototype.forEach.call(btns,function(b){if(/Replier/.test(b.textContent))rep=b});
var b=document.createElement('button');b.type='button';b.setAttribute('data-cn40','1');b.className=btns[0].className;b.style.cssText=btns[0].style.cssText;b.textContent='📋 Copier';
b.onclick=function(ev){ev.stopPropagation();var t=(bc.innerText||bc.textContent||'').replace(/\u00a0/g,' ').trim();if(!t){say('Rien à copier');return}copyText(t,b)};
if(rep&&rep.nextSibling)act.insertBefore(b,rep.nextSibling);else if(rep)act.appendChild(b);else act.insertBefore(b,btns[0].nextSibling)
})}
try{new MutationObserver(function(){ensure()}).observe(document.body,{childList:true,subtree:true})}catch(x){}
ensure();
})();
