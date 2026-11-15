const {chromium}=require('playwright');
const OUT=(process.env.OUT||'affiches/out')+'/';const fs=require('fs');fs.mkdirSync(OUT,{recursive:true});const PORT=process.env.PORT||8767;
const note=`<h3>Les sources du droit</h3><p>Le droit objectif est l’ensemble des règles qui régissent la vie en société.</p><h4>1. Les sources formelles</h4><ul><li><b>La Constitution</b> : norme suprême de l’État</li><li><b>La loi</b> : règle votée par le Parlement</li><li><b>Le règlement</b> : acte pris par l’administration</li></ul><h4>2. Les sources non écrites</h4><ul><li><b>La coutume</b> : pratique répétée considérée comme obligatoire</li><li><b>La jurisprudence</b> : décisions des juges</li></ul><p><b>À retenir :</b> la hiérarchie des normes place la Constitution au sommet.</p>`;
const messy=`les sources du droit le droit objectif cest lensemble des regles qui regissent la vie en societe. sources formelles constitution norme supreme de letat la loi votee par le parlement le reglement acte de ladministration. sources non ecrites coutume pratique repetee jurisprudence decisions des juges. a retenir hierarchie des normes constitution au sommet`;
const mk=(id,cours,prof,color,pages)=>({id,cours,prof,color,pages,u:Date.now(),d:1});
const P=(id,chap,sujet,html,extra={})=>Object.assign({id,chap,sujet,start:Date.now()-864e5,end:Date.now(),html,u:Date.now(),d:1,att:[],tags:[]},extra);
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,locale:'fr-FR'});
const p=await ctx.newPage();
await p.route(/supabase\.co/,r=>{const u=r.request().url();
 let body='[]';
 if(/cn-ia/.test(u))body=JSON.stringify({text:`<h3>Les sources du droit</h3><p>Le droit objectif est l’ensemble des règles qui régissent la vie en société.</p><h4>Sources formelles</h4><ul><li><b>Constitution</b> : norme suprême de l’État</li><li><b>Loi</b> : votée par le Parlement</li><li><b>Règlement</b> : acte de l’administration</li></ul><h4>Sources non écrites</h4><ul><li><b>Coutume</b> : pratique répétée</li><li><b>Jurisprudence</b> : décisions des juges</li></ul><p><b>À retenir :</b> la hiérarchie des normes place la Constitution au sommet.</p>`,restant:8});
 else if(/cn-enrichir/.test(u))body=JSON.stringify({web:true,text:`<h3>Pour aller plus loin</h3><p>La <b>pyramide de Kelsen</b> classe les normes juridiques : Constitution, traités, lois, règlements. Chaque norme tire sa validité de celle qui lui est supérieure.</p><ul><li>Contrôle de constitutionnalité des lois</li><li>Exemple : la primauté de la Constitution</li></ul><p><small>Sources : Wikipédia, Légifrance</small></p>`});
 else if(/cn_profils/.test(u))body=JSON.stringify([{statut:'valide',est_admin:false}]);
 else if(/cn_appareil_verifier/.test(u))body='"ok"';
 else if(/cn_premium_status/.test(u))body=JSON.stringify({premium:true,access:true,status:'trial',days_left:41});
 r.fulfill({status:200,contentType:'application/json',body})});
