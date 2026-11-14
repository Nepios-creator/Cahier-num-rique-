/* Cahier numérique v11 :
   1) paiement « J'ai payé du cash » (nom + numéro, sans capture, confirmation par l'administration)
   2) enregistrement audio en très bonne qualité + chronomètre visible
   3) transcription complète d'un audio + résumé fidèle (fonction cn-transcrire)
   4) envoi de notes, leçons, audios et PDF à une autre personne
   Chargé par v9.js, exécuté après v10.js. Ne modifie aucune autre fonctionnalité. */
const V11={job:{},stop:0,lock:0};
const v11safe=s=>String(s||'fichier').replace(/[\\/:*?"<>|]/g,' ').replace(/\s+/g,' ').trim().slice(0,60)||'fichier';
function v11box(h){v11close();const o=document.createElement('div');o.id='v11o';o.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;z-index:260;background:#000a;display:flex';o.innerHTML='<div class=scb>'+h+'</div>';o.onclick=e=>{if(e.target==o&&!V11.lock)o.remove()};document.body.appendChild(o);return o}
function v11close(){const o=$('#v11o');if(o)o.remove()}

/* =============== 1) Paiement en cash =============== */
function v11cash(msg){
 app.innerHTML=`<div class=top><img class=lg src=icon-192.png alt=""><h1>Paiement en cash</h1></div><div class=f>
<p>Vous avez remis l’argent en main propre ? Indiquez votre nom et votre numéro : l’administration confirmera votre paiement. Aucune capture d’écran n’est nécessaire.</p>${msg?`<p class=hint>${esc(msg)}</p>`:''}
<label>Nom complet<input id=v11n autocomplete=name></label>
<label>Numéro de téléphone<input id=v11t type=tel inputmode=tel autocomplete=tel></label>
<button class=p id=v11s onclick="v11cashSend()">Envoyer ma déclaration</button><button onclick="v6wait()">Retour</button></div>`}
async function v11cashSend(){
 const n=$('#v11n').value.trim(),t=$('#v11t').value.trim();
 if(n.length<3)return toast('Indiquez votre nom complet');
 if(t.replace(/\D/g,'').length<8)return toast('Indiquez un numéro de téléphone valide');
 const b=$('#v11s');b.disabled=true;b.textContent='Envoi en cours…';
 try{await tok();await api('/rest/v1/cn_paiements',{m:'POST',h:{Prefer:'return=minimal'},b:{email:D.s.email,nom:n,telephone:t,preuve_path:'cash'}});v7wait(true)}
 catch(e){b.disabled=false;b.textContent='Envoyer ma déclaration';toast('Envoi impossible : vérifiez votre connexion et réessayez')}}

/* =============== 2) Audio haute qualité + chronomètre =============== */
function v11fmt(s){const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60,p=n=>String(n).padStart(2,'0');return h?h+':'+p(m)+':'+p(x):p(m)+':'+p(x)}
function v11tStop(){if(V11.ti){clearInterval(V11.ti);V11.ti=0}const e=$('#v11t0');if(e)e.remove()}
function v11tStart(){v11tStop();const t0=Date.now(),el=document.createElement('div');el.id='v11t0';
 el.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:calc(8px + env(safe-area-inset-top,0px));z-index:120;background:#dc2626;color:#fff;border-radius:999px;padding:8px 18px;font:800 20px/1 system-ui;font-variant-numeric:tabular-nums;box-shadow:0 6px 20px #0006;pointer-events:none;display:flex;align-items:center;gap:8px';
 document.body.appendChild(el);let last=-1;
 const tick=()=>{const s=Math.floor((Date.now()-t0)/1000);if(s===last)return;last=s;const f=v11fmt(s);
  el.innerHTML='<span style="width:10px;height:10px;border-radius:50%;background:#fff;animation:v11b 1s infinite"></span>'+f;
  const r=$('#rc');if(r)r.textContent='⏺ '+f+' · Stop'};
 tick();V11.ti=setInterval(tick,250)}

/* =============== 3) Transcription + résumé =============== */
function v11fa(id){for(const c of D.c){if(c.del)continue;for(const p of c.pages)for(const x of(p.att||[]))if(x.id==id&&x.k=='a')return{c,p,x}}return null}
const v11ext=t=>/mp4|aac|m4a/.test(t)?'m4a':/ogg/.test(t)?'ogg':/wav/.test(t)?'wav':'webm';
const v11err=e=>({no_key:'La transcription n’est pas encore activée côté serveur.',non_valide:'Votre compte n’est pas encore activé.',non_connecte:'Reconnectez-vous puis réessayez.',fichier_trop_gros:'Fichier trop gros pour l’envoi.',texte_trop_court:'Texte trop court pour être résumé.'}[e]||('Échec : '+e));
async function v11fn(body,form){await tok();const h={...stH()};let b=body;if(!form){h['Content-Type']='application/json';b=JSON.stringify(body)}
 const r=await fetch(SB+'/functions/v1/cn-transcrire',{method:'POST',headers:h,body:b});let j={};try{j=await r.json()}catch(e){}if(!r.ok&&!j.error)j.error='erreur '+r.status;return j}

/* Coupe un long enregistrement en parties de taille raisonnable (le fichier original n'est pas modifié) */
async function v11cl(blob){const S=4*1048576,out=[];
 for(let off=0;off<blob.size;off+=S){const b=new Uint8Array(await blob.slice(off,Math.min(blob.size,off+S+16)).arrayBuffer()),m=Math.min(S,b.length-4);
  for(let i=0;i<m;i++){if(b[i]!=0x1F||b[i+1]!=0x43||b[i+2]!=0xB6||b[i+3]!=0x75)continue;
   const f=b[i+4];if(!f)continue;let L=1;while(!(f&(0x80>>(L-1)))&&L<8)L++;if(b[i+4+L]==0xE7)out.push(off+i)}}
 return out}
function v11wav(f,sr){const n=f.length,b=new ArrayBuffer(44+n*2),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
 w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);
 for(let i=0;i<n;i++){const s=Math.max(-1,Math.min(1,f[i]));v.setInt16(44+i*2,s<0?s*32768:s*32767,true)}
 return new Blob([b],{type:'audio/wav'})}
async function v11dec(blob){const AC=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!AC)throw new Error('Cet appareil ne peut pas préparer cet audio');
 let ab;try{ab=await new AC(1,16000,16000).decodeAudioData(await blob.arrayBuffer())}catch(e){throw new Error('Audio trop long ou illisible sur cet appareil')}
 const sr=ab.sampleRate,K=480*sr,P=[],ch=[];for(let c=0;c<ab.numberOfChannels;c++)ch.push(ab.getChannelData(c));
 for(let a=0;a<ab.length;a+=K){const e=Math.min(ab.length,a+K),f=new Float32Array(e-a);for(let i=a;i<e;i++){let s=0;for(let c=0;c<ch.length;c++)s+=ch[c][i];f[i-a]=s/ch.length}P.push(v11wav(f,sr))}
 return P}
async function v11split(blob){const LIM=20*1048576;if(blob.size<=LIM)return[blob];
 if(/webm/.test(blob.type)){try{const cl=await v11cl(blob);if(cl.length>1){const head=blob.slice(0,cl[0]),P=[];let a=cl[0];
  for(let i=1;i<=cl.length;i++){const e=i<cl.length?cl[i]:blob.size;if(i==cl.length||(e-a>=12*1048576&&blob.size-e>=614400)){P.push(new Blob([head,blob.slice(a,e)],{type:blob.type}));a=e}}
  if(P.every(p=>p.size<=LIM))return P}}catch(e){}}
 return v11dec(blob)}
function v11para(t){t=String(t||'').replace(/\s+/g,' ').trim();const S=t.match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g)||[t],P=[];let c='',n=0;
 S.forEach(s=>{c+=s;n++;if(n>=5||c.length>600){P.push(c.trim());c='';n=0}});if(c.trim())P.push(c.trim());return P.join('\n\n')}

