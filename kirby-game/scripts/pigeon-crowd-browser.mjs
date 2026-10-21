import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=new URL('../node_modules/.cache/pigeon-flock/',import.meta.url);await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5181,strictPort:true,hmr:false},plugins:[{name:'flock-bench',configureServer(server){server.middlewares.use('/__flock_bench',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<html><link rel="icon" href="data:,"><body style="margin:0"><script type="module" src="/scripts/pigeon-crowd-fixture.ts"></script></body></html>');});}}]});
await server.listen();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5181/__flock_bench');await page.waitForFunction(()=>window.benchReady,null,{timeout:180000});
 const results=[];
 for(const mode of ['individual','instanced']){
  const report=await page.evaluate(mode=>window.runBench(mode),mode);results.push(report);
  await page.screenshot({path:new URL(mode+'.png',output).pathname.slice(1)});
 }
 assert.deepEqual(errors,[]);assert(results[1].calls<=42);assert(results[1].triangles<results[0].triangles*.5);assert(results[1].buffersStable,'growing a flock must replace GPU buffers without leaking geometries or textures');
 await writeFile(new URL('gpu-performance.json',output),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();await server.close();}
