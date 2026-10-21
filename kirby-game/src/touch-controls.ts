import {t,onLocaleChange} from './i18n';
import {emotesFor,type PlayerEmote} from './emotes';

type Actions={jump:()=>void;attack:()=>void;interact:()=>void;chat:()=>void;
  emote:(emote:PlayerEmote)=>void;orbit:(x:number,y:number)=>void;zoom:(delta:number)=>void};

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
  private attack:HTMLButtonElement;private attackHint=document.createElement('small');
  private actionRequiresHold=false;private interactionWasHold=false;private interactionId?:number;
  private jumpId?:number;
  get jumpHeld(){return this.jumpId!==undefined;}
  get interactionHeld(){return this.interactionId!==undefined;}
  private emotes=emotesFor();
  private emoteButtons:HTMLButtonElement[]=[];
  get choosing(){return !this.chooser.hidden;}
  get looking(){return this.look.size>0;}
  get moving(){return Math.hypot(this.x,this.y)>.18;}

  constructor(private canvas:HTMLCanvasElement,private actions:Actions){
    this.root.id='touch-controls';this.root.hidden=true;
    this.interactionLayer.id='touch-interaction';this.interactionLayer.hidden=true;
    this.stick.id='touch-stick';this.stick.setAttribute('aria-label',t('Джойстик движения'));
    this.thumb.className='touch-thumb';this.stick.append(this.thumb);
    const caption=document.createElement('small');caption.textContent=t('Движение · край — спринт');this.stick.append(caption);
    const buttons=document.createElement('div');buttons.className='touch-actions';
    const button=(id:string,text:string,label:string,fn:()=>void,parent:HTMLElement=buttons)=>{
      const b=document.createElement('button');b.type='button';b.id=id;b.textContent=t(text);b.setAttribute('aria-label',t(label));
      b.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')e.preventDefault();});
      // Activate on release so a cancelled touch never starts an interaction.
      b.addEventListener('pointerup',e=>{if(e.pointerType==='touch'&&this.enabled){e.preventDefault();fn();}});
      b.addEventListener('click',e=>{if(e.detail===0&&this.enabled)fn();});
      parent.append(b);return b;
    };
    const jump=button('touch-jump','↑','Прыжок / полёт',actions.jump);
    jump.addEventListener('pointerdown',e=>{if(!this.enabled||e.pointerType!=='touch'||this.jumpId!==undefined)return;this.jumpId=e.pointerId;jump.setPointerCapture(e.pointerId);});
    const releaseJump=(e:PointerEvent)=>{if(e.pointerId===this.jumpId)this.jumpId=undefined;};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])jump.addEventListener(name,releaseJump as EventListener);
    this.attack=button('touch-attack','✦','Толчок',actions.attack);this.attackHint.className='touch-attack-hint';this.attackHint.hidden=true;this.attack.append(this.attackHint);
    // Keep the contextual action above the scrollable HUD, outside the movement layer.
    this.action=button('touch-interact','Действие','Взаимодействовать',()=>{if(!this.interactionWasHold&&!this.actionRequiresHold)actions.interact();},this.interactionLayer);this.action.hidden=true;
    this.action.addEventListener('pointerdown',e=>{if(!this.enabled||this.choosing||e.pointerType!=='touch'||this.interactionId!==undefined)return;this.interactionWasHold=this.actionRequiresHold;if(this.actionRequiresHold){this.interactionId=e.pointerId;this.action.setPointerCapture(e.pointerId);}});
    const releaseInteraction=(e:PointerEvent)=>{if(e.pointerId===this.interactionId)this.interactionId=undefined;};
    for(const name of ['pointerup','pointercancel','lostpointercapture'] as const)this.action.addEventListener(name,releaseInteraction);
    this.action.addEventListener('pointermove',e=>{const r=this.action.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)releaseInteraction(e);});
    const utilities=document.createElement('div');utilities.className='touch-tools';
    button('touch-emotes','☺','Эмоции',()=>{this.reset();this.chooser.hidden=false;},utilities);
    button('touch-chat','Чат','Написать в чат',()=>{this.reset();actions.chat();},utilities);
    this.root.append(this.stick,buttons,utilities);
    this.chooser.id='touch-emote-menu';this.chooser.hidden=true;this.chooser.setAttribute('role','dialog');this.chooser.setAttribute('aria-label',t('Эмоции'));
    const title=document.createElement('h3');title.textContent=t('Как настроение?');this.chooser.append(title);
    this.renderEmotes();
    onLocaleChange(()=>this.emoteButtons.forEach((button,i)=>{const emote=this.emotes[i];button.textContent=`${emote.icon} ${t(emote.name)}`;}));
    const close=document.createElement('button');close.type='button';close.textContent=t('Закрыть');close.addEventListener('click',()=>this.chooser.hidden=true);this.chooser.append(close);
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
  private renderEmotes(){
    for(const button of this.emoteButtons)button.remove();this.emoteButtons=[];
    const before=this.chooser.querySelector('button');
    for(const emote of this.emotes){const b=document.createElement('button');b.type='button';b.textContent=`${emote.icon} ${t(emote.name)}`;b.addEventListener('click',()=>{this.chooser.hidden=true;this.actions.emote(emote.id);});this.chooser.insertBefore(b,before);this.emoteButtons.push(b);}
  }
  setPigeon(pigeon:boolean){const emotes=emotesFor(pigeon);if(this.emotes===emotes)return;this.chooser.hidden=true;this.emotes=emotes;this.renderEmotes();}
  private moveStick(e:PointerEvent){
    const box=this.stick.getBoundingClientRect(),radius=box.width*.34;
    const x=(e.clientX-box.left-box.width/2)/radius,y=(e.clientY-box.top-box.height/2)/radius,length=Math.max(1,Math.hypot(x,y));
    this.x=x/length;this.y=y/length;this.thumb.style.transform=`translate(${this.x*radius}px,${this.y*radius}px)`;
  }
  setEnabled(enabled:boolean){
    if(this.enabled===enabled)return;this.enabled=enabled;this.root.hidden=this.interactionLayer.hidden=!enabled;
    if(!enabled){this.reset();this.chooser.hidden=true;}
  }
  setInteraction(text?:string,hold=false,progress=0){
    this.actionRequiresHold=hold;if(!text)this.interactionId=undefined;
    this.action.dataset.hold=String(hold);this.action.style.setProperty('--interaction-progress',`${hold?Math.max(0,Math.min(1,progress))*100:0}%`);
    this.action.hidden=!text;this.action.textContent=(text?t(text).replace(/^E\s*—\s*/,''):t('Действие'));
    this.action.setAttribute('aria-label',this.action.textContent);
  }
  setAttackHint(text?:string){this.attackHint.hidden=!text;this.attackHint.textContent=text??'';this.attack.setAttribute('aria-label',text??t('Толчок'));}
  reset(){
    const jump=this.root.querySelector<HTMLButtonElement>('#touch-jump'),jumpId=this.jumpId;this.jumpId=undefined;if(jumpId!==undefined&&jump?.hasPointerCapture(jumpId))jump.releasePointerCapture(jumpId);
    const interaction=this.interactionId;this.interactionId=undefined;if(interaction!==undefined&&this.action.hasPointerCapture(interaction))this.action.releasePointerCapture(interaction);
    const id=this.stickId;this.stickId=undefined;this.x=this.y=0;this.thumb.style.transform='';
    if(id!==undefined&&this.stick.hasPointerCapture(id))this.stick.releasePointerCapture(id);
    const ids=[...this.look.keys()];this.look.clear();for(const i of ids)if(this.canvas.hasPointerCapture(i))this.canvas.releasePointerCapture(i);
  }
}