async function v11tr(id){const f=v11fa(id);if(!f)return;
 if(f.x.st=='rec')return toast('Terminez d’abord l’enregistrement');
 if(f.x.tr){let t=null;try{t=await fget('tr:'+id)}catch(e){}if(t)return v11view(id)}
 if(!D.s)return toast('Connectez-vous pour transcrire');
 let blob=null;try{blob=await fget(id)}catch(e){}
 if(!blob)return toast('Cet audio n’est pas sur cet appareil');
 const J=V11.job[id]=V11.job[id]||{texts:[],i:0,pieces:null};V11.stop=0;V11.lock=1;
 v11box(`<div class=drh><b>📝 Transcription</b></div><p class=hint id=v11p>Préparation…</p><div style="height:10px;background:var(--line);border-radius:6px;overflow:hidden"><div id=v11b style="height:100%;width:0;background:var(--acc)"></div></div><p class=hint>Gardez l’application ouverte jusqu’à la fin.</p><div class=f><button onclick="V11.stop=1">Arrêter</button></div>`);
 const set=(m,k)=>{const p=$('#v11p'),b=$('#v11b');if(p)p.textContent=m;if(b)b.style.width=k+'%'};
 try{
  if(!J.pieces){set('Préparation de l’audio…',0);J.pieces=await v11split(blob)}
  while(J.i<J.pieces.length){
   if(V11.stop){V11.lock=0;v11close();toast('Transcription arrêtée : vous pourrez la reprendre');return}
   const n=J.pieces.length,p=J.pieces[J.i];set('Partie '+(J.i+1)+' sur '+n+'…',Math.round(100*J.i/n));
   const fd=new FormData();fd.append('file',p,'audio-'+(J.i+1)+'.'+v11ext(p.type||''));fd.append('lang','fr');
   const j=await v11fn(fd,1);
   if(j.error){if(!J.dec&&/Mistral 4(00|15|22)/.test(j.error)&&!/wav/.test(p.type||'')){J.dec=1;set('Conversion de l’audio…',0);J.pieces=await v11dec(blob);J.texts=[];J.i=0;continue}
    throw new Error(v11err(j.error))}
   J.texts.push(j.text||'');J.i++}
  const text=v11para(J.texts.join(' '));if(!text.trim())throw new Error('Aucune parole reconnue dans cet audio');
  await fput('tr:'+id,text);f.x.tr=1;raw();delete V11.job[id];V11.lock=0;v11view(id)
 }catch(e){V11.lock=0;
  v11box(`<div class=drh><b>📝 Transcription</b><button onclick="v11close()">✕</button></div><p class=hint>${esc(String(e&&e.message||e))}</p><p class=hint>Ce qui est déjà transcrit est conservé : « Réessayer » reprend là où l’opération s’est arrêtée.</p><div class=f><button class=p onclick="v11tr('${id}')">Réessayer</button><button onclick="v11close()">Fermer</button></div>`)}}

