/* Cahier numérique v6 : validation des comptes, partage de notes, quota IA, sans PDF.
   Chargé après le script principal de index.html. */
const V6MAX=10;let v6R=[];

/* ---------- Accès : connexion + validation par l'administration ---------- */
function v6login(msg){app.innerHTML=`<div class=top><img class=lg src=icon-192.png alt=""><h1>Cahier numérique</h1></div><div class=f><p>Connectez-vous ou créez un compte. L’accès au cahier s’ouvre après validation de votre paiement.</p><label>E-mail<input id=em type=email autocomplete=email></label><label>Mot de passe (6 caractères min.)<input id=pw type=password></label><button class=p onclick="v6auth(1)">Se connecter</button><button onclick="v6auth(0)">Créer un compte</button>${msg?'<p class=hint>'+esc(msg)+'</p>':''}</div>`}
function v6wait(){const s=D.stt=='suspendu';app.innerHTML=`<div class=top><img class=lg src=icon-192.png alt=""><h1>${s?'Compte suspendu':'Paiement en attente'}</h1></div><div class=f><p>${s?'Votre accès est suspendu. Contactez l’administration.':`Votre compte <b>${esc(D.s.email)}</b> est créé, mais votre cahier s’ouvrira après validation de votre paiement par l’administration.`}</p><div class=card><small>Paiement par Airtel Money ou Illicocash</small><h3>0999983163</h3><small>Indiquez l’adresse e-mail de votre compte avec le paiement.</small></div><button class=p onclick="v6gate()">J’ai payé · vérifier mon accès</button><button onclick="v6out()">Se déconnecter</button></div>`}
window.out=v6out;
window.hideSp=function(){const e=$('#sp');if(e&&!e.dataset.x){e.dataset.x=1;e.classList.add('off');setTimeout(()=>e.remove(),600);v6gate()}};

/* ---------- Accueil : boutons Reçues et Administration ---------- */
const v6home=window.home;
window.home=function(){v6home();const t=document.querySelector('.top'),m=t&&t.querySelector('button:last-child');if(!m)return;
m.insertAdjacentHTML('beforebegin',`<button id=v6ib onclick="v6inbox()">📥</button>`+(D.adm?'<button onclick="v6admin()">👑</button>':''));v6badge();setTimeout(()=>v6tour('home',V6T.home),900)};
async function v6badge(){if(!D.s||!D.ok)return;try{await tok();const r=await api('/rest/v1/cn_partages?select=id'),b=$('#v6ib');if(b&&r.length)b.textContent='📥 '+r.length}catch(e){}}

/* ---------- Envoi / réception de notes ---------- */
function v6share(){const e=$('#ed');if(e&&e.isContentEditable){pg.html=e.innerHTML;save()}
modal(`<b>Envoyer cette page à un collègue</b><div class=f><label>E-mail de votre collègue<input id=v6to type=email autocomplete=off></label><p class=hint>Il doit utiliser l’application avec cette adresse. Seul le texte est envoyé, sans images.</p></div>`,()=>{
const to=$('#v6to').value.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(to)){toast('E-mail invalide');return false}
if(D.s&&to==D.s.email.toLowerCase()){toast('C’est votre propre adresse');return false}v6send(to)});$('#eo').textContent='Envoyer'}
async function v6send(to){if(!D.s)return toast('Connectez-vous d’abord');
try{await tok();await api('/rest/v1/cn_partages',{m:'POST',h:{Prefer:'return=minimal'},b:{vers_email:to,titre:cur.cours+' · p.'+(cur.pages.indexOf(pg)+1),chap:pg.chap||'',sujet:pg.sujet||'',html:clean(pg.html||'').slice(0,150000)}});toast('Page envoyée à '+to)}
catch(e){toast(e&&e.message=='limite_envois'?'Limite d’envois atteinte pour aujourd’hui':'Envoi impossible (hors ligne ou compte non validé)')}}
async function v6inbox(){app.innerHTML='<header><button onclick=home()>‹</button><h1>Notes reçues</h1></header><div id=v6l><p class=hint>Chargement…</p></div>';
try{await tok();v6R=await api('/rest/v1/cn_partages?select=*&order=cree_le.desc&limit=50');
$('#v6l').innerHTML=v6R.map(x=>`<div class=rs><b>${esc(x.titre||'Note')}</b><small>De ${esc(x.de_email)} · ${dt(x.cree_le)}</small><span>${esc(txt(x.html).slice(0,160))}…</span><div><button class=ch onclick="v6keep('${x.id}')">＋ Enregistrer dans mon cahier</button><button class=ch onclick="v6drop('${x.id}')">Ignorer</button></div></div>`).join('')||'<p class=hint>Aucune note reçue. Quand un collègue vous envoie une page, elle apparaît ici.</p>'}
catch(e){$('#v6l').innerHTML='<p class=hint>Impossible de charger (hors ligne ?).</p>'}}
async function v6keep(id){const x=v6R.find(a=>a.id==id);if(!x)return;const n=Date.now();let c=D.c.find(k=>!k.del&&k.cours=='Notes reçues');
if(!c){c={id:uid(),cours:'Notes reçues',prof:'Collègues',color:COL[4],pages:[],u:n,d:1};D.c.unshift(c)}
c.pages.push({id:uid(),chap:x.chap||x.titre||'Note reçue',sujet:'De '+x.de_email,start:n,end:n,html:clean(x.html||''),u:n,d:1});c.u=n;c.d=1;raw();
try{await api('/rest/v1/cn_partages?id=eq.'+id,{m:'DELETE'})}catch(e){}toast('Enregistrée dans le cahier « Notes reçues »');setTimeout(sync,500);v6inbox()}
async function v6drop(id){try{await api('/rest/v1/cn_partages?id=eq.'+id,{m:'DELETE'})}catch(e){}v6inbox()}

