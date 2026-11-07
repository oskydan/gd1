// Serve the same public package that GitHub Pages receives, including MP4 ranges.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../dist');
if(!fs.existsSync(path.join(root,'index.html')))throw new Error('Run python3 tools/package-site.py before browser tests.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.mp4':'video/mp4','.xml':'application/xml','.txt':'text/plain'};
http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end()}
  let file;
  try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname))}catch{res.writeHead(400);return res.end()}
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  fs.stat(file,(error,stat)=>{
    const missing=Boolean(error||!stat.isFile());
    if(missing){
      file=path.join(root,'404.html');
      try{stat=fs.statSync(file)}catch{res.writeHead(404);return res.end('Not found')}
    }
    const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-store'};
    let start=0,end=stat.size-1,status=missing?404:200;
    if(req.headers.range&&!missing){
      const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if(!range){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end()}
      start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),end):end;
      if(start>end){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end()}
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length']=end-start+1;
    res.writeHead(status,headers);
    if(req.method==='HEAD')return res.end();
    const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  });
}).listen(4173,'127.0.0.1',()=>console.log('GD1 test server: http://127.0.0.1:4173'));
