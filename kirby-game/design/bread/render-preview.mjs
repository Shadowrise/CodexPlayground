import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dir = new URL(process.argv.includes('--textured') ? './textured/' : './tiny-treats/', import.meta.url);
const vendor = new URL('../../node_modules/three/', import.meta.url);
const html = `<!doctype html><html><head><style>body{margin:0}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/build/three.module.js"}}</script></head><body><script type="module">
import * as T from 'three';
import {GLTFLoader} from '/examples/jsm/loaders/GLTFLoader.js';
const renderer = new T.WebGLRenderer({antialias:true});renderer.setSize(900,700);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const scene = new T.Scene();scene.background=new T.Color('#dfddd4');scene.add(new T.HemisphereLight('#fff9ee','#969981',2.1));
const light = new T.DirectionalLight('#fff1d7',3.2);light.position.set(-2,4,3);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-1;light.shadow.camera.right=1;light.shadow.camera.top=1;light.shadow.camera.bottom=-1;light.shadow.normalBias=.003;scene.add(light);
const ground = new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#bfc4b2',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const asset=await new GLTFLoader().loadAsync('/bread_slice.glb');const box=new T.Box3().setFromObject(asset.scene);asset.scene.position.y=-box.min.y;let triangles=0,meshes=0;
const materials=[];asset.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;materials.push({name:o.material.name,baseColorWidth:o.material.map?.image.width,normalWidth:o.material.normalMap?.image.width});}});scene.add(asset.scene);
const camera = new T.PerspectiveCamera(33,900/700,.01,20);camera.position.set(.63,.49,1.22);camera.lookAt(0,.25,0);renderer.render(scene,camera);
window.result={meshes,triangles,materials,glbLoaded:true};
</script></body></html>`;
const server = http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
  const name=req.url.slice(1);
  const file=name==='bread_slice.glb'?new URL(name,dir):new URL(name,vendor);
  if(!file.href.startsWith(dir.href)&&!file.href.startsWith(vendor.href)){res.writeHead(403);res.end();return;}
  try{res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':'model/gltf-binary');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:900,height:700}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>window.result,{timeout:20000});
  await page.screenshot({path:fileURLToPath(new URL('bread_slice-preview.png',dir))});
  console.log(JSON.stringify({bytes:fs.statSync(new URL('bread_slice.glb',dir)).size,render:await page.evaluate(()=>window.result),errors}));
  if(errors.length)throw Error(errors.join('\n'));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
