import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:900,height:750}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/bed-preview',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto('http://127.0.0.1:5174/bed-preview');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{KirbyHome}=await import('/src/kirby-home.ts'),{CharacterController}=await import('/src/controller.ts'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const scene=new T.Scene();scene.background=new T.Color('#b9d5dd');const home=new KirbyHome();scene.add(home.group);
  // Cutaway for inspecting bedding, without changing production house visibility.
  home.group.getObjectByName('Kirby home tiled roof').visible=false;
  for(const o of home.group.children)if(o.isMesh&&(o.material.isMeshBasicMaterial||o.material.color.getHexString()==='a4734d'))o.visible=false;
  const g=await new GLTFLoader().loadAsync('/models/kirby-animated.glb'),c=new CharacterController(g.scene,g.animations);scene.add(c.actor);c.actor.position.copy(home.entrance);
  scene.add(new T.HemisphereLight('#ffffff','#778c64',2));const light=new T.DirectionalLight('#fff0d5',2.5);light.position.set(20,40,40);scene.add(light);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(900,750);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(40,1.2,.1,200);camera.position.copy(home.group.position).add(new T.Vector3(3.3,6.5,5));camera.lookAt(home.group.position.clone().add(new T.Vector3(0,1.8,-.5)));
  window.preview={home,c,renderer,scene,camera};renderer.render(scene,camera);
 });
 await page.screenshot({path:process.env.TEMP+'/kirby-bed-empty.png'});
 for(const state of ['covered','awake']){
  const info=await page.evaluate(state=>{const {home,c,renderer,scene,camera}=window.preview;if(state==='covered')home.start(c);else home.wake();for(let i=0;i<120;i++)home.update(1/60);renderer.render(scene,camera);return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},state);
  await page.screenshot({path:process.env.TEMP+`/kirby-bed-${state}.png`});console.log({state,...info});
 }
 console.log({errors});if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
