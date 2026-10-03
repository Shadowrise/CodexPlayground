import {KIRBY_VARIANTS} from './variant-palette';
export type DeviceInfo={type:'phone'|'tablet'|'computer'|'unknown';os:string;browser:string;width:number;height:number;orientation:'portrait'|'landscape';input:'touch'|'keyboard'|'gamepad'};
export type SoloReport={id:string;seq:number;name:string;variant:number;startedAt:number;activeMs:number;startScore:number;score:number;tasksDone:number;tasksTotal:number;end:boolean;device:DeviceInfo};
export const HISTORY_INTERVAL=60000;
export function deviceInfo(ua:string,touchPoints=0,width=0,height=0,input:DeviceInfo['input']='keyboard'):DeviceInfo{
 const ios=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&touchPoints>1),android=/Android/.test(ua);
 return {type:/iPad|Tablet/.test(ua)||(/Macintosh/.test(ua)&&touchPoints>1)||(android&&!/Mobile/.test(ua))?'tablet':/iPhone|iPod|Mobile/.test(ua)?'phone':/Windows|Macintosh|Linux|CrOS/.test(ua)?'computer':'unknown',
 os:ios?'iOS / iPadOS':android?'Android':/Windows/.test(ua)?'Windows':/CrOS/.test(ua)?'ChromeOS':/Macintosh/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Не определена',
 browser:/Edg(A|iOS)?\//.test(ua)?'Edge':/OPR\/|Opera/.test(ua)?'Opera':/SamsungBrowser/.test(ua)?'Samsung Internet':/Firefox|FxiOS/.test(ua)?'Firefox':/Chrome|CriOS/.test(ua)?'Chrome':/Safari/.test(ua)?'Safari':'Другой',
 width:Math.max(0,Math.min(16000,Math.round(width))),height:Math.max(0,Math.min(16000,Math.round(height))),orientation:width>height?'landscape':'portrait',input};
}
export function sanitizeDevice(v:unknown):DeviceInfo{
 const a=v as Partial<DeviceInfo>|null;
 return {type:['phone','tablet','computer','unknown'].includes(a?.type??'')?a!.type!:'unknown',os:typeof a?.os==='string'?a.os.slice(0,32):'Не определена',browser:typeof a?.browser==='string'?a.browser.slice(0,32):'Другой',
 width:Number.isInteger(a?.width)&&a!.width!>=0&&a!.width!<=16000?a!.width!:0,height:Number.isInteger(a?.height)&&a!.height!>=0&&a!.height!<=16000?a!.height!:0,
 orientation:a?.orientation==='landscape'?'landscape':'portrait',input:a?.input==='gamepad'?'gamepad':a?.input==='touch'?'touch':'keyboard'};
}
export function validSoloReport(v:unknown,now=Date.now()):v is SoloReport{
 const a=v as SoloReport;
 const score=(x:number)=>Number.isInteger(x)&&x>=0&&x<=10000;
 return !!a&&typeof a.id==='string'&&/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(a.id)&&Number.isInteger(a.seq)&&a.seq>=0&&a.seq<1e7&&typeof a.name==='string'&&a.name.trim().length>0&&a.name.length<=24&&Number.isInteger(a.variant)&&a.variant>=0&&a.variant<KIRBY_VARIANTS.length&&Number.isFinite(a.startedAt)&&a.startedAt>0&&a.startedAt<=now+60000&&now-a.startedAt<30*86400000&&Number.isFinite(a.activeMs)&&a.activeMs>=0&&a.activeMs<=Math.max(0,now-a.startedAt)+60000&&score(a.startScore)&&score(a.score)&&Number.isInteger(a.tasksDone)&&Number.isInteger(a.tasksTotal)&&a.tasksDone>=0&&a.tasksDone<=a.tasksTotal&&a.tasksTotal>0&&a.tasksTotal<=100&&typeof a.end==='boolean';
}
