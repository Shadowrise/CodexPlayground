import * as T from 'three';
import type {CSM} from 'three/addons/csm/CSM.js';

type Sample={name:string;ms:number;cpuMs:number;calls:number;triangles:number;lines:number;gain?:number;baselineMs?:number;baselineAfterMs?:number;stable?:boolean};
type Toggle={name:string;apply:()=>()=>void};
const median=(values:number[])=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];

/** Opt-in only (?perf=1). No instrumentation or extra rendering in normal play. */
export class SceneProfiler{
 busy=false;
 private panel=document.createElement('section');
 private output=document.createElement('pre');
 private live=document.createElement('div');
 private lastLive=0;
 private report:unknown;
 constructor(private renderer:T.WebGLRenderer,private scene:T.Scene,private camera:T.Camera,private allowed:()=>boolean,private shadows:CSM){
  this.panel.style.cssText='position:fixed;left:8px;top:90px;z-index:100000;max-height:70vh;overflow:auto;background:#111e;color:#fff;padding:12px;border:1px solid #87baff;border-radius:10px;font:12px/1.5 monospace;max-width:min(600px,90vw);pointer-events:auto';
  const heading=document.createElement('strong');heading.textContent='Диагностика FPS';
  const note=document.createElement('div');note.textContent='Одиночная игра: посмотри на проблемное место и запусти замер. Сцена временно замрёт.';
  const run=document.createElement('button');run.textContent='Найти нагрузку';run.onclick=()=>{void this.run().catch(error=>{this.output.textContent=String(error);});};
  const save=document.createElement('button');save.textContent='Скачать отчёт';save.onclick=()=>{if(!this.report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(this.report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='kirby-performance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  this.output.style.cssText='white-space:pre-wrap;margin:8px 0 0';
  this.panel.append(heading,note,this.live,run,save,this.output);document.body.append(this.panel);
  // Available to the local browser benchmark; never installed without the opt-in flag.
  Object.assign(window,{kirbyPerformance:{run:()=>this.run(),scene,camera,renderer}});
 }
 frame(updateMs:number,renderMs:number){
  if(performance.now()-this.lastLive<500)return;this.lastLive=performance.now();
  const info=this.renderer.info.render;
  this.live.textContent=`Обновление: ${updateMs.toFixed(1)} мс · отправка кадра: ${renderMs.toFixed(1)} мс · ${info.calls} вызовов · ${(info.triangles/1e6).toFixed(2)} млн треугольников`;
 }
 private hide(objects:T.Object3D[]){
  const states=objects.map(object=>[object,object.visible] as const);states.forEach(([o])=>o.visible=false);
  return ()=>states.forEach(([o,visible])=>o.visible=visible);
 }
 private cases(){
  const all:T.Object3D[]=[];this.scene.traverse(o=>all.push(o));
  const group=(name:string,objects:T.Object3D[]):Toggle=>({name,apply:()=>this.hide(objects)});
  const noCasting=(name:string,roots:T.Object3D[]):Toggle=>({name,apply:()=>{const objects=new Set<T.Object3D>();for(const root of roots)root.traverse(o=>{if(o.castShadow)objects.add(o);});objects.forEach(o=>o.castShadow=false);return ()=>objects.forEach(o=>o.castShadow=true);}});
  const cases:Toggle[]=[
   {name:'Прежняя дальность теней 300 метров (сравнение)',apply:()=>{
    const distance=this.shadows.maxFar;this.shadows.maxFar=300;this.shadows.updateFrustums();this.shadows.update();
    return ()=>{this.shadows.maxFar=distance;this.shadows.updateFrustums();this.shadows.update();};
   }},
   {name:'Дальняя карта теней 512 вместо 1024 (сравнение)',apply:()=>{
    const lights=all.filter((o):o is T.DirectionalLight=>o instanceof T.DirectionalLight&&o.castShadow);
    const light=lights.at(-1);if(!light)return ()=>{};
    const size=light.shadow.mapSize.clone();light.shadow.mapSize.set(512,512);light.shadow.map?.setSize(512,512);this.shadows.update();
    return ()=>{light.shadow.mapSize.copy(size);light.shadow.map?.setSize(size.x,size.y);this.shadows.update();};
   }},
   {name:'Обычный фильтр без широкого размытия (сравнение)',apply:()=>{
    const type=this.renderer.shadowMap.type,lights=all.filter((o):o is T.DirectionalLight=>o instanceof T.DirectionalLight);
    const radii=lights.map(light=>light.shadow.radius);
    this.renderer.shadowMap.type=T.PCFShadowMap;lights.forEach(light=>light.shadow.radius=1);
    return ()=>{this.renderer.shadowMap.type=type;lights.forEach((light,i)=>light.shadow.radius=radii[i]);};
   }},
   {name:'Прежний ступенчатый фильтр теней (сравнение)',apply:()=>{
    const type=this.renderer.shadowMap.type,lights=all.filter((o):o is T.DirectionalLight=>o instanceof T.DirectionalLight);
    const radii=lights.map(light=>light.shadow.radius);
    this.renderer.shadowMap.type=T.PCFShadowMap;lights.forEach(light=>light.shadow.radius=2);
    return ()=>{this.renderer.shadowMap.type=type;lights.forEach((light,i)=>light.shadow.radius=radii[i]);};
   }},
   {name:'Обновление карт теней',apply:()=>{const was=this.renderer.shadowMap.autoUpdate;this.renderer.shadowMap.autoUpdate=false;return ()=>{this.renderer.shadowMap.autoUpdate=was;};}},
   {name:'Половина разрешения',apply:()=>{const ratio=this.renderer.getPixelRatio();this.renderer.setPixelRatio(ratio*.5);return ()=>this.renderer.setPixelRatio(ratio);}},
   {name:'Старые подробные тени (сравнение)',apply:()=>{
    const restore:(()=>void)[]=[];
    for(const root of this.scene.children){
     if(root.name!=='Four woodland biomes'&&root.name!=='Ponds, flowers, mushrooms, rocks, picnics and ruins')continue;
     for(const group of root.children){
      if(group.name==='Stable trunk shadows'||group.name==='Stable needle shadows'||group.name==='Stable landmark shadows'){
       const visible=group.visible;group.visible=false;restore.push(()=>group.visible=visible);
      }else if(root.name!=='Four woodland biomes'||['Decorative forest wood','Decorative forest bark','Decorative forest needles','Decorative forest fruit'].includes(group.name)){
       group.traverse(object=>{if(object instanceof T.Mesh){const cast=object.castShadow;object.castShadow=true;restore.push(()=>object.castShadow=cast);}});
      }
     }
    }
    return ()=>restore.forEach(fn=>fn());
   }},
   group('Вся Небесная тропа',all.filter(o=>o.name.startsWith('Небесная тропа'))),
   group('Звезда на вершине',all.filter(o=>o.name==='Sky Trail summit reward')),
   {name:'Подробные тени листьев лабиринта (сравнение)',apply:()=>{
    const foliage=all.filter(o=>o.name==='Detailed maze foliage'),shadows=all.filter(o=>o.name==='Stable hedge shadows');
    const states=foliage.map(o=>[o,o.castShadow] as const),restore=this.hide(shadows);
    foliage.forEach(o=>o.castShadow=true);
    return ()=>{restore();states.forEach(([o,cast])=>o.castShadow=cast);};
   }},
   noCasting('Тени лабиринта',all.filter(o=>o.name==='Hedge maze and golden star')),
   group('Кучки листьев',all.filter(o=>o.name==='Layered autumn leaves')),
   group('Лес без земли',all.filter(o=>o.name==='Four woodland biomes').flatMap(o=>o.children.filter(c=>c.name!=='Biome ground'))),
   group('Кроны лиственных деревьев',all.filter(o=>/^Decorative forest (leaves|birchLeaves)/.test(o.name))),
   group('Трава',all.filter(o=>o.name==='Meadow grass')),
   group('Точечные источники света',all.filter(o=>o instanceof T.PointLight)),
   group('Солнечные лучи и ореол',all.filter(o=>o.name==='Soft sun rays'||o.name==='Soft sunlight halo')),
   noCasting('Тени леса',all.filter(o=>o.name==='Four woodland biomes')),
   noCasting('Тени американских горок',all.filter(o=>o.name==='Mountain circuit roller coaster')),
   noCasting('Тени светлячков',all.filter(o=>o.name==='Forty meadow fireflies')),
   group('Все прозрачные объекты',all.filter(o=>{const m=(o as T.Mesh).material;return !!m&&(Array.isArray(m)?m:[m]).every(m=>m.transparent);})),
  ];
  for(const child of this.scene.children){
   if(child instanceof T.Light||child.name==='Four woodland biomes'||child.name==='Meadow grass'||child.name.startsWith('Небесная тропа'))continue;
   let draws=0;child.traverseVisible(o=>{if((o as T.Mesh).isMesh||(o as T.Line).isLine||(o as T.Sprite).isSprite)draws++;});
   if(draws>=10&&!child.name.startsWith('NPC '))cases.push(group(child.name||`Группа ${child.id}`,[child]));
  }
  cases.push(group('Все другие кирби',this.scene.children.filter(o=>o.name.startsWith('NPC '))));
  return cases;
 }
 private shadowInventory(){
  const records=new Map<string,{name:string;calls:number;triangles:number}>(),restore:(()=>void)[]=[];
  this.scene.traverse(object=>{
   if(!(object instanceof T.Mesh)||!object.castShadow)return;
   let root:T.Object3D=object;while(root.parent&&root.parent!==this.scene)root=root.parent;
   const name=root.name||`Группа ${root.id}`,previous=object.onBeforeShadow;
   object.onBeforeShadow=(...args)=>{
    const geometry=args[4],group=args[6] as unknown as {start:number;count:number}|null,length=geometry.index?.count??geometry.getAttribute('position').count;
    const start=Math.max(geometry.drawRange.start,group?.start??0),end=Math.min(length,geometry.drawRange.start+geometry.drawRange.count,group?group.start+group.count:Infinity);
    const record=records.get(name)??{name,calls:0,triangles:0};record.calls++;record.triangles+=Math.max(0,end-start)/3*(object instanceof T.InstancedMesh?object.count:1);records.set(name,record);
    previous.apply(object,args);
   };
   restore.push(()=>object.onBeforeShadow=previous);
  });
  try{this.renderer.info.reset();this.renderer.render(this.scene,this.camera);}finally{restore.forEach(fn=>fn());}
  return [...records.values()].sort((a,b)=>b.triangles-a.triangles);
 }
 private async sample(name:string):Promise<Sample>{
  const times:number[]=[],cpuTimes:number[]=[],gl=this.renderer.getContext();
  for(let i=0;i<17;i++){
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   if(document.hidden)throw Error('Вкладка скрыта: повтори замер в активной вкладке.');
   this.renderer.info.reset();
   const start=performance.now();this.renderer.render(this.scene,this.camera);const cpuTime=performance.now()-start;gl.finish();
   if(i>=5){times.push(performance.now()-start);cpuTimes.push(cpuTime);}
  }
  return {name,ms:median(times),cpuMs:median(cpuTimes),...this.renderer.info.render};
 }
 async run(){
  if(this.busy)throw Error('Замер уже идёт.');
  if(!this.allowed())throw Error('Запусти одиночную игру для замера.');
  this.busy=true;
  const autoReset=this.renderer.info.autoReset;this.renderer.info.autoReset=false;
  try{
   this.shadows.update();
   const before=await this.sample('Исходная сцена'),rows:Sample[]=[];
   for(const item of this.cases()){
    this.output.textContent=`Проверяем: ${item.name}…`;
    const baseline=await this.sample('Контроль');
    const restore=item.apply();let row:Sample;
    try{row=await this.sample(item.name);}finally{restore();}
    const control=await this.sample('Повторный контроль'),reference=(baseline.ms+control.ms)/2;
    row.baselineMs=baseline.ms;row.baselineAfterMs=control.ms;
    row.stable=Math.abs(control.ms-baseline.ms)/reference<=.15;
    row.gain=(reference-row.ms)/reference*100;rows.push(row);
   }
   const after=await this.sample('Контроль исходной сцены');
   rows.sort((a,b)=>Number(b.stable)-Number(a.stable)||b.gain!-a.gain!);
   const shadowCasters=this.shadowInventory();
   const unstable=Math.abs(after.ms-before.ms)/((after.ms+before.ms)/2)>.15;
   this.report={date:new Date().toISOString(),userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],pixelRatio:this.renderer.getPixelRatio(),camera:{position:this.camera.position.toArray(),quaternion:this.camera.quaternion.toArray()},method:'Median of 12 render + gl.finish samples, fixed scene/camera; 5 warmup frames. Baselines before AND after every case; stable=false when they differ by over 15%. Counts include shadow passes. Effects overlap: gains are not additive; small differences may be measurement noise.',unstable,before,after,rows,shadowCasters};
   this.output.textContent=`Исходная сцена: ${before.ms.toFixed(1)} → ${after.ms.toFixed(1)} мс\n${unstable?'Замер нестабилен: время исходной сцены изменилось более чем на 15%.\n':''}Вариант / время / снижение времени:\n`+rows.map(r=>`${r.name}: ${r.ms.toFixed(1)} мс (${r.stable?r.gain!.toFixed(0)+'%':'нестабильный замер'}), ${r.calls} выз.`).join('\n')+'\nЭто время отрисовки с ожиданием GPU, не общий FPS. Результаты не суммируются; малые отличия могут быть шумом замера.';
   return this.report;
  }finally{this.renderer.info.autoReset=autoReset;this.busy=false;}
 }
}
