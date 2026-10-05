import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/shadow-preview',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto('http://127.0.0.1:5174/shadow-preview');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{StableCSM}=await import('/src/stable-shadows.ts'),{daylight}=await import('/src/day-cycle.ts');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(48,4/3,.75,1200);
  camera.position.set(23,25,31);camera.lookAt(0,0,0);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(640,480);renderer.info.autoReset=false;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
  const csm=new StableCSM({camera,parent:scene,cascades:2,maxFar:200,mode:'practical',shadowMapSize:1024,lightNear:1,lightFar:1400,lightMargin:250,shadowBias:-.00003,lightIntensity:2});csm.fade=true;csm.updateFrustums();
  csm.lights.forEach(l=>l.shadow.normalBias=.12);scene.add(new T.AmbientLight(0xffffff,.4));
  const ground=new T.Mesh(new T.PlaneGeometry(150,150),new T.MeshLambertMaterial({color:0xffffff}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const mat=new T.MeshLambertMaterial({color:0x448833});
  for(let i=0;i<9;i++){const m=new T.Mesh(new T.SphereGeometry(i<3?2.7:.1+(i-3)*.07,12,8),mat);m.position.set((i%3-1)*8,4,Math.floor(i/3)*7-5);m.castShadow=true;scene.add(m);}
  csm.setupMaterial(ground.material);csm.setupMaterial(mat);
  const gl=renderer.getContext(),data=new Uint8Array(640*480*4);
  const render=(phase)=>{renderer.info.reset();csm.lightDirection.fromArray(daylight(phase).shadowDirection);csm.update();renderer.render(scene,camera);};
  const rows=[];
  for(const enabled of [false,true]){
   csm.filterEnabled.value=enabled;render(.18);
   let prev,prev2,delta=0,curvature=0,peak=0;let calls=0;
   for(let f=0;f<90;f++){
    render(.18+f/(600*60));gl.readPixels(0,0,640,480,gl.RGBA,gl.UNSIGNED_BYTE,data);
    const current=new Uint8Array(640*480);
    for(let i=0;i<current.length;i++){
     current[i]=data[i*4];
     if(prev){const d=Math.abs(current[i]-prev[i]);delta+=d;peak=Math.max(peak,d);}
     if(prev2)curvature+=Math.abs(current[i]-2*prev[i]+prev2[i]);
    }
    prev2=prev;prev=current;calls=renderer.info.render.calls;
   }
   rows.push({enabled,delta,curvature,peak,calls});
  }
  return rows;
 });
 await page.screenshot({path:process.env.TEMP+'/kirby-shadow-filter.png'});
 console.log(JSON.stringify({result,errors},null,2));await writeFile(process.env.TEMP+'/kirby-shadow-filter.json',JSON.stringify({result,errors},null,2));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
