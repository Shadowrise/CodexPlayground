import {ADMIN_HTML} from './admin-page';
import {ADMIN_ICON} from './admin-icon';
import {adminCookie,adminToken,samePassword,validAdminToken} from './admin-auth';
import {soloVisit,type HistoryFilter} from './history-store';
import {validSoloReport} from '../../kirby-game/src/history-types';
const baseHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(v:unknown,status=200,extra:Record<string,string>={})=>Response.json(v,{status,headers:{...baseHeaders,...extra}});
async function smallBody(request:Request){
 const reader=request.body?.getReader();if(!reader)return '';
 const chunks:Uint8Array[]=[];let length=0;
 while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>4096){await reader.cancel();throw Error('large');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
export async function historyRoutes(request:Request,env:Env):Promise<Response|undefined>{
 const url=new URL(request.url),path=url.pathname;
 if(path==='/history/solo'){
  const cors={'Access-Control-Allow-Origin':'*'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...baseHeaders,...cors,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type'}});
  if(request.method!=='POST')return json({error:'Method not allowed'},405,cors);
  try{
   if(!(await env.HISTORY_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')??'local'})).success)return json({error:'Слишком часто'},429,cors);
   const report=JSON.parse(await smallBody(request));if(!validSoloReport(report))return json({error:'Invalid report'},400,cors);
   await env.HISTORY.getByName('archive').write([soloVisit(report)]);return new Response(null,{status:204,headers:{...baseHeaders,...cors}});
  }catch{return json({error:'Статистика временно недоступна'},503,cors);}
 }
 if(path!=='/admin'&&!path.startsWith('/admin/'))return;
 if(path==='/admin/favicon.svg'&&request.method==='GET')return new Response(ADMIN_ICON,{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
 if((path==='/admin'||path==='/admin/')&&request.method==='GET')return new Response(ADMIN_HTML,{headers:{...baseHeaders,'Content-Type':'text/html; charset=utf-8','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return json({error:'Недопустимый источник запроса'},403);
 if(path==='/admin/api/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':adminCookie('',url.protocol==='https:')});
 if(!env.ADMIN_PASSWORD)return json({error:'Пароль администратора ещё не настроен на сервере'},503);
 if(path==='/admin/api/login'&&request.method==='POST'){
  try{
   if(!(await env.ADMIN_LOGIN_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')??'local'})).success)return json({error:'Слишком много попыток. Попробуй через минуту.'},429);
   const data=JSON.parse(await smallBody(request));if(typeof data.password!=='string'||!await samePassword(data.password,env.ADMIN_PASSWORD))return json({error:'Неверный пароль'},401);
   return json({ok:true},200,{'Set-Cookie':adminCookie(await adminToken(env.ADMIN_PASSWORD),url.protocol==='https:')});
  }catch{return json({error:'Не удалось выполнить вход'},400);}
 }
 const cookie=(request.headers.get('Cookie')??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('kirby_admin='))?.slice(12)??'';
 if(!await validAdminToken(cookie,env.ADMIN_PASSWORD))return json({error:'Войди в админку'},401);
 if(path==='/admin/api/online'&&request.method==='GET'){
  try{return json(await env.ROOMS.getByName('main').adminOnline());}catch{return json({error:'Не удалось загрузить комнату'},503);}
 }
 if(['/admin/api/online/recreate','/admin/api/online/disconnect','/admin/api/online/starfall','/admin/api/online/finish'].includes(path)&&request.method==='POST'){
  let data:any;try{data=JSON.parse(await smallBody(request));}catch{return json({error:'Некорректный запрос'},400);}
  if(!data||typeof data.roomId!=='string'||!data.roomId||data.roomId.length>80||path.endsWith('/disconnect')&&(typeof data.playerId!=='string'||!data.playerId||data.playerId.length>80))return json({error:'Некорректный идентификатор'},400);
  try{const room=env.ROOMS.getByName('main'),result=path.endsWith('/recreate')?await room.adminRecreate(data.roomId):path.endsWith('/disconnect')?await room.adminDisconnect(data.roomId,data.playerId):await room.adminFestival(data.roomId,path.endsWith('/finish'));return json(result,result.ok?200:409);}catch{return json({error:'Не удалось выполнить действие. Обнови список перед повтором.'},503);}
 }
 if(path==='/admin/api/history'&&request.method==='GET'){
  const f:HistoryFilter={name:url.searchParams.get('name')?.slice(0,24),mode:url.searchParams.get('mode')??undefined};
  for(const key of ['from','to'] as const)if(url.searchParams.has(key)){const v=Number(url.searchParams.get(key));if(!Number.isFinite(v))return json({error:'Некорректная дата'},400);f[key]=v;}
  try{if(url.searchParams.has('cursor')){const c=JSON.parse(url.searchParams.get('cursor')!);if(!Number.isFinite(c.time)||typeof c.id!=='string'||c.id.length>80)throw Error();f.cursor=c;}}catch{return json({error:'Некорректная страница'},400);}
  try{return json(await env.HISTORY.getByName('archive').list(f));}catch{return json({error:'Не удалось загрузить историю. Попробуй обновить.'},503);}
 }
 return json({error:'Not found'},404);
}