async function v11view(id,tab){const f=v11fa(id);if(!f)return;tab=tab||'t';
 let tr='',rs='';try{tr=await fget('tr:'+id)||'';rs=await fget('rs:'+id)||''}catch(e){}
 const card='class=card style="font-size:15px;line-height:1.7"';
 const body=tab=='r'?(rs?`<div ${card}>${clean(rs)}</div>`:`<p class=hint>Pas encore de résumé.</p><div class=f><button class=p onclick="v11res('${id}')">✨ Générer le résumé fidèle</button></div>`)
  :`<div ${card.slice(0,-1)};white-space:pre-wrap;max-height:48vh;overflow:auto">${esc(tr)}</div>`;
 v11box(`<div class=drh><b>📝 ${esc(f.x.n||'Enregistrement')}</b><button onclick="v11close()">✕</button></div>
<div style="display:flex;gap:8px;margin:10px 0"><button class="${tab=='t'?'p':''}" style="flex:1" onclick="v11view('${id}','t')">Transcription</button><button class="${tab=='r'?'p':''}" style="flex:1" onclick="v11view('${id}','r')">Résumé</button></div>
<div id=v11c>${body}</div>
<div class=f><button onclick="v11copy('${id}','${tab}')">📋 Copier</button><button onclick="v11note('${id}','${tab}')">💾 Enregistrer dans Notes complémentaires</button><button onclick="v11del('${id}')">🗑 Effacer la transcription</button></div>`)}
async function v11txt(id,tab){const f=v11fa(id),n=(f&&f.x.n)||'Enregistrement';
 if(tab=='r'){const r=await fget('rs:'+id);return{title:'Résumé : '+n,text:v11plain(r||''),html:clean(r||'')}}
 const t=await fget('tr:'+id)||'';return{title:'Transcription : '+n,text:t,html:t.split(/\n{2,}/).map(p=>'<p>'+esc(p).replace(/\n/g,'<br>')+'</p>').join('')}}
