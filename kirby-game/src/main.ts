import {t,createLanguageSwitcher,localizeDOM,onLocaleChange} from './i18n';
import {CharacterUnlocks} from './character-unlocks';
import {CharacterUnlockView} from './character-unlock-view';
import {LockedCharacterTooltip} from './locked-character-tooltip';
import {MeadowTutorial} from './tutorial';
import {disposeActor} from './actor-lifecycle';
import {configureSceneryBatching} from './scenery-batch';
import {StaticWorldMatrices} from './static-world';
import {skipShadowOnlyColourPass} from './scenery-shadows';
import {updateTreeShadows} from './tree-shadows';
import {WorldShadows} from './world-shadows';
import {restrictShadowCasters} from './prepared-shadows';
import {GroundShadowPass} from './ground-shadow-pass';
import {SceneryVisibility} from './scenery-visibility';
import {CharacterShadowPass} from './character-shadow-pass';
import {ForestDetail} from './forest-detail';
import {createRenderScaleControl,parseRenderScale} from './render-scale';
import {createViewDistanceControl,parseViewDistance} from './view-distance';
import {CentipedeEventView} from './centipede-event-view';
import {startCentipede,advanceCentipede,pushCentipede,bumpCentipede,centipedeContact,nearCentipede,completedCentipede,type CentipedeEvent,type CentipedeActor} from './centipede-event';
import {advanceChasers,pushChaser,bumpChaser,hasChasers} from './centipede-chasers';
import {ArenaCentipede} from './arena-centipede';
import {BOSS_ARENA,constrainArena,constrainNpcOutsideArena} from './boss-arena-site';
import {prepareSurfaceTextures} from './texture-filtering';
import {MillQuestHud} from './mill-quest-hud';
import {BreadWorld} from './bread';
import {clearPigeonCarryPoses} from './pigeon-carry';
import {MetaKnightSeal} from './meta-knight-seal';
import {MetaKnightSealHud} from './meta-knight-seal-hud';
import {MetaKnightSealLocations} from './meta-knight-seal-locations';
import {MetaKnightArenaTravel} from './meta-knight-arena-travel';
import {cosmicCombat} from './meta-knight-cosmic';
import {createMetaKnightPortal} from './meta-knight-portal';
import {META_KNIGHT_PORTAL,nearMetaKnightPortal,insideMetaKnightPortal} from './meta-knight-arena-site';
import {META_KNIGHT_SEAL_SITES} from './meta-knight-seal-sites';
import {newSealProgress,allSealsCollected,canCollectSeal,collectSeal,type SealProgress,type SealActor} from './meta-knight-seal-state';
import {applyBread,advanceBread,canPickBread,canFeedPidgie,newBread,grantBread,breadOffering,type BreadActor,type BreadAction} from './bread-state';
import {PrankEffects} from './prank-effects';
import {MusicalFlowers} from './musical-flowers';
import {NumberGarden} from './number-garden';
import {NumberGardenView} from './number-garden-view';
import {NUMBER_GARDEN_SITE,NUMBER_DIGITS} from './number-garden-site';
import {startNumberGame,advanceNumberGame,pressNumberGame,nearNumberButton,type NumberGame} from './number-garden-game';
import {MusicalFlowerGameView} from './musical-flower-game-view';
import {startFlowerGame,replayFlowerGame,advanceFlowerGame,playFlowerGame,nearFlowerButton,type FlowerGame,type FlowerActor} from './musical-flower-game';
import {MUSICAL_FLOWERS,MUSICAL_FLOWER_SITE} from './musical-flower-site';
import {cyclePhase,daylight,phaseAtHour,INITIAL_DAY_PHASE} from './day-cycle';
import {SkyTrail} from './sky-trail';
import {MountainLedges} from './mountain-ledges';
import {StarfallView} from './starfall-view';
import {allTasks,createStarfall,collectStar,finishStarfall,RESULTS_MS} from './starfall';
import {NpcSnapshots} from './npc-snapshots';
import {PidgieNpc,type PidgiePlayer} from './pidgie-npc';
import {PigeonFlock} from './pigeon-flock';
import {preparePigeonPalette} from './pigeon-crowd';
import type {PidgieState} from './pidgie-state';
import {WILD_PIGEONS,isWildPigeonId,pigeonFriendAchievement,wildPigeonName,wildPigeonObjectName,type WildPigeonId} from './wild-pigeons';
import {isPigeonVariant} from './variant-palette';
import {MeadowIndex} from './meadow-index';
import {sceneryClearance} from './landmarks';
import {flatGround} from './pond-layout';
import {MeadowChat} from './chat';
import {emoteMessage,pidgieScareLog,pidgieInterestLog,pidgieFriendLog,metaKnightVictoryLog,metaKnightSealLogs,type LogEntry} from './world-log';
import {updateVisibility,FRUIT_DISTANCE} from './visibility';
import { createHostBadge } from './host-badge';
import { NetworkSession } from './network';
import { actorState, applyActor, restoreNetworkPlayer, RemotePlayers } from './network-actors';
import type { WorldState, ActorState } from './network-protocol';
import { InteractionOutline, outlineRegion, type OutlineTarget } from './interaction-outline';
import { watchPlayerCount } from './player-count';
import { TaskList,taskDestination } from './tasks';
import { awardFirst, scoreOf, SCORE_ACTIONS, achievementPoints } from './score';
import {SoloHistory} from './solo-history';
import {deviceInfo} from './history-types';
import { normalizePlayerName, readPlayerName, rememberPlayerName } from './player-name';
import { FpsCounter } from './fps';
import { emotesFor, EmoteWheel, type PlayerEmote } from './emotes';
import { Wayfinder, type Destination } from './navigation';
import { LANDMARKS, POND_SCALE } from './landmark-sites';
import { BALLOON_SITES } from './balloon-sites';
import { Ponds } from './ponds';
import {NpcSwimming} from './npc-swimming';
import {RainbowFountain} from './fountain';
import {FOUNTAIN_SITE} from './fountain-site';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { StableCSM } from './stable-shadows';
import { CelestialLighting } from './celestial-lighting';
import { CharacterController } from './controller';
import { resolveAttack } from './combat';
import { FruitWorld } from './fruits';
import { FollowCamera } from './follow-camera';
import { Coaster, STATION } from './coaster';
import { Watermill, MILL_LEVER } from './watermill';
import {millPushTarget,newMillQuest,millCarrying,restoreMillQuest,type MillActor,type MillAction} from './mill-quest';
import { Treehouse, TREEHOUSE_SITE } from './treehouse';
import { Benches, BENCH_SEATS } from './benches';
import { Balloons } from './balloons';
import {RiverBoats} from './river-boats';
import {createMetaKnightReflections,type MetaKnightReflections} from './meta-knight-reflections';
import { HedgeMaze } from './maze';
import { MAZE_SITE } from './maze-layout';
import { MazeTrampoline } from './maze-trampoline';
import { KirbyHome } from './kirby-home';
import { NightFireflies } from './night-fireflies';
import { randomSpawn } from './spawn';
import { createSky } from './sky';
import { BackgroundMusic } from './music';
import { SoundEffects } from './sfx';
import { MEADOW_HALF_SIZE, MOUNTAIN_WIDTH, constrainToMeadow } from './world-bounds';
import {createBossArena} from './boss-arena';
import {preloadGameAssets} from './game-assets';
import {restoreEnvironment,unpackEnvironment} from './prepared-environment';
import {startupTask,startupPaint,prioritizeStartupUI} from './startup-tasks';
import {prepareStartupGraphics} from './startup-graphics';
import { createNpcs, type KirbyNpc } from './npcs';
import { KIRBY_VARIANTS, styleVariant, type KirbyVariant } from './variants';
import {createPlayerModel} from './player-model';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';
import './touch-controls.css';
import {TouchControls} from './touch-controls';
import {touchMotion,wantsTouchControls} from './touch-input';
import {TURN_RATE} from './movement-input';
import {createFullscreenControls} from './fullscreen';
import { captureGame, parseSave, restoreGame, SAVE_KEY, type GameSave } from './save-game';
import { createGamepadInput, stickSteering } from './gamepad';
import {MetaKnightPlayerDashHud} from './meta-knight-player-dash-hud';
const knightDashHud=new MetaKnightPlayerDashHud();
const gamepad = createGamepadInput();
const mobile=wantsTouchControls(navigator.maxTouchPoints,matchMedia('(pointer: coarse)').matches,matchMedia('(hover: none)').matches);
const historyDevice=()=>deviceInfo(navigator.userAgent,navigator.maxTouchPoints,screen.width,screen.height,gamepad.input.active!=='keyboard'?'gamepad':mobile?'touch':'keyboard');
let soloHistory:SoloHistory|undefined;
document.body.classList.toggle('touch-ui',mobile);

const mount = document.querySelector<HTMLDivElement>('#game')!;
const sizeValue = document.querySelector<HTMLElement>('#player-size')!;
const fruitSpeedValue = document.querySelector<HTMLElement>('#fruit-speed')!;
const fruitValue = document.querySelector<HTMLElement>('#player-fruits')!;
const npcFruitValue = document.querySelector<HTMLElement>('#npc-fruits')!;
const playerPlace=document.querySelector<HTMLElement>('#player-place')!;
const npcPlace=document.querySelector<HTMLElement>('#npc-place')!;
const combatMessage=document.querySelector<HTMLElement>('#combat-message')!;
function setText(element:HTMLElement,value:string){value=t(value);if(element.textContent!==value)element.textContent=value;}
const playerStatsRow=document.querySelector<HTMLElement>('#player-avatar')!;
const playerHostBadge=createHostBadge();playerHostBadge.id='player-host-badge';playerHostBadge.hidden=true;playerStatsRow.append(playerHostBadge);
const npcStatsRow=document.querySelector<HTMLElement>('.npc-avatar')!;
const remainingFruitValue = document.querySelector<HTMLElement>('#remaining-fruits')!;
const settingsToggle = document.querySelector<HTMLButtonElement>('#settings-toggle')!;
const audioPanel = document.querySelector<HTMLElement>('#audio-panel')!;
const controlsPanel = document.querySelector<HTMLElement>('#controls-panel')!;
const languageSetting=document.createElement('div');languageSetting.className='settings-language';
const languageLabel=document.createElement('span');languageLabel.textContent=t('Язык');
languageSetting.append(languageLabel,createLanguageSwitcher());
audioPanel.querySelector('.input-device')!.after(languageSetting);
const settingsPanels=document.createElement('div');settingsPanels.id='settings-panels';document.body.append(settingsPanels);settingsPanels.append(audioPanel,controlsPanel);
const taskList=new TaskList(document.querySelector<HTMLOListElement>('#task-list')!,document.querySelector<HTMLElement>('#task-count')!,document.querySelector<HTMLButtonElement>('#tasks-toggle')!,action=>{
 if(!playing||!character)return;
 const target=taskDestination(action,destinations,character.actor.position);
 if(target)wayfinder.selectDestination(target.id);
});
if(mobile)document.querySelector<HTMLButtonElement>('#tasks-toggle')!.click();
if(mobile){
 audioPanel.prepend(createFullscreenControls());
 const help=document.createElement('div');help.dataset.controls='touch';help.hidden=true;
 help.innerHTML='<strong>Сенсорное управление</strong><ul class="hotkey-list"><li><b>Джойстик слева</b><span>Движение</span></li><li><b>Проведи по поляне</b><span>Повернуть камеру</span></li><li><b>Два пальца на поляне</b><span>Приблизить / отдалить</span></li><li><b>↑</b><span>Прыжок; второе касание до падения — левитация на 2 с</span></li><li><b>»</b><span>Рывок</span></li><li><b>✦</b><span>Толкнуть</span></li><li><b>Кнопка действия</b><span>Появляется рядом с аттракционом</span></li><li><b>☺ / Чат</b><span>Эмоции / сообщение</span></li></ul><p>Удобнее играть, повернув телефон горизонтально.</p>';
 controlsPanel.append(help);
}
settingsToggle.addEventListener('click', () => {
  if(tutorial.active)return;
  if(mobile&&chat.open)return;
  const open = settingsToggle.getAttribute('aria-expanded') !== 'true';
  settingsToggle.setAttribute('aria-expanded', String(open));
  audioPanel.hidden = controlsPanel.hidden = !open;
  keys.clear();pendingTurn=undefined;pendingDash=pendingJump=pendingAttack=pendingBoard=false;pendingEmote=undefined;emoteWheel.close();stopDragging();
  touch?.setEnabled(false);
  if(open)audioPanel.querySelector<HTMLElement>('select, button, input')?.focus();
  else if(playing)canvas.focus();
});
const music = new BackgroundMusic(document.querySelector<HTMLButtonElement>('#music-toggle')!, document.querySelector<HTMLInputElement>('#music-volume')!, document.querySelector<HTMLButtonElement>('#music-previous')!, document.querySelector<HTMLButtonElement>('#music-next')!, document.querySelector<HTMLElement>('#music-track')!, document.querySelector<HTMLInputElement>('#music-shuffle')!);
music.enterMenu();
const sounds = new SoundEffects(document.querySelector<HTMLButtonElement>('#sounds-toggle')!, document.querySelector<HTMLInputElement>('#sounds-volume')!);
let unlockStorage:Storage|undefined;try{unlockStorage=localStorage;}catch{}
const characterUnlocks=new CharacterUnlocks(unlockStorage);
const unlockView=new CharacterUnlockView(()=>sounds.playCharacterUnlock());
const lockedCharacterTooltip=new LockedCharacterTooltip();
const unlockAnnouncements:KirbyVariant[0][]=[];
const localLog:LogEntry[]=[];
const chat=new MeadowChat(text=>{if(network)network.event({type:'chat',text});else addLocalLog(text,true);});
function addLocalLog(text:string,isChat=false){localLog.push({id:crypto.randomUUID(),name:nameInput.value,variant:KIRBY_VARIANTS.indexOf(selected),text,chat:isChat});if(localLog.length>10)localLog.shift();}
function logPidgieReaction(person:THREE.Vector3,type:'pidgie-scare'|'pidgie-interest',bird:WildPigeonId='pidgie'){
 if(!network){localLog.push((type==='pidgie-interest'?pidgieInterestLog:pidgieScareLog)(nameInput.value,bird));if(localLog.length>10)localLog.shift();return;}
 if(!network.host)return;
 const playerId=person===character?.actor.position?network.id:Array.from(remotePlayers?.players??[]).find(([,player])=>player.actor.position===person)?.[0];
 if(playerId)network.event({type,playerId,bird});
}
let playing = false;
let selected: KirbyVariant = KIRBY_VARIANTS[0];
let loadedModel: GLTF | undefined;
let loadedPigeon: GLTF | undefined;
let loadedSnowball: GLTF | undefined;
let loadedPlumages:Record<WildPigeonId,GLTF>;
let loadedMetaKnight: GLTF | undefined;
let loadedFirefly: GLTF | undefined;
let startupComplete=false;
let startupFailed=false,entryPending=false;
let resolveStartup!:()=>void,rejectStartup!:(error:unknown)=>void;
// Entry buttons can await this promise before the scene module finishes evaluating.
export const ready=new Promise<void>((resolve,reject)=>{resolveStartup=resolve;rejectStartup=reject;});
void ready.catch(()=>{});
let firstSceneFrame=true;
let arenaCentipede:ArenaCentipede|undefined;
let pendingSave: GameSave | undefined;
const loadButton=document.createElement('button');loadButton.id='load-game';loadButton.type='button';loadButton.textContent=t('Загрузить сохранение');
const selectionCard=document.querySelector<HTMLElement>('.selection-card')!;
const nameInput=document.querySelector<HTMLInputElement>('#player-name-input')!;
const selectionMessage=document.querySelector<HTMLElement>('#selection-message')!;
try{nameInput.value=readPlayerName(localStorage);}catch{ /* Storage may be unavailable. */ }
nameInput.addEventListener('input',()=>{
  nameInput.setCustomValidity('');nameInput.removeAttribute('aria-invalid');
  try{rememberPlayerName(localStorage,nameInput.value);}catch{}
});
function requirePlayerName(){
  const name=normalizePlayerName(nameInput.value);
  nameInput.setCustomValidity(t(name?'':'Введи имя, чтобы войти в игру.'));
  if(!name){nameInput.setAttribute('aria-invalid','true');nameInput.focus();nameInput.reportValidity();return false;}
  nameInput.value=name;nameInput.removeAttribute('aria-invalid');
  try{rememberPlayerName(localStorage,name);}catch{}
  return true;
}

