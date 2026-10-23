import type {CharacterController} from './controller';
import {PLAYER_KNIGHT_DASH} from './meta-knight-player-dash';
import {t} from './i18n';
import './meta-knight-player-dash.css';

export class MetaKnightPlayerDashHud{
 readonly element=document.createElement('aside');
 private key=document.createElement('kbd');
 private keyLabel=document.createElement('span');
 private countdown=document.createElement('strong');
 constructor(){
  this.element.id='knight-dash-hud';this.element.hidden=true;
  this.element.setAttribute('role','progressbar');this.element.setAttribute('aria-valuemin','0');this.element.setAttribute('aria-valuemax','100');
  const face=document.createElement('div');face.className='knight-dash-face';face.setAttribute('aria-hidden','true');
  face.innerHTML=`<i class="knight-dash-charge"></i><i class="knight-dash-shine"></i>
   <svg class="knight-dash-symbol" viewBox="0 0 48 48" fill="none">
    <path d="m8 10 14 14L8 38l-5-5 9-9-9-9Z" fill="#e4b75c" stroke="#fff0c3" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="m26 10 14 14-14 14-5-5 9-9-9-9Z" fill="#ffe5a0" stroke="#fff5d8" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="m8 10 14 14M26 10l14 14" stroke="#fff9e2" stroke-width="2" stroke-linecap="round"/>
    <path d="m8 38 14-14M26 38l14-14" stroke="#bd883e" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M1 22h5M0 27h4" stroke="#c5b0ff" stroke-width="1.6" stroke-linecap="round"/>
   </svg>`;
  this.key.className='knight-dash-key';this.key.innerHTML='<svg class="knight-dash-space" viewBox="0 0 18 10" fill="none"><path d="M2 2v5h14V2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  this.key.append(this.keyLabel);this.countdown.className='knight-dash-countdown';this.countdown.hidden=true;
  face.append(this.key,this.countdown);this.element.append(face);document.body.append(this.element);
 }
 update(c:CharacterController|undefined,visible:boolean,key:string){
  this.element.hidden=!visible||!c||c.swimming||!['Idle','Run','WalkBackward','RotateLeft','RotateRight','Jump','Fly','Dash','Push'].includes(c.state);
  if(this.element.hidden||!c)return;
  const dash=c.playerDash,charging=dash.charge>0,active=c.state==='Dash',cooling=dash.cooldown>0;
  const remaining=String(Math.ceil(dash.cooldown));
  const status=cooling?t('Через {0} с',[remaining]):active?t('Рывок!'):charging?t('Зарядка…'):t('Готов');
  const progress=Math.max(0,Math.min(1,charging?dash.charge:1-dash.cooldown/PLAYER_KNIGHT_DASH.cooldown));
  this.element.dataset.state=cooling?'cooldown':charging?'charging':'ready';
  this.element.dataset.active=String(active);
  this.element.dataset.keyboard=String(!['A','↑'].includes(key));
  if(this.keyLabel.textContent!==key)this.keyLabel.textContent=key;
  this.countdown.hidden=!cooling;
  if(this.countdown.textContent!==remaining)this.countdown.textContent=remaining;
  this.element.style.setProperty('--dash-charge',String(charging?progress:0));
  this.element.setAttribute('aria-label',t('Ускорение'));
  this.element.setAttribute('aria-description',t('Удерживай {0} · 0,3 с',[key]));
  this.element.setAttribute('aria-valuenow',String(Math.round(progress*100)));this.element.setAttribute('aria-valuetext',status);
 }
}
