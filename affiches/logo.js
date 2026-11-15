const {chromium}=require('playwright');
const CELLS=[[2,0,'#a3e635'],[3,0,'#bef264'],[4,0,'#bef264'],[1,1,'#4ade80'],[2,1,'#a3e635'],[3,1,'#a3e635'],[4,1,'#bef264'],[1,2,'#4ade80'],[2,2,'#4ade80'],[3,2,'#a3e635'],[0,3,'#2dd4bf'],[1,3,'#2dd4bf'],[2,3,'#4ade80'],[0,4,'#22d3ee']];
const mark=s=>`<svg width="${s}" height="${s}" viewBox="0 0 325 325">${CELLS.map(a=>`<rect x="${a[0]*67}" y="${a[1]*67}" width="58" height="58" rx="13" fill="${a[2]}"/>`).join('')}</svg>`;
module.exports=async OUT=>{const b=await chromium.launch();
for(const [name,col] of [['dark','#ffffff'],['light','#0f172a']]){
 const p=await b.newPage({viewport:{width:900,height:240},deviceScaleFactor:3});
 await p.setContent(`<body style="margin:0;background:transparent"><div id=l style="display:inline-flex;align-items:center;gap:26px;padding:20px 24px;font:800 92px/1 Arial,Helvetica,sans-serif;color:${col};letter-spacing:-2px">${mark(150)}<span>Answer <span style="font-weight:500">Digital</span></span></div></body>`);
 await (await p.$('#l')).screenshot({path:OUT+`logo-${name}.png`,omitBackground:true});}
const p=await b.newPage({viewport:{width:400,height:400},deviceScaleFactor:3});
await p.setContent(`<body style="margin:0;background:transparent"><div id=l style="display:inline-block;padding:10px">${mark(320)}</div></body>`);
await (await p.$('#l')).screenshot({path:OUT+'marque.png',omitBackground:true});
await b.close()};
