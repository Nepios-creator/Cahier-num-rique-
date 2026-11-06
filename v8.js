/* Cahier numérique v8 : documents PDF et Word dans chaque cahier
   (ajout depuis le téléphone, lecture dans l’application, écoute audio).
   À charger APRÈS v7.js. Ne modifie aucune fonctionnalité existante : il ne fait qu’ajouter. */

/* ---------- Style + sélecteur de fichier (créés une seule fois) ---------- */
(()=>{const s=document.createElement('style');
s.textContent='#v8b table{border-collapse:collapse;display:block;overflow-x:auto;max-width:100%}#v8b td,#v8b th{border:1px solid #0003;padding:4px 8px;vertical-align:top}#v8b img{max-width:100%;height:auto}#v8b h1{font-size:24px}#v8b h2{font-size:21px}#v8b a{color:#4f46e5}';
document.head.appendChild(s);
document.body.insertAdjacentHTML('beforeend','<input type=file id=v8f accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden onchange="v8add(this)">')})();

/* ---------- Stockage : le fichier reste sur l’appareil (IndexedDB), la fiche est dans le cahier ---------- */
const v8sz=s=>s>=1e6?(s/1e6).toFixed(1).replace('.',',')+' Mo':Math.max(1,Math.round((s||0)/1e3))+' Ko';
async function v8put(k,b){const d=await idb();return new Promise((r,j)=>{const t=d.transaction('f','readwrite');t.objectStore('f').put(b,k);t.oncomplete=()=>r();t.onerror=t.onabort=()=>j(t.error)})}
async function v8rm(k){const d=await idb();return new Promise(r=>{const t=d.transaction('f','readwrite');t.objectStore('f').delete(k);t.oncomplete=()=>r();t.onerror=t.onabort=()=>r()})}

/* ---------- Liste des documents (dans le cahier et dans la fenêtre de la page) ---------- */
function v8rows(){const L=(cur&&cur.docs)||[];
 return (L.length?L.map(x=>`<div class=rs><b>${x.t=='pdf'?'📕':'📘'} ${esc(x.n)}</b><small>${x.t=='pdf'?'PDF':'Word'} · ${v8sz(x.s)} · ajouté le ${dt(x.a)}</small><span><button class=ch onclick="v8open('${x.id}')">📖 Ouvrir</button><button class=ch onclick="v8open('${x.id}',1)">🔊 Écouter</button><button class=ch onclick="v8del('${x.id}',this)">Supprimer</button></span></div>`).join(''):'<p class=hint>Aucun document pour l’instant. Ajoutez un PDF ou un fichier Word (.docx) : vous pourrez l’ouvrir ici et l’écouter.</p>')
 +`<button class=p style="margin-top:8px" onclick="$('#v8f').click()">＋ Ajouter un PDF ou un Word</button>`}
function v8fill(){const h=v8rows();['#v8l','#v8m'].forEach(s=>{const e=$(s);if(e)e.innerHTML=h})}
function v8sec(){const e=$('#cl');if(!e||!cur||$('#v8l'))return;e.insertAdjacentHTML('afterend','<div class=lh><b>📚 Documents PDF / Word</b></div><div id=v8l></div>');v8fill()}
function v8panel(){if(!cur||$('#v8o'))return;const o=document.createElement('div');o.id='v8o';o.style.cssText='position:fixed;inset:0;z-index:150;background:#000a;display:flex';
 o.innerHTML=`<div class=scb><div class=drh><b>📚 Documents de ce cahier</b><button onclick="$('#v8o').remove()">✕</button></div><div id=v8m></div></div>`;
 o.onclick=e=>{if(e.target==o)o.remove()};document.body.appendChild(o);v8fill()}

/* Accroches : section « Documents » dans l’écran du cahier, bouton 📚 dans la barre d’une page */
const v8openB=window.openB;
window.openB=function(){const r=v8openB.apply(this,arguments);try{v8sec()}catch(e){}return r};
const v8draw=window.draw;
window.draw=function(a,b){v8draw(a,b);const tb=$('.tb');if(tb)tb.insertAdjacentHTML('afterbegin',P('v8panel()','📚 Docs'))};

