import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({build:{rollupOptions:{input:{
 game:fileURLToPath(new URL('./index.html',import.meta.url)),
 firefly:fileURLToPath(new URL('./firefly.html',import.meta.url)),
 centipede:fileURLToPath(new URL('./centipede.html',import.meta.url)),
}}}});