/* ---------- Administration ---------- */
async function v6admin(){app.innerHTML='<header><button onclick=home()>‹</button><h1>Administration</h1></header><div id=v6a><p class=hint>Chargement…</p></div>';
try{await tok();const r=await api('/rest/v1/rpc/cn_admin_liste',{m:'POST',b:{}});
$('#v6a').innerHTML=r.map(u=>`<div class=rs><b>${esc(u.email)}</b><small>${u.statut=='valide'?'✅ Validé':u.statut=='suspendu'?'⛔ Suspendu':'⏳ En attente'} · inscrit le ${dt(u.cree_le)}</small><div>${u.statut!='valide'?`<button class=ch onclick="v6set('${u.user_id}','valide')">✅ Valider (paiement reçu)</button>`:''}${u.statut!='suspendu'?`<button class=ch onclick="v6set('${u.user_id}','suspendu')">⛔ Suspendre</button>`:''}</div></div>`).join('')||'<p class=hint>Aucun compte.</p>'}
catch(e){$('#v6a').innerHTML='<p class=hint>Accès refusé ou hors ligne.</p>'}}
async function v6set(id,s){try{await api('/rest/v1/rpc/cn_admin_statut',{m:'POST',b:{p_user:id,p_statut:s}});toast('Mis à jour');v6admin()}catch(e){toast('Action impossible')}}

/* ---------- IA : fonction cn-ia, 10 demandes par jour ---------- */
async function v6call(body){await tok();const r=await fetch(SB+'/functions/v1/cn-ia',{method:'POST',headers:{...stH(),'Content-Type':'application/json'},body:JSON.stringify(body)});let j={};try{j=await r.json()}catch(e){}if(!r.ok&&!j.error)j.error='erreur '+r.status;return j}
const v6err=j=>j.error=='limite'?`Vous avez utilisé vos ${V6MAX} demandes IA du jour. Elles reviennent demain.`:j.error=='non_valide'?'Votre compte n’est pas encore activé.':j.error=='no_key'?'L’IA n’est pas encore activée côté serveur.':'Échec de l’IA : '+j.error;
const v6left=j=>typeof j.restant=='number'?`<p class=hint>Demandes IA restantes aujourd’hui : ${j.restant}/${V6MAX}</p>`:'';
window.ia=async function(){const r=$('#er');if(!D.s){r.innerHTML='<p class=hint>Connectez-vous pour utiliser l’IA.</p>';return}
r.innerHTML='<p class=hint>L’IA prépare vos compléments… (10 à 30 secondes)</p>';
try{const j=await v6call({q:($('#eq')||{}).value||'',cours:cur.cours,chap:pg.chap||'',sujet:pg.sujet||'',notes:txt($('#ed').innerHTML).slice(0,8000)});
if(j.error)return r.innerHTML='<p class=hint>'+esc(v6err(j))+'</p>';
AIH=clean(j.text||'');r.innerHTML=(j.web?'':'<p class=hint>Aucune source trouvée : réponse basée sur les connaissances de l’IA, à vérifier.</p>')+`<div class=card style="font-size:15px;line-height:1.6">${AIH}</div>`+v6left(j)+`<div class=f><button class=p onclick="saveC($('#eq').value||'Compléments IA',AIH,'ia')">💾 Enregistrer dans Notes complémentaires</button><button class=p onclick=lecon()>📘 Leçon complète (compte pour 1 demande)</button></div>`}
catch(e){r.innerHTML='<p class=hint>Échec de l’IA : '+esc(String(e.message||e))+'</p>'}};
window.lecon=async function(){const r=$('#er');r.innerHTML='<p class=hint>L’IA prépare votre leçon complète… (20 à 60 secondes)</p>';
try{const j=await v6call({mode:'lecon',q:$('#eq').value||'',cours:cur.cours,chap:pg.chap||'',sujet:pg.sujet||'',notes:txt($('#ed').innerHTML).slice(0,3000)});
if(j.error)return r.innerHTML='<p class=hint>'+esc(v6err(j))+'</p>';
LH=clean(j.text||'');r.innerHTML=`<div class=card style="font-size:15px;line-height:1.7">${LH}</div>`+v6left(j)+`<div class=f><button class=p onclick="saveC('Leçon : '+$('#eq').value,LH,'lecon')">💾 Enregistrer la leçon dans Notes complémentaires</button></div>`}
catch(e){r.innerHTML='<p class=hint>Échec de l’IA : '+esc(String(e.message||e))+'</p>'}};

