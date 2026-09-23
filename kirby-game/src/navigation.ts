import * as T from 'three';
export type Destination={id:string;name:string;x:number;z:number;y?:number;radius?:number;group?:string};
export class Route {
 target?:Destination;
 select(id:string,places:Destination[]){this.target=places.find(p=>p.id===id);}
 update(position:T.Vector3){
  const target=this.target;if(!target)return undefined;
  const dx=target.x-position.x,dz=target.z-position.z,distance=Math.hypot(dx,dz);
  if(distance<=(target.radius??5) && Math.abs(position.y-(target.y??0))<4){this.target=undefined;return undefined;}
  return {distance,yaw:Math.atan2(dx,dz)};
 }
}
export class Wayfinder {
 readonly route=new Route();
 readonly arrow=new T.Group();
 readonly select=document.createElement('select');
 private label=document.createElement('div');
 private anchor=new T.Vector3();
 constructor(panel:HTMLElement,scene:T.Scene,places:Destination[]){
  this.select.id='destination-select';this.select.setAttribute('aria-label','Точка интереса');
  this.select.append(new Option('Выбрать место…',''));
  const groups=new Map<string,HTMLOptGroupElement>();
  for(const place of places){const name=place.group??'Приключения';if(!groups.has(name)){const group=document.createElement('optgroup');group.label=name;this.select.append(group);groups.set(name,group);}groups.get(name)!.append(new Option(place.name,place.id));}
  const field=document.createElement('label');field.textContent='Куда пойдём?';field.append(this.select);panel.prepend(field);
  this.select.addEventListener('change',()=>this.route.select(this.select.value,places));
  this.label.className='route-distance';this.label.hidden=true;document.body.append(this.label);
  const shape=new T.Shape();shape.moveTo(-.15,-.8);shape.lineTo(.15,-.8);shape.lineTo(.15,.25);shape.lineTo(.55,.25);shape.lineTo(0,1.1);shape.lineTo(-.55,.25);shape.lineTo(-.15,.25);shape.closePath();
  const geometry=new T.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.025});
  const outline=new T.Mesh(geometry,new T.MeshBasicMaterial({color:'#fffbea'}));outline.rotation.x=Math.PI/2;outline.scale.set(1.17,1.12,.9);outline.position.y=-.03;
  const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color:'#ffbf35'}));mesh.rotation.x=Math.PI/2;mesh.position.y=.04;
  this.arrow.add(outline,mesh);this.arrow.name='Destination arrow';this.arrow.visible=false;scene.add(this.arrow);
 }
 update(position:T.Vector3,size:number,camera:T.Camera){
  const direction=this.route.update(position);this.arrow.visible=!!direction;this.label.hidden=!direction;
  if(!direction){this.select.value='';return;}
  this.arrow.position.copy(position);this.arrow.position.y+=size*3.1;
  this.arrow.scale.setScalar(size);this.arrow.rotation.y=direction.yaw;
  this.anchor.copy(position);this.anchor.y+=size*3.8;this.anchor.project(camera);
  this.label.hidden=this.anchor.z>1 || this.anchor.z< -1 || Math.abs(this.anchor.x)>1 || Math.abs(this.anchor.y)>1;
  this.label.style.left=`${(this.anchor.x*.5+.5)*innerWidth}px`;this.label.style.top=`${(-this.anchor.y*.5+.5)*innerHeight}px`;
  this.label.textContent=`${Math.ceil(direction.distance)} м`;
 }
}
