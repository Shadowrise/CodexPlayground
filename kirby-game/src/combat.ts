import type { CharacterController } from './controller';
import type { KirbyNpc } from './npcs';
import {pushTarget} from './push-target';

/** One nearby target in front of the player per non-damaging push. */
export function resolveAttack(player: CharacterController, npcs: readonly KirbyNpc[]): KirbyNpc | undefined {
  if (!player.attackHit) return;
  player.attackHit = false;
  const chosen=pushTarget(player.actor.position.toArray(),player.yaw,player.actor.scale.x,npcs.map((n,i)=>({id:String(i),p:n.actor.position.toArray(),s:n.actor.scale.x,state:n.state})));
  const nearest=chosen?npcs[Number(chosen.id)]:undefined;
  if(nearest?.takePush(Math.sin(player.yaw),Math.cos(player.yaw)))return nearest;
}
