/* Cahier numérique v13 : Révision par cahier (générale / approfondie + lecture audio),
   Examen simulé et examen blanc de 2 h, accès Premium (essai 2 mois puis Stripe).
   À charger APRÈS v12.js et AVANT adg-bridge.js. N'ajoute que du nouveau : aucune fonction existante n'est modifiée
   (openB est seulement « enveloppée », comme le fait déjà v8.js). */
(()=>{
const FN=SB+'/functions/v1/',E=esc;
const V13={tab:'rev',st:undefined,rev:null,his:null,screen:'home',exam:null,rep:null,end:0,tm:0,sid:0,au:0,busy:0,t0:0};
window.V13=V13;

/* ---------- Style ---------- */
(()=>{const s=document.createElement('style');s.textContent=`
#v13o{position:fixed;top:0;right:0;bottom:0;left:0;z-index:150;background:var(--bg);overflow:hidden}
#v13o .scb{position:absolute;top:0;right:0;bottom:0;left:0;width:auto;max-width:none;height:auto;max-height:none;margin:0;border:0;border-radius:0;box-shadow:none;background:var(--bg);display:block;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:0 0 60px;box-sizing:border-box}
#v13o .drh{position:sticky;top:0;z-index:5;background:var(--bg);min-height:56px;box-sizing:border-box;padding:calc(8px + env(safe-area-inset-top)) 16px 8px;border-bottom:1px solid var(--line);font-size:18px}
#v13o .drh button{width:auto;padding:8px 14px}
#v13b{width:100%;max-width:860px;margin:0 auto;padding:12px 16px;box-sizing:border-box}
#v13b .v13md{overflow-wrap:anywhere}
#v13b .sheet{flex:none;overflow:visible;padding:14px 18px}
#v13b .v13rb{position:sticky;top:56px;z-index:4;background:var(--bg);padding:6px 0}
.katex-display{overflow-x:auto;overflow-y:hidden}
.v13s{padding:8px 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);margin:6px 0;font-size:14px}
.v13t{display:flex;gap:6px;margin:8px 0}.v13t button{flex:1}.v13t .on{background:var(--acc);color:#fff}
.v13q{padding:10px 12px;border:1px solid var(--line);border-radius:12px;margin:10px 0;background:var(--card)}
.v13q textarea{width:100%;min-height:80px;box-sizing:border-box;font:inherit}
.v13q label{display:block;padding:4px 0}
.v13md h1,.v13md h2,.v13md h3{margin:.9em 0 .3em}.v13md h1{font-size:21px}.v13md h2{font-size:18px}.v13md h3{font-size:16px}
.v13md li{margin:2px 0}.v13md code{background:var(--line);padding:0 4px;border-radius:4px}
.v13sc{font-size:44px;font-weight:700;text-align:center;margin:6px 0}
.v13tm{position:sticky;top:56px;background:var(--bg);padding:6px 0;font-weight:700;z-index:2}
.v13ok{color:#16a34a}.v13ko{color:#dc2626}
`;document.head.appendChild(s)})();

/* ---------- Outils ---------- */
const lsg=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
const lss=(k,v)=>{try{v===null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const dfr=t=>t?new Date(t).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}):'';
const dtm=t=>t?new Date(t).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';

let katexP=null;
function v13katex(){if(window.renderMathInElement)return Promise.resolve();
 if(katexP)return katexP;const B='https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/';
 const ld=u=>new Promise((r,j)=>{const s=document.createElement('script');s.src=B+u;s.onload=r;s.onerror=j;document.head.appendChild(s)});
 const l=document.createElement('link');l.rel='stylesheet';l.href=B+'katex.min.css';document.head.appendChild(l);
 return katexP=ld('katex.min.js').then(()=>ld('contrib/mhchem.min.js')).then(()=>ld('contrib/auto-render.min.js')).catch(e=>{katexP=null;throw e})}
async function v13math(el){try{await v13katex();renderMathInElement(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false},{left:'$',right:'$',display:false}],throwOnError:false})}catch(e){}}

