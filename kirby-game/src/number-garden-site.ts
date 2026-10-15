/** The north foothill, with all ten bells in one row parallel to the mountain. */
export const NUMBER_GARDEN_SITE={x:-100,z:-245.7,halfWidth:18.4,halfDepth:9.7,buttonX:-115.6,buttonZ:-238.8,rowZ:-245.5,equationZ:-251.4} as const;
export const NUMBER_KEY_SCALE=1.2,NUMBER_EQUATION_SCALE=NUMBER_KEY_SCALE*1.2*1.3;
export const NUMBER_COLORS=['#ed849b','#efa66e','#edcb66','#a9cc76','#6ec9ad','#72c9df','#7fa6ea','#a293e1','#ce97d6','#e994b6'];
export const NUMBER_MIDI=[60,62,64,67,69,72,74,76,79,81];
export const NUMBER_DIGITS=NUMBER_COLORS.map((color,digit)=>({digit,color,x:NUMBER_GARDEN_SITE.x+(digit-4.5)*3.35,z:NUMBER_GARDEN_SITE.rowZ}));
export const NUMBER_PRESS_MS=180;
export function validNumberDigit(value:unknown):value is number{return Number.isInteger(value)&&Number(value)>=0&&Number(value)<=9;}
export function outsideNumberGarden(x:number,z:number,padding=0){return Math.abs(x-NUMBER_GARDEN_SITE.x)>NUMBER_GARDEN_SITE.halfWidth+padding||Math.abs(z-NUMBER_GARDEN_SITE.z)>NUMBER_GARDEN_SITE.halfDepth+padding;}
export function canPressNumber(digit:unknown,p:{x:number;y:number;z:number},size:number){
 if(!validNumberDigit(digit)||![p.x,p.y,p.z,size].every(Number.isFinite)||p.y<-.8||p.y>3.6)return false;
 const d=NUMBER_DIGITS[digit],reach=1.9+.45*Math.max(.3,Math.min(3,size));return Math.hypot(p.x-d.x,p.z-d.z)<=reach;
}
