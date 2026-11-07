/* Cahier numérique v10 : (1) texte scanné mis en forme automatiquement, (2) choix de la police,
   (3) suppression d'une page, (4) sauvegarde d'un cahier dans Google Drive (avec choix du dossier).
   À charger APRÈS v9.js. */

/* =====================================================================
   RÉGLAGES GOOGLE DRIVE : à remplir une seule fois (voir les explications données avec ce fichier).
   Tant que ces trois valeurs sont vides, le bouton Google Drive indique « non activé ».
   ===================================================================== */
const V10G={
  clientId:'',   /* ID client OAuth (se termine par .apps.googleusercontent.com) */
  apiKey:'',     /* Clé d'API Google (restreinte à Google Picker API) */
  appId:''       /* Numéro du projet Google Cloud (chiffres) */
};

const V10={view:'s',busy:0,scope:'page',rng:null};

/* =====================================================================
   1. TEXTE SCANNÉ : MISE EN FORME AUTOMATIQUE
   Reconstitue titres, paragraphes (lignes coupées recollées), listes à puces, listes numérotées,
   étiquettes (Définition :, Exemple :…) et corrige les espaces parasites de la reconnaissance.
   ===================================================================== */
const V10_END=/[.!?…]["»”)]?$/;
const V10_UP=/^[A-ZÀ-ÖØ-Þ0-9«"“(]/;
const V10_LOW=/^[a-zà-ÿœ]/;
const V10_BUL=/^\s*(?:[•·▪■□○●◦▸►➢✓*>]|[-–—](?!\d)|[eo«](?=\s+[A-ZÀ-ÖØ-Þ]))\s*(\S.*)$/u;
const V10_NUM=/^\s*\(?(\d{1,2})\s*[.)]\s+(\S.*)$/;
const V10_LET=/^\s*\(?([a-z])\)\s+(\S.*)$/;
const V10_SUB=/^\s*\d{1,2}(?:\.\d{1,2})+\s*[.)\-]?\s+\S/;
const V10_ROM=/^\s*[IVX]{1,5}\s*[.)\-–]\s+\S/;
const V10_H1=/^(chapitre|titre|partie|section|leçon|lecon)\b[^.!?]{0,80}$/i;
const V10_H2=/^(introduction|conclusion|plan|sommaire|objectifs?|résumé|resume|bibliographie)\s*:?\s*$/i;
const V10_LAB=/^((?:définition|definition|exemple|remarque|rappel|attention|important|à retenir|a retenir|propriété|propriete|théorème|theoreme|méthode|methode|conclusion|résumé|resume)s?\s*:)\s*(\S.*)$/i;

