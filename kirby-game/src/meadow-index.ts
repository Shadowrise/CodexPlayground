/** Static scenery queries stay local even when groves contain thousands of plants. */
export class MeadowIndex<P extends {x:number;z:number}> {
 private cells=new Map<string,P[]>();
 constructor(private step=16,points:readonly P[]=[]){for(const p of points)this.add(p);}
 add(p:P){const key=`${Math.floor(p.x/this.step)},${Math.floor(p.z/this.step)}`;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key)!.push(p);}
 some(x:number,z:number,radius:number,accept:(p:P)=>boolean){
  for(let cz=Math.floor((z-radius)/this.step);cz<=Math.floor((z+radius)/this.step);cz++)for(let cx=Math.floor((x-radius)/this.step);cx<=Math.floor((x+radius)/this.step);cx++){
   for(const p of this.cells.get(`${cx},${cz}`)??[])if(accept(p))return true;
  }
  return false;
 }
}