/* ---------- Ajout ---------- */
async function v8add(i){const fs=[...(i.files||[])];i.value='';if(!cur||!fs.length)return;let n=0,old=0,bad=0;
 for(const f of fs){const ext=((f.name.split('.').pop())||'').toLowerCase(),
  t=(ext=='pdf'||f.type=='application/pdf')?'pdf':(ext=='docx'||/wordprocessingml/.test(f.type))?'docx':null;
  if(ext=='doc'){old++;continue}
  if(!t){bad++;continue}
  const id=uid();
  try{await v8put('doc:'+id,f)}catch(e){toast('Espace insuffisant sur cet appareil');break}
  (cur.docs=cur.docs||[]).push({id,n:f.name.replace(/\.(pdf|docx)$/i,''),t,s:f.size,a:Date.now()});n++}
 if(n){save();v8fill();toast(n+' document(s) ajouté(s)')}
 else if(old)toast('Ancien format .doc non pris en charge : enregistrez-le en .docx ou en PDF')
 else if(bad)toast('Choisissez un fichier PDF ou Word (.docx)')}
async function v8del(id,b){if(b.dataset.a!=1){b.dataset.a=1;b.textContent='Confirmer ?';return}
 if(V8.x&&V8.x.id==id)v8close();
 cur.docs=(cur.docs||[]).filter(x=>x.id!=id);try{await v8rm('doc:'+id)}catch(e){}save();v8fill()}

/* ---------- Chargement des lecteurs (une seule fois, connexion nécessaire la première fois) ---------- */
const v8L={};
function v8lib(k){if(v8L[k])return v8L[k];
 const U={pdf:['https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'],
  word:['https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js','https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js']}[k];
 return v8L[k]=(async()=>{for(const u of U){try{await new Promise((r,j)=>{const s=document.createElement('script');s.src=u;s.onload=r;s.onerror=j;document.head.appendChild(s)});
  if(k=='pdf')pdfjsLib.GlobalWorkerOptions.workerSrc=u.replace('pdf.min.js','pdf.worker.min.js');return}catch(e){}}
  delete v8L[k];throw new Error('lib')})()}

/* ---------- Visionneuse ---------- */
let V8={vid:0,x:null,kind:'',ready:0,pc:{},np:1,p:1,k:0,sp:0,said:0,st:0,sid:0,r:1,pdf:null,io:null};
const V8R=[.8,.95,1.15,1.4],V8N=['Lente','Normale','Rapide','Très rapide'];
async function v8open(id,play){const x=((cur&&cur.docs)||[]).find(d=>d.id==id);if(!x)return;
 let b=null;try{b=await fget('doc:'+id)}catch(e){}
 if(!b)return toast('Ce fichier n’est pas sur cet appareil : ajoutez-le de nouveau');
 v8close();const my=V8.vid;V8.x=x;V8.kind=x.t;V8.ready=0;V8.pc={};V8.np=1;V8.p=1;V8.k=0;V8.sp=0;V8.said=0;
 const o=document.createElement('div');o.id='v8v';
 o.style.cssText='position:fixed;inset:0;z-index:250;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);padding:env(safe-area-inset-top,0px) 12px env(safe-area-inset-bottom,0px);box-sizing:border-box';
 o.innerHTML=`<div class=eh><button onclick="v8close()">✕</button><div class=tt><b>${esc(x.n)}</b><small id=v8s>Chargement…</small></div></div><div class=tb><button onclick="v8play()"><span id=v8pl>🔊 Écouter</span></button><button onclick="v8stop()">⏹</button><button id=v8r onclick="v8spd()">Voix ${V8N[V8.r]}</button></div><div class=sheet id=v8b style="padding:8px;margin-bottom:10px"></div>`;
 document.body.appendChild(o);
 try{if(x.t=='pdf')await v8pdf(b,my);else await v8word(b,my);
  if(my!=V8.vid)return;V8.ready=1;if(play)v8play()}
 catch(e){if(my!=V8.vid)return;const s=$('#v8s');if(s)s.textContent=e&&e.message=='pwd'?'PDF protégé par mot de passe : non pris en charge':e&&e.message=='lib'?'Connexion nécessaire la première fois pour charger le lecteur':'Impossible d’ouvrir ce fichier (fichier abîmé ?)'}}

