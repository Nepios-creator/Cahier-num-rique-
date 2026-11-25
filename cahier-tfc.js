/* cahier-tfc : assistant TFC / mémoire / exposé. Plan, bibliographie et citations (mise en forme locale, sans IA : rien d'inventé),
   reformulation, exposé en diapositives tiré des notes (présentation plein écran + export HTML autonome / PDF par impression).
   Réservé aux abonnés (fonction serveur « cn-tfc »). Surcouche : aucune fonction existante n'est modifiée. Dépend de cahier-demande.js. */
(function(){
if(!window.cnxCSS)return;
var T={tab:'plan',busy:0,slides:null};
function P(){D.tfc=D.tfc||{sujet:'',niveau:'',nbs:[],plan:'',refs:[],slides:null,style:'apa'};return D.tfc}
function h(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function copy(t){try{navigator.clipboard.writeText(t).then(function(){toast('Copié')},function(){fb(t)})}catch(e){fb(t)}}
function fb(t){var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');toast('Copié')}catch(e){}a.remove()}
function err(e){return e=='premium_required'?'🎓 L’assistant TFC / mémoire / exposé fait partie de l’abonnement annuel, pensé pour les étudiants de dernière année.':
  e=='limite_atteinte'?'Limite du jour atteinte pour l’assistant (20 demandes). Elle revient demain.':e=='sujet_vide'?'Écrivez d’abord le sujet de votre travail.':e=='texte_trop_court'?'Collez un texte un peu plus long.':window.cnxErr(e)}

/* ---------- Bibliographie : mise en forme locale (APA 7 / ISO 690) ---------- */
function ini(p){return String(p||'').trim().split(/[\s-]+/).filter(Boolean).map(function(x){return x[0].toUpperCase()+'.'}).join(' ')}
function auth(r,style){var a=String(r.auteurs||'').split(/\s*;\s*|\s*\n\s*/).filter(Boolean).map(function(x){var m=x.split(/\s*,\s*/);return {n:(m[0]||'').trim(),p:(m[1]||'').trim()}});
  if(!a.length)return '';
  if(style=='iso')return a.map(function(x){return x.n.toUpperCase()+(x.p?', '+x.p:'')}).join(', ');
  var f=a.map(function(x){return x.n+(x.p?', '+ini(x.p):'')});return f.length==1?f[0]:f.slice(0,-1).join(', ')+' & '+f[f.length-1]}
function fmt(r,style){var A=auth(r,style),y=r.annee||'s.d.',t=r.titre||'',u=r.url?(' '+r.url):'',c=r.consulte?(style=='iso'?' [consulté le '+r.consulte+']':' (consulté le '+r.consulte+')'):'';
  var g=function(a,b){return a?a+b:''};
  if(style=='iso'){
    if(r.type=='article')return g(A,'. ')+t+'. '+g(r.source,', ')+g(r.vol,', ')+y+g(r.pages,', p. ')+'.'+(r.url?' Disponible à l’adresse : '+r.url:'')+c;
    if(r.type=='web')return g(A,'. ')+t+' [en ligne]. '+y+'.'+(r.url?' Disponible à l’adresse : '+r.url:'')+c;
    return g(A,'. ')+t+'. '+g(r.lieu,' : ')+g(r.editeur,', ')+y+'.'}
  if(r.type=='article')return g(A,' ')+'('+y+'). '+t+'. '+g(r.source,', ')+g(r.vol,', ')+g(r.pages,'')+'.'+u;
  if(r.type=='web')return g(A,' ')+'('+y+'). '+t+'.'+u+c;
  return g(A,' ')+'('+y+'). '+t+'. '+g(r.editeur,'.')+u}
function inl(r,style){var a=String(r.auteurs||'').split(/\s*;\s*|\s*\n\s*/).filter(Boolean).map(function(x){return x.split(/\s*,\s*/)[0].trim()}),y=r.annee||'s.d.';
  var n=!a.length?(r.titre||'').split(' ').slice(0,3).join(' '):a.length==1?a[0]:a.length==2?a[0]+' & '+a[1]:a[0]+' et al.';
  return '('+(style=='iso'?n.toUpperCase():n)+', '+y+(r.page?', p. '+r.page:'')+')'}
function sorted(){var p=P();return p.refs.slice().sort(function(a,b){return (auth(a,'apa')||a.titre||'').localeCompare(auth(b,'apa')||b.titre||'','fr')})}

/* ---------- Exposé : export HTML autonome ---------- */
function slideHTML(s,i,n){return '<section class=s><div class=n>'+(i+1)+' / '+n+'</div><h2>'+h(s.titre)+'</h2><ul>'+(s.points||[]).map(function(x){return '<li>'+h(x)+'</li>'}).join('')+'</ul>'
  +(s.notes?'<aside><b>Notes de l’orateur</b> '+h(s.notes)+'</aside>':'')+'</section>'}
function exportHTML(sl,titre){var css='*{box-sizing:border-box}body{margin:0;font:22px/1.45 system-ui,sans-serif;background:#0f1226;color:#eef0ff}.s{display:none;min-height:100vh;padding:7vh 8vw;position:relative}.s.on{display:block}h2{font-size:2em;margin:0 0 .6em;color:#a5b4fc}li{margin:.4em 0}.n{position:absolute;right:4vw;top:3vh;opacity:.5;font-size:.7em}aside{margin-top:2em;font-size:.6em;opacity:.8;border-top:1px solid #fff3;padding-top:.8em}.b{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:8px}.b button{font:inherit;font-size:.7em;padding:8px 18px;border-radius:12px;border:0;background:#6366f1;color:#fff}@media print{body{background:#fff;color:#000}.s{display:block;page-break-after:always;min-height:auto}h2{color:#312e81}.b{display:none}aside{display:block}}';
  return '<!doctype html><html lang=fr><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>'+h(titre)+'</title><style>'+css+'</style><body>'+sl.map(function(s,i){return slideHTML(s,i,sl.length)}).join('')
   +'<div class=b><button onclick=g(-1)>‹</button><button onclick=print()>PDF</button><button onclick=g(1)>›</button></div><script>var a=[].slice.call(document.querySelectorAll(".s")),i=0;function g(d){i=Math.max(0,Math.min(a.length-1,i+d));a.forEach(function(x,k){x.classList.toggle("on",k==i)})}g(0);onkeydown=function(e){if(e.key=="ArrowRight"||e.key==" ")g(1);if(e.key=="ArrowLeft")g(-1)}<\/script></body></html>'}
function download(name,type,txt){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){a.remove()},500)}
function show(sl,i){var o=document.getElementById('cnt1s');if(!o){o=document.createElement('div');o.id='cnt1s';document.body.appendChild(o)}
  var s=sl[i];o.innerHTML='<div class=ct1sl><div class=ct1n>'+(i+1)+' / '+sl.length+'</div><h2>'+h(s.titre)+'</h2><ul>'+(s.points||[]).map(function(x){return '<li>'+h(x)+'</li>'}).join('')+'</ul>'+(s.notes?'<details><summary>Notes de l’orateur</summary><p>'+h(s.notes)+'</p></details>':'')
   +'<div class=ct1b><button id=cnt1p>‹</button><button id=cnt1q>Quitter</button><button id=cnt1r>›</button></div></div>';
  o.querySelector('#cnt1p').onclick=function(){if(i>0)show(sl,i-1)};o.querySelector('#cnt1r').onclick=function(){if(i<sl.length-1)show(sl,i+1)};o.querySelector('#cnt1q').onclick=function(){o.remove()}}

/* ---------- Écran ---------- */
window.cnxCSS('cnt1css','#cnt1{position:fixed;inset:0;z-index:70;background:#000a;display:flex}#cnt1 .ct1w>*{min-width:0}#cnt1 .ct1w{box-sizing:border-box;margin:auto;width:100%;max-width:680px;height:100%;max-height:100dvh;overflow-y:auto;background:var(--bg);padding:12px 14px calc(14px + env(safe-area-inset-bottom,0px));display:grid;gap:10px;align-content:start}#cnt1 .ct1h{display:flex;align-items:center;gap:8px}#cnt1 .ct1h b{flex:1;font-size:18px}#cnt1 .ct1c{padding:12px 14px;border-radius:14px;background:var(--card);border:1px solid var(--line);line-height:1.5}#cnt1 .ct1r{display:flex;gap:8px;flex-wrap:wrap}#cnt1 .ct1r>button{flex:1;min-width:0}#cnt1 input,#cnt1 textarea,#cnt1 select{width:100%;box-sizing:border-box;font:inherit}#cnt1 textarea{min-height:140px}#cnt1 .ct1t{display:flex;gap:6px;overflow-x:auto}#cnt1 .ct1t button{flex:none}#cnt1 .on{background:var(--acc);color:#fff}#cnt1 .ct1o{white-space:pre-wrap}#cnt1 .ct1g{display:grid;grid-template-columns:1fr 1fr;gap:6px}#cnt1s{position:fixed;inset:0;z-index:80;background:#0f1226;color:#eef0ff;display:flex}.ct1sl{margin:auto;width:100%;max-width:900px;padding:6vh 6vw;box-sizing:border-box;max-height:100dvh;overflow-y:auto}.ct1sl h2{font-size:clamp(24px,5vw,40px);color:#a5b4fc;margin:0 0 .6em}.ct1sl li{font-size:clamp(18px,3.4vw,26px);margin:.5em 0}.ct1n{opacity:.5;text-align:right}.ct1b{display:flex;gap:8px;justify-content:center;margin-top:24px}.ct1sl details{margin-top:20px;opacity:.85}');
function body(){var p=P(),w=document.getElementById('cnt1w');if(!w)return;
  var tabs=[['plan','Plan'],['biblio','Bibliographie'],['reform','Reformuler'],['expose','Exposé']];
  var nbs=(D.c||[]).filter(function(c){return !c.del});
  var base='<div class=ct1h><b>🎓 TFC · Mémoire · Exposé</b><button id=cnt1x>✕</button></div>'
   +'<div class=ct1t>'+tabs.map(function(t){return '<button data-t='+t[0]+(T.tab==t[0]?' class=on':'')+'>'+t[1]+'</button>'}).join('')+'</div>';
  var v='';
  if(T.tab=='plan'||T.tab=='expose'){
    v+='<div class=ct1c><b>Sujet</b><input id=cnt1j placeholder="Ex. : Impact de la prescription acquisitive sur la sécurité foncière à Kinshasa" value="'+h(p.sujet)+'" maxlength=300>'
     +(T.tab=='plan'?'<input id=cnt1v placeholder="Niveau (G3, L2, master…)" value="'+h(p.niveau)+'" maxlength=80 style="margin-top:6px">':'')
     +'<div class=hint style="margin:8px 0 4px">Cahiers à utiliser comme source :</div><div class=ct1g>'+nbs.map(function(c){var on=p.nbs.length?p.nbs.indexOf(c.id)>=0:(typeof cur!=='undefined'&&cur&&cur.id==c.id);return '<label><input type=checkbox data-n="'+h(c.id)+'"'+(on?' checked':'')+' style="width:auto"> '+h(c.cours)+'</label>'}).join('')+'</div></div>'}
  if(T.tab=='plan'){v+='<button class=p id=cnt1g>✨ Proposer un plan</button><div class=ct1c><b>Votre plan (modifiable)</b><textarea id=cnt1pl placeholder="Le plan apparaît ici. Vous pouvez le corriger à la main.">'+h(p.plan)+'</textarea><div class=ct1r><button id=cnt1c>Copier</button></div></div><div class=hint>Le plan s’appuie sur vos notes ; il ne contient ni auteur ni référence inventés. Vérifiez-le avec votre directeur de travail.</div>'}
  if(T.tab=='expose'){v+='<button class=p id=cnt1g>✨ Créer l’exposé depuis mes notes</button><div id=cnt1sl>'+(p.slides?'':'<div class=hint>Les diapositives sont construites uniquement à partir de vos notes et audios transcrits.</div>')+'</div>'}
  if(T.tab=='reform'){v+='<div class=ct1c><b>Texte à reformuler</b><textarea id=cnt1tx placeholder="Collez ici un paragraphe de votre travail"></textarea><div class=ct1r style="margin-top:8px"><select id=cnt1tn><option value=acad>Style académique</option><option value=simple>Plus simple</option></select><button class=p id=cnt1g>Reformuler</button></div></div><div class="ct1c ct1o" id=cnt1ou style="display:none"></div><div class=hint>Reformulez votre propre texte. Si vous reprenez une idée d’un auteur, citez-le toujours (onglet Bibliographie).</div>'}
  if(T.tab=='biblio'){var st=p.style||'apa';
    v+='<div class=ct1c><b>Ajouter une référence</b><div class=ct1r style="margin:6px 0"><select id=cnt1ty><option value=livre>Livre</option><option value=article>Article</option><option value=web>Site web</option></select><select id=cnt1st><option value=apa'+(st=='apa'?' selected':'')+'>APA 7</option><option value=iso'+(st=='iso'?' selected':'')+'>ISO 690</option></select></div>'
     +'<input id=cnt1a placeholder="Auteur(s) : Nom, Prénom ; Nom, Prénom" style="margin-bottom:6px"><input id=cnt1y placeholder="Année" style="margin-bottom:6px"><input id=cnt1t placeholder="Titre" style="margin-bottom:6px">'
     +'<input id=cnt1e placeholder="Éditeur (livre)" style="margin-bottom:6px"><input id=cnt1l placeholder="Ville (ISO, livre)" style="margin-bottom:6px"><input id=cnt1s2 placeholder="Revue / site (article, web)" style="margin-bottom:6px"><input id=cnt1vo placeholder="Volume(n°) (article)" style="margin-bottom:6px"><input id=cnt1pa placeholder="Pages (article)" style="margin-bottom:6px"><input id=cnt1u placeholder="Adresse web (facultatif)" style="margin-bottom:6px"><input id=cnt1d placeholder="Date de consultation (web)" style="margin-bottom:8px">'
     +'<button class=p id=cnt1add>Ajouter à la bibliographie</button></div><div class=ct1c><b>Bibliographie</b><div id=cnt1bl class=ct1o></div><div class=ct1r style="margin-top:8px"><button id=cnt1cb>Copier la liste</button></div></div>'
     +'<div class=hint>La mise en forme est automatique et locale : vous saisissez les informations vraies de la source, rien n’est inventé. Touchez une référence pour copier sa citation dans le texte.</div>'}
  w.innerHTML=base+v;wire()}
function sync2(){var p=P(),g=function(i){var e=document.getElementById(i);return e?e.value:null};var j=g('cnt1j');if(j!==null)p.sujet=j;var n=g('cnt1v');if(n!==null)p.niveau=n;
  var cs=document.querySelectorAll('#cnt1 [data-n]');if(cs.length)p.nbs=[].filter.call(cs,function(c){return c.checked}).map(function(c){return c.dataset.n});var pl=g('cnt1pl');if(pl!==null)p.plan=pl;raw()}
async function gather(){var p=P(),out=[],k=0,ids=p.nbs.length?p.nbs:((typeof cur!=='undefined'&&cur)?[cur.id]:[]);
  for(var i=0;i<ids.length;i++){var c=D.c.filter(function(x){return x.id==ids[i]&&!x.del})[0];if(!c)continue;var A=await window.cnxPassages(c),r=window.cnxPick(p.sujet,A),top=(r.top.length?r.top:A.slice(0,6)).slice(0,10);
    top.forEach(function(x){out.push({id:'S'+(++k),label:c.cours+' · '+x.label,text:x.text.slice(0,900),src:x.src,nb:c.id})})}
  return out.slice(0,24)}
async function call(body,out){if(T.busy)return;T.busy=1;out.style.display='block';out.textContent='Un instant…';
  try{var j=await window.cnxCall('cn-tfc',Object.assign({lang:window.cnxLang()},body));if(j.error){out.textContent=err(j.error);return null}return j}
  catch(e){out.textContent=err(String(e&&e.message||e));return null}finally{T.busy=0}}
function wire(){var o=document.getElementById('cnt1'),p=P(),$=function(i){return document.getElementById(i)};
  $('cnt1x').onclick=function(){sync2();o.remove()};
  [].forEach.call(o.querySelectorAll('[data-t]'),function(b){b.onclick=function(){sync2();T.tab=b.dataset.t;body()}});
  var g=$('cnt1g');
  if(T.tab=='plan'&&g)g.onclick=async function(){sync2();var pass=await gather(),st=document.createElement('div');
    var j=await call({mode:'plan',sujet:p.sujet,niveau:p.niveau,passages:pass},st);if(!j){toast(st.textContent||'Échec');return}
    p.plan=j.plan.map(function(c,i){return (i+1)+'. '+c.titre+(c.sous.length?'\n'+c.sous.map(function(s){return '   - '+s}).join('\n'):'')}).join('\n\n')+(j.conseils&&j.conseils.length?'\n\nConseils :\n'+j.conseils.map(function(x){return '• '+x}).join('\n'):'');raw();body()};
  if(T.tab=='plan'){$('cnt1c').onclick=function(){sync2();copy(P().plan)}}
  if(T.tab=='reform'&&g)g.onclick=async function(){var t=$('cnt1tx').value,out=$('cnt1ou'),j=await call({mode:'reformuler',texte:t,ton:$('cnt1tn').value},out);if(j){out.innerHTML='';var d=document.createElement('div');d.textContent=j.texte;var b=document.createElement('button');b.textContent='Copier';b.style.marginTop='8px';b.onclick=function(){copy(j.texte)};out.appendChild(d);out.appendChild(b)}};
  if(T.tab=='expose'){var L=$('cnt1sl');var draw=function(){var s=P().slides;if(!s)return;L.innerHTML='<div class=ct1c><b>'+s.length+' diapositives</b><div class=ct1o>'+s.map(function(x,i){return (i+1)+'. '+h(x.titre)+'\n   '+x.points.map(h).join('\n   ')}).join('\n\n')+'</div></div><div class=ct1r><button class=p id=cnt1pr>▶ Présenter</button><button id=cnt1ex>Exporter (HTML / PDF)</button></div><div class=hint>« Exporter » télécharge une page autonome : ouvrez-la puis « PDF » pour l’imprimer en PDF. Pas de fichier PowerPoint.</div>';
      $('cnt1pr').onclick=function(){show(P().slides,0)};$('cnt1ex').onclick=function(){download('expose.html','text/html',exportHTML(P().slides,P().sujet||'Exposé'))}};draw();
    if(g)g.onclick=async function(){sync2();var pass=await gather();if(!pass.length){L.innerHTML='<div class=ct1c>'+h(window.cnxErr('cahier_vide'))+'</div>';return}
      var out=document.createElement('div');out.className='ct1c';L.innerHTML='';L.appendChild(out);var j=await call({mode:'expose',sujet:p.sujet,passages:pass},out);if(!j)return;
      var lab={};pass.forEach(function(x){lab[x.id]=x});P().slides=j.slides.map(function(s){var src=[];s.sources.forEach(function(id){if(lab[id]&&src.indexOf(lab[id].label)<0)src.push(lab[id].label)});return Object.assign(s,{notes:(s.notes||'')+(src.length?' [Sources : '+src.join(' ; ')+']':'')})});raw();draw()}}
  if(T.tab=='biblio'){var bl=$('cnt1bl'),pp=P();
    var rd=function(){var st=$('cnt1st').value;pp.style=st;var s=sorted();bl.innerHTML='';if(!s.length){bl.textContent='Aucune référence pour l’instant.';return}
      s.forEach(function(r){var d=document.createElement('div');d.style.cssText='margin:0 0 10px;padding-left:1.5em;text-indent:-1.5em;cursor:pointer';d.textContent=fmt(r,st);d.title='Toucher pour copier la citation dans le texte : '+inl(r,st);
        d.onclick=function(){copy(inl(r,st))};var x=document.createElement('button');x.textContent='🗑';x.style.cssText='margin-left:8px;text-indent:0;padding:2px 8px';x.onclick=function(ev){ev.stopPropagation();pp.refs=pp.refs.filter(function(q){return q!==r});raw();rd()};d.appendChild(x);bl.appendChild(d)})};
    rd();$('cnt1st').onchange=function(){rd();raw()};
    $('cnt1add').onclick=function(){var v=function(i){return ($(i).value||'').trim()},r={type:$('cnt1ty').value,auteurs:v('cnt1a'),annee:v('cnt1y'),titre:v('cnt1t'),editeur:v('cnt1e'),lieu:v('cnt1l'),source:v('cnt1s2'),vol:v('cnt1vo'),pages:v('cnt1pa'),url:v('cnt1u'),consulte:v('cnt1d')};
      if(!r.titre)return toast('Le titre est obligatoire');if(!r.auteurs&&!r.annee)toast('Sans auteur ni année, la référence sera incomplète');pp.refs.push(r);raw();['cnt1a','cnt1y','cnt1t','cnt1e','cnt1l','cnt1s2','cnt1vo','cnt1pa','cnt1u','cnt1d'].forEach(function(i){$(i).value=''});rd()};
    $('cnt1cb').onclick=function(){copy(sorted().map(function(r){return fmt(r,$('cnt1st').value)}).join('\n\n'))}}}
window.cnt1Open=function(){var o=document.getElementById('cnt1');if(o)o.remove();o=document.createElement('div');o.id='cnt1';o.innerHTML='<div class=ct1w id=cnt1w></div>';document.body.appendChild(o);P();body()};
var ob=window.openB;if(typeof ob=='function')window.openB=function(){var r=ob.apply(this,arguments);try{window.cnxBtn('cnt1b','🎓 TFC · Mémoire · Exposé',window.cnt1Open,false)}catch(e){}return r};
window.cnt1Fmt=fmt;window.cnt1Inl=inl;
})();