/* ---------- Texte uniquement : plus de PDF ---------- */
const v6draw=window.draw;
window.draw=function(a,b){v6draw(a,b);if(a)setTimeout(()=>v6tour('page',V6T.page),600);const tb=$('.tb');if(tb)tb.insertAdjacentHTML('afterbegin',P('v6share()','📤 Envoyer'));
const f=$('#fp');if(f)f.remove();const q=document.querySelector('button[onclick*="#fp"]');if(q)q.remove()};
const v6atts=window.atts;
window.atts=function(){const a=pg.att;pg.att=(a||[]).filter(x=>x.k!='p');v6atts();pg.att=a};
const v6scan=window.scanUI;
window.scanUI=function(){v6scan();const b=document.querySelector('#sc button[onclick="scanPdf()"]');if(b)b.remove()};
window.pdf=window.scanPdf=()=>toast('Les PDF ne sont plus pris en charge : le cahier garde uniquement le texte');
window.upl=async()=>{};


/* =====================================================================
   v6.1 : chaque compte a ses propres cahiers + guide de première utilisation
   ===================================================================== */

/* ---------- Espace séparé par compte sur l'appareil ---------- */
const V6F=['c','ev','dr','bk','sort','tour'];
const v6store=id=>{const o={};V6F.forEach(k=>o[k]=D[k]);try{localStorage.setItem('cn-user-'+id,JSON.stringify(o))}catch(e){}};
const v6load=id=>{let o={};try{o=JSON.parse(localStorage.getItem('cn-user-'+id))||{}}catch(e){}V6F.forEach(k=>D[k]=o[k]);D.c=D.c||[];D.tour=D.tour||{};D.bk=D.bk||0};
const v6vide=()=>{V6F.forEach(k=>D[k]=undefined);D.c=[];D.tour={};D.bk=0};
function v6enter(id,email,after){
 if(D.own==id)return after();
 if(D.own){v6store(D.own);v6load(id);D.own=id;raw();return after()}
 const n=(D.c||[]).filter(c=>!c.del).length;
 if(!n&&!(D.ev||[]).length){v6load(id);D.own=id;raw();return after()}
 if(document.querySelector('[data-v6=dlg]'))return;
 const o=document.createElement('div');o.id='ak';o.dataset.v6='dlg';
 o.innerHTML=`<div class=scb><b>Cahiers trouvés sur cet appareil</b><p class=hint>Cet appareil contient ${n} cahier(s) créé(s) avant la séparation des comptes. Sont-ils à vous (${esc(email)}) ?</p><div class=f><button class=p id=v6y>Oui, ce sont les miens</button><button id=v6n>Non, partir d’un cahier vide</button></div></div>`;
 document.body.appendChild(o);
 o.querySelector('#v6y').onclick=()=>{o.remove();D.own=id;D.tour=D.tour||{};D.c.forEach(c=>{c.d=1;c.u=c.u||Date.now();c.pages.forEach(p=>{p.d=1;p.u=p.u||Date.now()})});raw();after()};
 o.querySelector('#v6n').onclick=()=>{o.remove();try{localStorage.setItem('cn-user-ancien-appareil',JSON.stringify(Object.fromEntries(V6F.map(k=>[k,D[k]]))))}catch(e){}v6load(id);D.own=id;raw();after()};
}
async function v6auth(login){const em=$('#em').value.trim().toLowerCase(),pw=$('#pw').value;if(!em||pw.length<6)return toast('E-mail et mot de passe (6 caractères min.)');
try{const j=await api(login?'/auth/v1/token?grant_type=password':'/auth/v1/signup',{m:'POST',b:{email:em,password:pw}},0);
if(!j.access_token)return v6login('Compte créé : confirmez votre e-mail, puis connectez-vous.');
setS(j);raw();v6enter(j.user.id,j.user.email,()=>{raw();v6gate()})}catch(e){toast(e.msg||e.error_description||e.message||'Échec de connexion')}}
async function v6gate(){if(!D.s)return v6login();
let id='';try{id=uidT()}catch(e){}
if(id&&D.own!=id)return v6enter(id,D.s.email,v6gate);
app.innerHTML='<p class=hint style="padding:60px 0;text-align:center">Vérification de votre accès…</p>';
try{await tok();const r=await api('/rest/v1/cn_profils?select=statut,est_admin'),p=r[0];D.stt=p?p.statut:'en_attente';D.ok=D.stt=='valide';D.adm=!!(p&&p.est_admin&&D.ok);raw()}
catch(e){if(e&&e.code==401){D.s=null;D.ok=0;raw();return v6login()}if(!D.ok)return v6wait()}
if(D.ok){await v6reconcile();home();sync();setTimeout(recover,300)}else v6wait()}
async function v6out(){if(D.s&&D.own){try{await Promise.race([sync(),new Promise(r=>setTimeout(r,4000))])}catch(e){}v6store(D.own)}
D.s=null;D.ok=0;D.adm=0;D.own=null;v6vide();raw();v6login()}
window.out=v6out;

