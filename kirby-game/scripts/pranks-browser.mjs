import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/prank-preview',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><style>body{margin:0}canvas{display:block}</style><script type="module">
 import * as T from '/node_modules/.vite/deps/three.js';
 import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
 import {PrankEffects} from '/src/prank-effects.ts';import {makePrank} from '/src/pranks.ts';
 const scene=new T.Scene();scene.background=new T.Color('#c9e4f2');const camera=new T.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);camera.position.set(8,6,12);camera.lookAt(1,1.8,0);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);document.body.append(renderer.domElement);
 scene.add(new T.HemisphereLight(0xffffff,0x56723e,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,8,5);scene.add(light);
 const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:0x71904c,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;scene.add(ground);
 const gltf=await new GLTFLoader().loadAsync('/models/kirby-animated.glb');const actor=new T.Group();actor.add(gltf.scene);scene.add(actor);const sounds=[];const effect=new PrankEffects((...args)=>sounds.push(args));scene.add(effect.group);const resolve=()=>({actor,root:gltf.scene,grounded:true});
 window.showPrank=(kind,t)=>{effect.beginFrame();effect.update([],0,resolve,actor.position);actor.position.set(0,0,0);const event=makePrank('one',kind,0,[0,0,0],1);if(kind==='rainbow'){for(let i=0;i<30;i++){actor.position.set(-3+i*.14,0,Math.sin(i*.09)*1.4);actor.rotation.y=Math.PI/2;effect.update([event],event.startsAt+i*100,resolve,actor.position);}}else effect.update([event],event.startsAt+t*1000,resolve,actor.position);renderer.render(scene,camera);return {objects:effect.group.children.length,sounds};};window.ready=true;
 </script>`}));
 await page.goto('http://127.0.0.1:5173/prank-preview');await page.waitForFunction(()=>window.ready);
 for(const [kind,t,name] of [['hiccup',.7,'hiccup'],['rainbow',3,'rainbow'],['gift',1.5,'parachute'],['gift',4.6,'duck']]){await page.evaluate(([kind,t])=>window.showPrank(kind,t),[kind,t]);await page.screenshot({path:process.env.TEMP+'/kirby-prank-'+name+'.png'});}
 assert.deepEqual(errors,[]);console.log('PASS real Kirby prank visuals rendered without browser errors');
}finally{await browser.close();}
