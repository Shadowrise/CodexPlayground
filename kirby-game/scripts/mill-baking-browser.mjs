import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('../design/mill-bakery/',import.meta.url));await mkdir(output,{recursive:true});
const mobile=process.argv.includes('--mobile');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage(mobile?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:860}}),errors=[];
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.bakingQA={watermill,bread,renderer,scene,camera,followCamera,leave:returnToMenu,get c(){return character},get bird(){return pidgieNpc},get points(){return scoreOf(character)},set day(v){dayStart=Date.now();dayStartPhase=v}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5189/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.click('#new-game');await page.fill('#player-name-input','Пекарь');await page.click('#start-game');await page.waitForFunction(()=>bakingQA.c);await page.evaluate(()=>{bakingQA.day=.25;});
 const anchors=await page.evaluate(async()=>{const q=await import('/src/mill-quest.ts');return {lever:q.MILL_QUEST_LEVER,branches:q.MILL_BRANCHES,bags:q.MILL_BAGS,hopper:q.MILL_HOPPER,table:q.MILL_TABLE,oven:q.MILL_OVEN};});
 const move=async(p,yaw=Math.PI)=>{await page.evaluate(({p,yaw})=>{const q=bakingQA;q.c.setActivity('Idle');q.c.actor.position.fromArray(p);q.c.yaw=yaw;q.c.actor.rotation.set(0,yaw,0);q.followCamera.reset(yaw);},{p,yaw});await page.waitForTimeout(160);};
 const action=async()=>{if(mobile)await page.locator('#touch-interact').tap();else await page.keyboard.press('e');};
 assert.equal(await page.evaluate(()=>bakingQA.bread.loaf.visible),false,'there is no mountain pickup');
 await move(anchors.lever);await action();
 for(let i=0;i<3;i++){await move([anchors.branches[i][0],0,anchors.branches[i][2]-2],0);if(mobile)await page.locator('#touch-attack').tap();else await page.keyboard.press('q');await page.waitForFunction(i=>bakingQA.watermill.quest.branches[i]>0,i);await page.waitForTimeout(220);}
 await move(anchors.lever);await action();await page.waitForTimeout(180);await action();await page.waitForFunction(()=>bakingQA.watermill.quest.stage==='bags');
 const order=await page.evaluate(()=>bakingQA.watermill.quest.order);
 for(let i=0;i<3;i++){await move(anchors.bags[order[i]]);await page.waitForFunction(index=>bakingQA.watermill.quest.carried===index,order[i]);await move(anchors.hopper);await action();await page.waitForFunction(i=>bakingQA.watermill.quest.delivered===i+1,i);}
 assert.equal(await page.evaluate(()=>bakingQA.c.achievements.has('millQuest')),false,'loading grain is not the final reward');
 await action();await page.waitForFunction(()=>bakingQA.watermill.quest.kneadStep===1);
 await move(anchors.table);await action();await page.waitForFunction(()=>bakingQA.watermill.quest.kneadStep===2);
 const suffix=mobile?'-mobile':'';await page.screenshot({path:output+'kneading-stage'+suffix+'.png'});
 for(let i=0;i<3;i++){await page.waitForTimeout(490);await action();await page.waitForFunction(i=>bakingQA.watermill.quest.kneadStep===i+3,i);}
 await move(anchors.oven);await action();await page.waitForFunction(()=>bakingQA.watermill.quest.bakeAt>0);
 const before=await page.evaluate(()=>({bakeAt:bakingQA.watermill.quest.bakeAt,now:Date.now()}));
 // Save/load through the real menu while the loaf is still in the oven.
 await page.click('#settings-toggle');await page.click('#save-game');
 const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('kirby-save-v1')));assert.equal(save.millQuest.stage,'bake');assert.equal(save.bread.active,false);
 await page.evaluate(()=>bakingQA.leave());await page.click('#load-game');await page.waitForFunction(()=>bakingQA.c&&bakingQA.watermill.quest.stage==='bake');
 const restored=await page.evaluate(()=>Date.now()-bakingQA.watermill.quest.bakeAt);assert(restored<5000,'time spent outside the game does not consume baking time');
 await move(anchors.oven);await page.screenshot({path:output+'baking-stage'+suffix+'.png'});
 await page.waitForFunction(()=>Date.now()-bakingQA.watermill.quest.bakeAt>=10000);assert.equal(await page.evaluate(()=>bakingQA.bread.loaf.visible),false);
 await action();await page.waitForFunction(()=>bakingQA.watermill.quest.stage==='running'&&bakingQA.bread.holds('solo'));
 assert(await page.evaluate(()=>bakingQA.points>=6));await page.waitForTimeout(500);await page.screenshot({path:output+'bread-reward'+suffix+'.png'});
 await action();assert.equal(await page.evaluate(()=>bakingQA.watermill.quest.stage),'running');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({mobile,points:await page.evaluate(()=>bakingQA.points),savedStage:save.millQuest.stage,bakingElapsedBefore:before.now-before.bakeAt,restoredElapsed:restored,errors}));
}finally{await browser.close();}
