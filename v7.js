/* Cahier numérique v7 : preuve de paiement (nom, téléphone, capture) + validation par l'administration.
   À charger APRÈS v6.js. Ne modifie aucune autre fonctionnalité. */

/* ---------- Écran « Paiement en attente » : le bouton ouvre maintenant le formulaire ---------- */
window.v6wait=function(){const s=D.stt=='suspendu';
app.innerHTML=`<div class=top><img class=lg src=icon-192.png alt=""><h1>${s?'Compte suspendu':'Paiement en attente'}</h1></div><div class=f><p>${s?'Votre accès est suspendu. Contactez l’administration.':`Votre compte <b>${esc(D.s.email)}</b> est créé, mais votre cahier s’ouvrira après validation de votre paiement par l’administration.`}</p><div class=card><small>Paiement par Airtel Money ou Illicocash</small><h3>0999983163</h3><small>Indiquez l’adresse e-mail de votre compte avec le paiement.</small></div><button class=p onclick="${s?'v6gate()':'v7pay()'}">${s?'Vérifier mon accès':'J’ai payé · vérifier mon accès'}</button><button onclick="v6out()">Se déconnecter</button></div>`};

/* ---------- Clic sur « J'ai payé » ---------- */
async function v7pay(){
 app.innerHTML='<p class=hint style="padding:60px 0;text-align:center">Vérification…</p>';
 try{await tok();
  const pr=await api('/rest/v1/cn_profils?select=statut'),st=pr[0]&&pr[0].statut;
  if(st=='valide')return v6gate();
  const r=await api('/rest/v1/cn_paiements?select=statut&user_id=eq.'+uidT()+'&order=cree_le.desc&limit=1'),last=r[0];
  if(last&&last.statut=='en_attente')return v7wait();
  if(last&&last.statut=='refuse')return v7form('Votre dernière preuve n’a pas pu être validée. Envoyez une nouvelle capture bien lisible.');
  v7form();
 }catch(e){toast('Connexion impossible, réessayez');v6wait()}}

/* ---------- Formulaire ---------- */
function v7form(msg){
 app.innerHTML=`<div class=top><img class=lg src=icon-192.png alt=""><h1>Preuve de paiement</h1></div><div class=f>
<p>Remplissez ces informations : l’administration vérifiera votre paiement.</p>${msg?`<p class=hint>${esc(msg)}</p>`:''}
<label>Nom complet<input id=v7n autocomplete=name></label>
<label>Numéro de téléphone<input id=v7t type=tel inputmode=tel autocomplete=tel></label>
<label>Capture d’écran de la preuve de paiement<input id=v7f type=file accept="image/*" onchange="v7prev(this)"></label>
<img id=v7p alt="" style="display:none;max-width:100%;border-radius:12px">
<button class=p id=v7s onclick="v7send()">Envoyer ma preuve</button><button onclick="v6wait()">Retour</button></div>`}
function v7prev(i){const f=i.files&&i.files[0],p=$('#v7p');if(!f){p.style.display='none';return}p.src=URL.createObjectURL(f);p.style.display='block'}

/* Réduit la capture (≈ 1600 px, JPEG) pour un envoi rapide, même avec peu de réseau */
const v7shrink=f=>new Promise((ok,ko)=>{const u=URL.createObjectURL(f),im=new Image();
 im.onload=()=>{const k=Math.min(1,1600/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);c.toBlob(b=>{URL.revokeObjectURL(u);b?ok(b):ko()},'image/jpeg',.8)};
 im.onerror=()=>ko();im.src=u});

async function v7send(){
 const n=$('#v7n').value.trim(),t=$('#v7t').value.trim(),f=($('#v7f').files||[])[0];
 if(n.length<3)return toast('Indiquez votre nom complet');
 if(t.replace(/\D/g,'').length<8)return toast('Indiquez un numéro de téléphone valide');
 if(!f)return toast('Ajoutez la capture d’écran de votre paiement');
 const b=$('#v7s');b.disabled=true;b.textContent='Envoi en cours…';
 try{await tok();
  const blob=await v7shrink(f),name=(crypto.randomUUID?crypto.randomUUID():uid()),path=uidT()+'/'+name+'.jpg';
  const r=await fetch(SB+'/storage/v1/object/cn-preuves/'+path,{method:'POST',headers:{...stH(),'Content-Type':'image/jpeg'},body:blob});
  if(!r.ok)throw new Error('upload');
  await api('/rest/v1/cn_paiements',{m:'POST',h:{Prefer:'return=minimal'},b:{email:D.s.email,nom:n,telephone:t,preuve_path:path}});
  v7wait();
 }catch(e){b.disabled=false;b.textContent='Envoyer ma preuve';toast('Envoi impossible : vérifiez votre connexion et réessayez')}}

