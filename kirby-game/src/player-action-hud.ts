import type {CharacterController} from './controller';
import {PLAYER_KNIGHT_DASH} from './meta-knight-player-dash';
import {t} from './i18n';
import './meta-knight-player-dash.css';

const ICONS={
 push:'<path d="M17 37v-9l-5-7c-2-3 1-5 3-3l4 4V9c0-3 4-3 4 0v11-15c0-3 4-3 4 0v15-13c0-3 4-3 4 0v14-9c0-3 4-3 4 0v14c0 5-2 8-5 11"/><path d="M17 37h14v6H17z"/><path d="m40 17 5-3m-5 10h6m-6 7 5 3"/>',
 dash:'<path d="m11 33 13-13 13 13-5 5-8-8-8 8z"/><path d="m11 17 13-13 13 13-5 5-8-8-8 8z"/>',
 jump:'<path d="M20 34V18h-8L24 5l12 13h-8v16z"/><path d="M10 42h28M16 37v5m16-5v5"/>',
 fly:'<path d="M22 32C11 32 3 22 4 11c6 1 11 5 15 11l5 4 5-4c4-6 9-10 15-11 1 11-7 21-18 21"/><path d="m7 18 7 4m-3 4 7 2m23-10-7 4m3 4-7 2M24 26v13m-6 0 6-5 6 5"/>',
};
type Face=ReturnType<typeof createFace>;
function createFace(id:string,icon:keyof typeof ICONS){
 const element=document.createElement('span'),face=document.createElement('span'),key=document.createElement('kbd'),counter=document.createElement('strong');
 element.id=id;element.className='player-action-badge';element.hidden=true;
 element.setAttribute('role','progressbar');element.setAttribute('aria-valuemin','0');element.setAttribute('aria-valuemax','100');
 face.className='player-action-face';face.setAttribute('aria-hidden','true');
 face.innerHTML='<i class="player-action-shine"></i><svg class="player-action-symbol" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></svg>';
 const symbol=face.querySelector('svg')!;symbol.innerHTML=ICONS[icon];element.dataset.icon=icon;
 key.className='player-action-key';counter.className='player-action-countdown';counter.hidden=true;
 if(icon==='dash'){symbol.classList.add('knight-dash-symbol');key.classList.add('knight-dash-key');counter.classList.add('knight-dash-countdown');}
 face.append(key,counter);element.append(face);
 return {element,key,counter,symbol};
}
function icon(face:Face,name:keyof typeof ICONS){if(face.element.dataset.icon!==name){face.element.dataset.icon=name;face.symbol.innerHTML=ICONS[name];}}
function state(face:Face,key:string,available:boolean,remaining=0){
 if(face.key.textContent!==key)face.key.textContent=key;
 face.element.dataset.state=available?'ready':'cooldown';
 face.element.setAttribute('aria-disabled',String(!available));
 face.counter.hidden=remaining<=0;
 const count=remaining>0?String(Math.ceil(remaining)):'';
 if(face.counter.textContent!==count)face.counter.textContent=count;
}

/** The same three faces appear beside each other on desktop and inside touch buttons. */
export class PlayerActionHud{
 private push=createFace('player-push-hud','push');
 private dash=createFace('knight-dash-hud','dash');
 private jump=createFace('player-jump-hud','jump');
 readonly element=this.dash.element;
 private dock=document.createElement('div');
 constructor(){
  this.dock.id='player-actions-dock';this.dock.hidden=true;this.dock.append(this.push.element,this.dash.element,this.jump.element);document.body.append(this.dock);
 }
 update(c:CharacterController|undefined,visible:boolean,scheme:'keyboard'|'gamepad'|'touch',touch?:{attackButton:HTMLButtonElement;dashButton:HTMLButtonElement;jumpButton:HTMLButtonElement}){
  const shown=visible&&!!c&&['Idle','Run','WalkBackward','RotateLeft','RotateRight','Jump','Fly','Dash','Push','Swim','Eat','Roll','Hello','Joy','Fear','Anger','Sad','Peck'].includes(c.state);
  const faces=[this.push,this.dash,this.jump],buttons=touch?[touch.attackButton,touch.dashButton,touch.jumpButton]:undefined;
  this.dock.hidden=!shown||!!touch;
  faces.forEach((face,i)=>{
   const parent=buttons?.[i]??this.dock;if(face.element.parentElement!==parent)parent.append(face.element);
   face.element.dataset.embedded=String(!!touch);face.element.hidden=!shown;
   if(buttons)buttons[i].hidden=!shown;
  });
  if(!shown||!c)return;
  const keys=scheme==='gamepad'?['X','B','A']:['Q','Shift',t('Пробел')];
  state(this.push,keys[0],c.pushAvailable);
  state(this.dash,keys[1],c.dashAvailable,c.playerDash.cooldown);
  state(this.jump,keys[2],c.jumpAvailable,c.state==='Dash'?0:c.flight.hoverRemaining);
  icon(this.jump,c.flight.active?'fly':'jump');
  this.dash.element.dataset.active=String(c.playerDash.active);
  this.jump.element.dataset.active=String(c.flight.levitating&&c.state!=='Dash');
  this.push.element.setAttribute('aria-label',t('Толчок'));
  this.dash.element.setAttribute('aria-label',t('Рывок'));
  this.dash.element.setAttribute('aria-description',t('Нажми {0} — рывок',[keys[1]]));
  this.jump.element.setAttribute('aria-label',t(c.flight.active?'Полёт':'Прыжок'));
  const progress=Math.max(0,Math.min(1,1-c.playerDash.cooldown/PLAYER_KNIGHT_DASH.cooldown));
  this.push.element.setAttribute('aria-valuenow',c.pushAvailable?'100':'0');
  this.dash.element.setAttribute('aria-valuenow',String(Math.round(progress*100)));
  this.dash.element.setAttribute('aria-valuetext',c.playerDash.cooldown>0?t('Через {0} с',[Math.ceil(c.playerDash.cooldown)]):t('Готов'));
  this.jump.element.setAttribute('aria-valuenow',String(Math.round(c.flight.hoverRemaining>0?c.flight.hoverRemaining/2*100:c.jumpAvailable?100:0)));
  if(buttons)faces.forEach((face,i)=>buttons[i].setAttribute('aria-description',`${face.key.textContent} · ${face.element.getAttribute('aria-label')}`));
 }
}