function v11plain(h){const d=document.createElement('div');d.innerHTML=clean(h||'');d.querySelectorAll('br').forEach(b=>b.replaceWith('\n'));d.querySelectorAll('li').forEach(l=>l.prepend('• '));d.querySelectorAll('h3,h4,p,li,ul,ol').forEach(e=>{e.prepend('\n');e.append('\n')});
 return(d.textContent||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim()}
async function v11copy(id,tab){const x=await v11txt(id,tab);if(!x.text)return toast('Rien à copier');try{await navigator.clipboard.writeText(x.text);toast('Texte copié')}catch(e){prompt('Copiez ce texte :',x.text)}}
async function v11sharet(id,tab){const x=await v11txt(id,tab);if(!x.text)return toast('Rien à envoyer');
 try{if(navigator.share){await navigator.share({title:x.title,text:x.text});return}}catch(e){if(e&&e.name=='AbortError')return}
 v11copy(id,tab)}
async function v11note(id,tab){const f=v11fa(id);if(!f)return;const x=await v11txt(id,tab);if(!x.text)return toast('Rien à enregistrer');
 const p=f.p;p.cpl=p.cpl||[];if(p.cpl.some(a=>a.h==x.html))return toast('Déjà enregistré');
 p.cpl.push({id:uid(),t:x.title.slice(0,80),h:x.html,k:'ia',d:Date.now()});const n=Date.now();p.u=n;p.d=1;f.c.u=n;f.c.d=1;raw();
 try{if(typeof cpr=='function'&&pg===p)cpr()}catch(e){}setTimeout(()=>{try{sync()}catch(e){}},800);toast('Enregistré dans Notes complémentaires')}
async function v11del(id){if(!confirm('Effacer la transcription et le résumé de cet audio ?'))return;
 try{await v8rm('tr:'+id);await v8rm('rs:'+id)}catch(e){}const f=v11fa(id);if(f){delete f.x.tr;raw()}v11close();toast('Transcription effacée')}
async function v11res(id){const f=v11fa(id);let t='';try{t=await fget('tr:'+id)||''}catch(e){}if(!t)return;
 const c=$('#v11c');if(c)c.innerHTML='<p class=hint>Résumé en cours… (jusqu’à 1 minute)</p>';
 try{const j=await v11fn({mode:'resume',texte:t,titre:(f&&f.x.n)||''});if(j.error)throw new Error(v11err(j.error));await fput('rs:'+id,clean(j.html||''));v11view(id,'r')}
 catch(e){const c2=$('#v11c');if(c2)c2.innerHTML='<p class=hint>'+esc(String(e&&e.message||e))+'</p><div class=f><button class=p onclick="v11res(\''+id+'\')">Réessayer</button></div>'}}

/* =============== 4) Envoi à une autre personne =============== */
function v11items(){const o={n:[],l:[],a:[],d:[]};
 cur.pages.forEach((p,i)=>{(p.cpl||[]).forEach(x=>(x.k=='lecon'?o.l:o.n).push({id:x.id,t:x.t||'Sans titre',h:x.h,ch:p.chap||'',pi:i+1}));
  (p.att||[]).forEach(x=>{if(x.k=='a'&&x.st!='rec')o.a.push({id:x.id,t:x.n||'Enregistrement',pi:i+1})})});
 (cur.docs||[]).forEach(d=>o.d.push({id:d.id,t:d.n,ty:d.t}));return o}
function v11send(pre){if(!cur)return;const o=V11.it=v11items();
 const grp=(t,k,L,lab)=>L.length?`<div style="margin:14px 0 4px"><b style="font-size:16px">${t}</b></div>`+L.map(x=>`<label style="display:flex;gap:10px;align-items:center;margin:6px 0"><input type=checkbox style="width:22px;height:22px;flex:none" data-k="${k}:${x.id}"${pre==k+':'+x.id?' checked':''}><span style="flex:1;min-width:0">${esc(x.t)} <small class=hint>${lab(x)}</small></span></label>`).join(''):'';
 const L=grp('📝 Notes complétées','n',o.n,x=>'page '+x.pi)+grp('📘 Leçons complétées','l',o.l,x=>'page '+x.pi)+grp('🎙 Audios','a',o.a,x=>'page '+x.pi)+grp('📕 PDF et Word','d',o.d,x=>x.ty=='pdf'?'PDF':'Word');
 v11box(`<div class=drh><b>📤 Envoyer à une autre personne</b><button onclick="v11close()">✕</button></div>${L?`<p class=hint>Cochez ce que vous voulez envoyer.</p>${L}<div class=f style="margin-top:14px"><label>Destinataire : un collègue qui utilise l’application (notes et leçons seulement)<input id=v11e type=email placeholder="e-mail du collègue" autocomplete=off></label><button onclick="v11mail()">📥 Envoyer dans l’application</button></div>`:'<p class=hint>Rien à envoyer pour l’instant : ce cahier ne contient encore ni notes complémentaires, ni leçons, ni audios, ni documents.</p>'}`)}
const v11sel=()=>[...document.querySelectorAll('#v11o input[data-k]:checked')].map(i=>i.dataset.k);
function v11dl(F){F.forEach((f,i)=>setTimeout(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name.replace(/\.weba$/,'.webm');document.body.appendChild(a);a.click();a.remove()},i*700));toast('Fichiers enregistrés : envoyez-les depuis votre téléphone')}
async function v11share(){const S=v11sel();if(!S.length)return toast('Cochez au moins un élément');const o=V11.it,F=[],T=[];
 try{for(const k of S){const t=k[0],id=k.slice(2);
  if(t=='n'||t=='l'){const x=(t=='n'?o.n:o.l).find(a=>a.id==id);if(x)T.push((t=='l'?'LEÇON : ':'NOTE : ')+x.t+'\n\n'+v11plain(x.h))}
  else if(t=='a'){const b=await fget(id),x=o.a.find(a=>a.id==id);if(b&&x){const e=v11ext(b.type||'');F.push(new File([b],v11safe(x.t)+'.'+(e=='webm'?'weba':e),{type:b.type||'audio/webm'}))}}
  else{const d=(cur.docs||[]).find(a=>a.id==id),b=await fget('doc:'+id);if(d&&b){const pdf=d.t=='pdf';F.push(new File([b],v11safe(d.n)+(pdf?'.pdf':'.docx'),{type:pdf?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}))}}}
  const title=cur.cours,text=T.join('\n\n————————\n\n');
  if(!F.length&&!T.length)return toast('Rien à envoyer (fichier absent de cet appareil ?)');
  if(F.length){if(T.length)F.push(new File([text],'Notes et leçons - '+v11safe(cur.cours)+'.txt',{type:'text/plain'}));
   if(navigator.canShare&&navigator.canShare({files:F}))await navigator.share({files:F,title});else v11dl(F);return}
  if(navigator.share)await navigator.share({title,text});else{try{await navigator.clipboard.writeText(text);toast('Texte copié : collez-le dans votre message')}catch(e){prompt('Copiez ce texte :',text)}}
 }catch(e){if(e&&e.name=='AbortError')return;toast(e&&e.name=='NotAllowedError'?'Touchez de nouveau « Partager »':'Partage impossible sur cet appareil')}}
