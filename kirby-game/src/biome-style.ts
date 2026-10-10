import type {Biome} from './forest';

/** Shared background palette: ground, undergrowth and crowns belong to the
 * same colour family. Playable characters and rewards keep their own colours. */
export const BIOME_STYLE={
 spruce:{ground:'#506f5b',grass:['#2c503c','#3b6048','#506f52'],leaf:'#31543f',flowers:['#aaa4c0','#d8d4cf'],cap:'#b58b5c',bush:'#35573f',canopySaturation:.42,canopyLightness:.36},
 birch:{ground:'#708f59',grass:['#526e42','#68834e','#7f9863'],leaf:'#4b693b',flowers:['#e0ddc9','#889dbb'],cap:'#bd8057',bush:'#587443',canopySaturation:.36,canopyLightness:.34},
 orchard:{ground:'#5f8954',grass:['#446d43','#59804b','#73955d'],leaf:'#426a3b',flowers:['#dba3b4','#ded09b'],cap:'#ae8c5c',bush:'#496f42',canopySaturation:.4,canopyLightness:.34},
 autumn:{ground:'#828a5b',grass:['#646d44','#807e4e','#8d7a51'],leaf:'#707044',flowers:['#ccb678','#c79a80'],cap:'#b88e5e',bush:'#7d6b44',canopySaturation:.44,canopyLightness:.35},
} satisfies Record<Biome,{ground:string;grass:string[];leaf:string;flowers:string[];cap:string;bush:string;canopySaturation:number;canopyLightness:number}>;

// Quiet soil/stone tones echo each biome without competing with characters.
export const BIOME_TERRAIN={
 spruce:{path:'#88623f',bank:'#777c63',rock:'#8a9799',foothill:'#687f6b'},
 birch:{path:'#a57951',bank:'#a09a7b',rock:'#aaa99a',foothill:'#859573'},
 orchard:{path:'#9c7047',bank:'#919371',rock:'#9ba399',foothill:'#77916d'},
 autumn:{path:'#a0734b',bank:'#94816b',rock:'#a19382',foothill:'#948c6b'},
} satisfies Record<Biome,{path:string;bank:string;rock:string;foothill:string}>;