/* ---------- Guide automatique (une seule fois par compte et par écran) ---------- */
const V6T={
home:[{t:'Bienvenue dans votre cahier numérique ! Ce guide rapide explique ce que fait chaque bouton. Il ne s’affiche qu’une seule fois.'},
{sel:'.bkr.add',t:'＋ Nouveau cahier : touchez ici pour créer le cahier d’un cours (nom, professeur, couleur). Un cahier par cours.'},
{sel:'.sb',t:'🔍 Recherche : tapez un mot pour le retrouver dans tous vos cours et toutes vos pages.'},
{sel:'button[onclick="agenda()"]',t:'📅 Horaires et examens : notez vos cours et examens, avec rappel dans le calendrier du téléphone.'},
{sel:'#v6ib',t:'📥 Notes reçues : quand un collègue vous envoie une page, elle arrive ici. Vous l’enregistrez dans votre cahier en un clic.'},
{sel:'button[onclick="v6admin()"]',t:'👑 Administration : voir les inscriptions et valider un compte après réception du paiement.'},
{sel:'button[onclick="menu()"]',t:'⋯ Menu : sauvegarde et restauration de vos cahiers, thème clair/sombre, déconnexion.'}],
newb:[{sel:'#a',t:'Écrivez le nom du cours (obligatoire), puis celui du professeur.'},{sel:'.sw',t:'Choisissez la couleur de la couverture de votre cahier.'},{sel:'button.p',t:'« Créer le cahier » : il apparaît aussitôt sur votre étagère.'}],
cahier:[{sel:'.f .p',t:'＋ Nouvelle page : crée une page de notes. L’heure de début est notée automatiquement, celle de fin quand vous fermez la page.'},
{sel:'.f button:not(.p)',t:'🎴 Réviser : les passages que vous surlignez en couleur deviennent des fiches de révision.'},
{sel:'#cl',t:'🎙 Classeur audio : vos enregistrements de cours faits dans les pages se retrouvent ici.'},
{sel:'header button[onclick="editB()"]',t:'✎ Modifier le nom du cours, le professeur ou la couleur.'},
{sel:'header button[onclick^="exp"]',t:'Partager : crée un fichier de sauvegarde de ce cahier. Pour envoyer une seule page à un collègue, utilisez 📤 Envoyer dans la page.'},
{sel:'#del',t:'🗑 Supprimer le cahier (une confirmation est demandée).'}],
page:[{sel:'.sheet',t:'Écrivez ici : tout s’enregistre automatiquement.'},
{sel:'button[onclick="enr()"]',t:'🔎 Compléter : cherche des infos sur Wikipédia, ou avec l’IA (10 demandes IA par jour), pour enrichir vos notes.'},
{sel:'button[onclick="lire()"]',t:'🔊 Lire : lit la page (ou le texte sélectionné) à voix haute.'},
{sel:'button[onclick="rec()"]',t:'🎙 Enregistrer : enregistre le cours en audio. Touchez de nouveau pour arrêter.'},
{sel:'button[onclick="dic()"]',t:'🗣 Dictée : parlez, le texte s’écrit tout seul dans la page.'},
{sel:'button[onclick="scanUI()"]',t:'📄 Scan : photographiez un document puis insérez-le en image ou convertissez-le en texte.'},
{sel:'button[onclick="v6share()"]',t:'📤 Envoyer : tapez l’e-mail d’un collègue qui utilise l’application, et cette page (texte seul) arrive dans ses « Notes reçues ».'},
{sel:'button[onclick="bro()"]',t:'✎ Brouillon : un bloc-notes rapide pour noter sans quitter la page.'},
{sel:'.tb button.d',t:'Pastilles de couleur : colorez le texte ou surlignez. Un passage surligné devient une fiche de révision.'},
{sel:'.eh .p',t:'Fermer : enregistre l’heure de fin et vous ramène au cahier.'}],
menu:[{sel:'button[onclick*="sync()"]',t:'Synchroniser : envoie vos notes vers votre compte en ligne pour les retrouver partout.'},
{sel:'button[onclick="exp()"]',t:'Sauvegarder tous mes cahiers : crée un fichier à garder (Google Drive, par exemple).'},
{sel:'input[type=file]',t:'Restaurer : choisissez un fichier de sauvegarde pour récupérer vos cahiers.'},
{sel:'button[onclick="th()"]',t:'Passer du thème clair au thème sombre.'}],
agenda:[{sel:'#ea',t:'Écrivez l’intitulé, par exemple « Examen d’Introduction au droit ».'},{sel:'#eb',t:'Choisissez la date et l’heure.'},{sel:'#k1',t:'Indiquez s’il s’agit d’un cours ou d’un examen.'},{sel:'.f .p',t:'« Ajouter » : l’événement apparaît dessous. Le bouton 📲 l’ajoute ensuite au calendrier du téléphone, avec rappels.'}],
enr:[{sel:'#eq',t:'Sujet à rechercher : rempli avec votre chapitre, modifiable.'},{sel:'button[onclick="wik()"]',t:'📚 Wikipédia + DuckDuckGo : gratuit, sans limite. Vous choisissez ce que vous gardez.'},{sel:'button[onclick="ia()"]',t:'✨ IA : complète vos notes. Chaque demande compte pour l’une de vos 10 demandes du jour (renouvelées chaque jour).'}],
rev:[{sel:'.card p',t:'Une phrase avec un trou ＿＿＿＿ : essayez de retrouver le mot caché.'},{sel:'.card .p',t:'Affichez la réponse, puis dites « Je savais » ou « À revoir ».'}],
inbox:[{t:'Les pages envoyées par vos collègues arrivent ici. « Enregistrer dans mon cahier » les place dans le cahier « Notes reçues » ; « Ignorer » les supprime.'}],
admin:[{t:'Les inscriptions en attente sont en haut. Après avoir vérifié le paiement (Airtel Money / Illicocash), touchez « Valider » : le compte peut alors ouvrir son cahier. « Suspendre » bloque un compte.'}]
};
function v6tour(key,steps,force){D.tour=D.tour||{};if(!force&&D.tour[key])return;if(!D.s||!D.ok||$('#sp')||$('#v6t')||$('#ak'))return;
const list=steps.filter(s=>!s.sel||document.querySelector(s.sel));if(!list.length)return;
D.tour[key]=1;raw();let i=0;const o=document.createElement('div');o.id='v6t';o.style.cssText='position:fixed;inset:0;z-index:300';document.body.appendChild(o);
const end=()=>o.remove(),show=()=>{const s=list[i],el=s.sel&&document.querySelector(s.sel);if(el)try{el.scrollIntoView({block:'nearest',inline:'center'})}catch(e){}
requestAnimationFrame(()=>{const r=el&&el.getBoundingClientRect(),low=r&&r.top>innerHeight/2,pos=r?(low?'top:calc(16px + env(safe-area-inset-top,0px))':'bottom:calc(16px + env(safe-area-inset-bottom,0px))'):'top:50%;transform:translateY(-50%)';
o.innerHTML=(r?`<div style="position:fixed;left:${r.left-6}px;top:${r.top-6}px;width:${r.width+12}px;height:${r.height+12}px;border-radius:16px;box-shadow:0 0 0 9999px #000b;border:2px solid #fff;pointer-events:none"></div>`:'<div style="position:fixed;inset:0;background:#000b"></div>')
+`<div style="position:fixed;left:12px;right:12px;max-width:440px;margin:0 auto;${pos};background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:20px;padding:16px;box-shadow:0 12px 40px #0008"><p style="margin:0 0 12px;font-size:16px;line-height:1.5">${esc(s.t)}</p><div style="display:flex;gap:8px;align-items:center"><span class=hint style="flex:1">${i+1}/${list.length}</span><button id=v6s>Passer</button><button class=p id=v6n2 style="width:auto;padding:10px 18px">${i<list.length-1?'Suivant':'Compris'}</button></div></div>`;
$('#v6s').onclick=end;$('#v6n2').onclick=()=>{if(++i>=list.length)end();else show()}})};show()}
const v6hook=(n,f)=>{const g=window[n];window[n]=function(...a){const r=g.apply(this,a);try{f(...a)}catch(e){}return r}};
v6hook('newB',()=>setTimeout(()=>v6tour('newb',V6T.newb),500));
v6hook('openB',()=>setTimeout(()=>v6tour('cahier',V6T.cahier),600));
v6hook('menu',()=>{const f=$('.f');if(f)f.insertAdjacentHTML('beforeend','<button onclick="D.tour={};raw();home()">❔ Revoir le guide</button>');setTimeout(()=>v6tour('menu',V6T.menu),500)});
v6hook('agenda',()=>setTimeout(()=>v6tour('agenda',V6T.agenda),500));
v6hook('enr',()=>setTimeout(()=>{if($('#ak'))$('#ak').dataset.t=1;v6tourF('enr',V6T.enr)},400));
v6hook('rev',()=>setTimeout(()=>v6tour('rev',V6T.rev),500));
v6hook('v6inbox',()=>setTimeout(()=>v6tour('inbox',V6T.inbox),500));
v6hook('v6admin',()=>setTimeout(()=>v6tour('admin',V6T.admin),500));
/* l'écran « Compléter » est une fenêtre (#ak) : le guide doit pouvoir s'y afficher */
function v6tourF(k,s){const a=$('#ak');if(a)a.id='ak2';v6tour(k,s);if(a)a.id='ak'}


