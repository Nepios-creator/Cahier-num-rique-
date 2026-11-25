/* cahier-langues : résumés/explications en lingala, kiswahili, English + vocabulaire par cours pour la transcription.
   Surcouche : n'altère aucune fonction existante. Dépend de cahier-demande.js (aides cnx*) et de la fonction serveur « cn-langue ».
   Vocabulaire : termes du cours (un par ligne) → envoyés avec l'audio ET utilisés pour corriger localement la transcription reçue. */
(function(){
var LN={fr:'Français',ln:'Lingala',sw:'Kiswahili',en:'English'};
if(!window.cnxCSS)return;
window.cnxCSS('cnl1css','#cnl1{position:fixed;inset:0;z-index:70;background:#000a;display:flex}#cnl1 .cl1w{box-sizing:border-box;margin:auto;width:100%;max-width:640px;height:100%;max-height:100dvh;overflow-y:auto;background:var(--bg);padding:12px 14px calc(14px + env(safe-area-inset-bottom,0px));display:grid;gap:10px;align-content:start}#cnl1 .cl1h{display:flex;align-items:center;gap:8px}#cnl1 .cl1h b{flex:1;font-size:18px}#cnl1 textarea{width:100%;box-sizing:border-box;min-height:110px}#cnl1 .cl1o{white-space:pre-wrap;line-height:1.55;padding:10px 14px;border-radius:14px;background:var(--card);border:1px solid var(--line)}#cnl1 .cl1r{display:flex;gap:8px;flex-wrap:wrap}');

/* ---------- Vocabulaire du cours ---------- */
function terms(){var v=(typeof cur!=='undefined'&&cur&&cur.voc)||'';return v.split(/[\n,;]+/).map(function(x){return x.trim()}).filter(function(x){return x.length>=4}).slice(0,200)}
function lev(a,b,m){if(Math.abs(a.length-b.length)>m)return m+1;var p=[],i,j;for(j=0;j<=b.length;j++)p[j]=j;
  for(i=1;i<=a.length;i++){var c=[i],lo=i;for(j=1;j<=b.length;j++){c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));if(c[j]<lo)lo=c[j]}if(lo>m)return m+1;p=c}return p[b.length]}
function norm(s){return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'')}
/* Remplace dans le texte les mots/expressions proches (1 à 2 fautes) d'un terme du vocabulaire par ce terme exact. */
window.cnlCorrect=function(text,list){list=list||terms();if(!list.length||!text)return text;
  var tk=String(text).split(/(\s+)/),words=[],i;for(i=0;i<tk.length;i++)if(i%2==0&&tk[i])words.push(i);
  list.forEach(function(term){var tw=term.split(/\s+/),k=tw.length,tn=norm(term);if(tn.length<4)return;var mx=tn.length>=9?2:1;
    for(var w=0;w+k<=words.length;w++){var seg=[];for(var q=0;q<k;q++)seg.push(tk[words[w+q]]);
      var m=seg[0].match(/^([^\wÀ-ÿ]*)(.*?)([^\wÀ-ÿ]*)$/),m2=seg[k-1].match(/^([^\wÀ-ÿ]*)(.*?)([^\wÀ-ÿ]*)$/);
      var core=seg.slice();core[0]=m[2];core[k-1]=(k==1?m[2]:m2[2]);
      var sn=norm(core.join(''));if(!sn||sn===tn||sn[0]!==tn[0])continue;
      if(lev(sn,tn,mx)<=mx){var rep=term;if(core[0][0]&&core[0][0]===core[0][0].toUpperCase()&&core[0][0]!==core[0][0].toLowerCase())rep=rep[0].toUpperCase()+rep.slice(1);
        tk[words[w]]=m[1]+rep+(k==1?m[3]:'');for(q=1;q<k;q++){tk[words[w+q]]='';tk[words[w+q]-1]=''}if(k>1)tk[words[w+k-1]]=m2[3];}}});
  return tk.join('').replace(/ {2,}/g,' ')};

/* ---------- Transcription : indice d'accent/vocabulaire + correction locale ---------- */
var of=window.fetch;
window.fetch=function(u,o){
  var url=String(u&&u.url||u||'');
  if(url.indexOf('/functions/v1/cn-transcrire')<0)return of.apply(this,arguments);
  var voc=terms(),isForm=o&&o.body&&typeof FormData!=='undefined'&&o.body instanceof FormData;
  try{if(isForm){if(voc.length)o.body.append('vocab',voc.join(', ').slice(0,800));o.body.append('accent','rdc')}
    else if(o&&typeof o.body==='string'){var b=JSON.parse(o.body);if(b&&b.mode==='resume'){if(voc.length)b.vocab=voc.join(', ').slice(0,800);var lg=window.cnxLang();if(lg!=='fr')b.langue=lg;o.body=JSON.stringify(b)}}}catch(e){}
  var p=of.apply(this,arguments);
  if(!isForm||!voc.length)return p;
  return p.then(function(r){if(!r.ok)return r;return r.clone().json().then(function(j){if(j&&typeof j.text==='string'){j.text=window.cnlCorrect(j.text,voc);return new Response(JSON.stringify(j),{status:r.status,headers:{'Content-Type':'application/json'}})}return r}).catch(function(){return r})})};

