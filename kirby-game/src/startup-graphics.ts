import * as T from 'three';
import {startupTask} from './startup-tasks';

/** Compile variants and upload buffers in small groups without drawing the whole world. */
export async function prepareStartupGraphics(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera){
 scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 type Renderable=T.Mesh|T.Sprite|T.Points|T.Line;
 const batches:Renderable[][]=[],seen=new Set<string>();let batch:Renderable[]=[];
 scene.traverse(object=>{
  if(!(object instanceof T.Mesh||object instanceof T.Sprite||object instanceof T.Points||object instanceof T.Line))return;
  const materials=Array.isArray(object.material)?object.material:[object.material];
  const key=JSON.stringify([materials.map(m=>m.uuid),object.type,object instanceof T.InstancedMesh,object instanceof T.BatchedMesh,object instanceof T.SkinnedMesh,'instanceColor' in object&&!!object.instanceColor,Object.keys(object.geometry.attributes),Object.entries(object.geometry.morphAttributes).map(([name,attributes])=>[name,Array.isArray(attributes)?attributes.length:undefined])]);
  if(!seen.has(key)){seen.add(key);batch.push(object);if(batch.length===8){batches.push(batch);batch=[];}}
 });
 if(batch.length)batches.push(batch);
 for(const meshes of batches){
  // A shallow group lets Three use the real scene's lights, fog and environment.
  const group=new T.Group();group.children=meshes;
  await renderer.compileAsync(group,camera,scene);
  await startupTask();
 }
 performance.mark('kirby-shaders-ready');
 const textures=new Set<T.Texture>();
 scene.traverse(object=>{if(object instanceof T.Mesh||object instanceof T.Sprite||object instanceof T.Points||object instanceof T.Line)for(const material of Array.isArray(object.material)?object.material:[object.material])for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);});
 let count=0;for(const texture of textures){renderer.initTexture(texture);if(++count%4===0)await startupTask();}
 performance.mark('kirby-textures-ready');
 // A one-pixel scissor retains the screen's tone mapping and colour space.
 // An offscreen target would compile a second, unused set of shader variants.
 const viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest(),shadowUpdate=renderer.shadowMap.autoUpdate;
 const visible=scene.children.map(root=>[root,root.visible] as const);
 try{
  renderer.shadowMap.autoUpdate=false;renderer.setViewport(0,0,1,1);renderer.setScissor(0,0,1,1);renderer.setScissorTest(true);
  for(const [root] of visible){
   if(root instanceof T.Light)continue;
   for(const [other,wasVisible] of visible)other.visible=other instanceof T.Light?wasVisible:other===root&&wasVisible;
   renderer.render(scene,camera);await startupTask();
  }
 }finally{
  for(const [root,wasVisible] of visible)root.visible=wasVisible;
  renderer.shadowMap.autoUpdate=shadowUpdate;renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
 }
}