await p.goto('http://localhost:'+PORT+'/index.html');await p.waitForTimeout(500);
await p.evaluate(({note,messy,mk,P})=>{
 const M=eval('('+mk+')'),PP=eval('('+P+')');
 D.s={access_token:'a.'+btoa(JSON.stringify({sub:'u1'}))+'.c',refresh_token:'r',exp:Date.now()+1e8,email:'etudiant@exemple.com'};D.ok=1;D.own='u1';D.chk=Date.now();
 D.c=[M('c1','Introduction au droit','Prof. Mukendi','#6366f1',[PP('p1','Chapitre 1','Les sources du droit',note,{tags:['examen','chapitre-1'],cpl:[{id:'z1',t:'Pyramide de Kelsen',h:'<p>x</p>',k:'ia'}],att:[{id:'a1',k:'a',n:'Cours du lundi',t:Date.now(),d:1,m:'audio/webm'}]}),PP('p2','Chapitre 2','Les personnes juridiques','<p>Personnes physiques et morales.</p>'),PP('p3','Chapitre 3','Le droit des obligations','<p>Contrat, délit, quasi-contrat.</p>'),PP('pm','Chapitre 1','Notes en désordre',`<p>${messy}</p>`,{end:0})]),
 M('c2','Anatomie générale','Dr Kabongo','#10b981',[PP('q1','Ostéologie','Le squelette','<p>206 os.</p>'),PP('q2','Myologie','Les muscles','<p>…</p>')]),
 M('c3','Comptabilité générale','Prof. Ilunga','#f59e0b',[PP('r1','Bilan','Actif et passif','<p>…</p>')]),
 M('c4','Économie politique','Prof. Tshibangu','#ec4899',[PP('s1','Offre','Offre et demande','<p>…</p>')]),
 M('c5','Droit constitutionnel','Prof. Kalala','#0ea5e9',[PP('t1','Titre 1','Séparation des pouvoirs','<p>…</p>')])];
 D.tour={home:1,newb:1,cahier:1,page:1,menu:1,agenda:1,enr:1,rev:1,exam:1};D.ev=[{id:'e1',n:'Examen d’Introduction au droit',t:Date.now()+5*864e5,k:'examen'}];
 raw();home();document.getElementById('sp')&&document.getElementById('sp').remove();
},{note,messy,mk:mk.toString(),P:P.toString()});
await p.waitForTimeout(800);
const fp=await ctx.newPage();
const shot=async n=>{await p.waitForTimeout(500);const buf=await p.screenshot({path:OUT+n+'.png'});
 await fp.setViewportSize({width:520,height:1000});
 await fp.setContent('<body style="margin:0;background:transparent"><div id=f style="display:inline-block;padding:0"><div style="width:390px;height:844px;border:16px solid #0b0d1a;border-radius:64px;overflow:hidden;position:relative;box-shadow:0 0 0 2px #3b3f5c;background:#000"><img src="data:image/png;base64,'+buf.toString('base64')+'" style="width:390px;height:844px;display:block"></div></div></body>');
 await fp.waitForTimeout(300);await (await fp.$('#f')).screenshot({path:OUT+n+'-tel.png',omitBackground:true})};
await shot('1-accueil');
await p.evaluate(()=>openB('c1'));await p.waitForTimeout(2500);await shot('2-cahier');
await p.evaluate(()=>{window.scrollTo(0,0);document.querySelectorAll('details.v18d').forEach(d=>d.open=true)});await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await shot('2b-cahier-bas');
await p.evaluate(()=>{openB('c1');});await p.waitForTimeout(1500);
await p.evaluate(()=>openP('p1'));await p.waitForTimeout(2000);await shot('3-page');
await p.evaluate(()=>v18tog('t'));await shot('4-outils');
await p.evaluate(()=>{closeP&&closeP();});await p.waitForTimeout(800);
await p.evaluate(()=>openP('pm'));await p.waitForTimeout(1800);
await shot('5a-edition');await p.evaluate(()=>v16go());await p.waitForTimeout(3000);await shot('5-structurer');
await p.evaluate(()=>{const o=document.getElementById('v16o');o&&o.remove();closeP&&closeP();});await p.waitForTimeout(600);
await p.evaluate(()=>openP('p1'));await p.waitForTimeout(1800);
await p.evaluate(()=>enr());await p.waitForTimeout(600);
await p.evaluate(()=>ia());await p.waitForTimeout(2000);await shot('6-completer');
await p.evaluate(()=>{const o=document.getElementById('ak');o&&o.remove();closeP&&closeP();openB('c1')});await p.waitForTimeout(1500);
await p.evaluate(()=>v13open());await p.waitForTimeout(1500);await shot('7-revision');
await p.evaluate(()=>{const o=document.querySelector('.scb button[data-a=close]');o&&o.click()});await p.waitForTimeout(500);
await p.evaluate(()=>scanUI());await p.waitForTimeout(800);await shot('8-scanner');
console.log(await p.evaluate(()=>document.title));await b.close();require('./logo.js')(OUT)})().catch(e=>{console.error(e);process.exit(1)});
