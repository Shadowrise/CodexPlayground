import type {CharacterController} from './controller';
import {PLAYER_KNIGHT_DASH} from './meta-knight-player-dash';
import {getLocale,t} from './i18n';
import './meta-knight-player-dash.css';

export class MetaKnightPlayerDashHud{
 readonly element=document.createElement('aside');
 private title=document.createElement('strong');
 private status=document.createElement('span');
 private hint=document.createElement('small');
 private bar=document.createElement('div');
 private fill=document.createElement('i');
 constructor(){
  this.element.id='knight-dash-hud';this.element.hidden=true;
  const heading=document.createElement('div');heading.append(this.title,this.status);
  this.bar.className='knight-dash-meter';this.bar.setAttribute('role','progressbar');this.bar.setAttribute('aria-valuemin','0');this.bar.setAttribute('aria-valuemax','100');this.bar.append(this.fill);
  this.element.append(heading,this.bar,this.hint);document.body.append(this.element);
 }
 update(c:CharacterController|undefined,visible:boolean,key:string){
  this.element.hidden=!visible||!c?.isMetaKnight||c.swimming||!['Idle','Run','WalkBackward','RotateLeft','RotateRight','Jump','Fly','Dash','Push'].includes(c.state);
  if(this.element.hidden||!c)return;
  const dash=c.knightDash,charging=dash.charge>0,active=c.state==='Dash',cooling=dash.cooldown>0;
  const remaining=(Math.ceil(dash.cooldown*10)/10).toFixed(1).replace('.',getLocale()==='en'?'.':',');
  const status=active?t('Рывок!'):cooling?t('Через {0} с',[remaining]):charging?t('Зарядка…'):t('Готов');
  const progress=charging?dash.charge:1-dash.cooldown/PLAYER_KNIGHT_DASH.cooldown;
  this.element.dataset.state=active?'active':cooling?'cooldown':charging?'charging':'ready';
  this.title.textContent=t('Рывок мечом');this.status.textContent=status;
  this.hint.textContent=t('Удерживай {0} · 0,5 с',[key]);
  this.fill.style.transform=`scaleX(${progress})`;
  this.bar.setAttribute('aria-label',t(charging?'Зарядка рывка':'Готовность рывка'));
  this.bar.setAttribute('aria-valuenow',String(Math.round(progress*100)));this.bar.setAttribute('aria-valuetext',status);
 }
}
