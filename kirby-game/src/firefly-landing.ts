/** Keep the released bug anchored even when an older host snapshot arrives later. */
export function validBugLanding(row:unknown):row is number[]{return Array.isArray(row)&&row.length===10&&row.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e7)&&Math.abs(row[1])<=255&&Math.abs(row[2])<=255&&Math.abs(row[4]-row[1])<.001&&Math.abs(row[6]-row[2])<.001&&row[5]===0&&row[8]===1&&row[9]>0&&row[9]<=40;}
export function reconcileBugLanding(row:number[],landing?:number[]){
 if(!landing||[1,2,3].every(i=>Math.abs(row[i]-landing[i])<.0011))return row;
 const corrected=[...landing];corrected[0]=row[0];return corrected;
}