async function v11mail(){const S=v11sel().filter(k=>k[0]=='n'||k[0]=='l'),to=(($('#v11e')||{}).value||'').trim().toLowerCase(),o=V11.it;
 if(!S.length)return toast('Cochez au moins une note ou une leçon (les audios et PDF passent par « Partager »)');
 if(!/^\S+@\S+\.\S+$/.test(to))return toast('E-mail invalide');
 if(!D.s)return toast('Connectez-vous d’abord');if(to==D.s.email.toLowerCase())return toast('C’est votre propre adresse');
 let n=0;try{await tok();
  for(const k of S){const x=(k[0]=='n'?o.n:o.l).find(a=>a.id==k.slice(2));if(!x)continue;
   await api('/rest/v1/cn_partages',{m:'POST',h:{Prefer:'return=minimal'},b:{vers_email:to,titre:(k[0]=='l'?'Leçon : ':'Note : ')+x.t+' · '+cur.cours,chap:x.ch,sujet:x.t,html:clean(x.h||'').slice(0,150000)}});n++}
  toast(n+' élément(s) envoyé(s) à '+to);v11close()}
 catch(e){toast(e&&e.message=='limite_envois'?'Limite d’envois atteinte pour aujourd’hui':'Envoi impossible (hors ligne ou compte non validé)'+(n?' · '+n+' déjà envoyé(s)':''))}}

