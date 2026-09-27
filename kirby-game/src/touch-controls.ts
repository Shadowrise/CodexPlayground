import {EMOTES,type Emote} from './emotes';

type Actions={jump:()=>void;attack:()=>void;interact:()=>void;chat:()=>void;
  emote:(emote:Emote)=>void;orbit:(x:number,y:number)=>void;zoom:(delta:number)=>void};

/** Every finger has its own owner: moving, looking and jumping can overlap. */
export class TouchControls {
  readonly root=document.createElement('div');
  readonly chooser=document.createElement('div');
  private interactionLayer=document.createElement('div');
  x=0;y=0;
  private enabled=false;
  private stickId:number|undefined;
  private stick=document.createElement('div');
  private thumb=document.createElement('span');
  private look=new Map<number,{x:number;y:number}>();
  private action:HTMLButtonElement;
  get choosing(){return !this.chooser.hidden;}
  get looking(){return this.look.size>0;}
  get moving(){return Math.hypot(this.x,this.y)>.18;}

  constructor(private canvas:HTMLCanvasElement,private actions:Actions){
    this.root.id='touch-controls';this.root.hidden=true;
    this.interactionLayer.id='touch-interaction';this.interactionLayer.hidden=true;
    this.stick.id='touch-stick';this.stick.setAttribute('aria-label','Джойстик движения');
    this.thumb.className='touch-thumb';this.stick.append(this.thumb);
    const caption=document.createElement('small');caption.textContent='Движение · край — спринт';this.stick.append(caption);
    const buttons=document.createElement('div');buttons.className='touch-actions';
    const button=(id:string,text:string,label:string,fn:()=>void,parent:HTMLElement=buttons)=>{
      const b=document.createElement('button');b.type='button';b.id=id;b.textContent=text;b.setAttribute('aria-label',label);
      b.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')e.preventDefault();});
      // Activate on release so a cancelled touch never starts an interaction.
      b.addEventListener('pointerup',e=>{if(e.pointerType==='touch'&&this.enabled){e.preventDefault();fn();}});
      b.addEventListener('click',e=>{if(e.detail===0&&this.enabled)fn();});
      parent.append(b);return b;
    };
    button('touch-jump','↑','Прыжок / полёт',actions.jump);
    button('touch-attack','✦','Атака',actions.attack);
    // Keep the contextual action above the scrollable HUD, outside the movement layer.
    this.action=button('touch-interact','Действие','Взаимодействовать',actions.interact,this.interactionLayer);this.action.hidden=true;
    const utilities=document.createElement('div');utilities.className='touch-tools';
    button('touch-emotes','☺','Эмоции',()=>{this.reset();this.chooser.hidden=false;},utilities);
    button('touch-chat','Чат','Написать в чат',()=>{this.reset();actions.chat();},utilities);
    this.root.append(this.stick,buttons,utilities);
    this.chooser.id='touch-emote-menu';this.chooser.hidden=true;this.chooser.setAttribute('role','dialog');this.chooser.setAttribute('aria-label','Эмоции');
    const title=document.createElement('h3');title.textContent='Как настроение?';this.chooser.append(title);
    for(const emote of EMOTES){const b=document.createElement('button');b.type='button';b.textContent=`${emote.icon} ${emote.name}`;b.addEventListener('click',()=>{this.chooser.hidden=true;actions.emote(emote.id);});this.chooser.append(b);}
    const close=document.createElement('button');close.type='button';close.textContent='Закрыть';close.addEventListener('click',()=>this.chooser.hidden=true);this.chooser.append(close);
    document.body.append(this.root,this.interactionLayer,this.chooser);
    this.stick.addEventListener('pointerdown',e=>{
      if(!this.enabled||this.choosing||e.pointerType!=='touch'||this.stickId!==undefined)return;
      e.preventDefault();this.stickId=e.pointerId;this.stick.setPointerCapture(e.pointerId);this.moveStick(e);
    });
    this.stick.addEventListener('pointermove',e=>{if(e.pointerId===this.stickId){e.preventDefault();this.moveStick(e);}});
    const releaseStick=(e:PointerEvent)=>{if(e.pointerId===this.stickId){this.stickId=undefined;this.x=this.y=0;this.thumb.style.transform='';}};
    for(const name of ['pointerup','pointercancel','lostpointercapture'] as const)this.stick.addEventListener(name,releaseStick);
    canvas.addEventListener('pointerdown',e=>{
      if(!this.enabled||this.choosing||e.pointerType!=='touch')return;
      e.preventDefault();if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
      this.look.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove',e=>{
      const old=this.look.get(e.pointerId);if(!old)return;e.preventDefault();
      const other=[...this.look.entries()].find(([id])=>id!==e.pointerId)?.[1];
      if(other){const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(before>8&&after>8)actions.zoom(Math.log(before/after)/.0015);}
      else actions.orbit(e.clientX-old.x,e.clientY-old.y);
      this.look.set(e.pointerId,{x:e.clientX,y:e.clientY});
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'] as const)canvas.addEventListener(name,e=>this.look.delete(e.pointerId));
    window.addEventListener('blur',()=>this.reset());
    window.addEventListener('resize',()=>this.reset());
    document.addEventListener('visibilitychange',()=>this.reset());
  }
  private moveStick(e:PointerEvent){
    const box=this.stick.getBoundingClientRect(),radius=box.width*.34;
    const x=(e.clientX-box.left-box.width/2)/radius,y=(e.clientY-box.top-box.height/2)/radius,length=Math.max(1,Math.hypot(x,y));
    this.x=x/length;this.y=y/length;this.thumb.style.transform=`translate(${this.x*radius}px,${this.y*radius}px)`;
  }
  setEnabled(enabled:boolean){
    if(this.enabled===enabled)return;this.enabled=enabled;this.root.hidden=this.interactionLayer.hidden=!enabled;
    if(!enabled){this.reset();this.chooser.hidden=true;}
  }
  setInteraction(text?:string){
    this.action.hidden=!text;this.action.textContent=text?.replace(/^E\s*—\s*/,'')??'Действие';
    this.action.setAttribute('aria-label',this.action.textContent);
  }
  reset(){
    const id=this.stickId;this.stickId=undefined;this.x=this.y=0;this.thumb.style.transform='';
    if(id!==undefined&&this.stick.hasPointerCapture(id))this.stick.releasePointerCapture(id);
    const ids=[...this.look.keys()];this.look.clear();for(const i of ids)if(this.canvas.hasPointerCapture(i))this.canvas.releasePointerCapture(i);
  }
}