function v10norm(t){return String(t||'').replace(/\u00ad/g,'').replace(/[ \t\u00a0]+/g,' ')
 .replace(/ +([,.;])/g,'$1').replace(/(\p{L}) +['’] ?(\p{L})/gu,'$1’$2').replace(/([(\[]) +/g,'$1').replace(/ +([)\]])/g,'$1').trim()}

const v10words=s=>s.split(/\s+/).filter(Boolean).length;
const v10caps=s=>{const L=s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g,'');return L.length>=3&&L.replace(/[^A-ZÀ-ÖØ-Þ]/g,'').length/L.length>=.85};
const v10short=s=>!!s&&s.length<=50&&!/[.!?;,:…]$/.test(s)&&V10_UP.test(s)&&!V10_BUL.test(s)&&!V10_NUM.test(s);

function v10struct(raw){
 const src=String(raw||'').split(/\r?\n/).map(v10norm),
  lens=src.filter(s=>s.length>25).map(s=>s.length).sort((a,b)=>a-b),L=lens.length?lens[lens.length>>1]:60;
 const B=[];let last=null,brk=false,prevLen=0,i=0;
 const push=b=>{B.push(b);last=b;brk=false;return b};
 const nextNon=k=>{for(let j=k+1;j<src.length;j++)if(src[j])return src[j];return null};
 const cont=s=>{if(brk||!last||last.k=='h'||last.k=='lab')return false;
  const e=V10_END.test(last.s),long=prevLen>=.72*L,low=V10_LOW.test(s);
  if(last.k=='p'||last.k=='lt')return e?long:(long||low);
  return e?false:(long||low)};                       /* li, ol */
 const join=(a,s)=>/[A-Za-zÀ-ÿ]-$/.test(a)&&V10_LOW.test(s)?a.slice(0,-1)+s:a+' '+s;

 for(i=0;i<src.length;i++){const s=src[i];
  if(!s){brk=true;continue}
  let m;
  if((m=V10_BUL.exec(s))){push({k:'li',s:m[1]});prevLen=s.length;continue}
  if((m=V10_NUM.exec(s))){push({k:'ol',n:+m[1],s:m[2]});prevLen=s.length;continue}
  if((m=V10_LET.exec(s))){push({k:'lt',s:m[1]+') '+m[2]});prevLen=s.length;continue}
  if(V10_SUB.test(s)||V10_ROM.test(s)||V10_H1.test(s)||V10_H2.test(s)||(s.length<=90&&v10caps(s)&&!V10_END.test(s))){push({k:'h',s});prevLen=s.length;continue}
  if((m=V10_LAB.exec(s))){push({k:'p',s:m[1]+' '+m[2],lab:m[1].length});prevLen=s.length;continue}
  if(s.length<=80&&/:$/.test(s)&&V10_UP.test(s)){push({k:'lab',s});prevLen=s.length;continue}
  /* Ligne courte sans ponctuation : titre, ou série d'éléments de liste */
  const prevEnded=!last||brk||V10_END.test(last.s)||last.k=='h'||last.k=='lab'||last.k=='ol'||last.k=='li';
  if(prevEnded&&v10short(s)&&v10words(s)<=9){
   let run=0;for(let j=i;j<src.length&&v10short(src[j]);j++)run++;
   if(run>=3){const hd=run>=4&&(!last||brk);
    for(let j=0;j<run;j++)push(hd&&!j?{k:'h',s:src[i]}:{k:'li',s:src[i+j]});i+=run-1;prevLen=50;continue}
   const nx=nextNon(i);
   if(!last||nx===null||nx.length>s.length+10||V10_UP.test(nx)||V10_BUL.test(nx)||V10_NUM.test(nx)){push({k:'h',s});prevLen=s.length;continue}
  }
  if(cont(s)){last.s=join(last.s,s)}else push({k:'p',s});
  prevLen=s.length}

 /* Rendu */
 const t=s=>esc(s);let h='';
 for(let k=0;k<B.length;k++){const b=B[k];
  if(b.k=='h')h+='<h3>'+t(b.s)+'</h3>';
  else if(b.k=='lab')h+='<p><b>'+t(b.s)+'</b></p>';
  else if(b.k=='li'){h+='<ul>';while(k<B.length&&B[k].k=='li')h+='<li>'+t(B[k++].s)+'</li>';k--;h+='</ul>'}
  else if(b.k=='ol'){let r=k,n=b.n;while(r+1<B.length&&B[r+1].k=='ol'&&B[r+1].n==n+(r+1-k))r++;
   if(b.n==1){h+='<ol>';for(let j=k;j<=r;j++)h+='<li>'+t(B[j].s)+'</li>';h+='</ol>'}
   else for(let j=k;j<=r;j++)h+='<p>'+(B[j].n)+'. '+t(B[j].s)+'</p>';
   k=r}
  else if(b.lab)h+='<p><b>'+t(b.s.slice(0,b.lab))+'</b>'+t(b.s.slice(b.lab))+'</p>';
  else h+='<p>'+t(b.s)+'</p>'}
 return h||'<p>(Aucun texte reconnu)</p>'}

/* L'aperçu du scan montre le texte structuré (modifiable) ; « Texte brut » reste disponible */
const v10scan0=window.scanUI;
window.scanUI=function(){v10scan0();
 const ta=$('#so');if(!ta||ta.tagName!='TEXTAREA')return;
 const raw=ta.value,bar=`<div style="display:flex;gap:6px;margin-top:6px"><button class="ch${V10.view=='s'?' on':''}" style="margin:0" onclick="V10.view='s';scanUI()">Texte structuré</button><button class="ch${V10.view=='r'?' on':''}" style="margin:0" onclick="V10.view='r';scanUI()">Texte brut</button></div>`;
 if(V10.view=='r'){ta.insertAdjacentHTML('beforebegin',bar);return}
 const d=document.createElement('div');d.id='so';d.contentEditable='true';
 d.style.cssText='min-height:160px;max-height:42vh;overflow:auto;box-sizing:border-box;border-radius:14px;border:1px solid var(--line);background:#fbfbfe;color:#1b1d2e;padding:12px 16px;line-height:1.6;font-size:16px;white-space:normal;word-break:break-word';
 d.innerHTML=v10struct(raw);ta.replaceWith(d);d.insertAdjacentHTML('beforebegin',bar)};

window.scanIns=function(){const so=$('#so');if(!so)return;let h;
 if(so.tagName=='TEXTAREA'){const t=so.value.trim();if(!t||/^\(Aucun texte reconnu\)$/.test(t))return toast('Rien à insérer');
  h=t.split(/\n{2,}/).map(p=>'<div>'+esc(p).replace(/\n/g,'<br>')+'</div>').join('<div><br></div>')}
 else{h=clean(so.innerHTML.replace(/<div(\s[^>]*)?>/gi,'<p>').replace(/<\/div>/gi,'</p>'));
  if(!txt(h)||txt(h)=='(Aucun texte reconnu)')return toast('Rien à insérer')}
 putH(h);$('#sc')&&$('#sc').remove();SC=[];scT='';V9.hint=''};

/* =====================================================================
   2. POLICES
   Sans sélection : toute la page. Avec une sélection : seulement le texte sélectionné.
   ===================================================================== */
const V10F=[['Par défaut',"system-ui, -apple-system, 'Segoe UI', sans-serif"],['Classique',"Georgia, 'Times New Roman', serif"],['Moderne','Arial, Helvetica, sans-serif'],['Lisible','Verdana, Tahoma, sans-serif'],['Élégante',"Palatino, 'Palatino Linotype', 'Book Antiqua', serif"],['Arrondie',"'Trebuchet MS', 'Segoe UI', sans-serif"],['Manuscrite',"'Segoe Print', 'Bradley Hand', 'Comic Sans MS', 'Chalkboard SE', cursive"],['Machine à écrire',"'Courier New', Courier, monospace"]];

function v10fonts(){const e=$('#ed');if(!e||!e.isContentEditable)return toast('Touchez « Corriger » pour modifier la police');
 const has=!!(rg&&!rg.collapsed&&e.contains(rg.commonAncestorContainer));
 V10.rng=has?rg.cloneRange():null;V10.scope=has?'sel':'page';
 const o=document.createElement('div');o.id='ak';o.dataset.v10='f';
 o.innerHTML=`<div class=scb><div class=drh><b>Choisir une police</b><button onclick="$('#ak').remove()">✕</button></div>
<div class=tgl style="padding-bottom:0"><button class="ch" id=v10s1 onclick="v10sc('sel')">Texte sélectionné</button><button class="ch" id=v10s2 onclick="v10sc('page')">Toute la page</button></div>
<div class=f>${V10F.map((f,i)=>`<button onclick="v10setFont(${i})" style="font-family:${esc(f[1])};font-size:18px;text-align:left">${esc(f[0])} · Abc 123</button>`).join('')}</div></div>`;
 document.body.appendChild(o);o.onclick=ev=>{if(ev.target==o)o.remove()};v10sc(V10.scope)}
function v10sc(s){if(s=='sel'&&!V10.rng){toast('Sélectionnez d’abord du texte');s='page'}V10.scope=s;
 const a=$('#v10s1'),b=$('#v10s2');if(a)a.classList.toggle('on',s=='sel');if(b)b.classList.toggle('on',s=='page')}
function v10setFont(i){const e=$('#ed');if(!e||!pg)return;const f=V10F[i],css=f[1];
 try{
  if(V10.scope=='sel'&&V10.rng){e.focus();const s=getSelection();s.removeAllRanges();s.addRange(V10.rng);
   document.execCommand('styleWithCSS',false,true);document.execCommand('fontName',false,css)}
  else{
   e.querySelectorAll(':scope>.v10w').forEach(x=>{while(x.firstChild)x.before(x.firstChild);x.remove()});
   e.querySelectorAll('[style*="font-family"]').forEach(x=>{x.style.fontFamily='';if(!x.getAttribute('style'))x.removeAttribute('style')});
   e.querySelectorAll('font[face]').forEach(x=>x.removeAttribute('face'));
   if(i){const w=document.createElement('div');w.className='v10w';w.style.fontFamily=css;
    while(e.firstChild)w.appendChild(e.firstChild);if(!w.firstChild)w.appendChild(document.createElement('br'));e.appendChild(w);
    e.focus();const r=document.createRange();r.selectNodeContents(w);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r)}}
  pg.html=e.innerHTML;save()}catch(x){toast('Police non appliquée')}
 const o=$('#ak');if(o&&o.dataset.v10=='f')o.remove()}

/* =====================================================================
   3. SUPPRESSION D'UNE PAGE
   La page disparaît de l'appareil et, une fois en ligne, son contenu est effacé du compte
   (elle ne revient donc pas à la prochaine synchronisation).
   ===================================================================== */
function v10delP(id,fromPage){const p=cur&&cur.pages.find(x=>x.id==id);if(!p)return;const n=cur.pages.indexOf(p)+1;
 const nom='« '+esc(p.chap||'Sans chapitre')+(p.sujet?' — '+esc(p.sujet):'')+' »';
 /* 1re confirmation */
 modal(`<b>Supprimer la page ${n} ?</b><p class=hint>${nom} sera supprimée avec ses enregistrements audio et ses notes complémentaires.</p>`,()=>{
  /* 2e confirmation (ouverte une fois la 1re fermée) */
  setTimeout(()=>{
   modal(`<b>⚠️ Dernière confirmation</b><p class=hint>Supprimer définitivement la page ${n} ${nom} ? Cette action est <b>irréversible</b> : la page ne pourra pas être récupérée.</p>`,()=>{v10doDel(id,fromPage)});
   const b2=$('#eo');if(b2)b2.textContent='Oui, supprimer'},0)});
 const b=$('#eo');if(b)b.textContent='Continuer'}

function v10doDel(id,fromPage){const p=cur&&cur.pages.find(x=>x.id==id);if(!p)return;
 try{stopL();if(fromPage){if(mr&&mr.state=='recording')mr.stop();dOn=0;if(sr)sr.stop();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})}}catch(e){}
 (p.att||[]).forEach(x=>{try{if(x.k=='a')fdel(x.id);if(x.k=='p'&&x.up&&D.s)fetch(SB+'/storage/v1/object/cn-files/'+uidT()+'/'+x.id+'.pdf',{method:'DELETE',headers:stH()}).catch(()=>{})}catch(e){}});
 cur.pages=cur.pages.filter(x=>x.id!=id);cur.u=Date.now();cur.d=1;
 D.delp=D.delp||[];if(!D.delp.includes(id))D.delp.push(id);
 pg=null;raw();toast('Page supprimée');openB(cur.id);setTimeout(sync,300)}

