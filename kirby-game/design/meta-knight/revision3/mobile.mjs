import {chromium} from '../../../node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const rows=[];
  for(const [width,height] of [[390,844],[360,780],[430,932],[844,390]]) {
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await page.goto('http://127.0.0.1:5184/meta-knight-preview.html?revision=3&clip=Idle&time=0',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__metaKnightPreview);
    const audit=await page.evaluate(()=>{
      const rect=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,display:getComputedStyle(e).display};};
      const caption=rect('.stage-caption'),views=rect('.views');
      return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        caption,views,captionViewsOverlap:caption.right>views.x&&caption.x<views.right&&caption.bottom>views.y&&caption.y<views.bottom,
        buttons:[...document.querySelectorAll('.views button')].map(e=>({name:e.textContent,visible:e.getBoundingClientRect().right<=innerWidth}))};
    });
    await page.screenshot({path:out+`mobile-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Сзади',exact:true}).click();
    await page.evaluate(()=>window.__metaKnightPreview.sample('Idle',.4));
    await page.screenshot({path:out+`mobile-${width}-back.png`,fullPage:true});
    rows.push({width,height,...audit});
    await page.close();
  }
  await writeFile(out+'mobile-audit.json',JSON.stringify(rows,null,2));
  console.log(JSON.stringify(rows));
} finally {await browser.close();}
