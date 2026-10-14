/** Yield to painting and input between independent startup stages. */
export function startupTask(){return new Promise<void>(resolve=>setTimeout(resolve,0));}
export function startupFrame(){return new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
