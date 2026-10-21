import * as THREE from 'three';
import type {Daylight} from './day-cycle';

/** A distant panorama, painted back to front without lighting or shadow maps. */
export function createForestBackdrop(scene:THREE.Scene){
 const positions:number[]=[],depths:number[]=[];
 let seed=731;
 const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 const point=(angle:number,radius:number,offset:number,y:number,depth:number)=>{
  positions.push(Math.sin(angle)*radius+Math.cos(angle)*offset,y,Math.cos(angle)*radius-Math.sin(angle)*offset);
  depths.push(depth);
 };
 const triangle=(a:number,r:number,depth:number,p:number[][])=>{for(const [x,y] of p)point(a,r,x,y,depth);};
 for(let layer=0;layer<9;layer++){
  const radius=820-layer*10,depth=.88*Math.exp(-layer*.64),phase=layer*1.7;
  const hill=(a:number)=>85-layer*25-Math.max(0,layer-2)*15+23*Math.sin(a*3+phase)+13*Math.sin(a*7-phase)+7*Math.cos(a*13+phase);
  // Integer frequencies close the hills and treeline cleanly at the panorama seam.
  const segments=640;
  for(let i=0;i<segments;i++){
   const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,topA=hill(a),topB=hill(b);
   point(a,radius,0,-600,depth-.12);point(b,radius,0,topB,depth);point(a,radius,0,topA,depth);
   point(a,radius,0,-600,depth-.12);point(b,radius,0,-600,depth-.12);point(b,radius,0,topB,depth);
  }
  const trees=Math.max(360,940-layer*90);
  for(let i=0;i<trees;i++){
   const a=(i+random()*.8)/trees*Math.PI*2,y=hill(a)-3,h=23+random()*29+Math.min(layer,3)*5,w=h*(.15+random()*.08),shade=depth+(random()-.5)*.09;
   if(random()<.64){
    // Overlapping boughs leave a readable fir silhouette, even at the horizon.
    for(let tier=0;tier<4;tier++){
     const bottom=y+h*(.08+tier*.17),tip=y+h*(.60+tier*.13),width=w*(1-tier*.2);
     triangle(a,radius,shade,[[0,tip],[-width,bottom],[0,bottom]]);
     triangle(a,radius,shade-.035,[[0,tip],[0,bottom],[width,bottom]]);
    }
   }else{
    // Round crowns break up the conifers and echo the meadow's mixed woodland.
    triangle(a,radius,shade-.02,[[-w*.12,y],[w*.12,y],[0,y+h*.76]]);
    for(let crown=0;crown<3;crown++){
     const x=(crown-1)*w*.55,cy=y+h*(crown===1?.72:.59),rx=w*.82,ry=h*(crown===1?.29:.24);
     for(let j=0;j<9;j++){
      const b=j/9*Math.PI*2,c=(j+1)/9*Math.PI*2;
      triangle(a,radius,shade+(j<4?.025:-.025),[[x,cy],[x+Math.cos(b)*rx,cy+Math.sin(b)*ry],[x+Math.cos(c)*rx,cy+Math.sin(c)*ry]]);
     }
    }
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('forestDepth',new THREE.Float32BufferAttribute(depths,1));
 const nearDay=new THREE.Color('#326954'),farDay=new THREE.Color('#9bb7ac');
 const nearNight=new THREE.Color('#071724'),farNight=new THREE.Color('#1c344b');
 const nearDusk=new THREE.Color('#40534c'),farDusk=new THREE.Color('#ac9a99');
 // Use the transparent queue for painter order, while keeping every pixel opaque.
 // A single pass preserves triangle order even for overlapping double-sided crowns.
 const material=new THREE.ShaderMaterial({
  side:THREE.DoubleSide,fog:false,transparent:true,depthWrite:false,blending:THREE.NoBlending,forceSinglePass:true,
  uniforms:{nearColor:{value:nearDay.clone()},farColor:{value:farDay.clone()}},
  vertexShader:'attribute float forestDepth;varying float vDepth;void main(){vDepth=forestDepth;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform vec3 nearColor;uniform vec3 farColor;varying float vDepth;
   void main(){gl_FragColor=vec4(mix(nearColor,farColor,clamp(vDepth,0.,1.))*(1.+min(vDepth,0.)*.6),1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`,
 });
 const forest=new THREE.Mesh(geometry,material);forest.name='Distant forest panorama';forest.frustumCulled=false;scene.add(forest);
 // Crowns overlap in the same plane. A fixed painter order avoids depth fights;
 // foreground depth still hides the panorama, and sky bodies render behind it.
 forest.renderOrder=-10;forest.castShadow=forest.receiveShadow=false;
 return (camera:THREE.Camera,time:Daylight)=>{
  // Keep the horizon below an elevated camera instead of lifting the forest with it.
  forest.position.set(camera.position.x,0,camera.position.z);
  material.uniforms.nearColor.value.copy(nearDay).lerp(nearNight,time.night).lerp(nearDusk,time.twilight*.65);
  material.uniforms.farColor.value.copy(farDay).lerp(farNight,time.night).lerp(farDusk,time.twilight*.75);
 };
}
