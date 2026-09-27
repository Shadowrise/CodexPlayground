/** Cosmetic events share server time; no extra movement packets or score changes. */
export const PRANKS={hiccup:{label:'Икота',duration:12000,text:'получает от Ветерка смешную икоту с мыльными пузырями!'},rainbow:{label:'Радужные пяточки',duration:20000,text:'оставляет радужные следы — Ветерок раскрасил пяточки!'},gift:{label:'Посылка от Ветерка',duration:12000,text:'получает загадочную посылку от Ветерка. Кажется, внутри кто-то крякает!'}} as const;
export type PrankKind=keyof typeof PRANKS;
export type Prank={id:string;playerId:string;kind:PrankKind;startsAt:number;endsAt:number;p:number[];scale:number};
export function isPrankKind(value:unknown):value is PrankKind{return typeof value==='string'&&Object.hasOwn(PRANKS,value);}
export function makePrank(playerId:string,kind:PrankKind,now:number,p:number[],scale:number):Prank{return {id:crypto.randomUUID(),playerId,kind,startsAt:now+250,endsAt:now+250+PRANKS[kind].duration,p:p.slice(0,3),scale:Math.min(2.5,Math.max(1,scale))};}