/* ---------- Message d'attente ---------- */
function v7wait(){
 app.innerHTML=`<div class=top><img class=lg src=icon-192.png alt=""><h1>Preuve envoyée</h1></div><div class=f>
<div class=card><h3>⏳ En attente de confirmation</h3><p style="font:500 16px/1.5 system-ui">Merci ! Votre preuve de paiement a bien été transmise à l’administration. Votre accès s’ouvrira dès qu’elle aura validé votre paiement.</p><small>Compte : ${esc(D.s.email)}</small></div>
<button class=p onclick="v6gate()">Vérifier mon accès</button><button onclick="v7form()">Renvoyer une autre preuve</button><button onclick="v6out()">Se déconnecter</button></div>`}

/* ---------- Administration : preuves reçues ---------- */
window.v6admin=async function(){
 app.innerHTML='<header><button onclick=home()>‹</button><h1>Administration</h1></header><div id=v6a><p class=hint>Chargement…</p></div>';
 try{await tok();
  const [r,pr]=await Promise.all([api('/rest/v1/rpc/cn_admin_liste',{m:'POST',b:{}}),api('/rest/v1/cn_paiements?select=*&order=cree_le.desc').catch(()=>[])]);
  const P={};pr.forEach(x=>{(P[x.user_id]=P[x.user_id]||[]).push(x)});
  const pend=u=>(P[u.user_id]||[]).some(x=>x.statut=='en_attente');
  r.sort((a,b)=>pend(b)-pend(a));
  $('#v6a').innerHTML=r.map(u=>{const L=P[u.user_id]||[],x=L[0];
   const proof=x?`<div class=card style="margin:8px 0;padding:12px"><small>💳 Preuve reçue le ${dt(x.cree_le)} à ${hm(new Date(x.cree_le).getTime())}${x.statut=='refuse'?' · ❌ refusée':x.statut=='valide'?' · ✅ validée':' · ⏳ à vérifier'}</small><p style="font:700 16px/1.4 system-ui;margin:6px 0 0">${esc(x.nom)}</p><p style="font:500 15px/1.4 system-ui;margin:0"><a href="tel:${esc(x.telephone)}">${esc(x.telephone)}</a></p><button class=ch style="margin-top:8px" onclick="v7view('${esc(x.preuve_path)}')">🖼 Voir la capture</button>${L.length>1?`<small style="display:block;margin-top:6px">${L.length} preuves envoyées au total</small>`:''}</div>`:'';
   return `<div class=rs><b>${esc(u.email)}</b><small>${u.statut=='valide'?'✅ Validé':u.statut=='suspendu'?'⛔ Suspendu':'⏳ En attente'} · inscrit le ${dt(u.cree_le)}</small>${proof}<div>${u.statut!='valide'?`<button class=ch onclick="v6set('${u.user_id}','valide')">✅ Valider (paiement reçu)</button>`:''}${x&&x.statut=='en_attente'?`<button class=ch onclick="v7refuse('${u.user_id}')">❌ Refuser la preuve</button>`:''}${u.statut!='suspendu'?`<button class=ch onclick="v6set('${u.user_id}','suspendu')">⛔ Suspendre</button>`:''}</div></div>`}).join('')||'<p class=hint>Aucun compte.</p>';
  setTimeout(()=>v6tour('admin',V6T.admin),500);
 }catch(e){$('#v6a').innerHTML='<p class=hint>Accès refusé ou hors ligne.</p>'}};

/* Valider un compte marque aussi sa preuve comme validée */
window.v6set=async function(id,s){
 try{await api('/rest/v1/rpc/cn_admin_statut',{m:'POST',b:{p_user:id,p_statut:s}});
  if(s=='valide')try{await api('/rest/v1/cn_paiements?user_id=eq.'+id+'&statut=eq.en_attente',{m:'PATCH',h:{Prefer:'return=minimal'},b:{statut:'valide'}})}catch(e){}
  toast('Mis à jour');v6admin()}catch(e){toast('Action impossible')}};

async function v7refuse(id){
 try{await api('/rest/v1/cn_paiements?user_id=eq.'+id+'&statut=eq.en_attente',{m:'PATCH',h:{Prefer:'return=minimal'},b:{statut:'refuse'}});toast('Preuve refusée : la personne pourra en renvoyer une');v6admin()}
 catch(e){toast('Action impossible')}}

async function v7view(path){
 try{await tok();const r=await fetch(SB+'/storage/v1/object/authenticated/cn-preuves/'+path,{headers:stH()});if(!r.ok)throw 0;
  const u=URL.createObjectURL(await r.blob()),o=document.createElement('div');o.id='ak';
  o.innerHTML=`<div class=scb><div class=drh><b>Preuve de paiement</b><button onclick="$('#ak').remove()">✕</button></div><img src="${u}" alt="" style="width:100%;border-radius:12px;margin-top:10px"></div>`;
  document.body.appendChild(o)}catch(e){toast('Image introuvable')}}