async function v10flush(){if(!D.s||!navigator.onLine||!(D.delp||[]).length)return;
 try{await tok()}catch(e){return}
 for(const id of D.delp.slice()){const q='/rest/v1/cn_pages?id=eq.'+encodeURIComponent(id),h={Prefer:'return=minimal'};
  try{try{await api(q,{m:'PATCH',h,b:{tags:'__del',html:'',chap:'',sujet:'',att:[],cpl:[],updated_at:Date.now()}})}
   catch(e){await api(q,{m:'PATCH',h,b:{tags:'__del',html:'',updated_at:Date.now()}})}
   D.delp=D.delp.filter(x=>x!=id);raw()}catch(e){}}}
function v10purge(){let n=0;const S=new Set(D.delp||[]);
 D.c.forEach(c=>{const k=c.pages.length;c.pages=c.pages.filter(p=>!(S.has(p.id)||(p.tags||[]).includes('__del')));n+=k-c.pages.length});
 if(n)raw();return n}
const v10prevSync=window.sync;
window.sync=async function(){try{await v10flush()}catch(e){}await v10prevSync();if(v10purge()&&$('.shelf')&&$('#q')&&!$('#q').value)home()};

/* Boutons : liste des pages du cahier + barre d'outils de la page */
const v10openB=window.openB;
window.openB=function(){const r=v10openB.apply(this,arguments);
 try{const f=document.querySelector('.f');if(f&&!$('#v10gd'))f.insertAdjacentHTML('beforeend','<button id=v10gd onclick="v10drive()">☁️ Sauvegarder dans Google Drive</button>')}catch(e){}
 return r};
