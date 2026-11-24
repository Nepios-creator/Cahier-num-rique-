/* v41 : le bouton « Lire » de chaque note complétée / leçon complète devient « 🎧 Écouter » (même lecture audio du cahier) ; un second appui arrête la lecture. À charger après v40.js. Surcouche : aucun fichier existant n’est modifié. */
(function(){
var LBL='🎧 Écouter',STOP='⏹ Arrêter',cur=null,poll=0;
function idle(){try{return (typeof V9==='undefined'||V9.st===0)&&!(window.speechSynthesis&&window.speechSynthesis.speaking)}catch(e){return true}}
function reset(){if(cur){cur.textContent=LBL;cur=null}}
function watch(){clearInterval(poll);poll=setInterval(function(){if(idle()){clearInterval(poll);poll=0;reset()}},800)}
function wrap(b){
if(b.getAttribute('data-cn41'))return;
b.setAttribute('data-cn41','1');b.type='button';b.textContent=LBL;
var orig=b.onclick;
b.onclick=function(ev){
if(ev&&ev.stopPropagation)ev.stopPropagation();
if(cur===b&&!idle()){try{stopL()}catch(e){}reset();return}
reset();
var r=orig?orig.call(this,ev):undefined;
cur=b;b.textContent=STOP;watch();
return r}}
function ensure(){
var cp=document.getElementById('cp');if(!cp)return;
Array.prototype.forEach.call(cp.querySelectorAll(':scope > div > div + div'),function(body){
var act=body.lastElementChild;if(!act)return;
Array.prototype.forEach.call(act.querySelectorAll('button'),function(b){if(/Lire|Écouter/.test(b.textContent))wrap(b)})
})}
var q=0;
try{new MutationObserver(function(){if(q)return;q=requestAnimationFrame(function(){q=0;ensure()})}).observe(document.body,{childList:true,subtree:true})}catch(x){}
ensure();
})();
