import {createBossArena} from './boss-arena';
import {createForest} from './forest';
import {createLandmarks} from './landmarks';
import {createMeadowDecor} from './meadow-decor';
import * as THREE from 'three';
import {createMountains} from './mountains';

export function addEnvironment(scene:THREE.Scene){
 const forest=createForest();
 const roots=[forest,createMeadowDecor(forest.userData.treePositions,forest.userData.meadowLayout),createLandmarks(forest.userData.meadowLayout,forest.userData.treePositions),createMountains(),createBossArena()];
 scene.add(...roots);return roots;
}
