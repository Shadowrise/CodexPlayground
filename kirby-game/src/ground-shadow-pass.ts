import * as T from 'three';

/** Resolve prepared silhouettes with MAX coverage, then darken the scene once.
 * The existing scene depth is copied, not re-rendered. Shadows therefore cannot
 * fight each other for depth or accumulate opacity where their footprints cross. */
export class GroundShadowPass{
 readonly mask=new T.WebGLRenderTarget(1,1,{format:T.RedFormat,type:T.UnsignedByteType,minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true,stencilBuffer:true});
 private mode={value:false};
 private fog={value:new T.Vector2(1e8,1e9)};
 private prepared=new WeakSet<T.Material>();
 private size=new T.Vector2();
 private composite=new T.Scene();
 private camera=new T.Camera();
 private original:T.WebGLRenderer['render'];
 private active=false;
 private rootCache?:T.Object3D[];
 constructor(private renderer:T.WebGLRenderer,private scene:T.Scene){
  this.mask.texture.name='Maximum prepared shadow coverage';this.mask.texture.generateMipmaps=false;
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const material=new T.ShaderMaterial({uniforms:{coverage:{value:this.mask.texture}},transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
   vertexShader:'varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position,1.);}',
   fragmentShader:'uniform sampler2D coverage;varying vec2 vUv;void main(){gl_FragColor=vec4(0.,0.,0.,texture2D(coverage,vUv).r);}',
  });
  const quad=new T.Mesh(geometry,material);quad.frustumCulled=false;this.composite.add(quad);
  this.original=renderer.render.bind(renderer);
  // Screenshots and the profiler use the same scene renderer as normal play.
  renderer.render=(root,camera)=>{if(root===scene&&!this.active&&renderer.getRenderTarget()===null)this.render(camera);else this.original(root,camera);};
 }
 private roots():T.Object3D[]{
  if(this.rootCache)return this.rootCache.filter(root=>{for(let p:T.Object3D|null=root;p;p=p.parent)if(!p.visible)return false;return true;});
  const roots:T.Object3D[]=[];
  const visit=(object:T.Object3D)=>{
   if(object.userData.preparedShadow||object.name==='Soft patterned tree shadows'){roots.push(object);return;}
   for(const child of object.children)visit(child);
  };
  visit(this.scene);this.rootCache=roots;return this.roots();
 }
 private prepare(material:T.Material){
  if(this.prepared.has(material))return;this.prepared.add(material);
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
  material.customProgramCacheKey=function(){return key.call(this)+'|maximum-ground-coverage-v1';};
  const mode=this.mode,fog=this.fog;
  material.onBeforeCompile=function(shader,renderer){
   compile.call(this,shader,renderer);Object.assign(shader.uniforms,{preparedMaskPass:mode,preparedMaskFog:fog});
   shader.vertexShader='varying float vPreparedMaskDepth;\n'+shader.vertexShader.replace('#include <fog_vertex>','#include <fog_vertex>\nvPreparedMaskDepth=-mvPosition.z;');
   shader.fragmentShader='uniform bool preparedMaskPass;uniform vec2 preparedMaskFog;varying float vPreparedMaskDepth;\n'+shader.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
    if(preparedMaskPass)gl_FragColor=vec4(diffuseColor.a*(1.-smoothstep(preparedMaskFog.x,preparedMaskFog.y,vPreparedMaskDepth)),0.,0.,1.);`);
  };
  material.needsUpdate=true;
 }
 private render(camera:T.Camera){
  const r=this.renderer,roots=this.roots();if(!roots.length){this.original(this.scene,camera);return;}
  const materials=new Set<T.Material>();for(const root of roots)root.traverse(o=>{if(o instanceof T.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material]){this.prepare(m);materials.add(m);}}});
  const states=[...materials].map(material=>({material,blending:material.blending,blendEquation:material.blendEquation,blendSrc:material.blendSrc,blendDst:material.blendDst,depthWrite:material.depthWrite,depthTest:material.depthTest,depthFunc:material.depthFunc,polygonOffset:material.polygonOffset}));
  const autoClear=r.autoClear,autoReset=r.info.autoReset,shadowUpdate=r.shadowMap.autoUpdate,clear=r.getClearColor(new T.Color()),alpha=r.getClearAlpha();
  this.active=true;
  try{
   r.info.autoReset=false;if(autoReset)r.info.reset();
   for(const root of roots)root.visible=false;
   this.original(this.scene,camera);
   for(const root of roots)root.visible=true;
   r.getDrawingBufferSize(this.size);if(this.mask.width!==this.size.x||this.mask.height!==this.size.y)this.mask.setSize(this.size.x,this.size.y);
   if(this.scene.fog instanceof T.Fog)this.fog.value.set(this.scene.fog.near,this.scene.fog.far);else this.fog.value.set(1e8,1e9);
   r.autoClear=false;r.shadowMap.autoUpdate=false;r.setRenderTarget(this.mask);r.setClearColor(0,0);r.clear(true,false,false);
   // The stencil-enabled canvas and target both use DEPTH24_STENCIL8. Copy
   // existing depth, including MSAA, without a second geometry/depth pass.
   const gl=r.getContext() as WebGL2RenderingContext,framebuffer=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
   gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);
   gl.blitFramebuffer(0,0,this.size.x,this.size.y,0,0,this.size.x,this.size.y,gl.DEPTH_BUFFER_BIT,gl.NEAREST);
   gl.bindFramebuffer(gl.READ_FRAMEBUFFER,framebuffer);
   this.mode.value=true;
   for(const {material} of states){material.blending=T.CustomBlending;material.blendEquation=T.MaxEquation;material.blendSrc=T.OneFactor;material.blendDst=T.OneFactor;material.depthWrite=false;material.depthFunc=T.LessEqualDepth;}
   for(const root of roots)this.original(root,camera);
   this.mode.value=false;r.setRenderTarget(null);this.original(this.composite,this.camera);
  }finally{
   this.mode.value=false;for(const root of roots)root.visible=true;
   for(const s of states){s.material.blending=s.blending;s.material.blendEquation=s.blendEquation;s.material.blendSrc=s.blendSrc;s.material.blendDst=s.blendDst;s.material.depthWrite=s.depthWrite;s.material.depthTest=s.depthTest;s.material.depthFunc=s.depthFunc;s.material.polygonOffset=s.polygonOffset;}
   r.setRenderTarget(null);r.autoClear=autoClear;r.info.autoReset=autoReset;r.shadowMap.autoUpdate=shadowUpdate;r.setClearColor(clear,alpha);this.active=false;
  }
 }
}