/* ---------- v6.2 : garde-fous d'isolation côté appareil ---------- */
/* Toute connexion passe par v6auth (l'ancien formulaire du menu contournait la séparation des comptes) */
window.auth=v6auth;
/* Retire de cet appareil tout cahier/page déjà synchronisé que le serveur ne reconnaît pas comme appartenant à ce compte */
async function v6reconcile(){if(!navigator.onLine||!D.s)return;
try{await tok();const[rc,rp]=await Promise.all([api('/rest/v1/cn_cahiers?select=id'),api('/rest/v1/cn_pages?select=id')]);
const C=new Set(rc.map(r=>r.id)),G=new Set(rp.map(r=>r.id));let n=0;const bak=JSON.stringify(D.c);
D.c=D.c.filter(c=>{const k=c.pages.length;c.pages=c.pages.filter(p=>p.d==1||G.has(p.id));n+=k-c.pages.length;
if(c.d!=1&&!C.has(c.id)&&!c.pages.length){n++;return false}return true});
if(n){try{localStorage.setItem('cn-retire-'+(D.own||'x'),bak)}catch(e){}raw();toast(n+' élément(s) étranger(s) à ce compte retiré(s)')}}
catch(e){}}

/* ---------- v6.3 : affichage ajusté à l'écran (plus besoin de dézoomer) ---------- */
/* Cause : la liste des cahiers était posée dans une grille à 2 colonnes (.shelf) prévue pour des couvertures ;
   les titres sur une seule ligne élargissaient la page au-delà de l'écran, d'où l'effet « zoomé ». */
