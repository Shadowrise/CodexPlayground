import {Color,ColorManagement,Mesh,MeshStandardMaterial,Vector3,type ColorRepresentation} from 'three';
import type {Firefly} from './firefly';

/** Keep saturated colours above the preview's bloom threshold. The meadow
 * already has its own coloured volume halos and keeps its normal materials. */
export function setFireflyBloomColor(firefly:Firefly,value:ColorRepresentation){
 firefly.setGlowColor(value);
 const color=new Color(value),peak=Math.max(color.r,color.g,color.b);
 if(peak<=0)return;
 const weights=new Vector3();ColorManagement.getLuminanceCoefficients(weights);
 const luminance=(c:Color)=>c.r*weights.x+c.g*weights.y+c.b*weights.z;
 const reference=luminance(new Color('#baff55'));
 // Normalise the hue, preserving the selected brightness: near-black values
 // stay dim and black remains off. Never reduce the existing yellow/green glow.
 const gain=Math.max(1,reference/(luminance(color)/peak));
 firefly.object.traverse(o=>{
  if(!(o instanceof Mesh))return;
  for(const material of Array.isArray(o.material)?o.material:[o.material])
   if(material instanceof MeshStandardMaterial&&material.name==='Firefly_Glow')material.emissiveIntensity*=gain;
 });
}
