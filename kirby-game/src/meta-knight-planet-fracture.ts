import * as T from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
import {COSMIC_REFUGE as R} from './meta-knight-cosmic-refuge';
import {planetHash as hash,planetRelief} from './meta-knight-planet-detail';

/** Spherical Voronoi crust: unequal cells, shared jagged seams and rough stratified cut faces. */
export function planetFractureGeometry(world=0){
 const radius=R.planetRadius,seeds:T.Vector3[]=[],up=new T.Vector3(0,1,0);
 for(let i=0;i<112;i++){const y=T.MathUtils.clamp(1-2*(i+.5)/112+(hash(i+world*13)-.5)*.045,-.995,.995),a=i*2.399963+(hash(i+71)-.5)*.65,r=Math.sqrt(1-y*y);seeds.push(new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r));}
 for(let i=0;i<28;i++){const p=seeds[(i*13)%112],t=new T.Vector3().crossVectors(p,Math.abs(p.y)>.9?new T.Vector3(1,0,0):up).normalize();seeds.push(p.clone().addScaledVector(t,.055+.06*hash(i+17)).add(new T.Vector3(.015*hash(i),-.02,.02*hash(i+7))).normalize());}
 const hull=new ConvexHull().setFromPoints(seeds),index=new Map(seeds.map((p,i)=>[p,i])),nodes:T.Vector3[]=[],cells=seeds.map(()=>[] as number[]),edges=new Map<string,T.Vector3[]>();
 hull.faces.forEach((face,i)=>{nodes.push(face.normal.clone().normalize());let edge=face.edge;do{cells[index.get(edge.head().point)!].push(i);edge=edge.next;}while(edge!==face.edge);});
 const boundary=(a:number,b:number)=>{const lo=Math.min(a,b),hi=Math.max(a,b),key=lo+':'+hi;let points=edges.get(key);if(!points){const x=nodes[lo],y=nodes[hi],side=new T.Vector3().crossVectors(x,y).normalize(),seed=lo*7+hi*31;points=Array.from({length:7},(_,i)=>{const t=i/6,w=Math.sin(t*Math.PI)*(hash(seed+i*11)-.5)*Math.min(.055,x.distanceTo(y)*.30);return x.clone().lerp(y,t).addScaledVector(side,w).normalize();});edges.set(key,points);}return a===lo?points:points.slice().reverse();};
 const positions:number[]=[],centers:number[]=[],interiors:number[]=[],pieceSeeds:number[]=[];
 const triangle=(a:T.Vector3,b:T.Vector3,c:T.Vector3,center:T.Vector3,interior:number,seed:number)=>{const normal=new T.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)),middle=a.clone().add(b).add(c).multiplyScalar(1/3).sub(center),corners=normal.dot(middle)<0?[a,c,b]:[a,b,c];for(const p of corners){positions.push(p.x,p.y,p.z);centers.push(center.x,center.y,center.z);interiors.push(interior);pieceSeeds.push(seed);}};
 const outer=(direction:T.Vector3)=>direction.clone().normalize().multiplyScalar(radius*(1+planetRelief(direction,world)));
 cells.forEach((cell,id)=>{
  const d=seeds[id],u=new T.Vector3().crossVectors(d,Math.abs(d.y)>.9?new T.Vector3(1,0,0):up).normalize(),v=new T.Vector3().crossVectors(d,u),seed=id*.731+world*13,depth=.24+.22*hash(id+47),center=d.clone().multiplyScalar(radius*(.82-depth*.35));
  cell.sort((a,b)=>Math.atan2(nodes[a].dot(v),nodes[a].dot(u))-Math.atan2(nodes[b].dot(v),nodes[b].dot(u)));
  const directions:T.Vector3[]=[];for(let i=0;i<cell.length;i++)directions.push(...boundary(cell[i],cell[(i+1)%cell.length]).slice(0,-1));
  const count=directions.length,top=outer(d),rings=[.32,.66,1].map(f=>directions.map(p=>outer(d.clone().lerp(p,f).normalize())));
  for(let i=0;i<count;i++){const j=(i+1)%count;triangle(top,rings[0][i],rings[0][j],center,0,seed);for(let k=1;k<3;k++){triangle(rings[k-1][i],rings[k][i],rings[k][j],center,0,seed);triangle(rings[k-1][i],rings[k][j],rings[k-1][j],center,0,seed);}}
  let previous=rings[2];
  for(let k=1;k<=5;k++){
   const t=k/5,ring=directions.map((p,i)=>{const strata=Math.sin(t*13+seed+hash(i+id)*2)*.0075+(hash(id*47+i*13+k*71)-.5)*.012,cut=radius*(1-depth*t+strata*t),side=u.clone().multiplyScalar((hash(id*71+i+3)-.5)*.65).addScaledVector(v,(hash(id*41+i+7)-.5)*.65);return p.clone().multiplyScalar(cut).addScaledVector(side,Math.sin(t*Math.PI));});
   for(let i=0;i<count;i++){const j=(i+1)%count;triangle(previous[i],ring[i],ring[j],center,1,seed);triangle(previous[i],ring[j],previous[j],center,1,seed);}previous=ring;
  }
  const bottom=d.clone().multiplyScalar(radius*(1-depth-.014));for(let i=0;i<count;i++)triangle(bottom,previous[(i+1)%count],previous[i],center,1,seed);
 });
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('pieceCenter',new T.Float32BufferAttribute(centers,3));geometry.setAttribute('pieceInterior',new T.Float32BufferAttribute(interiors,1));geometry.setAttribute('pieceSeed',new T.Float32BufferAttribute(pieceSeeds,1));geometry.computeVertexNormals();
 const normal=geometry.getAttribute('normal'),p=geometry.getAttribute('position'),d=new T.Vector3();for(let i=0;i<p.count;i++)if(interiors[i]===0){d.fromBufferAttribute(p,i).normalize();normal.setXYZ(i,d.x,d.y,d.z);}geometry.userData.fragments=seeds.length;return geometry;
}
export function planetFractureMaterial(source:T.ShaderMaterial){
 const material=source.clone();material.transparent=true;material.depthWrite=true;material.uniforms.blastAge={value:0};material.uniforms.blastAway={value:new T.Vector3()};if(material.uniforms.surfaceDetail)material.uniforms.surfaceDetail.value=1;
 material.vertexShader=`attribute vec3 pieceCenter;attribute float pieceInterior;attribute float pieceSeed;uniform float blastAge;uniform vec3 blastAway;varying float interior;
 vec3 spinPiece(vec3 p,vec3 axis,float angle){return p*cos(angle)+cross(axis,p)*sin(angle)+axis*dot(axis,p)*(1.-cos(angle));}
 `+material.vertexShader.replace('p=position;',`p=position;interior=pieceInterior;vec3 axis=normalize(vec3(sin(pieceSeed),cos(pieceSeed*2.1),sin(pieceSeed*3.7)));float angle=blastAge*sin(pieceSeed*1.7)*1.8;`)
 .replace('normalMatrix*normal','normalMatrix*spinPiece(normal,axis,angle)')
 .replace('modelViewMatrix*vec4(position,1.)',`modelViewMatrix*vec4(pieceCenter+spinPiece(position-pieceCenter,axis,angle)+normalize(pieceCenter)*blastAge*(12.+4.*sin(pieceSeed))+blastAway*blastAge*44.-vec3(0.,blastAge*blastAge*2.,0.),1.)`);
 material.fragmentShader='uniform float blastAge;varying float interior;\n'+material.fragmentShader.replace('color+=emission;',`color+=emission;
 float rockNoise=fbm(p*2.7+vec3(seed)),mineral=noise(p*22.+vec3(seed)),strata=.5+.5*sin(length(p)*27.+fbm(p*1.4)*11.);float seam=1.-smoothstep(.012,.045,abs(noise(p*7.3)-.52));
 vec3 rock=mix(vec3(.055,.050,.045),vec3(.30,.24,.17),rockNoise);rock=mix(rock,vec3(.40,.34,.25),strata*.23);rock*=.65+.55*mineral;rock+=vec3(.18,.16,.12)*pow(mineral,8.);rock*=.17+.83*smoothstep(-.17,.75,sun);rock+=vec3(.75,.16,.025)*seam*exp(-blastAge*3.)*.32;
 color=mix(color,rock,interior);`)
 .replace('gl_FragColor=vec4(color,1.);','gl_FragColor=vec4(color,1.-smoothstep(1.1,2.2,blastAge));');
 return material;
}
