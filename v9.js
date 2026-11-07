/* Cahier numérique v9 : (1) lecture audio complète de la page, (2) scanneur de texte plus fiable.
   À charger APRÈS v8.js. Remplace uniquement lire(), stopL(), cpv(), enh(), scanAdd(), scanOcr() et scanIns(). */

const V9={st:0,i:0,id:0,q:[],ocr:0,hint:''};

/* =====================================================================
   1. LECTURE AUDIO
   Ancien défaut : le texte était découpé avec une expression qui SAUTAIT tout passage de plus
   de 220 caractères sans point (titres, puces, lignes sans ponctuation) et fusionnait toutes les lignes.
   Maintenant : lecture ligne par ligne (titre compris), une phrase après l'autre, sans rien omettre.
   ===================================================================== */
const v9end=/[.!?…:;,]$/;

/* Coupe une ligne en phrases, puis en morceaux de 180 caractères max, SANS rien perdre */
function v9chunks(s){const o=[];s=String(s||'').replace(/\s+/g,' ').trim();if(!s)return o;
 s.replace(/([.!?…;:])\s+/g,'$1\n').split('\n').forEach(p=>{p=p.trim();
  while(p.length>180){let k=p.lastIndexOf(' ',180);if(k<60)k=180;o.push(p.slice(0,k).trim());p=p.slice(k).trim()}
  if(p)o.push(p)});
 return o}

/* Une ligne de texte par bloc (titre, paragraphe, puce, ligne de tableau, retour à la ligne) */
function v9lines(root){const c=root.cloneNode(true);
 c.querySelectorAll('script,style,audio,video,canvas,img').forEach(e=>e.remove());
 c.querySelectorAll('br').forEach(b=>b.replaceWith('\n'));
 c.querySelectorAll('h1,h2,h3,h4,h5,h6,p,div,li,tr,blockquote,pre,ul,ol,table').forEach(e=>{e.prepend('\n');e.append('\n')});
 c.querySelectorAll('td,th').forEach(e=>e.append(' '));
 return(c.textContent||'').replace(/\u00a0/g,' ').split('\n').map(s=>s.replace(/\s+/g,' ').trim())
  .filter(s=>/[\p{L}\p{N}]/u.test(s)).map(s=>v9end.test(s)?s:s+'.')}

/* File d'attente : titre de la page (cours, chapitre, sujet) puis tout le contenu, ou la sélection */
function v9queue(){const e=$('#ed');if(!e||!pg)return[];const q=[],add=l=>v9chunks(l).forEach(c=>q.push(c));
 const sel=getSelection();
 if(sel&&sel.rangeCount&&!sel.isCollapsed&&e.contains(sel.anchorNode)&&e.contains(sel.focusNode)){
  const d=document.createElement('div');d.appendChild(sel.getRangeAt(0).cloneContents());v9lines(d).forEach(add);return q}
 [cur&&cur.cours,pg.chap,pg.sujet].filter(Boolean).forEach(t=>add(v9end.test(t.trim())?t:t.trim()+'.'));
 v9lines(e).forEach(add);return q}

/* Voix française si disponible */
let v9voice=null;
function v9pick(){try{const vs=speechSynthesis.getVoices();v9voice=vs.find(v=>/^fr[-_]FR/i.test(v.lang))||vs.find(v=>/^fr/i.test(v.lang))||null}catch(e){}}
if(window.speechSynthesis){v9pick();try{speechSynthesis.addEventListener('voiceschanged',v9pick)}catch(e){}}

/* Dit un morceau et attend sa fin (avec garde-fou si le navigateur ne signale jamais la fin) */
const v9say=t=>new Promise(r=>{let done=0,ext=0,to;
 const fin=()=>{if(!done){done=1;clearTimeout(to);r(ext)}},u=new SpeechSynthesisUtterance(t);
 u.lang='fr-FR';if(v9voice)u.voice=v9voice;u.rate=.95;
 u.onend=fin;u.onerror=e=>{if(!done&&e&&(e.error=='canceled'||e.error=='interrupted'))ext=1;fin()};
 window.__v9u=u;
 to=setTimeout(()=>{done||(()=>{try{speechSynthesis.cancel()}catch(e){}})();fin()},6000+t.length*130);
 speechSynthesis.speak(u)});

