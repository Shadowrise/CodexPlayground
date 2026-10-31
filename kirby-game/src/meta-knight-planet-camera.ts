/** Keep the near plane outside the actual animated captured planet, including its atmosphere. */
export function constrainKnightPlanetCamera(position:{x:number;y:number;z:number},centre:{x:number;y:number;z:number},radius:number){
 const x=position.x-centre.x,y=position.y-centre.y,z=position.z-centre.z,d=Math.hypot(x,y,z),limit=radius+1.5;
 if(d>=limit-1e-7)return false;
 const scale=limit/(d||1);position.x=centre.x+(d?x*scale:0);position.y=centre.y+(d?y*scale:0);position.z=centre.z+(d?z*scale:limit);return true;
}
