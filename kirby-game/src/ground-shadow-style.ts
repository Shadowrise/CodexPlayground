import type {Daylight} from './day-cycle';

/** Match the established tree silhouettes across every prepared scenery layer. */
export const GROUND_SHADOW_OPACITY=.64*.8;
export function groundShadowOpacity(time:Daylight){return (.64+.10*time.night)*.8*time.shadowStrength;}
