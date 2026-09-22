import { CatmullRomCurve3, DataTexture, Group, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, RepeatWrapping, SphereGeometry, SRGBColorSpace, TubeGeometry, Vector3 } from 'three';

/** Painted rind shares one surface: no raised rings or intersecting stripes. */
export function makeWatermelon() {
  const width=512,height=256,pixels=new Uint8Array(width*height*4);
  const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const phi=x/width*Math.PI*2,theta=y/(height-1)*Math.PI;
    const ripple=.32*Math.sin(theta*13+Math.sin(phi*3))+.15*Math.sin(theta*31-phi*2);
    const stripe=smooth(-.12,.28,Math.sin(phi*10+ripple));
    const fleck=Math.sin(phi*173+theta*139)*Math.sin(theta*241-phi*97);
    const mottling=Math.sin(phi*37+theta*29)*Math.sin(theta*47-phi*19);
    const patch=(1-smooth(.14,.36,Math.hypot(Math.sin(phi/2)*1.5,(theta-Math.PI/2)*1.2)))*.8;
    const base=[34+stripe*61,70+stripe*57,32+stripe*23];
    const spot=[192,171,86],i=(y*width+x)*4;
    for(let c=0;c<3;c++)pixels[i+c]=base[c]*(1-patch)+spot[c]*patch+fleck*3+mottling*5;
    pixels[i+3]=255;
  }
  const texture=new DataTexture(pixels,width,height);
  texture.colorSpace=SRGBColorSpace;texture.wrapS=RepeatWrapping;
  texture.magFilter=LinearFilter;texture.minFilter=LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  const group=new Group();group.name='Natural striped watermelon';
  const rind=new Mesh(new SphereGeometry(1,48,32),new MeshStandardMaterial({map:texture,roughness:.2,metalness:0}));
  rind.name='Smooth mottled watermelon rind';
  rind.scale.set(.43,.59,.44);rind.rotation.z=Math.PI/2;rind.position.y=.43;group.add(rind);
  const stemMaterial=new MeshStandardMaterial({color:'#76633b',roughness:.95});
  const curve=new CatmullRomCurve3([new Vector3(-.57,.43,0),new Vector3(-.64,.46,.015),new Vector3(-.67,.53,.03),new Vector3(-.72,.55,.055)]);
  const stem=new Mesh(new TubeGeometry(curve,12,.017,6,false),stemMaterial);
  stem.name='Curved dry watermelon stem';group.add(stem);
  const scar=new Mesh(new SphereGeometry(1,12,8),stemMaterial);
  scar.position.set(.586,.43,0);scar.scale.set(.009,.027,.027);group.add(scar);
  return group;
}
