export const EMOTE_MESSAGES={
 Hello:'приветствует всех вокруг и дружелюбно машет ручкой.',
 Joy:'радостно подпрыгивает и делится хорошим настроением со всеми!',
 Fear:'испуганно отскакивает назад и прячет личико за ручками.',
 Anger:'сердито топает ножками и недовольно ворчит на всю поляну.',
 Sad:'грустно опускает голову и тихонько вздыхает, ожидая поддержки.'
} as const;
export type LogEntry={id:string;name:string;variant:number;text:string;chat:boolean};
export function chatText(value:unknown){return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,255):'';}
export function emoteMessage(value:unknown){return typeof value==='string'&&Object.hasOwn(EMOTE_MESSAGES,value)?EMOTE_MESSAGES[value as keyof typeof EMOTE_MESSAGES]:undefined;}
