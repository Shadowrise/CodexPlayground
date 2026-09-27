const encoder=new TextEncoder();
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export async function samePassword(a:string,b:string){
 const [x,y]=await Promise.all([a,b].map(v=>crypto.subtle.digest('SHA-256',encoder.encode(v))));
 const left=new Uint8Array(x),right=new Uint8Array(y);let diff=0;for(let i=0;i<left.length;i++)diff|=left[i]^right[i];return diff===0;
}
async function signature(value:string,secret:string){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,encoder.encode('kirby-admin:'+value)));}
export async function adminToken(secret:string,now=Date.now()){const value=String(now+12*3600000)+'.'+crypto.randomUUID();return value+'.'+await signature(value,secret);}
export async function validAdminToken(token:string,secret:string,now=Date.now()){
 if(!secret||token.length>200)return false;const [expires,nonce,sig,...rest]=token.split('.');
 if(rest.length||!nonce||!sig||!/^\d+$/.test(expires)||Number(expires)<=now||Number(expires)>now+12*3600000)return false;
 return samePassword(sig,await signature(expires+'.'+nonce,secret));
}
export function adminCookie(token:string,secure:boolean){return `kirby_admin=${token}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${token?43200:0}${secure?'; Secure':''}`;}