function v8san(h){const d=new DOMParser().parseFromString('<body>'+h+'</body>','text/html');
 d.body.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button,svg,video,audio').forEach(e=>e.remove());
 d.body.querySelectorAll('*').forEach(e=>{[...e.attributes].forEach(a=>{const n=a.name.toLowerCase(),v=a.value,T=e.tagName;
  const ok=(T=='A'&&n=='href'&&/^https?:/i.test(v))||(T=='IMG'&&((n=='src'&&/^data:image\//i.test(v))||n=='alt'))||((T=='TD'||T=='TH')&&(n=='colspan'||n=='rowspan'));
  if(!ok)e.removeAttribute(a.name)});
  if(e.tagName=='A'){e.target='_blank';e.rel='noopener'}});
 return d.body.innerHTML}

/* PDF : pages dessinées à la demande (légères pour la mémoire du téléphone) */
async function v8pdf(b,my){await v8lib('pdf');if(my!=V8.vid)return;
 const buf=await b.arrayBuffer();let pdf;
 try{pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise}catch(e){throw (e&&e.name=='PasswordException')?new Error('pwd'):e}
 if(my!=V8.vid){try{pdf.destroy()}catch(e){}return}
 V8.pdf=pdf;V8.np=pdf.numPages;
 const box=$('#v8b'),p1=await pdf.getPage(1),v1=p1.getViewport({scale:1}),h0=Math.round((box.clientWidth-16)*v1.height/v1.width);
 if(my!=V8.vid)return;
 box.innerHTML='';
 for(let i=1;i<=V8.np;i++){const w=document.createElement('div');w.className='v8pg';w.id='v8p'+i;w.dataset.i=i;w.style.cssText='background:#fff;margin:0 0 10px;box-shadow:0 2px 10px #0003;min-height:'+h0+'px';box.appendChild(w)}
 V8.io=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting?v8rend(e.target):v8free(e.target)),{root:box,rootMargin:'1500px 0px'});
 box.querySelectorAll('.v8pg').forEach(w=>V8.io.observe(w));
 $('#v8s').textContent='PDF · '+V8.np+' page'+(V8.np>1?'s':'')}
async function v8rend(w){if(w.dataset.r||w.dataset.b||!V8.pdf)return;w.dataset.b=1;
 try{const p=await V8.pdf.getPage(+w.dataset.i),W=w.clientWidth||300,v0=p.getViewport({scale:1}),sc=W/v0.width,dpr=Math.min(2,window.devicePixelRatio||1),v=p.getViewport({scale:sc*dpr}),
  c=document.createElement('canvas');c.width=Math.floor(v.width);c.height=Math.floor(v.height);c.style.cssText='width:100%;height:auto;display:block';
  await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;
  if(!w.isConnected)return;w.innerHTML='';w.appendChild(c);w.style.minHeight=Math.round(W*v0.height/v0.width)+'px';w.dataset.r=1}
 catch(e){}finally{delete w.dataset.b}}
function v8free(w){if(!w.dataset.r)return;w.innerHTML='';delete w.dataset.r}

/* Word (.docx) : converti en page lisible */
async function v8word(b,my){await v8lib('word');if(my!=V8.vid)return;
 const r=await mammoth.convertToHtml({arrayBuffer:await b.arrayBuffer()});if(my!=V8.vid)return;
 const box=$('#v8b');box.style.padding='18px 20px';box.innerHTML=v8san(r.value||'')||'<p>(Document vide)</p>';
 const sel='h1,h2,h3,h4,h5,h6,p,li,td,th,blockquote',T=[];
 [...box.querySelectorAll(sel)].filter(e=>!e.querySelector(sel)).forEach(e=>{let s=(e.textContent||'').replace(/\s+/g,' ').trim();if(!s)return;if(!/[.!?…:;]$/.test(s))s+='.';v8chunks(s).forEach(x=>T.push(x))});
 if(!T.length)v8chunks(box.textContent||'').forEach(x=>T.push(x));
 V8.pc={1:T};V8.np=1;$('#v8s').textContent='Document Word'}

/* ---------- Écoute audio (lecture à voix haute, par phrases) ---------- */
function v8chunks(t){const o=[];String(t).replace(/\s+/g,' ').replace(/([.!?…;:])\s+/g,'$1\n').split('\n').forEach(s=>{s=s.trim();
 while(s.length>220){let k=s.lastIndexOf(' ',220);if(k<80)k=220;o.push(s.slice(0,k).trim());s=s.slice(k).trim()}if(s)o.push(s)});return o}
async function v8pc(p){if(V8.pc[p])return V8.pc[p];
 if(V8.kind!='pdf')return V8.pc[p]=[];
 const pa=await V8.pdf.getPage(p),c=await pa.getTextContent();let s='';c.items.forEach(it=>{s+=it.str+(it.hasEOL?'\n':' ')});
 return V8.pc[p]=v8chunks(s.replace(/\u00ad/g,'').replace(/-\n(?=[a-zà-ÿ])/g,''))}
const v8say=t=>new Promise(r=>{const u=new SpeechSynthesisUtterance(t),to=setTimeout(r,40000);u.lang='fr-FR';u.rate=V8R[V8.r];u.onend=u.onerror=()=>{clearTimeout(to);r()};speechSynthesis.speak(u)});
function v8here(){const b=$('#v8b');if(!b||V8.kind!='pdf')return 1;const top=b.getBoundingClientRect().top;
 for(const w of b.querySelectorAll('.v8pg'))if(w.getBoundingClientRect().bottom>top+40)return +w.dataset.i;return 1}
function v8show(){const s=$('#v8s');if(!s)return;
 if(V8.kind=='pdf'){s.textContent='Lecture · page '+V8.p+'/'+V8.np;if(V8.sp!=V8.p){V8.sp=V8.p;const w=$('#v8p'+V8.p);if(w)try{w.scrollIntoView({block:'start',behavior:'smooth'})}catch(e){}}}
 else s.textContent='Lecture · '+Math.round(100*V8.k/Math.max(1,(V8.pc[1]||[]).length))+' %'}
function v8lab(){const e=$('#v8pl');if(e)e.textContent=['🔊 Écouter','⏸ Pause','▶ Reprendre'][V8.st]}
function v8idle(){const s=$('#v8s');if(s)s.textContent=V8.kind=='pdf'?'PDF · '+V8.np+' page'+(V8.np>1?'s':''):'Document Word'}
let v8wl;
function v8hold(on){
 if(on){try{keep(1);navigator.mediaSession.metadata=new MediaMetadata({title:(V8.x&&V8.x.n)||'Document',artist:'Cahier numérique · lecture'})}catch(e){}
  try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(w=>v8wl=w).catch(()=>{})}catch(e){}}
 else{try{v8wl&&v8wl.release()}catch(e){}v8wl=null;try{if(!(mr&&mr.state=='recording')&&!dOn)keep(0)}catch(e){}}}
