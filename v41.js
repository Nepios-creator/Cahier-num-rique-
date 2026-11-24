/* v41 : bouton « 🎧 Écouter » fiable dans chaque note complétée et chaque leçon complète (panneau Notes complémentaires) : lecture audio en français, un appui pour lancer, un appui pour arrêter. Remplace le bouton « Lire » de chaque note. À charger après v40.js. Surcouche : aucun fichier existant n’est modifié. */
(function(){
var S=window.speechSynthesis,curBtn=null,tk=0,LBL='🎧 Écouter';
function say(m){try{toast(m)}catch(e){}}
function stop(){tk++;try{S&&S.cancel()}catch(e){}if(curBtn){curBtn.textContent=LBL;curBtn=null}}
function frVoice(){var v=S&&S.getVoices?S.getVoices():[];for(var i=0;i<v.length;i++){if(/^fr/i.test(v[i].lang))return v[i]}return null}
function speak(text,btn){
if(!S){say('Lecture audio non disponible sur cet appareil');return}
if(curBtn===btn){stop();return}
stop();
var t=String(text||'').replace(/\s+/g,' ').trim();
if(!t){say('Rien à écouter');return}
var parts=t.match(/[^.!?;:]{1,200}(?:[.!?;:]|$)/g)||[t];
var my=++tk;curBtn=btn;btn.textContent='⏹ Arrêter';
var v=frVoice();
setTimeout(function(){
if(my!==tk)return;
parts.forEach(function(c,i){c=c.trim();if(!c)return;var u=new SpeechSynthesisUtterance(c);u.lang='fr-FR';if(v)u.voice=v;u.rate=.95;
if(i===parts.length-1)u.onend=function(){if(my===tk)stop()};
u.onerror=function(e){if(my===tk&&e&&e.error!=='interrupted'&&e.error!=='canceled')stop()};
S.speak(u)})
},200)}
function ensure(){
var cp=document.getElementById('cp');if(!cp)return;
Array.prototype.forEach.call(cp.querySelectorAll(':scope > div > div + div'),function(body){
var bc=body.firstElementChild,act=body.lastElementChild;
if(!bc||!act||bc===act)return;
var b=null;Array.prototype.forEach.call(act.querySelectorAll('button'),function(x){if(x.getAttribute('data-cn41')||/Lire|Écouter/.test(x.textContent))b=b||x});
if(!b){var f=act.querySelector('button');b=document.createElement('button');b.type='button';if(f){b.className=f.className;b.style.cssText=f.style.cssText}act.insertBefore(b,act.firstChild)}
if(b.getAttribute('data-cn41'))return;
b.setAttribute('data-cn41','1');b.type='button';b.textContent=LBL;
b.onclick=function(ev){ev.stopPropagation();speak(bc.innerText||bc.textContent||'',b)}
})}
try{new MutationObserver(function(){ensure()}).observe(document.body,{childList:true,subtree:true})}catch(x){}
ensure();
})();
