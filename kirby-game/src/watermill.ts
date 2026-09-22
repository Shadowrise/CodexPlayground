import * as T from 'three';

// The eastern bank of the existing central pond; inside its tree-free clearing.
export const MILL_SITE = new T.Vector3(32, 0, 34);
export const MILL_LEVER = MILL_SITE.clone().add(new T.Vector3(17, 0, 6.5));

/** Water follows the outside of the rotating scoops, never a sheet through the axle. */
export function createWheelWaterGeometry() {
  const radius=3.43,entry=-Math.asin(1.65/radius),exit=-Math.PI+.12;
  const points=[new T.Vector3(0,7.05,-2.65)];
  for(let i=0;i<=64;i++) {
    const angle=T.MathUtils.lerp(entry,exit,i/64);
    points.push(new T.Vector3(0,3.65+radius*Math.cos(angle),-1+radius*Math.sin(angle)));
  }
  points.push(new T.Vector3(0,.11,points[points.length-1].z));
  const lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+points[i].distanceTo(points[i-1]));
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  points.forEach((p,i)=>{
    for(const side of [-1,1]){positions.push(side*.8,p.y,p.z);uvs.push((side+1)/2,1-lengths[i]/lengths[lengths.length-1]);}
    if(i<points.length-1){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  });
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

export class Watermill {
  readonly group = new T.Group();
  readonly wheel = new T.Group();
  readonly gate = new T.Group();
  readonly handle = new T.Group();
  running = false;
  get flow() {return this.openness;}
  private openness = 0;
  private speed = 0;
  private elapsed = 0;
  private readonly water: T.ShaderMaterial;
  private readonly waterfall: T.Mesh;
  private readonly splashes: T.InstancedMesh;
  private readonly dummy = new T.Object3D();

  constructor() {
    const root = this.group;root.name='Interactive watermill';root.position.copy(MILL_SITE);
    const geometries={box:new T.BoxGeometry(1,1,1),ball:new T.SphereGeometry(1,12,8),
      cylinder:new T.CylinderGeometry(1,1,1,12),ring:new T.TorusGeometry(1,.045,8,64)};
    const materials=new Map<string,T.MeshStandardMaterial>();
    const material=(color:string)=>{
      if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:color==='#35474b'?.38:.86,metalness:color==='#35474b'?.55:0}));
      return materials.get(color)!;
    };
    const part=(parent:T.Group,kind:keyof typeof geometries,color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0)=>{
      const mesh=new T.Mesh(geometries[kind],material(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.set(rx,ry,rz);parent.add(mesh);return mesh;
    };
    const box=(color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,rz=0)=>part(root,'box',color,x,y,z,sx,sy,sz,0,0,rz);
    const beam=(parent:T.Group,color:string,a:T.Vector3,b:T.Vector3,width:number)=>{
      const m=part(parent,'box',color,0,0,0,width,a.distanceTo(b),width);
      m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());
    };
    // Individually staggered foundation stones and limewashed timber walls.
    box('#777b6c',17,.6,-1,9,1.2,8);
    for(let row=0;row<3;row++)for(let i=0;i<12;i++)for(const z of [-5.06,3.06])
      box(['#a9a58d','#969782','#b6b096'][(i+row)%3],12.85+i*.75+(row%2)*.12,.22+row*.36,z,.69,.31,.19);
    box('#eee1bb',17,4.7,-1,8.7,7,7.8);
    for(const x of [12.5,17,21.5])for(const z of [-5,3])box('#624631',x,4.8,z,.3,7.6,.32);
    for(const y of [1.35,4.8,8.25])for(const z of [-5,3])box('#765039',17,y,z,9.3,.3,.35);
    for(const x of [12.5,21.5])for(const y of [1.35,4.8,8.25])box('#765039',x,y,-1,.32,.3,8.2);
    for(const z of [-5.03,3.03])for(const side of [-1,1])
      beam(root,'#86603e',new T.Vector3(17+side*.3,5,z),new T.Vector3(17+side*4.25,8.1,z),.21);
    const gableShape=new T.Shape();gableShape.moveTo(-4.5,0);gableShape.lineTo(4.5,0);gableShape.lineTo(0,3.6);gableShape.closePath();
    const gableGeometry=new T.ExtrudeGeometry(gableShape,{depth:.24,bevelEnabled:false});
    for(const z of [-5.05,2.85]) {
      const gable=new T.Mesh(gableGeometry,material('#eedaba'));gable.position.set(17,8.35,z);root.add(gable);
      for(const side of [-1,1])beam(root,'#624631',new T.Vector3(17,11.85,z+.25),new T.Vector3(17+side*4.6,8.25,z+.25),.25);
      box('#624631',17,9.85,z+.25,.25,3.5,.25);
    }
    // Overlapping warm terracotta tiles, ridge caps and dark fascia boards.
    const pitch=Math.atan(.65);
    for(const side of [-1,1]) {
      box('#5a3d2d',17+side*2.75,10.21,-1,6.6,.22,10.2,-side*pitch);
      for(let row=0;row<8;row++)for(let column=0;column<15;column++) {
        const x=side*(.35+row*.68);
        box(['#ad563b','#bc6847','#c77a50','#a6533d'][(row*7+column*3)%4],17+x,12.04-Math.abs(x)*.65,-5.85+column*.69+(row%2)*.12,.87,.16,.76,-side*pitch);
      }
    }
    for(let i=0;i<16;i++)part(root,'cylinder','#cc8659',17,12.05,-6+i*.67,.22,.71,.22,Math.PI/2);
    // Windows: deep frames, blue glazing, crossbars, shutters and flower boxes.
    for(const x of [14.5,19.5])for(const y of [3.1,6.55]) {
      box('#513d2e',x,y,3.13,1.8,1.85,.23);box('#76acb2',x,y,3.27,1.48,1.51,.06);
      box('#e3c58a',x,y,3.33,.1,1.58,.09);box('#e3c58a',x,y,3.33,1.58,.1,.09);
      for(const side of [-1,1]) {
        for(let j=0;j<3;j++)box('#548b78',x+side*1.13+j*.13,y,3.15,.12,1.65,.17);
        for(const offset of [-.56,.56])box('#315e50',x+side*1.26,y+offset,3.27,.53,.1,.12);
      }
      box('#89603d',x,y-1.1,3.48,1.95,.39,.63);
      for(let i=0;i<7;i++) {
        part(root,'ball','#497546',x-.78+i*.25,y-.88,3.48,.23,.2,.24);
        part(root,'ball',i%2?'#edaa89':'#f5d88b',x-.78+i*.25,y-.68,3.52,.12,.1,.12);
      }
    }
    box('#44332b',17,2.5,3.15,1.65,2.8,.26);
    for(let i=0;i<7;i++)box('#987345',16.32+i*.225,2.5,3.32,.2,2.66,.12);
    for(const y of [1.6,3.25])box('#35474b',17,y,3.41,1.5,.1,.07);
    part(root,'ring','#c5a568',17.48,2.42,3.44,.13,.13,.13);
    // Steps, planked approach and pegs are below the doorway.
    for(let i=0;i<3;i++)box('#a5a18b',17,.18+i*.26,4.6-i*.43,2.8,.35,.65);
    for(let i=0;i<22;i++) {
      box(i%3?'#b19360':'#9c7a4e',17,.09,5.2+i*.57,3.1,.16,.51);
      for(const x of [15.7,18.3])part(root,'cylinder','#66503a',x,.185,5.2+i*.57,.026,.025,.026);
    }
    // Overshot waterwheel: twin oak rims, iron tires, radial spokes and scoops.
    this.wheel.position.set(10.8,3.65,-1);root.add(this.wheel);
    for(const x of [-.8,.8]) {
      for(const radius of [2.85,3.12])part(this.wheel,'ring','#735032',x,0,0,radius,radius,radius,0,Math.PI/2);
      part(this.wheel,'ring','#35474b',x,0,0,3.21,3.21,3.21,0,Math.PI/2);
      part(this.wheel,'cylinder','#624731',x,0,0,.48,.26,.48,0,0,Math.PI/2);
      for(let i=0;i<12;i++) {
        const a=i*Math.PI/6;
        beam(this.wheel,'#a37b47',new T.Vector3(x,0,0),new T.Vector3(x,Math.cos(a)*2.94,Math.sin(a)*2.94),.17);
        part(this.wheel,'ball','#35474b',x*1.12,Math.cos(a)*2.91,Math.sin(a)*2.91,.075,.075,.075);
      }
    }
    for(let i=0;i<28;i++) {
      const a=i*Math.PI*2/28;
      part(this.wheel,'box',i%3?'#aa8150':'#967047',0,Math.cos(a)*3.06,Math.sin(a)*3.06,1.85,.15,.62,a);
      part(this.wheel,'box','#795631',0,Math.cos(a)*3.22,Math.sin(a)*3.22,1.82,.28,.09,a);
    }
    part(root,'cylinder','#35474b',11.15,3.65,-1,.22,4.1,.22,0,0,Math.PI/2);
    for(const z of [-2.5,.5])box('#8e917f',9.6,1,z,.5,2,.55);
    beam(root,'#76533b',new T.Vector3(9.6,2,-2.5),new T.Vector3(9.6,3.65,-1),.3);
    beam(root,'#76533b',new T.Vector3(9.6,3.65,-1),new T.Vector3(9.6,2,.5),.3);
    // Raised millrace with a visible sluice, braces, and overflow into the pond.
    box('#8b6a45',10.8,6.9,-8.8,2.2,.2,8.6);
    box('#8b6a45',10.8,6.9,-3.65,2.2,.2,2);
    for(const x of [9.68,11.92])box('#aa8553',x,7.14,-3.65,.2,.5,2);
    for(const x of [9.68,11.92])box('#aa8553',x,7.24,-8.8,.2,.75,8.6);
    for(const z of [-12.5,-9,-5.2])for(const x of [9.75,11.85]) {
      box('#735239',x,3.4,z,.3,6.8,.3);
      beam(root,'#86613c',new T.Vector3(x,4.7,z),new T.Vector3(x,6.8,z+1),.18);
    }
    this.gate.position.set(10.8,7.35,-5.4);root.add(this.gate);
    for(let i=0;i<5;i++)part(this.gate,'box','#77563a',0,-.32+i*.17,0,1.96,.15,.18);
    part(this.gate,'box','#35474b',0,.5,0,.1,1.1,.1);
    for(const x of [9.6,12])box('#543f30',x,7.65,-5.4,.21,2,.23);
    box('#543f30',10.8,8.6,-5.4,2.6,.22,.24);
    // Supply pipe disappearing into a stone spring on the bank.
    box('#898e7d',10.8,3.2,-14.2,3.2,6.4,2.2);
    for(let i=0;i<5;i++)box('#acaf97',10.8,6.4+i*.14,-14.2,3.4-i*.35,.18,2.4-i*.2);
    part(root,'cylinder','#65796a',10.8,7,-13.3,.47,1.3,.47,Math.PI/2);
    // Lever on a dry, accessible pedestal beside the front path.
    box('#8d9382',17,.55,6.5,1.1,1.1,1.1);
    this.handle.position.set(17,1.25,6.5);root.add(this.handle);
    part(this.handle,'cylinder','#35474b',0,.45,0,.065,.9,.065);
    part(this.handle,'ball','#bd5738',0,.95,0,.2,.2,.2);
    for(let i=0;i<3;i++) {
      part(root,'cylinder','#967048',20.8+i*.75,.55,4.1,.37,1.05,.37);
      for(const y of [.2,.85])part(root,'ring','#35474b',20.8+i*.75,y,4.1,.38,.38,.38,Math.PI/2);
    }
    for(let i=0;i<5;i++)part(root,'ball','#c8b789',20.8+(i%2)*.6,.55+Math.floor(i/2)*.62,5.7,.42,.6,.36);
    box('#817a68',20,10.75,-3,1.1,3.3,1.1);box('#b2a589',20,12.42,-3,1.35,.24,1.35);
    // A small painted sign remains legible without external assets.
    if(typeof document!=='undefined') {
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;
      const ctx=canvas.getContext('2d');
      if(ctx) {
        ctx.fillStyle='#254f49';ctx.fillRect(0,0,768,192);ctx.strokeStyle='#d6bd7b';ctx.lineWidth=10;ctx.strokeRect(10,10,748,172);
        ctx.textAlign='center';ctx.fillStyle='#fff0c2';ctx.font='bold 56px sans-serif';ctx.fillText('ВОДЯНАЯ МЕЛЬНИЦА',384,84);
        ctx.font='30px sans-serif';ctx.fillText('Открой шлюз — оживи колесо',384,143);
        const sign=new T.Mesh(new T.PlaneGeometry(7.2,1.8),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas)}));
        sign.position.set(17,8.35,4.2);root.add(sign);
        for(const x of [14.2,19.8])box('#35474b',x,9,4.1,.065,1.4,.065);
      }
    }
    // Batch the hundreds of decorative pieces, including the moving wheel.
    const batch=(parent:T.Group)=>{
      const groups=new Map<string,T.Mesh[]>();
      for(const child of [...parent.children])if(child instanceof T.Mesh && child.material instanceof T.MeshStandardMaterial) {
        child.updateMatrix();const key=child.geometry.uuid+child.material.uuid;
        if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(child);
      }
      for(const parts of groups.values()) {
        const mesh=new T.InstancedMesh(parts[0].geometry,parts[0].material,parts.length);
        parts.forEach((p,i)=>{mesh.setMatrixAt(i,p.matrix);parent.remove(p);});
        mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);
      }
    };
    batch(root);batch(this.wheel);batch(this.gate);batch(this.handle);
    this.water=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
      uniforms:{time:{value:0},flow:{value:0}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec2 vUv; uniform float time; uniform float flow; void main(){float ripple=sin(vUv.y*85.0+time*flow*11.0+sin(vUv.x*19.0)*1.5);float foam=pow(max(0.0,ripple),14.0)*.35;float edge=smoothstep(0.0,.09,vUv.x)*smoothstep(0.0,.09,1.0-vUv.x);gl_FragColor=vec4(vec3(.14,.61,.65)+foam,(.62+foam)*edge);}'
    });
    const race=new T.Mesh(new T.PlaneGeometry(1.9,8.3),this.water);race.rotation.x=-Math.PI/2;race.position.set(10.8,7.05,-8.9);root.add(race);
    const lip=new T.Mesh(new T.PlaneGeometry(1.9,2.2),this.water);lip.rotation.x=-Math.PI/2;lip.position.set(10.8,7.05,-3.75);root.add(lip);
    this.waterfall=new T.Mesh(createWheelWaterGeometry(),this.water);this.waterfall.name='Water over wheel scoops';this.waterfall.position.x=10.8;root.add(this.waterfall);this.waterfall.visible=false;
    this.splashes=new T.InstancedMesh(new T.SphereGeometry(1,6,4),new T.MeshBasicMaterial({color:'#d4ffff',transparent:true,opacity:.65,depthWrite:false}),36);
    this.splashes.frustumCulled=false;this.splashes.visible=false;root.add(this.splashes);
  }
  prompt(position:T.Vector3) {
    return position.distanceTo(MILL_LEVER)<4 ? (this.running?'E — закрыть шлюз мельницы':'E — открыть шлюз мельницы') : '';
  }
  interact(position:T.Vector3) {
    if(!this.prompt(position))return false;
    this.running=!this.running;return true;
  }
  update(dt:number) {
    this.elapsed+=dt;
    this.openness=T.MathUtils.damp(this.openness,this.running?1:0,2.6,dt);
    this.speed=T.MathUtils.damp(this.speed,this.openness*.65,1.4,dt);
    this.wheel.rotation.x-=this.speed*dt;
    this.gate.position.y=7.35+this.openness*.8;this.handle.rotation.x=-.55+this.openness*1.1;
    this.water.uniforms.time.value=this.elapsed;this.water.uniforms.flow.value=this.openness;
    this.waterfall.visible=this.splashes.visible=this.openness>.015;
    this.waterfall.scale.x=this.openness;
    for(let i=0;i<36;i++) {
      const t=(this.elapsed*(.5+(i%4)*.08)+i*.137)%1;
      this.dummy.position.set(10.8+Math.sin(i*9)*(.3+t*.9),.14+Math.sin(t*Math.PI)*.8,-1-3.43*Math.sin(.12)+Math.cos(i*7)*t*1.2);
      this.dummy.scale.setScalar((1-t)*.1*this.openness);this.dummy.updateMatrix();this.splashes.setMatrixAt(i,this.dummy.matrix);
    }
    this.splashes.instanceMatrix.needsUpdate=true;
  }
  constrain(position:T.Vector3,size:number) {
    const x=position.x-MILL_SITE.x,z=position.z-MILL_SITE.z,padding=.65*size;
    const minX=12.4-padding,maxX=21.6+padding,minZ=-5.1-padding,maxZ=3.2+padding;
    if(x>minX && x<maxX && z>minZ && z<maxZ) {
      const distances=[x-minX,maxX-x,z-minZ,maxZ-z],side=distances.indexOf(Math.min(...distances));
      if(side<2)position.x=MILL_SITE.x+(side===0?minX:maxX);
      else position.z=MILL_SITE.z+(side===2?minZ:maxZ);
    }
  }
}
