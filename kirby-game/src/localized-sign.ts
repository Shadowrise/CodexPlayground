import {CanvasTexture} from 'three';
import {onLocaleChange,t} from './i18n';

type Label={text:string;x:number;y:number;width:number;font:string;fill:CanvasRenderingContext2D['fillStyle'];align:CanvasTextAlign;baseline:CanvasTextBaseline};
const signs=new WeakMap<HTMLCanvasElement,{background:HTMLCanvasElement;labels:Label[];ctx:CanvasRenderingContext2D}>();
/** Repaint sign lettering only when the language changes; no new geometry or frame work. */
export function drawLocalizedText(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width=ctx.canvas.width*.94){
 if(!/[А-Яа-яЁё]/.test(text)){ctx.fillText(text,x,y,width);return;}
 let sign=signs.get(ctx.canvas);
 if(!sign){const background=document.createElement('canvas');background.width=ctx.canvas.width;background.height=ctx.canvas.height;background.getContext('2d')!.drawImage(ctx.canvas,0,0);sign={background,labels:[],ctx};signs.set(ctx.canvas,sign);}
 sign.labels.push({text,x,y,width,font:ctx.font,fill:ctx.fillStyle,align:ctx.textAlign,baseline:ctx.textBaseline});
 ctx.fillText(t(text),x,y,width);
}
export function localizedCanvasTexture(canvas:HTMLCanvasElement){
 const texture=new CanvasTexture(canvas),sign=signs.get(canvas);
 if(sign)onLocaleChange(()=>{const {ctx,background,labels}=sign;ctx.save();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(background,0,0);
  for(const label of labels){ctx.font=label.font;ctx.fillStyle=label.fill;ctx.textAlign=label.align;ctx.textBaseline=label.baseline;ctx.fillText(t(label.text),label.x,label.y,label.width);}
  ctx.restore();texture.needsUpdate=true;
 });
 return texture;
}