let networkIntent=false,network:NetworkSession|undefined,remotePlayers:RemotePlayers|undefined;
const npcSnapshots=new NpcSnapshots();let npcSnapshotHost='';
let worldRevision=-1,knownFruits=new Set<number>(),heldResource:string|undefined,acquiring=false;
let lastStarRequest=0;
const appliedRides=new Map<string,ActorState>();
let rosterSignature='';
const remoteStatRows=new Map<string,HTMLElement>();
const serverUrl=import.meta.env.VITE_GAME_SERVER_URL || (import.meta.env.DEV?'http://127.0.0.1:8787':'https://kirby-game-server.kirby-game-server.workers.dev');
const startupCard=document.createElement('div');startupCard.className='selection-card';startupCard.id='startup-menu';startupCard.hidden=false;
startupCard.innerHTML='<div class="welcome-heading"><h2 class="game-title">Кирби: Полянка друзей</h2></div>';
startupCard.querySelector('.welcome-heading')!.append(createLanguageSwitcher());
const newGameButton=document.createElement('button');newGameButton.id='new-game';newGameButton.type='button';newGameButton.textContent=t('Новая игра');
const soloSection=document.createElement('section');soloSection.className='startup-section';soloSection.innerHTML='<h3>Одиночная игра</h3>';soloSection.append(newGameButton,loadButton);
const networkSection=document.createElement('section');networkSection.className='startup-section';networkSection.innerHTML='<div class="network-heading"><h3>Сетевая игра</h3><span id="online-players" aria-live="polite">… игроков</span></div><div class="network-entry"><button type="button" id="network-join">Подключиться онлайн</button></div>';
startupCard.append(soloSection,networkSection);
watchPlayerCount(networkSection.querySelector<HTMLElement>('#online-players')!,startupCard,serverUrl);
const startupMessage=document.createElement('p');startupMessage.setAttribute('role','status');startupMessage.className='gamepad-hint';startupMessage.hidden=true;startupCard.append(startupMessage);
selectionCard.before(startupCard);
let selectionGeneration=0;
let joiningSession:NetworkSession|undefined;
function showCharacterSelection(){
 selectionGeneration++;
 startupCard.hidden=true;selectionCard.hidden=false;
 selectionMessage.hidden=true;selectionMessage.textContent='';
 if(!normalizePlayerName(nameInput.value))nameInput.focus();else document.querySelector<HTMLButtonElement>('.variant-button[aria-pressed="true"]')?.focus();
}
newGameButton.addEventListener('click',()=>{networkIntent=false;resetVariantAvailability();pendingSave=undefined;showCharacterSelection();});
networkSection.querySelector('button')!.addEventListener('click',()=>{newGameButton.click();networkIntent=true;void refreshVariantAvailability();});
const leaveOnline=document.createElement('button');leaveOnline.id='exit-to-menu';leaveOnline.textContent=t('Выйти в главное меню');audioPanel.append(leaveOnline);
let returningToMenu=false;
leaveOnline.addEventListener('click',returnToMenu);
const backButton=document.querySelector<HTMLButtonElement>('#character-back')!;
backButton.addEventListener('click',showStartupMenu);
function showStartupMenu(){
 selectionGeneration++;joiningSession?.close();joiningSession=undefined;
 music.enterMenu();sounds.reset();if(startupComplete)clearTutorialInput();
 networkIntent=false;pendingSave=undefined;resetVariantAvailability();
 startButton.disabled=false;startButton.textContent=t('На поляну →');
 selectionMessage.hidden=true;selectionMessage.textContent='';startupMessage.hidden=true;
 startupCard.hidden=false;selectionCard.hidden=true;
 document.querySelector<HTMLElement>('#character-select')!.hidden=false;
 document.body.classList.add('choosing');newGameButton.focus();
 if(!earlyMenuFrame){earlyMenuTime=performance.now();earlyMenuFrame=requestAnimationFrame(pollEarlyMenu);}
}
window.addEventListener('pagehide',()=>network?.close());
document.addEventListener('visibilitychange',()=>network?.event({type:'visible',value:!document.hidden}));
const onlineRoster=document.createElement('div');onlineRoster.className='online-roster';onlineRoster.hidden=true;document.body.append(onlineRoster);
const saveButton=document.createElement('button');saveButton.type='button';saveButton.id='save-game';saveButton.textContent=t('Сохранить игру');audioPanel.append(saveButton);
const saveMessage=document.createElement('p');saveMessage.setAttribute('role','status');saveMessage.className='gamepad-hint';audioPanel.append(saveMessage);
let hasSave=false;
try{hasSave=localStorage.getItem(SAVE_KEY)!==null;}catch{}
loadButton.disabled=!hasSave;
selectionCard.hidden=true;
loadButton.title=t(hasSave?'Загрузить сохранение':'Сохранений пока нет');
loadButton.addEventListener('click',async()=>{
  if(entryPending||playing||joiningSession)return;
  networkIntent=false;
  try {
    const raw=localStorage.getItem(SAVE_KEY);if(!raw)throw Error('Сохранение не найдено.');
    pendingSave=parseSave(raw);
    for(const id of WILD_PIGEONS)if(pendingSave.player.achievements?.includes(pigeonFriendAchievement(id))&&characterUnlocks.unlockPigeon(id))unlockAnnouncements.push(wildPigeonName(id));
    if(characterUnlocks.complete(pendingSave.player.achievements??[]))unlockAnnouncements.push('Бандана');
    resetVariantAvailability();
    selected=KIRBY_VARIANTS.find(v=>v[0]===pendingSave!.player.variant)!;
    variantGrid.querySelectorAll<HTMLButtonElement>('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===KIRBY_VARIANTS.indexOf(selected))));
    nameInput.value=normalizePlayerName(nameInput.value)||t(selected[0]);
    selectionGeneration++;
    await startGame();
  }catch(error){pendingSave=undefined;startupMessage.dataset.error='true';startupMessage.hidden=false;startupMessage.textContent=t(error instanceof Error?error.message:'Не удалось загрузить сохранение.');}
});
saveButton.addEventListener('click',()=>{
  if(!character||network)return;
  try {
    if(localStorage.getItem(SAVE_KEY)!==null && !window.confirm(t('Сохранение уже существует. Перезаписать его текущей игрой?')))return;
    localStorage.setItem(SAVE_KEY,JSON.stringify(captureGame(character,selected,npcs,fruits,coaster.riding,c=>(c instanceof CharacterController?cosmicArena.savePosition(c)??boats.savePosition(c):undefined)??balloons.savePosition(c)??fireflies?.savePosition(c)??(c instanceof CharacterController?mountainLedges.savePosition(c)??skyTrail.savePosition(c)??trampoline.savePosition(c)??home.savePosition(c):undefined),home.night,currentDayPhase(),bread.state,pidgieNpc?.networkState(),sealProgress,watermill.quest,{open:metaKnightPortalReady(),override:soloPortalOverride},wildBirds.get('snowball')?.npc.networkState(),{ugolyok:wildBirds.get('ugolyok')?.npc.networkState(),ryzhik:wildBirds.get('ryzhik')?.npc.networkState(),kurlyk:wildBirds.get('kurlyk')?.npc.networkState()})));
    saveMessage.textContent=t('Игра сохранена.');hasSave=true;loadButton.disabled=false;loadButton.title=t('Загрузить сохранение');
  }catch {saveMessage.textContent=t('Не удалось сохранить игру: хранилище браузера недоступно или заполнено.');}
});
const startButton = document.querySelector<HTMLButtonElement>('#start-game')!;
startButton.disabled=false;startButton.textContent=t('На поляну →');
startButton.addEventListener('click',()=>{void startGame();});
async function startGame(){
 if(entryPending||playing||joiningSession||!pendingSave&&(selectionCard.hidden||characterUnlocks.isLocked(selected[0]))||!requirePlayerName())return;
 entryPending=true;
 const generation=selectionGeneration,waiting=!startupComplete;
 try{
  if(waiting)document.dispatchEvent(new Event('kirby-entry-loading'));
  // Only unlock audio in the gesture. Paint feedback before synthesizing sounds.
  music.start();sounds.unlock();lockedCharacterTooltip.hide();
  if(waiting)await startupPaint();
  sounds.start();
  await ready;
  if(generation!==selectionGeneration)return;
  await enterGame();
 }catch(error){
  if(!startupFailed){pendingSave=undefined;selectionMessage.textContent=t(error instanceof Error?error.message:String(error));selectionMessage.hidden=false;}
 }finally{
  entryPending=false;
  if(waiting&&!startupFailed)document.dispatchEvent(new Event('kirby-entry-settled'));
 }
}
let dayStart=Date.now(),dayStartPhase=INITIAL_DAY_PHASE;
const currentDayPhase=()=>network?cyclePhase(network.room.dayPhase??INITIAL_DAY_PHASE,network.room.epoch,network.serverNow):cyclePhase(dayStartPhase,dayStart,Date.now());
const timeDial=document.querySelector<HTMLElement>('#time-dial')!;
const timeNeedle=document.querySelector<SVGGElement>('#time-needle')!;
const variantGrid = document.querySelector<HTMLDivElement>('#variant-grid')!;
for (const variant of KIRBY_VARIANTS) {
  const button = document.createElement('button');
  button.className = 'variant-button';
  button.type = 'button';
  button.setAttribute('aria-label', t(variant[0]));
  button.setAttribute('aria-pressed', String(variant === selected));
  styleVariant(button,variant);
  button.innerHTML = `<span class="mini-kirby" aria-hidden="true"><i class="mini-feet"></i><i class="mini-body"><i class="mini-eyes"></i><i class="mini-mouth"></i></i></span><span>${t(variant[0])}</span><span class="choice-check" aria-hidden="true">✓</span><span class="variant-lock" aria-hidden="true" hidden><svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><rect x="4" y="9" width="16" height="13" rx="4" fill="currentColor"/><path d="M12 14v3" stroke="#253142" stroke-width="2.5" stroke-linecap="round"/></svg></span>`;
  button.addEventListener('click', () => {
    if(button.disabled)return;
    if(characterUnlocks.isLocked(variant[0])){lockedCharacterTooltip.show(button,variant[0]);return;}
    selected = variant;
    variantGrid.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  });
  button.addEventListener('pointerenter',()=>{if(characterUnlocks.isLocked(variant[0]))lockedCharacterTooltip.show(button,variant[0]);});
  button.addEventListener('pointerleave',()=>lockedCharacterTooltip.leave(button));
  button.addEventListener('focus',()=>{if(characterUnlocks.isLocked(variant[0]))lockedCharacterTooltip.show(button,variant[0]);});
  button.addEventListener('blur',()=>lockedCharacterTooltip.hide());
  variantGrid.appendChild(button);
}
function updateVariantLocks(){
 variantGrid.querySelectorAll<HTMLButtonElement>('button').forEach((b,i)=>{
  const variant=KIRBY_VARIANTS[i],locked=characterUnlocks.isLocked(variant[0]);
  b.classList.toggle('variant-locked',locked);b.setAttribute('aria-disabled',String(locked||b.disabled));
  b.querySelector<HTMLElement>('.variant-lock')!.hidden=!locked;
  b.title=t(!locked&&b.dataset.occupied==='true'?'Этот цвет уже занят':'');b.setAttribute('aria-label',t(variant[0]));
  if(locked)b.setAttribute('aria-describedby',lockedCharacterTooltip.element.id);else b.removeAttribute('aria-describedby');
 });
}
function resetVariantAvailability(){
 lockedCharacterTooltip.hide();
 variantGrid.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.disabled=false;delete b.dataset.occupied;});
 updateVariantLocks();
 if(characterUnlocks.isLocked(selected[0]))variantGrid.querySelector<HTMLButtonElement>('button:not(.variant-locked):not(:disabled)')?.click();
}
resetVariantAvailability();onLocaleChange(updateVariantLocks);
let checkingVariants=false;
async function refreshVariantAvailability(){
 if(!networkIntent||playing||selectionCard.hidden||checkingVariants)return;
 checkingVariants=true;const generation=selectionGeneration;
 try{const response=await fetch(`${serverUrl.replace(/\/$/,'')}/room`,{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)return;const room=await response.json();if(generation!==selectionGeneration||!networkIntent||playing||selectionCard.hidden||!Array.isArray(room.occupiedVariants))return;
 const buttons=[...variantGrid.querySelectorAll<HTMLButtonElement>('button')];buttons.forEach((b,i)=>{b.disabled=room.occupiedVariants.includes(i);b.dataset.occupied=String(b.disabled);});
 updateVariantLocks();
 if(buttons[KIRBY_VARIANTS.indexOf(selected)].disabled||characterUnlocks.isLocked(selected[0]))buttons.find((b,i)=>!b.disabled&&!characterUnlocks.isLocked(KIRBY_VARIANTS[i][0]))?.click();
 }catch{}finally{checkingVariants=false;}
}
setInterval(()=>{if(!document.hidden)void refreshVariantAvailability();},10000);
let menuRepeat=0;
function navigateCharacterMenu(pad:ReturnType<typeof gamepad.poll>,horizontal:number,vertical:number,repeat:boolean){
 if(!startupCard.hidden){
  const languageButtons=[...startupCard.querySelectorAll<HTMLButtonElement>('.language-switcher button')];
  const buttons=[...startupCard.querySelectorAll<HTMLButtonElement>('.language-switcher button[aria-checked="true"],.startup-section button')]
    .filter(button=>!button.disabled&&button.getClientRects().length>0&&!button.closest('[inert]'));
  if(!buttons.length)return;
  let index=buttons.indexOf(document.activeElement as HTMLButtonElement);
  if(languageButtons.includes(document.activeElement as HTMLButtonElement))index=0;
  if(index<0)index=0;
  else if(repeat&&vertical)index=(index+vertical+buttons.length)%buttons.length;
  let button=buttons[index];
  const changeLanguage=repeat&&horizontal&&languageButtons.includes(button);
  if(changeLanguage)button=languageButtons[(languageButtons.indexOf(button)+horizontal+languageButtons.length)%languageButtons.length];
  if(document.activeElement!==button){button.focus({preventScroll:true});button.scrollIntoView({block:'nearest'});}
  if(changeLanguage||pad.pressed.has(0))button.click();
 }else if(!selectionCard.hidden){
  if(repeat){
   const columns=getComputedStyle(variantGrid).gridTemplateColumns.split(' ').length,delta=horizontal+vertical*columns;
   let i=KIRBY_VARIANTS.indexOf(selected);
   for(let step=0;delta&&step<KIRBY_VARIANTS.length;step++){
    i=(i+delta+KIRBY_VARIANTS.length)%KIRBY_VARIANTS.length;
    const button=variantGrid.children[i] as HTMLButtonElement;
    if(!button.disabled&&!characterUnlocks.isLocked(KIRBY_VARIANTS[i][0])){button.click();button.scrollIntoView({block:'nearest'});break;}
   }
  }
  if(pad.pressed.has(1))backButton.click();
  else if(pad.pressed.has(0))startButton.click();
 }
}
// Menu input remains available while world and graphics preparation yield.
let earlyMenuFrame=0,earlyMenuTime=performance.now(),earlyMenuDirection='';
function pollEarlyMenu(time:number){
 earlyMenuFrame=0;
 if(!document.body.classList.contains('choosing'))return;
 const dt=Math.min((time-earlyMenuTime)/1000,.05);earlyMenuTime=time;
 const pad=gamepad.poll(),usingPad=!document.body.classList.contains('loading')&&gamepad.input.active!=='keyboard';
 startupCard.classList.toggle('gamepad-navigation',usingPad);
 if(!startupMessage.dataset.error){startupMessage.hidden=!usingPad;setText(startupMessage,usingPad?'Геймпад: ↑ / ↓ — выбрать · ← / → — язык · A — подтвердить':'');}
 menuRepeat=Math.max(0,menuRepeat-dt);
 const horizontal=pad.held.has(15)?1:pad.held.has(14)?-1:Math.abs(pad.x)>.35?Math.sign(pad.x):0;
 const vertical=pad.held.has(13)?1:pad.held.has(12)?-1:Math.abs(pad.y)>.35?Math.sign(pad.y):0;
 const direction=usingPad?`${horizontal},${vertical}`:'0,0',changed=direction!==earlyMenuDirection||pad.changed;
 const repeat=usingPad&&(horizontal!==0||vertical!==0)&&(changed||menuRepeat===0);
 if(repeat)menuRepeat=changed ? .35 : .18;if(!horizontal&&!vertical)menuRepeat=0;
 earlyMenuDirection=direction;
 if(usingPad)navigateCharacterMenu(pad,horizontal,vertical,repeat);
 earlyMenuFrame=requestAnimationFrame(pollEarlyMenu);
}
document.addEventListener('kirby-startup-failed',()=>{startupFailed=true;rejectStartup(new Error('Game startup failed'));cancelAnimationFrame(earlyMenuFrame);earlyMenuFrame=0;},{once:true});
earlyMenuFrame=requestAnimationFrame(pollEarlyMenu);
prioritizeStartupUI();
localizeDOM();document.dispatchEvent(new Event('kirby-menu-ready'));
await startupPaint();
const scene = new THREE.Scene();
const meadowPortal=createMetaKnightPortal();meadowPortal.group.position.set(META_KNIGHT_PORTAL.x,0,META_KNIGHT_PORTAL.z);meadowPortal.setWorking(false);scene.add(meadowPortal.group);
const prankEffects=new PrankEffects((kind,gain)=>sounds.playPrank(kind,gain));scene.add(prankEffects.group);
const interactionOutline=new InteractionOutline();scene.add(interactionOutline.group);
scene.background = new THREE.Color('#b3d9ef');
scene.fog = new THREE.Fog('#d8e9eb', 180, 750);
// A less extreme depth range keeps distant ground overlays from fighting at altitude.
const cameraFov=()=>mobile&&innerHeight>innerWidth?75:48;
const camera = new THREE.PerspectiveCamera(cameraFov(), innerWidth / innerHeight, .75, 1200);
let renderScale:number=parseRenderScale(null,mobile);
const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true, powerPreference: 'high-performance' });
configureSceneryBatching(renderer.extensions.has('WEBGL_multi_draw'));
renderer.setPixelRatio(renderScale);
renderer.setSize(innerWidth, innerHeight);
const surfaceAnisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
renderer.shadowMap.enabled = true;
// StableCSM adds hardware-filtered depth comparisons with a continuous tent.
// Keep PCFSoft as the diagnostic fallback and the same two 1024px maps.
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
mount.appendChild(renderer.domElement);
renderer.domElement.style.visibility='hidden';

const daySky=new THREE.Color('#b3d9ef'),nightSky=new THREE.Color('#0b1428'),sunsetSky=new THREE.Color('#dd8b9b'),dayFog=new THREE.Color('#d8e9eb'),nightFog=new THREE.Color('#182b4b'),sunsetFog=new THREE.Color('#ffc392');
// Concentrate the existing texels around the player: fewer distant casters and
// smaller world-space texels, rather than cheaper but more visibly aliased filtering.
const shadows = new StableCSM({camera,parent:scene,cascades:2,maxFar:200,mode:'practical',
  shadowMapSize:1024,lightDirection:new THREE.Vector3().fromArray(daylight(currentDayPhase()).shadowDirection),lightIntensity:4.6,
  lightNear:1,lightFar:1400,lightMargin:250,shadowBias:-.00003});
shadows.fade=true;
shadows.updateFrustums();
// Allow for the coarse distant-cascade texels to suppress moving self-shadow stripes.
for(const light of shadows.lights){light.color.set('#fff1d7');light.shadow.normalBias=.12;}
const celestialLighting=new CelestialLighting(shadows,scene);
const characterShadows=new CharacterShadowPass(renderer,scene);
celestialLighting.update(daylight(currentDayPhase()));
updateTreeShadows(daylight(currentDayPhase()));
const shadowMaterials=new WeakSet<THREE.Material>();
const decorativeCharacters:THREE.Object3D[]=[];
function setupShadowMaterials(root:THREE.Object3D=scene) {
  if(root===scene)preparedShadows.prepare();else restrictShadowCasters(root);
  if(root===scene){decorativeCharacters.length=0;
   scene.traverse(o=>{if(o.name.startsWith('Permanent Kirby passenger ')||o.name==='Luigi · permanent passenger')decorativeCharacters.push(o);});}
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    skipShadowOnlyColourPass(object);
    for(const material of Array.isArray(object.material)?object.material:[object.material]) {
      prepareSurfaceTextures(material,surfaceAnisotropy);
      if(!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhongMaterial || material instanceof THREE.MeshLambertMaterial) || shadowMaterials.has(material))continue;
      const surfaceShader=material.onBeforeCompile;
      shadows.setupMaterial(material);
      material.addEventListener('dispose',()=>shadows.shaders.delete(material));
      celestialLighting.setupMaterial(material);
      const shadowShader=material.onBeforeCompile;
      material.onBeforeCompile=(shader,renderer)=>{shadowShader.call(material,shader,renderer);surfaceShader.call(material,shader,renderer);};
      shadowMaterials.add(material);material.needsUpdate=true;
    }
  });
  characterShadows.refresh();
}
const updateSky = createSky(scene);

