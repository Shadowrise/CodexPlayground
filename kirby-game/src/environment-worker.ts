import {decodeEnvironment} from './environment-format';
self.onmessage=async(event:MessageEvent<ArrayBuffer>)=>{
 try{const {doc,raw}=await decodeEnvironment(event.data);self.postMessage({doc},{transfer:[raw]});}
 catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