/* Markdown minimal et sûr (tout est échappé avant mise en forme ; les formules sont protégées) */
function v13md(t){const M=[];if(Array.isArray(t))t=t.map(x=>typeof x=='string'?x:(x&&x.text)||'').join('');t=String(t||'').replace(/\$\$[\s\S]+?\$\$|\$[^\n$]+?\$/g,m=>{M.push(m);return'\u0001'+(M.length-1)+'\u0001'});
 const inl=s=>E(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<i>$2</i>');
 let h='',ul=0,ol=0;const cl=()=>{if(ul){h+='</ul>';ul=0}if(ol){h+='</ol>';ol=0}};
 for(const L of t.split('\n')){let m;
  if(m=/^(#{1,4})\s+(.*)/.exec(L)){cl();const n=Math.min(3,m[1].length);h+=`<h${n}>${inl(m[2])}</h${n}>`}
  else if(m=/^\s*[-*•]\s+(.*)/.exec(L)){if(ol){h+='</ol>';ol=0}if(!ul){h+='<ul>';ul=1}h+='<li>'+inl(m[1])+'</li>'}
  else if(m=/^\s*\d+[.)]\s+(.*)/.exec(L)){if(ul){h+='</ul>';ul=0}if(!ol){h+='<ol>';ol=1}h+='<li>'+inl(m[1])+'</li>'}
  else if(/^\s*(-{3,}|\*{3,})\s*$/.test(L)){cl();h+='<hr>'}
  else if(!L.trim())cl();
  else{cl();h+='<p>'+inl(L)+'</p>'}}
 cl();return h.replace(/\u0001(\d+)\u0001/g,(_,i)=>E(M[i]))}

/* ---------- Contenu du cahier (notes, audios transcrits, documents, dessins) ---------- */
function v13txt(h){const d=new DOMParser().parseFromString('<body>'+(h||'')+'</body>','text/html');
 d.body.querySelectorAll('script,style').forEach(e=>e.remove());
 d.body.querySelectorAll('[data-tex]').forEach(e=>e.replaceWith('$'+e.getAttribute('data-tex')+'$'));
 d.body.querySelectorAll('img').forEach(e=>{const a=(e.getAttribute('alt')||'').trim();e.replaceWith(a?'\n[Dessin / image : '+a+']\n':'\n[Image sans légende]\n')});
 d.body.querySelectorAll('br').forEach(e=>e.replaceWith('\n'));
 d.body.querySelectorAll('p,div,li,tr,h1,h2,h3,h4,h5,h6').forEach(e=>e.append('\n'));
 return(d.body.textContent||'').replace(/\n{3,}/g,'\n\n').trim()}
async function v13doc(x){const k='dt:'+x.id;let t=null;try{t=await fget(k)}catch(e){}
 if(typeof t=='string')return t;
 let b=null;try{b=await fget('doc:'+x.id)}catch(e){}
 if(!b)return'(fichier absent de cet appareil : non lu)';
 try{if(x.t=='pdf'){await v8lib('pdf');const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await b.arrayBuffer())}).promise;let s='';
   for(let i=1;i<=pdf.numPages&&s.length<60000;i++){const c=await(await pdf.getPage(i)).getTextContent();s+=c.items.map(it=>it.str+(it.hasEOL?'\n':' ')).join('')+'\n'}
   try{pdf.destroy()}catch(e){}t=s.trim()}
  else t=v13txt(await v8docx(await b.arrayBuffer()))}
 catch(e){return'(document non lisible : '+(e&&e.message=='lib'?'connexion nécessaire la première fois':'erreur de lecture')+')'}
 if(!t)t='(aucun texte lisible : document scanné ?)';else try{await v8put(k,t)}catch(e){}
 return t}
async function v13collect(c){const P=[`# CAHIER : ${c.cours||''}${c.prof?' — '+c.prof:''}`];
 for(const[i,p]of c.pages.entries()){P.push(`\n## Page ${i+1} — ${p.chap||'Sans chapitre'}${p.sujet?' — '+p.sujet:''} (${dt(p.start)})\n`+v13txt(p.html));
  (p.cpl||[]).forEach(x=>P.push(`[Note complémentaire « ${x.t||''} »] `+v13txt(x.h)));
  for(const a of(p.att||[]))if(a.k=='a'){let t='',r='';try{t=await fget('tr:'+a.id)||'';r=await fget('rs:'+a.id)||''}catch(e){}
   if(t)P.push(`[Audio transcrit « ${a.n||''} »]\n${t}`);else if(r)P.push(`[Résumé de l'audio « ${a.n||''} »]\n${r}`)}}
 for(const x of(c.docs||[]))P.push(`\n## DOCUMENT TÉLÉVERSÉ « ${x.n} » (${x.t})\n`+await v13doc(x));
 let s=P.join('\n');if(s.length>150000)s=s.slice(0,150000)+'\n[…contenu tronqué…]';return s}

