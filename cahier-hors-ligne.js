/* cahier-hors-ligne : mode « économie de data », file d'attente hors ligne visible, sauvegarde automatique (batterie faible / coupure).
   Surcouche : aucune fonction existante n'est modifiée en place. Dépend de cahier-demande.js (aides cnx*).
   - Économie de data : audio compressé (mono, ~24 kbit/s au lieu de 128), transcription différée jusqu'au retour du wifi.
   - Compteur de Mo économisés (estimation : durée × 128 kbit/s − taille réellement enregistrée). */
(function(){
if(!window.cnxCSS)return;
var BR_ECO=24000, BR_STD=128000, Q=function(){D.dq=D.dq||[];return D.dq};
function eco(){try{return !!D.eco}catch(e){return false}}
function net(){var c=navigator.connection||{};return {on:navigator.onLine,type:c.type||'',eff:c.effectiveType||'',sd:!!c.saveData}}
/* Wifi connu ? true / false / null (inconnu : navigateurs qui n'exposent pas le type de réseau) */
function wifi(){var n=net();if(!n.on)return false;if(n.type)return n.type=='wifi'||n.type=='ethernet';return null}
function mo(b){return (b/1048576).toFixed(b<10485760?1:0).replace('.',',')}

/* ---------- 1) Audio compressé quand l'économie de data est active ---------- */
try{var md=navigator.mediaDevices;if(md&&md.getUserMedia){var g=md.getUserMedia.bind(md);
  md.getUserMedia=function(c){if(eco()&&c&&c.audio===true){
    return g(Object.assign({},c,{audio:{channelCount:{ideal:1},sampleRate:{ideal:16000},echoCancellation:{ideal:false},noiseSuppression:{ideal:false},autoGainControl:{ideal:true}}})).catch(function(){return g(c)})}
    return g(c)}}}catch(e){}
var act=[];   // enregistreurs en cours (pour requestData en cas de batterie faible)
try{var M1=window.MediaRecorder;if(M1){
  class MR2 extends M1{constructor(s,o){var b=Object.assign({},o||{}),e=eco();if(e)b.audioBitsPerSecond=BR_ECO;
    try{super(s,b)}catch(x){super(s)}
    var me=this,t0=0,tot=0;
    me.addEventListener('start',function(){t0=Date.now();tot=0;act.push(me)});
    me.addEventListener('dataavailable',function(v){if(v.data)tot+=v.data.size});
    var end=function(){var i=act.indexOf(me);if(i>=0)act.splice(i,1);if(e&&t0){var base=(Date.now()-t0)/1000*(BR_STD/8),sv=base-tot;if(sv>0){D.ecoB=(D.ecoB||0)+Math.round(sv);try{raw()}catch(x){}}t0=0;ui()}};
    me.addEventListener('stop',end);me.addEventListener('error',end)}}
  window.MediaRecorder=MR2}}catch(e){}

/* ---------- 2) Transcription différée (hors ligne, ou économie de data sans wifi) ---------- */
function find(id){try{return v11fa(id)}catch(e){return null}}
var tr0=window.v11tr;
if(typeof tr0=='function')window.v11tr=function(id){
  var f=find(id);if(!f||f.x.tr||(f.x.st=='rec'))return tr0.apply(this,arguments);
  var w=wifi(),defer=false,why='';
  if(!navigator.onLine){defer=true;why='Pas de connexion : la transcription partira dès que le réseau revient.'}
  else if(eco()&&w===false){defer=true;why='Économie de data : la transcription attendra le wifi.'}
  else if(eco()&&w===null&&!confirm('Économie de data activée. La transcription envoie l’audio et consomme des données. L’envoyer maintenant ?\n\nAnnuler = attendre le wifi.')){defer=true;why='Transcription mise en attente jusqu’au wifi.'}
  if(!defer)return tr0.apply(this,arguments);
  if(Q().indexOf(id)<0){Q().push(id);raw()}toast(why);ui();return};
var flushing=0;
async function flush(force){if(flushing||!D.s||!navigator.onLine||typeof tr0!='function')return;
  if(!force&&eco()&&wifi()!==true)return;
  if(typeof V11!=='undefined'&&V11.lock)return;
  var q=Q().slice();if(!q.length)return;flushing=1;
  try{for(var i=0;i<q.length;i++){var id=q[i],f=find(id);
      if(!f||f.x.tr){D.dq=Q().filter(function(x){return x!==id});continue}
      try{await tr0(id)}catch(e){}
      var f2=find(id);if(f2&&f2.x.tr){D.dq=Q().filter(function(x){return x!==id});raw();toast('Transcription prête : « '+(f2.x.n||'audio')+' »');try{if(typeof v11close=='function')v11close()}catch(e){}}
      else break}   // échec : on garde le reste pour plus tard
  }finally{flushing=0;ui()}}

/* ---------- 3) File d'attente visible ---------- */
function pend(){var n=0,f=0;try{D.c.forEach(function(c){if(c.del&&!c.d)return;if(c.d)n++;(c.pages||[]).forEach(function(p){if(p.d)n++;(p.att||[]).forEach(function(x){if(x.up===0)f++})})})}catch(e){}return{n:n,f:f,t:Q().length}}
function label(){var p=pend(),tot=p.n+p.f+p.t,on=navigator.onLine;return (on?(eco()?'📶 Économie de data':'📶 Hors ligne et data'):'📴 Hors ligne')+(tot?' · '+tot+' en attente':'')}
function typing(){var a=document.activeElement;if(!a)return false;var t=(a.tagName||'').toLowerCase();return t=='input'||t=='textarea'||t=='select'||a.isContentEditable===true||!!(a.closest&&a.closest('[contenteditable="true"],#ed'))}
function pill(){var e=document.getElementById('cnh1p'),p=pend(),tot=p.n+p.f+p.t,show=!navigator.onLine||tot>0;
  if(!e){e=document.createElement('button');e.id='cnh1p';e.onclick=window.cnh1Open;document.body.appendChild(e)}
  /* Pastille minuscule, jamais au-dessus du texte : masquée pendant la saisie, sans texte qui cache la page. */
  e.style.display=(show&&!typing()&&!document.getElementById('cnh1'))?'flex':'none';
  e.textContent=navigator.onLine?'⏳':'📴';
  var m=navigator.onLine?tot+' en attente d’envoi':'Hors ligne · vos notes sont gardées';e.title=m;e.setAttribute('aria-label',m)}
['focusin','focusout','input','keyup','touchend','resize'].forEach(function(ev){document.addEventListener(ev,function(){setTimeout(function(){try{pill()}catch(e){}},60)},true)});
function ui(){try{var b=document.getElementById('cnh1b');if(b)b.textContent=label();pill();fill()}catch(e){}}
window.cnxCSS('cnh1css','#cnh1p{position:fixed;right:8px;bottom:calc(70px + env(safe-area-inset-bottom,0px));z-index:40;width:30px;height:30px;min-width:0;padding:0;font-size:14px;line-height:1;border-radius:50%;display:none;align-items:center;justify-content:center;opacity:.55;box-shadow:0 2px 6px #0003}#cnh1p:active{opacity:1}#cnh1{position:fixed;inset:0;z-index:70;background:#000a;display:flex}#cnh1 .ch1w>*{min-width:0}#cnh1 .ch1w{box-sizing:border-box;margin:auto;width:100%;max-width:640px;height:100%;max-height:100dvh;overflow-y:auto;background:var(--bg);padding:12px 14px calc(14px + env(safe-area-inset-bottom,0px));display:grid;gap:10px;align-content:start}#cnh1 .ch1h{display:flex;align-items:center;gap:8px}#cnh1 .ch1h b{flex:1;font-size:18px}#cnh1 .ch1c{padding:12px 14px;border-radius:14px;background:var(--card);border:1px solid var(--line);line-height:1.5}#cnh1 .ch1big{font-size:28px;font-weight:800}#cnh1 .ch1r{display:flex;gap:8px;flex-wrap:wrap}');
function fill(){var o=document.getElementById('cnh1');if(!o)return;var p=pend(),n=net(),w=wifi();
  o.querySelector('#cnh1s').innerHTML=(n.on?'🟢 En ligne'+(w===true?' (wifi)':w===false?' (données mobiles)':''):'🔴 Hors ligne')+'<br>'+(p.n+p.f+p.t?'<b>En attente d’envoi :</b> '+p.n+' modification(s) · '+p.f+' fichier(s) · '+p.t+' transcription(s)':'✅ Tout est à jour')
   +(p.t?'<br><span class=hint>Les transcriptions en attente partiront '+(eco()?'dès que vous serez en wifi.':'dès que le réseau revient.')+'</span>':'');
  o.querySelector('#cnh1e').textContent=eco()?'✅ Économie de data : activée':'Activer l’économie de data';
  o.querySelector('#cnh1m').innerHTML='<div class=ch1big>'+mo(D.ecoB||0)+' Mo</div>de données économisées grâce à l’audio compressé';}
window.cnh1Open=function(){var o=document.getElementById('cnh1');if(o)o.remove();o=document.createElement('div');o.id='cnh1';
  o.innerHTML='<div class=ch1w><div class=ch1h><b>📶 Hors ligne et économie de data</b><button id=cnh1x>✕</button></div>'
   +'<div class=ch1c>✅ <b>Fonctionne sans internet.</b> Écrivez, enregistrez et relisez vos cours même sans réseau : tout est gardé sur votre téléphone et envoyé automatiquement au retour de la connexion.<br>🔋 <b>Rien ne se perd</b> si la batterie est faible ou si le courant coupe : vos notes et vos audios sont sauvegardés en continu.</div>'
   +'<div class=ch1c id=cnh1s></div>'
   +'<div class=ch1r><button class=p id=cnh1y style="width:auto;padding:10px 16px">Synchroniser maintenant</button><button id=cnh1t>Lancer les transcriptions en attente</button></div>'
   +'<div class=ch1c><button id=cnh1e style="width:100%"></button><div class=hint style="margin-top:6px">Audio plus léger (mono, environ 5 fois moins de données) et transcription envoyée seulement en wifi. La qualité reste suffisante pour la voix.</div></div>'
   +'<div class=ch1c id=cnh1m></div></div>';
  document.body.appendChild(o);fill();
  o.querySelector('#cnh1x').onclick=function(){o.remove()};
  o.querySelector('#cnh1e').onclick=function(){D.eco=!eco();raw();toast(eco()?'Économie de data activée':'Économie de data désactivée');ui()};
  o.querySelector('#cnh1y').onclick=function(){if(!navigator.onLine)return toast('Toujours hors ligne : tout sera envoyé au retour du réseau');try{sync()}catch(e){}setTimeout(ui,1500)};
  o.querySelector('#cnh1t').onclick=function(){if(!Q().length)return toast('Aucune transcription en attente');if(!navigator.onLine)return toast('Pas de connexion pour le moment');flush(true)}};

/* ---------- 4) Sauvegarde automatique : batterie faible, mise en veille, coupure ---------- */
function snap(){try{var e=document.getElementById('ed');if(pg&&e&&e.isContentEditable&&pg.html!==e.innerHTML){pg.html=e.innerHTML;save()}else raw()}catch(x){}
  act.forEach(function(r){try{r.requestData()}catch(x){}})}
setInterval(function(){try{var e=document.getElementById('ed');if(pg&&e&&e.isContentEditable&&pg.html!==e.innerHTML){pg.html=e.innerHTML;save()}}catch(x){}},8000);
['pagehide','freeze','beforeunload'].forEach(function(ev){window.addEventListener(ev,snap)});
if(navigator.getBattery)navigator.getBattery().then(function(b){var warned=0;
  var chk=function(){if(!b.charging&&b.level<=0.15){snap();if(!warned){warned=1;toast('🔋 Batterie faible : vos notes et audios sont sauvegardés')}}else if(b.charging||b.level>0.2)warned=0};
  b.addEventListener('levelchange',chk);b.addEventListener('chargingchange',chk);setInterval(function(){if(!b.charging&&b.level<=0.15)snap()},10000);chk()}).catch(function(){});

/* ---------- Branchements ---------- */
window.addEventListener('online',function(){ui();setTimeout(function(){flush(false)},1500)});
window.addEventListener('offline',ui);
if(navigator.connection&&navigator.connection.addEventListener)navigator.connection.addEventListener('change',function(){ui();flush(false)});
document.addEventListener('visibilitychange',function(){if(!document.hidden){ui();flush(false)}});
setInterval(function(){ui();if(Q().length)flush(false)},30000);
var ob=window.openB;if(typeof ob=='function')window.openB=function(){var r=ob.apply(this,arguments);try{window.cnxBtn('cnh1b','📶 Hors ligne et économie de data',window.cnh1Open,false);ui()}catch(e){}return r};
setTimeout(ui,800);
})();