/* =============== Branchements (après v10) =============== */
function v11boot(n){n=n||0;if(typeof window.v10fonts!=='function'&&n<120)return setTimeout(()=>v11boot(n+1),50);
 /* style du chronomètre */
 const st=document.createElement('style');st.textContent='@keyframes v11b{50%{opacity:.25}}';document.head.appendChild(st);

 /* --- 2) micro en haute qualité + enregistreur à haut débit --- */
 try{const md=navigator.mediaDevices;if(md&&md.getUserMedia){const g=md.getUserMedia.bind(md);
  md.getUserMedia=function(c){if(c&&c.audio===true){
    const hq={audio:{channelCount:{ideal:1},sampleRate:{ideal:48000},sampleSize:{ideal:16},echoCancellation:{ideal:false},noiseSuppression:{ideal:false},autoGainControl:{ideal:true}}};
    return g(Object.assign({},c,hq)).catch(()=>g(c))}return g(c)}}}catch(e){}
 try{const M0=window.MediaRecorder;if(M0){
  const pick=()=>['audio/webm;codecs=opus','audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/ogg;codecs=opus','audio/webm'].find(t=>{try{return M0.isTypeSupported(t)}catch(e){return false}})||'';
  class MR extends M0{constructor(s,o){const b=Object.assign({},o||{});if(!b.mimeType){const m=pick();if(m)b.mimeType=m}if(!b.audioBitsPerSecond)b.audioBitsPerSecond=128000;
   try{super(s,b)}catch(e){super(s)}
   this.addEventListener('start',v11tStart);this.addEventListener('stop',v11tStop);this.addEventListener('error',v11tStop)}}
  window.MediaRecorder=MR}}catch(e){}

 /* --- 1) option cash --- */
 const w0=window.v6wait;
 window.v6wait=function(){w0.apply(this,arguments);if(D.stt=='suspendu')return;
  const out=[...document.querySelectorAll('.f > button')].find(b=>/v6out/.test(b.getAttribute('onclick')||''));
  if(out)out.insertAdjacentHTML('beforebegin','<button onclick="v11cash()">💵 J’ai payé du cash</button>')};
 const f0=window.v7form;
 window.v7form=function(){f0.apply(this,arguments);
  const b=[...document.querySelectorAll('.f > button')].find(x=>/v6wait/.test(x.getAttribute('onclick')||''));
  if(b)b.insertAdjacentHTML('beforebegin','<button onclick="v11cash()">💵 J’ai payé du cash (sans capture)</button>')};
 const wt0=window.v7wait;
 window.v7wait=function(cash){if(!cash)return wt0.apply(this,arguments);
  app.innerHTML=`<div class=top><img class=lg src=icon-192.png alt=""><h1>Déclaration envoyée</h1></div><div class=f>
<div class=card><h3>⏳ En attente de confirmation</h3><p style="font:500 16px/1.5 system-ui">Merci ! Votre paiement en cash a été déclaré à l’administration. Votre accès s’ouvrira dès qu’elle l’aura confirmé.</p><small>Compte : ${esc(D.s.email)}</small></div>
<button class=p onclick="v6gate()">Vérifier mon accès</button><button onclick="v7form()">Envoyer plutôt une capture de paiement</button><button onclick="v6out()">Se déconnecter</button></div>`};
 window.v7pay=async function(){
  app.innerHTML='<p class=hint style="padding:60px 0;text-align:center">Vérification…</p>';
  try{await tok();
   const pr=await api('/rest/v1/cn_profils?select=statut'),s=pr[0]&&pr[0].statut;
   if(s=='valide')return v6gate();
   const r=await api('/rest/v1/cn_paiements?select=statut,preuve_path&user_id=eq.'+uidT()+'&order=cree_le.desc&limit=1'),last=r[0],cash=last&&last.preuve_path=='cash';
   if(last&&last.statut=='en_attente')return v7wait(!!cash);
   if(last&&last.statut=='refuse')return v7form(cash?'Votre paiement en cash n’a pas encore été confirmé. Contactez l’administration, ou envoyez une capture de paiement.':'Votre dernière preuve n’a pas pu être validée. Envoyez une nouvelle capture bien lisible.');
   v7form();
  }catch(e){toast('Connexion impossible, réessayez');v6wait()}};
 const vw0=window.v7view;
 window.v7view=function(p){if(p=='cash')return toast('Paiement en cash : il n’y a pas de capture. Vérifiez la réception de l’argent avant de valider.');return vw0.apply(this,arguments)};
 const ad0=window.v6admin;
 window.v6admin=async function(){await ad0.apply(this,arguments);
  try{document.querySelectorAll('#v6a button[onclick="v7view(\'cash\')"]').forEach(b=>{b.textContent='💵 Paiement en cash (sans capture)';const s=b.closest('.card')&&b.closest('.card').querySelector('small');if(s)s.textContent=s.textContent.replace('💳 Preuve reçue','💵 Cash déclaré')})}catch(e){}};

 /* --- 3) boutons dans le classeur audio et sur les audios d'une page --- */
 const cl0=window.clas;
 window.clas=function(){const r=cl0.apply(this,arguments);
  try{document.querySelectorAll('#cl button[onclick^="aplay("]').forEach(b=>{const m=/aplay\('([^']+)'\)/.exec(b.getAttribute('onclick')),f=m&&v11fa(m[1]);if(!m)return;
   b.parentElement.insertAdjacentHTML('beforeend',`<button class=ch onclick="v11tr('${m[1]}')">${f&&f.x.tr?'📝 Transcription':'📝 Transcrire'}</button><button class=ch onclick="v11send('a:${m[1]}')">📤 Envoyer</button>`)})}catch(e){}
  return r};
 const at0=window.atts;
 window.atts=function(){const r=at0.apply(this,arguments);
  try{document.querySelectorAll('.ch2').forEach(el=>{const m=/opn\('([^']+)','a'\)/.exec(el.getAttribute('onclick')||'');if(!m||el.dataset.v11)return;el.dataset.v11=1;
   const html=`<b onclick="event.stopPropagation();v11tr('${m[1]}')">📝</b> <b onclick="event.stopPropagation();v11send('a:${m[1]}')">📤</b> `,bs=el.querySelectorAll('b'),l=bs[bs.length-1];
   if(l)l.insertAdjacentHTML('beforebegin',html);else el.insertAdjacentHTML('beforeend',html)})}catch(e){}
  return r};

 /* --- 4) bouton d'envoi dans l'écran du cahier --- */
 const ob0=window.openB;
 window.openB=function(){const r=ob0.apply(this,arguments);
  try{const f=document.querySelector('.f');if(f&&!$('#v11sd'))f.insertAdjacentHTML('beforeend','<button id=v11sd onclick="v11send()">📤 Envoyer notes, leçons, audios ou PDF</button>')}catch(e){}
  return r};

 /* --- une transcription disparaît avec son audio --- */
 const fd0=window.fdel;
 window.fdel=async function(id){try{await v8rm('tr:'+id);await v8rm('rs:'+id)}catch(e){}return fd0.apply(this,arguments)};
}
v11boot();
