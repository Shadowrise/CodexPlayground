import {KIRBY_VARIANTS} from './variant-palette';

/** Persisted identity; old portals and saves retain the original encounter. */
export type KnightBoss='meta-knight'|'metapidgie';
/** Native rig identity stays separate from permission to assist the encounter boss. */
export function knightHelperEligible(actor:{metaKnight?:boolean;variant?:number},boss:KnightBoss='meta-knight'){
 return !!actor.metaKnight||boss==='metapidgie'&&actor.variant!==undefined&&KIRBY_VARIANTS[actor.variant]?.[0]==='Мета Пиджи';
}
const ease=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
function curve(u:number,keys:readonly (readonly [number,number])[]){for(let i=1;i<keys.length;i++)if(u<=keys[i][0]){const [a,x]=keys[i-1],[b,y]=keys[i];return x+(y-x)*ease((u-a)/(b-a));}return keys.at(-1)![1];}
/** Authored Motion-bone lift, in asset units. The renderer applies it exactly once. */
export function pidgeyAirHeight(stage:string,u:number,step=0){
 if(stage==='jump')return curve(u,[[0,0],[.2,2.4],[.45,4.4],[.72,1.8],[.9,.36],[1,0]]);
 if(stage==='dive-warn')return (10/3.3)*ease(u);
 if(stage==='dive')return (10/3.3)*(1-Math.max(0,Math.min(1,u)));
 if(stage==='shot-warn')return step>0?.62:.62*ease(u/.44);
 if(stage==='shot')return .62;
 if(stage==='return')return .62-.30*ease((u-.64)/.36);
 if(stage==='stunned')return .32*(1-ease(u/.26));
 if(stage==='rest')return .62*(1-ease(u/.68));
 return 0;
}
