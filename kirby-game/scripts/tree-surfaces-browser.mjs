import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const baseline=process.env.TREE_SURFACE_BASELINE==='1',url=process.env.GAME_URL??'http://127.0.0.1:5187/',out=fileURLToPath(new URL('../node_modules/.cache/tree-surfaces/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.route('**/__tree-surfaces',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto(url+'__tree-surfaces');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),b=await import('/src/broadleaf-tree.ts'),s=await import('/src/spruce-shape.ts'),{createFoliageTexture}=await import('/src/foliage-texture.ts'),{RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1400,1000);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#b4cbd2');scene.add(new T.HemisphereLight('#e2eeff','#6f7951',1.4));const sun=new T.DirectionalLight('#fff0d8',2.7);sun.position.set(-12,25,18);scene.add(sun);
  const generator=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=generator.fromScene(room,.04).texture;room.dispose();generator.dispose();
  const floor=new T.Mesh(new T.PlaneGeometry(150,100),new T.MeshStandardMaterial({color:'#71835c',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.035;scene.add(floor);
  const current=new T.Group(),shapes=s.spruceGeometries(),needle=s.spruceNeedleMaterial?.().clone()??new T.MeshStandardMaterial({map:createFoliageTexture('spruce'),roughness:1}),wood=s.spruceNeedleMaterial?s.spruceBarkMaterial().clone():new T.MeshStandardMaterial({color:'#69513b',roughness:1});
  for(const part of s.spruceParts()){const mesh=new T.Mesh(shapes[part.kind],part.kind==='wood'?wood:needle);mesh.applyMatrix4(part.matrix);mesh.position.x-=14;if(part.kind==='needles')mesh.material=needle;current.add(mesh);}
  needle.color.set('#356d46');if(s.spruceNeedleMaterial)wood.color.set('#69513b');
  for(const [kind,x] of [['birch',-5],['orchard',5],['autumn',15]]){const tree=b.createBroadleafTree(kind,1);for(const [key,material] of [['wood',b.treeWoodMaterial(kind==='birch')],['leaves',b.treeLeafMaterial()],['fruit',b.treeFruitMaterial()]]){if(!tree[key].attributes.position.count)continue;const m=new T.Mesh(tree[key],material.clone());m.position.x=x;if(key==='leaves')m.material.color.set(kind==='autumn'?'#ca6c24':'#668c37');current.add(m);}}
  scene.add(current);const camera=new T.PerspectiveCamera(43,1.4,.1,200);window.treeSurface={T,renderer,scene,camera,current};
 });
 if(baseline)await writeFile(out+'before-models.json',JSON.stringify(await page.evaluate(()=>{treeSurface.current.updateMatrixWorld(true);return treeSurface.current.toJSON();})));
 else{const old=JSON.parse(await readFile(out+'before-models.json','utf8'));await page.evaluate(json=>{const q=treeSurface;q.before=new q.T.ObjectLoader().parse(json);q.before.visible=false;q.scene.add(q.before);},old);}
 const views=[['gallery',[19,10,34],[0,4.8,0]],['spruce',[-7,5.7,12],[-14,4,0]],['needles',[-11.8,5.4,3.2],[-14,4.8,0]],['birch-bark',[-2.9,2.2,2.6],[-5,2,0]],['orchard-bark',[7.4,2.1,2.5],[5,2,0]],['autumn-bark',[17.4,2.1,2.5],[15,2,0]]],report={views:{},errors};
 for(const [name,eye,target] of views){
  report.views[name]=await page.evaluate(async({eye,target,baseline})=>{const q=treeSurface;q.camera.position.fromArray(eye);q.camera.lookAt(...target);q.camera.updateMatrixWorld();
   const sample=async old=>{q.current.visible=!old;if(q.before)q.before.visible=old;const times=[],gl=q.renderer.getContext();for(let i=0;i<32;i++){await new Promise(requestAnimationFrame);const start=performance.now();q.renderer.render(q.scene,q.camera);gl.finish();if(i>=12)times.push(performance.now()-start);}times.sort((a,b)=>a-b);return {calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,medianMs:times[10],p90Ms:times[18]};};
   if(baseline)return sample(false);const before=await sample(true),after=await sample(false),control=await sample(true);q.current.visible=true;q.before.visible=false;q.renderer.render(q.scene,q.camera);return {before,after,control};
  },{eye,target,baseline});await page.screenshot({path:out+(baseline?'before-':'')+name+'.png'});
 }
 await writeFile(out+(baseline?'before-checks':'checks')+'.json',JSON.stringify(report,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{await browser.close();}
