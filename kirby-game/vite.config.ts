import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {environmentBakePlugin} from './scripts/environment-bake-plugin.mjs';
export default defineConfig({plugins:[environmentBakePlugin()],build:{target:'es2022',rollupOptions:{input:{
 game:fileURLToPath(new URL('./index.html',import.meta.url)),
 firefly:fileURLToPath(new URL('./firefly.html',import.meta.url)),
 centipede:fileURLToPath(new URL('./centipede.html',import.meta.url)),
 pigeon:fileURLToPath(new URL('./pigeon-preview.html',import.meta.url)),
 metaKnight:fileURLToPath(new URL('./meta-knight-preview.html',import.meta.url)),
}}}});