(()=>{const s=document.createElement('style');
s.textContent='html,body{max-width:100%;overflow-x:clip}#app{box-sizing:border-box;width:100%;overflow-x:clip}'
+'.shelf{display:block!important}.shelf>*{min-width:0;max-width:100%;box-sizing:border-box}'
+'.bkr,.bi,.rs,.card,.cont,.hero,.stats,.stats>div,.top h1,.tt{min-width:0;max-width:100%;box-sizing:border-box}'
+'.scb,#ak,#sc{max-width:100vw;box-sizing:border-box}img,audio,video{max-width:100%}.sheet img{max-width:100%;height:auto}'
+'.top{flex-wrap:wrap;gap:10px 12px;align-items:center}.top h1{flex:1 1 calc(100% - 70px);font-size:25px;line-height:1.1;overflow-wrap:normal;word-break:normal;hyphens:none}'
+'.top button{flex:1 1 0;min-width:0;padding:10px 0;font-size:18px}';
document.head.appendChild(s)})();
/* v6.4 : brouillon par page, audio réparé, boutons de mise en forme actifs */
const v64draw=window.draw;
window.draw=function(a,b){v64draw(a,b);
 const t=$('#dt');if(t){t.value=pg.dr||'';t.oninput=function(){pg.dr=this.value;raw()}}
 const v=document.querySelector('#dr .drh span button:nth-child(2)');if(v)v.onclick=()=>{pg.dr='';const t2=$('#dt');if(t2)t2.value='';raw()};
 document.querySelectorAll('.tb button').forEach(x=>{const m=/^cmd\('(\w+)',(?:null|'([^']*)')\)$/.exec(x.getAttribute('onclick')||'');if(m){x.dataset.fc=m[1];if(m[2])x.dataset.fv=m[2]}});
 v64fmt()};

const v64rg=id=>IDBKeyRange.bound(id+'#',id+'#\uffff');
if(typeof fall!='function')window.fall=async p=>{const d=await idb();return new Promise(r=>{const q=d.transaction('f').objectStore('f').getAll(IDBKeyRange.bound(p,p+'\uffff'));q.onsuccess=()=>r(q.result||[]);q.onerror=()=>r([])})};
if(typeof fdel!='function')window.fdel=async id=>{const d=await idb();return new Promise(r=>{const t=d.transaction('f','readwrite'),s=t.objectStore('f');s.delete(id);s.delete(v64rg(id));t.oncomplete=()=>r();t.onerror=()=>r()})};
if(typeof fin!='function')window.fin=async x=>{const bs=await fall(x.id+'#');
 if(bs.length){await fput(x.id,new Blob(bs,{type:x.m||'audio/webm'}));x.d=bs.length;
  const d=await idb();await new Promise(r=>{const t=d.transaction('f','readwrite');t.objectStore('f').delete(v64rg(x.id));t.oncomplete=()=>r();t.onerror=()=>r()})}
 delete x.st};
if(typeof ask!='function')window.ask=function(t,v,cb){modal(`<b>${esc(t)}</b><div class=f><label>Nom<input id=ask1 value="${esc(v||'')}"></label></div>`,()=>{cb($('#ask1').value.trim())});
 const b=$('#eo');if(b)b.textContent='OK';setTimeout(()=>{const i=$('#ask1');if(i){i.focus();i.select()}},60)};
window.rec=function(){if(mr&&mr.state=='recording'){mr.stop();return}if(!pg)return toast('Ouvrez une page pour enregistrer');recGo('Cours '+hm(Date.now()),pg)};

(()=>{const s=document.createElement('style');
s.textContent='.tb button.on{background:var(--acc);color:#fff;border-color:var(--acc)}.tb button.d.on{border:3px solid var(--ink)}';
document.head.appendChild(s)})();
const v64rgb=h=>{const n=parseInt(h.slice(1),16);return 'rgb('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+')'};
const v64n=s=>String(s||'').replace(/\s/g,'').toLowerCase();
function v64fmt(){const e=$('#ed'),s=getSelection();if(!e||!e.isContentEditable||!s.rangeCount||!e.contains(s.anchorNode))return;
 document.querySelectorAll('.tb button[data-fc]').forEach(b=>{const c=b.dataset.fc,v=b.dataset.fv;let on=false;
  try{if(c=='formatBlock')on=/^(h3|heading3)$/.test(v64n(document.queryCommandValue(c)));
  else if(c=='foreColor')on=v!='#1b1d2e'&&v64n(document.queryCommandValue(c))==v64rgb(v);
  else if(c=='hiliteColor')on=v64n(document.queryCommandValue(c))==v64rgb(v);
  else on=document.queryCommandState(c)}catch(x){}
  b.classList.toggle('on',!!on)})}
document.addEventListener('selectionchange',v64fmt);
const v64cmd=window.cmd;
window.cmd=function(c,v){const r=v64cmd(c,v);v64fmt();return r};
/* v6.5 : brouillons synchronisés avec Supabase */
let v64t;
const v64touch=()=>{pg.dra=Date.now();pg.drd=1;raw();clearTimeout(v64t);v64t=setTimeout(v64drSync,3000)};
const v64draw2=window.draw;
window.draw=function(a,b){v64draw2(a,b);
 const t=$('#dt');if(t)t.oninput=function(){pg.dr=this.value;v64touch()};
 const v=document.querySelector('#dr .drh span button:nth-child(2)');if(v)v.onclick=()=>{pg.dr='';const t2=$('#dt');if(t2)t2.value='';v64touch()}};
let v64busy=0;
async function v64drSync(){if(!D.s||!D.ok||v64busy||!navigator.onLine)return;v64busy=1;
 try{await tok();const rows=await api('/rest/v1/cn_pages?select=id,dr,dr_at'),R=new Map(rows.map(r=>[r.id,r]));
  for(const c of D.c)for(const p of c.pages){const r=R.get(p.id);if(!r)continue;
   if(p.drd&&(p.dra||0)>=(r.dr_at||0)){const a=p.dra||Date.now();
    await api('/rest/v1/cn_pages?id=eq.'+encodeURIComponent(p.id),{m:'PATCH',h:{Prefer:'return=minimal'},b:{dr:p.dr||'',dr_at:a}});
    if((p.dra||0)==a)p.drd=0}
   else if((r.dr_at||0)>(p.dra||0)){p.dr=r.dr;p.dra=r.dr_at;p.drd=0;
    const t=$('#dt');if(t&&pg&&pg.id==p.id&&document.activeElement!==t)t.value=p.dr}}
  raw()}catch(e){}finally{v64busy=0}}
const v64sync=window.sync;
window.sync=async function(){await v64sync();await v64drSync()};
/* v6.6 : numérotation continue ou nouvelle, au choix */
const v65ol=()=>{const s=getSelection(),e=$('#ed');if(!e||!s.rangeCount)return null;let n=s.anchorNode;while(n&&n!==e){if(n.nodeType==1&&n.tagName=='OL')return n;n=n.parentNode}return null};
const v65prev=ol=>{const L=[...$('#ed').querySelectorAll('ol')],i=L.indexOf(ol);return i>0?L[i-1]:null};
const v65next=ol=>{const p=v65prev(ol);return p?(parseInt(p.getAttribute('start'))||1)+p.children.length:1};
function v65ask(ol){const o=document.createElement('div');o.id='ak';const n=v65next(ol);
 o.innerHTML=`<div class=scb><b>Numérotation</b><p class=hint>Il y a déjà une liste numérotée plus haut dans cette page.</p><div class=f><button class=p id=v65a>Continuer la numérotation (à partir de ${n})</button><button class=p id=v65b>Recommencer à 1</button></div></div>`;
 document.body.appendChild(o);o.onclick=e=>{if(e.target==o)o.remove()};
 const fin=()=>{o.remove();pg.html=$('#ed').innerHTML;save()};
 $('#v65a').onclick=()=>{ol.setAttribute('start',n);fin()};
 $('#v65b').onclick=()=>{ol.removeAttribute('start');fin()}}
const v65cmd=window.cmd;
window.cmd=function(c,v){const was=c=='insertOrderedList'&&document.queryCommandState(c);const r=v65cmd(c,v);
 if(c=='insertOrderedList'&&!was){const ol=v65ol();if(ol&&v65prev(ol))v65ask(ol)}return r};
window.v65num=function(){const ol=v65ol();if(!ol)return toast('Placez le curseur dans une liste numérotée');if(!v65prev(ol))return toast('C’est la première liste numérotée de la page');v65ask(ol)};
const v65draw=window.draw;
window.draw=function(a,b){v65draw(a,b);const x=document.querySelector('.tb button[data-fc="insertOrderedList"]');if(x)x.insertAdjacentHTML('afterend',P('v65num()','N°'))};
