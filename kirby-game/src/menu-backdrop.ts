/** Play the recorded game scenery without creating another WebGL context. */
export function createMenuBackdrop(mount:HTMLElement){
 const video=mount.querySelector('video')!,poster=mount.querySelector('img')!;
 const started=performance.now(),motion=matchMedia('(prefers-reduced-motion: reduce)');
 let disposed=false,suspended=false,painted=false;
 const ready=()=>{
  mount.dataset.state='ready';
  if(painted||disposed)return;
  painted=true;performance.mark('kirby-menu-backdrop-ready');
  performance.measure('kirby-menu-backdrop-paint',{start:started,end:performance.now()});
 };
 const decoded=()=>{mount.classList.add('video-ready');ready();};
 const failed=()=>mount.classList.remove('video-ready');
 const sync=()=>{
  const active=document.body.classList.contains('choosing')||document.body.classList.contains('loading');
  if(disposed||suspended||!active||document.hidden||motion.matches){video.pause();return;}
  if(!video.getAttribute('src'))video.src=video.dataset.src!;
  video.muted=true;
  // A blocked autoplay or unavailable decoder leaves the fast poster visible.
  void video.play().catch(()=>{});
 };
 const observer=new MutationObserver(sync);
 const pagehide=()=>{suspended=true;video.pause();};
 const pageshow=()=>{suspended=false;sync();};
 poster.addEventListener('load',ready);video.addEventListener('loadeddata',decoded);video.addEventListener('error',failed);
 if(poster.complete&&poster.naturalWidth)ready();
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
 window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);sync();
 return {dispose(){
  disposed=true;video.pause();observer.disconnect();
  poster.removeEventListener('load',ready);video.removeEventListener('loadeddata',decoded);video.removeEventListener('error',failed);
  document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);
  window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);
 }};
}
