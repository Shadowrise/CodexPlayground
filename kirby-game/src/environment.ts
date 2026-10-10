import {createBossArena} from './boss-arena';
import {createForest} from './forest';
import {createLandmarks} from './landmarks';
import {createMeadowDecor} from './meadow-decor';
import * as THREE from 'three';
import {createMountains} from './mountains';

export function addEnvironment(scene:THREE.Scene){
 const forest=createForest();scene.add(forest);
 scene.add(createMeadowDecor(forest.userData.treePositions));
 scene.add(createLandmarks());
 scene.add(createMountains());
 scene.add(createBossArena());
}