const v10draw=window.draw;
window.draw=function(a,b){v10draw(a,b);const tb=$('.tb');
 if(tb)tb.insertAdjacentHTML('afterbegin',(a?P('v10fonts()','🔤 Police'):'')+P('v10delP(pg.id,1)','🗑 Supprimer la page'))};

/* =====================================================================
   4. GOOGLE DRIVE : connexion (⋯ Paramètres) puis « Sauvegarder dans Google Drive » dans chaque cahier.
   Droit demandé : drive.file (l'application ne voit que les fichiers qu'elle crée et le dossier que l'utilisateur choisit).
   Fichiers créés : un Google Doc lisible + une sauvegarde .json pour restaurer dans l'application.
   ===================================================================== */
const v10conf=()=>!!(V10G.clientId&&V10G.apiKey&&V10G.appId);
const v10me=()=>{try{return uidT()}catch(e){return 'local'}};
const v10get=()=>((D.gd=D.gd||{})[v10me()]||{});
const v10set=o=>{D.gd=D.gd||{};D.gd[v10me()]=Object.assign(v10get(),o);raw()};
const V10P={};
const v10load=src=>V10P[src]||(V10P[src]=new Promise((r,j)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=r;s.onerror=()=>{delete V10P[src];s.remove();j(new Error('load'))};document.head.appendChild(s)}));
const V10GSI='https://accounts.google.com/gsi/client',V10GAPI='https://apis.google.com/js/api.js';
if(v10conf())setTimeout(()=>{v10load(V10GSI).catch(()=>{});v10load(V10GAPI).catch(()=>{})},2500);

