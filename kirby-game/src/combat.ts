import type { CharacterController } from './controller';
import type { KirbyNpc } from './npcs';

/** One nearby living target in front of the player per punch. */
export function resolveAttack(player: CharacterController, npcs: readonly KirbyNpc[]): KirbyNpc | undefined {
  if (!player.attackHit) return;
  player.attackHit = false;
  let nearest: KirbyNpc | undefined;
  let closest = 3.1 * player.actor.scale.x;
  for (const npc of npcs) {
    if (npc.isDown) continue;
    const dx = npc.actor.position.x - player.actor.position.x;
    const dz = npc.actor.position.z - player.actor.position.z;
    const distance = Math.hypot(dx, dz);
    const facing = (dx * Math.sin(player.yaw) + dz * Math.cos(player.yaw)) / Math.max(distance, .001);
    if (distance < closest && (distance < .1 || facing >= Math.cos(Math.PI / 3))) {
      closest = distance;
      nearest = npc;
    }
  }
  if (nearest?.takeHit()) return nearest;
}
