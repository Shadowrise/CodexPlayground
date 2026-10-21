import {CraftedProps} from './crafted-props';
import {MAZE_ENTRY_POSTS} from './maze-layout';

/** The approach stays open, with no raised boards or loose stepping slabs. */
export function makeMazeEntrance(){
 const b=new CraftedProps(),palette=['#aaa88b','#b9b395','#a5a68b','#c8bf9e'];
 for(const {x,z} of MAZE_ENTRY_POSTS){
  b.box('#949a7c',x,.13,z,1.63,.26,1.63,'stone',true);
  b.box('#c1b899',x,.34,z,1.4,.16,1.4,'stone',true);
  for(let j=0;j<5;j++){
   const block=b.box(palette[j%4],x,.74+j*.62,z,1.1,.59,1.1,'stone',true);block.rotation.y=(j%3-1)*.012;
   b.box('#999e81',x+(j%2?.21:-.16),.74+j*.62,z+.557,.014,.51,.008,'stone');
  }
  b.box('#ab9b6d',x,3.69,z,1.28,.2,1.28,'stone',true);b.box('#d6c38e',x,3.86,z,1.46,.15,1.46,'stone',true);
  // Small brass lanterns have inset warm panes, caps and finials; no lights.
  b.box('#796b45',x,4.01,z,.5,.1,.5,'metal',true);b.box('#e8c96f',x,4.27,z,.34,.4,.34,'paint',true);
  for(const dx of [-.2,.2])for(const dz of [-.2,.2])b.box('#8b7850',x+dx,4.27,z+dz,.035,.46,.035,'metal');
  b.cylinder('#a98b52',x,4.56,z,.08,.34,.17,'metal',4);b.ball('#d4b874',x,4.69,z,.075,.1,.075,'metal');
  b.box('#826743',x,6.2,z-.07,.18,4.2,.19,'oak',true);
 }
 b.box('#8e744c',0,8.3,36.87,10.22,2.72,.12,'oak',true);
 return b.finish('Crafted maze gateway');
}