let v10tok=null,v10exp=0;
async function v10token(mode){if(v10tok&&Date.now()<v10exp)return v10tok;
 await v10load(V10GSI);
 return new Promise((res,rej)=>{
  const tc=google.accounts.oauth2.initTokenClient({client_id:V10G.clientId,scope:'https://www.googleapis.com/auth/drive.file',
   callback:r=>{if(r.error)return rej(new Error(r.error));v10tok=r.access_token;v10exp=Date.now()+((+r.expires_in||3600)-60)*1000;res(v10tok)},
   error_callback:e=>rej(new Error((e&&e.type)||'popup'))});
  tc.requestAccessToken(mode?{prompt:mode}:{})})}
const v10g=async(p,o)=>{const r=await fetch('https://www.googleapis.com'+p,Object.assign({headers:{Authorization:'Bearer '+v10tok}},o||{}));if(!r.ok){const e=new Error('drive '+r.status);e.status=r.status;throw e}return r.json()};
const v10off=()=>toast('Google Drive n’est pas encore activé dans cette application');

/* Paramètres : bloc Google Drive */
const v10menu0=window.menu;
window.menu=function(){v10menu0();const b=document.querySelector('button[onclick="th()"]');if(!b)return;const g=v10get();
 b.insertAdjacentHTML('beforebegin',`<div class=rs style="cursor:default"><b>☁️ Google Drive</b>${
  !v10conf()?'<small>Non activé dans cette application.</small>'
  :g.on?`<small>✅ Connecté${g.email?' : '+esc(g.email):''}. Dans un cahier, touchez « Sauvegarder dans Google Drive » pour choisir le dossier.</small><span><button class=ch onclick="v10disc()">Déconnecter Google Drive</button></span>`
  :'<small>Connectez votre compte pour sauvegarder vos cahiers dans le dossier de votre choix.</small><span><button class=ch onclick="v10connect()">Connecter mon Google Drive</button></span>'}</div>`)};
