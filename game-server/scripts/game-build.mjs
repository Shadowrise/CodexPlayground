import {readFile} from 'node:fs/promises';
const protocol=await readFile(new URL('../../kirby-game/src/network-protocol.ts',import.meta.url),'utf8');
export const BUILD=/export const BUILD\s*=\s*['"]([^'"]+)['"]/.exec(protocol)?.[1];
if(!BUILD)throw new Error('Cannot read the shared game build for the smoke checks');
