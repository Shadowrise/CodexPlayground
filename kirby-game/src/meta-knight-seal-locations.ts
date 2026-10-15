import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createRockMaterial} from './rock-model';
import {META_KNIGHT_SEAL_SITES} from './meta-knight-seal-sites';

/** Only the three low rests remain; the rejected river grotto is removed. */
export class MetaKnightSealLocations {
 readonly group=new T.Group();
 private displays:{group:T.Group;x:number;y:number;z:number}[]=[];
 constructor(){
  this.group.name='Meta Knight seal stone rests';const material=createRockMaterial();
  for(const site of META_KNIGHT_SEAL_SITES){
   const display=new T.Group();display.name=`Seal ${site.id} stone rest`;display.position.set(site.x,site.surfaceY,site.z);this.group.add(display);
   const base=new T.CylinderGeometry(.72,.86,.14,16).toNonIndexed();base.translate(0,.07,0);
   const rim=new T.TorusGeometry(.61,.035,4,20).toNonIndexed();rim.rotateX(Math.PI/2);rim.translate(0,.15,0);
   for(const [geometry,color] of [[base,'#a5a4a1'],[rim,'#c6bb9a']] as const){const tint=new T.Color(color),colors=new Float32Array(geometry.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3)colors.set(tint.toArray(),i);geometry.setAttribute('color',new T.BufferAttribute(colors,3));}
   const geometry=mergeGeometries([base,rim],false);base.dispose();rim.dispose();if(!geometry)throw Error('Cannot merge seal rest');
   const mesh=new T.Mesh(geometry,material);mesh.name=`Seal ${site.id} low stone pedestal`;mesh.receiveShadow=true;mesh.castShadow=false;display.add(mesh);
   this.displays.push({group:display,x:site.x,y:site.surfaceY,z:site.z});
  }
 }
 update(camera:T.Vector3){for(const display of this.displays)display.group.visible=(camera.x-display.x)**2+(camera.y-display.y)**2+(camera.z-display.z)**2<210**2;}
}
