import type {Input} from './controller';

// Arcade handling: quick acceleration, short coasting and looser grip at speed.
const ACCELERATION_SECONDS=.7;
const COAST_SECONDS=.55;
const BRAKE_SECONDS=.24;
const TURN_RATE=Math.PI*.55;
const STEP=1/120;

export class FireflyDrive {
  speed=0;
  private travelYaw=0;

  reset(yaw:number){this.speed=0;this.travelYaw=yaw;}

  move(position:{x:number;z:number},yaw:number,dt:number,input:Input,forwardSpeed:number,backwardSpeed:number){
    const throttle=Number(input.forward)-Number(!!input.backward);
    const steer=Math.max(-1,Math.min(1,input.steer??(Number(input.left)-Number(input.right))));
    // Small fixed-size steps keep both the turn arc and braking consistent at
    // different frame rates, including a frame that crosses zero speed.
    for(let remaining=Math.max(0,dt);remaining>1e-9;){
      const step=Math.min(STEP,remaining);remaining-=step;
      const previousSpeed=this.speed,previousTravel=this.travelYaw;
      const limit=this.speed<0?backwardSpeed:forwardSpeed;
      const braking=throttle*this.speed<0;
      const target=braking?0:throttle*(throttle>0?forwardSpeed:backwardSpeed);
      const rate=!throttle?limit/COAST_SECONDS:braking?limit/BRAKE_SECONDS:(throttle>0?forwardSpeed:backwardSpeed)/ACCELERATION_SECONDS;
      this.speed+=Math.sign(target-this.speed)*Math.min(Math.abs(target-this.speed),rate*step);
      yaw+=steer*TURN_RATE*step;
      const ratio=Math.min(1,Math.abs(this.speed)/forwardSpeed);
      const grip=18+(5.5-18)*ratio;
      const difference=Math.atan2(Math.sin(yaw-this.travelYaw),Math.cos(yaw-this.travelYaw));
      if(previousSpeed===0)this.travelYaw=yaw;
      else this.travelYaw+=difference*(1-Math.exp(-grip*step));
      const travel=previousSpeed===0?this.travelYaw:(previousTravel+this.travelYaw)*.5,distance=(previousSpeed+this.speed)*.5*step;
      position.x+=Math.sin(travel)*distance;position.z+=Math.cos(travel)*distance;
    }
    return yaw;
  }
}
