/* Cahier numérique v6 : validation des comptes, partage de notes, quota IA, sans PDF.
   Chargé après le script principal de index.html. */
const V6MAX=10;let v6R=[];

/* ---------- Accès : connexion + validation par l'administration ---------- */
function v6login(msg){app.innerHTML=`<div class=top><img class=lg src=icon-192.png alt=""><h1>Cahier numérique</h1></div><div class=f><p>Connectez-vous ou créez un compte. L’accès au cahier s’ouvre après validation de votre paiement.</p><label>E-mail<input id=em type=email autocomplete=email></label><label>Mot de passe (6 caractères min.)<input id=pw type=password></label><button class=p onclick="v6auth(1)">Se connecter</button><button onclick="v6auth(0)">Créer un compte</button>${msg?'<p class=hint>'+esc(msg)+'</p>':''}</div>`}
async function v6auth(login){const em=$('#em').value.trim().toLowerCase(),pw=$('#pw').value;if(!em||pw.length<6)return toast('E-mail et mot de passe (6 caractères min.)');
try{const j=await api(login?'/auth/v1/token?grant_type=password':'/auth/v1/signup',{m:'POST',b:{email:em,password:pw}},0);
if(!j.access_token)return v6login('Compte créé : confirmez votre e-mail, puis connectez-vous.');
setS(j);D.c.forEach(c=>{c.d=1;c.u=c.u||Date.now();c.pages.forEach(p=>{p.d=1;p.u=p.u||Date.now()})});raw();v6gate()}catch(e){toast(e.msg||e.error_description||e.message||'Échec de connexion')}}
function v6wait(){const s=D.stt=='suspendu';app.innerHTML=`<div class=top><img class=lg src=icon-192.png alt=""><h1>${s?'Compte suspendu':'Paiement en attente'}</h1></div><div class=f><p>${s?'Votre accès est suspendu. Contactez l’administration.':`Votre compte <b>${esc(D.s.email)}</b> est créé, mais votre cahier s’ouvrira après validation de votre paiement par l’administration.`}</p><div class=card><small>Paiement par Airtel Money ou Illicocash</small><h3>0999983163</h3><small>Indiquez l’adresse e-mail de votre compte avec le paiement.</small></div><button class=p onclick="v6gate()">J’ai payé · vérifier mon accès</button><button onclick="v6out()">Se déconnecter</button></div>`}
async function v6gate(){if(!D.s)return v6login();
app.innerHTML='<p class=hint style="padding:60px 0;text-align:center">Vérification de votre accès…</p>';
try{await tok();const r=await api('/rest/v1/cn_profils?select=statut,est_admin'),p=r[0];D.stt=p?p.statut:'en_attente';D.ok=D.stt=='valide';D.adm=!!(p&&p.est_admin&&D.ok);raw()}
catch(e){if(e&&e.code==401){D.s=null;D.ok=0;raw();return v6login()}if(!D.ok)return v6wait()}
if(D.ok){home();sync();setTimeout(recover,300)}else v6wait()}
function v6out(){D.s=null;D.ok=0;D.adm=0;raw();v6login()}
window.out=v6out;
window.hideSp=function(){const e=$('#sp');if(e){e.classList.add('off');setTimeout(()=>e.remove(),600);v6gate()}};

/* ---------- Accueil : boutons Reçues et Administration ---------- */
const v6home=window.home;
window.home=function(){v6home();const t=document.querySelector('.top'),m=t&&t.querySelector('button:last-child');if(!m)return;
m.insertAdjacentHTML('beforebegin',`<button id=v6ib onclick="v6inbox()">📥</button>`+(D.adm?'<button onclick="v6admin()">👑</button>':''));v6badge()};
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
window.draw=function(a,b){v6draw(a,b);const tb=$('.tb');if(tb)tb.insertAdjacentHTML('afterbegin',P('v6share()','📤 Envoyer'));
const f=$('#fp');if(f)f.remove();const q=document.querySelector('button[onclick*="#fp"]');if(q)q.remove()};
const v6atts=window.atts;
window.atts=function(){const a=pg.att;pg.att=(a||[]).filter(x=>x.k!='p');v6atts();pg.att=a};
const v6scan=window.scanUI;
window.scanUI=function(){v6scan();const b=document.querySelector('#sc button[onclick="scanPdf()"]');if(b)b.remove()};
window.pdf=window.scanPdf=()=>toast('Les PDF ne sont plus pris en charge : le cahier garde uniquement le texte');
window.upl=async()=>{};
