/* cahier-index : index automatique de chaque cahier, pour que « Demande à ton cahier » réponde en 1 à 2 secondes.
   En arrière-plan (silencieux, dès qu'il y a internet et un compte abonné), chaque passage de vos notes / audios transcrits est
   enrichi par l'IA : mots-clés et synonymes, et questions-réponses précises. L'index est gardé sur l'appareil (IndexedDB) et mis à jour
   tout seul quand une note change. Ensuite :
   1) si la question correspond à une question-réponse de l'index, la réponse est affichée tout de suite, sans attendre l'IA ;
   2) sinon, seuls les 6 passages les plus pertinents (retrouvés grâce aux mots-clés de l'index) partent vers l'IA rapide.
   Surcouche : aucune fonction existante n'est modifiée. Dépend de cahier-demande.js (cnxCall, cnxPassages). */
(function(){
if(!window.cnxCall||!window.cnxPassages)return;
var STOP=' le la les un une des de du et en au aux que qui quoi est sont dans pour par sur avec ce cet cette ces il elle ils elles on nous vous je tu mon ton son ses leur leurs mais ou donc car ne pas plus se sa a ont ete etre fait dit prof professeur cours explique moi ca comment quel quelle quels quelles cest quest sest dire veut signifie definition definir ';
var IX={},busy=0,cool=0,tmr=0,BATCH=10,PER_RUN=30;
function hs(t){t=String(t||'');var h=5381;for(var i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))|0;return (h>>>0).toString(36)+t.length.toString(36)}
function tk(t){return (nz(String(t||'')).match(/[a-z0-9]{3,}/g)||[]).filter(function(w){return STOP.indexOf(' '+w+' ')<0})}
function same(a,b){if(a===b)return true;var p=Math.min(5,a.length,b.length);return p>=4&&a.slice(0,p)===b.slice(0,p)}
async function load(id){if(IX[id])return IX[id];var o=null;try{o=await fget('idx:'+id)}catch(e){}IX[id]=(o&&o.h)?o:{v:1,h:{}};return IX[id]}
function save(id){try{fput('idx:'+id,IX[id])}catch(e){}}

/* ---------- Construction automatique (arrière-plan) ---------- */
async function sync(c){
  if(busy||!c||Date.now()<cool||!navigator.onLine||typeof D==='undefined'||!D.s||document.hidden)return;
  busy=1;
  try{
    var ix=await load(c.id),P=await window.cnxPassages(c),want={},miss=[];
    P.forEach(function(p){var h=hs(p.text);want[h]=1;if(!ix.h[h]&&p.text.length>=40)miss.push({p:p,h:h})});
    var drop=false;Object.keys(ix.h).forEach(function(h){if(!want[h]){delete ix.h[h];drop=true}});
    var todo=miss.slice(0,PER_RUN);
    for(var i=0;i<todo.length;i+=BATCH){
      var lot=todo.slice(i,i+BATCH),j;
      try{j=await window.cnxCall('cn-demande',{notebook_id:c.id,action:'index',passages:lot.map(function(x){return{id:x.p.id,text:x.p.text}})})}catch(e){cool=Date.now()+10*60e3;break}
      if(j.error){cool=Date.now()+(j.error=='limite_atteinte'?3600e3:30*60e3);break}
      var byId={};(j.items||[]).forEach(function(it){byId[it.id]=it});
      lot.forEach(function(x){var it=byId[x.p.id];ix.h[x.h]=it?{k:it.k||[],qa:it.qa||[]}:{k:[],qa:[]}});
      drop=true;
    }
    if(drop){save(c.id)}
  }catch(e){}finally{busy=0}
}
function auto(){try{if(typeof cur!=='undefined'&&cur)sync(cur)}catch(e){}}
function again(){clearInterval(tmr);tmr=setInterval(auto,45000)}
var ob=window.openB;if(typeof ob=='function')window.openB=function(){var r=ob.apply(this,arguments);try{setTimeout(auto,1500);again()}catch(e){}return r};
document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(auto,800)});
window.addEventListener('online',function(){cool=0;setTimeout(auto,800)});

/* ---------- Recherche dans l'index ---------- */
/* Retourne {ready, top, direct}. ready : au moins 60 % des passages sont indexés (chemin rapide possible).
   direct : {p, a} quand la question correspond presque mot pour mot à une question-réponse de l'index. */
function query(c,q,P){
  var ix=IX[c.id];if(!ix)return null;
  var qt=tk(q);if(!qt.length)return null;
  var docs=P.map(function(p){var e=ix.h[hs(p.text)]||null;return{p:p,e:e,t:tk(p.text+' '+p.label),k:e?tk((e.k||[]).join(' ')):[],qq:e?(e.qa||[]).map(function(x){return{x:x,t:tk(x.q)}}):[]}});
  var idxd=docs.filter(function(d){return d.e}).length,ready=docs.length>0&&idxd/docs.length>=.6;
  var N=docs.length,df={};
  qt.forEach(function(w){var n=0;docs.forEach(function(d){if(d.t.some(function(x){return same(x,w)})||d.k.some(function(x){return same(x,w)}))n++});df[w]=n});
  var best=null,sc=docs.map(function(d){
    var s=0;qt.forEach(function(w){var idf=Math.log(1+N/(1+df[w])),hit=0;
      if(d.t.some(function(x){return same(x,w)}))hit=Math.max(hit,1);
      if(d.k.some(function(x){return same(x,w)}))hit=Math.max(hit,1.4);
      d.qq.forEach(function(z){if(z.t.some(function(x){return same(x,w)}))hit=Math.max(hit,1.8)});
      s+=hit*idf});
    d.qq.forEach(function(z){if(!z.t.length)return;
      var cov=qt.filter(function(w){return z.t.some(function(x){return same(x,w)})}).length/qt.length,
          back=z.t.filter(function(x){return qt.some(function(w){return same(x,w)})}).length/z.t.length;
      if(qt.length>=2&&cov>=.99&&back>=.7&&(!best||cov+back>best.v))best={p:d.p,a:z.x.a,v:cov+back}});
    return{p:d.p,s:s}});
  sc.sort(function(a,b){return b.s-a.s});
  var top=sc.filter(function(x){return x.s>0}).slice(0,6).map(function(x){return x.p});
  return{ready:ready,top:top,direct:best?{p:best.p,a:best.a}:null}}
window.cnxIdx={query:query,sync:sync,load:load,status:function(id){var ix=IX[id];return ix?Object.keys(ix.h).length:0}};
})();
