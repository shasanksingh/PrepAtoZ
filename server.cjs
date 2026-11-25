const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, 'dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8'};
const port = Number(process.env.PORT || 4173);
const {loadEnvFile}=require('node:process');
try{loadEnvFile(path.join(__dirname,'.env'));}catch{}
http.createServer(async (req,res) => {
 if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){res.writeHead(403);return res.end('Unrecognized host');}
 if(req.url.startsWith('/api/')){
  try{
   const {handleApi}=await import('./server/api.mjs');
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>300000){res.writeHead(413);return res.end('Request too large');}chunks.push(chunk);}
   const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
   const response=await handleApi(request,{ip:req.socket.remoteAddress});
   res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error('Local API failed:',error.name);res.writeHead(503,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Local service is unavailable.'}));}
 }
 let filename;
 try { filename = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname)); }
 catch { res.writeHead(400); return res.end('Invalid path'); }
 if(filename !== root && !filename.startsWith(root + path.sep)){res.writeHead(403);return res.end('Forbidden');}
 if(filename===root)filename=path.join(root,'index.html');
 fs.stat(filename,(err,stat)=>{
  if(err||!stat.isFile()){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  fs.createReadStream(filename).pipe(res);
 });
}).listen(port,'127.0.0.1',()=>console.log(`PrepAtoZ is running at http://127.0.0.1:${port}`));
