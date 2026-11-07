import {BufferGeometry,Float32BufferAttribute,MathUtils} from 'three';

/** Continuous airfoil volume is part of the original closed wing surface.
 * Dorsal feathers and UVs stay fixed; the underside tapers from arm to tip. */
export function addPigeonWingVolume(geometry:BufferGeometry,side:number){
  const rows=20,columns=129,p=geometry.getAttribute('position');
  if(p.count!==(rows+1)*columns)throw Error('Unexpected pigeon wing shell topology');
  const outline=Array.from({length:columns},(_,i)=>({y:p.getY(10*columns+i),z:p.getZ(10*columns+i)}));
  function chordEnvelope(y:number,z:number){
    const hits:number[]=[];
    for(let i=0;i<columns-1;i++){
      const a=outline[i],b=outline[i+1];
      if((a.z<=z&&b.z>z)||(b.z<=z&&a.z>z))hits.push(a.y+(b.y-a.y)*(z-a.z)/(b.z-a.z));
    }
    if(hits.length<2)return 0;
    const low=Math.min(...hits),high=Math.max(...hits),u=MathUtils.clamp((y-low)/(high-low||1),0,1);
    return Math.sin(Math.PI*u)**.85;
  }
  // Use the actual chord at each span station, rather than a spherical bulge
  // centred halfway down the wing. This keeps the maximum at the wing root.
  const expanded=geometry.clone(),target=expanded.getAttribute('position');
  const delta=new Float32Array(p.count*3);
  for(let vertex=11*columns;vertex<p.count;vertex++){
    const row=Math.floor(vertex/columns),span=Math.max(0,-p.getZ(vertex));
    const edge=chordEnvelope(p.getY(vertex),p.getZ(vertex)),tip=1-MathUtils.smoothstep(span,1.25,1.43);
    const thickness=(.045+.20*(1-MathUtils.smoothstep(span,.08,1.35))**1.15)*edge*tip;
    const mirror=(rows-row)*columns+vertex%columns,base=Math.abs(p.getX(mirror)-p.getX(vertex));
    const offset=-side*Math.max(0,thickness/.30-base);
    delta[vertex*3]=offset;target.setX(vertex,p.getX(vertex)+offset);
  }
  expanded.computeVertexNormals();
  const normal=geometry.getAttribute('normal'),targetNormal=expanded.getAttribute('normal'),normalDelta=new Float32Array(p.count*3);
  for(let vertex=0;vertex<p.count;vertex++)for(let component=0;component<3;component++)normalDelta[vertex*3+component]=targetNormal.array[vertex*3+component]-normal.array[vertex*3+component];
  const positionShape=new Float32BufferAttribute(delta,3);positionShape.name='Flight_wing_volume';
  geometry.morphAttributes.position=[positionShape];geometry.morphAttributes.normal=[new Float32BufferAttribute(normalDelta,3)];geometry.morphTargetsRelative=true;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();expanded.dispose();
}