const outer=MEADOW_HALF_SIZE+MOUNTAIN_WIDTH,inner=MEADOW_HALF_SIZE;
const border=new THREE.Shape([new THREE.Vector2(-outer,-outer),new THREE.Vector2(outer,-outer),new THREE.Vector2(outer,outer),new THREE.Vector2(-outer,outer)]);
border.holes.push(new THREE.Path([new THREE.Vector2(-inner,-inner),new THREE.Vector2(-inner,inner),new THREE.Vector2(inner,inner),new THREE.Vector2(inner,-inner)]));
const ground = new THREE.Mesh(new THREE.ShapeGeometry(border), new THREE.MeshLambertMaterial({ color: '#80b654' }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -.02;
ground.receiveShadow = true;
scene.add(ground);
const environmentRoots=await restoreEnvironment(await unpackEnvironment(await preloadGameAssets(import.meta.env.BASE_URL).environment));
scene.add(...environmentRoots);await startupTask();
performance.mark('kirby-environment-ready');
const arenaEnvironment=createBossArena();environmentRoots.push(arenaEnvironment);scene.add(arenaEnvironment);await startupTask();
const meadowWind=environmentRoots.find(root=>root.name==='Biome meadow details')!.userData.windTime as {value:number};
const ponds=new Ponds((scene.getObjectByName('Biome ground') as THREE.Mesh).material as THREE.Material);scene.add(ponds.group);
await startupTask();
const npcSwimming=new NpcSwimming();
const fountain=new RainbowFountain();scene.add(fountain.group);
const musicalFlowers=new MusicalFlowers();scene.add(musicalFlowers.group);
const numberGarden=new NumberGarden();scene.add(numberGarden.group);let soloNumberGame:NumberGame|undefined;
const numberGameView=new NumberGardenView(kind=>sounds.playNumber(kind));scene.add(numberGameView.group);
let soloFlowerGame:FlowerGame|undefined;
const flowerGameView=new MusicalFlowerGameView((index,transpose)=>{musicalFlowers.play(index,performance.now()/1000);playFlowerSound(index,transpose);},kind=>{if(kind==='finish')sounds.playMill('finish');else if(kind==='round')sounds.playTaskComplete();else sounds.playMill('wrong');});scene.add(flowerGameView.group);
const coaster=await Coaster.create();scene.add(coaster.group);
await startupTask();
const mountainLedges=new MountainLedges((scene.getObjectByName('Continuous square mountain range') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material,kind=>{if(kind==='checkpoint')sounds.playTaskComplete();else if(kind==='leaves')sounds.playTreehouse('leaves');else sounds.playBalloon('departure',.8);});scene.add(mountainLedges.group);
await startupTask();
const bread=new BreadWorld();scene.add(bread.group);let lastBreadRequest=0;
const sealLocations=new MetaKnightSealLocations();scene.add(sealLocations.group);
const seals=META_KNIGHT_SEAL_SITES.map((site,index)=>{
 const seal=new MetaKnightSeal(index*1.9);seal.spinEnabled=false;
 seal.group.position.set(site.x,site.y,site.z);seal.group.rotation.y=site.yaw;
 scene.add(seal.group);return seal;
});
let sealProgress:SealProgress=newSealProgress(),lastSealRequest=0;
const sealHud=new MetaKnightSealHud();
let soloPortalOverride:boolean|undefined;
function metaKnightPortalReady(){return playing&&(network?network.room.metaKnightPortalOpen===true||allSealsCollected(network.room.sealProgress??sealProgress):soloPortalOverride??allSealsCollected(sealProgress));}
const initialCarts=coaster.networkState();
const boats=new RiverBoats();scene.add(boats.group);
await startupTask();
const boatTime=()=>network?(network.serverNow-network.room.epoch)/1000:performance.now()/1000;
const millHud=new MillQuestHud();
const watermill=await Watermill.create();scene.add(watermill.group);
await startupTask();
const treehouse=await Treehouse.create(kind=>sounds.playTreehouse(kind));scene.add(treehouse.group);
await startupTask();
const benches=new Benches();
const skyTrail=new SkyTrail(kind=>{if(kind==='star')sounds.playStarPickup();else if(kind==='checkpoint')sounds.playTaskComplete();else if(kind==='leaves')sounds.playTreehouse('leaves');else sounds.playBalloon('departure',.8);});scene.add(skyTrail.group);
await startupTask();
const home=new KirbyHome();scene.add(home.group);
await startupTask();
const dogSoundPosition=new THREE.Vector3();
let fireflies:NightFireflies|undefined;
const maze=new HedgeMaze();scene.add(maze.group);
await startupTask();
const trampoline=new MazeTrampoline(kind=>{if(kind==='bounce'){sounds.playBalloon('departure',.8);sounds.playTreehouse('cheer');}else sounds.playTreehouse('leaves');});scene.add(trampoline.group);
let balloonSeed=6173;
const balloons=new Balloons((kind,position)=>{if(character){const gain=Math.max(0,1-position.distanceTo(character.actor.position)/35);if(gain>0)sounds.playBalloon(kind,gain);}},()=>{balloonSeed=(Math.imul(balloonSeed,1664525)+1013904223)>>>0;return balloonSeed/4294967296;});scene.add(balloons.group);
const navigationHud=document.createElement('div');navigationHud.id='navigation-hud';document.body.append(navigationHud);
const routePanel=document.createElement('div');routePanel.className='panel route-panel';
const rideHint=document.createElement('div');rideHint.id='action-hint';rideHint.className='panel interaction-hint';rideHint.setAttribute('role','status');navigationHud.append(rideHint);
document.querySelector('.tasks-panel')!.before(routePanel);
const destinations:Destination[]=[
 {id:'meta-knight-portal',name:'Портал Метакнайта',x:META_KNIGHT_PORTAL.x,z:META_KNIGHT_PORTAL.z+META_KNIGHT_PORTAL.returnOffset},
 {id:'number-garden',name:'Звонкие циферки',x:NUMBER_GARDEN_SITE.x,z:NUMBER_GARDEN_SITE.z+NUMBER_GARDEN_SITE.halfDepth+2},
 {id:'musical-flowers',name:'Цветочная мелодия',x:MUSICAL_FLOWER_SITE.x,z:MUSICAL_FLOWER_SITE.z+4},
 {id:'boss-arena',name:'Арена Топотушки',x:BOSS_ARENA.entry.x,z:BOSS_ARENA.entry.z},
 {id:'fountain',name:'Радужный фонтан',x:FOUNTAIN_SITE.x,z:FOUNTAIN_SITE.z+8},
 {id:'sky-trail',name:'Небесная тропа',x:skyTrail.entry.x,z:skyTrail.entry.z,radius:4},
 {id:'home',name:'Домик Кирби',x:home.entrance.x,z:home.entrance.z},
 {id:'treehouse',name:'Домик на дереве и качели',x:TREEHOUSE_SITE.x-4,z:TREEHOUSE_SITE.z+11,radius:3},
 {id:'swing',name:'Качели у домика',x:TREEHOUSE_SITE.x-11,z:TREEHOUSE_SITE.z+3,radius:3},
 {id:'mill',name:'Водяная мельница',x:MILL_LEVER.x,z:MILL_LEVER.z},
 {id:'depot',name:'Американские горки — депо',x:STATION.x,z:STATION.z-7},
 {id:'maze',name:'Радужный лабиринт',x:MAZE_SITE.x,z:MAZE_SITE.z+39},
 ...BALLOON_SITES.map((p,i)=>({id:`balloon-${i}`,name:`Шар: ${p.name}`,x:p.x,z:p.z})),
];
const wayfinder=new Wayfinder(routePanel,scene,destinations);
chat.configureCommands({
 enabled:()=>playing&&!network&&!networkIntent,
 duelActive:()=>cosmicArena.duelCommandsAvailable,
 destinations:()=>destinations,
 execute:command=>{
  if(!character||network||networkIntent)return;
  if(command.kind==='phase'){cosmicArena.setPhase(command.phase,command.subphase);return;}
  if(command.kind==='godmode'){
   const enabled=cosmicArena.toggleGodMode();
   if(enabled!==undefined)addLocalLog(enabled?'включил неуязвимость до конца дуэли.':'выключил неуязвимость.');
   return;
  }
  if(command.kind==='size'){character.resizeTo(command.size,true);return;}
  if(command.kind==='time'){dayStart=Date.now();dayStartPhase=phaseAtHour(command.hour);return;}
  if(command.kind==='portal'){soloPortalOverride=command.open;meadowPortal.setWorking(metaKnightPortalReady());return;}
  if(command.kind==='unlock'){
   const name=isWildPigeonId(command.character)?wildPigeonName(command.character):command.character==='meta-knight'?'Meta Knight':'Бандана';
   const unlocked=isWildPigeonId(command.character)?characterUnlocks.unlockPigeon(command.character):command.character==='meta-knight'?characterUnlocks.unlockMetaKnight():characterUnlocks.unlockBandana();
   if(unlocked){unlockAnnouncements.push(name);lockedCharacterTooltip.hide();updateVariantLocks();}
   return;
  }
  // Release every source of scripted movement before changing world position.
  cosmicArena.leave();
  // This also restores the model fitted into a basket, bed, cart or boat.
  clearTutorialInput();coaster.disembark();boats.cancel();fireflies?.disembark();
  home.cancel();benches.cancel();treehouse.cancel();balloons.cancel();trampoline.cancel();skyTrail.cancel();mountainLedges.cancel();
  character.setActivity('Idle');character.actor.rotation.set(0,character.yaw,0);
  character.surfaceY=0;character.swimming=false;
  const {x,z,y=0}=command.destination;character.actor.position.set(x,y,z);
  for(let i=0;i<4;i++){
   watermill.constrain(character.actor.position,character.actor.scale.x);
   treehouse.constrain(character.actor.position,character.actor.scale.x);
   home.constrain(character.actor.position,character.actor.scale.x);
   constrainArena(character.actor.position,character.actor.scale.x);
  }
  // A teleport is not a swept move from the old position through all maze walls.
  const landing=character.actor.position.clone();maze.constrain(character.actor.position,character.actor.scale.x,landing);
  ponds.apply(character,landing,false);ponds.apply(character,character.actor.position.clone());
  skyTrail.restorePosition(character);mountainLedges.restorePosition(character);wayfinder.selectDestination('');
  viewScale=character.actor.scale.x;cameraTarget.copy(character.actor.position).y+=.9*viewScale;
 }
});
const fruitObstacles=[...(scene.getObjectByName('Four woodland biomes')?.userData.treePositions??[]),...(scene.getObjectByName('Biome meadow details')?.userData.sites??[]).filter((s:{kind:string})=>s.kind==='bush'||s.kind==='stump')];
// Takeoff and landing need a dry clearing wide enough for the open wings.
const pidgieGroundObstacles:{x:number;z:number;radius:number;walkRadius:number}[]=[
 // A running bird fits beneath crowns; trunks and low scenery still block it.
 ...(scene.getObjectByName('Four woodland biomes')?.userData.treePositions??[]).map((p:{x:number;z:number;crownRadius:number})=>({x:p.x,z:p.z,radius:p.crownRadius+2.5,walkRadius:Math.min(1.5,p.crownRadius*.2)+.8})),
 ...(scene.getObjectByName('Biome meadow details')?.userData.sites??[]).filter((p:{kind:string})=>p.kind==='bush'||p.kind==='stump').map((p:{x:number;z:number;radius:number})=>({x:p.x,z:p.z,radius:p.radius+2.5,walkRadius:p.radius+.8})),
 ...(scene.getObjectByName('Ponds, flowers, mushrooms, rocks, picnics and ruins')?.userData.scenerySites??[]).map((p:{x:number;z:number;radius:number})=>({x:p.x,z:p.z,radius:p.radius+2.5,walkRadius:p.radius+.8})),
];
const pidgieGroundIndex=new MeadowIndex(16,pidgieGroundObstacles);
const pidgieGroundRadius=Math.max(3,...pidgieGroundObstacles.map(p=>p.radius));
const pidgieWalkRadius=Math.max(3,...pidgieGroundObstacles.map(p=>p.walkRadius));
const pidgieFlightBounds=[treehouse.group,skyTrail.group].map(group=>new THREE.Box3().setFromObject(group));
function pidgieSafeGround(x:number,z:number){
 return Math.max(Math.abs(x),Math.abs(z))<MEADOW_HALF_SIZE-8&&flatGround(x,z,2.5)&&sceneryClearance(x,z,3)
  &&!pidgieGroundIndex.some(x,z,pidgieGroundRadius,p=>(x-p.x)**2+(z-p.z)**2<p.radius**2);
}
function pidgieSafeWalk(x:number,z:number){
 return Math.max(Math.abs(x),Math.abs(z))<MEADOW_HALF_SIZE-2.5&&flatGround(x,z,.8)&&sceneryClearance(x,z,.8)
  &&!pidgieGroundIndex.some(x,z,pidgieWalkRadius,p=>(x-p.x)**2+(z-p.z)**2<p.walkRadius**2);
}
function pidgieFlightHeight(from:THREE.Vector3,to:THREE.Vector3){
 let height=26;
 for(const box of pidgieFlightBounds){
  let begin=0,end=1;
  for(const axis of ['x','z'] as const){
   const delta=to[axis]-from[axis],min=box.min[axis]-3,max=box.max[axis]+3;
   if(Math.abs(delta)<1e-6){if(from[axis]<min||from[axis]>max){begin=1;end=0;}continue;}
   const a=(min-from[axis])/delta,b=(max-from[axis])/delta;
   begin=Math.max(begin,Math.min(a,b));end=Math.min(end,Math.max(a,b));
  }
  if(begin<=end)height=Math.max(height,box.max.y+4);
 }
 return Math.min(128,height);
}
const fruits = await FruitWorld.create(fruitObstacles);
fruits.group.name='Фрукты на поляне';
// Clear only the small footprints beneath fruit, keeping surrounding grass intact.
const grassMatrix=new THREE.Matrix4();
scene.getObjectByName('Meadow grass')?.traverse(object=>{
 if(!(object instanceof THREE.InstancedMesh))return;
 for(let i=0;i<object.count;i++){
  object.getMatrixAt(i,grassMatrix);const x=grassMatrix.elements[12],z=grassMatrix.elements[14];
  if(fruits.fruits.some(f=>Math.hypot(x-f.object.position.x,z-f.object.position.z)<2.6)){grassMatrix.scale(new THREE.Vector3(0,0,0));object.setMatrixAt(i,grassMatrix);}
 }
 object.instanceMatrix.needsUpdate=true;
});
scene.add(fruits.group);
const preparedShadows=new WorldShadows(scene,coaster);
preparedShadows.deferPreparation();
preparedShadows.prepareFruits(fruits.fruits);
preparedShadows.grass.visible=new URLSearchParams(location.search).get('grassShadows')!=='0';
setupShadowMaterials();
await preparedShadows.finishPreparation();
await startupTask();
const groundShadowPass=new GroundShadowPass(renderer,scene);
const worldMatrices=new StaticWorldMatrices(scene);worldMatrices.add(ground);environmentRoots.forEach(root=>worldMatrices.add(root));worldMatrices.add(sealLocations.group);
const sceneryVisibility=new SceneryVisibility(environmentRoots);
const forestDetail=new ForestDetail(environmentRoots);
languageSetting.after(createRenderScaleControl(scale=>{renderScale=scale;renderer.setPixelRatio(scale);},mobile));
let viewDistance:number=parseViewDistance(null,mobile);
languageSetting.after(createViewDistanceControl(distance=>{
 viewDistance=distance;const fog=scene.fog as THREE.Fog;fog.near=Math.min(180,distance*.5);fog.far=distance;
},mobile));

const keys = new Set<string>();
let pendingTurn: 'KeyA' | 'KeyD' | undefined;
let pendingJump = false;
let pendingDash = false;
let pendingAttack = false;
let pendingEmote:PlayerEmote|undefined;
const emoteWheel=new EmoteWheel();
let pendingBoard = false;
let hitMessageRemaining = 0;
const controls = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyE', 'KeyQ', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight']);
window.addEventListener('keydown', event => {
  if(!playing||roundFinished()||tutorial.active)return;
  if(event.code==='Enter'&&!event.repeat&&!event.isComposing&&gamepad.input.active==='keyboard'&&!(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,button'))){
    event.preventDefault();keys.clear();pendingTurn=undefined;pendingDash=pendingJump=pendingAttack=pendingBoard=false;pendingEmote=undefined;stopDragging();chat.show();return;
  }
  if(chat.open)return;
  if(event.code==='Escape'){
    event.preventDefault();
    if(!event.repeat)settingsToggle.click();
    return;
  }
  if(gamepad.input.active !== 'keyboard' || !audioPanel.hidden)return;
  if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  const digit=/^(?:Digit|Numpad)([1-6])$/.exec(event.code);
  const emote=digit?emotesFor(character?.isPigeon)[Number(digit[1])-1]:undefined;
  if(emote && audioPanel.hidden && !event.repeat){event.preventDefault();pendingEmote=emote.id;return;}
  if(event.target instanceof HTMLElement && event.target.closest('button') && (event.code==='Space'||event.code==='Enter'))return;
  if (controls.has(event.code)) {
    event.preventDefault(); keys.add(event.code);
    if (!event.repeat && (event.code === 'KeyA' || event.code === 'KeyD')) pendingTurn = event.code;
    if (!event.repeat && event.code === 'Space') pendingJump = true;
    if (!event.repeat && (event.code === 'ShiftLeft' || event.code === 'ShiftRight')) pendingDash = true;
    if (!event.repeat && event.code === 'KeyE') pendingBoard = true;
    if (!event.repeat && event.code === 'KeyQ') pendingAttack = true;
  }
});
window.addEventListener('keyup', event => { keys.delete(event.code); });
window.addEventListener('blur', () => { pendingEmote=undefined;emoteWheel.close();keys.clear(); pendingTurn = undefined; pendingJump = false; pendingDash = false; pendingAttack = false; pendingBoard = false; });
document.addEventListener('visibilitychange', () => { keys.clear(); pendingTurn = undefined; pendingJump = false; pendingDash = false; pendingAttack = false; pendingBoard = false; });

const followCamera = new FollowCamera();
const canvas = renderer.domElement;
const touch=mobile?new TouchControls(canvas,{
 jump:()=>{pendingJump=true;},dash:()=>{pendingDash=true;},attack:()=>{pendingAttack=true;},interact:()=>{pendingBoard=true;},
 chat:()=>{chat.show();},emote:emote=>{pendingEmote=emote;},
 orbit:(x,y)=>followCamera.orbit(x,y),zoom:delta=>followCamera.zoom(delta),
}):undefined;
let dragPointer: number | undefined;
let dragX = 0, dragY = 0;
let dragMode:'camera'|'character'='camera';
let mouseTurn=0;
let pointerLocked=false;
let rightMouseHeld=false;
let leftMouseHeld=false;
const stopDragging = () => {
  const pointer=dragPointer;dragPointer=undefined;mouseTurn=0;rightMouseHeld=leftMouseHeld=false;
  if(pointer!==undefined && canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);
  if(document.pointerLockElement===canvas)document.exitPointerLock();
  canvas.style.cursor='grab';
};
let tutorialStorage:Storage|undefined;try{tutorialStorage=localStorage;}catch{}
const clearTutorialInput=()=>{keys.clear();pendingTurn=undefined;pendingDash=pendingJump=pendingAttack=pendingBoard=false;pendingEmote=undefined;emoteWheel.close();stopDragging();touch?.reset();};
gamepad.onChange(clearTutorialInput);
const cosmicArena=new MetaKnightArenaTravel(renderer,scene,followCamera,()=>{
 clearTutorialInput();interactionOutline.update(undefined);wayfinder.selectDestination('');
 document.body.classList.toggle('in-meta-knight-arena',cosmicArena.active||cosmicArena.loading);
 if(character){cameraTarget.copy(character.actor.position).y+=.9*character.actor.scale.x;viewScale=character.actor.scale.x;}
},()=>{
 if(!loadedModel||!loadedMetaKnight)return;
 const model=createPlayerModel(loadedModel,KIRBY_VARIANTS.find(v=>v[0]==='Meta Knight')!,loadedPigeon,false,loadedMetaKnight);
 return new CharacterController(model.model,model.clips);
},{online:()=>!!network,state:()=>network?.room.knightBattle,id:()=>network?.id??'solo',now:()=>network?.serverNow??Date.now(),actors:()=>[],profiles:()=>[{id:network?.id??'solo',name:nameInput.value,variant:KIRBY_VARIANTS.indexOf(selected)},...Array.from(network?.actors??[],([id,a])=>({id,name:a.name,variant:a.variant,location:a.location}))],send:action=>network?.event({type:'knight',action}),win:()=>completeKnightVictory(true),cue:(kind,rate)=>sounds.playKnight(kind,rate),stopCosmic:()=>sounds.stopKnightCosmic(),chargeAudio:level=>sounds.updateKnightGravityCharge(level),prepareCosmic:()=>sounds.prepareKnightCosmic(),firefly:()=>loadedFirefly,music:active=>music.setEvent(active?'knight':false)});
function completeKnightVictory(local=false){
 if(!character)return;
 if(local){localLog.push(metaKnightVictoryLog(nameInput.value));if(localLog.length>10)localLog.shift();}
 if(characterUnlocks.unlockMetaKnight()){unlockAnnouncements.push('Meta Knight');lockedCharacterTooltip.hide();updateVariantLocks();}
 checkCharacterUnlock();
}
const tutorial=new MeadowTutorial({
 scheme:gamepad.input.active!=='keyboard'?'gamepad':mobile?'touch':'keyboard',storage:tutorialStorage,
 adventures:document.querySelector<HTMLElement>('.tasks-panel')!,route:routePanel,
 onOpen:()=>{if(!audioPanel.hidden)settingsToggle.click();chat.close();clearTutorialInput();},
 onClose:clearTutorialInput,
});
const replayTutorial=document.createElement('button');replayTutorial.id='replay-tutorial';replayTutorial.type='button';replayTutorial.textContent=t('Пройти обучение');
replayTutorial.addEventListener('click',()=>{if(playing&&!roundFinished())tutorial.open(true);});saveButton.after(replayTutorial);audioPanel.append(leaveOnline);
canvas.style.cursor = 'grab';
canvas.addEventListener('pointerdown', event => {
  if (chat.open || !playing || gamepad.input.active !== 'keyboard' || !audioPanel.hidden || event.button !== 0 || event.pointerType !== 'mouse') return;
  // Cancelling pointerdown would suppress the second button's mousedown too.
  // Prevent the default on mousedown instead, keeping both button orders usable.
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  leftMouseHeld=true;
  if(rightMouseHeld)return;
  dragMode='camera';mouseTurn=0;
  dragPointer = event.pointerId;
  dragX = event.clientX; dragY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor='grabbing';
});
// Use MouseEvents throughout the right-button gesture. Pointer capture cancellation
// during pointer lock must not end the separate mouse-lock gesture.
canvas.addEventListener('mousedown',event=>{
  if(chat.open || !playing || gamepad.input.active!=='keyboard' || !audioPanel.hidden)return;
  // A second mouse button does not emit pointerdown while the first is held.
  if(event.button===0){event.preventDefault();leftMouseHeld=true;return;}
  if(event.button!==2)return;
  event.preventDefault();stopDragging();
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  rightMouseHeld=true;leftMouseHeld=!!(event.buttons&1);dragMode='character';canvas.style.cursor='grabbing';
  try{Promise.resolve(canvas.requestPointerLock()).catch(()=>{if(rightMouseHeld)stopDragging();});}catch{stopDragging();}
});
canvas.addEventListener('pointermove', event => {
  if(document.pointerLockElement===canvas)return;
  if (gamepad.input.active !== 'keyboard') { stopDragging(); return; }
  if (event.pointerId !== dragPointer) return;
  if (!(event.buttons & (dragMode==='character'?2:1))) { stopDragging(); return; }
  if(dragMode==='character')mouseTurn=THREE.MathUtils.clamp(mouseTurn-(event.clientX-dragX)*.006,-.5,.5);
  else followCamera.orbit(event.clientX - dragX, event.clientY - dragY);
  dragX = event.clientX; dragY = event.clientY;
});
canvas.addEventListener('contextmenu',event=>{if(playing && gamepad.input.active==='keyboard')event.preventDefault();});
document.addEventListener('pointerup',event=>{if(event.button===0 && dragMode==='camera')stopDragging();});
document.addEventListener('mouseup',event=>{if(event.button===0)leftMouseHeld=false;if(event.button===2 && dragMode==='character')stopDragging();});
document.addEventListener('mousemove',event=>{
  if(document.pointerLockElement!==canvas || !rightMouseHeld)return;
  if(gamepad.input.active!=='keyboard' || !audioPanel.hidden){stopDragging();return;}
  leftMouseHeld=!!(event.buttons&1);
  mouseTurn=THREE.MathUtils.clamp(mouseTurn-event.movementX*.006,-.5,.5);
});
document.addEventListener('pointerlockchange',()=>{
  const locked=document.pointerLockElement===canvas;
  if(locked && !rightMouseHeld){document.exitPointerLock();return;}
  const released=pointerLocked&&!locked;pointerLocked=locked;if(released)stopDragging();
});
document.addEventListener('pointerlockerror',stopDragging);
canvas.addEventListener('pointercancel',()=>{if(dragMode==='camera')stopDragging();});
canvas.addEventListener('lostpointercapture',()=>{if(dragMode==='camera')stopDragging();});
window.addEventListener('blur', stopDragging);
document.addEventListener('visibilitychange', stopDragging);
canvas.addEventListener('wheel', event => {
  if (!playing) return;
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
  followCamera.zoom(event.deltaY * unit);
}, { passive: false });
let viewScale = 1;
const cameraTarget = new THREE.Vector3(0, .9, 0);
const cameraLook = new THREE.Vector3();
const playerPrevious = new THREE.Vector3();
const groundPrevious = new THREE.Vector3();
const npcPrevious = new THREE.Vector3();

let character: CharacterController | undefined;
let npcs: KirbyNpc[] = [];
let pidgieNpc:PidgieNpc|undefined;
let pidgieReady=false;
type WildBird={npc:PidgieNpc;ready:boolean;fearSeen:number;joySeen:boolean;helloSeen:boolean};
const wildBirds=new Map<WildPigeonId,WildBird>();
let pigeonFlock:PigeonFlock|undefined;

function tickWildPigeons(dt:number,people:THREE.Vector3[],players:PidgiePlayer[],withSound=false){
 for(const [id,bird] of wildBirds){
  if(!bird.ready)continue;
  const npc=bird.npc;
  if(!network||network.host){const offering=breadOffering(bread.state,id);if(offering)npc.acceptBread(offering);npc.update(dt,people,constrainNpc,players);}
  else npc.updateRemote(dt,constrainNpc);
  if(withSound&&character){
   const p=npc.actor.position,listener=character.actor.position;
   const play=(emote:'Fear'|'Joy'|'Hello')=>void sounds.playPigeonEmoteAt(emote,p.x-listener.x,p.z-listener.z,followCamera.azimuth);
   if(bird.fearSeen!==npc.fearCount)play('Fear');
   if(npc.state==='Joy'&&!bird.joySeen)play('Joy');
   if(npc.state==='Hello'&&!bird.helloSeen)play('Hello');
  }
  bird.fearSeen=npc.fearCount;bird.joySeen=npc.state==='Joy';bird.helloSeen=npc.state==='Hello';
 }
 if(network&&pigeonFlock){
  pigeonFlock.update(dt,roundFinished()?[]:network.room.pigeonFlock??[],network.host,players,people,constrainNpc,network.serverNow);
 }
}
let metaKnightReflections:MetaKnightReflections|undefined;

async function loadCharacter() {
  try {
    const files=preloadGameAssets(import.meta.env.BASE_URL).models,models:GLTF[]=[],loader=new GLTFLoader();
    for(const file of files){models.push(await loader.parseAsync(await file,new URL(import.meta.env.BASE_URL+'models/',location.href).href));await startupTask();}
    const [gltf,bugModel,shibaModel,centipedeModel,pigeonModel,breadModel,metaKnightModel,snowballModel,ugolyokModel,ryzhikModel,kurlykModel]=models;
    metaKnightReflections=createMetaKnightReflections(renderer,metaKnightModel.scene);
    for(const seal of seals)metaKnightReflections.add(seal.model);
    metaKnightReflections.update(daylight(currentDayPhase()));
    coaster.addMetaKnightPassenger(metaKnightModel.scene,metaKnightModel.animations);
    boats.addMetaKnightPassenger(metaKnightModel.scene,metaKnightModel.animations);
    watermill.bakery.setBreadModel(breadModel.scene.clone(true));bread.setModel(breadModel.scene);
    arenaCentipede=new ArenaCentipede(centipedeModel);arenaCentipede.group.userData.characterShadow=true;scene.add(arenaCentipede.group);
    await startupTask();
    home.dogHouse.placeDog(shibaModel.scene);
    await startupTask();
    loadedFirefly=bugModel;
    fireflies=new NightFireflies(bugModel);fireflies.group.userData.characterShadow=true;scene.add(fireflies.group,...fireflies.lights);
    preparedShadows.deferPreparation();setupShadowMaterials();await preparedShadows.finishPreparation();
    loadedModel = gltf;
    loadedPigeon = pigeonModel;
    loadedSnowball = snowballModel;
    loadedPlumages={pidgie:pigeonModel,snowball:snowballModel,ugolyok:ugolyokModel,ryzhik:ryzhikModel,kurlyk:kurlykModel};
    loadedMetaKnight = metaKnightModel;
    for(const model of Object.values(loadedPlumages)){await preparePigeonPalette(model);await startupTask();}
  } catch (error) {
    console.error(error);
    selectionMessage.textContent = t('Не удалось загрузить персонажей. Обновите страницу.');selectionMessage.hidden=false;
    startButton.textContent = t('Загрузка не удалась');
    throw error;
  }
}
void loadCharacter().then(async()=>{
  performance.mark('kirby-models-ready');
  await prepareStartupGraphics(renderer,scene,camera);
  performance.mark('kirby-graphics-ready');
  startupComplete=true;resolveStartup();
}).catch(error=>{startupFailed=true;rejectStartup(error);});
async function enterGame(){
  if (!startupComplete || !loadedModel || playing || joiningSession || !pendingSave&&(selectionCard.hidden || characterUnlocks.isLocked(selected[0])) || !requirePlayerName()) return;
  lockedCharacterTooltip.hide();
  const generation=selectionGeneration;
  selectionMessage.hidden=true;selectionMessage.textContent='';
  if(networkIntent){
    startButton.disabled=true;startButton.textContent=t('Подключаемся…');
    const session=joiningSession=new NetworkSession();
    session.onPigeonsCleared=()=>pigeonFlock?.clear();
    try{
      await session.connect(serverUrl,KIRBY_VARIANTS.indexOf(selected),nameInput.value,historyDevice());
      if(generation!==selectionGeneration){session.close();return;}
      network=session;if(session.resume)selected=KIRBY_VARIANTS[session.resume.variant];
    }
    catch(error){session.close();if(generation!==selectionGeneration)return;void refreshVariantAvailability();startButton.disabled=false;startButton.textContent=t('Подключиться снова');selectionMessage.textContent=t(String(error instanceof Error?error.message:error));selectionMessage.hidden=false;return;}
    finally{if(joiningSession===session)joiningSession=undefined;}
  }
  const { scene: template, animations } = loadedModel;
  npcs = createNpcs(template, animations, network?KIRBY_VARIANTS[0]:selected);
  coaster.addKirbyPassengers(template,animations,network?KIRBY_VARIANTS[0]:selected);
  boats.addPassengers(template,animations);
  const playerModel=createPlayerModel(loadedModel,selected,loadedPigeon,false,loadedMetaKnight,loadedSnowball,loadedPlumages);
  if(playerModel.character==='meta-knight')metaKnightReflections?.add(playerModel.model);
  character = new CharacterController(playerModel.model, playerModel.clips);
  character.actor.name='Игрок';
  const spawn=randomSpawn([...(scene.getObjectByName('Four woodland biomes')?.userData.treePositions ?? []),...npcs.map(n=>n.actor.position)]);
  character.actor.position.set(spawn.x,0,spawn.z);
  dayStart=Date.now();dayStartPhase=INITIAL_DAY_PHASE;
  const savedBirds=Object.fromEntries(WILD_PIGEONS.map(id=>[id,pendingSave?.[id]]));
  const savedArena=pendingSave?.player.location==='meta-knight-arena'?{x:pendingSave.player.x,z:pendingSave.player.z,yaw:pendingSave.player.yaw}:undefined;
  sealProgress=structuredClone(network?.room.sealProgress??pendingSave?.seals??newSealProgress());
  soloPortalOverride=pendingSave?.portal?.override;
  lastSealRequest=0;sealHud.reset(sealProgress,network?network.room.metaKnightPortalOpen===true||allSealsCollected(sealProgress):soloPortalOverride??allSealsCollected(sealProgress));
  bread.reset(pendingSave?.bread);lastBreadRequest=0;watermill.setQuest(pendingSave?.millQuest?restoreMillQuest(pendingSave.millQuest,Date.parse(pendingSave.savedAt),Date.now()):newMillQuest(),Date.now());
  if(pendingSave){restoreGame(pendingSave,character,npcs,fruits);dayStartPhase=pendingSave.dayPhase??(pendingSave.night?.75:.25);pendingSave=undefined;}
  mountainLedges.resetPlayer();
  if(network?.resume){restoreNetworkPlayer(character,network.resume);skyTrail.restorePosition(character);mountainLedges.restorePosition(character);}
  watermill.constrain(character.actor.position,character.actor.scale.x);
  treehouse.constrain(character.actor.position,character.actor.scale.x);
  maze.constrain(character.actor.position,character.actor.scale.x);
  home.constrain(character.actor.position,character.actor.scale.x);constrainArena(character.actor.position,character.actor.scale.x);
  for(const npc of npcs){maze.constrain(npc.actor.position,npc.actor.scale.x);constrainNpcOutsideArena(npc.actor.position,npc.actor.scale.x);}
  for(const id of WILD_PIGEONS){
   const npc=new PidgieNpc(loadedPlumages[id],{kind:id,safeGround:pidgieSafeGround,walkGround:pidgieSafeWalk,flightHeight:pidgieFlightHeight,onScare:person=>logPidgieReaction(person,'pidgie-scare',id),onInterest:person=>logPidgieReaction(person,'pidgie-interest',id),people:[character.actor.position,...npcs.map(n=>n.actor.position),...Array.from(network?.actors.values()??[],a=>new THREE.Vector3().fromArray(a.p)),...Array.from(wildBirds.values(),b=>b.npc.actor.position)]});
   const checkpoint=network?.world?.[id]??savedBirds[id];if(checkpoint)npc.applyNetworkState(checkpoint,true);
   wildBirds.set(id,{npc,ready:!network||network.host||!!network.world?.[id],fearSeen:npc.fearCount,joySeen:npc.state==='Joy',helloSeen:npc.state==='Hello'});
  }
  pidgieNpc=wildBirds.get('pidgie')!.npc;pidgieReady=wildBirds.get('pidgie')!.ready;
  if(network){
   pigeonFlock=new PigeonFlock(loadedPlumages,{prepare:setupShadowMaterials,safeGround:pidgieSafeGround,walkGround:pidgieSafeWalk,flightHeight:pidgieFlightHeight,onScare:position=>{
    if(!character||cosmicArena.engaged)return;const listener=character.actor.position;
    void sounds.playPigeonEmoteAt('Fear',position.x-listener.x,position.z-listener.z,followCamera.azimuth);
   }},position=>{
    if(!character||cosmicArena.engaged)return;const listener=character.actor.position;
    void sounds.playPigeonEmoteAt('Hello',position.x-listener.x,position.z-listener.z,followCamera.azimuth);
   });scene.add(pigeonFlock.group);
  }
  viewScale=character.actor.scale.x;
  cameraTarget.set(character.actor.position.x,.9*viewScale,character.actor.position.z);
  followCamera.reset(character.yaw);
  scene.add(character.actor, ...npcs.map(npc => npc.actor),...Array.from(wildBirds.values(),b=>b.npc.actor));
  setupShadowMaterials();
  keys.clear(); pendingTurn = undefined; pendingJump = false; pendingDash = false;
  playing = true;renderer.domElement.style.visibility='';meadowPortal.setWorking(metaKnightPortalReady());startupCard.hidden=true;if(!network)addLocalLog('зашёл на полянку.');
  startButton.disabled=false;startButton.textContent=t('На поляну →');saveButton.hidden=saveMessage.hidden=!!network;saveMessage.textContent='';
  if(!network)try{soloHistory=new SoloHistory(serverUrl,()=>({name:nameInput.value,variant:KIRBY_VARIANTS.indexOf(selected),score:scoreOf(character!),tasksDone:SCORE_ACTIONS.filter(t=>character!.achievements.has(t)).length,tasksTotal:SCORE_ACTIONS.length}),historyDevice);}catch{/* Statistics are optional; the game must always start. */}
  document.body.classList.remove('choosing');
  document.querySelector<HTMLElement>('#character-select')!.hidden = true;
  styleVariant(document.querySelector<HTMLElement>('#player-avatar')!,selected);
  const nameLabel=document.querySelector<HTMLElement>('#player-name')!;nameLabel.textContent=nameInput.value;nameLabel.title=nameInput.value;
  if(network){
    remotePlayers=new RemotePlayers(scene,loadedModel,loadedPigeon,loadedMetaKnight,model=>metaKnightReflections?.add(model),loadedSnowball,loadedPlumages);saveButton.hidden=saveMessage.hidden=true;leaveOnline.hidden=false;onlineRoster.hidden=true;
    knownFruits=new Set(network.room.fruits.flatMap((owner,i)=>owner?[i]:[]));fruits.restore(network.room.fruits.map(Boolean),network.room.fruits.filter(x=>x?.startsWith('npc:')).length);
    fruits.claim=(index,eater)=>network!.event({type:'fruit',index,...(eater===character?{}:{npc:npcs.indexOf(eater as KirbyNpc)})});
    network.onDisconnect=reason=>{tutorial.cancel();if(network?.room.festival&&network.serverNow>=network.room.festival.endsAt){leaveOnline.click();return;}playerHostBadge.hidden=true;keys.clear();stopDragging();playing=false;onlineRoster.textContent=t(reason);onlineRoster.hidden=false;audioPanel.hidden=false;controlsPanel.hidden=false;};
    network.onEmote=(emote,id)=>sounds.playEmote(emote,isPigeonVariant(KIRBY_VARIANTS[network!.actors.get(id)?.variant??0]?.[0]));
    network.onFlowerNote=index=>{musicalFlowers.play(index,performance.now()/1000);playFlowerSound(index);};
    network.onFlowerComplete=()=>{if(character)awardFirst(character,'flowers');};
    network.onNumberNote=digit=>{numberGarden.play(digit,performance.now()/1000);playNumberSound(digit);};
    network.onNumberComplete=()=>{if(character)awardFirst(character,'numbers');};
    network.onStar=()=>{if(character){sounds.playStarPickup();awardFirst(character,'star');character.starBlessed=true;character.activateStarPower();}};
    network.onResize=size=>{if(character)character.resizeTo(size);};
    network.onCentipedeProgress=(points,completed)=>{if(!character)return;character.eventPoints=points;if(completed&&awardFirst(character,'centipede'))sounds.playTaskComplete();};
    network.onKnightVictory=()=>completeKnightVictory();
    network.onCentipedeBump=direction=>{if(character?.takePush(direction[0],direction[1]))sounds.playBoing(.7);};
    network.onHit=(a,target)=>{
      if(!character||typeof target!=='string')return;const yaw=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(a.q)).y;
      if(target==='centipede-ball'){sounds.playBoing(Math.max(0,.7*(1-character.actor.position.distanceTo(new THREE.Vector3().fromArray(a.p))/35)));return;}
      const npc=target.startsWith('npc:')?npcs[Number(target.slice(4))]:undefined;
      if(target===network!.id && !coaster.riding && !boats.riding&&!balloons.riding&&!home.active&&!treehouse.active&&!benches.active&&!trampoline.active&&!skyTrail.active&&!mountainLedges.active){if(fireflies?.riding)fireflies.disembark(true);character.takePush(Math.sin(yaw),Math.cos(yaw));}
      else if(npc&&network!.host)npc.takePush(Math.sin(yaw),Math.cos(yaw));
      const position=npc?.actor.position??(target===network!.id?character.actor.position:remotePlayers?.players.get(target)?.actor.position);
      if(position)sounds.playBoing(Math.max(0,1-position.distanceTo(character.actor.position)/35));
    };
  }
  renderer.domElement.tabIndex = -1;
  renderer.domElement.focus();
  if(savedArena)await cosmicArena.enter(character,savedArena);
  if(generation!==selectionGeneration||!playing)return;
  tutorial.open();
}

function checkCharacterUnlock(){
 if(!character||!playing)return;
 for(const id of WILD_PIGEONS)if(character.achievements.has(pigeonFriendAchievement(id))&&characterUnlocks.unlockPigeon(id)){unlockAnnouncements.push(wildPigeonName(id));updateVariantLocks();}
 if(characterUnlocks.complete(character.achievements)){unlockAnnouncements.push('Бандана');updateVariantLocks();}
 if(unlockAnnouncements.length&&!tutorial.active&&unlockView.element.hidden){const name=unlockAnnouncements.shift()!;unlockView.show(KIRBY_VARIANTS.find(v=>v[0]===name)!);}
}

/** End a session in place; the expensive scenery and loaded models stay reusable. */
function returnToMenu(){
 if(returningToMenu)return;returningToMenu=true;
 try{
  cosmicArena.leave();
  soloHistory?.stop();soloHistory=undefined;playing=false;tutorial.cancel();chat.close();unlockView.hide();clearTutorialInput();touch?.setEnabled(false);
  meadowPortal.setWorking(false);
  network?.close();network=undefined;joiningSession?.close();joiningSession=undefined;
  coaster.disembark();boats.cancel();boats.syncRemoteRiders(new Map());musicalFlowers.reset();
  soloFlowerGame=undefined;flowerGameView.reset();
  soloNumberGame=undefined;numberGarden.reset();numberGameView.reset();
  balloons.reset();home.cancel();benches.cancel();treehouse.cancel();trampoline.cancel();skyTrail.cancel();mountainLedges.cancel();fireflies?.reset();
  prankEffects.beginFrame();prankEffects.update([],Date.now(),()=>undefined,camera.position);
  maze.reset();
  if(character){character.setActivity('Idle');disposeActor(character);}character=undefined;
  for(const npc of npcs)disposeActor(npc);npcs=[];npcSwimming.reset();remotePlayers?.clear();remotePlayers=undefined;
  for(const bird of wildBirds.values())disposeActor(bird.npc);wildBirds.clear();pidgieNpc=undefined;pidgieReady=false;
  pigeonFlock?.dispose();pigeonFlock?.group.removeFromParent();pigeonFlock=undefined;
  npcSnapshots.clear();npcSnapshotHost='';worldRevision=-1;knownFruits.clear();heldResource=undefined;acquiring=false;lastStarRequest=0;appliedRides.clear();rosterSignature='';
  for(const row of remoteStatRows.values())row.remove();remoteStatRows.clear();playerHostBadge.hidden=true;
  coaster.networkBlocked.clear();coaster.networkApply(initialCarts);boats.networkBlocked.clear();
  fruits.claim=undefined;fruits.restore(fruits.fruits.map(()=>false),0);watermill.setQuest(newMillQuest(),Date.now());bread.reset();lastBreadRequest=0;balloonSeed=6173;
  sealProgress=newSealProgress();lastSealRequest=0;sealHud.reset(sealProgress);
  soloPortalOverride=undefined;
  soloCentipede=undefined;centipedeContactKey='';centipedeView.update(undefined,'solo',Date.now(),camera.position,false,'Q');festivalView.reset();
  localLog.length=0;chat.render([],false);wayfinder.syncPlayers([]);wayfinder.selectDestination('');wayfinder.update(camera.position,1,camera);
  interactionOutline.update(undefined);rideHint.textContent='';touch?.setInteraction();hitMessageRemaining=0;combatMessage.hidden=true;greetingCooldown=0;
  settingsToggle.setAttribute('aria-expanded','false');audioPanel.hidden=controlsPanel.hidden=true;onlineRoster.hidden=true;onlineRoster.textContent='';
  saveButton.hidden=saveMessage.hidden=false;saveMessage.textContent='';taskList.update(new Set());
  viewScale=1;cameraTarget.set(0,.9,0);followCamera.reset(0);menuRepeat=0;
  showStartupMenu();
 }finally{returningToMenu=false;}
}

let soloCentipede:CentipedeEvent|undefined;let centipedeContactKey='';
const centipedeView=new CentipedeEventView((stage,volume)=>sounds.playCentipede(stage,volume));scene.add(centipedeView.group);
const festivalView=new StarfallView(()=>sounds.playStarPickup(),()=>{sounds.playTaskComplete();sounds.playTreehouse('cheer');},()=>leaveOnline.click());scene.add(festivalView.group);
function peerPoints(id:string,a:ActorState){return a.fruits+achievementPoints(a.achievements)+(a.eventPoints??0)+(network!.room.festival?.players[id]?.bonus??0);}
function roundFinished(){return !!network?.room.festival&&network.serverNow>=network.room.festival.endsAt;}
function festivalTick(){
 if(!character||!playing)return;
 const now=network?.serverNow??Date.now(),id=network?.id??'solo';
 network?.finishFestivalIfDue();
 if(!network&&!character.festival&&allTasks(character.achievements)&&currentFlowerGame()?.stage!=='celebrate'&&currentNumberGame()?.stage!=='celebrate')character.festival=createStarfall(now,nameInput.value);
 const f=network?.room.festival??character.festival;if(!f)return;
 if(!network){const p=f.players.solo??={name:nameInput.value,variant:KIRBY_VARIANTS.indexOf(selected),base:0,fruits:0,size:1,bonus:0,collected:[]};p.base=character.fruitsEaten+achievementPoints(character.achievements)+character.eventPoints;p.fruits=character.fruitsEaten;p.size=character.savedSize;p.numbersCompleted=character.achievements.has('numbers');finishStarfall(f,now);}
 character.bonusPoints=f.players[id]?.bonus??0;
 festivalView.update(f,id,now,character.actor.position,character.actor.scale.x,camera,!!network,scene.getObjectByName('Four woodland biomes')?.userData.treePositions??[],index=>{if(network)network.event({type:'festival-star',index});else {collectStar(f,id,index,now);character!.bonusPoints=f.players[id].bonus;}});
 if(network&&now>=f.endsAt){tutorial.cancel();chat.close();keys.clear();pendingBoard=pendingJump=pendingAttack=false;pendingEmote=undefined;stopDragging();interactionOutline.update(undefined);rideHint.textContent='';sounds.updateRide(false,coaster.rideMotion);if(now>=f.endsAt+RESULTS_MS)leaveOnline.click();}
}
const fpsCounter=new FpsCounter();
document.addEventListener('visibilitychange',()=>{if(document.hidden)fpsCounter.sample(performance.now(),false);});
const fpsLabel=document.createElement('span');fpsLabel.id='fps-counter';fpsLabel.textContent='—';fpsLabel.title=t('Кадров в секунду');fpsLabel.setAttribute('aria-label',t('Кадров в секунду'));document.body.append(fpsLabel);
let previousTime = performance.now();
let lastDialUpdate=-Infinity;
let greetingCooldown=0;
function navigateSettings(direction:number, adjust:number, confirm:boolean) {
  const elements=Array.from(document.querySelectorAll<HTMLElement>('#audio-panel button, #audio-panel input, #audio-panel select, #destination-select, #tasks-toggle')).filter(element=>element.getClientRects().length>0);
  if(!elements.length)return;
  let index=elements.indexOf(document.activeElement as HTMLElement);
  if(direction || index<0) {index=index<0?0:(index+direction+elements.length)%elements.length;elements[index].focus();}
  const element=elements[index];
  if((adjust||confirm) && element instanceof HTMLInputElement && element.type==='checkbox') {
    element.click();
  } else if(adjust && element instanceof HTMLSelectElement) {
    element.selectedIndex=(element.selectedIndex+adjust+element.options.length)%element.options.length;
    element.dispatchEvent(new Event('change'));
  } else if(adjust && element instanceof HTMLInputElement && element.type==='range') {
    element.value=String(Math.max(0,Math.min(100,Number(element.value)+adjust*5)));
    element.dispatchEvent(new Event('input'));
  } else if(adjust && element.getAttribute('role')==='radio') {
    element.dispatchEvent(new KeyboardEvent('keydown',{key:adjust>0?'ArrowRight':'ArrowLeft',bubbles:true}));
  }
  if(confirm && element instanceof HTMLButtonElement)element.click();
}
const controlHints=[...document.querySelectorAll<HTMLElement>('[data-controls]')];
let controlMode='';
let sceneProfiler:import('./scene-profiler').SceneProfiler|undefined;
if(new URLSearchParams(location.search).get('perf')==='1')void import('./scene-profiler').then(({SceneProfiler})=>{sceneProfiler=new SceneProfiler(renderer,scene,camera,()=>playing&&!network,shadows);});
renderer.setAnimationLoop((time: number) => {
  if(!startupComplete||document.body.classList.contains('choosing')){previousTime=time;return;}
  if(sceneProfiler?.busy){previousTime=time;fpsCounter.sample(time,false);return;}
  meadowWind.value=time*.001;
  const profileStart=sceneProfiler?performance.now():0;
  prankEffects.beginFrame();
  const dt = Math.max(0,Math.min((time - previousTime) / 1000, .05));
  previousTime = time;
  const fps=fpsCounter.sample(time,!document.hidden);if(fps!==undefined)fpsLabel.textContent=String(fps);
  const pad=gamepad.poll();
  const usingPad=!chat.open && !document.body.classList.contains('loading') && gamepad.input.active!=='keyboard';
  const controlScheme=gamepad.input.active!=='keyboard'?'gamepad':mobile?'touch':'keyboard';
  const tutorialWasOpen=tutorial.active;
  tutorial.setScheme(controlScheme);
  if(usingPad&&tutorialWasOpen)tutorial.gamepad(pad.pressed);
  if(controlScheme!==controlMode){controlMode=controlScheme;for(const element of controlHints)element.hidden=element.dataset.controls!==controlScheme;}
  if(!startupMessage.dataset.error){startupMessage.hidden=!usingPad;setText(startupMessage,usingPad?'Геймпад: ↑ / ↓ — выбрать · ← / → — язык · A — подтвердить':'');}
  if(usingPad && !tutorialWasOpen && pad.pressed.has(9) && playing && !roundFinished())settingsToggle.click();
  const settingsOpen=!audioPanel.hidden || chat.open || roundFinished() || tutorial.active || tutorialWasOpen;
  emoteWheel.setPigeon(!!character?.isPigeon);touch?.setPigeon(!!character?.isPigeon);
  touch?.setEnabled(playing&&!settingsOpen&&!usingPad&&!document.hidden);
  const usingTouch=!!touch&&!usingPad;
  const touchBlocked=settingsOpen||!!touch?.choosing||!playing||document.hidden;
  // Mounts and the treehouse deck retain their own existing turning physics.
  const steeringTurnRate=fireflies?.riding||treehouse.active?Math.PI*.55:TURN_RATE;
  const motion=usingTouch&&!touchBlocked&&character?touchMotion(touch!.x,touch!.y,followCamera.azimuth,character.yaw,dt,steeringTurnRate):{forward:false,steer:0};
  if(usingPad&&festivalView.results.open&&pad.pressed.has(0))leaveOnline.click();
  const wasChoosing=!playing;
  let wheelUsed=false;
  if(usingPad && playing && !settingsOpen && !document.hidden && document.hasFocus()){
    const wasBlocked=emoteWheel.blocksMovement;
    const picked=emoteWheel.update(pad.held.has(4),pad.x,pad.y,pad.held.has(1));
    wheelUsed=wasBlocked||emoteWheel.blocksMovement||pad.held.has(4);
    if(picked)pendingEmote=picked;
  }else emoteWheel.close();
  menuRepeat=Math.max(0,menuRepeat-dt);
  const horizontal=pad.held.has(15)?1:pad.held.has(14)?-1:Math.abs(pad.x)>.35?Math.sign(pad.x):0;
  const vertical=pad.held.has(13)?1:pad.held.has(12)?-1:Math.abs(pad.y)>.35?Math.sign(pad.y):0;
  if(usingPad && !tutorialWasOpen && (!playing || settingsOpen)) {
    const repeat=(horizontal!==0 || vertical!==0) && menuRepeat===0;
    if(repeat)menuRepeat=.22;
    if(!horizontal && !vertical)menuRepeat=0;
    if(!playing)navigateCharacterMenu(pad,horizontal,vertical,repeat);
    else {
      if(pad.pressed.has(1))settingsToggle.click();
      else if(repeat || pad.pressed.has(0))navigateSettings(repeat?vertical:0,repeat?horizontal:0,pad.pressed.has(0));
    }
  }
  const padKeys=new Set<string>();
  if(usingPad && !settingsOpen && !wasChoosing && !wheelUsed) {
    if(pad.pressed.has(14))wayfinder.cycle(-1);
    else if(pad.pressed.has(15))wayfinder.cycle(1);
    if(pad.y<-.05)padKeys.add('KeyW');if(pad.y>.05)padKeys.add('KeyS');
    if(pad.pressed.has(0))padKeys.add('Space');if(pad.pressed.has(2))padKeys.add('KeyQ');
    if(pad.pressed.has(3))pendingBoard=true;if(pad.held.has(3))padKeys.add('KeyE');
    followCamera.zoom((Number(pad.held.has(13))-Number(pad.held.has(12)))*dt*600);
  }
  const editingUi=document.activeElement instanceof HTMLElement && ['SELECT','INPUT','TEXTAREA'].includes(document.activeElement.tagName);
  const mouseTurning=!usingPad && !usingTouch && rightMouseHeld && document.pointerLockElement===canvas && !settingsOpen;
  const held=(key:string)=>settingsOpen || wheelUsed || touch?.choosing || (!usingPad && !usingTouch && editingUi)?false:usingPad?padKeys.has(key):usingTouch?(key==='KeyW'?motion.forward:false):keys.has(key)||(key==='KeyW'&&mouseTurning&&leftMouseHeld);
  const dashPressed=!settingsOpen&&!wheelUsed&&!touchBlocked&&!document.hidden&&document.hasFocus()&&(usingPad?pad.pressed.has(1):pendingDash);
  pendingDash=false;
  knightDashHud.update(character,playing&&!settingsOpen&&!cosmicArena.loading,usingPad?'gamepad':usingTouch?'touch':'keyboard',usingTouch?touch:undefined);
  const mouseSteer=usingTouch?motion.steer:mouseTurning?THREE.MathUtils.clamp(mouseTurn/Math.max(.0001,steeringTurnRate*dt),-1,1):undefined;
  if(mouseTurning&&mouseSteer!==undefined)mouseTurn-=mouseSteer*steeringTurnRate*dt;
  if(network?.room.sealProgress)sealProgress=network.room.sealProgress;
  if(sealHud.update(sealProgress,metaKnightPortalReady(),time,playing&&!settingsOpen&&!cosmicArena.loading&&!cosmicArena.engaged&&!roundFinished()))sounds.playTaskComplete();
  meadowPortal.setWorking(metaKnightPortalReady());meadowPortal.update(time*.001);
  if(character&&(cosmicArena.active||cosmicArena.loading)){
    syncNetworkWorld(dt);tickMeadowWhileAway(dt);
    if(roundFinished()){cosmicArena.leave();return;}
    if(cosmicArena.active){
      if(pendingBoard&&!settingsOpen&&!cosmicArena.engaged){cosmicArena.interact();if(!cosmicArena.active)return;}
      if(pendingEmote&&!settingsOpen)character.startEmote(pendingEmote);
      const cancelDuel=!settingsOpen&&!wheelUsed&&!touchBlocked&&!document.hidden&&document.hasFocus()?(usingTouch?touch?.interactionHeld?'touch':undefined:held('KeyE')?usingPad?'gamepad':'keyboard':undefined):undefined;
      const moveStick=settingsOpen||wheelUsed||touchBlocked?{x:0,y:0}:usingPad?{x:pad.x,y:pad.y}:usingTouch?Math.hypot(touch!.x,touch!.y)<.18?{x:0,y:0}:{x:touch!.x,y:touch!.y}:undefined;
      cosmicArena.update(dt,time*.001,character,{cancelDuel,moveStick,dashPressed,steer:usingPad?(!settingsOpen&&!wheelUsed?stickSteering(pad.x,pad.y):0):mouseSteer,attack:held('KeyQ')||(!settingsOpen&&pendingAttack),attackPressed:!settingsOpen&&(pendingAttack||usingPad&&pad.pressed.has(2)),forward:held('KeyW'),backward:held('KeyS'),jump:held('Space')||(!settingsOpen&&pendingJump),jumpPressed:!settingsOpen&&(pendingJump||usingPad&&pad.pressed.has(0)),left:held('KeyA')||pendingTurn==='KeyA',right:held('KeyD')||pendingTurn==='KeyD'},usingPad&&!settingsOpen&&!wheelUsed?pad.cameraX:Number(held('ArrowRight'))-Number(held('ArrowLeft')),usingPad&&!settingsOpen&&!wheelUsed?pad.cameraY:Number(held('ArrowUp'))-Number(held('ArrowDown')),(dragPointer!==undefined&&dragMode==='camera')||(usingTouch&&!touchBlocked&&!!touch?.looking),settingsOpen);
      const hint=cosmicArena.controlsHint(usingPad?'Y':usingTouch?t('Действие'):'E',usingPad?'X':usingTouch?t('Толчок'):'Q');
      setText(rideHint,hint);rideHint.dataset.hold=String(cosmicArena.engaged);rideHint.style.setProperty('--interaction-progress',`${cosmicArena.cancelProgress*100}%`);touch?.setInteraction(cosmicArena.primaryActionLabel,cosmicArena.engaged,cosmicArena.cancelProgress);touch?.setAttackHint(cosmicArena.secondaryActionLabel);
      sounds.update(dt,character,[],followCamera.azimuth);
    }
    pendingBoard=pendingAttack=pendingJump=false;pendingTurn=undefined;pendingEmote=undefined;
    updateNetwork(dt);cosmicArena.routeRemotes(remotePlayers?.players.entries()??[]);
    const knightBattle=network?.room.knightBattle,knightPlayer=knightBattle?.players[network?.id??''];
    if(knightBattle?.stage==='won'&&knightPlayer&&!knightPlayer.withdrawn&&knightPlayer.hp>0&&knightPlayer.hits+knightPlayer.reflects>0)completeKnightVictory();
    checkCharacterUnlock();chat.render(network?.log??localLog,!audioPanel.hidden);festivalTick();cosmicArena.render();
    return;
  }
  if(character&&playing&&!settingsOpen&&metaKnightPortalReady()&&insideMetaKnightPortal(character.actor.position)&&sealActor(character).available){void cosmicArena.enter(character);return;}
  touch?.setAttackHint(undefined);
  if (character && !roundFinished()) {
    syncNetworkWorld(dt);
    const carryingBread=bread.holds(network?.id??'solo');
    // One clock for every activity, including rides, sleep and swimming.
    character.fruitBoost.update(dt);
    const achievementsBefore=character.achievements.size,pointsBefore=achievementPoints(character.achievements);
    const flowersBefore=character.achievements.has('flowers');
    const numbersBefore=character.achievements.has('numbers');
    watermill.tickQuest(network?.serverNow??Date.now(),millActor(character),sendMill,!!network);
    if(watermill.quest.stage==='running'&&watermill.quest.owner===(network?.id??'solo'))awardFirst(character,'millQuest');
    const previousX = character.actor.position.x;
    const previousZ = character.actor.position.z;
    const previousYaw = character.yaw;
    const previousPosition=playerPrevious.copy(character.actor.position);
    character.positionConstraint=mountainLedges.constrainTravel;
    const mountainWasActive=mountainLedges.active;
    mountainLedges.update(dt,[character,...(remotePlayers?.players.values()??[])],!network||network.host,character);
    const skyWasActive=skyTrail.active||mountainWasActive;
    boats.update(dt,boatTime(),camera.position);
    if(pendingBoard)void interactOnline();
    if(pendingEmote && !fireflies?.riding && !home.active && !coaster.riding && !boats.riding && !treehouse.active && !benches.active && !balloons.riding && !trampoline.active && !skyTrail.active&&!mountainLedges.active && character.startEmote(pendingEmote)){sounds.playEmote(pendingEmote,character.isPigeon);if(network)network.event({type:'emote',emote:pendingEmote});else addLocalLog(emoteMessage(pendingEmote)!);}
    pendingEmote=undefined;
    const treehouseWasActive=treehouse.active;
    const balloonWasActive=balloons.riding;
    const homeWasActive=home.active,bedOwner=network?.room.locks['home:0'];
    home.update(dt,bedOwner&&bedOwner!==network?.id?remotePlayers?.players.get(bedOwner):undefined);
    if(!carryingBread && !character.roll.active && !skyTrail.active&&!mountainLedges.active && !fireflies?.riding && !homeWasActive && !coaster.riding && !boats.riding && !balloonWasActive && !treehouseWasActive && !benches.active && (pendingJump || (usingPad && !wheelUsed && pad.pressed.has(0))))trampoline.start(character);
    skyTrail.update(dt,character);
    const trampolineWasActive=trampoline.active;trampoline.update(dt);
    balloons.update(dt,!network||network.host?npcs:[],character,constrainNpc);
    const benchWasActive=benches.active;benches.update(dt);
    if(!benchWasActive)treehouse.update(dt,{steer:usingPad ? (!settingsOpen && !wheelUsed?stickSteering(pad.x,pad.y):0) : mouseSteer,forward:held('KeyW'),backward:held('KeyS'),left:held('KeyA'),right:held('KeyD')},pendingJump || (usingPad && !wheelUsed && pad.pressed.has(0)));
    if(!fireflies?.riding && !homeWasActive && !coaster.riding && !boats.riding && !treehouseWasActive && !benchWasActive && !balloonWasActive && !trampolineWasActive && !skyWasActive && !skyTrail.active&&!mountainLedges.active)character.update(dt, { dashPressed:dashPressed&&!maze.contains(character.actor.position,2),steer:usingPad ? (!settingsOpen && !wheelUsed?stickSteering(pad.x,pad.y):0) : mouseSteer, attack: !carryingBread && (held('KeyQ') || pendingAttack), attackPressed: !carryingBread&&!settingsOpen&&(pendingAttack||usingPad&&pad.pressed.has(2)), forward: held('KeyW'), backward: held('KeyS'), jump: !maze.contains(character.actor.position,2) && (held('Space') || pendingJump), jumpPressed: !maze.contains(character.actor.position,2)&&!settingsOpen&&(pendingJump||usingPad&&pad.pressed.has(0)), left: held('KeyA') || pendingTurn === 'KeyA', right: held('KeyD') || pendingTurn === 'KeyD' });
    if(fireflies?.riding)fireflies.moveRider(dt,{forward:held('KeyW'),backward:held('KeyS'),left:held('KeyA'),right:held('KeyD'),steer:usingPad?(!settingsOpen&&!wheelUsed?stickSteering(pad.x,pad.y):0):mouseSteer});
    coaster.update(dt,camera.position);
    if(!homeWasActive && !coaster.riding && !boats.riding && !treehouse.active && !balloons.riding && !trampolineWasActive && !skyWasActive && !skyTrail.active&&!mountainLedges.active){watermill.constrain(character.actor.position,character.actor.scale.x);treehouse.constrain(character.actor.position,character.actor.scale.x);home.constrain(character.actor.position,character.actor.scale.x);constrainArena(character.actor.position,character.actor.scale.x);flowerGameView.button.constrain(character.actor.position,character.actor.scale.x);numberGarden.constrain(character.actor.position,character.actor.scale.x);}
    if(!homeWasActive && !coaster.riding && !boats.riding && !treehouse.active && !balloons.riding && !trampolineWasActive && !skyWasActive && !skyTrail.active&&!mountainLedges.active){
      maze.constrain(character.actor.position,character.actor.scale.x,groundPrevious.set(previousX,0,previousZ));
      if(maze.contains(character.actor.position,2) && character.flight.active){character.setActivity('Idle');character.actor.position.y=0;}
    }
    const onSkyTrail=skyTrail.handles(character)&&!fireflies?.riding&&!homeWasActive&&!coaster.riding && !boats.riding&&!treehouseWasActive&&!benchWasActive&&!balloonWasActive&&!trampolineWasActive;
    const freeMountainMovement=!fireflies?.riding&&!homeWasActive&&!coaster.riding&&!boats.riding&&!treehouseWasActive&&!benchWasActive&&!balloonWasActive&&!trampolineWasActive&&!skyWasActive&&!skyTrail.active&&!mountainLedges.active;
    const onMountainLedges=freeMountainMovement&&mountainLedges.handles(character);
    const skySurface=character.surfaceY;
    ponds.apply(character,groundPrevious.set(previousX,0,previousZ),!onMountainLedges&&!onSkyTrail&&!fireflies?.riding && !homeWasActive && !coaster.riding && !boats.riding && !treehouseWasActive && !benchWasActive && !balloonWasActive && !trampolineWasActive && !skyWasActive && !skyTrail.active&&!mountainLedges.active);
    if(!carryingBread)fountain.bathe(dt,character);
    if(onSkyTrail||onMountainLedges)character.surfaceY=skySurface;
    if(onSkyTrail&&!skyWasActive&&!skyTrail.active&&!mountainLedges.active)skyTrail.apply(character,previousPosition,dt);
    mountainLedges.apply(character,previousPosition,dt,freeMountainMovement&&!onSkyTrail);
    arenaCentipede?.collision.apply(character,previousPosition,dt,!onMountainLedges&&!onSkyTrail&&!fireflies?.riding&&!homeWasActive&&!coaster.riding&&!boats.riding&&!treehouseWasActive&&!benchWasActive&&!balloonWasActive&&!trampolineWasActive);
    sounds.updateWater(dt,character.swimming,Math.hypot(character.actor.position.x-previousX,character.actor.position.z-previousZ)>.002,!fireflies?.riding && !homeWasActive && !coaster.riding && !boats.riding && !treehouseWasActive && !benchWasActive && !balloonWasActive && !trampolineWasActive && !skyWasActive && !skyTrail.active&&!mountainLedges.active);
    fireflies?.syncRider(dt);
    character.finishPigeonGroundMovement(dt,previousX,previousZ);
    const breadNow=network?.serverNow??Date.now();
    if(!network)bread.state=advanceBread(bread.state,breadNow,mountainLedges.networkState());
    if(canPickBread(bread.state,breadActor(character),breadNow,Array.from(wildBirds.values(),b=>b.npc.networkState()))&&(!network||breadNow-lastBreadRequest>350)){lastBreadRequest=breadNow;sendBread({kind:'pick'});}
    const sealCollector=sealActor(character);
    const nearbySeal=META_KNIGHT_SEAL_SITES.find(site=>(site.id!=='treehouse'||treehouse.onBalcony(character!))&&canCollectSeal(sealProgress,site.id,sealCollector));
    if(nearbySeal&&(!network||breadNow-lastSealRequest>500)){
     lastSealRequest=breadNow;
     if(network)network.event({type:'seal',id:nearbySeal.id});
     else{
      const next=collectSeal(sealProgress,nearbySeal.id,sealCollector,breadNow);
      if(next!==sealProgress){
       sealProgress=next;localLog.push(...metaKnightSealLogs(nameInput.value,Object.keys(next.collected).length));
       if(localLog.length>10)localLog.splice(0,localLog.length-10);
      }
     }
    }
    const availableInteraction=resolveInteraction(character);
    const candidate=network?resourceKey(character):undefined;
    const occupied=!!(candidate&&network?.room.locks[candidate]&&network.room.locks[candidate]!==network.id);
    const interaction=occupied?'Занято другим игроком':availableInteraction?.text;
    touch?.setInteraction(!occupied&&interaction?.includes('E —')?interaction:undefined);
    interactionOutline.update(playing && !settingsOpen && !wheelUsed && !occupied ? availableInteraction?.target : undefined);
    setText(rideHint,interaction ? t(interaction).replace('E —',usingPad?'Y —':usingTouch?t('Действие —'):'E —') : (maze.contains(character.actor.position,5) ? (character.starRemaining>0?`★ Скорость и прыжок ×2: ${Math.ceil(character.starRemaining)} с`:character.starCooldown>0?`★ Новая звезда через ${Math.ceil(character.starCooldown)} с`:'Найди звезду в глубине лабиринта · здесь только пешком') : ''));
    const movingOrTurning = previousX !== character.actor.position.x || previousZ !== character.actor.position.z || previousYaw !== character.yaw;

    followCamera.update(dt, character.yaw, movingOrTurning,
      usingPad && !settingsOpen && !wheelUsed ? pad.cameraX : Number(held('ArrowRight')) - Number(held('ArrowLeft')),
      usingPad && !settingsOpen && !wheelUsed ? pad.cameraY : Number(held('ArrowUp')) - Number(held('ArrowDown')), (dragPointer !== undefined && dragMode==='camera') || (usingTouch && !touchBlocked && (!!touch?.looking || !!touch?.moving)));
    pendingBoard = false;
    pendingAttack = false;
    pendingTurn = undefined;
    pendingJump = false;
    const position = character.actor.position;
    viewScale = THREE.MathUtils.lerp(viewScale, (boats.riding||coaster.riding||balloons.riding||home.active)?Math.min(1,character.actor.scale.x):character.actor.scale.x, 1 - Math.exp(-3 * dt));
    cameraLook.set(position.x, position.y + .9 * viewScale, position.z);
    cameraTarget.lerp(cameraLook, 1 - Math.exp(-8 * dt));
    const people=[character.actor.position,...Array.from(remotePlayers?.players.values()??[],p=>p.actor.position)];
    const neighbors = [...people, ...npcs.map(npc => npc.actor.position)];
    greetingCooldown=Math.max(0,greetingCooldown-dt);
    if((!network||network.host) && !coaster.riding && !boats.riding && greetingCooldown===0) {
      const nearby=[...npcs].sort((a,b)=>a.actor.position.distanceToSquared(position)-b.actor.position.distanceToSquared(position));
      for(const npc of nearby){const person=people.find(p=>npc.actor.position.distanceTo(p)<24);if(person&&npc.greet(person)){greetingCooldown=3;break;}}
    }
    if(!network||network.host)npcSwimming.update(dt,npcs,constrainNpc);
    fireflies?.prepareNpcs(npcs,!network||network.host,dt,character.actor.position);
    if(!network||network.host)for (const npc of npcs) {
      npc.fruitBoost.update(dt);
      npcPrevious.copy(npc.actor.position);
      if(!balloons.owns(npc))npc.update(dt,neighbors,constrainNpc);
      const onFoot=npc.state!=='Balloon'&&npc.fireflyIndex===undefined;
      if(onFoot)constrainNpc(npc.actor.position,npc.actor.scale.x,npcPrevious);
      ponds.apply(npc,npcPrevious,onFoot);npc.syncSwimming();
    }
    if(playing)tickWildPigeons(dt,people,[{id:network?.id??'solo',position:character.actor.position,hasBread:bread.holds(network?.id??'solo'),isPigeon:character.isPigeon},...Array.from(network?.actors??[],([id,actor])=>({id,position:remotePlayers?.players.get(id)?.actor.position??new THREE.Vector3().fromArray(actor.p),hasBread:bread.holds(id),isPigeon:isPigeonVariant(KIRBY_VARIANTS[actor.variant]?.[0])}))],true);
    centipedeTick();
    if(!network){soloFlowerGame=advanceFlowerGame(soloFlowerGame,Date.now(),[flowerActor(character)]);if(soloFlowerGame?.winners.includes('solo'))awardFirst(character,'flowers');}
    if(!network){soloNumberGame=advanceNumberGame(soloNumberGame,Date.now(),[flowerActor(character)]);if(soloNumberGame?.winners.includes('solo'))awardFirst(character,'numbers');}
    if(character.attackHit&&!network&&pushCentipede(soloCentipede,centipedeActor(character),Date.now())){character.attackHit=false;centipedeSoloRewards();}
    if(character.attackHit&&!network){const index=millPushTarget(watermill.quest,millActor(character));if(index>=0){sendMill({kind:'push',index});character.attackHit=false;}}
    if(network && character.attackHit){network.event({type:'hit'});character.attackHit=false;}
    if(!network&&resolveAttack(character,npcs))sounds.playBoing(.8);
    const fireflyPickup=fireflies?.fruitPickupPosition;
    const eaten = fruits.update(dt, character, !network||network.host?npcs:[], coaster.riding || boats.riding || treehouse.active || benches.active || balloons.riding || trampoline.active || skyTrail.active || home.active || (!!fireflies?.riding && !fireflyPickup),fireflyPickup);
    sounds.update(dt, character, npcs, followCamera.azimuth);
    sounds.updateRide(coaster.riding,coaster.rideMotion);
    sounds.updateBoat(dt,boats.riding);
    setText(sizeValue,`${Math.round(character.savedSize * 100)}%`);
    fruitSpeedValue.hidden=character.fruitBoost.remaining===0;
    setText(fruitSpeedValue,character.fruitBoost.remaining>0?`Фрукты: скорость ${Math.round(character.fruitBoost.multiplier*100)}% · ${Math.ceil(character.fruitBoost.remaining)} с`:'');
    setText(npcFruitValue,String(npcs.reduce((sum,npc)=>sum+scoreOf(npc),0)));
    setText(remainingFruitValue,String(fruits.onMap));
    if (eaten) {
      showFruitPickup(eaten.type);
    }
    if(network){character.starCooldown=Math.max(0,(network.room.starAt-network.serverNow)/1000);if(!carryingBread && character.starCooldown===0 && performance.now()-lastStarRequest>1000 && character.actor.position.y<.5 && Math.hypot(character.actor.position.x-MAZE_SITE.x-maze.rewardPosition.x,character.actor.position.z-MAZE_SITE.z-maze.rewardPosition.z)<2){network.event({type:'star'});lastStarRequest=performance.now();}}
    if(maze.update(dt,character,!carryingBread && !network && !coaster.riding && !boats.riding && !balloons.riding && !treehouse.active && !benches.active)){
      sounds.playStarPickup();setText(combatMessage,'★ Звезда найдена! Скорость и прыжок ×2 на 30 секунд!');hitMessageRemaining=5;
    }
    if(character.achievements.size>achievementsBefore){const soundsCount=character.achievements.size-achievementsBefore-Number(!flowersBefore&&character.achievements.has('flowers'))-Number(!numbersBefore&&character.achievements.has('numbers'));if(soundsCount>0)sounds.playTaskComplete(soundsCount);setText(combatMessage,`+${achievementPoints(character.achievements)-pointsBefore} · Приключение выполнено!`);hitMessageRemaining=3;}
    taskList.update(character.achievements);
    setText(fruitValue,String(scoreOf(character)));
    const playerPoints=scoreOf(character),teamPoints=npcs.reduce((sum,npc)=>sum+scoreOf(npc),0);
    let playerRank=1+Number(teamPoints>playerPoints),teamRank=1+Number(playerPoints>teamPoints);
    if(network)for(const [id,actor] of network.actors){const points=peerPoints(id,actor);playerRank+=Number(points>playerPoints);teamRank+=Number(points>teamPoints);}
    setText(playerPlace,`${playerRank}.`);setText(npcPlace,`${teamRank}.`);
    const [leader,runnerUp]=teamPoints>playerPoints?[npcStatsRow,playerStatsRow]:[playerStatsRow,npcStatsRow];
    if(!network && leader.nextElementSibling!==runnerUp)runnerUp.parentElement!.insertBefore(leader,runnerUp);
    hitMessageRemaining = Math.max(0, hitMessageRemaining - dt);
    combatMessage.hidden = hitMessageRemaining === 0;
  }
  else if(!character) {mountainLedges.update(dt);boats.update(dt,boatTime(),camera.position);skyTrail.update(dt);coaster.update(dt,camera.position);treehouse.update(dt);balloons.update(dt);maze.update(dt);trampoline.update(dt);}
  const { azimuth, elevation, distance } = followCamera;
  camera.position.set(cameraTarget.x + distance * viewScale * Math.cos(elevation) * Math.sin(azimuth), cameraTarget.y + distance * viewScale * Math.sin(elevation), cameraTarget.z + distance * viewScale * Math.cos(elevation) * Math.cos(azimuth));
  if(character&&mountainLedges.handles(character))mountainLedges.constrainCamera(camera.position,cameraTarget);
  else constrainToMeadow(camera.position, .5);
  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld();
  if(home.dogHouse.update(dt,camera.position)&&playing&&character){
    home.dogHouse.getWorldPosition(dogSoundPosition);
    sounds.playDogBark(dogSoundPosition.x-character.actor.position.x,dogSoundPosition.z-character.actor.position.z,azimuth);
  }
  wayfinder.syncPlayers(network ? Array.from(network.actors,([id,actor])=>[id,remotePlayers?.renderedStates.get(id)??actor] as const) : []);
  if(character)wayfinder.update(character.actor.position,character.actor.scale.x,camera);
  const lightTime=daylight(currentDayPhase());home.night=lightTime.night>.5;home.nightAmount=lightTime.night;
  const {day,night,twilight}=lightTime;
  (scene.background as THREE.Color).copy(daySky).lerp(nightSky,night).lerp(sunsetSky,twilight*.65);
  (scene.fog as THREE.Fog).color.copy(dayFog).lerp(nightFog,night).lerp(sunsetFog,twilight*.7);
  celestialLighting.update(lightTime);
  metaKnightReflections?.update(lightTime);
  updateTreeShadows(lightTime);
  shadows.update(time/1000);
  renderer.toneMappingExposure=1+day*.2;
  // The dial completes one turn in ten minutes; 10 Hz is already subpixel.
  if(time-lastDialUpdate>=100){lastDialUpdate=time;timeNeedle.setAttribute('transform',`rotate(${lightTime.phase*360} 32 32)`);const label=t(lightTime.label);if(timeDial.title!==label){timeDial.title=label;timeDial.setAttribute('aria-label',t(`Время суток: ${lightTime.label}`));}}
  updateSky(dt,camera,lightTime);fireflies?.update(dt,night,camera.position);
  if(playing&&(!network||network.host))fireflies?.syncNpcRiders(npcs,true,dt);
  sounds.updateFireflyBuzz(character ? cosmicArena.active?cosmicArena.fireflyBuzz(character.actor.getWorldPosition(new THREE.Vector3())):fireflies?.buzzLevel(character.actor.position)??0 : 0);
  arenaCentipede?.update(boatTime(),camera.position,currentCentipede(),network?.serverNow??Date.now());
  ponds.update(dt);
  fountain.update(dt,lightTime.day,camera);
  musicalFlowers.update(performance.now()/1000,camera);
  numberGarden.update(performance.now()/1000,advanceNumberGame(currentNumberGame(),network?.serverNow??Date.now()),camera);
  seals.forEach((seal,index)=>{seal.active=!sealProgress.collected[META_KNIGHT_SEAL_SITES[index].id];seal.update(time/1000,camera.position);});
  sealLocations.update(camera.position);
  updateNetwork(dt);
  clearPigeonCarryPoses();
  watermill.update(dt,watermill.quest.owner===(network?.id??'solo')?character?.actor:remotePlayers?.players.get(watermill.quest.owner)?.actor);
  const breadActors=new Map<string,THREE.Object3D>();if(character)breadActors.set(network?.id??'solo',character.actor);for(const [id,c] of remotePlayers?.players??[])breadActors.set(id,c.actor);
  bread.update(network?.serverNow??Date.now(),breadActors);
  for(const loaf of bread.loaves)preparedShadows.prepareBread(loaf);
  checkCharacterUnlock();
  festivalTick();
  const boss=currentCentipede();const bossNow=network?.serverNow??Date.now();
  centipedeView.update(boss,network?.id??'solo',bossNow,character?.actor.position??camera.position,playing&&!settingsOpen&&festivalView.hud.hidden,usingPad?'X':usingTouch?'Толчок':'Q',camera,network?100:0,arenaCentipede?.interactionTarget(boss));
  if(!centipedeView.hud.hidden)combatMessage.hidden=true;
  const hearingBoss=playing&&!roundFinished()&&boss?.stage!=='rest'&&!!boss?.players[network?.id??'solo']&&!!character&&Math.hypot(character.actor.position.x-BOSS_ARENA.x,character.actor.position.z-BOSS_ARENA.z)<BOSS_ARENA.radius+8;
  music.setEvent(hearingBoss?(boss!.stage==='celebrate'?'celebrate':true):false);
  const flowerGame=advanceFlowerGame(currentFlowerGame(),bossNow);
  const hearingFlowers=playing&&!roundFinished()&&!!flowerGame&&!!character&&Math.hypot(character.actor.position.x-MUSICAL_FLOWER_SITE.x,character.actor.position.z-MUSICAL_FLOWER_SITE.z)<MUSICAL_FLOWER_SITE.radius+10;
  const numberGame=advanceNumberGame(currentNumberGame(),bossNow);
  const hearingNumbers=playing&&!roundFinished()&&!!numberGame&&!!character&&Math.abs(character.actor.position.x-NUMBER_GARDEN_SITE.x)<NUMBER_GARDEN_SITE.halfWidth+10&&Math.abs(character.actor.position.z-NUMBER_GARDEN_SITE.z)<NUMBER_GARDEN_SITE.halfDepth+10;
  music.updateDucking(hearingFlowers||hearingNumbers,dt);
  millHud.update(watermill.quest,network?.id??'solo',network?.serverNow??Date.now(),usingPad?'X':usingTouch?'«Толчок»':'Q',usingPad?'Y':usingTouch?'«Действие»':'E',playing&&!settingsOpen&&festivalView.hud.hidden&&centipedeView.hud.hidden);
  flowerGameView.update(flowerGame,network?.id??'solo',bossNow,character?.actor.position??camera.position,playing&&!settingsOpen&&festivalView.hud.hidden&&centipedeView.hud.hidden,playing&&!roundFinished());
  if(!flowerGameView.hud.hidden){millHud.element.hidden=true;combatMessage.hidden=true;}
  numberGameView.update(numberGame,network?.id??'solo',bossNow,character?.actor.position??camera.position,playing&&!settingsOpen&&festivalView.hud.hidden&&centipedeView.hud.hidden&&flowerGameView.hud.hidden,playing&&!roundFinished());
  if(!numberGameView.hud.hidden){millHud.element.hidden=true;combatMessage.hidden=true;}
  chat.render(network?.log??localLog,!audioPanel.hidden);
  fruits.fruits.forEach((fruit,i)=>updateVisibility(fruit.object,camera.position,fruits.isVisible(i),false,FRUIT_DISTANCE));
  fruits.syncInstances();
  for(const passenger of decorativeCharacters)updateVisibility(passenger,camera.position);
  for(const npc of npcs)updateVisibility(npc.actor,camera.position);
  for(const bird of wildBirds.values())updateVisibility(bird.npc.actor,camera.position,bird.ready&&bird.npc.phase!=='hidden');
  for(const remote of remotePlayers?.players.values()??[])updateVisibility(remote.actor,camera.position);
  if(character)updateVisibility(character.actor,camera.position,true,true);
  prankEffects.update(playing&&!roundFinished()?network?.room.pranks??[]:[],network?.serverNow??Date.now(),id=>{const c=id===network?.id?character:remotePlayers?.players.get(id);return c?{actor:c.actor,root:c.animationRoot,grounded:['Idle','Run','Walk','WalkBackward','RotateLeft','RotateRight','Attack'].includes(c.state)}:undefined;},character?.actor.position??camera.position);
  const profileRender=sceneProfiler?performance.now():0;
  const firstRenderStart=firstSceneFrame?performance.now():0;
  sceneryVisibility.update(camera,viewDistance);
  fireflies?.syncInstances(camera);
  preparedShadows.update(lightTime,camera.position);
  renderer.render(scene, camera);
  if(firstSceneFrame){performance.measure('kirby-first-frame',{start:firstRenderStart,end:performance.now()});firstSceneFrame=false;}
  sceneProfiler?.frame(profileRender-profileStart,performance.now()-profileRender);
});
window.addEventListener('resize', () => {
  camera.fov=cameraFov();
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  shadows.updateFrustums();
  renderer.setPixelRatio(renderScale);
  renderer.setSize(innerWidth, innerHeight);
});




watermill.onFeedback=kind=>{if(!character||character.actor.position.distanceTo(MILL_LEVER)>32)return;sounds.playMill(kind);};

function millActor(c:CharacterController):MillActor{return {id:network?.id??'solo',p:c.actor.position.toArray(),yaw:c.yaw,size:c.actor.scale.x,available:!bread.holds(network?.id??'solo')&&!c.flight.active&&!c.roll.active&&['Idle','Run','Walk','WalkBackward','RotateLeft','RotateRight','Attack','Push'].includes(c.state)};}
function sendMill(action:MillAction){if(!character)return;if(network)network.event({type:'mill',action});else{const old=watermill.quest;watermill.apply(action,millActor(character));if(old.stage!=='running'&&watermill.quest.stage==='running')bread.state=grantBread(bread.state,breadActor(character),Date.now());}}
function breadActor(c:CharacterController):BreadActor{
 const id=network?.id??'solo',bag=millCarrying(watermill.quest,id);
 return {id,p:c.actor.position.toArray(),yaw:c.yaw,size:c.actor.scale.x,available:playing&&!bag&&!acquiring&&!c.roll.active&&!coaster.riding&&!boats.riding&&!balloons.riding&&!home.active&&!treehouse.active&&!benches.active&&!trampoline.active&&!skyTrail.active&&!mountainLedges.active&&!fireflies?.riding};
}
function sealActor(c:CharacterController):SealActor{
 const actor=breadActor(c);
 const balcony=treehouse.onBalcony(c),bag=millCarrying(watermill.quest,actor.id);
 const onFoot=balcony?['Lookout','Walk','WalkBackward'].includes(c.state):actor.available&&['Idle','Run','Walk','WalkBackward','RotateLeft','RotateRight'].includes(c.state);
 return {...actor,available:onFoot&&!bag&&!acquiring&&!bread.holds(actor.id)&&!c.flight.active&&!c.roll.active&&!c.swimming&&!document.hidden};
}
function sendBread(action:BreadAction){
 if(!character)return;if(network){network.event({type:'bread',action});return;}
 const id=action.kind==='feed'?action.bird??'pidgie':'pidgie',npc=wildBirds.get(id)?.npc;
 const birds=action.kind==='pick'?Array.from(wildBirds.values(),b=>b.npc.networkState()):npc?.networkState();
 const old=bread.state;bread.state=applyBread(old,action,breadActor(character),Date.now(),mountainLedges.networkState(),birds);
 if(action.kind==='feed'&&bread.state!==old&&bread.state.offering){
  npc?.acceptBread(bread.state.offering);character.achievements.add(pigeonFriendAchievement(id));
  localLog.push(pidgieFriendLog(nameInput.value,id));if(localLog.length>10)localLog.shift();
 }
}

function currentNumberGame(){return network?network.room.numberGame:soloNumberGame;}
function numberButtonPrompt(c:CharacterController){if(network?.numberStarting||network?.room.festival||currentNumberGame()||!nearNumberButton(flowerActor(c)))return;return 'E — Начать звонкие циферки';}
function startNumberAdventure(){if(!character||!numberButtonPrompt(character))return;if(network)network.event({type:'number-start'});else soloNumberGame=startNumberGame(undefined,flowerActor(character),Date.now());}
function pressNumber(digit:number){
 if(!character||currentNumberGame()&&currentNumberGame()!.stage!=='answer'||!numberGarden.press(digit,performance.now()/1000))return;
 playNumberSound(digit);if(network)network.event({type:'number-note',digit});else soloNumberGame=pressNumberGame(soloNumberGame,digit,flowerActor(character),Date.now());
}
function playNumberSound(digit:number){if(!character)return;const d=NUMBER_DIGITS[digit],p=character.actor.position;sounds.playNumber(digit,d.x-p.x,d.z-p.z,followCamera.azimuth);}
function currentFlowerGame(){return network?network.room.flowerGame:soloFlowerGame;}
function flowerActor(c:CharacterController):FlowerActor{const a=millActor(c);return {...a,available:a.available&&!coaster.riding&&!boats.riding&&!balloons.riding&&!home.active&&!treehouse.active&&!benches.active&&!trampoline.active&&!skyTrail.active&&!mountainLedges.active&&!fireflies?.riding,present:playing&&!document.hidden};}
function flowerButtonPrompt(c:CharacterController){if(network?.flowerStarting||network?.room.festival||!nearFlowerButton(flowerActor(c)))return;const q=currentFlowerGame();return !q?'E — Начать цветочную мелодию':q.stage==='repeat'?'E — Послушать мелодию ещё раз':undefined;}
function startFlowerAdventure(){if(!character||!flowerButtonPrompt(character))return;const q=currentFlowerGame();if(network)network.event({type:q?'flower-replay':'flower-start'});else soloFlowerGame=q?replayFlowerGame(q,flowerActor(character),Date.now()):startFlowerGame(undefined,flowerActor(character),Date.now());}
function playFlower(index:number){
 if(!character||currentFlowerGame()&&currentFlowerGame()!.stage!=='repeat')return;
 if(!musicalFlowers.press(index,performance.now()/1000))return;playFlowerSound(index);
 if(network)network.event({type:'flower-note',index});else soloFlowerGame=playFlowerGame(soloFlowerGame,index,flowerActor(character),Date.now());
}

function currentCentipede(){return network?network.room.centipede:soloCentipede;}
function centipedeActor(c:CharacterController):CentipedeActor{return {id:network?.id??'solo',p:c.actor.position.toArray(),yaw:c.yaw,size:c.actor.scale.x,available:playing&&!c.roll.active&&!coaster.riding&&!boats.riding&&!balloons.riding&&!home.active&&!treehouse.active&&!benches.active&&!trampoline.active&&!skyTrail.active&&!mountainLedges.active&&!fireflies?.riding,done:c.achievements.has('centipede'),points:c.eventPoints};}
function centipedePrompt(c:CharacterController){if(Math.hypot(c.actor.position.x-BOSS_ARENA.x,c.actor.position.z-BOSS_ARENA.z)>BOSS_ARENA.radius)return;return !currentCentipede()&&!network?.centipedeStarting&&!network?.room.festival&&arenaCentipede&&nearCentipede(centipedeActor(c),arenaCentipede.startTrail(boatTime()))?'E — Поиграть с Топотушкой':undefined;}
function startCentipedeGame(){
 if(!character||!arenaCentipede||!centipedePrompt(character))return;const trail=arenaCentipede.startTrail(boatTime());
 if(network)network.event({type:'centipede-start',trail});else {soloCentipede=startCentipede(trail,centipedeActor(character),Date.now());if(soloCentipede)addLocalLog('позвал Топотушку поиграть в догонялки и подружиться!');}
}
function centipedeSoloRewards(){
 if(!character||!soloCentipede)return;
 character.eventPoints=Math.max(character.eventPoints,soloCentipede.players.solo?.points??0);
 if(completedCentipede(soloCentipede,'solo')&&awardFirst(character,'centipede'))addLocalLog('прошёл все три испытания и подружился с Топотушкой!');
}
function centipedeTick(){
 if(!character||!playing||!currentCentipede())return;const now=network?.serverNow??Date.now(),a=centipedeActor(character);
 if(!network){
  soloCentipede=advanceCentipede(soloCentipede,now,[a]).event;advanceChasers(soloCentipede,[a],now);
  // A player's timely push is resolved before ball contact in this frame.
  if(character.attackHit&&pushChaser(soloCentipede,a,now)){character.attackHit=false;sounds.playBoing(.7);}
  const direction=bumpChaser(soloCentipede,a,now)??bumpCentipede(soloCentipede,a,now);
  if(direction&&character.takePush(...direction))sounds.playBoing(.7);centipedeSoloRewards();
 }
 else {const hit=centipedeContact(network.room.centipede,a,now);if(hit&&centipedeContactKey!==hit.key){centipedeContactKey=hit.key;network.event({type:'centipede-step'});}}
}
/** Keep the hosted meadow alive while its host explores another scene. */
function tickMeadowWhileAway(dt:number){
 const now=network?.serverNow??Date.now(),host=!network||network.host;
 mountainLedges.update(dt,[...(remotePlayers?.players.values()??[])],host);
 boats.update(dt,boatTime(),camera.position);coaster.update(dt,camera.position);treehouse.update(dt);balloons.update(dt,host?npcs:[],undefined,constrainNpc);
 const people=Array.from(remotePlayers?.players.values()??[],c=>c.actor.position),neighbors=[...people,...npcs.map(n=>n.actor.position)];
 if(host){npcSwimming.update(dt,npcs,constrainNpc);fireflies?.prepareNpcs(npcs,true,dt,character!.actor.position);
  for(const npc of npcs){npc.fruitBoost.update(dt);npcPrevious.copy(npc.actor.position);if(!balloons.owns(npc))npc.update(dt,neighbors,constrainNpc);const foot=npc.state!=='Balloon'&&npc.fireflyIndex===undefined;if(foot)constrainNpc(npc.actor.position,npc.actor.scale.x,npcPrevious);ponds.apply(npc,npcPrevious,foot);npc.syncSwimming();}
 }
 tickWildPigeons(dt,people,Array.from(network?.actors??[],([id,a])=>({id,position:remotePlayers?.players.get(id)?.actor.position??new THREE.Vector3().fromArray(a.p),hasBread:bread.holds(id),isPigeon:isPigeonVariant(KIRBY_VARIANTS[a.variant]?.[0])})));
 fireflies?.update(dt,daylight(currentDayPhase()).night,camera.position);fireflies?.syncNpcRiders(npcs,host,dt);
 watermill.tickQuest(now,millActor(character!),sendMill,!!network);
 if(!network){bread.state=advanceBread(bread.state,now,mountainLedges.networkState());soloFlowerGame=advanceFlowerGame(soloFlowerGame,now,[]);soloNumberGame=advanceNumberGame(soloNumberGame,now,[]);centipedeTick();}
 fruits.update(dt,character!,host?npcs:[],true);
 music.setEvent(cosmicArena.engaged?'knight':false);music.updateKnightPhase(cosmicArena.battle?.phase??1,dt);music.updateDucking(cosmicArena.engaged&&cosmicArena.battle?.phase===4&&cosmicArena.battle.stage!=='cosmic-flight'&&!cosmicCombat(cosmicArena.battle),dt);
}
function resolveInteraction(c:CharacterController):{text:string;run:()=>unknown;target?:OutlineTarget}|undefined {
  if(nearMetaKnightPortal(c.actor.position)&&sealActor(c).available)return {text:metaKnightPortalReady()?'E — Войти на арену Метакнайта':'Портал пока не работает',run:()=>{if(metaKnightPortalReady())void cosmicArena.enter(c);},target:{key:meadowPortal,root:meadowPortal.group}};
  if(bread.holds(network?.id??'solo')){
   const nearby=Array.from(wildBirds).filter(([,b])=>b.ready).sort(([,a],[,b])=>a.npc.actor.position.distanceToSquared(c.actor.position)-b.npc.actor.position.distanceToSquared(c.actor.position));
   for(const [id,npc] of nearby){
    const bird=npc.npc.networkState();
    if(canFeedPidgie(bread.state,breadActor(c),bird)){
      const midpoint=c.actor.position.clone().add(new THREE.Vector3().fromArray(bird.p)).multiplyScalar(.5);
      const clear=Array.from({length:9},(_,i)=>new THREE.Vector3().fromArray(bird.p).lerp(midpoint,i/8)).every(p=>pidgieSafeWalk(p.x,p.z));
      if(clear)return {text:`E — Угостить дикого ${wildPigeonObjectName(id)}`,run:()=>sendBread({kind:'feed',bird:id}),target:{key:npc.npc,root:npc.npc.actor}};
    }
   }
    return {text:'E — Бросить хлебушек',run:()=>sendBread({kind:'drop'})};
  }
  const p=c.actor.position;
  if(c.roll.active)return undefined;
  const result=(text:string,run:()=>unknown,target?:OutlineTarget)=>({text,run,target});
  const region=(key:unknown,root:THREE.Object3D,center:THREE.Vector3,size:number[])=>outlineRegion(key,root,center,new THREE.Vector3(...size));
  const object=(root?:THREE.Object3D):OutlineTarget|undefined=>root?{key:root,root}:undefined;
  if(boats.riding)return result(boats.prompt(c),()=>boats.disembark());
  if(skyTrail.active||mountainLedges.active)return undefined;
  if(mountainLedges.prompt(c)&&!fireflies?.riding&&!coaster.riding&&!boats.riding&&!balloons.riding&&!home.active&&!treehouse.active&&!benches.active&&!trampoline.active)return result(mountainLedges.prompt(c),()=>mountainLedges.start(c),object(mountainLedges.recovery.target(c)));
  if(skyTrail.prompt(c)&&!fireflies?.riding&&!coaster.riding && !boats.riding&&!balloons.riding&&!home.active&&!treehouse.active&&!benches.active&&!trampoline.active)return result(skyTrail.prompt(c),()=>skyTrail.start(c),object(skyTrail.target(c)));
  if(fireflies?.riding)return result(fireflies.prompt(c),()=>fireflies?.disembark());
  if(home.active)return result(home.prompt(p,c.actor.scale.x),()=>home.wake());
  const free=!coaster.riding && !boats.riding && !balloons.riding && !treehouse.active && !benches.active && !trampoline.active;
  if(free && home.prompt(p,c.actor.scale.x))return c.flight.active?undefined:result(home.prompt(p,c.actor.scale.x),()=>home.start(c),region(home,home.group,home.group.position.clone().add(new THREE.Vector3(0,1,-.6)),[4,2.2,5]));
  if(trampoline.active)return result(trampoline.prompt(c),()=>{});
  if(free && trampoline.prompt(c))return p.y>.5?undefined:result(trampoline.prompt(c),()=>trampoline.start(c),region(trampoline,trampoline.group,trampoline.position.clone().add(new THREE.Vector3(0,.5,0)),[4,2,4]));
  if(coaster.riding)return result(coaster.prompt(c),()=>coaster.disembark());
  if(balloons.riding)return result(balloons.prompt(p),()=>{});
  if(benches.active)return result(benches.prompt(p),()=>benches.interact(c));
  if((!treehouse.active || treehouse.canSit) && benches.prompt(p)){
    if(c.flight.active)return;
    const seat=benches.outlineSeat(p)!;
    const root=seat.kind==='treehouse'?treehouse.group:seat.kind==='depot'?coaster.group.getObjectByName(seat.position.x<0?'West oak waiting bench':'East oak waiting bench')!:scene;
    return result(benches.prompt(p),()=>benches.interact(c),region(seat,root,seat.position.clone().add(new THREE.Vector3(0,.2,0)),[seat.width+.2,3.2,1.8]));
  }
  if(treehouse.active)return result(treehouse.prompt(p),()=>treehouse.interact(c));
  if(treehouse.prompt(p)){
    if(c.flight.active)return;
    const swing=treehouse.networkKey(p)==='swing:0';
    return result(treehouse.prompt(p),()=>treehouse.interact(c),swing?object(treehouse.outlineSwing):region(treehouse,treehouse.group,TREEHOUSE_SITE.clone().add(new THREE.Vector3(-4,9.4,9.15)),[2.3,19.4,4.2]));
  }
  if(free&&centipedePrompt(c))return result(centipedePrompt(c)!,startCentipedeGame,object(arenaCentipede!.group.getObjectByName('Segment_0')));
  if(free&&flowerButtonPrompt(c))return result(flowerButtonPrompt(c)!,startFlowerAdventure,object(flowerGameView.button.group));
  if(free&&numberButtonPrompt(c))return result(numberButtonPrompt(c)!,startNumberAdventure,object(numberGarden.button));
  const digit=free&&!c.flight.active?numberGarden.nearest(p,c.actor.scale.x):-1;
  if(digit>=0&&(!currentNumberGame()||currentNumberGame()!.stage==='answer'))return result(numberGarden.prompt(digit),()=>pressNumber(digit),numberGarden.target(digit));
  const flower=free&&!c.flight.active?musicalFlowers.nearest(p,c.actor.scale.x):-1;
  if(flower>=0&&(!currentFlowerGame()||currentFlowerGame()!.stage==='repeat'))return result(musicalFlowers.prompt(flower),()=>playFlower(flower),musicalFlowers.target(flower));
  if(watermill.prompt(millActor(c)))return result(watermill.prompt(millActor(c)),()=>{const action=watermill.action(millActor(c));if(action)sendMill(action);},object(watermill.target(millActor(c))));
  if(balloons.prompt(p))return c.flight.active?undefined:result(balloons.prompt(p),()=>balloons.board(c),object(balloons.outlineBalloon(p)));
  if(coaster.prompt(c))return result(coaster.prompt(c),()=>coaster.board(c),object(coaster.outlineCart(c)));
  const boat=boats.outlineBoat(c);
  if(boat)return result(boats.prompt(c),()=>boats.board(c),object(boat));
  const bug=fireflies?.outlineBug(c);
  if(bug)return result(fireflies!.prompt(c),()=>fireflies!.board(c),object(bug));
}

function playFlowerSound(index:number,transpose=0){
 if(!character)return;const flower=MUSICAL_FLOWERS[index],p=character.actor.position;
 sounds.playFlowerNote(index,flower.x-p.x,flower.z-p.z,followCamera.azimuth,transpose);
}

function captureWorld():WorldState{
 const round=(rows:number[][])=>rows.map(row=>row.map(v=>Math.round(v*1000)/1000));
 return {npcs:npcs.map(n=>actorState(n,n.variant[0],KIRBY_VARIANTS.indexOf(n.variant))),npcLife:round(npcs.map(n=>n.networkLife())),carts:round(coaster.networkState()),mountainSteps:round(mountainLedges.networkState()),balloons:balloons.networkState().map(row=>row.map(v=>typeof v==='number'?Math.round(v*1000)/1000:v)),bugs:round(fireflies!.networkState()),...Object.fromEntries(Array.from(wildBirds).filter(([,b])=>b.ready).map(([id,b])=>[id,b.npc.networkState()]))};
}
function applyRide(a:ActorState){
 if(!a.ride)return;const [kind,index]=a.ride.key.split(':'),i=Number(index);
 if(kind==='swing')treehouse.networkSwing(a.ride.data[0] as number);
 if(kind==='cart'){const rows=coaster.networkState();rows[i]=a.ride.data as number[];coaster.networkApply(rows);}
 if(kind==='balloon'){const rows=balloons.networkState();rows[i]=a.ride.data;balloons.networkApply(rows,npcs);}

}
function constrainNpc(position:THREE.Vector3,size:number,previous:THREE.Vector3){
 mountainLedges.constrain(position,size);
 watermill.constrain(position,size);treehouse.constrain(position,size);maze.constrain(position,size,previous);home.constrain(position,size);constrainArena(position,size);constrainNpcOutsideArena(position,size,previous);flowerGameView.button.constrain(position,size);
}
function showFruitPickup(type:string){
 setText(combatMessage,`${type} съеден! Скорость от фруктов ${Math.round(character!.fruitBoost.multiplier*100)}% · 20 с`);
 hitMessageRemaining=2.5;
}
function syncNetworkWorld(dt:number){
 if(!network||!character)return;
 const r=network.room;
 const birdHandoffs:Partial<Record<WildPigeonId,PidgieState>>={};
 if(npcSnapshotHost!==r.host){
  if(npcSnapshotHost&&network.host)for(const [id,bird] of wildBirds)if(bird.ready)birdHandoffs[id]=bird.npc.networkState();
  npcSnapshots.clear();npcSnapshotHost=r.host;worldRevision=-1;
 }
 const blocked=(kind:string)=>new Set(Object.entries(r.locks).filter(([key,owner])=>key.startsWith(kind+':')&&owner!==network!.id).map(([key])=>Number(key.split(':')[1])));
 boats.networkBlocked=blocked('boat');coaster.networkBlocked=blocked('cart');balloons.networkBlocked=blocked('balloon');fireflies!.networkBlocked=blocked('bug');fireflies!.syncLandings(r.bugLandings??{});
 watermill.setQuest(r.millQuest??newMillQuest(),network.serverNow);
 bread.state=r.bread??newBread();
 if(r.sealProgress)sealProgress=r.sealProgress;
 for(const id of WILD_PIGEONS)if(breadOffering(r.bread,id)?.by===network.id)character.achievements.add(pigeonFriendAchievement(id));
 if(network.world && worldRevision!==network.revision){const w=network.world;coaster.networkApply(w.carts);balloons.networkApply(w.balloons,npcs);fireflies!.networkApply(w.bugs);npcs.forEach((n,i)=>{if(network!.host||worldRevision<0)applyActor(n,w.npcs[i],0,true);n.networkApplyLife(w.npcLife[i]);});if(!network.host)npcSnapshots.push(performance.now(),w.npcs);
  if(w.mountainSteps&&(!network.host||worldRevision<0))mountainLedges.networkApply(w.mountainSteps);
  for(const [id,bird] of wildBirds){
   const state=w[id];if(!state)continue;
   const handoff=birdHandoffs[id];
   const checkpoint=handoff&&handoff.seed===state.seed&&handoff.fearCount===state.fearCount&&handoff.friend?.at===state.friend?.at?handoff:state;
   bird.npc.applyNetworkState(checkpoint,network.host||worldRevision<0);bird.ready=true;
   if(worldRevision<0){bird.fearSeen=checkpoint.fearCount;bird.joySeen=checkpoint.clip==='Joy';bird.helloSeen=checkpoint.clip==='Hello';}
  }
  worldRevision=network.revision;}
 if(network.host)for(const bird of wildBirds.values())if(!bird.ready){bird.ready=true;bird.fearSeen=bird.npc.fearCount;bird.joySeen=bird.npc.state==='Joy';bird.helloSeen=bird.npc.state==='Hello';}
 pidgieReady=wildBirds.get('pidgie')?.ready??false;

 for(const [id,a] of network.actors)if(a.ride&&r.locks[a.ride.key]===id&&appliedRides.get(id)!==a){applyRide(a);appliedRides.set(id,a);}
 r.fruits.forEach((owner,i)=>{if(!owner||knownFruits.has(i))return;knownFruits.add(i);fruits.confirm(i,owner===network!.id?character:remotePlayers?.players.get(owner));if(owner===network!.id){character!.eatFruit();showFruitPickup(fruits.fruits[i].type);}else if(owner.startsWith('npc:')&&network!.host)npcs[Number(owner.slice(4))]?.eatFruit();});
}
function resourceKey(c:CharacterController){
 if(bread.holds(network?.id??'solo'))return;
 if(boats.riding)return boats.networkKey(c);
 if(skyTrail.active||skyTrail.prompt(c)||mountainLedges.active||mountainLedges.prompt(c))return;
 if(coaster.riding)return coaster.networkKey(c);if(balloons.riding)return balloons.networkKey(c.actor.position);if(fireflies?.riding)return fireflies.networkKey(c);
 if(home.active||home.prompt(c.actor.position,c.actor.scale.x))return 'home:0';
 if(trampoline.active||trampoline.prompt(c))return 'trampoline:0';
 const seat=benches.outlineSeat(c.actor.position);if(benches.active)return heldResource;if(seat&&(!treehouse.active||treehouse.canSit))return 'bench:'+BENCH_SEATS.indexOf(seat);
 if(treehouse.active||treehouse.prompt(c.actor.position))return treehouse.networkKey(c.actor.position);
 if(centipedePrompt(c)||watermill.prompt(millActor(c)))return;
 if(balloons.prompt(c.actor.position))return balloons.networkKey(c.actor.position);
 if(coaster.prompt(c))return coaster.networkKey(c);
 return boats.networkKey(c)??fireflies?.networkKey(c);
}
async function interactOnline(){
 if(character&&nearMetaKnightPortal(character.actor.position)&&sealActor(character).available){resolveInteraction(character)?.run();return;}
 if(character&&bread.holds(network?.id??'solo')){resolveInteraction(character)?.run();return;}
 if(!character||acquiring)return;const action=resolveInteraction(character);if(!action)return;
 if(!network){action.run();return;}
 if(centipedePrompt(character)&&!heldResource){action.run();return;}
 if(flowerButtonPrompt(character)&&!heldResource){action.run();return;}
 if(!heldResource&&(numberButtonPrompt(character)||numberGarden.nearest(character.actor.position,character.actor.scale.x)>=0)){action.run();return;}
 if(watermill.prompt(millActor(character))&&!heldResource&&!home.active&&!treehouse.active){action.run();return;}
 if(musicalFlowers.nearest(character.actor.position,character.actor.scale.x)>=0&&!heldResource){action.run();return;}
 if((skyTrail.prompt(character)||mountainLedges.prompt(character))&&!heldResource){action.run();return;}
 if(heldResource){action.run();return;}
 const key=resourceKey(character);if(!key)return;
 const session=network,player=character;
 acquiring=true;const ok=await session.acquire(key);
 if(network!==session||character!==player){if(ok)session.event({type:'release',key});return;}
 acquiring=false;
 if(!ok)return;
 if(!playing||resourceKey(character)!==key){session.event({type:'release',key});return;}
 heldResource=key;resolveInteraction(character)?.run();
}
function updateNetwork(dt:number){
 if(!network||!character||!playing||roundFinished())return;
 if(!network.host){const states=npcSnapshots.sample(performance.now());if(states)npcs.forEach((n,i)=>applyActor(n,states[i],dt,true));fireflies?.syncNpcRiders(npcs,false,dt);}
 for(const [id,actor] of network.actors)if(actor.ride?.key==='swing:0'&&network.room.locks['swing:0']===id)treehouse.networkSwing(actor.ride.data[0] as number);
 const remoteCount=remotePlayers?.players.size;remotePlayers?.update(network.actors,dt,network.actorSnapshots);if(remoteCount!==remotePlayers?.players.size)setupShadowMaterials();
 for(const [id,state] of remotePlayers?.renderedStates??[]){const rider=remotePlayers?.players.get(id);if(rider&&state.ride?.key.startsWith('bug:')&&network.room.locks[state.ride.key]===id)fireflies!.syncRemoteRider(Number(state.ride.key.split(':')[1]),rider,state,dt);}
 const boatRiders=new Map<number,CharacterController>(),boatPhases=new Map<number,number>();
 for(const [id,a] of remotePlayers?.renderedStates??[]){const c=remotePlayers?.players.get(id);if(c&&a.ride?.key.startsWith('boat:')&&network.room.locks[a.ride.key]===id){const index=Number(a.ride.key.split(':')[1]);boatRiders.set(index,c);boatPhases.set(index,a.ride.data[0] as number);}}
 boats.syncRemoteRiders(boatRiders,boatPhases);
 const active=boats.riding||coaster.riding||balloons.riding||fireflies?.riding||home.active||treehouse.active||benches.active||trampoline.active;
 if(heldResource&&!active){network.event({type:'release',key:heldResource,...(heldResource.startsWith('bug:')?{bugState:fireflies!.networkState()[Number(heldResource.split(':')[1])]}:{})});heldResource=undefined;}
 const a=actorState(character,nameInput.value,KIRBY_VARIANTS.indexOf(selected));
 if(character.actor.userData.location==='meta-knight-arena')a.location='meta-knight-arena';
 if(heldResource){const [kind,index]=heldResource.split(':'),i=Number(index);const data=kind==='boat'?boats.networkData():kind==='cart'?coaster.networkState()[i]:kind==='balloon'?balloons.networkState()[i]:kind==='bug'?fireflies!.networkState()[i]:kind==='swing'?[treehouse.swing.rotation.x]:kind==='tree'?[0]:undefined;if(data)a.ride={key:heldResource,data};}
 network.tick(dt,a,captureWorld,()=>pigeonFlock?.checkpoints()??[]);
 playerHostBadge.hidden=!network.host;
 const entries=[{id:network.id,actor:a,points:scoreOf(character)},...Array.from(network.actors,([id,actor])=>({id,actor,points:actor.fruits+achievementPoints(actor.achievements)+(actor.eventPoints??0)+(network!.room.festival?.players[id]?.bonus??0)}))];
 const teamPoints=npcs.reduce((sum,n)=>sum+scoreOf(n),0);
 const signature=JSON.stringify([network.room.host,entries.map(e=>[e.id,e.actor.name,e.actor.variant,e.actor.s,e.points]),teamPoints]);
 if(rosterSignature!==signature){
  rosterSignature=signature;
  for(const [id,row] of remoteStatRows)if(!network.actors.has(id)){row.remove();remoteStatRows.delete(id);}
  const rows=entries.map(entry=>{
   let row=entry.id===network!.id?playerStatsRow:remoteStatRows.get(entry.id);
   if(!row){row=playerStatsRow.cloneNode(true) as HTMLElement;row.removeAttribute('id');row.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));row.classList.add('remote-stat-row');row.dataset.playerId=entry.id;remoteStatRows.set(entry.id,row);}
   styleVariant(row,KIRBY_VARIANTS[entry.actor.variant]);
   row.querySelector('.stat-name')!.textContent=entry.actor.name;
   const values=row.querySelectorAll('strong');values[0].textContent=String(entry.points);values[1].textContent=`${Math.round(entry.actor.s*100)}%`;
   row.querySelector<HTMLElement>('.host-badge')!.hidden=entry.id!==network!.room.host;
   return {row,points:entry.points};
  });
  rows.push({row:npcStatsRow,points:teamPoints});rows.sort((a,b)=>b.points-a.points);
  const parent=playerStatsRow.parentElement!,anchor=parent.querySelector('.fruit-remaining');
  for(const entry of rows){entry.row.querySelector('.score-place')!.textContent=`${1+rows.filter(r=>r.points>entry.points).length}.`;parent.insertBefore(entry.row,anchor);}
 }
}

localizeDOM();