/* ---------- Serveur ---------- */
async function v13call(a,body){await tok();
 const r=await fetch(FN+'cn-etude',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+D.s.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:a,...body})});
 let j={};try{j=await r.json()}catch(e){}if(!r.ok)throw Object.assign(new Error(j.error||'erreur '+r.status),{code:r.status,j});return j}
const v13err=e=>e.code==402||e.message=='premium_required'?'Votre essai gratuit est terminé : abonnez-vous pour continuer.':e.message=='no_key'?'Le service IA n’est pas encore activé côté serveur.':e.message=='cahier_vide'?'Ce cahier ne contient pas assez de texte.':e.message=='non_valide'?'Votre compte n’est pas encore activé.':e.message=='deja_corrige'?'Cet examen a déjà été remis.':e.code==401?'Reconnectez-vous puis réessayez.':'Échec : '+(e.j&&e.j.detail||e.message)+'. Réessayez.';
async function v13status(){try{V13.st=await api('/rest/v1/rpc/cn_premium_status',{m:'POST',b:{}})}catch(e){V13.st=null}}
async function v13sub(){try{await tok();const r=await fetch(FN+'cn-checkout',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+D.s.access_token,'Content-Type':'application/json'},body:JSON.stringify({return_url:location.origin+location.pathname})});const j=await r.json();
 if(j.url)location.href=j.url;else toast(j.error=='stripe_non_configure'?'Paiement pas encore configuré':'Paiement indisponible : '+(j.detail||j.error))}catch(e){toast('Paiement indisponible')}}

/* ---------- Fenêtre ---------- */
function v13open(){if(!cur)return;if(!D.s)return toast('Connectez-vous (☁️) pour utiliser Révision et Examen');
 if($('#v13o'))return;const o=document.createElement('div');o.id='v13o';
 o.innerHTML='<div class=scb><div class=drh><b>🎓 Révision &amp; Examen</b><button data-a=close>✕</button></div><div id=v13b></div></div>';
 o.onclick=e=>{if(e.target==o)return v13close();const b=e.target.closest('[data-a]');if(b)v13act(b.dataset.a,b.dataset)};
 document.body.appendChild(o);V13.screen='home';V13.tab='rev';V13.rev=V13.his=null;v13draw();
 v13status().then(v13draw);v13load()}
function v13close(){if(V13.screen=='exam'&&!confirm('Quitter l’examen ? Votre brouillon est conservé sur cet appareil.'))return;
 clearInterval(V13.tm);window.onbeforeunload=null;v13stop();const o=$('#v13o');if(o)o.remove()}
async function v13load(){try{V13.rev=await api('/rest/v1/cn_revisions?select=id,mode,created_at,content&notebook_id=eq.'+encodeURIComponent(cur.id)+'&order=created_at.desc&limit=10');
  V13.his=await api('/rest/v1/cn_exam_attempts?select=id,exam_id,score,submitted_at,report&notebook_id=eq.'+encodeURIComponent(cur.id)+'&order=submitted_at.desc&limit=20')}catch(e){V13.rev=V13.rev||[];V13.his=V13.his||[]}v13draw()}

const stBox=()=>{const s=V13.st;if(s===undefined)return'<div class=v13s>Vérification de votre accès…</div>';
 if(s===null)return'<div class=v13s>⚠️ Module pas encore activé (mise à jour de la base de données à faire par l’administrateur).</div>';
 const sb=s.status!='active'?'<button class=p data-a=sub>S’abonner</button>':'';
 if(!s.premium)return`<div class=v13s>🔒 Votre essai gratuit est terminé. ${sb}</div>`;
 return`<div class=v13s>${s.status=='active'?'✅ Abonnement actif jusqu’au '+dfr(s.current_period_end):'🎁 Essai gratuit jusqu’au '+dfr(s.trial_ends_at)}${s.status=='active'?'':' '+sb}</div>`};

