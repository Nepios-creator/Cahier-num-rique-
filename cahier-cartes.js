/* cahier-cartes : cartes de révision créées automatiquement depuis les notes (et les audios transcrits), répétition espacée,
   défi quotidien de 5 minutes, série de jours consécutifs, rappel. Tout fonctionne hors ligne, sans serveur ni IA :
   les cartes sont tirées du texte même de vos notes (définitions « X est… » et termes mis en gras/surlignés), donc rien n'est inventé.
   Surcouche : aucune fonction existante n'est modifiée en place. Dépend de cahier-demande.js (aides cnx*). */
(function(){
if(!window.cnxCSS)return;
var SESSION_MS=5*60*1000, MIN_DAY=5, MAXGEN=60;
var S={q:[],i:0,show:0,end:0,done:0,ti:0,need:0,rep:{}};
function day(){return Math.floor((Date.now()+36e5)/864e5)}     // jour civil à Kinshasa (UTC+1)
function C(){D.cards=D.cards||[];return D.cards}
function nzs(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()}
function plain(h){var d=document.createElement('div');d.innerHTML=h||'';
  /* Sépare les blocs (titres, paragraphes, listes) pour que « Le système nerveux » + « Le neurone est… » ne soient pas collés en une seule phrase. */
  Array.prototype.forEach.call(d.querySelectorAll('h1,h2,h3,h4,h5,h6,p,div,li,tr,blockquote,br'),function(e){e.appendChild(document.createTextNode('. '))});return d}
function sents(t){t=String(t||'').replace(/\s+/g,' ').trim();return (t.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g)||[]).map(function(s){return s.trim()}).filter(function(s){return s.length>=25&&s.length<=320})}

/* ---------- Création des cartes ---------- */
var DEF=/^((?:(?:le|la|les|l['’]|un|une|des)\s?)?[A-Za-zÀ-ÿ][^,;:()]{2,55}?)\s+(est|sont|désigne|désignent|correspond à|correspondent à|signifie|se définit comme|est défini[e]?s? comme|consiste en|consiste à)\s+(.{12,280})$/i;
var BAD=/^(il|elle|ils|elles|on|ce|cet|cette|ces|cela|ça|ceci|c['’]est|ici|donc|mais|ainsi|alors|voici|voilà|nous|vous|je|tu)\b/i;
var NOTERM=' tel telle tels telles tout toute tous toutes autre autres meme memes cela ceci celui celle ceux celles chaque plusieurs certains certaines quelque quelques selon comme ainsi alors aussi donc mais car puis encore deja tres trop peu bien mal sans sous vers chez entre depuis pendant avant apres contre lors dont ou ou lorsque quand pourquoi comment ne pas plus moins fois cas partie ';
function goodTerm(t){var w=t.trim().split(/\s+/);if(w.length>6)return false;if(/^[0-9\s.,%-]+$/.test(t))return false;var n=nzs(t);if(n.length<4&&!/^[A-ZÉÈÀ0-9]{2,}$/.test(t.trim()))return false;return w.some(function(x){var k=nzs(x);return k.length>=4&&NOTERM.indexOf(' '+k+' ')<0})}
/* Phrase qui renvoie à un contexte absent (« cette obligation », « ce texte », « ledit »…) ou qui commence par un connecteur : jamais de carte. */
var ANA=/(^|[^a-zà-ÿ])(cet|cette|ces|celui|celle|ceux|celles|ledit|ladite|lesdits|lesdites|susdit\w*|susmentionn\w*|précit\w*|ci-dessus|ci-dessous|ci-après|précédent\w*)(?![a-zà-ÿ])|(^|[^a-zà-ÿ])ce(?![a-zà-ÿ'’-])(?!\s+(qui|que|qu))|^(Elle|Il|Ils|Elles|Cela|Ceci|Ainsi|Toutefois|Cependant|Pourtant|En effet|Par ailleurs|De plus|Dès lors|Par conséquent|En outre|Or|Aussi|Donc|Mais|Et|Puis|Enfin|Ensuite)(?![a-zà-ÿ])/i;
function anaph(t){return ANA.test(String(t||'').replace(/^[-•–—*\d.)\s]+/,''))}
function badCard(k){if(k.t=='ia')return false;return anaph(k.t=='trou'?(k.ctx||k.q.replace(/^Complétez : /,'')):(k.a+' '+k.q))}
function fromText(txt,nb,pid,out,ttl){sents(txt).forEach(function(s){var m=s.replace(/^[-•–—*\d.)\s]+/,'').match(DEF);if(!m)return;var sub=m[1].trim();if(/^(est|sont)$/i.test(m[2])&&!/^(un|une|le|la|les|l['’]|des|du|de la|d['’]|celui|celle|ce qui|ce que)\b/i.test(m[3]))return;
    if(BAD.test(sub)||sub.split(/\s+/).length>8)return;
    out.push({q:'Qu’est-ce que « '+sub.replace(/^(le|la|les|l['’]|un|une|des)\s?/i,'')+' » ?',a:s.replace(/^[-•–—*\d.)\s]+/,''),nb:nb,pid:pid,t:'def',ttl:ttl||''})})}
function fromEmph(h,nb,pid,out,ttl){var d=plain(h),seen={};
  d.querySelectorAll('b,strong,mark,u').forEach(function(e){var term=(e.textContent||'').replace(/\s+/g,' ').trim();if(term.length<3||term.length>60||seen[term]||!goodTerm(term))return;seen[term]=1;
    var all=sents(d.textContent),s=all.filter(function(x){return x.indexOf(term)>=0})[0];if(!s)return;s=s.trim().replace(/\.{2,}$/,'.');if(s.length<45||s.split(/\s+/).length<8||!/^[A-ZÉÈÊÀÂÎÔÛÇ«"]/.test(s)||BAD.test(s))return;
    out.push({q:'Complétez : '+s.replace(term,'_____'),a:term,nb:nb,pid:pid,t:'trou',ctx:s,ttl:ttl||''})})}
async function gen(c){var out=[],n=0;
  for(var i=0;i<c.pages.length;i++){var p=c.pages[i];if(p.del)continue;
    var ttl=[p.chap,p.sujet].filter(Boolean).join(' · ');fromText(plain(p.html).textContent,c.id,p.id,out,ttl);fromEmph(p.html,c.id,p.id,out,ttl);
    (p.cpl||[]).forEach(function(q){fromText(plain(q.h).textContent,c.id,p.id,out,ttl);fromEmph(q.h,c.id,p.id,out,ttl)});
    for(var j=0;j<(p.att||[]).length;j++){var x=p.att[j];if(x.k=='a'&&x.tr){var tr='';try{tr=await fget('tr:'+x.id)||''}catch(e){}if(tr)fromText(tr,c.id,p.id,out,ttl)}}}
  var have={};C().forEach(function(k){have[k.sg]=1});
  out.forEach(function(k){if(n>=MAXGEN)return;var sg=c.id+'|'+nzs(k.q).slice(0,90);if(have[sg])return;have[sg]=1;n++;
    C().push({id:'k'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),sg:sg,nb:k.nb,pid:k.pid,q:k.q,a:k.a,t:k.t||'def',ttl:k.ttl||'',ctx:k.ctx||'',ef:2.5,iv:0,n:0,due:day()})});
  if(C().length>3000)D.cards=C().slice(-3000);
  raw();return n}

/* ---------- Répétition espacée (type SM-2 simplifiée) ---------- */
function nxt(k,g){var iv=k.iv,ef=k.ef;      // g : 0 à revoir, 1 difficile, 2 bien, 3 facile
  if(g==0)return{iv:0,ef:Math.max(1.3,ef-.2),n:0};
  if(g==1)return{iv:Math.max(1,Math.round((iv||1)*1.2)),ef:Math.max(1.3,ef-.15),n:k.n+1};
  var base=k.n==0?1:k.n==1?3:Math.round(iv*ef);if(g==3)base=Math.max(base+1,Math.round(base*1.4));
  return{iv:Math.max(1,base),ef:g==3?ef+.15:ef,n:k.n+1}}
/* Questions d'examen générées par l'IA (internet) : compréhension du contenu, pas de simple texte à trous. */
async function genIA(c){
  if(!window.cnxPassages)return{n:0,err:'erreur'};
  var P=await window.cnxPassages(c);if(!P.length)return{n:0,err:'cahier_vide'};
  var W=24;D.cgo=D.cgo||{};var off=D.cgo[c.id]||0;if(off>=P.length)off=0;
  var sel=P.slice(off,off+W);if(sel.length<W&&P.length>W)sel=sel.concat(P.slice(0,W-sel.length));
  D.cgo[c.id]=(off+W>=P.length)?0:off+W;
  var j;try{j=await window.cnxCall('cn-cartes',{notebook_id:c.id,lang:'fr',count:8,cours:c.cours||'',passages:sel.map(function(p){return{id:p.id,label:p.label,text:p.text}})})}catch(e){return{n:0,err:String(e&&e.message||e)}}
  if(j.error)return{n:0,err:j.error};
  var map={};sel.forEach(function(p){map[p.id]=p});var have={};C().forEach(function(k){have[k.sg]=1});var n=0;
  (j.cards||[]).forEach(function(k){var q=String(k.q||'').trim(),a=String(k.a||'').trim();if(q.length<12||a.length<3)return;var sg=c.id+'|'+nzs(q).slice(0,90);if(have[sg])return;have[sg]=1;n++;
    var p=map[k.src]||sel[0];
    C().push({id:'k'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),sg:sg,nb:c.id,pid:p.src.pid,q:q,a:a,t:'ia',ttl:(p.label||'').replace(/^Audio.*$/,'Audio du cours'),ctx:'',ef:2.5,iv:0,n:0,due:day()})});
  if(C().length>3000)D.cards=C().slice(-3000);raw();return{n:n}}
function lab(k,g){var r=nxt(k,g);return g==0?'< 1 j':r.iv+' j'}
function due(){var t=day();return C().filter(function(k){return k.due<=t}).sort(function(a,b){return a.due-b.due})}

/* ---------- Série (jours consécutifs) ---------- */
function stk(){var s=D.stk||{n:0,last:0,best:0},t=day();return {n:(s.last>=t-1)?s.n:0,last:s.last,best:s.best||0,today:s.last==t}}
function credit(){var t=day(),s=D.stk||{n:0,last:0,best:0};D.cday=D.cday&&D.cday.d==t?D.cday:{d:t,n:0};D.cday.n++;
  if(D.cday.n>=Math.min(MIN_DAY,S.need||MIN_DAY)&&s.last!=t){s.n=(s.last==t-1)?s.n+1:1;s.last=t;s.best=Math.max(s.best||0,s.n);D.stk=s;try{toast('🔥 Série : '+s.n+' jour'+(s.n>1?'s':''))}catch(e){}}raw();chip()}

/* ---------- Écrans ---------- */
window.cnxCSS('cnc1css','#cnc1{position:fixed;inset:0;z-index:70;background:#000a;display:flex}#cnc1 .cc1w>*{min-width:0}#cnc1 .cc1w{box-sizing:border-box;margin:auto;width:100%;max-width:640px;height:100%;max-height:100dvh;overflow-y:auto;background:var(--bg);padding:12px 14px calc(14px + env(safe-area-inset-bottom,0px));display:grid;gap:10px;align-content:start}#cnc1 .cc1h{display:flex;align-items:center;gap:8px}#cnc1 .cc1h b{flex:1;font-size:18px}#cnc1 .cc1c{padding:14px;border-radius:16px;background:var(--card);border:1px solid var(--line);line-height:1.55}#cnc1 .cc1f{min-height:130px;font-size:18px;white-space:pre-wrap;display:flex;align-items:center;justify-content:center;text-align:center}#cnc1 .cc1r{display:flex;gap:8px;flex-wrap:wrap}#cnc1 .cc1r>button{flex:1;min-width:0}#cnc1 .cc1g{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}#cnc1 .cc1g button{padding:10px 4px;font-size:13px}#cnc1 .cc1big{font-size:34px;font-weight:800}#cnc1 .cc1l{display:grid;gap:6px;max-height:40vh;overflow-y:auto}#cnc1 .cc1i{display:flex;gap:8px;align-items:center;font-size:14px}#cnc1 .cc1i span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}');
function root(){var o=document.getElementById('cnc1');if(!o){o=document.createElement('div');o.id='cnc1';o.innerHTML='<div class=cc1w id=cnc1w></div>';document.body.appendChild(o)}return document.getElementById('cnc1w')}
function close(){var o=document.getElementById('cnc1');if(o)o.remove();clearInterval(S.ti);S.ti=0}
function head(t){return '<div class=cc1h><b>'+t+'</b><button id=cc1x>✕</button></div>'}
function bindX(){var x=document.getElementById('cc1x');if(x)x.onclick=close}
function mmss(ms){ms=Math.max(0,Math.ceil(ms/1000));return Math.floor(ms/60)+':'+String(ms%60).padStart(2,'0')}

function menu(msg){var w=root(),d=due(),s=stk(),r=D.rem||{on:false,h:18,m:0},nbk=(typeof cur!=='undefined'&&cur)?cur:null;
  w.innerHTML=head('🧠 Cartes de révision')
   +'<div class=cc1c><div class=cc1big>🔥 '+s.n+' jour'+(s.n>1?'s':'')+'</div>'+(s.today?'✅ Défi du jour fait. Bravo !':'Faites 5 cartes aujourd’hui pour garder votre série.')+(s.best?'<br><span class=hint>Meilleure série : '+s.best+' jour'+(s.best>1?'s':'')+'</span>':'')+'</div>'
   +'<div class=cc1c><b>'+d.length+'</b> carte'+(d.length>1?'s':'')+' à réviser aujourd’hui sur '+C().length+'.<br><span class=hint>Les cartes reviennent au bon moment : plus vous les connaissez, plus elles s’espacent.</span></div>'
   +(msg?'<div class=cc1c>'+msg+'</div>':'')
   +'<div class=cc1r><button class=p id=cc1d style="width:auto">⚡ Défi du jour · 5 min</button></div>'
   +(nbk?'<div class=cc1c><b>Créer des cartes depuis « '+esc(nbk.cours)+' »</b><div class=cc1r style="margin-top:8px"><button class=p id=cc1ia>✨ Questions d’examen (avec internet)</button></div><div class=hint style="margin:4px 0 8px">L’IA lit vos notes et pose des questions comme à l’examen : définir, expliquer, comparer, énumérer. Les réponses viennent de vos notes.</div><div class=cc1r><button id=cc1g>📴 Cartes rapides (sans internet)</button></div><div class=hint style="margin-top:4px">Fabriquées sur l’appareil : définitions et phrases à compléter tirées de vos notes. Fonctionne hors ligne.</div></div>':'<div class=hint>Ouvrez un cahier pour créer des cartes à partir de ses notes.</div>')
   +'<div class=cc1c><b>⏰ Rappel quotidien</b><div class=cc1r style="margin-top:8px"><input type=time id=cc1t value="'+String(r.h).padStart(2,'0')+':'+String(r.m).padStart(2,'0')+'"><button id=cc1n>'+(r.on?'Désactiver':'Activer')+'</button><button id=cc1i>Ajouter à mon agenda</button></div><div class=hint style="margin-top:6px">Le rappel s’affiche quand l’application est ouverte ou récemment utilisée. Pour un rappel garanti même application fermée, ajoutez-le à l’agenda de votre téléphone.</div></div>'
   +'<div class=cc1c><b>Mes cartes</b><div class=cc1l id=cc1l></div></div>';
  bindX();
  document.getElementById('cc1d').onclick=function(){start()};
  var ia=document.getElementById('cc1ia');if(ia)ia.onclick=async function(){if(!navigator.onLine)return menu('📴 Pas de connexion : utilisez les cartes rapides, ou réessayez avec internet.');ia.disabled=true;ia.textContent='L’IA prépare vos questions…';var r=await genIA(cur);
    if(r.err)return menu(r.err=='limite_atteinte'?'Vous avez atteint la limite de générations de questions pour aujourd’hui. Revenez demain, ou utilisez les cartes rapides.':window.cnxErr(r.err));
    menu(r.n?'✅ '+r.n+' question'+(r.n>1?'s':'')+' d’examen ajoutée'+(r.n>1?'s':'')+'. Relancez pour couvrir la suite du cahier.':'Pas de nouvelle question cette fois (déjà créées). Relancez pour passer à la suite du cahier.')};
  var g=document.getElementById('cc1g');if(g)g.onclick=async function(){g.disabled=true;g.textContent='Création…';var n=await gen(cur);menu(n?'✅ '+n+' nouvelle'+(n>1?'s':'')+' carte'+(n>1?'s':'')+' créée'+(n>1?'s':'')+' à partir de vos notes.':'Aucune nouvelle carte trouvée. Astuce : écrivez des définitions (« La synapse est… ») ou mettez les mots importants en gras.')};
  document.getElementById('cc1n').onclick=async function(){var v=document.getElementById('cc1t').value.split(':');var on=!(D.rem&&D.rem.on);
    D.rem={on:on,h:+v[0]||18,m:+v[1]||0,last:(D.rem&&D.rem.last)||0};raw();
    if(on&&window.Notification&&Notification.permission=='default'){try{await Notification.requestPermission()}catch(e){}}
    menu(on?(window.Notification&&Notification.permission=='granted'?'⏰ Rappel activé à '+v.join(':')+'.':'⏰ Rappel activé dans l’application (les notifications du téléphone sont refusées ou indisponibles).'):'Rappel désactivé.')};
  document.getElementById('cc1t').onchange=function(){var v=this.value.split(':');D.rem=Object.assign({on:false,last:0},D.rem||{},{h:+v[0]||18,m:+v[1]||0});raw()};
  document.getElementById('cc1i').onclick=function(){var v=document.getElementById('cc1t').value.split(':'),h=String(v[0]||18).padStart(2,'0'),m=String(v[1]||0).padStart(2,'0'),n=new Date(Date.now()+36e5),
      ymd=n.getUTCFullYear()+String(n.getUTCMonth()+1).padStart(2,'0')+String(n.getUTCDate()).padStart(2,'0');
    var ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Cahier numerique//FR','BEGIN:VEVENT','UID:defi-du-jour@cahier-numerique','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z','DTSTART;TZID=Africa/Kinshasa:'+ymd+'T'+h+m+'00','DURATION:PT5M','RRULE:FREQ=DAILY','SUMMARY:Défi du jour : 5 minutes de révision','BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Gardez votre série : 5 cartes dans le cahier numérique','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));a.download='defi-du-jour.ics';document.body.appendChild(a);a.click();setTimeout(function(){a.remove()},500)};
  var L=document.getElementById('cc1l'),shown=C().slice(-30).reverse();
  if(!shown.length)L.innerHTML='<span class=hint>Aucune carte pour l’instant.</span>';
  shown.forEach(function(k){var r=document.createElement('div');r.className='cc1i';r.innerHTML='<span></span><button>🗑</button>';r.firstChild.textContent=k.q;
    r.lastChild.onclick=function(){D.cards=C().filter(function(x){return x.id!==k.id});raw();r.remove();chip()};L.appendChild(r)})}

function start(){var d=due().slice(0,25);if(!d.length)return menu('🎉 Aucune carte à réviser maintenant. Créez des cartes depuis un cahier ou revenez demain.');
  S.q=d.map(function(k){return k.id});S.i=0;S.show=0;S.rep={};S.done=0;S.need=Math.min(MIN_DAY,d.length);S.end=Date.now()+SESSION_MS;
  clearInterval(S.ti);S.ti=setInterval(tick,500);card()}
function tick(){var e=document.getElementById('cc1tm');if(!e){clearInterval(S.ti);S.ti=0;return}e.textContent='⏱ '+mmss(S.end-Date.now());if(Date.now()>=S.end&&!S.over){S.over=1;toast('⏱ 5 minutes écoulées')}}
function byId(id){return C().filter(function(k){return k.id===id})[0]}
function card(){var k=byId(S.q[S.i]);S.over=Date.now()>=S.end;
  if(!k||(S.over&&S.done>=S.need))return fin();
  var w=root();w.innerHTML=head('⚡ Défi du jour')+'<div class=cc1r><span class=hint id=cc1tm>⏱ '+mmss(S.end-Date.now())+'</span><span class=hint style="text-align:right">Carte '+Math.min(S.i+1,S.q.length)+' / '+S.q.length+'</span></div>'
   +'<div class=hint style="margin-top:-4px">'+(k.t=='ia'?'✨ Question d’examen':'📴 Carte rapide')+(k.ttl?' · '+esc(k.ttl):'')+'</div><div class="cc1c cc1f" id=cc1q></div>'+(S.show?'<div class="cc1c cc1f" id=cc1a style="min-height:90px;font-size:16px"></div>':'')
   +(S.show?'<div class=cc1g><button data-g=0>À revoir<br><small>'+lab(k,0)+'</small></button><button data-g=1>Difficile<br><small>'+lab(k,1)+'</small></button><button data-g=2>Bien<br><small>'+lab(k,2)+'</small></button><button data-g=3>Facile<br><small>'+lab(k,3)+'</small></button></div><div class=cc1r><button id=cc1s>📄 Voir dans le cahier</button></div>'
     :'<button class=p id=cc1v>Afficher la réponse</button>');
  document.getElementById('cc1q').textContent=k.q;bindX();var a=document.getElementById('cc1a');if(a)a.textContent=k.a;
  var v=document.getElementById('cc1v');if(v)v.onclick=function(){S.show=1;card()};
  var s=document.getElementById('cc1s');if(s)s.onclick=function(){close();try{openB(k.nb);openP(k.pid)}catch(e){}};
  Array.prototype.forEach.call(w.querySelectorAll('[data-g]'),function(b){b.onclick=function(){grade(k,+b.dataset.g)}})}
function grade(k,g){var r=nxt(k,g);k.ef=r.ef;k.n=r.n;k.iv=r.iv;k.due=day()+r.iv;k.last=day();
  if(g==0){S.rep[k.id]=(S.rep[k.id]||0)+1;if(S.rep[k.id]<=2)S.q.push(k.id)}
  S.done++;credit();raw();S.i++;S.show=0;card()}
function fin(){clearInterval(S.ti);S.ti=0;var s=stk(),w=root();
  w.innerHTML=head('🎉 Bravo !')+'<div class=cc1c><div class=cc1big>'+S.done+' carte'+(S.done>1?'s':'')+'</div>révisée'+(S.done>1?'s':'')+' · 🔥 série de '+s.n+' jour'+(s.n>1?'s':'')+'</div>'
   +'<div class=cc1r>'+(due().length?'<button class=p id=cc1m style="width:auto">Continuer ('+due().length+' à réviser)</button>':'')+'<button id=cc1b>Retour</button></div>';
  bindX();var m=document.getElementById('cc1m');if(m)m.onclick=start;document.getElementById('cc1b').onclick=function(){menu()}}
window.cnc1Open=function(){menu()};

/* ---------- Pastille 🔥 sur l'accueil + bouton dans le cahier ---------- */
function chip(){var b=document.getElementById('cnc1b');if(b){var d=due().length,s=stk();b.textContent='🧠 Cartes · '+(d?d+' à réviser':'à jour')+(s.n?' · 🔥'+s.n:'')}
  var h=document.getElementById('cnc1h');if(h){var s2=stk();h.textContent='🔥 '+s2.n+(due().length&&!s2.today?' •':'')}}
var oh=window.home;if(typeof oh=='function')window.home=function(){var r=oh.apply(this,arguments);try{var top=document.querySelector('.top');
  if(top&&!document.getElementById('cnc1h')){var b=document.createElement('button');b.id='cnc1h';b.title='Cartes de révision';b.onclick=window.cnc1Open;var m=top.querySelector('button[onclick^="menu"]');top.insertBefore(b,m||null);chip()}}catch(e){}return r};
var ob=window.openB;if(typeof ob=='function')window.openB=function(){var r=ob.apply(this,arguments);try{window.cnxBtn('cnc1b','🧠 Cartes de révision',window.cnc1Open,false);chip()}catch(e){}return r};

/* ---------- Rappel (dans l'application) ---------- */
function remind(){try{var r=D.rem;if(!r||!r.on)return;var n=new Date(Date.now()+36e5),mins=n.getUTCHours()*60+n.getUTCMinutes();
  if(mins<r.h*60+r.m||r.last===day()||stk().today||!due().length)return;
  r.last=day();raw();var msg='🧠 Défi du jour : '+Math.min(due().length,MIN_DAY)+' cartes, 5 minutes. Gardez votre série !';
  if(window.Notification&&Notification.permission=='granted'){var o={body:msg,icon:'icon-192.png',tag:'defi-du-jour'};
    if(navigator.serviceWorker&&navigator.serviceWorker.ready)navigator.serviceWorker.ready.then(function(g){return g.showNotification('Cahier numérique',o)}).catch(function(){try{new Notification('Cahier numérique',o)}catch(e){}});
    else try{new Notification('Cahier numérique',o)}catch(e){}}
  toast(msg)}catch(e){}}
setInterval(remind,60000);document.addEventListener('visibilitychange',function(){if(!document.hidden){remind();chip()}});setTimeout(function(){remind();chip()},1500);
})();
