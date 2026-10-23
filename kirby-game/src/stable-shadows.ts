import {Box3,Matrix4,Vector3} from 'three';
import type {Material} from 'three';
import {prepareShadowDepth,setupStableShadowFilter} from './shadow-filter';
import {CSM} from 'three/addons/csm/CSM.js';
import {CELESTIAL_ORBIT_NORMAL} from './day-cycle';

/** CSM texel snapping with an orientation that remains defined at solar noon. */
export class StableCSM extends CSM {
  // Perpendicular to the sun/moon orbit used by daylight(). Unlike world Y,
  // this never becomes parallel to the light at noon or midnight.
  private orbitNormal=new Vector3().fromArray(CELESTIAL_ORBIT_NORMAL);
  private orientation=new Matrix4();
  private inverseOrientation=new Matrix4();
  private cameraToLight=new Matrix4();
  private bounds=new Box3();
  private center=new Vector3();
  private vertex=new Vector3();
  private origin=new Vector3();
  farUpdateInterval=1/30;
  private farTime=-Infinity;
  private farCamera=new Matrix4();
  private farDirection=new Vector3();

  // Exposed for the optional profiler's same-scene A/B comparison only.
  readonly filterEnabled={value:true};
  private depthMaps?:ReturnType<typeof prepareShadowDepth>;

  override setupMaterial(material:Material){
    super.setupMaterial(material);
    this.depthMaps??=prepareShadowDepth(this);
    setupStableShadowFilter(material,this.depthMaps,this.filterEnabled);
  }

  override updateFrustums(){super.updateFrustums();this.farTime=-Infinity;}

  override update(time?:number){
    this.camera.updateMatrixWorld();
    this.orientation.lookAt(this.origin,this.lightDirection,this.orbitNormal);
    this.inverseOrientation.copy(this.orientation).invert();
    this.cameraToLight.multiplyMatrices(this.inverseOrientation,this.camera.matrixWorld);
    // Same frustum fitting and whole-texel snapping as Three's CSM.update().
    for(let i=0;i<this.frustums.length;i++){
      const light=this.lights[i],camera=light.shadow.camera,vertices=this.frustums[i].vertices;
      if(i>0){
        const a=this.camera.matrixWorld.elements,b=this.farCamera.elements;
        const moved=Math.hypot(a[12]-b[12],a[13]-b[13],a[14]-b[14])>.5;
        const turned=a[8]*b[8]+a[9]*b[9]+a[10]*b[10]<.99985;
        const refresh=time===undefined||!light.shadow.map||time-this.farTime>=this.farUpdateInterval||moved||turned||this.lightDirection.distanceToSquared(this.farDirection)>.00001;
        light.shadow.autoUpdate=time===undefined;light.shadow.needsUpdate=refresh;
        // The old map must retain its matching camera/light matrices as well.
        if(!refresh)continue;
        this.farTime=time??-Infinity;this.farCamera.copy(this.camera.matrixWorld);this.farDirection.copy(this.lightDirection);
      }
      camera.up.copy(this.orbitNormal);
      this.bounds.makeEmpty();
      for(const plane of [vertices.near,vertices.far])for(const point of plane){
        this.bounds.expandByPoint(this.vertex.copy(point).applyMatrix4(this.cameraToLight));
      }
      this.bounds.getCenter(this.center);this.center.z=this.bounds.max.z+this.lightMargin;
      const dx=(camera.right-camera.left)/light.shadow.mapSize.x,dy=(camera.top-camera.bottom)/light.shadow.mapSize.y;
      this.center.x=Math.floor(this.center.x/dx)*dx;
      this.center.y=Math.floor(this.center.y/dy)*dy;
      this.center.applyMatrix4(this.orientation);
      light.position.copy(this.center);light.target.position.copy(this.center).add(this.lightDirection);
    }
  }
}