function v13draw(){const b=$('#v13b');if(!b)return;const sc=V13.screen;
 if(sc=='home'){const T=[['rev','📖 Révision'],['exam','📝 Examen'],['his','📊 Historique']];
  let h=stBox()+`<div class=v13t>${T.map(t=>`<button class="${V13.tab==t[0]?'on':''}" data-a=tab data-t=${t[0]}>${t[1]}</button>`).join('')}</div>`;
  if(V13.tab=='rev'){h+=`<div class=f><button class=p data-a=gen data-m=general ${V13.busy?'disabled':''}>Révision générale (tout le cahier)</button><button class=p data-a=gen data-m=approfondie ${V13.busy?'disabled':''}>Révision approfondie (explications + audio)</button></div><p class=hint id=v13p>${V13.busy?'Génération en cours… (peut prendre 1 minute)':'Elle tient compte de vos notes, audios transcrits, documents et dessins.'}</p>`;
   h+=V13.rev?V13.rev.map(r=>`<div class=rs data-a=viewrev data-i="${r.id}"><b>${r.mode=='general'?'Générale':'Approfondie'}</b><small>${dtm(r.created_at)}</small></div>`).join('')||'<p class=hint>Aucune révision enregistrée.</p>':'<p class=hint>Chargement…</p>'}
  else if(V13.tab=='exam'){h+=`<div class=f><button class=p data-a=exam data-m=simulation ${V13.busy?'disabled':''}>Examen simulé (≈ 1 h, sans chrono)</button><button class=p data-a=exam data-m=blanc ${V13.busy?'disabled':''}>Examen blanc de 2 h (chronométré)</button></div><p class=hint id=v13p>${V13.busy?'Création de l’examen… (peut prendre 1 minute)':'Questions : QCM, vrai/faux, définitions, ouvertes, dissertation, cas pratiques, raisonnement. Note sur 20 et correction détaillée.'}</p>`;
   const d=lsg('v13cur:'+cur.id);if(d&&d.exam)h+=`<div class=v13s>Examen en cours détecté. <button data-a=resume>Reprendre</button></div>`}
  else{const H=V13.his;h+=H?H.length?`<p class=hint>Évolution : ${H.slice().reverse().map(a=>a.score).join(' → ')} /20</p>`+H.map(a=>`<div class=rs data-a=viewatt data-i="${a.id}"><b>${a.score} / 20</b><small>${dtm(a.submitted_at)} · ${(a.report&&a.report.misunderstood_notions||[]).slice(0,3).map(E).join(', ')}</small></div>`).join(''):'<p class=hint>Aucune tentative pour l’instant.</p>':'<p class=hint>Chargement…</p>'}
  b.innerHTML=h;return}
 if(sc=='rev'){const r=V13.cur;b.innerHTML=`<div class="f v13rb"><button data-a=home>‹ Retour</button><button class=p data-a=speak>🔊 Écouter</button><button data-a=stopsp>⏹ Arrêter</button></div><div class=sheet><div class=v13md id=v13m>${v13md(r.content)}</div></div>`;v13math($('#v13m'));return}
 if(sc=='exam'){const ex=V13.exam;b.innerHTML=`<div class=v13tm><button data-a=close>✕</button> ${E(ex.exam.title)} ${ex.exam.duration_minutes?'· ⏱ <span id=v13tm></span>':''}</div>`+ex.questions.map((q,i)=>`<div class=v13q data-q="${E(q.id)}"><b>${i+1}. <small>(${q.points} pt${q.points>1?'s':''} · ${E(q.type.replace('_',' '))})</small></b><div class=v13md>${v13md(q.text)}</div>`+
    (q.type=='qcm'?(q.choices||[]).map((c,k)=>`<label><input type=radio name="${E(q.id)}" value="${k}" ${String(ex.ans[q.id])===String(k)?'checked':''}> ${E(c)}</label>`).join(''):q.type=='vrai_faux'?['true','false'].map(v=>`<label><input type=radio name="${E(q.id)}" value="${v}" ${String(ex.ans[q.id])===v?'checked':''}> ${v=='true'?'Vrai':'Faux'}</label>`).join(''):`<textarea name="${E(q.id)}" rows=${q.type=='dissertation'?12:4}>${E(ex.ans[q.id]||'')}</textarea>`)+'</div>').join('')+`<button class=p data-a=submit ${V13.busy?'disabled':''}>${V13.busy?'Correction en cours…':'Remettre ma copie'}</button>`;
  b.oninput=b.onchange=()=>v13save();v13math(b);v13tick();return}
 if(sc=='rep'){const R=V13.rep,rp=R.report,Q=R.questions||[];
  const hist=(R.history||[]).slice().reverse().map(x=>x.score);
  b.innerHTML=`<div class=f><button data-a=home>‹ Retour</button></div><div class=v13sc>${R.score} / 20</div>${hist.length?`<p class=hint style="text-align:center">Tentatives précédentes : ${hist.join(' → ')}</p>`:''}`+
   (rp.summary?`<div class="v13s v13md">${v13md(rp.summary)}</div>`:'')+(rp.comparison?`<div class="v13s v13md"><b>Comparaison :</b> ${v13md(rp.comparison)}</div>`:'')+
   (rp.errors&&rp.errors.length?`<div class=lh><b>❌ Vos erreurs</b></div><ul>${rp.errors.map(x=>`<li>${E(x)}</li>`).join('')}</ul>`:'')+
   (rp.misunderstood_notions&&rp.misunderstood_notions.length?`<div class=lh><b>🧩 Notions mal comprises</b></div><ul>${rp.misunderstood_notions.map(x=>`<li>${E(x)}</li>`).join('')}</ul>`:'')+
   (rp.recommendations&&rp.recommendations.length?`<div class=lh><b>💡 Recommandations</b></div><ul>${rp.recommendations.map(x=>`<li>${E(x)}</li>`).join('')}</ul>`:'')+
   `<div class=lh><b>Correction détaillée</b></div>`+rp.per_question.map((p,i)=>{const q=Q.find(z=>z.id==p.id)||{};const ca=p.type=='qcm'&&q.choices?q.choices[+p.correct_answer]:p.type=='vrai_faux'?(String(p.correct_answer)=='true'?'Vrai':'Faux'):p.correct_answer;
    return`<div class=v13q><b>${i+1}. <span class="${p.obtained>=p.points?'v13ok':'v13ko'}">${p.obtained} / ${p.points}</span></b><div class=v13md>${v13md(q.text||'')}</div><p><i>Votre réponse :</i> ${E(ga(p,q,(R.answers||{})[p.id]))}</p><div class=v13md><b>Corrigé :</b> ${v13md(String(ca==null?'':ca))}</div>${p.comment?`<div class=v13md><b>Commentaire :</b> ${v13md(p.comment)}</div>`:''}${p.explanation?`<div class=v13md><b>Explication :</b> ${v13md(p.explanation)}</div>`:''}</div>`}).join('');
  v13math(b)}}

