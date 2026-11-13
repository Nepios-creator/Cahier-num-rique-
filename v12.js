/* Cahier numérique v12 :
   1) « Sauvegarder / Partager » : fenêtre de choix (pages, notes, leçons, audios, transcriptions, PDF/Word),
      document Word (.docx) propre qui garde la structure des pages, choix du dossier de l'appareil quand c'est possible
   2) affichage plein écran sur PC et tablette (le téléphone ne change pas)
   À charger APRÈS v11.js. Ne modifie aucune autre fonctionnalité. */
const V12={};
const v12safe=s=>String(s||'sans nom').replace(/[\\/:*?"<>|\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,70)||'sans nom';
const v12x=s=>String(s==null?'':s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* =============== ZIP (sans compression) =============== */
const v12crc=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}
 return b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=t[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}})();
function v12zip(F){const enc=new TextEncoder(),ch=[],cd=[];let off=0;const now=new Date(),
 dd=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate(),tt=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);
 for(const f of F){const nm=enc.encode(f.n),crc=v12crc(f.d),h=new DataView(new ArrayBuffer(30));
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,tt,true);h.setUint16(12,dd,true);
  h.setUint32(14,crc,true);h.setUint32(18,f.d.length,true);h.setUint32(22,f.d.length,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
  ch.push(new Uint8Array(h.buffer),nm,f.d);
  const c=new DataView(new ArrayBuffer(46));
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,tt,true);c.setUint16(14,dd,true);
  c.setUint32(16,crc,true);c.setUint32(20,f.d.length,true);c.setUint32(24,f.d.length,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
  cd.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+f.d.length}
 let cs=0;cd.forEach(x=>cs+=x.length);const e=new DataView(new ArrayBuffer(22));
 e.setUint32(0,0x06054b50,true);e.setUint16(8,F.length,true);e.setUint16(10,F.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
 return new Blob([...ch,...cd,new Uint8Array(e.buffer)],{type:'application/zip'})}

/* =============== HTML de la page → Word (.docx) =============== */
const V12NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const V12W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const V12XML='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
function v12col(s){s=String(s||'').trim().toLowerCase();let m;
 if((m=/^#([0-9a-f]{6})$/.exec(s)))return m[1].toUpperCase();
 if((m=/^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s)))return(m[1]+m[1]+m[2]+m[2]+m[3]+m[3]).toUpperCase();
 if((m=/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s)))return[m[1],m[2],m[3]].map(x=>Math.min(255,+x).toString(16).padStart(2,'0')).join('').toUpperCase();
 return''}
