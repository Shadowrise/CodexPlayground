import {randomUUID} from 'node:crypto';

/** Each published client carries the same ID in its code and read-only manifest. */
export function clientVersionPlugin(){
 const version=randomUUID();
 return {
  name:'kirby-client-version',apply:'build',
  config(){return {define:{'import.meta.env.KIRBY_CLIENT_VERSION':JSON.stringify(version)}};},
  generateBundle(){this.emitFile({type:'asset',fileName:'client-version.json',source:JSON.stringify({version})+'\n'});},
 };
}
