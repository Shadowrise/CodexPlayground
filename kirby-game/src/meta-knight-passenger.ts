import * as T from 'three';

// Match the current model's dark indigo body and violet boots.
export const META_KNIGHT_BODY='#3f3278';
export const META_KNIGHT_VIOLET='#69448f';
export const metaKnightPaint=new T.MeshPhysicalMaterial({color:META_KNIGHT_BODY,metalness:.12,roughness:.2,clearcoat:1,clearcoatRoughness:.1});
const emblemMaterial=new T.MeshStandardMaterial({color:META_KNIGHT_VIOLET,roughness:.3,metalness:.15});
const outlineMaterial=new T.MeshStandardMaterial({color:'#ffffff',roughness:.4});
const letter=new T.Shape();
letter.moveTo(-.34,-.34);letter.lineTo(-.34,.34);letter.lineTo(-.16,.34);
letter.lineTo(0,.02);letter.lineTo(.16,.34);letter.lineTo(.34,.34);
letter.lineTo(.34,-.34);letter.lineTo(.16,-.34);letter.lineTo(.16,.02);
letter.lineTo(0,-.23);letter.lineTo(-.16,.02);letter.lineTo(-.16,-.34);letter.closePath();
const emblemGeometry=new T.ShapeGeometry(letter);
const outlineGeometry=new T.ExtrudeGeometry(letter,{depth:.001,bevelEnabled:true,bevelSize:.035,bevelThickness:.001,bevelSegments:1,steps:1});

export function makeMetaKnightEmblem(name:string){
 const mesh=new T.Mesh(emblemGeometry,emblemMaterial);mesh.name=name;
 const outline=new T.Mesh(outlineGeometry,outlineMaterial);outline.name='Meta Knight M white outline';outline.position.z=-.003;
 mesh.add(outline);return mesh;
}

/** Clone the shared asset and play its authored sitting clip, including folded
 * wings and sword grip. Kirby's procedural sitting pose must not override it. */
export function makeSeatedMetaKnight(template:T.Object3D,clips:readonly T.AnimationClip[]){
 const clip=clips.find(c=>c.name==='Sitting');
 if(!clip)throw new Error('Meta Knight needs the Sitting animation');
 const model=template.clone(true);model.name='Meta Knight · permanent passenger';
 model.userData.characterShadow=true;
 const mixer=new T.AnimationMixer(model);mixer.clipAction(clip).play();mixer.update(0);
 return {model,mixer};
}
