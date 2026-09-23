/** Marks the player currently simulating the shared world, not connection strength. */
export function createHostBadge(){
 const badge=document.createElement('span');badge.className='host-badge';
 badge.title='Ведущий — синхронизирует общий мир';badge.setAttribute('role','img');badge.setAttribute('aria-label',badge.title);
 badge.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r="1.3" fill="currentColor" stroke="none"/></svg>';
 return badge;
}
