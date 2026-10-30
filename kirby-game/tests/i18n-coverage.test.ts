import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {translations} from '../src/i18n-catalog';
import {setLocale,t} from '../src/i18n';
import {EMOTE_MESSAGES,metaKnightSealLogs,metaKnightVictoryLog,pidgieScareLog,pidgieInterestLog,pidgieFriendLog} from '../src/world-log';
import {PRANKS} from '../src/pranks';
import {WILD_PIGEONS} from '../src/wild-pigeons';
import {TASK_NAMES} from '../src/tasks';
import {KIRBY_VARIANTS} from '../src/variants';

afterEach(()=>setLocale('ru'));

/** Enumerate literal branches; dynamic slots keep the catalog's positional syntax. */
function sources(node:ts.Node):string[]{
 if(ts.isStringLiteralLike(node))return [node.text];
 if(ts.isConditionalExpression(node))return [...sources(node.whenTrue),...sources(node.whenFalse)];
 if(ts.isTemplateExpression(node))return [node.head.text+node.templateSpans.map((span,i)=>`{${i}}${span.literal.text}`).join('')];
 return [];
}
function visit(file:URL,check:(node:ts.Node,location:string)=>void){
 const ast=ts.createSourceFile(file.pathname,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const walk=(node:ts.Node)=>{check(node,`${file.pathname}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1}`);ts.forEachChild(node,walk);};walk(ast);
}
function covered(source:string,location:string){
 if(!source||!/[А-Яа-яЁё]/.test(source))return;
 if(Object.hasOwn(translations,source))return;
 // Rendered static text such as “... players” can use a known numeric template.
 for(const language of ['en','bg'] as const){setLocale(language);assert.notEqual(t(source),source,`${location}: missing ${language} translation for ${source}`);}
}

test('literal system announcements from the server and solo game have catalog entries',()=>{
 let checked=0;
 for(const file of [new URL('../../game-server/src/index.ts',import.meta.url),new URL('../src/main.ts',import.meta.url)])visit(file,(node,location)=>{
  if(!ts.isCallExpression(node))return;
  const fn=node.expression;
  const solo=ts.isIdentifier(fn)&&fn.text==='addLocalLog';
  const server=ts.isPropertyAccessExpression(fn)&&fn.expression.kind===ts.SyntaxKind.ThisKeyword&&fn.name.text==='log';
  if(solo||server){
   const index=solo?0:1;
   if(node.arguments[index+1]?.kind===ts.SyntaxKind.TrueKeyword)return; // Player-authored chat.
   for(const source of sources(node.arguments[index])){covered(source,location);checked++;}
  }
  if(ts.isPropertyAccessExpression(fn)&&fn.name.text==='logEntry'&&node.arguments[0]&&ts.isObjectLiteralExpression(node.arguments[0])){
   for(const prop of node.arguments[0].properties)if(ts.isPropertyAssignment(prop)&&prop.name.getText()==='text')for(const source of sources(prop.initializer)){covered(source,location);checked++;}
  }
 });
 assert(checked>=10,'audit must inspect the real event producers');
});

test('literal translation calls and static game HTML have entries in every language',()=>{
 const src=new URL('../src/',import.meta.url);
 const html=(markup:string,location:string)=>{
  for(const match of markup.matchAll(/>([^<>]+)</g))covered(match[1].trim(),location);
  for(const match of markup.matchAll(/(?:title|aria-label|placeholder|label)="([^"]+)"/g))covered(match[1],location);
 };
 html(readFileSync(new URL('../index.html',import.meta.url),'utf8'),'index.html');
 for(const name of readdirSync(src).filter(name=>name.endsWith('.ts')&&!name.includes('preview')&&name!=='i18n.ts'))visit(new URL(name,src),(node,location)=>{
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='t'&&node.arguments[0])for(const source of sources(node.arguments[0]))covered(source,location);
  // These errors can be shown by the character-selection and loading screens.
  if(ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='Error'&&node.arguments?.[0])for(const source of sources(node.arguments[0]))covered(source,location);
  if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(node.left)&&node.left.name.text==='innerHTML')for(const source of sources(node.right))html(source,location);
 });
});

test('shared event families, tasks and character labels translate with literal player names',()=>{
 for(const source of [...Object.values(EMOTE_MESSAGES),...Object.values(PRANKS).flatMap(p=>[p.label,p.text]),...Object.values(TASK_NAMES),...KIRBY_VARIANTS.map(v=>v[0])])covered(source,'shared game labels');
 const name='Радуга $& {1}';
 const entries=[...metaKnightSealLogs(name,3),metaKnightVictoryLog(name),...WILD_PIGEONS.flatMap(bird=>[pidgieScareLog(name,bird),pidgieInterestLog(name,bird),pidgieFriendLog(name,bird)])];
 for(const language of ['en','bg'] as const){setLocale(language);for(const entry of entries){const result=t(entry.text);assert.notEqual(result,entry.text,entry.text);if(entry.text.includes(name))assert(result.includes(name),result);}}
});

test('mill announcements translate both separate and embedded player names',()=>{
 const name='Радуга $& {1}',source='испёк хлебушек на мельнице — над поляной закружились мыльные пузыри!';
 for(const [language,expected] of [
  ['en','baked bread at the mill — soap bubbles are dancing over the meadow!'],
  ['bg','изпече хлебче в мелницата — сапунени мехурчета се завъртяха над поляната!'],
 ] as const){setLocale(language);assert.equal(t(source),expected);assert.equal(t(`${name} ${source}`),`${name} ${expected}`);}
});

test('NPC hearts and loading errors translate character labels inside rendered templates',()=>{
 for(const [language,hearts,model] of [
  ['en','Rainbow: 2 of 3 hearts','The Ginger model has not loaded yet'],
  ['bg','Дъга: 2 от 3 живота','Моделът на Рижко още не е зареден'],
 ] as const){setLocale(language);assert.equal(t('Радуга: 2 из 3 жизней'),hearts);assert.equal(t('Модель Рыжик ещё не загрузилась'),model);}
});
