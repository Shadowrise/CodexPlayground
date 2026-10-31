/** Independent of the multiplayer protocol: cosmetic releases also need a refresh. */
export class ClientUpdates{
 private busy=false;
 private dismissed=new Set<string>();
 private available?:string;
 constructor(private current:string,private manifestUrl:string,private onChange:(version:string|undefined)=>void,private request:typeof fetch=fetch){}
 get availableVersion(){return this.available;}
 async check(){
  if(this.busy)return;
  this.busy=true;
  try{
   const url=new URL(this.manifestUrl);
   // Bypass both the browser cache and cached responses from earlier checks.
   url.searchParams.set('_',String(Date.now()));
   const response=await this.request(url.href,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(5000)});
   if(!response.ok)return;
   const data:unknown=await response.json();
   if(!data||typeof data!=='object'||!('version' in data)||typeof data.version!=='string'||!/^[a-zA-Z0-9._-]{1,128}$/.test(data.version))return;
   const next=data.version!==this.current&&!this.dismissed.has(data.version)?data.version:undefined;
   if(next===this.available)return;
   this.available=next;this.onChange(next);
  }catch{/* Unavailable or incomplete deployments must never interrupt a game. */}
  finally{this.busy=false;}
 }
 dismiss(){
  if(!this.available)return;
  this.dismissed.add(this.available);this.available=undefined;this.onChange(undefined);
 }
}
