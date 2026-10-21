import {Box3,CanvasTexture,LinearFilter,Sprite,SpriteMaterial,SRGBColorSpace,Vector2,Vector3,type Object3D} from 'three';

const FONT='800 64px "Manrope", "Segoe UI", sans-serif';
const HEIGHT=96;
const SCREEN_HEIGHT=44;

/** A camera-facing name attached to a peer, with readable size at any player scale. */
export class PlayerNameplate {
 readonly sprite:Sprite;
 private readonly canvas=document.createElement('canvas');
 private readonly context=this.canvas.getContext('2d')!;
 private readonly texture=new CanvasTexture(this.canvas);
 private readonly viewSize=new Vector2();
 private readonly worldScale=new Vector3();
 private readonly modelTop:number;
 private text='';
 private color='';
 private disposed=false;

 constructor(private actor:Object3D,private model:Object3D){
  // Measure only the resting model once; rings, clouds and the label itself
  // must never increase the next frame's anchor height.
  this.modelTop=new Box3().setFromObject(model).max.y;
  this.texture.colorSpace=SRGBColorSpace;
  this.texture.minFilter=LinearFilter;this.texture.generateMipmaps=false;
  this.sprite=new Sprite(new SpriteMaterial({map:this.texture,depthWrite:false,sizeAttenuation:false,toneMapped:false,fog:false}));
  this.sprite.name='Remote player nickname';this.sprite.center.set(.5,0);
  this.sprite.frustumCulled=false;
  this.sprite.onBeforeRender=(renderer,_scene,camera)=>{
   this.updateAnchor();
   renderer.getSize(this.viewSize);actor.getWorldScale(this.worldScale);
   // The texture is drawn at high resolution; its visible letters are ~23 px.
   const height=SCREEN_HEIGHT*2/(Math.max(1,this.viewSize.y)*Math.abs(camera.projectionMatrix.elements[5]));
   this.sprite.scale.set(height*this.canvas.width/HEIGHT/this.worldScale.x,height/this.worldScale.y,1);
   this.sprite.updateMatrixWorld();
  };
  actor.add(this.sprite);this.updateAnchor();
 }

 private updateAnchor(){this.sprite.position.y=this.modelTop*this.model.scale.y+.18/this.actor.scale.y;}

 set(name:string,color:string){
  if(this.text===name&&this.color===color)return;
  this.text=name;this.color=color;this.draw();
  // Canvas text does not repaint itself when the existing UI webfont arrives.
  void document.fonts?.load('800 64px "Manrope"',name).then(()=>{if(!this.disposed)this.draw();}).catch(()=>{});
 }

 private draw(){
  const ctx=this.context;ctx.font=FONT;
  this.canvas.width=Math.ceil(ctx.measureText(this.text).width)+36;this.canvas.height=HEIGHT;
  ctx.font=FONT;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  ctx.strokeStyle='#202333';ctx.lineWidth=8;
  ctx.shadowColor='#11182799';ctx.shadowBlur=6;ctx.shadowOffsetY=3;
  ctx.strokeText(this.text,this.canvas.width/2,HEIGHT/2);
  ctx.shadowColor='transparent';ctx.fillStyle=this.color;ctx.fillText(this.text,this.canvas.width/2,HEIGHT/2);
  this.texture.needsUpdate=true;this.sprite.visible=!!this.text.trim();
 }

 dispose(){
  this.disposed=true;this.sprite.removeFromParent();this.texture.dispose();this.sprite.material.dispose();
 }
}