let v9wl;
function v9hold(on){
 if(on){try{keep(1)}catch(e){}
  try{navigator.mediaSession.metadata=new MediaMetadata({title:'Lecture de la page',artist:'Cahier numérique'})}catch(e){}
  try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(w=>v9wl=w).catch(()=>{})}catch(e){}}
 else{try{v9wl&&v9wl.release()}catch(e){}v9wl=null;
  try{if(!(mr&&mr.state=='recording')&&!dOn&&!(V8&&V8.st))keep(0)}catch(e){}}}

async function v9run(){const id=V9.id;
 await new Promise(r=>setTimeout(r,80));
 while(id==V9.id&&V9.st==1&&V9.i<V9.q.length){
  const ext=await v9say(V9.q[V9.i]);
  if(id!=V9.id||V9.st!=1)return;
  if(ext){V9.st=0;ui('🔊');v9hold(0);return}   /* interrompu par une autre lecture */
  V9.i++}
 if(id==V9.id&&V9.st==1){V9.st=0;V9.i=0;ui('🔊');v9hold(0)}}

function v9start(q){const s=window.speechSynthesis;
 try{if(typeof V8!='undefined'&&V8.st)v8stop()}catch(e){}
 try{s.cancel();s.resume()}catch(e){}
 V9.q=q;V9.i=0;V9.st=1;V9.id++;ui('⏸');v9hold(1);v9run()}

window.lire=function(){const s=window.speechSynthesis;if(!s)return toast('Lecture audio non disponible');
 if(V9.st==1){V9.st=2;V9.id++;try{s.cancel()}catch(e){}ui('▶️');return}
 if(V9.st==2){V9.st=1;V9.id++;ui('⏸');v9run();return}
 if(!pg||!$('#ed'))return toast('Ouvrez une page à lire');
 const q=v9queue();if(!q.length)return toast('Rien à lire');
 v9start(q)};
window.stopL=function(){V9.id++;V9.st=0;try{window.speechSynthesis&&speechSynthesis.cancel()}catch(e){}ui('🔊');v9hold(0)};

/* Notes complémentaires : même moteur (l'ancienne version sautait aussi des passages) */
window.cpv=function(id){const x=pg&&(pg.cpl||[]).find(a=>a.id==id);if(!x||!window.speechSynthesis)return;
 const b=new DOMParser().parseFromString('<body>'+x.h+'</body>','text/html').body,q=[],add=l=>v9chunks(l).forEach(c=>q.push(c));
 add(v9end.test(x.t||'')?x.t:(x.t||'')+'.');v9lines(b).forEach(add);if(q.length)v9start(q)};

/* La lecture d'un document PDF/Word (v8) arrête d'abord la lecture de la page */
if(typeof window.v8play=='function'){const v9v8=window.v8play;window.v8play=function(){if(V9.st)stopL();return v9v8.apply(this,arguments)}}

/* =====================================================================
   2. SCANNEUR (cahier papier → texte)
   - Résolution plus élevée (1800 → 2600 px) : l'écriture reste lisible pour la reconnaissance
   - Nettoyage de l'éclairage : les ombres, le grain et les lignes pâles du cahier ne cachent plus le texte
   - Lecture en « bloc de texte » (ne saute plus de lignes), avec seconde tentative automatique si la lecture est faible
   - Indication de fiabilité + insertion fidèle des retours à la ligne
   ===================================================================== */

/* Aplatit l'éclairage : chaque pixel est comparé à la luminosité moyenne autour de lui */
window.enh=function(c){const W=c.width,H=c.height,x=c.getContext('2d'),d=x.getImageData(0,0,W,H),a=d.data,n=W*H,g=new Uint8ClampedArray(n);
 for(let i=0,j=0;i<n;i++,j+=4)g[i]=(a[j]*.3+a[j+1]*.59+a[j+2]*.11+.5)|0;
 const W1=W+1,S=new Uint32Array(W1*(H+1));
 for(let y=0;y<H;y++){let r=0;const o=y*W,p=y*W1,q=(y+1)*W1;for(let k=0;k<W;k++){r+=g[o+k];S[q+k+1]=S[p+k+1]+r}}
 const R=Math.max(12,Math.round(Math.max(W,H)/40));
 for(let y=0;y<H;y++){const y0=Math.max(0,y-R),y1=Math.min(H,y+R+1),A=y0*W1,B=y1*W1;
  for(let k=0;k<W;k++){const x0=Math.max(0,k-R),x1=Math.min(W,k+R+1),
    m=(S[B+x1]-S[A+x1]-S[B+x0]+S[A+x0])/((x1-x0)*(y1-y0)),i=y*W+k;
   let v=(g[i]/(m+1)-.5)/.42*255;v=v<0?0:v>255?255:v;
   const j=i*4;a[j]=a[j+1]=a[j+2]=v}}
 x.putImageData(d,0,0)};

