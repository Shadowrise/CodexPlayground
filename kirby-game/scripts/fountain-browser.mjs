import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:860}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/');await page.waitForSelector('#startup-loader',{state:'hidden',timeout:120000});
 await page.click('#new-game');await page.fill('#player-name-input','Фонтан');await page.click('#start-game');
 await page.click('#settings-toggle');await page.click('#save-game');
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('kirby-save-v1'));s.player.x=-24;s.player.z=40;s.player.size=2;s.dayPhase=.25;localStorage.setItem('kirby-save-v1',JSON.stringify(s));});
 await page.reload();await page.waitForSelector('#startup-loader',{state:'hidden',timeout:120000});await page.click('#load-game');
 await page.waitForTimeout(5500);
 const text=await page.locator('#player-size').textContent();assert(Number.parseInt(text)<200,text);
 assert(await page.locator('#destination-select option[value="fountain"]').count());
 assert(await page.locator('#task-list').textContent().then(t=>t.includes('Покупаться в радужном фонтане')));
 await page.screenshot({path:process.env.TEMP+'/kirby-fountain-game.png'});
 // Inspect the whole model from above, without changing the actual game camera.
 const render=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{RainbowFountain}=await import('/src/fountain.ts');
  const scene=new T.Scene();scene.background=new T.Color('#9dbbd3');
  const f=new RainbowFountain();f.group.position.set(0,0,0);scene.add(f.group);
  const camera=new T.PerspectiveCamera(46,1280/860,.1,200);camera.position.set(17,15,24);camera.lookAt(0,2,0);
  scene.add(new T.HemisphereLight('#e6f3ff','#69934d',2.2));const sun=new T.DirectionalLight('#fff1db',3);sun.position.set(-10,20,15);scene.add(sun);
  const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#6f9556'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;scene.add(floor);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1280,860);renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.domElement.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(renderer.domElement);f.update(2,1);renderer.render(scene,camera);
  return renderer.info.render.calls;
 });
 await page.screenshot({path:process.env.TEMP+'/kirby-fountain-model.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({sizeAfterBath:text,drawCalls:render,errors}));
}finally{await browser.close();}
