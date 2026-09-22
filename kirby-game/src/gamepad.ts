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
  return pads.filter((p): p is Pad => !!p?.connected && p.mapping === 'standard').map(pad => {
    return {pad, key: JSON.stringify([pad.id, pad.index]), label: `Геймпад ${pad.index+1} · ${pad.id}`};
  });
}
export class GamepadInput {
  preferred = 'keyboard';
  active = 'keyboard';
  private previous = new Set<number>();
  private activeIndex = -1;
  private wasEnabled = false;
  constructor(private storage?: Pick<Storage,'getItem'|'setItem'>) {
    try { this.preferred = storage?.getItem(INPUT_STORAGE) || 'keyboard'; } catch {}
  }
  select(key: string) {
    this.preferred = key;
    try { this.storage?.setItem(INPUT_STORAGE,key); } catch {}
  }
  poll(pads: readonly (Pad|null)[], enabled = true) {
    const available = devices(pads), selected = available.find(d=>d.key===this.preferred);
    const changed = this.active !== (selected?.key ?? 'keyboard') || this.activeIndex !== (selected?.pad.index ?? -1);
    this.active = selected?.key ?? 'keyboard'; this.activeIndex = selected?.pad.index ?? -1;
    const pad = enabled ? selected?.pad : undefined;
    const held = new Set<number>();
    pad?.buttons.forEach((b,i)=>{if(b.pressed || b.value>.5)held.add(i);});
    const pressed = new Set([...held].filter(i=>!changed && this.wasEnabled && !this.previous.has(i)));
    this.previous = held;
    this.wasEnabled = enabled;
    return {available, changed, held, pressed, x:deadZone(pad?.axes[0]??0), y:deadZone(pad?.axes[1]??0),
      cameraX:deadZone(pad?.axes[2]??0), cameraY:deadZone(pad?.axes[3]??0)};
  }
}

export function createGamepadInput() {
  let storage: Storage | undefined;
  try {storage=localStorage;} catch {}
  const input=new GamepadInput(storage);
  const selectors: HTMLSelectElement[]=[];
  for(const parent of [document.querySelector('.selection-description'),document.querySelector('#audio-panel')]) {
    const label=document.createElement('label');label.className='input-device';label.textContent='Управление ';
    const select=document.createElement('select');select.setAttribute('aria-label','Устройство управления');
    select.addEventListener('change',()=>input.select(select.value));
    label.append(select);selectors.push(select);
    if(parent?.id==='audio-panel')parent.prepend(label);else parent?.after(label);
  }
  const hint=document.createElement('p');hint.className='gamepad-hint';
  hint.textContent='Подключите геймпад и нажмите на нём кнопку, чтобы он появился в списке.';
  selectors[0].parentElement!.after(hint);
  let signature='';
  return {input, poll() {
    let pads: (Gamepad|null)[]=[];
    try {pads=Array.from(navigator.getGamepads?.()??[]);} catch {}
    const state=input.poll(pads,!document.hidden && document.hasFocus());
    const next=JSON.stringify([state.available.map(d=>[d.key,d.label]),input.active]);
    if(next!==signature) {
      signature=next;
      for(const select of selectors) {
        select.replaceChildren(new Option('Клавиатура и мышь','keyboard'),...state.available.map(d=>new Option(d.label,d.key)));
        select.value=input.active;
      }
    }
    return state;
  }};
}
