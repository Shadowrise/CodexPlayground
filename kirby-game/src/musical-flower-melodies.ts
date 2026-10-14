/** Complete monophonic arrangements of public-domain tunes, using the existing
 * bell samples. Reference scores: https://www.printablegarden.com/sheet-music/
 * Jingle Bells verse: music-for-music-teachers.com/jingle-bells.html.
 * No recordings, lyrics or accompaniment are copied. */
export type FlowerTone={index:number;beats:number;transpose:number};
// C..B use our C5..B5 flowers. Octave suffixes and # keep the full tune's pitch.
const score=(text:string):readonly FlowerTone[]=>text.trim().split(/\s+/).filter(token=>token!=='|').map(token=>{
 const [pitch,duration='1']=token.split(':'),match=/^([A-G])(#?)([456]?)$/.exec(pitch);
 if(!match)throw Error('Invalid flower score note: '+token);
 const beats=Number(duration);if(!Number.isFinite(beats)||beats<=0)throw Error('Invalid flower score rhythm: '+token);
 return {index:'CDEFGAB'.indexOf(match[1]),beats,transpose:(Number(match[3]||5)-5)*12+(match[2]?1:0)};
});

export const FLOWER_FULL_MELODIES={
 'Маленькая звёздочка':score(`
  C C G G A A G:2 | F F E E D D C:2 |
  G G F F E E D:2 | G G F F E E D:2 |
  C C G G A A G:2 | F F E E D D C:2
 `),
 'У Мэри был барашек':score(`
  E D C D E E E:2 | D D D:2 E G G:2 |
  E D C D E E E E | D D E D C:4
 `),
 'Брат Жак':score(`
  C D E C | C D E C | E F G:2 | E F G:2 |
  G:.5 A:.5 G:.5 F:.5 E C | G:.5 A:.5 G:.5 F:.5 E C |
  C G4 C:2 | C G4 C:2
 `),
 'Лондонский мост':score(`
  G:1.5 A:.5 G F E F G:2 | D E F:2 E F G:2 |
  G:1.5 A:.5 G F E F G:2 | D:2 G:2 E C:3
 `),
 'Ода к радости':score(`
  E E F G G F E D | C C D E E:1.5 D:.5 D:2 |
  E E F G G F E D | C C D E D:1.5 C:.5 C:2 |
  D D E C D E:.5 F:.5 E C | D E:.5 F:.5 E D C D G4:2 |
  E E F G G F E D | C C D E D:1.5 C:.5 C:2
 `),
 'При свете луны':score(`
  G G G A B:2 A:2 | G B A A G:4 |
  G G G A B:2 A:2 | G B A A G:4 |
  A A A A E:2 E:2 | A G F# E D:4 |
  G G G A B:2 A:2 | G B A A G:4
 `),
 'Горячие булочки':score(`
  B A G:2 | B A G:2 | G:.5 G:.5 G:.5 G:.5 A:.5 A:.5 A:.5 A:.5 | B A G:2
 `),
 'Греби на лодочке':score(`
  C:1.5 C:1.5 C D:.5 E:1.5 | E D:.5 E F:.5 G:3 |
  C6:.5 C6:.5 C6:.5 G:.5 G:.5 G:.5 E:.5 E:.5 E:.5 C:.5 C:.5 C:.5 |
  G F:.5 E D:.5 C:3
 `),
 'Янки Дудл':score(`
  G:.5 G:.5 A:.5 B:.5 G:.5 B:.5 A |
  D:.5 G:.5 G:.5 A:.5 B:.5 G:.5 F# |
  G:.5 G:.5 A:.5 B:.5 C6:.5 B:.5 A |
  G:.5 F#:.5 D:.5 E:.5 F#:.5 G:.5 G |
  E:.5 F#:.5 E:.5 D:.5 E:.5 F#:.5 G |
  D:.5 E:.5 D:.5 C:.5 B4 D |
  E:.5 F#:.5 E:.5 D:.5 E:.5 F#:.5 G |
  E:.5 D:.5 G:.5 F#:.5 A:.5 G:.5 G
 `),
 'Звенят колокольчики':score(`
  G4 E D C | G4:3 G4 | G4 E D C | A4:4 |
  A4 F E D | B4:4 | G G F D | C:4 |
  G4 E D C | G4:4 | G4 E D C | A4:3 A4 |
  A4 F E D | G G G G | A G F D | E:2 G:2 |
  E E E:2 E E E:2 | E G C:1.5 D:.5 E:4 |
  F F F:1.5 F:.5 F E E E:.5 E:.5 | E D D E D:2 G:2 |
  E E E:2 E E E:2 | E G C:1.5 D:.5 E:4 |
  F F F:1.5 F:.5 F E E E:.5 E:.5 | G G F D C:4
 `),
} as const;
