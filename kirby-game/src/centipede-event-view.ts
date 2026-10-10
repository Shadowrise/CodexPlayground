import {t,getLocale} from './i18n';
import * as T from 'three';
import {CentipedeFireworks} from './centipede-fireworks';
import {CentipedeBallsView} from './centipede-balls-view';
import {CentipedeChallengesView} from './centipede-challenges-view';
import {roundedRunWarning} from './centipede-warning-geometry';
import {BOSS_ARENA as A} from './boss-arena-site';
import {chargePoint,centipedeTail,centipedePhase,centipedePhaseHits,centipedeTarget,centipedeRoot,centipedeWaves,CENTIPEDE_TIMES,CENTIPEDE_BALLS,CENTIPEDE_EMPTY_MS,type CentipedeEvent,type CentipedeStage} from './centipede-event';

/** Cheap event effects; hidden completely during ordinary arena roaming. */
export class CentipedeEventView{
 readonly group=new T.Group();readonly hud=document.createElement('div');
 private title=document.createElement('strong');private message=document.createElement('div');
 private lane=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.6,depthWrite:false,side:T.DoubleSide,toneMapped:false}));
 private halo=new T.Mesh(new T.TorusGeometry(1.15,.07,6,32),new T.MeshBasicMaterial({color:'#fff29b',transparent:true,opacity:.8,depthWrite:false}));
 private confetti=new T.InstancedMesh(new T.OctahedronGeometry(.13),new T.MeshBasicMaterial(),32);
 private fireworks=new CentipedeFireworks();
 private balls=new CentipedeBallsView();private waveCue='';
 private challenges=new CentipedeChallengesView();private ringCue='';
 private matrix=new T.Matrix4();private position=new T.Vector3();private quaternion=new T.Quaternion();private scale=new T.Vector3();
 private fireworksKey='';private fireworksCentre=new T.Vector3();private look=new T.Vector3();
 private cue='';private path='';private text='';
 constructor(private sound:(stage:CentipedeStage,volume:number)=>void){
  this.group.name='Топотушка — подсказки игры';this.group.visible=false;this.halo.rotation.x=-Math.PI/2;
  this.confetti.instanceMatrix.setUsage(T.DynamicDrawUsage);this.confetti.frustumCulled=false;
  for(let i=0;i<32;i++)this.confetti.setColorAt(i,new T.Color().setHSL(i/32,.85,.6));
  this.group.add(this.lane,this.halo,this.confetti,this.fireworks.mesh,this.balls.group,this.challenges.group);
  this.hud.id='centipede-event-hud';this.hud.className='event-hud';this.hud.hidden=true;this.hud.setAttribute('role','status');this.hud.append(this.title,this.message);document.body.append(this.hud);
 }
 update(q:CentipedeEvent|undefined,id:string,now:number,listener:T.Vector3,visible:boolean,pushKey:string,camera?:T.Camera){
  const distance=Math.hypot(listener.x-A.x,listener.z-A.z);this.group.visible=!!q&&distance<120;this.hud.hidden=!q||!visible||(q.emptySince===undefined&&distance>A.radius+8);
  if(!q){this.cue=this.path='';return;}
  const key=`${q.startedAt}:${q.cycle}:${q.stage}:${q.hits}`,volume=Math.max(.15,Math.min(1,1-(distance-A.playRadius)/40));
  if(this.cue!==key){this.cue=key;if(!['balls','stomp','rest'].includes(q.stage)&&visible&&distance<75)this.sound(q.stage,volume);}
  if(q.stage==='balls'){
   const wave=Math.floor((now-q.stageAt)/CENTIPEDE_BALLS.interval),waveKey=`${key}:${wave}`;
   if(wave<CENTIPEDE_BALLS.waves&&this.waveCue!==waveKey){this.waveCue=waveKey;if(visible&&distance<75)this.sound('balls',volume);}
  }
  this.balls.update(q,now);
  this.challenges.update(q,now);
  const ring=centipedeWaves(q,now).at(-1),ringKey=ring?`${key}:${ring.index}`:'';
  if(ringKey&&this.ringCue!==ringKey){this.ringCue=ringKey;if(visible&&distance<75)this.sound('stomp',volume*.8);}
  const resting=Math.max(0,Math.ceil((CENTIPEDE_TIMES.rest-(now-q.stageAt))/1000));
  const hints:Record<CentipedeStage,string>={invite:'Давай играть! Уступай дорогу Топотушке и ищи её хвостовой бубенчик.',warning:'Сейчас будет рывок! Отойди от голубой дорожки или взлети.',charge:'Уклоняйся! После рывка Топотушка выпустит прыгучие шарики.',balls:'Апчхи! Обходи разноцветные шарики или перелетай через них. Скоро откроется бубенчик!',exhausted:`Топотушка переводит дух. Толкни бубенчик на хвосте: ${pushKey}`,tickle:'Хи-хи, щекотно! Отличный толчок — приготовься к следующему испытанию.',gather:'Второе испытание! Топотушка готовится к радужному топоту.',coil:'Сейчас побегут кольца! Перелетай волны или ищи разрывы.',stomp:'Перелетай радужные кольца или проходи через разрывы. Скоро откроется спинка!',lower:'Топотушка опускает спинку. Приготовься подлететь к бубенчику.',back:`Подлети повыше к бубенчику на спине и толкни: ${pushKey}`,bell:'Динь! Бубенчик на спине прозвенел. Готовься к новому испытанию!',rise:'Топотушка снова поднимается. Отойди и приготовься перелетать кольца.',curl:'Финальное испытание! Топотушка превращается в большое колесо.',wheelWarning:'Колесо сейчас покатится! Отойди от голубой дорожки.',wheelRoll:'Уступай дорогу колесу и перелетай кольца! Потом понадобится радужный мяч.',dizzy:`Колесо устало! Подойди к радужному мячу, повернись к Топотушке и толкни: ${pushKey}`,ballShot:'Отличный толчок! Радужный мяч летит к Топотушке.',wheelHit:'Бум-пружинка! Топотушка смеётся и готовится к следующему перекату.',uncurl:'Все испытания пройдены! Топотушка разворачивается, чтобы обнять друзей.',celebrate:'Топотушка подружилась с вами! После салюта она отдохнёт минутку.',rest:`Топотушка отдыхает. Снова поиграть можно через ${resting} с.`};
  const empty=q.emptySince===undefined?undefined:Math.max(0,Math.ceil((CENTIPEDE_EMPTY_MS-(now-q.emptySince))/1000));
  const text=`${getLocale()}:${centipedePhase(q)}:${q.hits}:${q.stage}:${pushKey}:${q.stage==='rest'?resting:''}:${empty}`;
  if(this.text!==text){this.text=text;this.title.textContent=t(empty===undefined?q.stage==='celebrate'?'Дружба с Топотушкой!':q.stage==='rest'?'Топотушка отдыхает':`Фаза ${centipedePhase(q)}/3 · ${centipedePhaseHits(q)}/3 бубенчиков`:'Арена опустела');this.message.textContent=empty===undefined?t(hints[q.stage]):t('Вернитесь на арену! Игра сбросится через {0} с.',[empty]);}
  this.lane.visible=['warning','charge','wheelWarning','wheelRoll'].includes(q.stage);
  const pathKey=`${q.startedAt}:${q.cycle}`;
  if(this.lane.visible&&this.path!==pathKey){
   this.path=pathKey;this.lane.geometry.dispose();this.lane.geometry=roundedRunWarning(u=>chargePoint(q,u),centipedePhase(q)===3?2.65:1.35);
  }
  this.lane.material.opacity=q.stage==='warning'||q.stage==='wheelWarning'?.6+.025*Math.sin(now*.006):.46;
  this.halo.visible=['exhausted','back','dizzy'].includes(q.stage);if(this.halo.visible){const p=centipedeTarget(q);this.halo.position.set(p[0],q.stage==='back'?p[1]+.6:.2,p[2]);this.halo.scale.setScalar(1+.13*Math.sin(now*.005));}
  this.confetti.visible=['tickle','bell','wheelHit','celebrate'].includes(q.stage);
  if(q.stage==='celebrate'&&this.fireworksKey!==key){
   this.fireworksKey=key;const head=q.trail.at(-1)!,tail=centipedeTail(q);
   if(camera){camera.getWorldDirection(this.look);this.look.y=0;if(this.look.lengthSq()<.001)this.look.set(head[0]-tail[0],0,head[1]-tail[1]);this.look.normalize();this.fireworksCentre.copy(listener).addScaledVector(this.look,40);}
   else this.fireworksCentre.set((head[0]+tail[0])/2,0,(head[1]+tail[1])/2);
  }
  this.fireworks.update(q.stage==='celebrate',(now-q.stageAt)/1000,this.fireworksCentre.x,this.fireworksCentre.z);
  if(this.confetti.visible){const root=centipedeRoot(q,now),centre=q.stage==='tickle'?centipedeTail(q):[root.x,root.z],elapsed=Math.max(0,(now-q.stageAt)/1000);
   for(let i=0;i<32;i++){const t=(elapsed+i*.055)%(q.stage==='tickle'?1.6:2.6),angle=i*2.399,r=t*(1.5+i%4*.3);this.position.set(centre[0]+Math.sin(angle)*r,2.3+t*4.1-t*t*1.2,centre[1]+Math.cos(angle)*r);this.quaternion.setFromEuler(new T.Euler(t+i,t*2+i,t));this.scale.setScalar(Math.max(0,1-t/2.7));this.matrix.compose(this.position,this.quaternion,this.scale);this.confetti.setMatrixAt(i,this.matrix);}
   this.confetti.instanceMatrix.needsUpdate=true;
  }
 }
}
