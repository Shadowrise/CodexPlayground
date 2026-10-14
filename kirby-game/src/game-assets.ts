export const GAME_MODEL_FILES=['kirby-animated.glb','firefly-animated.glb','shiba.glb','centipede-animated.glb','pigeon-animated.glb?v=15','bread-slice.glb'] as const;
let models:Promise<ArrayBuffer>[]|undefined;
let environment:Promise<ArrayBuffer>|undefined;

/** Start network transfers before importing or constructing the 3D scene. */
export function preloadGameAssets(base:string){
 if(!models)models=GAME_MODEL_FILES.map(file=>download(base+'models/'+file));
 if(!environment)environment=downloadEnvironment(base);
 // Failures are reported by the startup UI when the corresponding stage awaits them.
 for(const promise of [...models,environment])void promise.catch(()=>{});
 return {models,environment};
}
async function download(url:string){
 const response=await fetch(url);
 if(!response.ok)throw new Error(`Failed to load ${url}: ${response.status}`);
 return response.arrayBuffer();
}
async function downloadEnvironment(base:string){
 const response=await fetch(base+'world/environment.manifest.json',{cache:'no-cache'});
 if(!response.ok)throw new Error('The prepared meadow is unavailable');
 const manifest=await response.json() as {version:number;hash:string};
 if(manifest.version!==1||!/^[a-f0-9]{16}$/.test(manifest.hash))throw new Error('Unsupported meadow cache');
 return download(base+'world/environment.bin.gz?v='+manifest.hash);
}