async function v10connect(){if(!v10conf())return v10off();
 try{await v10token('select_account');let email='';try{email=((await v10g('/drive/v3/about?fields=user(emailAddress)')).user||{}).emailAddress||''}catch(e){}
  v10set({on:1,email});toast('Google Drive connecté');menu()}
 catch(e){toast('Connexion Google annulée ou impossible')}}
function v10disc(){try{if(v10tok)google.accounts.oauth2.revoke(v10tok,()=>{})}catch(e){}v10tok=null;v10exp=0;v10set({on:0,email:''});toast('Google Drive déconnecté');menu()}

/* Sauvegarde d'un cahier */
async function v10drive(){if(!cur||V10.busy)return;
 if(!v10conf())return v10off();
 if(!v10get().on){toast('Connectez d’abord Google Drive (⋯ Paramètres)');return menu()}
 V10.busy=1;
 try{const t=await v10token('');
  await v10load(V10GAPI);await new Promise(r=>gapi.load('picker',r));
  const f=await v10where(t);if(!f)return;
  toast('Envoi vers Google Drive…');
  const r=await v10save(f);v10done(f,r)}
 catch(e){const s=e&&e.status;
  if(s==401){v10tok=null;toast('Session Google expirée : touchez de nouveau « Sauvegarder dans Google Drive »')}
  else if(s==403||s==404)toast('Accès refusé par Google Drive : choisissez de nouveau le dossier')
  else if(e&&/popup|access_denied|immediate_failed/.test(e.message))toast('Connexion Google annulée')
  else toast('Sauvegarde Google Drive impossible (connexion ?)')}
 finally{V10.busy=0}}

/* Menu de choix : dossier (sélecteur Google) ou racine de Mon Drive */
function v10where(t){return new Promise(res=>{const o=document.createElement('div');o.id='ak';
 o.innerHTML=`<div class=scb><b>Sauvegarder « ${esc(cur.cours)} » dans Google Drive</b><p class=hint>${cur.pages.length} page(s). Un Google Doc lisible et un fichier de sauvegarde seront enregistrés dans le dossier choisi.</p><div class=f><button class=p id=v10a>📁 Choisir un dossier…</button><button id=v10b>Mon Drive (à la racine)</button><button id=v10c>Annuler</button></div></div>`;
 document.body.appendChild(o);
 $('#v10c').onclick=()=>{o.remove();res(null)};
 $('#v10b').onclick=()=>{o.remove();res({id:'',name:'Mon Drive'})};
 $('#v10a').onclick=()=>{o.remove();const P=google.picker,
   v=new P.DocsView(P.ViewId.FOLDERS).setSelectFolderEnabled(true).setIncludeFolders(true).setMimeTypes('application/vnd.google-apps.folder');
  new P.PickerBuilder().setAppId(V10G.appId).setOAuthToken(t).setDeveloperKey(V10G.apiKey).setLocale('fr').setTitle('Choisir un dossier Google Drive').addView(v)
   .setCallback(d=>{if(d.action==P.Action.PICKED){const x=d.docs[0];res({id:x.id,name:x.name})}else if(d.action==P.Action.CANCEL)res(null)}).build().setVisible(true)}})}