window.scanAdd=async function(inp){
 for(const f of inp.files){const im=await loadImg(f),k=Math.min(1,2600/Math.max(im.width,im.height)),c=document.createElement('canvas');
  c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);enh(c);
  const t=document.createElement('canvas');t.width=Math.round(c.width*90/c.height);t.height=90;t.getContext('2d').drawImage(c,0,0,t.width,t.height);
  SC.push({c,th:t.toDataURL('image/jpeg',.6)})}
 inp.value='';scT='';V9.hint='';scanUI()};

const v9alnum=s=>(String(s).match(/[\p{L}\p{N}]/gu)||[]).length;
function v9page(data){const L=(data.lines&&data.lines.length)?data.lines.map(l=>l.text):String(data.text||'').split('\n');
 return L.map(s=>String(s).replace(/\s+$/,'')).filter(s=>v9alnum(s)>=2).join('\n')}

window.scanOcr=async function(){if(V9.ocr)return;V9.ocr=1;
 toast('Préparation de la lecture… (1re fois : téléchargement)');let w=null;
 try{
  if(!window.Tesseract)await new Promise((r,j)=>{const e=document.createElement('script');e.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';e.onload=r;e.onerror=j;document.head.appendChild(e)});
  let k=0;const n=SC.length;
  w=await Tesseract.createWorker('fra',1,{logger:m=>{if(m.status=='recognizing text')toast('Lecture page '+(k+1)+'/'+n+' · '+Math.round(m.progress*100)+' %')}});
  const run=async mode=>{await w.setParameters({tessedit_pageseg_mode:mode,preserve_interword_spaces:'1',user_defined_dpi:'300'});
   const{data}=await w.recognize(SC[k].c);return{t:v9page(data),cf:+data.confidence||0}};
  const out=[],cfs=[];
  for(k=0;k<n;k++){let r=await run('6');                       /* bloc de texte uniforme */
   if(r.cf<55||v9alnum(r.t)<20){const r2=await run('3');       /* seconde tentative : détection automatique */
    if(r2.cf*v9alnum(r2.t)>r.cf*v9alnum(r.t))r=r2}
   if(r.t)out.push(r.t);cfs.push(r.cf)}
  scT=out.join('\n\n').trim()||'(Aucun texte reconnu)';
  const cf=cfs.reduce((a,b)=>a+b,0)/Math.max(1,cfs.length);
  V9.hint=!out.length?'Aucun texte reconnu : photographiez la page à plat, bien éclairée, en remplissant le cadre.'
   :cf>=80?'Lecture fiable ('+Math.round(cf)+' %). Relisez quand même avant d’insérer.'
   :cf>=60?'Lecture correcte ('+Math.round(cf)+' %) : vérifiez et corrigez le texte ci-dessous avant d’insérer.'
   :'Lecture difficile ('+Math.round(cf)+' %). L’écriture manuscrite est mal reconnue : écrivez en lettres bien séparées, ou photographiez de plus près, à plat et bien éclairé. Corrigez le texte avant d’insérer.';
  scanUI();const so=$('#so');if(so&&V9.hint)so.insertAdjacentHTML('beforebegin','<p class=hint>'+esc(V9.hint)+'</p>')}
 catch(e){toast('Lecture impossible : connexion nécessaire la première fois')}
 finally{V9.ocr=0;try{w&&await w.terminate()}catch(e){}}};

/* Insère le texte avec ses retours à la ligne exacts */
window.scanIns=function(){const t=($('#so')||{}).value;if(!t||!t.trim())return toast('Rien à insérer');
 putH(t.trim().split(/\n{2,}/).map(p=>'<div>'+esc(p).replace(/\n/g,'<br>')+'</div>').join('<div><br></div>'));
 $('#sc')&&$('#sc').remove();SC=[];scT='';V9.hint=''};
