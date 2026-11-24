/* cahier-demande : « Demande à ton cahier ». Répond uniquement à partir des notes et des transcriptions d'audio du cahier ouvert,
   avec renvoi vers la source (page ou audio). Texte uniquement. 10 réponses par jour et par cahier (limite appliquée côté serveur).
   Dépend de la fonction serveur « cn-demande » (supabase/functions/cn-demande). À charger après les scripts vNN.js.
   Surcouche : aucun fichier existant n'est modifié ; le bouton est ajouté à l'écran d'un cahier. */
(function(){
var MAXJ=10, LANGS=[['fr','Français'],['ln','Lingala'],['sw','Kiswahili'],['en','English']];
var STOP=' le la les un une des de du et en au aux que qui quoi est sont dans pour par sur avec ce cet cette ces il elle ils elles on nous vous je tu mon ton son ses leur leurs mais ou donc car ne pas plus se sa a ont ete etre fait dit prof professeur cours explique moi ca comment quel quelle quels quelles ';
var S={nb:null,rest:null,mode:'repondre',busy:0,log:[]};

/* ---------- Outils communs aux modules cahier-* ---------- */
window.cnxBtn=window.cnxBtn||function(id,label,fn,primary){
  var box=document.getElementById('cnx');
  if(!box){var hero=document.querySelector('.hero');if(!hero)return;box=document.createElement('div');box.id='cnx';box.className='f';hero.insertAdjacentElement('afterend',box)}
  if(document.getElementById(id))return;
  var b=document.createElement('button');b.id=id;b.textContent=label;if(primary)b.className='p';b.onclick=fn;box.appendChild(b)};
window.cnxCSS=window.cnxCSS||function(id,css){if(document.getElementById(id))return;var s=document.createElement('style');s.id=id;s.textContent=css;document.head.appendChild(s)};
window.cnxLang=window.cnxLang||function(){try{return (D&&D.lg38)||'fr'}catch(e){return 'fr'}};
window.cnxSetLang=window.cnxSetLang||function(l){D.lg38=l;raw()};
window.cnxCall=window.cnxCall||async function(fn,body){
  if(!navigator.onLine)throw new Error('hors_ligne');
  if(typeof D==='undefined'||!D.s)throw new Error('non_connecte');
  await tok();
  var r=await fetch(SB+'/functions/v1/'+fn,{method:'POST',headers:Object.assign({},stH(),{'Content-Type':'application/json'}),body:JSON.stringify(body)});
  var j={};try{j=await r.json()}catch(e){}
  if(!r.ok&&!j.error)j.error='erreur_'+r.status;
  return j};
window.cnxErr=window.cnxErr||function(e){return ({
  hors_ligne:'Cette fonction a besoin d’internet. Vos notes restent disponibles hors ligne.',
  non_connecte:'Connectez-vous à votre compte (⋯ → Sauvegarde en ligne) pour utiliser cette fonction.',
  non_valide:'Votre compte n’est pas encore activé.',
  premium_required:'Cette fonction est réservée aux abonnés.',
  limite_atteinte:'Vous avez utilisé vos '+MAXJ+' réponses du jour pour ce cahier. Elles reviennent demain, à minuit (heure de Kinshasa).',
  cahier_vide:'Ce cahier ne contient pas encore assez de notes ou de transcriptions.',
  question_vide:'Écrivez votre question.',
  no_key:'L’assistant n’est pas encore activé côté serveur.'}[e]||('Échec : '+e))};

/* ---------- Passages du cahier (notes + transcriptions) ---------- */
function chunk(t,max){t=String(t||'').replace(/\s+/g,' ').trim();if(!t)return[];var S2=t.match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g)||[t],out=[],c='';
  S2.forEach(function(s){if(c.length+s.length>max&&c){out.push(c.trim());c=''}c+=s;while(c.length>max*1.6){out.push(c.slice(0,max));c=c.slice(max)}});if(c.trim())out.push(c.trim());return out}
async function passages(c){var out=[],n=0,a=0;
  for(var i=0;i<c.pages.length;i++){var p=c.pages[i],lab='Page '+(i+1)+(p.chap?' · '+p.chap:'')+(p.sujet?' — '+p.sujet:'');
    var t=[p.chap,p.sujet,txt(p.html)].filter(Boolean).join('. ');
    chunk(t,650).forEach(function(x){out.push({id:'P'+(++n),label:lab,text:x,src:{k:'p',pid:p.id,i:i+1}})});
    var cp=p.cpl||[];cp.forEach(function(q){chunk(txt(q.h),650).forEach(function(x){out.push({id:'P'+(++n),label:lab+' · note complémentaire',text:x,src:{k:'p',pid:p.id,i:i+1}})})});
    var at=p.att||[];
    for(var j=0;j<at.length;j++){var x0=at[j];if(x0.k!='a'||!x0.tr)continue;var tr='';try{tr=await fget('tr:'+x0.id)||''}catch(e){}
      var k=0;chunk(tr,650).forEach(function(x){k++;out.push({id:'A'+(++a),label:'Audio « '+(x0.n||'enregistrement')+' » (page '+(i+1)+') · partie '+k,text:x,src:{k:'a',aid:x0.id,pid:p.id,i:i+1,n:x0.n||'Audio'}})})}}
  return out}
function toks(t){return (nz(String(t||'')).match(/[a-z0-9]{3,}/g)||[]).filter(function(w){return STOP.indexOf(' '+w+' ')<0})}
function pick(q,P){var qt=toks(q);if(!qt.length)return{top:P.slice(0,12),hit:0};
  var docs=P.map(function(p){var t=toks(p.text+' '+p.label),m={};t.forEach(function(w){m[w]=(m[w]||0)+1});return m}),N=P.length;
  var sc=P.map(function(p,i){var s=0;qt.forEach(function(w){var pre=w.slice(0,5),tf=0,df=0;
      Object.keys(docs[i]).forEach(function(d){if(d===w||(pre.length>=4&&d.indexOf(pre)===0))tf+=docs[i][d]});
      if(!tf)return;docs.forEach(function(m){for(var d in m){if(d===w||(pre.length>=4&&d.indexOf(pre)===0)){df++;break}}});
      s+=(1+Math.log(tf))*Math.log(1+N/(1+df))});return{p:p,s:s}});
  var hit=sc.filter(function(x){return x.s>0}).length;sc.sort(function(a,b){return b.s-a.s});
  return{top:sc.slice(0,12).filter(function(x){return x.s>0}).map(function(x){return x.p}),hit:hit}}

/* ---------- Écran ---------- */
window.cnxCSS('cnk1css','#cnk1{position:fixed;inset:0;z-index:70;background:#000a;display:flex}#cnk1 .ck1w{box-sizing:border-box;margin:auto;width:100%;max-width:640px;height:100%;max-height:100dvh;display:flex;flex-direction:column;background:var(--bg);padding:12px 14px calc(12px + env(safe-area-inset-bottom,0px))}#cnk1 .ck1h{display:flex;align-items:center;gap:8px}#cnk1 .ck1h b{flex:1;font-size:18px}#cnk1 .ck1l{flex:1;overflow-y:auto;margin:10px 0;display:grid;gap:10px;align-content:start}#cnk1 .ck1q,#cnk1 .ck1a{padding:10px 14px;border-radius:16px;line-height:1.55;white-space:pre-wrap;word-break:break-word}#cnk1 .ck1q{background:var(--acc);color:#fff;justify-self:end;max-width:88%}#cnk1 .ck1a{background:var(--card);border:1px solid var(--line)}#cnk1 .ck1s{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#cnk1 .ck1r{display:flex;gap:8px}#cnk1 input.ck1t{flex:1;min-width:0}#cnk1 .ck1c{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}');
function cnt(){var e=document.getElementById('cnk1n');if(e)e.textContent=S.rest==null?'':(S.rest+'/'+MAXJ+' réponses aujourd’hui')}
function add(kind,text,srcs){var lg=document.getElementById('cnk1l');if(!lg)return null;var d=document.createElement('div');d.className='ck1'+kind;
  if(kind=='a'&&srcs){var parts=String(text).split(/\[([PA]\d+)\]/g);parts.forEach(function(x,i){if(i%2==0){d.appendChild(document.createTextNode(x))}else{var s=srcs.map[x];if(s){var sp=document.createElement('sup');sp.textContent='['+(srcs.order.indexOf(x)+1)+']';d.appendChild(sp)}}})}
  else d.textContent=text;
  if(kind=='a'&&srcs&&srcs.order.length){var box=document.createElement('div');box.className='ck1s';
    srcs.order.forEach(function(id,i){var s=srcs.map[id];var b=document.createElement('button');b.className='ch';b.textContent='['+(i+1)+'] '+(s.src.k=='a'?'🎙 '+s.src.n:'📄 Page '+s.src.i);b.title=s.label;b.onclick=function(){go(s.src)};box.appendChild(b)});d.appendChild(box)}
  lg.appendChild(d);lg.scrollTop=lg.scrollHeight;return d}
function go(s){var o=document.getElementById('cnk1');if(o)o.remove();try{openB(cur.id);openP(s.pid);if(s.k=='a'&&typeof v11view=='function')setTimeout(function(){v11view(s.aid)},350)}catch(e){}}
async function refresh(){if(!navigator.onLine||!D.s||!cur)return;try{var j=await window.cnxCall('cn-demande',{notebook_id:cur.id,peek:true});if(j&&typeof j.restant=='number'){S.rest=j.restant;cnt()}}catch(e){}}
async function ask(q){if(S.busy)return;q=String(q||'').trim();if(q.length<3)return toast('Écrivez votre question');
  if(!navigator.onLine)return toast(window.cnxErr('hors_ligne'));
  S.busy=1;add('q',q);var wait=add('a','Je cherche dans vos notes et vos audios…');
  try{var P=await passages(cur);
    if(!P.length){wait.textContent=window.cnxErr('cahier_vide');return}
    var r=pick(q,P);
    if(!r.top.length&&P.length>12){wait.textContent='Je ne trouve pas cela dans votre cahier. Essayez avec les mots employés dans le cours.';return}
    var top=r.top.length?r.top:P.slice(0,12);
    var j=await window.cnxCall('cn-demande',{notebook_id:cur.id,question:q,mode:S.mode,lang:window.cnxLang(),passages:top.map(function(p){return{id:p.id,label:p.label,text:p.text}})});
    if(j.error){wait.textContent=window.cnxErr(j.error);if(typeof j.restant=='number'){S.rest=j.restant;cnt()}return}
    var map={};top.forEach(function(p){map[p.id]=p});var used=(j.sources||[]).filter(function(id){return map[id]});
    // Un seul bouton par page ou audio, même si plusieurs extraits de la même source sont cités.
    var seen={},order=[],canon={};used.forEach(function(id){var key=map[id].src.k+':'+(map[id].src.aid||map[id].src.pid);if(!seen[key]){seen[key]=id;order.push(id)}canon[id]=seen[key]});
    var ans=String(j.answer||'').replace(/\[([PA]\d+)\]/g,function(m,id){return canon[id]?'['+canon[id]+']':''});
    wait.remove();add('a',ans,{map:map,order:order});
    if(typeof j.restant=='number'){S.rest=j.restant;cnt()}
  }catch(e){wait.textContent=window.cnxErr(String(e&&e.message||e))}finally{S.busy=0}}
window.cnk1Open=function(){if(!cur)return;if(S.nb!==cur.id){S.nb=cur.id;S.log=[];S.rest=null}
  var o=document.getElementById('cnk1');if(o)o.remove();o=document.createElement('div');o.id='cnk1';
  o.innerHTML='<div class=ck1w><div class=ck1h><b>🔎 Demande à ton cahier</b><span class=hint id=cnk1n></span><button id=cnk1x>✕</button></div>'
   +'<div class=hint>Réponses uniquement tirées de vos notes et de vos audios transcrits de « '+esc(cur.cours)+' ».</div>'
   +'<div class=ck1c id=cnk1m><button class="ch on" data-m=repondre>Répondre</button><button class=ch data-m=simple>Explique-moi simplement</button><select id=cnk1g class=ch>'+LANGS.map(function(l){return '<option value='+l[0]+(window.cnxLang()==l[0]?' selected':'')+'>'+l[1]+'</option>'}).join('')+'</select></div>'
   +'<div class=ck1l id=cnk1l><div class=ck1a>Posez une question sur ce cours, par exemple « Qu’a dit le prof sur la synapse ? » ou « Explique-moi la prescription ».</div></div>'
   +'<div class=ck1r><input class=ck1t id=cnk1q placeholder="Votre question…" maxlength=600><button class=p style="width:auto;padding:10px 18px" id=cnk1s>Envoyer</button></div></div>';
  document.body.appendChild(o);
  document.getElementById('cnk1x').onclick=function(){o.remove()};
  document.getElementById('cnk1g').onchange=function(){window.cnxSetLang(this.value)};
  Array.prototype.forEach.call(o.querySelectorAll('#cnk1m button'),function(b){b.onclick=function(){S.mode=b.dataset.m;Array.prototype.forEach.call(o.querySelectorAll('#cnk1m button'),function(x){x.classList.toggle('on',x===b)})}});
  var qi=document.getElementById('cnk1q'),go2=function(){var v=qi.value;qi.value='';ask(v)};
  document.getElementById('cnk1s').onclick=go2;qi.onkeydown=function(e){if(e.key=='Enter')go2()};
  cnt();refresh()};

/* ---------- Bouton dans l'écran du cahier ---------- */
var ob=window.openB;if(typeof ob=='function')window.openB=function(){var r=ob.apply(this,arguments);try{window.cnxBtn('cnk1b','🔎 Demande à ton cahier',window.cnk1Open,false)}catch(e){}return r};
})();
