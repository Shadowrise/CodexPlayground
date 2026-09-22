import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, TubeGeometry, Vector3 } from 'three';

/** Curved, tapered peel with five soft ridges and subtle ripe-skin variation. */
export function makeBanana() {
  const group = new Group();
  const curve = new CatmullRomCurve3([
    new Vector3(-.57,.48,0), new Vector3(-.4,.23,0),
    new Vector3(-.08,.13,.025), new Vector3(.25,.23,.015), new Vector3(.49,.53,0),
  ]);
  const positions:number[]=[], colors:number[]=[], indices:number[]=[];
  const rings=72, sides=30;
  const gold=new Color('#e7b62c'), yellow=new Color('#f7d64b'), green=new Color('#969c42');
  for(let i=0;i<=rings;i++) {
    const t=i/rings, center=curve.getPoint(t), tangent=curve.getTangent(t);
    const normal=new Vector3(-tangent.y,tangent.x,0).normalize();
    const radius=.018+.132*Math.sin(Math.PI*t)**.65;
    for(let j=0;j<=sides;j++) {
      const a=j/sides*Math.PI*2, ridge=1+.065*Math.cos(a*5);
      const p=center.clone().addScaledVector(normal,Math.cos(a)*radius*ridge);
      p.z+=Math.sin(a)*radius*ridge*.87;
      positions.push(p.x,p.y,p.z);
      const c=gold.clone().lerp(yellow,.55+.35*Math.cos(a));
      c.lerp(green,Math.max(0,(t-.87)/.13)*.55);
      c.multiplyScalar(.96+.035*Math.cos(a*5)+.012*Math.sin(t*170+a*11));
      // Small, irregular brown freckles; the fruit stays predominantly golden.
      const freckle=Math.sin(t*347+a*29)*Math.sin(t*167-a*43);
      if(t>.12 && t<.86 && freckle>.965)c.lerp(new Color('#96632c'),.48);
      colors.push(c.r,c.g,c.b);
      if(i<rings && j<sides) { const k=i*(sides+1)+j,n=k+sides+1;indices.push(k,k+1,n,k+1,n+1,n); }
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  group.add(new Mesh(geometry,new MeshStandardMaterial({vertexColors:true,roughness:.28})));
  const addTip=(points:Vector3[],radius:number,color:string)=>group.add(new Mesh(
    new TubeGeometry(new CatmullRomCurve3(points),12,radius,10,false),
    new MeshStandardMaterial({color,roughness:.9})));
  addTip([new Vector3(.48,.51,0),new Vector3(.52,.59,0),new Vector3(.53,.68,-.005)],.026,'#8a863c');
  addTip([new Vector3(.53,.66,-.005),new Vector3(.53,.7,-.005)],.028,'#5a4026');
  addTip([new Vector3(-.55,.46,0),new Vector3(-.58,.49,0),new Vector3(-.59,.52,0)],.023,'#654127');
  group.name='Detailed curved banana';
  return group;
}
