/* v38 : boutons « Leçon complète » et « Wikipédia + web » toujours visibles dans la barre d’outils de la page ; recherche fiable (Wikipédia, Wikibooks, Wikiversité, Wiktionnaire, DuckDuckGo) avec liens vers DuckDuckGo, Google, Bing et Qwant ; leçon complète depuis Wikipédia (sans IA) si aucun compte n’est connecté. À charger après v36.js. Surcouche : aucun fichier existant n’est modifié. */
(function(){
var WP='https://fr.wikipedia.org';
var SRC=[['Wikipédia',WP],['Wikibooks','https://fr.wikibooks.org'],['Wikiversité','https://fr.wikiversity.org'],['Wiktionnaire','https://fr.wiktionary.org']];
var ENG=[['DuckDuckGo','https://duckduckgo.com/?q='],['Google','https://www.google.com/search?q='],['Bing','https://www.bing.com/search?q='],['Qwant','https://www.qwant.com/?q=']];
var enc=encodeURIComponent;
var $=function(s){return document.querySelector(s)};
var say=function(m){try{toast(m)}catch(e){}};
function query(){var e=$('#ed'),t='';try{t=e?txt(e.innerHTML):''}catch(x){}var q=(((pg&&pg.chap)||'')+' '+((pg&&pg.sujet)||'')).trim();return q||t.slice(0,60)}
function wsearch(s,q){return fetch(s[1]+'/w/api.php?action=query&generator=search&gsrsearch='+enc(q)+'&gsrlimit=3&prop=extracts|info&exintro=1&explaintext=1&exchars=900&inprop=url&format=json&origin=*').then(function(r){return r.json()}).then(function(j){var ps=j.query&&j.query.pages?Object.keys(j.query.pages).map(function(k){return j.query.pages[k]}):[];ps.sort(function(a,b){return a.index-b.index});return ps.map(function(p){return {s:s[0],t:p.title,x:p.extract||'',u:p.fullurl||''}})}).catch(function(){return []})}
function wikiLecon(q){
q=String(q||query()).trim();
if(!q){say('Indiquez un sujet');return Promise.resolve()}
if(!pg||!cur){say('Ouvrez une page');return Promise.resolve()}
say('Préparation de la leçon…');
return fetch(WP+'/w/api.php?action=query&list=search&srsearch='+enc(q)+'&srlimit=1&format=json&origin=*').then(function(r){return r.json()}).then(function(j){var h=j.query&&j.query.search&&j.query.search[0];if(!h)throw new Error('none');return fetch(WP+'/w/api.php?action=query&prop=extracts|info&explaintext=1&exchars=9000&redirects=1&inprop=url&titles='+enc(h.title)+'&format=json&origin=*')}).then(function(r){return r.json()}).then(function(j){
var ps=(j.query&&j.query.pages)||{},p=ps[Object.keys(ps)[0]];
if(!p||!p.extract)throw new Error('none');
var skip=false,html='<h3>'+esc(p.title)+'</h3>';
p.extract.split('\n').forEach(function(l){l=l.trim();if(!l)return;var m=l.match(/^(=+)\s*(.*?)\s*=+$/);if(m){skip=/^(notes?|r[ée]f[ée]rences?|voir aussi|liens? externes?|bibliographie|articles? connexes?)/i.test(m[2]);if(!skip)html+='<h4>'+esc(m[2])+'</h4>';return}if(!skip)html+='<p>'+esc(l)+'</p>'});
html+='<p><i>Source : Wikipédia — '+esc(p.fullurl||'')+'</i></p>';
saveC('Leçon : '+q,html,'lecon')
}).catch(function(){say('Leçon introuvable sur Wikipédia : essayez d’autres mots')})}
function openSearch(){
if(!pg||!cur){say('Ouvrez une page');return}
var old=document.getElementById('ak');if(old)old.remove();
var o=document.createElement('div');o.id='ak';
o.innerHTML='<div class=scb><div class=drh><b>📚 Wikipédia + recherche web</b><button id=cn38x>✕</button></div><div class=f><label>Sujet à rechercher<input id=cn38q></label><button class=p id=cn38go>🔎 Rechercher (gratuit)</button><button class=p id=cn38le>📘 Leçon complète depuis Wikipédia (sans IA)</button><div id=cn38e style=display:flex;gap:6px;flex-wrap:wrap></div></div><div id=cn38r></div></div>';
document.body.appendChild(o);
var qi=document.getElementById('cn38q');qi.value=query();
document.getElementById('cn38x').onclick=function(){o.remove()};
var eng=document.getElementById('cn38e');
ENG.forEach(function(g){var b=document.createElement('button');b.className='ch';b.textContent='Ouvrir sur '+g[0]+' ↗';b.onclick=function(){var v=qi.value.trim();if(!v){say('Indiquez un sujet');return}window.open(g[1]+enc(v),'_blank')};eng.appendChild(b)});
var res=document.getElementById('cn38r');
function go(){var q=qi.value.trim();if(!q)return;res.innerHTML='<p class=hint>Recherche…</p>';
var jobs=SRC.map(function(s){return wsearch(s,q)});
jobs.push(typeof ddg==='function'?ddg(q).then(function(d){return d?[{s:d.s,t:d.t,x:d.x,u:d.u}]:[]}).catch(function(){return []}):Promise.resolve([]));
Promise.all(jobs).then(function(a){var L=[].concat.apply([],a);res.textContent='';
if(!L.length){var p=document.createElement('p');p.className='hint';p.textContent='Aucun résultat ici (connexion ou mots à changer). Utilisez les boutons « Ouvrir sur… » ci-dessus.';res.appendChild(p);return}
L.forEach(function(x){var d=document.createElement('div');d.className='rs';var b=document.createElement('b');b.textContent=x.t;var sm=document.createElement('small');sm.textContent=x.s;var sp=document.createElement('span');sp.textContent=(x.x||'').slice(0,420)+((x.x||'').length>420?'…':'');var row=document.createElement('div');
var b1=document.createElement('button');b1.className='ch';b1.textContent='＋ Notes complémentaires';b1.onclick=function(){saveC(x.t,'<p>'+esc(x.x).replace(/\n/g,'<br>')+'</p><p><small>Source : '+esc(x.s)+(x.u?' — '+esc(x.u):'')+'</small></p>','wiki')};
var b2=document.createElement('button');b2.className='ch';b2.textContent='Ouvrir ↗';b2.onclick=function(){if(x.u)window.open(x.u,'_blank')};
row.appendChild(b1);row.appendChild(b2);d.appendChild(b);d.appendChild(sm);d.appendChild(sp);d.appendChild(row);res.appendChild(d)})})}
document.getElementById('cn38go').onclick=go;
qi.onkeydown=function(e){if(e.key==='Enter')go()};
document.getElementById('cn38le').onclick=function(){wikiLecon(qi.value)};
if(qi.value.trim())go()
}
var origLecon=window.cn34Lecon;
function lecon(){
if(!pg||!cur){say('Ouvrez une page');return}
if(typeof D!=='undefined'&&D.s&&typeof origLecon==='function')return origLecon();
say('Pas de compte connecté : leçon construite depuis Wikipédia');
return wikiLecon()
}
window.cn34Lecon=window.cn38Lecon=lecon;
window.cn34Wik=window.cn38Wik=openSearch;
function mkb(t,f){var b=document.createElement('button');b.type='button';b.setAttribute('data-cn38','1');b.textContent=t;b.onpointerdown=function(e){e.preventDefault()};b.onclick=f;return b}
function ensure(){
var tb=$('.ed .tb'),gr=$('#v18t .gr');if(!tb||!gr)return;
Array.prototype.forEach.call(document.querySelectorAll('.ed .tb [data-cn34],.ed .tb [data-cn38],.ed #v18t [data-cn34]'),function(n){n.remove()});
if(gr.querySelector('[data-cn38]'))return;
var b1=mkb('📘 Leçon complète',lecon),b2=mkb('📚 Wikipédia + web',openSearch);
var cb=gr.querySelector('button[onclick^=enr]');
gr.insertBefore(b1,cb?cb.nextSibling:gr.firstChild);
gr.insertBefore(b2,b1.nextSibling);
}
try{new MutationObserver(function(){ensure()}).observe(document.body,{childList:true,subtree:true})}catch(x){}
ensure();
})();