async function v8next(){const sid=V8.sid;
 while(sid==V8.sid&&V8.st==1){
  if(V8.p>V8.np){const n=V8.said;v8stop();toast(n?'Lecture terminée':'Aucun texte à lire dans ce document (PDF scanné ?)');return}
  let c;try{c=await v8pc(V8.p)}catch(e){return}
  if(sid!=V8.sid||V8.st!=1)return;
  if(V8.k>=c.length){V8.p++;V8.k=0;continue}
  v8show();await v8say(c[V8.k]);
  if(sid!=V8.sid||V8.st!=1)return;
  V8.k++;V8.said++}}
function v8play(){if(!window.speechSynthesis)return toast('Lecture audio non disponible sur cet appareil');
 if(!V8.ready)return toast('Chargement du document…');
 if(V8.st==1){V8.st=2;V8.sid++;speechSynthesis.cancel();v8lab();return}
 if(V8.st==2){V8.st=1;V8.sid++;v8lab();v8next();return}
 speechSynthesis.cancel();V8.p=v8here();V8.k=0;V8.said=0;V8.sp=0;V8.st=1;V8.sid++;v8lab();v8hold(1);v8next()}
function v8stop(){V8.sid++;V8.st=0;V8.p=1;V8.k=0;try{speechSynthesis.cancel()}catch(e){}v8lab();v8idle();v8hold(0)}
function v8spd(){V8.r=(V8.r+1)%V8R.length;const b=$('#v8r');if(b)b.textContent='Voix '+V8N[V8.r]}
function v8close(){V8.vid++;V8.sid++;const was=V8.st;V8.st=0;try{speechSynthesis.cancel()}catch(e){}if(was)v8hold(0);
 try{V8.io&&V8.io.disconnect()}catch(e){}V8.io=null;try{V8.pdf&&V8.pdf.destroy()}catch(e){}V8.pdf=null;V8.pc={};V8.ready=0;
 const o=$('#v8v');if(o)o.remove()}