const v12font=f=>{const x=String(f||'').split(',')[0].replace(/["']/g,'').trim();return/^(system-ui|-apple-system|sans-serif|serif|monospace|cursive|inherit)?$/i.test(x)?'':x};
function v12fmt(n,f){const g=Object.assign({},f),T=n.tagName;
 if(T=='B'||T=='STRONG')g.b=1;if(T=='I'||T=='EM')g.i=1;if(T=='U')g.u=1;if(/^(S|STRIKE|DEL)$/.test(T))g.s=1;
 if(T=='A'){g.u=1;g.c='0563C1'}
 if(T=='FONT'){const c=v12col(n.getAttribute('color'));if(c)g.c=c;const fa=n.getAttribute('face');if(fa)g.f=fa}
 const st=n.style;if(st){
  if(st.fontWeight&&(st.fontWeight=='bold'||+st.fontWeight>=600))g.b=1;
  if(st.fontStyle=='italic')g.i=1;
  const td=st.textDecorationLine||st.textDecoration||'';if(/underline/.test(td))g.u=1;if(/line-through/.test(td))g.s=1;
  const c=v12col(st.color);if(c)g.c=c;const bg=v12col(st.backgroundColor);if(bg)g.bg=bg;if(st.fontFamily)g.f=st.fontFamily}
 return g}
function v12run(t,f){if(!t)return'';let pr='';const fn=v12font(f.f);
 if(fn)pr+=`<w:rFonts w:ascii="${v12x(fn)}" w:hAnsi="${v12x(fn)}" w:cs="${v12x(fn)}"/>`;
 if(f.b)pr+='<w:b/>';if(f.i)pr+='<w:i/>';if(f.s)pr+='<w:strike/>';if(f.c)pr+=`<w:color w:val="${f.c}"/>`;if(f.u)pr+='<w:u w:val="single"/>';
 if(f.bg)pr+=`<w:shd w:val="clear" w:color="auto" w:fill="${f.bg}"/>`;
 return`<w:r>${pr?'<w:rPr>'+pr+'</w:rPr>':''}<w:t xml:space="preserve">${v12x(t)}</w:t></w:r>`}
function v12p(o){let pr='';if(o.st)pr+=`<w:pStyle w:val="${o.st}"/>`;
 if(o.num)pr+=`<w:numPr><w:ilvl w:val="${o.num.lvl}"/><w:numId w:val="${o.num.id}"/></w:numPr>`;
 if(o.sp)pr+=`<w:spacing ${o.sp}/>`;if(o.ind)pr+=`<w:ind w:left="${o.ind}"/>`;if(o.jc)pr+=`<w:jc w:val="${o.jc}"/>`;
 return`<w:p>${pr?'<w:pPr>'+pr+'</w:pPr>':''}${o.r||''}</w:p>`}
function v12dim(b,ext){if(ext=='png')return b.length>24?[((b[16]<<24)|(b[17]<<16)|(b[18]<<8)|b[19])>>>0,((b[20]<<24)|(b[21]<<16)|(b[22]<<8)|b[23])>>>0]:null;
 let i=2;while(i+9<b.length){if(b[i]!=0xFF){i++;continue}const m=b[i+1];
  if(m==0xFF){i++;continue}
  if(m>=0xC0&&m<=0xCF&&m!=0xC4&&m!=0xC8&&m!=0xCC)return[(b[i+7]<<8)|b[i+8],(b[i+5]<<8)|b[i+6]];
  if(m==0x01||(m>=0xD0&&m<=0xD9)){i+=2;continue}
  i+=2+((b[i+2]<<8)|b[i+3])}
 return null}
function v12img(n,ctx){const s=n.getAttribute('src')||'',m=/^data:image\/(png|jpe?g);base64,(.+)$/i.exec(s);
 if(!m)return'<w:r><w:t>[image]</w:t></w:r>';
 let b;try{b=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0))}catch(e){return''}
 const png=m[1].toLowerCase()=='png',d=v12dim(b,png?'png':'jpg')||[800,600];let w=d[0]||800,h=d[1]||600;
 const k=Math.min(1,560/w);w=Math.max(1,Math.round(w*k));h=Math.max(1,Math.round(h*k));
 const id=ctx.media.length+1,nm='image'+id+(png?'.png':'.jpg');ctx.media.push({n:nm,d:b});const cx=w*9525,cy=h*9525;
 return`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Image ${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${nm}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rImg${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`}
function v12list(n,ctx,bp,depth,f){const ord=n.tagName=='OL',id=ord?ctx.newNum(parseInt(n.getAttribute('start'))||1):1;let o='';
 [...n.children].forEach(li=>{if(li.tagName!='LI')return;o+=v12blocks(li,ctx,Object.assign({},bp,{num:{id,lvl:Math.min(depth,3)}}),depth+1,v12fmt(li,f))});return o}
function v12table(n,ctx,depth,f){const rows=[...n.querySelectorAll('tr')].filter(r=>r.closest('table')===n),
 cells=r=>[...r.children].filter(c=>/^T[DH]$/.test(c.tagName)),R=rows.filter(r=>cells(r).length);
 if(!R.length)return'';const cols=Math.max(...R.map(r=>cells(r).length)),w=Math.floor(9600/cols);
 let o='<w:tbl><w:tblPr><w:tblW w:w="9600" w:type="dxa"/><w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(s=>`<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('')+'</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>'+`<w:gridCol w:w="${w}"/>`.repeat(cols)+'</w:tblGrid>';
 R.forEach(r=>{o+='<w:tr>';cells(r).forEach(c=>{const b=v12blocks(c,ctx,{},0,v12fmt(c,c.tagName=='TH'?Object.assign({},f,{b:1}):f));o+=`<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${b||'<w:p/>'}</w:tc>`});o+='</w:tr>'});
 return o+'</w:tbl><w:p/>'}
function v12blocks(root,ctx,bp,depth,f0){let out='',cur=null;
 const flush=()=>{if(cur){if(cur.r||cur.k)out+=v12p(cur);cur=null}},mk=()=>cur||(cur=Object.assign({r:''},bp));
 const addT=(t,f)=>{t=t.replace(/\s+/g,' ');if(!cur||!cur.r)t=t.replace(/^ /,'');if(!t)return;mk().r+=v12run(t,f)};
 const walk=(n,f)=>{
  if(n.nodeType==3)return addT(n.data,f);if(n.nodeType!=1)return;const T=n.tagName;
  if(T=='BR'){mk().r+='<w:r><w:br/></w:r>';cur.k=1;return}
  if(T=='IMG'){mk().r+=v12img(n,ctx);cur.k=1;return}
  if(T=='UL'||T=='OL'){flush();out+=v12list(n,ctx,bp,depth,f);return}
  if(T=='TABLE'){flush();out+=v12table(n,ctx,depth,f);return}
  if(T=='HR'){flush();out+=v12p({r:'',k:1});return}
  if(/^(SCRIPT|STYLE)$/.test(T))return;
  const f2=v12fmt(n,f);
  if(/^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|LI|SECTION|ARTICLE)$/.test(T)){flush();const b2=Object.assign({},bp),al=n.style&&n.style.textAlign;
   if(al=='center'||al=='right')b2.jc=al;else if(al=='justify')b2.jc='both';
   if(/^H[1-6]$/.test(T)){const l=+T[1];b2.st='Heading'+Math.min(3,(l<=3?2:3)+(ctx.hs||0))}
   if(T=='BLOCKQUOTE')b2.ind=720;if(T=='PRE')f2.f='Courier New';
   out+=v12blocks(n,ctx,b2,depth,f2);return}
  [...n.childNodes].forEach(c=>walk(c,f2))};
 [...root.childNodes].forEach(c=>walk(c,f0||{}));flush();return out}
