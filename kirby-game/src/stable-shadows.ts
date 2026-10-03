import {Box3,Matrix4,Vector3} from 'three';
import {CSM} from 'three/addons/csm/CSM.js';

/** CSM texel snapping with an orientation that remains defined at solar noon. */
export class StableCSM extends CSM {
  // Perpendicular to the sun/moon orbit used by daylight(). Unlike world Y,
  // this never becomes parallel to the light at noon or midnight.
  private orbitNormal=new Vector3(-.4,0,.85).normalize();
  private orientation=new Matrix4();
  private inverseOrientation=new Matrix4();
  private cameraToLight=new Matrix4();
  private bounds=new Box3();
  private center=new Vector3();
  private vertex=new Vector3();
  private origin=new Vector3();

  override update(){
    this.camera.updateMatrixWorld();
    this.orientation.lookAt(this.origin,this.lightDirection,this.orbitNormal);
    this.inverseOrientation.copy(this.orientation).invert();
    this.cameraToLight.multiplyMatrices(this.inverseOrientation,this.camera.matrixWorld);
    // Same frustum fitting and whole-texel snapping as Three's CSM.update().
    for(let i=0;i<this.frustums.length;i++){
      const light=this.lights[i],camera=light.shadow.camera,vertices=this.frustums[i].vertices;
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
