import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();await page.route('**/check-shiba',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));await page.goto('http://127.0.0.1:5173/check-shiba');
 console.log(await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),{KirbyHome}=await import('/src/kirby-home.ts');
  const model=(await new GLTFLoader().loadAsync('/models/shiba.glb')).scene,home=new KirbyHome();home.dogHouse.placeDog(model);const house=home.dogHouse,animation=house.animation,body=model.getObjectByName('Box002_default_0');
  const inverse=new T.Matrix4(),point=new T.Vector3(),bounds=new T.Box3();let tailMotion=0,peakJaw=0;
  let tailIndex=-1;const p=body.geometry.attributes.position;for(let i=0;i<p.count;i++)if(p.getZ(i)<-1.28&&p.getY(i)>-.6){tailIndex=i;break;}if(tailIndex<0)throw Error('Tail landmark absent');
  animation.setTime(0);const rest=body.getVertexPosition(tailIndex,new T.Vector3()).clone();
  for(let k=0;k<=220;k++){
   const time=k*.05;animation.setTime(time);const tongue=model.getObjectByName('Shiba tongue'),jaw=body.morphTargetInfluences[2];if(!tongue.visible||tongue.scale.y!==1||tongue.scale.z!==1)throw Error('Tongue disappeared or shrank');if(tongue.position.y<-.185-.085*jaw||tongue.position.y>-.185||tongue.position.z>.29)throw Error('Tongue root detached from mouth');home.group.updateMatrixWorld(true);inverse.copy(house.matrixWorld).invert();
   model.traverse(mesh=>{if(!mesh.isMesh)return;const matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point).applyMatrix4(matrix);if(!Number.isFinite(point.length()))throw Error('Non-finite pose');bounds.expandByPoint(point);}});
   tailMotion=Math.max(tailMotion,body.getVertexPosition(tailIndex,point).distanceTo(rest));peakJaw=Math.max(peakJaw,body.morphTargetInfluences[2]);
  }
  if(bounds.min.x<-.66||bounds.max.x>.66||bounds.min.y<.324||bounds.max.y>2.1||bounds.min.z<-.96||bounds.max.z>2.35)throw Error('Pose intersects cottage: '+JSON.stringify(bounds));
  if(tailMotion<.04||peakJaw<.98)throw Error('Animation inactive');
  animation.setTime(7.35);if(!model.getObjectByName('Shiba tongue').visible||model.getObjectByName('Shiba sculpted tongue').morphTargetInfluences[0]<.99)throw Error('Tongue absent from oral cavity');
  animation.setTime(8);if(model.getObjectByName('Shiba tongue').scale.y<.99||body.morphTargetInfluences[2]>.29)throw Error('Idle not restored');
  animation.setTime(0);const before=body.morphTargetInfluences.slice();house.update(.1,new T.Vector3(1000,0,1000));if(body.morphTargetInfluences.some((v,i)=>v!==before[i]))throw Error('Distant animation still updates');house.update(.1,new T.Vector3(143,1,137));if(body.morphTargetInfluences.every((v,i)=>v===before[i]))throw Error('Nearby animation inactive');
  const tip=model.getObjectByName('Shiba sculpted tongue');
  for(const time of [.4,7.35]){
    animation.setTime(time);const p=tip.geometry.attributes.position,n=tip.geometry.attributes.normal,d=tip.geometry.morphAttributes.normal[0];let outward=0;
    for(let row=2;row<16;row++){const center=new T.Vector3();for(let s=0;s<12;s++)center.add(tip.getVertexPosition(row*13+s,new T.Vector3()));center.multiplyScalar(1/12);for(let s=0;s<12;s++){const i=row*13+s,radial=tip.getVertexPosition(i,new T.Vector3()).sub(center).normalize(),normal=new T.Vector3().fromBufferAttribute(n,i).addScaledVector(new T.Vector3().fromBufferAttribute(d,i),tip.morphTargetInfluences[0]).normalize();outward+=radial.dot(normal);}}
    if(outward/(14*12)<.25||tip.material.transparent||!tip.material.depthWrite)throw Error('Tongue surface faces inward or is transparent');
  }
  let barkEvents=0;for(let i=0;i<440;i++)if(animation.update(.05))barkEvents++;if(barkEvents!==2)throw Error('Bark did not fire once per cycle');
  return {sampledPoses:221,tailMotion,peakJaw,barkEvents,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},distanceCulling:true};
 }));
}finally{await browser.close();}
