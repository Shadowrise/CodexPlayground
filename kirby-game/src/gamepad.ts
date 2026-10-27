import {t,getLocale} from './i18n';
import {mapRawGamepad} from './gamepad-profiles';
export type Pad = Pick<Gamepad, 'id' | 'index' | 'connected' | 'mapping' | 'axes' | 'buttons'>;
export const INPUT_STORAGE = 'kirby-input-device-v1';
export function deadZone(value: number, threshold = .2) {
  return Math.abs(value) <= threshold ? 0 : Math.sign(value) * Math.min(1, (Math.abs(value)-threshold)/(1-threshold));
}
/** Wider straight-ahead corridor while moving; output ramps up without a jump. */
export function stickSteering(x:number,y:number) {
  const threshold=Math.max(.35,Math.abs(y)*.5);
  const amount=Math.max(0,Math.min(1,(Math.abs(x)-threshold)/(1-threshold)));
  return -Math.sign(x)*amount*amount*(3-2*amount);
}
export function devices(pads: readonly (Pad | null)[]) {
  return pads.flatMap(source => {
    if(!source?.connected)return [];
    const mapped=source.mapping==='standard'?{pad:source,name:source.id}:mapRawGamepad(source);
    if(!mapped)return [];
    const {pad,name}=mapped;
    return [{pad, key: JSON.stringify([pad.id, pad.index]), label: `Геймпад ${pad.index+1} · ${name}`}];
  });
}
export class GamepadInput {
  preferred = 'keyboard';
  active = 'keyboard';
  private previous = new Map<string,Set<number>>();
  private previousSticks = new Map<string,boolean>();
  private activeIndex = -1;
  private wasEnabled = false;
  private hasPolled = false;
  constructor(private storage?: Pick<Storage,'getItem'|'setItem'>) {
    try { this.preferred = storage?.getItem(INPUT_STORAGE) || 'keyboard'; } catch {}
  }
  select(key: string) {
    if(this.preferred===key)return;
    this.preferred = key;
    try { this.storage?.setItem(INPUT_STORAGE,key); } catch {}
  }
  poll(pads: readonly (Pad|null)[], enabled = true, autoSelect = true) {
    const available = devices(pads);
    const heldByDevice=new Map(available.map(({key,pad})=>[key,new Set(pad.buttons.flatMap((b,i)=>b.pressed||b.value>.5?[i]:[]))]));
    const freshByDevice=new Map([...heldByDevice].map(([key,held])=>[key,new Set([...held].filter(i=>!this.previous.get(key)?.has(i)))]));
    const sticksByDevice=new Map(available.map(({key,pad})=>[key,
      Math.max(Math.abs(pad.axes[0]??0),Math.abs(pad.axes[1]??0))>(this.previousSticks.get(key) ? .3 : .65)]));
    // A deliberate left-stick tilt can also claim control. Require a return
    // toward neutral before another claim, so drift and held tilts cannot fight typing.
    const canPress=enabled&&(this.wasEnabled||!this.hasPolled);
    const activated=autoSelect&&canPress?available.find(d=>d.key!==this.preferred&&
      (freshByDevice.get(d.key)!.size||sticksByDevice.get(d.key)&&!this.previousSticks.get(d.key))):undefined;
    if(activated)this.select(activated.key);
    const selected=available.find(d=>d.key===this.preferred);
    const changed = this.active !== (selected?.key ?? 'keyboard') || this.activeIndex !== (selected?.pad.index ?? -1);
    this.active = selected?.key ?? 'keyboard'; this.activeIndex = selected?.pad.index ?? -1;
    const pad = enabled ? selected?.pad : undefined;
    const held=pad?heldByDevice.get(selected!.key)!:new Set<number>();
    // An intentional activation also delivers that first press to the menu/game.
    // Manual selection, reconnect and focus restoration keep their edge suppression.
    const pressed=canPress&&(activated||!changed&&this.wasEnabled)&&selected?freshByDevice.get(selected.key)!:new Set<number>();
    this.previous = heldByDevice;
    this.previousSticks = sticksByDevice;
    this.wasEnabled = enabled;
    this.hasPolled = true;
    return {available, changed, held, pressed, x:deadZone(pad?.axes[0]??0), y:deadZone(pad?.axes[1]??0),
      cameraX:deadZone(pad?.axes[2]??0), cameraY:deadZone(pad?.axes[3]??0)};
  }
}

export function createGamepadInput() {
  let storage: Storage | undefined;
  try {storage=localStorage;} catch {}
  const input=new GamepadInput(storage);
  const changeListeners=new Set<()=>void>();
  const selectors: HTMLSelectElement[]=[];
  for(const parent of [document.querySelector('.selection-description'),document.querySelector('#audio-panel')]) {
    const label=document.createElement('label');label.className='input-device';label.textContent=t('Управление ');
    const select=document.createElement('select');select.setAttribute('aria-label',t('Устройство управления'));
    select.addEventListener('change',()=>input.select(select.value));
    label.append(select);selectors.push(select);
    if(parent?.id==='audio-panel')parent.prepend(label);else parent?.after(label);
  }
  const hint=document.createElement('p');hint.className='gamepad-hint';
  hint.textContent=t('Нажмите кнопку геймпада или клавишу на клавиатуре — управление переключится автоматически.');
  const row=document.createElement('div');row.className='selection-input-row';
  const selectionLabel=selectors[0].parentElement!;
  selectionLabel.before(row);row.append(selectionLabel,hint);
  let signature='';
  function poll(autoSelect=true) {
    let pads: (Gamepad|null)[]=[];
    try {pads=Array.from(navigator.getGamepads?.()??[]);} catch {}
    const state=input.poll(pads,!document.hidden && document.hasFocus(),autoSelect);
    if(state.changed)for(const listener of changeListeners)listener();
    const next=JSON.stringify([state.available.map(d=>[d.key,d.label]),input.active,getLocale()]);
    if(next!==signature) {
      signature=next;
      for(const select of selectors) {
        // Preserve native select focus while switching devices with a key/click.
        const options=[new Option(t(document.body.classList.contains('touch-ui')?'Сенсорный экран':'Клавиатура и мышь'),'keyboard'),...state.available.map(d=>new Option(t(d.label),d.key))];
        if(options.length!==select.options.length||options.some((option,i)=>option.value!==select.options[i].value||option.text!==select.options[i].text))select.replaceChildren(...options);
        select.value=input.active;
      }
    }
    return state;
  }
  const useKeyboard=()=>{
    if(document.hidden||!document.hasFocus())return;
    input.select('keyboard');poll(false);
  };
  // Capture runs before gameplay handlers, so the switching key works immediately.
  window.addEventListener('keydown',event=>{if(event.isTrusted&&!event.repeat&&!event.isComposing)useKeyboard();},true);
  window.addEventListener('pointerdown',event=>{if(event.isTrusted&&event.pointerType==='mouse')useKeyboard();},true);
  window.addEventListener('blur',()=>poll(false));
  document.addEventListener('visibilitychange',()=>poll(false));
  return {input,poll,onChange(listener:()=>void){changeListeners.add(listener);return ()=>{changeListeners.delete(listener);};}};
}