/* Contenu lisible du cahier (images remplacées par une mention, polices et couleurs conservées) */
function v10strip(h){const d=new DOMParser().parseFromString('<body>'+(h||'')+'</body>','text/html');
 d.body.querySelectorAll('script,style,iframe,object,embed,audio,video,canvas').forEach(e=>e.remove());
 d.body.querySelectorAll('img').forEach(i=>i.replaceWith('[image]'));
 d.body.querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable'));
 return d.body.innerHTML}
function v10html(c){let h=`<html><head><meta charset="utf-8"><title>${esc(c.cours)}</title></head><body><h1>${esc(c.cours)}</h1><p>Professeur : ${esc(c.prof||'—')} · Sauvegardé le ${dt(Date.now())}</p>`;
 c.pages.forEach((p,i)=>{h+=`<h2>Page ${i+1} · ${esc(p.chap||'Sans chapitre')}${p.sujet?' — '+esc(p.sujet):''}</h2><p><i>${dt(p.start)}, ${hm(p.start)}–${hm(p.end)}</i></p>`+v10strip(p.html);
  (p.cpl||[]).forEach(x=>{h+=`<h3>Complément : ${esc(x.t)}</h3>`+v10strip(x.h)})});
 return h+'</body></html>'}

async function v10put(o){const b='cn'+Date.now(),meta=JSON.stringify(o.id?{name:o.name}:{name:o.name,mimeType:o.mime,parents:o.parent?[o.parent]:undefined}),
  body=`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${o.type}\r\n\r\n${o.data}\r\n--${b}--`,
  r=await fetch('https://www.googleapis.com/upload/drive/v3/files'+(o.id?'/'+o.id:'')+'?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
   {method:o.id?'PATCH':'POST',headers:{Authorization:'Bearer '+v10tok,'Content-Type':'multipart/related; boundary='+b},body});
 if(!r.ok){const e=new Error('drive '+r.status);e.status=r.status;throw e}return r.json()}
async function v10up(o){try{return await v10put(o)}catch(e){if(o.id&&[400,403,404].includes(e.status))return v10put(Object.assign({},o,{id:''}));throw e}}

async function v10save(f){const key=f.id||'root',me=v10me(),st=v10get();
 const map=((st.map=st.map||{})[cur.id]=st.map[cur.id]||{}),ex=map[key]||{},nm=cur.cours.replace(/[\\/:*?"<>|]/g,' ').trim()||'Cahier';
 const doc=await v10up({id:ex.doc,name:'Cahier – '+nm,mime:'application/vnd.google-apps.document',parent:f.id,type:'text/html; charset=UTF-8',data:v10html(cur)});
 const js=await v10up({id:ex.json,name:'Cahier – '+nm+' (sauvegarde).json',mime:'application/json',parent:f.id,type:'application/json; charset=UTF-8',data:JSON.stringify({v:1,c:[cur]})});
 map[key]={doc:doc.id,json:js.id};v10set({map:st.map});return doc}

function v10done(f,doc){const o=document.createElement('div');o.id='ak';
 o.innerHTML=`<div class=scb><b>✅ Cahier sauvegardé dans Google Drive</b><p class=hint>Dossier : ${esc(f.name)}. Le Google Doc se met à jour à chaque sauvegarde dans le même dossier.</p><div class=f>${doc.webViewLink?`<button class=p onclick="window.open('${esc(doc.webViewLink)}','_blank')">Ouvrir le document</button>`:''}<button onclick="$('#ak').remove()">Fermer</button></div></div>`;
 document.body.appendChild(o)}

/* La déconnexion de l'application coupe aussi la session Google en mémoire */
if(typeof window.v6out=='function'){const v10o=window.v6out;window.v6out=function(){v10tok=null;v10exp=0;return v10o.apply(this,arguments)};window.out=window.v6out}
