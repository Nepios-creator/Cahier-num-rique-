/* v43 : pays d'étude OBLIGATOIRE. Après la vérification d'accès (paiement validé, cahier ouvert) et après la fenêtre du numéro de téléphone, une fenêtre sans fermeture oblige à choisir le pays d'étude (une seule fois par compte). Le pays est enregistré dans le compte (serveur) ; l'IA s'en sert pour compléter les notes et générer les leçons. Menu du compte : « 🌍 Mon pays d'étude » pour le modifier. À charger après v42.js. */
(function(){
'use strict';
var C={"AF":"Afghanistan","ZA":"Afrique du Sud","AL":"Albanie","DZ":"Algérie","DE":"Allemagne","AD":"Andorre","AO":"Angola","AI":"Anguilla","AG":"Antigua-et-Barbuda","SA":"Arabie saoudite","AR":"Argentine","AM":"Arménie","AW":"Aruba","AU":"Australie","AT":"Autriche","AZ":"Azerbaïdjan","BS":"Bahamas","BH":"Bahreïn","BD":"Bangladesh","BB":"Barbade","BE":"Belgique","BZ":"Belize","BJ":"Bénin","BM":"Bermudes","BT":"Bhoutan","BY":"Biélorussie","BO":"Bolivie","BA":"Bosnie-Herzégovine","BW":"Botswana","BR":"Brésil","BN":"Brunei","BG":"Bulgarie","BF":"Burkina Faso","BI":"Burundi","KH":"Cambodge","CM":"Cameroun","CA":"Canada","CV":"Cap-Vert","CL":"Chili","CN":"Chine","CY":"Chypre","CO":"Colombie","KM":"Comores","CG":"Congo-Brazzaville (République du Congo)","KP":"Corée du Nord","KR":"Corée du Sud","CR":"Costa Rica","CI":"Côte d’Ivoire","HR":"Croatie","CU":"Cuba","CW":"Curaçao","DK":"Danemark","DJ":"Djibouti","DM":"Dominique","EG":"Égypte","AE":"Émirats arabes unis","EC":"Équateur","ER":"Érythrée","ES":"Espagne","EE":"Estonie","SZ":"Eswatini","VA":"État de la Cité du Vatican","US":"États-Unis","ET":"Éthiopie","FJ":"Fidji","FI":"Finlande","FR":"France","GA":"Gabon","GM":"Gambie","GE":"Géorgie","GH":"Ghana","GI":"Gibraltar","GR":"Grèce","GD":"Grenade","GL":"Groenland","GP":"Guadeloupe","GU":"Guam","GT":"Guatemala","GG":"Guernesey","GN":"Guinée","GQ":"Guinée équatoriale","GW":"Guinée-Bissau","GY":"Guyana","GF":"Guyane française","HT":"Haïti","HN":"Honduras","HU":"Hongrie","CX":"Île Christmas","IM":"Île de Man","NF":"Île Norfolk","AX":"Îles Åland","KY":"Îles Caïmans","CC":"Îles Cocos","CK":"Îles Cook","FO":"Îles Féroé","FK":"Îles Malouines","MP":"Îles Mariannes du Nord","MH":"Îles Marshall","PN":"Îles Pitcairn","SB":"Îles Salomon","TC":"Îles Turques-et-Caïques","VG":"Îles Vierges britanniques","VI":"Îles Vierges des États-Unis","IN":"Inde","ID":"Indonésie","IQ":"Irak","IR":"Iran","IE":"Irlande","IS":"Islande","IL":"Israël","IT":"Italie","JM":"Jamaïque","JP":"Japon","JE":"Jersey","JO":"Jordanie","KZ":"Kazakhstan","KE":"Kenya","KG":"Kirghizstan","KI":"Kiribati","XK":"Kosovo","KW":"Koweït","RE":"La Réunion","LA":"Laos","LS":"Lesotho","LV":"Lettonie","LB":"Liban","LR":"Liberia","LY":"Libye","LI":"Liechtenstein","LT":"Lituanie","LU":"Luxembourg","MK":"Macédoine du Nord","MG":"Madagascar","MY":"Malaisie","MW":"Malawi","MV":"Maldives","ML":"Mali","MT":"Malte","MA":"Maroc","MQ":"Martinique","MU":"Maurice","MR":"Mauritanie","YT":"Mayotte","MX":"Mexique","FM":"Micronésie","MD":"Moldavie","MC":"Monaco","MN":"Mongolie","ME":"Monténégro","MS":"Montserrat","MZ":"Mozambique","MM":"Myanmar (Birmanie)","NA":"Namibie","NR":"Nauru","NP":"Népal","NI":"Nicaragua","NE":"Niger","NG":"Nigeria","NU":"Niue","NO":"Norvège","NC":"Nouvelle-Calédonie","NZ":"Nouvelle-Zélande","OM":"Oman","UG":"Ouganda","UZ":"Ouzbékistan","PK":"Pakistan","PW":"Palaos","PA":"Panama","PG":"Papouasie-Nouvelle-Guinée","PY":"Paraguay","NL":"Pays-Bas","BQ":"Pays-Bas caribéens","PE":"Pérou","PH":"Philippines","PL":"Pologne","PF":"Polynésie française","PR":"Porto Rico","PT":"Portugal","QA":"Qatar","HK":"R.A.S. chinoise de Hong Kong","MO":"R.A.S. chinoise de Macao","CF":"République centrafricaine","CD":"République démocratique du Congo (RDC)","DO":"République dominicaine","RO":"Roumanie","GB":"Royaume-Uni","RU":"Russie","RW":"Rwanda","EH":"Sahara occidental","BL":"Saint-Barthélemy","KN":"Saint-Christophe-et-Niévès","SM":"Saint-Marin","MF":"Saint-Martin","SX":"Saint-Martin (partie néerlandaise)","PM":"Saint-Pierre-et-Miquelon","VC":"Saint-Vincent-et-les Grenadines","SH":"Sainte-Hélène","LC":"Sainte-Lucie","SV":"Salvador","WS":"Samoa","AS":"Samoa américaines","ST":"Sao Tomé-et-Principe","SN":"Sénégal","RS":"Serbie","SC":"Seychelles","SL":"Sierra Leone","SG":"Singapour","SK":"Slovaquie","SI":"Slovénie","SO":"Somalie","SD":"Soudan","SS":"Soudan du Sud","LK":"Sri Lanka","SE":"Suède","CH":"Suisse","SR":"Suriname","SJ":"Svalbard et Jan Mayen","SY":"Syrie","TJ":"Tadjikistan","TW":"Taïwan","TZ":"Tanzanie","TD":"Tchad","CZ":"Tchéquie","IO":"Territoire britannique de l’océan Indien","PS":"Territoires palestiniens","TH":"Thaïlande","TL":"Timor oriental","TG":"Togo","TK":"Tokelau","TO":"Tonga","TT":"Trinité-et-Tobago","TN":"Tunisie","TM":"Turkménistan","TR":"Turquie","TV":"Tuvalu","UA":"Ukraine","UY":"Uruguay","VU":"Vanuatu","VE":"Venezuela","VN":"Viêt Nam","WF":"Wallis-et-Futuna","YE":"Yémen","ZM":"Zambie","ZW":"Zimbabwe"};
var DLG='cn43',busy=false;
function $(s){return document.querySelector(s)}
function say(m){try{toast(m)}catch(e){}}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'")}
function ukey(){try{return 'cn43_pays:'+String(D.s.email||'').toLowerCase()}catch(e){return ''}}
function getLocal(){try{var k=ukey();var v=k&&localStorage.getItem(k);return /^[A-Z]{2}$/.test(v||'')?v:''}catch(e){return ''}}
function setLocal(v){try{var k=ukey();if(k)localStorage.setItem(k,v)}catch(e){}}
function ready(){return typeof D!=='undefined'&&D&&D.s&&D.ok&&typeof api==='function'&&typeof tok==='function'}
function opts(sel,q,cur){
var nq=norm(q),h='<option value="" disabled'+(cur?'':' selected')+'>— Choisir un pays —</option>',n=0;
Object.keys(C).forEach(function(k){if(nq&&norm(C[k]).indexOf(nq)<0&&norm(k)!==nq)return;n++;h+='<option value="'+k+'"'+(k===cur?' selected':'')+'>'+C[k].replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</option>'});
if(!n)h='<option value="" disabled selected>Aucun pays trouvé</option>';
sel.innerHTML=h}
function close(){var o=document.getElementById(DLG);if(o)o.remove()}
function show(force,cur){
if(document.getElementById(DLG))return;
var o=document.createElement('div');o.id=DLG;o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');
o.style.cssText='position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483000;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;overflow:auto;-webkit-overflow-scrolling:touch';
var card=document.createElement('div');
card.style.cssText='background:#fff;color:#111;border-radius:18px;max-width:440px;width:100%;padding:20px;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.35);font:16px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-height:100%;overflow:auto';
card.innerHTML='<div style="font-size:20px;font-weight:700;margin-bottom:8px">🌍 '+(force?'Dans quel pays étudiez-vous ?':'Mon pays d’étude')+'</div>'
+'<p style="margin:0 0 12px;color:#444;font-size:15px">'+(force?'<b>Cette information est obligatoire.</b> ':'')+'Votre pays permet à l’IA d’adapter les notes complétées et les leçons à ce qui est enseigné chez vous (lois, programmes, institutions, exemples), et non à un autre pays.</p>'
+'<input id="cn43q" type="search" autocomplete="off" placeholder="Rechercher un pays…" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px;margin-bottom:8px;background:#fff;color:#111">'
+'<select id="cn43s" size="1" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px;background:#fff;color:#111"></select>'
+'<p id="cn43i" style="margin:10px 0 0;min-height:22px;font-size:14px;color:#1e3a8a"></p>'
+'<p id="cn43e" style="margin:4px 0 0;min-height:18px;font-size:14px;color:#b91c1c"></p>'
+'<button id="cn43ok" type="button" disabled style="width:100%;margin-top:10px;padding:14px;border:0;border-radius:14px;font-size:17px;font-weight:700;background:#1d4ed8;color:#fff;opacity:.45">Continuer</button>'
+(force?'':'<button id="cn43x" type="button" style="width:100%;margin-top:8px;padding:12px;border:1px solid #cbd5e1;border-radius:14px;font-size:16px;background:#fff;color:#111">Annuler</button>');
o.appendChild(card);document.body.appendChild(o);
var sel=card.querySelector('#cn43s'),q=card.querySelector('#cn43q'),ok=card.querySelector('#cn43ok'),inf=card.querySelector('#cn43i'),er=card.querySelector('#cn43e');
var chosen=cur||'';
function upd(){chosen=sel.value||'';ok.disabled=!chosen;ok.style.opacity=chosen?'1':'.45';inf.textContent=chosen?('Pays choisi : '+C[chosen]):'';er.textContent=''}
opts(sel,'',cur);upd();
sel.onchange=upd;
q.oninput=function(){opts(sel,q.value,chosen&&C[chosen]&&(!q.value||norm(C[chosen]).indexOf(norm(q.value))>=0)?chosen:'');upd()};
if(!force)card.querySelector('#cn43x').onclick=close;
ok.onclick=async function(){
if(!chosen)return;
ok.disabled=true;ok.textContent='Enregistrement…';er.textContent='';
try{await tok();await api('/rest/v1/rpc/cn_definir_pays',{m:'POST',b:{p_pays:chosen}});setLocal(chosen);close();say('Pays d’étude enregistré : '+C[chosen])}
catch(e){ok.disabled=false;ok.textContent='Continuer';er.textContent='Enregistrement impossible : vérifiez votre connexion internet puis réessayez.'}
};
if(force){document.addEventListener('keydown',function kd(ev){if(!document.getElementById(DLG)){document.removeEventListener('keydown',kd,true);return}if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation()}},true)}
}
async function gate(){
if(busy||document.getElementById(DLG)||!ready()||getLocal()||!navigator.onLine)return;
busy=true;
try{
for(var i=0;i<600&&document.getElementById('v21tel');i++)await sleep(500);
if(!ready()||document.getElementById(DLG))return;
await tok();
var p=await api('/rest/v1/rpc/cn_mon_pays',{m:'POST',b:{}});
if(typeof p==='string'&&/^[A-Z]{2}$/.test(p)){setLocal(p);return}
if(!ready())return;
show(true,'')
}catch(e){}
finally{busy=false}
}
/* après la vérification d'accès (démarrage, connexion, paiement validé) : le cahier s'ouvre, puis téléphone, puis pays */
var g0=window.v6gate;
if(typeof g0==='function')window.v6gate=async function(){
var r=await g0.apply(this,arguments);
try{if(ready())setTimeout(gate,4500)}catch(e){}
return r};
/* filet de sécurité : reprise périodique, retour au premier plan, retour de connexion */
setInterval(function(){try{if(ready()&&!getLocal())gate()}catch(e){}},30000);
document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(gate,1500)});
addEventListener('online',function(){setTimeout(gate,1500)});
setTimeout(gate,6000);
/* l'IA exige le pays : si le serveur répond « pays_requis », la fenêtre obligatoire s'ouvre */
var c0=window.v6call;
if(typeof c0==='function')window.v6call=async function(){
var j=await c0.apply(this,arguments);
try{if(j&&j.error==='pays_requis'){setLocal('');try{localStorage.removeItem(ukey())}catch(e){}show(true,'');say('Choisissez d’abord votre pays d’étude, puis relancez la demande.')}}catch(e){}
return j};
/* menu du compte : modifier le pays */
var m0=window.menu;
if(typeof m0==='function')window.menu=function(){
var r=m0.apply(this,arguments);
try{var f=document.querySelector('.f');if(f&&D.s&&!f.querySelector('[data-cn43]')){var b=document.createElement('button');b.setAttribute('data-cn43','1');b.textContent='🌍 Mon pays d’étude';b.onclick=function(){show(false,getLocal())};f.insertBefore(b,f.querySelector('hr')||null)}}catch(e){}
return r};
window.cn43Pays=function(){return getLocal()};
})();
