import {COSMIC_WORLDS} from './meta-knight-cosmic-world';
import {REFUGE_WORLDS} from './meta-knight-cosmic-refuge';
import {planetRingWork} from './meta-knight-planet-rings';
import {detailedPlanetWork} from './meta-knight-planet-detail';
import {planetFractureGeometry} from './meta-knight-planet-fracture';
import {planetNoiseTexture} from './meta-knight-cosmic-sky';

/** The arena's procedural textures and geometry, built in small resumable steps
 * while the player is still on the meadow. Every builder keeps its result for
 * the session, so entering the arena finds them ready. */
export function* arenaAssetWork():Generator<void,void,void>{
 planetNoiseTexture();yield;
 // Ring seeds follow MetaKnightCosmicSky.
 for(let index=0;index<COSMIC_WORLDS.length;index++)if('rings' in COSMIC_WORLDS[index])yield* planetRingWork(index*1.71);
 for(const index of REFUGE_WORLDS)yield* detailedPlanetWork(index);
 yield;planetFractureGeometry();
}