const ga=(p,q,a)=>a===undefined||a===''?'(sans réponse)':p.type=='qcm'&&q.choices?String(q.choices[+a]!=null?q.choices[+a]:a):p.type=='vrai_faux'?(String(a)=='true'?'Vrai':'Faux'):String(a).slice(0,1500);
/* ---------- Actions ---------- */
async function v13act(a,d){
 if(a=='close')return v13close();
 if(a=='sub')return v13sub();
 if(a=='tab'){V13.tab=d.t;return v13draw()}
 if(a=='home'){V13.screen='home';v13stop();return v13draw()}
 if(a=='viewrev'){V13.cur=V13.rev.find(r=>r.id==d.i);V13.screen='rev';return v13draw()}
 if(a=='speak')return v13speak();if(a=='stopsp')return v13stop();
 if(a=='gen'||a=='exam'){if(V13.busy)return;V13.busy=1;v13draw();
  try{const p=$('#v13p');if(p)p.textContent='Préparation du contenu du cahier…';const content=await v13collect(cur);
   if(a=='gen'){const r=await v13call('revision',{notebook_id:cur.id,mode:d.m,content});V13.rev=[r,...(V13.rev||[])];V13.cur=r;V13.screen='rev'}
   else{const r=await v13call('exam',{notebook_id:cur.id,mode:d.m,content});V13.exam={exam:r.exam,questions:r.questions,ans:{},t0:Date.now()};v13startExam()}}
  catch(e){toast(v13err(e));if(e.code==402||e.message=='premium_required')await v13status()}
  V13.busy=0;return v13draw()}
 if(a=='resume'){const s=lsg('v13cur:'+cur.id);if(s&&s.exam){V13.exam=s.exam;v13startExam(true);v13draw()}return}
 if(a=='submit')return v13submit(false);
 if(a=='viewatt'){const t=V13.his.find(x=>x.id==d.i);if(!t)return;try{const ex=await api('/rest/v1/cn_exams?select=questions&id=eq.'+t.exam_id);V13.rep={score:t.score,report:t.report,questions:ex[0]&&ex[0].questions||[],answers:{},history:[]};V13.screen='rep';v13draw()}catch(e){toast('Chargement impossible')}}}