function v12html(h,ctx){const d=new DOMParser().parseFromString('<body>'+String(h||'')+'</body>','text/html').body;return v12blocks(d,ctx,{},0,{})}

const V12ST=`${V12XML}<w:styles ${V12W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="52"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:color w:val="595959"/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="2F5496"/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="2F5496"/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="24"/></w:rPr></w:style></w:styles>`;
function v12numbering(ctx){const lv=(i,f,t)=>`<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${f}"/><w:lvlText w:val="${t}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720+360*i}" w:hanging="360"/></w:pPr></w:lvl>`;
 return`${V12XML}<w:numbering ${V12W}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${lv(0,'bullet','•')+lv(1,'bullet','◦')+lv(2,'bullet','▪')+lv(3,'bullet','•')}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${lv(0,'decimal','%1.')+lv(1,'lowerLetter','%2.')+lv(2,'lowerRoman','%3.')+lv(3,'decimal','%4.')}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${ctx.nums.map(n=>`<w:num w:numId="${n.id}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="${n.s}"/></w:lvlOverride></w:num>`).join('')}</w:numbering>`}

/* Un document Word par cahier : titre, puis pages dans l'ordre (chaque page garde titres, listes, couleurs, polices, images, tableaux) */
function v12docx(c,S,TR){const ctx={media:[],nums:[],nn:2,hs:0};ctx.newNum=s=>{const id=ctx.nn++;ctx.nums.push({id,s});return id};
 const H=(t,st)=>v12p({st,r:v12run(t,{})});let b='';
 b+=v12p({st:'Title',r:v12run(c.cours,{})})+v12p({st:'Subtitle',r:v12run('Professeur : '+(c.prof||'—')+' · Sauvegardé le '+dt(Date.now()),{})});
 c.pages.forEach((p,i)=>{
  const ps=S.has('p:'+p.id),cx=(p.cpl||[]).filter(x=>S.has((x.k=='lecon'?'l:':'n:')+p.id+':'+x.id)),ts=(p.att||[]).filter(x=>x.k=='a'&&S.has('t:'+x.id));
  if(!ps&&!cx.length&&!ts.length)return;
  b+=H('Page '+(i+1)+' · '+(p.chap||'Sans chapitre')+(p.sujet?' — '+p.sujet:''),'Heading1');
  b+=v12p({sp:'w:after="160"',r:v12run(dt(p.start)+', '+hm(p.start)+' – '+hm(p.end),{i:1,c:'666666'})});
  if(ps)b+=v12html(p.html,ctx);
  cx.forEach(x=>{b+=H((x.k=='lecon'?'Leçon : ':'Complément : ')+(x.t||''),'Heading2');ctx.hs=1;b+=v12html(x.h,ctx);ctx.hs=0});
  ts.forEach(x=>{const T=TR[x.id]||{};
   if(T.t){b+=H('Transcription : '+(x.n||''),'Heading2');T.t.split(/\n{2,}/).forEach(q=>{if(q.trim())b+=v12p({r:v12run(q.replace(/\s+/g,' ').trim(),{})})})}
   if(T.r){b+=H('Résumé : '+(x.n||''),'Heading2');ctx.hs=1;b+=v12html(T.r,ctx);ctx.hs=0}})});
 const doc=`${V12XML}<w:document ${V12NS}><w:body>${b}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
 R='http://schemas.openxmlformats.org/officeDocument/2006/relationships',enc=new TextEncoder(),T=s=>enc.encode(s);
 const files=[
  {n:'[Content_Types].xml',d:T(`${V12XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`)},
  {n:'_rels/.rels',d:T(`${V12XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`)},
  {n:'word/document.xml',d:T(doc)},
  {n:'word/_rels/document.xml.rels',d:T(`${V12XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rSt" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rNum" Type="${R}/numbering" Target="numbering.xml"/>${ctx.media.map((m,i)=>`<Relationship Id="rImg${i+1}" Type="${R}/image" Target="media/${m.n}"/>`).join('')}</Relationships>`)},
  {n:'word/styles.xml',d:T(V12ST)},{n:'word/numbering.xml',d:T(v12numbering(ctx))},
  ...ctx.media.map(m=>({n:'word/media/'+m.n,d:m.d}))];
 const z=v12zip(files);return new Blob([z],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})}

/* =============== Fenêtre de choix =============== */
function v12close(){const o=$('#v12o');if(o)o.remove()}
function v12items(c){const G={p:[],n:[],l:[],a:[],t:[],d:[]};
 c.pages.forEach((p,i)=>{G.p.push({k:'p:'+p.id,t:'Page '+(i+1)+' · '+(p.chap||'Sans chapitre')+(p.sujet?' — '+p.sujet:''),s:dt(p.start)});
  (p.cpl||[]).forEach(x=>(x.k=='lecon'?G.l:G.n).push({k:(x.k=='lecon'?'l:':'n:')+p.id+':'+x.id,t:x.t||'Sans titre',s:'page '+(i+1)}));
  (p.att||[]).forEach(x=>{if(x.k=='a'&&x.st!='rec'){G.a.push({k:'a:'+x.id,t:x.n||'Enregistrement',s:'page '+(i+1)+(x.d?' · '+Math.ceil(x.d/60)+' min':'')});if(x.tr)G.t.push({k:'t:'+x.id,t:x.n||'Enregistrement',s:'page '+(i+1)})}})});
 (c.docs||[]).forEach(d=>G.d.push({k:'d:'+d.id,t:d.n,s:d.t=='pdf'?'PDF':'Word'}));return G}
function v12tog(cb){cb.closest('details').querySelectorAll('input[data-k]').forEach(i=>i.checked=cb.checked)}
function v12all(on){document.querySelectorAll('#v12o input[type=checkbox]:not(#v12j)').forEach(i=>i.checked=on)}
function v12open(list){const L=(list&&list.length?list:D.c).filter(c=>!c.del);if(!L.length)return toast('Aucun cahier à sauvegarder');
 V12.full=!(list&&list.length);V12.L=L;
 const lab={p:'📄 Pages',n:'📝 Notes complémentaires',l:'📘 Leçons',a:'🎙 Audios',t:'🗒 Transcriptions et résumés',d:'📕 PDF et Word'};
 const body=L.map(c=>{const G=v12items(c),tot=Object.keys(G).reduce((a,k)=>a+G[k].length,0);
  const secs=Object.keys(lab).filter(k=>G[k].length).map(k=>`<div style="margin:12px 0 2px"><b>${lab[k]}</b></div>`+G[k].map(x=>`<label style="display:flex;gap:10px;align-items:center;margin:6px 0"><input type=checkbox style="width:22px;height:22px;flex:none" data-c="${c.id}" data-k="${x.k}" checked><span style="flex:1;min-width:0">${esc(x.t)} <small class=hint>${esc(x.s)}</small></span></label>`).join('')).join('');
  return`<details${L.length==1?' open':''} style="margin:10px 0;border:1px solid var(--line);border-radius:16px;padding:10px 14px"><summary style="cursor:pointer"><span style="display:inline-flex;gap:10px;align-items:center;vertical-align:middle"><input type=checkbox checked style="width:22px;height:22px;flex:none" onclick="event.stopPropagation()" onchange="v12tog(this)"><b>${esc(c.cours)}</b> <small class=hint>${tot} élément(s)</small></span></summary>${secs||'<p class=hint>Ce cahier est vide.</p>'}</details>`}).join('');
 v12close();const o=document.createElement('div');o.id='v12o';o.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;z-index:260;background:#000a;display:flex';
 o.innerHTML=`<div class=scb><div class=drh><b>💾 Sauvegarder</b><button onclick="v12close()">✕</button></div><div id=v12b>
<p class=hint>Cochez ce que vous voulez enregistrer. Les pages, notes, leçons et transcriptions forment un document Word (.docx) propre, par cahier ; les audios et les PDF restent des fichiers à part, rangés par cahier.</p>
<div style="display:flex;gap:8px;margin:8px 0"><button class=ch style="margin:0" onclick="v12all(1)">Tout cocher</button><button class=ch style="margin:0" onclick="v12all(0)">Tout décocher</button></div>${body}
<label style="display:flex;gap:10px;align-items:center;margin:14px 0 6px"><input type=checkbox id=v12j style="width:22px;height:22px;flex:none"${V12.full?' checked':''}><span>Ajouter un fichier de sauvegarde complet (.json) pour restaurer dans l’application</span></label>
<p class=hint>${window.showDirectoryPicker?'Un sélecteur s’ouvrira pour choisir le dossier de cet appareil.':'Votre téléphone vous proposera où enregistrer ou envoyer les fichiers (Fichiers, Drive, WhatsApp…).'}</p>
<div style="position:sticky;bottom:-16px;background:var(--bg);padding:10px 0"><button class=p onclick="v12go()">💾 ${window.showDirectoryPicker?'Choisir le dossier et sauvegarder':'Sauvegarder'}</button></div></div></div>`;
 o.onclick=e=>{if(e.target==o&&!V12.busy)o.remove()};document.body.appendChild(o)}
window.exp=function(list){v12open(list)};

/* =============== Fabrication et remise des fichiers =============== */
function v12status(h){const b=$('#v12b');if(b)b.innerHTML=h}
async function v12files(sel,wantJ){const byC={};sel.forEach(s=>(byC[s.c]=byC[s.c]||new Set()).add(s.k));
 const files=[],used=new Set(),add=(path,b)=>{let n=path,k=1;while(used.has(n.toLowerCase())){k++;n=path.replace(/(\.[^./]+)?$/,' ('+k+')$1')}used.add(n.toLowerCase());files.push({n,b})};
 for(const cid of Object.keys(byC)){const c=D.c.find(x=>x.id==cid);if(!c)continue;const S=byC[cid],dir=v12safe(c.cours)+'/';
  const TR={};for(const k of S)if(k[0]=='t'){const id=k.slice(2);TR[id]={t:(await fget('tr:'+id))||'',r:(await fget('rs:'+id))||''}}
  if([...S].some(k=>/^[pnlt]:/.test(k)))add(dir+v12safe(c.cours)+'.docx',v12docx(c,S,TR));
  for(const k of S){const id=k.slice(2);
   if(k[0]=='a'){let x=null;c.pages.forEach(p=>(p.att||[]).forEach(a=>{if(a.id==id)x=a}));const b=await fget(id);
    if(x&&b){const t=b.type||x.m||'audio/webm',e=/mp4|aac|m4a/.test(t)?'m4a':/ogg/.test(t)?'ogg':/wav/.test(t)?'wav':'webm';add(dir+'Audios/'+v12safe(x.n)+'.'+e,b.type?b:new Blob([b],{type:t}))}}
   else if(k[0]=='d'){const d=(c.docs||[]).find(a=>a.id==id),b=await fget('doc:'+id);
    if(d&&b){const pdf=d.t=='pdf';add(dir+'Documents/'+v12safe(d.n)+(pdf?'.pdf':'.docx'),new Blob([b],{type:pdf?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}))}}}}
 if(wantJ){const ids=new Set(Object.keys(byC));add('Sauvegarde-cahiers-'+new Date().toISOString().slice(0,10)+'.json',new Blob([JSON.stringify({v:1,c:D.c.filter(c=>ids.has(c.id))})],{type:'application/json'}))}
 return files}
const v12flat=(n,b)=>n.replace(/\//g,' – ').replace(/\.webm$/,/audio\//.test(b.type||'')?'.weba':'.webm');
function v12dl(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove()}
async function v12write(root,files){for(const f of files){const parts=f.n.split('/');let h=root;for(const p of parts.slice(0,-1))h=await h.getDirectoryHandle(p,{create:true});
 const fh=await h.getFileHandle(parts[parts.length-1],{create:true}),w=await fh.createWritable();await w.write(f.b);await w.close()}}
const v12ul=files=>'<ul style="text-align:left;margin:8px 0;padding-left:20px;font-size:14px">'+files.map(f=>`<li>${esc(f.n)}</li>`).join('')+'</ul>';
async function v12go(){if(V12.busy)return;
 const sel=[...document.querySelectorAll('#v12o input[data-k]:checked')].map(i=>({c:i.dataset.c,k:i.dataset.k})),wantJ=!!($('#v12j')||{}).checked;
 if(!sel.length&&!wantJ)return toast('Cochez au moins un élément');
 let dir=null;
 if(window.showDirectoryPicker){try{dir=await window.showDirectoryPicker({mode:'readwrite',id:'cahier-num'})}catch(e){if(e&&e.name=='AbortError')return;dir=null}}
 V12.busy=1;v12status('<p class=hint>Préparation des fichiers… (les longs audios peuvent prendre un moment)</p>');
 try{const files=await v12files(sel,wantJ);if(!files.length){V12.busy=0;v12status('<p class=hint>Rien à enregistrer : les fichiers cochés sont absents de cet appareil.</p><div class=f><button onclick="v12close()">Fermer</button></div>');return}
  D.bk=Date.now();raw();
  if(dir){const root=await dir.getDirectoryHandle('Cahier numérique '+new Date().toISOString().slice(0,10),{create:true});await v12write(root,files);
   V12.busy=0;return v12status(`<p><b>✅ ${files.length} fichier(s) enregistré(s)</b> dans le dossier choisi, sous « ${esc(root.name)} » :</p>${v12ul(files)}<div class=f><button class=p onclick="v12close()">Fermer</button></div>`)}
  const flat=files.map(f=>new File([f.b],v12flat(f.n,f.b),{type:f.b.type||''}));V12.files=files;V12.flat=flat;V12.busy=0;
  if(navigator.canShare&&navigator.canShare({files:flat})){try{await navigator.share({files:flat,title:'Cahier numérique'});return v12status(`<p><b>✅ Fichiers prêts</b></p>${v12ul(files)}<div class=f><button class=p onclick="v12close()">Fermer</button></div>`)}
   catch(e){if(e&&e.name=='AbortError')return v12ready();if(e&&e.name=='NotAllowedError')return v12ready()}}
  v12fallback()
 }catch(e){V12.busy=0;v12status(`<p class=hint>Sauvegarde impossible : ${esc(String(e&&e.message||e))}</p><div class=f><button class=p onclick="v12close()">Fermer</button></div>`)}}
function v12ready(){v12status(`<p><b>${V12.flat.length} fichier(s) prêt(s).</b> Touchez le bouton pour choisir où les enregistrer ou les envoyer.</p>${v12ul(V12.files)}<div class=f><button class=p onclick="v12share2()">📲 Choisir où enregistrer</button><button onclick="v12fallback()">Télécharger à la place</button></div>`)}
async function v12share2(){try{await navigator.share({files:V12.flat,title:'Cahier numérique'});v12close()}catch(e){if(e&&e.name!='AbortError')v12fallback()}}
async function v12fallback(){const F=V12.files;if(!F||!F.length)return;
 try{if(F.length==1)v12dl(F[0].b,F[0].n.split('/').pop());
  else{const Z=[];for(const f of F)Z.push({n:f.n,d:new Uint8Array(await f.b.arrayBuffer())});v12dl(v12zip(Z),'Cahier numérique '+new Date().toISOString().slice(0,10)+'.zip')}
  v12status(`<p><b>✅ Fichier téléchargé</b>${F.length>1?' : un dossier compressé (.zip) qui range tout par cahier. Ouvrez-le depuis « Fichiers » / « Téléchargements ».':'.'}</p>${v12ul(F)}<div class=f><button class=p onclick="v12close()">Fermer</button></div>`)}
 catch(e){v12status('<p class=hint>Téléchargement impossible : fichiers trop volumineux pour cet appareil. Cochez moins d’éléments.</p><div class=f><button class=p onclick="v12close()">Fermer</button></div>')}}

/* =============== Affichage PC et tablette (le téléphone ne change pas) =============== */
(()=>{const s=document.createElement('style');
s.textContent=`@media (min-width:768px) and (min-height:540px){
#app{max-width:none;width:100%;box-sizing:border-box;padding:0 clamp(24px,4vw,72px) 48px;display:flex;flex-wrap:wrap;gap:0 18px;align-content:flex-start}
#app>*{flex:0 0 100%;min-width:0;box-sizing:border-box}
#app>.rs{flex:0 0 calc(50% - 9px)}
#app>.card{max-width:940px;margin-inline:auto}
#app>.f:has(input,textarea),#app>.top:has(+.f input){max-width:760px;margin-inline:auto}
.shelf{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:0 18px}
.shelf>*{grid-column:1/-1}.shelf>.bkr{grid-column:auto}
#res,#cl,#v8l,#v6a,#v6l{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:0 18px}
#res>p,#cl>p,#v8l>p,#v8l>button,#v6a>p,#v6l>p{grid-column:1/-1}
.ed{max-width:none;margin:0;padding-left:clamp(16px,3vw,56px);padding-right:clamp(16px,3vw,56px)}
.tb{flex-wrap:wrap}
.sheet{padding:28px clamp(24px,4vw,64px);font-size:18px}
.scb{max-width:880px;margin:auto;border-radius:24px}}
@media (min-width:1200px) and (min-height:540px){#app>.rs{flex-basis:calc(33.333% - 12px)}}`;
document.head.appendChild(s)})();
