export const LANDMARKS = Array.from({length:25},(_,i) => ({
  x: i===16 ? -45 : i===12 ? 32 : (i%5-2)*94 + Math.sin(i*8)*9,
  z: i===16 ? 0 : i===12 ? 34 : (Math.floor(i/5)-2)*94 + Math.cos(i*5)*9,
  kind: (i===12 ? 0 : i%6), radius: (i===12 || i%6===0) ? 25 : 15,
}));