/* ---------- Examen ---------- */
function v13startExam(resume){const ex=V13.exam;V13.screen='exam';ex.ans=ex.ans||{};
 clearInterval(V13.tm);window.onbeforeunload=e=>{e.preventDefault();e.returnValue='';return''};
 if(ex.exam.duration_minutes){ex.end=ex.end||(ex.t0||Date.now())+ex.exam.duration_minutes*60000;V13.tm=setInterval(v13tick,1000)}
 v13save()}
function v13tick(){const ex=V13.exam;if(!ex||!ex.end)return;const s=Math.max(0,Math.round((ex.end-Date.now())/1000)),e=$('#v13tm');
 if(e)e.textContent=Math.floor(s/3600)+':'+String(Math.floor(s%3600/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
 if(s<=0){clearInterval(V13.tm);toast('Temps écoulé : copie remise automatiquement');v13submit(true)}}
function v13read(){const ex=V13.exam,A={};$('#v13b').querySelectorAll('.v13q').forEach(q=>{const id=q.dataset.q,r=q.querySelector('input:checked'),t=q.querySelector('textarea');
  if(r)A[id]=r.value;else if(t&&t.value.trim())A[id]=t.value});ex.ans=A;return A}
function v13save(){if(V13.screen!='exam'||!V13.exam)return;v13read();lss('v13cur:'+cur.id,{exam:V13.exam})}
async function v13submit(auto){if(V13.busy)return;const ex=V13.exam;const A=v13read();
 if(!auto&&!confirm('Remettre votre copie maintenant ?'))return;V13.busy=1;v13draw();clearInterval(V13.tm);
 try{const r=await v13call('grade',{exam_id:ex.exam.id,answers:A,duration_seconds:Math.round((Date.now()-(ex.t0||Date.now()))/1000)});
  window.onbeforeunload=null;lss('v13cur:'+cur.id,null);V13.rep={...r,questions:ex.questions,answers:A};V13.screen='rep';V13.exam=null;V13.his=[{id:r.attempt_id,exam_id:ex.exam.id,score:r.score,submitted_at:new Date().toISOString(),report:r.report},...(V13.his||[])]}
 catch(e){toast(v13err(e));if(ex.end&&ex.end>Date.now())V13.tm=setInterval(v13tick,1000)}
 V13.busy=0;v13draw()}

/* ---------- Lecture audio (voix du navigateur) ---------- */
function v13plain(t){return String(t).replace(/\$\$[\s\S]+?\$\$|\$[^\n$]+?\$/g,' formule ').replace(/[#*`>_|-]{1,}/g,' ').replace(/\s+/g,' ')}
async function v13speak(){if(!window.speechSynthesis)return toast('Lecture audio non disponible sur cet appareil');
 if(V13.au==1){V13.au=2;V13.sid++;speechSynthesis.cancel();return}
 const my=++V13.sid;V13.au=1;speechSynthesis.cancel();const C=v8chunks(v13plain(V13.cur.content));
 for(const c of C){if(my!=V13.sid||V13.au!=1)return;await new Promise(r=>{const u=new SpeechSynthesisUtterance(c),to=setTimeout(r,40000);u.lang='fr-FR';u.rate=.95;u.onend=u.onerror=()=>{clearTimeout(to);r()};speechSynthesis.speak(u)})}
 if(my==V13.sid)V13.au=0}
function v13stop(){V13.sid++;V13.au=0;try{speechSynthesis.cancel()}catch(e){}}

/* ---------- Accroche : bouton dans l'écran du cahier (enveloppe openB, comme v8.js) ---------- */
window.v13open=v13open;window.v13close=v13close;window.v13collect=v13collect;window.v13katex=v13katex;
const o13=window.openB;
window.openB=function(){const r=o13.apply(this,arguments);
 try{const f=app.querySelector('.f');if(f&&!$('#v13bt'))f.insertAdjacentHTML('beforeend','<button id=v13bt onclick="v13open()">🎓 Révision &amp; Examen</button>')}catch(e){}return r};
})();
