import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/push-preview',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><style>body{margin:0}</style><script type="module">
 import * as T from '/node_modules/.vite/deps/three.js';import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
 import {CharacterController} from '/src/controller.ts';import {createNpcs} from '/src/npcs.ts';import {resolveAttack} from '/src/combat.ts';
 const scene=new T.Scene();scene.background=new T.Color('#c9e4f2');const camera=new T.PerspectiveCamera(40,innerWidth/innerHeight,.1,100);camera.position.set(10,5,9);camera.lookAt(0,1,2);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);scene.add(new T.HemisphereLight(0xffffff,0x56723e,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,8,5);scene.add(light);
 const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:0x71904c}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;scene.add(ground);
 const gltf=await new GLTFLoader().loadAsync('/models/kirby-animated.glb'),c=new CharacterController(gltf.scene,gltf.animations),n=createNpcs(gltf.scene,gltf.animations)[1];scene.add(c.actor,n.actor);n.networkAnimate('Idle',0);n.yaw=0;n.actor.rotation.y=0;n.actor.position.set(0,0,2.4);
 let time=0;window.advance=(until)=>{while(time<until){c.update(.01,{forward:false,left:false,right:false,attack:true});resolveAttack(c,[n]);n.update(.01,[]);time+=.01;}renderer.render(scene,camera);return {time,state:n.state,y:n.actor.position.y,z:n.actor.position.z,health:n.health,down:n.isDown};};window.ready=true;
 </script>`}));
 await page.goto('http://127.0.0.1:5173/push-preview');await page.waitForFunction(()=>window.ready);
 for(const [t,label] of [[.24,'contact'],[.6,'roll'],[1.25,'recovered']]){const result=await page.evaluate(t=>window.advance(t),t);assert.equal(result.health,3);assert(!result.down);await page.screenshot({path:process.env.TEMP+'/kirby-push-'+label+'.png'});if(t>1)assert(result.state!=='Roll');}
 assert.deepEqual(errors,[]);console.log('PASS push contact, real-model tumble and recovery');
}finally{await browser.close();}
