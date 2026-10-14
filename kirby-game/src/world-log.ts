export const EMOTE_MESSAGES={
 Hello:'приветствует всех вокруг и дружелюбно машет ручкой.',
 Joy:'радостно подпрыгивает и делится хорошим настроением со всеми!',
 Fear:'испуганно отскакивает назад и прячет личико за ручками.',
 Anger:'сердито топает ножками и недовольно ворчит на всю поляну.',
 Sad:'грустно опускает голову и тихонько вздыхает, ожидая поддержки.'
} as const;
export type LogEntry={id:string;name:string;variant:number;text:string;chat:boolean};
export const PIDGIE_SCARE_MESSAGE='Дикий Пиджи окинул {0} голодным взглядом. Хлебушка не заметил, испугался и улетел на другую полянку.';
export const PIDGIE_INTEREST_MESSAGE='Дикий Пиджи внимательно смотрит на {0}. Что-то его очень заинтересовало.';
export function pidgieScareLog(playerName:string):LogEntry{return {id:crypto.randomUUID(),name:'',variant:-1,text:PIDGIE_SCARE_MESSAGE.replace('{0}',()=>playerName),chat:false};}
export function pidgieInterestLog(playerName:string):LogEntry{return {id:crypto.randomUUID(),name:'',variant:-1,text:PIDGIE_INTEREST_MESSAGE.replace('{0}',()=>playerName),chat:false};}
export const PIDGIE_FRIEND_MESSAGE='{0} угостил дикого Пиджи хлебушком, теперь Пиджи его лучший друг.';
export function pidgieFriendLog(playerName:string):LogEntry{return {id:crypto.randomUUID(),name:'',variant:-1,text:PIDGIE_FRIEND_MESSAGE.replace('{0}',()=>playerName),chat:false};}
export function chatText(value:unknown){return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,255):'';}
export function emoteMessage(value:unknown){return typeof value==='string'&&Object.hasOwn(EMOTE_MESSAGES,value)?EMOTE_MESSAGES[value as keyof typeof EMOTE_MESSAGES]:undefined;}
