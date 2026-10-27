import type {Pad} from './gamepad';

type RawProfile={
  devices:Readonly<Record<string,string>>;
  buttonCount:readonly [number,number];
  // Source indices for the standard layout's first twelve buttons; null = axis trigger.
  buttons:readonly (number|null)[];
  triggerAxes?:readonly [number,number];
  meta?:number;
  extra?:number;
};

// Chromium's Windows HID layouts. Match the report shape as well as VID/PID:
// native SDL/DirectInput/evdev indices are not interchangeable with browser indices.
// https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_standard_mappings_win.cc
// Xbox Series (0b13) uses the same HID layout as Chromium's macOS Series mapper:
// https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_standard_mappings_mac.mm
const profiles:readonly RawProfile[]=[
  {
    devices:{'045e:0b13':'Xbox Wireless Controller','045e:0b20':'Xbox Wireless Controller',
      '045e:0b21':'Xbox Wireless Controller','045e:0b22':'Xbox Wireless Controller'},
    buttonCount:[15,16],buttons:[0,1,3,4,6,7,null,null,10,11,13,14],triggerAxes:[3,4],meta:12,extra:15,
  },
  {
    devices:{'054c:05c4':'DualShock 4','054c:09cc':'DualShock 4','054c:0ba0':'DualShock 4',
      '054c:0ce6':'DualSense','054c:0df2':'DualSense Edge'},
    buttonCount:[14,14],buttons:[1,2,0,3,4,5,null,null,8,9,10,11],triggerAxes:[3,4],meta:12,extra:13,
  },
  {
    devices:{'046d:c216':'Logitech F310','046d:c218':'Logitech F510','046d:c219':'Logitech F710'},
    buttonCount:[12,12],buttons:[1,2,0,3,4,5,6,7,8,9,10,11],
  },
];
const profilesById=new Map(profiles.flatMap(profile=>Object.entries(profile.devices).map(([id,name])=>[id,{profile,name}] as const)));

function button(value:number):GamepadButton {
  value=Math.max(0,Math.min(1,value));
  return {value,pressed:value>.5,touched:value>0};
}

/** Normalize only known Chromium raw HID reports; standard layouts stay browser-owned. */
export function mapRawGamepad(source:Pad):{pad:Pad;name:string}|undefined {
  if(source.mapping!=='')return;
  const ids=/\bVendor:\s*([\da-f]{1,4})\s+Product:\s*([\da-f]{1,4})\b/i.exec(source.id);
  if(!ids)return;
  const id=ids.slice(1).map(value=>value.toLowerCase().padStart(4,'0')).join(':');
  const match=profilesById.get(id);if(!match)return;
  const {profile,name}=match;
  if(source.axes.length!==10 || source.buttons.length<profile.buttonCount[0] || source.buttons.length>profile.buttonCount[1])return;
  const buttons=profile.buttons.map(index=>index===null?button(0):source.buttons[index]);
  if(profile.triggerAxes)profile.triggerAxes.forEach((axis,i)=>buttons[6+i]=button((source.axes[axis]+1)/2));
  // Hat directions run clockwise from up (-1) to up-left (1). Neutral is
  // outside that range; Chrome may also report zero before the first input.
  const hat=source.axes[9],direction=hat>=-1&&hat<=1&&hat!==0?Math.round((hat+1)*3.5):-1;
  buttons.push(...[[0,1,7],[3,4,5],[5,6,7],[1,2,3]].map(directions=>button(Number(directions.includes(direction)))));
  buttons.push(profile.meta===undefined?button(0):source.buttons[profile.meta]);
  if(profile.extra!==undefined && source.buttons[profile.extra])buttons.push(source.buttons[profile.extra]);
  // Native Gamepad fields are prototype getters, not enumerable own properties.
  return {name,pad:{id:source.id,index:source.index,connected:source.connected,mapping:'standard',
    axes:[source.axes[0],source.axes[1],source.axes[2],source.axes[5]],buttons}};
}
