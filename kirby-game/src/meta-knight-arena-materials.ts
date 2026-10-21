import * as T from 'three';

type MaterialRestore={mesh:T.Mesh;original:T.Material|T.Material[];copies:T.Material[]};

/** Isolate meadow lighting while retaining the character's painted appearance. */
export function arenaMaterials(actor:T.Object3D){
 const restores:MaterialRestore[]=[];actor.traverse(o=>{if(!(o instanceof T.Mesh))return;
  const originals=Array.isArray(o.material)?o.material:[o.material];const copies=originals.map(m=>{const copy=m.clone();copy.onBeforeCompile=T.Material.prototype.onBeforeCompile;copy.customProgramCacheKey=T.Material.prototype.customProgramCacheKey;if(copy instanceof T.MeshStandardMaterial)copy.envMap=null;copy.needsUpdate=true;return copy;});
  restores.push({mesh:o,original:o.material,copies});o.material=Array.isArray(o.material)?copies:copies[0];
 });return ()=>{for(const {mesh,original,copies} of restores){mesh.material=original;copies.forEach(m=>m.dispose());}};
}
