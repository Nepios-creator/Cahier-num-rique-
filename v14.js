/* Cahier numérique v14 : outils pour cours techniques — palette de symboles, formules (LaTeX / chimie), zone de dessin.
   À charger APRÈS v13.js. N'ajoute que des boutons dans la barre d'une page ouverte en écriture ; aucune fonction existante n'est modifiée.
   - Symboles : insérés comme du texte à l'endroit du curseur.
   - Formules : LaTeX ($x^2$, \int…, \ce{H2O}) rendues avec KaTeX, conservées avec leur source (data-tex).
   - Dessin : inséré comme image dans la page, avec une légende que la révision et l'examen lisent. */
(()=>{
const E=esc;
(()=>{const s=document.createElement('style');s.textContent=`
#v14o{position:fixed;inset:0;z-index:160;background:#000a;display:flex;align-items:flex-end}
#v14o .v14b{background:var(--bg);color:var(--ink);width:100%;max-height:80%;overflow:auto;border-radius:16px 16px 0 0;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
.v14g{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.v14g button{min-width:40px;padding:8px 6px;font-size:18px}
.v14t{display:flex;gap:6px;overflow-x:auto}.v14t button{white-space:nowrap}.v14t .on{background:var(--acc);color:#fff}
#v14c{width:100%;height:300px;background:#fff;border:1px solid var(--line);border-radius:10px;touch-action:none;display:block}
.v14pv{min-height:44px;padding:8px;border:1px dashed var(--line);border-radius:10px;margin:8px 0;overflow-x:auto}
.v14m{display:inline-block}
`;document.head.appendChild(s)})();

const SYM={
 'Maths':['±','×','÷','≠','≈','≤','≥','∞','√','∛','∑','∏','∫','∬','∂','∇','∈','∉','⊂','⊃','∪','∩','∅','∀','∃','⇒','⇔','→','←','↔','²','³','ⁿ','₀','₁','₂','₃','ₙ','½','¼','¾','%','‰','°','′','″','∠','⊥','∥','ℝ','ℕ','ℤ','ℚ','ℂ'],
 'Grec':['α','β','γ','δ','ε','ζ','η','θ','λ','μ','ν','ξ','π','ρ','σ','τ','φ','χ','ψ','ω','Γ','Δ','Θ','Λ','Ξ','Π','Σ','Φ','Ψ','Ω'],
 'Chimie':['→','⇌','⇄','↑','↓','⁺','⁻','²⁺','³⁺','²⁻','₂','₃','₄','°C','Δ','⚗','·','‡','⟶','⟵'],
 'Physique':['Ω','μ','Δ','λ','ν','ρ','σ','τ','φ','ω','°','·','×','±','∝','≈','ℏ','⃗','⁻¹','⁻²','m·s⁻¹','kg·m²','J','W','N','Pa','Hz'],
 'Droit':['§','¶','©','®','™','«','»','—','–','…','№','€','£','$','¤','⚖','†']
};
const FOR=[
 ['Fraction','\\frac{a}{b}'],['Racine','\\sqrt{x}'],['Puissance','x^{2}'],['Indice','x_{i}'],['Somme','\\sum_{i=1}^{n} x_i'],
 ['Intégrale','\\int_{a}^{b} f(x)\\,dx'],['Limite','\\lim_{x \\to 0} \\frac{\\sin x}{x}'],['Matrice','\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'],
 ['Eau','\\ce{H2O}'],['Réaction','\\ce{2H2 + O2 -> 2H2O}'],['Équilibre','\\ce{N2 + 3H2 <=> 2NH3}'],['Ion','\\ce{SO4^2-}']
];

const open=h=>{close();const o=document.createElement('div');o.id='v14o';o.innerHTML='<div class=v14b>'+h+'</div>';o.onclick=e=>{if(e.target==o)close()};document.body.appendChild(o);return o};
const close=()=>{const o=$('#v14o');if(o)o.remove()};
const editing=()=>{const e=$('#ed');return!!(e&&e.isContentEditable)};

/* ---------- Symboles ---------- */
function v14sym(tab){if(!editing())return toast('Ouvrez une page en écriture');tab=tab||'Maths';
 const o=open(`<div class=drh><b>Ω Symboles</b><button onclick="v14close()">✕</button></div><div class=v14t>${Object.keys(SYM).map(k=>`<button class="${k==tab?'on':''}" data-t="${k}">${k}</button>`).join('')}</div><div class=v14g>${SYM[tab].map(s=>`<button data-s="${E(s)}" onpointerdown="event.preventDefault()">${E(s)}</button>`).join('')}</div><p class=hint>Touchez un symbole pour l’insérer à l’endroit du curseur.</p>`);
 o.onclick=e=>{if(e.target==o)return close();const t=e.target.closest('[data-t]'),s=e.target.closest('[data-s]');if(t)v14sym(t.dataset.t);else if(s)putH(s.dataset.s,1)}}

/* ---------- Formules ---------- */
async function v14form(){if(!editing())return toast('Ouvrez une page en écriture');
 const o=open(`<div class=drh><b>∑ Formule</b><button onclick="v14close()">✕</button></div><div class=v14g>${FOR.map((f,i)=>`<button style="font-size:14px" data-f="${i}">${E(f[0])}</button>`).join('')}</div><textarea id=v14i rows=3 style="width:100%;box-sizing:border-box;font:16px monospace" placeholder="LaTeX : \\frac{a}{b}   ou chimie : \\ce{H2O}"></textarea><div class=v14pv id=v14pv></div><label style="display:block;margin:6px 0"><input type=checkbox id=v14d> Formule centrée (grande)</label><div class=f><button class=p id=v14ok>Insérer dans la page</button></div><p class=hint id=v14h></p>`);
 const i=$('#v14i'),pv=$('#v14pv');let ok=0;const rend=()=>{try{pv.innerHTML=katex.renderToString(i.value||'\\ ',{throwOnError:false,displayMode:$('#v14d').checked});ok=1}catch(e){pv.textContent='Formule invalide'}};
 try{await v13katex();if(!window.katex)throw 0}catch(e){$('#v14h').textContent='Connexion nécessaire la première fois pour charger le moteur de formules.';return}
 i.oninput=rend;$('#v14d').onchange=rend;rend();i.focus();
 o.onclick=e=>{if(e.target==o)return close();const f=e.target.closest('[data-f]');if(f){i.value=FOR[+f.dataset.f][1];rend()}};
 $('#v14ok').onclick=()=>{const t=i.value.trim();if(!t)return;let h;try{h=katex.renderToString(t,{throwOnError:true,displayMode:$('#v14d').checked})}catch(e){return toast('Formule invalide')}
  close();putH(`<span class=v14m data-tex="${E(t)}" contenteditable=false>${h}</span>&nbsp;`)}}

/* ---------- Dessin ---------- */
function v14draw(){if(!editing())return toast('Ouvrez une page en écriture');
 const o=open(`<div class=drh><b>✏️ Dessin</b><button onclick="v14close()">✕</button></div><canvas id=v14c></canvas><div class=f style="flex-direction:row;flex-wrap:wrap"><button data-c="#111827">⚫</button><button data-c="#dc2626">🔴</button><button data-c="#2563eb">🔵</button><button data-c="#16a34a">🟢</button><button data-w=2>Fin</button><button data-w=5>Moyen</button><button data-w=10>Épais</button><button data-g=1>⬜ Gomme</button><button data-u=1>↶ Annuler</button><button data-x=1>🗑 Effacer</button></div><label style="display:block;margin-top:8px">Légende (lue par la révision et l’examen) <input id=v14l placeholder="ex. Schéma d’un circuit RLC en série : R, L, C et source" style="width:100%;box-sizing:border-box"></label><div class=f><button class=p id=v14ok>Insérer dans la page</button></div>`);
 const cv=$('#v14c'),W=Math.round(cv.getBoundingClientRect().width)||320,H=300,dpr=Math.min(2,window.devicePixelRatio||1);
 cv.width=W*dpr;cv.height=H*dpr;const g=cv.getContext('2d');g.scale(dpr,dpr);
 let S=[],cur=null,col='#111827',w=3,er=0;
 const redraw=()=>{g.fillStyle='#fff';g.fillRect(0,0,W,H);for(const s of S){g.strokeStyle=s.c;g.lineWidth=s.w;g.lineCap=g.lineJoin='round';g.beginPath();s.p.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));if(s.p.length==1)g.lineTo(s.p[0][0]+.1,s.p[0][1]);g.stroke()}};
 const pt=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height]};
 cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);cur={c:er?'#fff':col,w:er?w*3:w,p:[pt(e)]};S.push(cur);redraw()};
 cv.onpointermove=e=>{if(!cur)return;cur.p.push(pt(e));redraw()};
 cv.onpointerup=cv.onpointercancel=()=>{cur=null};
 redraw();
 o.onclick=e=>{if(e.target==o)return close();const b=e.target.closest('button');if(!b)return;
  if(b.dataset.c){col=b.dataset.c;er=0}else if(b.dataset.w)w=+b.dataset.w;else if(b.dataset.g)er=1;else if(b.dataset.u){S.pop();redraw()}else if(b.dataset.x){S=[];redraw()}};
 $('#v14ok').onclick=()=>{if(!S.length)return toast('Dessinez quelque chose');const cap=$('#v14l').value.trim();
  const k=Math.min(1,1000/Math.max(W,H)),c=document.createElement('canvas');c.width=Math.round(W*k*2);c.height=Math.round(H*k*2);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(cv,0,0,c.width,c.height);
  const url=c.toDataURL('image/jpeg',.75);close();
  putH(`<img src="${url}" alt="${E(cap||'Dessin sans légende')}" style="max-width:100%;border-radius:12px;background:#fff"><br>`);
  if(!cap)toast('Astuce : ajoutez une légende pour que la révision comprenne votre dessin')}}

window.v14sym=v14sym;window.v14form=v14form;window.v14draw=v14draw;window.v14close=close;

/* ---------- Accroche : boutons dans la barre d'une page en écriture (enveloppe draw, comme v8.js) ---------- */
const d14=window.draw;
window.draw=function(a,b){d14.apply(this,arguments);
 try{const tb=$('.tb');if(tb&&editing()&&!tb.querySelector('.v14x')){tb.insertAdjacentHTML('beforeend',[['v14sym()','Ω'],['v14form()','∑'],['v14draw()','✏️']].map(x=>P(x[0],x[1]).replace('<button','<button class=v14x')).join(''));}
  const e=$('#ed');if(e&&e.querySelector('[data-tex]'))v13katex().catch(()=>{})}catch(x){}};
})();