/* ---------- Écran « Langues & vocabulaire » ---------- */
function body(){var c=cur,t=[];return (async function(){
  for(var i=0;i<c.pages.length;i++){var p=c.pages[i];t.push('## '+[p.chap,p.sujet].filter(Boolean).join(' — ')+'\n'+txt(p.html));
    (p.cpl||[]).forEach(function(q){t.push(txt(q.h))});
    for(var j=0;j<(p.att||[]).length;j++){var x=p.att[j];if(x.k=='a'&&x.tr){try{var tr=await fget('tr:'+x.id)||'';if(tr)t.push('Audio « '+(x.n||'')+' » : '+tr)}catch(e){}}}}
  return t.join('\n\n').replace(/\s+\n/g,'\n').slice(0,14000)})()}
async function run(mode,o){var out=o.querySelector('#cnl1o'),lg=window.cnxLang();out.style.display='block';out.textContent='Rédaction en '+LN[lg]+'…';
  try{var tx=await body();if(tx.length<80){out.textContent=window.cnxErr('cahier_vide');return}
    var j=await window.cnxCall('cn-langue',{mode:mode,lang:lg,titre:cur.cours,texte:tx,vocab:terms().join(', ').slice(0,800)});
    out.textContent=j.error?(j.error=='texte_trop_court'?window.cnxErr('cahier_vide'):window.cnxErr(j.error)):j.texte}
  catch(e){out.textContent=window.cnxErr(String(e&&e.message||e))}}
window.cnl1Open=function(){if(!cur)return;var o=document.getElementById('cnl1');if(o)o.remove();o=document.createElement('div');o.id='cnl1';
  o.innerHTML='<div class=cl1w><div class=cl1h><b>🌍 Langues et vocabulaire</b><button id=cnl1x>✕</button></div>'
   +'<div class=hint>Langue des résumés et explications :</div><select id=cnl1g>'+Object.keys(LN).map(function(k){return '<option value='+k+(window.cnxLang()==k?' selected':'')+'>'+LN[k]+'</option>'}).join('')+'</select>'
   +'<div class=cl1r><button class=p id=cnl1a>Résumer le cours</button><button id=cnl1b>Expliquer simplement</button></div>'
   +'<div class=cl1o id=cnl1o style="display:none"></div>'
   +'<div class=hint>Le lingala est possible pour les textes. Pour l’audio, la reconnaissance reste meilleure en français ; le vocabulaire ci-dessous aide à corriger les termes difficiles.</div>'
   +'<b>Vocabulaire de « '+esc(cur.cours)+' »</b><div class=hint>Un terme par ligne (médical, juridique…). Ils seront corrigés dans les transcriptions de ce cours.</div>'
   +'<textarea id=cnl1v placeholder="synapse&#10;neurotransmetteur&#10;prescription acquisitive">'+esc(cur.voc||'')+'</textarea>'
   +'<div class=cl1r><button class=p id=cnl1s>Enregistrer le vocabulaire</button><button id=cnl1c>Corriger mes transcriptions existantes</button></div></div>';
  document.body.appendChild(o);
  o.querySelector('#cnl1x').onclick=function(){o.remove()};
  o.querySelector('#cnl1g').onchange=function(){window.cnxSetLang(this.value)};
  o.querySelector('#cnl1a').onclick=function(){run('resume',o)};o.querySelector('#cnl1b').onclick=function(){run('simple',o)};
  o.querySelector('#cnl1s').onclick=function(){cur.voc=o.querySelector('#cnl1v').value.slice(0,3000);raw();toast('Vocabulaire enregistré')};
  o.querySelector('#cnl1c').onclick=async function(){cur.voc=o.querySelector('#cnl1v').value.slice(0,3000);raw();var n=0,l=terms();
    for(var i=0;i<cur.pages.length;i++)for(var j=0;j<(cur.pages[i].att||[]).length;j++){var x=cur.pages[i].att[j];if(x.k!='a'||!x.tr)continue;
      var t=await fget('tr:'+x.id)||'',c=window.cnlCorrect(t,l);if(c!==t){await fput('tr:'+x.id,c);n++}}
    toast(n?n+' transcription(s) corrigée(s)':'Rien à corriger')}};

var ob=window.openB;if(typeof ob=='function')window.openB=function(){var r=ob.apply(this,arguments);try{window.cnxBtn('cnl1b0','🌍 Langues et vocabulaire',window.cnl1Open,false)}catch(e){}return r};
})();
