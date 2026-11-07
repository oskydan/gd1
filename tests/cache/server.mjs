// Disposable deployment simulator. Not part of the published site.
import http from 'node:http';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const hash=body=>createHash('sha256').update(body).digest('hex').slice(0,16);
const read=name=>fs.readFileSync(new URL(name,root));
let revision=0,blocked=false;const counts={};
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZioAAAAASUVORK5CYII=','base64');
function assets(){return {
 'cache.js':read('cache.js'),
 'styles.css':Buffer.from(`body { color: ${revision?'rgb(60, 70, 80)':'rgb(10, 20, 30)'} }`),
 'script.js':Buffer.from(`window.deployment=${revision};`),
 'assets/picture.png':Buffer.concat([image,Buffer.from(String(revision))]),
 'assets/font.woff2':read('assets/fonts/inter-latin.woff2')
}}
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4174');
 const scope=url.pathname.startsWith('/gd1/')?'/gd1/':'/';
 const name=url.pathname.slice(scope.length);
 res.setHeader('Cache-Control','no-store');res.setHeader('Access-Control-Allow-Origin','*');
 if(url.pathname==='/__test/reset'){revision=0;blocked=false;for(const k of Object.keys(counts))delete counts[k];return res.end('ok');}
 if(url.pathname==='/__test/block-storage'){blocked=true;return res.end('ok');}
 if(url.pathname==='/__test/change'){revision++;return res.end('ok');}
 if(url.pathname==='/__test/counts'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(counts));}
 counts[url.pathname]=(counts[url.pathname]||0)+1;
 const files=assets();
 if(name===''||name==='index.html'){
  const asset=name=>scope+name+'?v='+hash(files[name]);
  res.setHeader('Content-Type','text/html');return res.end(`<!doctype html><html lang="en"><head><title>Cache fixture</title><link rel="stylesheet" href="${asset('styles.css')}"><link rel="preload" as="font" type="font/woff2" crossorigin href="${asset('assets/font.woff2')}"></head><body><h1>Deployment ${revision}</h1><img alt="Fixture" src="${asset('assets/picture.png')}"><script>window.GD1_CACHE_TEST=true</script><script src="${asset('script.js')}"></script><script src="${asset('cache.js')}" defer></script></body></html>`);
 }
 let body=files[name];let type=name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.woff2')?'font/woff2':'image/png';
 if(name==='sw.js'){body=Buffer.concat([Buffer.from(blocked?"Object.defineProperty(self,'caches',{value:{open:async()=>{throw Error('Storage blocked')},keys:async()=>{throw Error('Storage blocked')}}});\n":''),read('sw.js')]);type='text/javascript';}
 if(name.startsWith('assets/item-'))body=Buffer.from(name);
 if(name==='assets/large.png')body=Buffer.alloc(513*1024,3);
 if(['track','form','movie.mp4'].includes(name)){body=Buffer.from('not cached');type='text/plain';}
 if(!body){res.statusCode=404;return res.end('missing');}
 res.setHeader('Content-Type',type);
 if(req.headers.range){res.statusCode=206;res.setHeader('Content-Range',`bytes 0-9/${body.length}`);body=body.subarray(0,10);}
 res.setHeader('Content-Length',body.length);res.end(body);
}).listen(4174,'127.0.0.1',()=>console.log('GD1 cache fixture ready'));
