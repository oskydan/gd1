// Render with the same functions and venue-local clock used in the browser.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const [root,date]=process.argv.slice(2);
if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw new Error('A listing snapshot date is required');
const code=fs.readFileSync(path.join(root,'script.js'),'utf8');
const start=code.indexOf('const campEndInstants =');
const end=code.indexOf('// Calendar dates are all-day;');
if(start<0||end<=start)throw new Error('Camp renderer boundaries are missing');
for(const lang of ['en','uk']){
 const nodes=Object.fromEntries(['home-camp-list','upcoming-camps','past-camps','upcoming-empty','past-empty','past-camps-load-more'].map(id=>[id,{innerHTML:'',hidden:true}]));
 const context={URL,Date:class extends Date{static now(){return Date.parse(date+'T12:00:00Z')}},window:{location:{href:'https://gd1.pro/'}},document:{documentElement:{lang},querySelector:selector=>nodes[selector.slice(1)]||null}};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(root,'camps-data.js'),'utf8'),context);
 if(lang==='uk')vm.runInContext(fs.readFileSync(path.join(root,'camps-data-uk.js'),'utf8'),context);
 vm.runInContext(`const ui=(en,uk)=>${JSON.stringify(lang)}==='uk'?uk:en;const campList=window.GD1_CAMPS;\n`+code.slice(start,end)+'\nrenderHomeCamps();renderCampArchive();',context);
 for(const name of ['index','camps']){
  const file=path.join(root,name+(lang==='uk'?'-uk':'')+'.html');let html=fs.readFileSync(file,'utf8');
  const ids=name==='index'?['home-camp-list']:['upcoming-camps','past-camps'];
  for(const id of ids){
   // Existing generated content may contain nested divs: delimit with comments.
   const marked=new RegExp(`(<div[^>]*id="${id}"[^>]*>)(?:<!-- camp-listing:start -->[\\s\\S]*?<!-- camp-listing:end -->|\\s*)(</div>)`);
   if(!marked.test(html))throw new Error(`Missing listing slot: ${file} #${id}`);
   html=html.replace(marked,(_,open,close)=>open+`<!-- camp-listing:start -->${nodes[id].innerHTML}<!-- camp-listing:end -->`+close);
  }
  for(const id of name==='camps'?['upcoming-empty','past-empty','past-camps-load-more']:[]){
   html=html.replace(new RegExp(`<([a-z]+)([^>]*id="${id}"[^>]*)>`),(_,tag,attrs)=>`<${tag}${attrs.replace(/\s+hidden(?:="[^"]*")?/g,'')}${nodes[id].hidden?' hidden':''}>`);
  }
  html=html.replace(/\s*<!-- camp-listings-as-of: [\d-]+ -->/g,'');
  html=html.replace('</head>',`  <!-- camp-listings-as-of: ${date} -->\n</head>`);
  fs.writeFileSync(file,html);
 }
}
