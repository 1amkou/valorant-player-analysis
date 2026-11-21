// Normalize recognized subsets of the Riot personal data export. Unknown structures
// are not equivalent to a recognized empty list. Aliases beyond the handoff are provisional.
export const PATHS = Object.freeze({
  matches: 'valorant/valorant_match_history_uc.json',
  reports: 'valorant/valorant_grouped_reports.json',
  payments: 'valorant/valorant_payment_event_uc.json',
  store: 'valorant/valorant_purchase_event_uc.json',
});

const modes = new Map([
  ['competitive','コンペティティブ'], ['unrated','アンレート'], ['swiftplay','スイフトプレイ'],
  ['spikerush','スパイクラッシュ'], ['deathmatch','デスマッチ'], ['teamdeathmatch','チームデスマッチ'],
  ['escalation','エスカレーション'], ['replication','レプリケーション'], ['premier','プレミア（PREMIER）'],
  ['snowball','スノーボールファイト'], ['custom','カスタム'], ['range','射撃場'], ['tutorial','チュートリアル'],
  ['skirmish2v2','スカーミッシュ：2v2'],
  ['skirmishascension1v1','スカーミッシュ 1v1：Ascension'], ['skirmishascension2v2','スカーミッシュ 2v2：Ascension'],
  ['abilitydraftarena','ガントレット: グリッチ'], ['newmap','新マップ専用'],
  ['notapplicable','該当なし'], ['unknown','不明'],
]);
const modesEn = new Map([
  ['competitive','Competitive'], ['unrated','Unrated'], ['swiftplay','Swiftplay'],
  ['spikerush','Spike Rush'], ['deathmatch','Deathmatch'], ['teamdeathmatch','Team Deathmatch'],
  ['escalation','Escalation'], ['replication','Replication'], ['premier','Premier'],
  ['snowball','Snowball Fight'], ['custom','Custom'], ['range','The Range'], ['tutorial','Tutorial'],
  ['skirmish2v2','Skirmish: 2v2'],
  ['skirmishascension1v1','Skirmish 1v1: Ascension'], ['skirmishascension2v2','Skirmish 2v2: Ascension'],
  ['abilitydraftarena','Gauntlet: Glitch'], ['newmap','New map'],
  ['notapplicable','Not applicable'], ['unknown','Unknown'],
]);
const reports = new Map(Object.entries({
  ABUSING_GLITCHES:'グリッチの悪用', AFK:'離席・放置', BOTTING:'ボット使用', CHEATING:'チート行為',
  COMMS_ABUSE_TEXT:'テキストチャットでの迷惑行為', COMMS_ABUSE_VOICE:'ボイスチャットでの迷惑行為',
  INAPPROPRIATE_TEAM_NAME:'不適切なチーム名', OFFENSIVE_NAME:'不適切なプレイヤー名',
  RANK_MANIPULATION:'ランク操作', SABOTAGING_TEAM:'味方への妨害',
}));
const reportsEn = new Map(Object.entries({
  ABUSING_GLITCHES:'Abusing glitches', AFK:'AFK', BOTTING:'Botting', CHEATING:'Cheating',
  COMMS_ABUSE_TEXT:'Text chat abuse', COMMS_ABUSE_VOICE:'Voice chat abuse',
  INAPPROPRIATE_TEAM_NAME:'Inappropriate team name', OFFENSIVE_NAME:'Offensive name',
  RANK_MANIPULATION:'Rank manipulation', SABOTAGING_TEAM:'Sabotaging team',
}));
const kinds = new Map(Object.entries({ purchase:'購入', purchased:'購入', gift:'ギフト', gifted:'ギフト', giftpurchase:'ギフト購入',
  giftreceived:'受け取ったギフト', giftsent:'送ったギフト', unlock:'アンロック', unlocked:'アンロック', refund:'返金' }));
const kindsEn = new Map(Object.entries({ purchase:'Purchase', purchased:'Purchase', gift:'Gift', gifted:'Gift', giftpurchase:'Gift purchase',
  giftreceived:'Received gift', giftsent:'Sent gift', unlock:'Unlock', unlocked:'Unlock', refund:'Refund' }));
const key = s => s.toLowerCase().replace(/[^a-z0-9]/g,'');
const hasCode = code => typeof code === 'string' && code.trim().length > 0;
const knownModeLabel = (code, lang) => hasCode(code) ? (lang === 'en' ? modesEn : modes).get(modeCode(code)) : undefined;
const knownKindLabel = (code, lang) => hasCode(code) ? (lang === 'en' ? kindsEn : kinds).get(key(code)) : undefined;
// Canonical label helpers default to Japanese for internal callers and tests.
export const modeLabel = code => knownModeLabel(code, 'ja') ?? code;
export const reportLabel = code => reports.get(code.trim().toUpperCase()) ?? code;
export const kindLabel = code => knownKindLabel(code, 'ja') ?? code;
// Display helpers explain unfamiliar codes without hiding the export value.
export const modeDisplayLabel = (code, lang = 'ja') => knownModeLabel(code, lang) ?? (hasCode(code) ? (lang === 'en' ? `Unknown mode (${code})` : `不明なモード（${code}）`) : (lang === 'en' ? 'Unknown' : '不明'));
export const reportDisplayLabel = (code, lang = 'ja') => (lang === 'en' ? reportsEn : reports).get(code.trim().toUpperCase()) ?? code;
export const kindDisplayLabel = (code, lang = 'ja') => knownKindLabel(code, lang) ?? (hasCode(code) && code !== '未記録' && code !== 'Unrecorded' ? (lang === 'en' ? `Unknown type (${code})` : `不明な取引種別（${code}）`) : (lang === 'en' ? 'Unrecorded' : '未記録'));
const dateFmt = {
  ja: new Intl.DateTimeFormat('ja-JP', {timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}),
  en: new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}),
};
function parts(time, lang = 'ja') {
  return typeof time === 'number' && Number.isFinite(time) && Math.abs(time) <= 8.64e15
    ? Object.fromEntries(dateFmt[lang === 'en' ? 'en' : 'ja'].formatToParts(time).map(p=>[p.type,p.value])) : null;
}
export function tokyoMonth(time) { const p=parts(time); return p ? `${p.year}-${p.month}` : null; }
export function formatDate(time, lang = 'ja') {
  const p = parts(time, lang);
  return p ? (lang === 'en' ? `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` : `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`) : (lang === 'en' ? 'Unrecorded' : '未記録');
}

const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = (x,max=180) => typeof x==='string'&&x.trim().length ? x.trim().slice(0,max) : null;
const number = x => typeof x==='number'&&Number.isFinite(x) ? x : typeof x==='string'&&/^-?\d+(?:\.\d+)?$/.test(x.trim())&&Number.isFinite(Number(x)) ? Number(x) : null;
const nonneg = x => { const n=number(x);return n!==null&&n>=0&&n<=Number.MAX_SAFE_INTEGER?n:null; };
const units = x => { const n=nonneg(x); return Number.isSafeInteger(n) ? n : null; };
function fields(record) {
  const map = new Map(Object.entries(record).map(([k,v])=>[key(k),v]));
  return {
    has: (...names) => names.some(n=>map.has(key(n))),
    get: (...names) => { for(const name of names){const value=map.get(key(name));if(value!==undefined&&value!==null)return value;}return null; },
  };
}
const startsUTC=['game_start_time_utc','match_start_time_utc','start_time_utc','game_start_datetime_utc','match_start_datetime_utc','start_datetime_utc','game_start_utc','match_start_utc','started_at_utc','start_utc'];
const starts=['game_start_time','match_start_time','start_time','started_at','match_start','game_start','timestamp','time'];
const endsUTC=['game_end_time_utc','match_end_time_utc','end_time_utc','game_end_datetime_utc','match_end_datetime_utc','end_datetime_utc','game_end_utc','match_end_utc','ended_at_utc','end_utc'];
const ends=['game_end_time','match_end_time','end_time','ended_at','match_end','game_end'];
const dateFieldsUTC=['transaction_time_utc','transaction_datetime_utc','payment_time_utc','payment_datetime_utc','purchase_time_utc','purchase_datetime_utc','date_utc','datetime_utc','timestamp_utc','event_time_utc','event_datetime_utc','transaction_date_utc','payment_date_utc','purchase_date_utc','created_at_utc','time_utc'];
const dateFields=['transaction_time','transaction_datetime','payment_time','payment_datetime','purchase_time','purchase_datetime','date','datetime','timestamp','event_time','event_datetime','transaction_date','payment_date','purchase_date','created_at','time'];
const timestamp = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;
function parseTime(value, assumeUTC) {
  if (typeof value!=='string') return null;
  // Deliberately do not use the current device's timezone as a fallback.
  const m=value.trim().match(timestamp);
  if(!m||(!assumeUTC&&!m[8]))return null;
  const [,year,month,day,hour,minute,second='00',fraction='0',zone='Z']=m;
  const isoDay=`${year}-${month}-${day}`;
  const midnight=Date.parse(`${isoDay}T00:00:00Z`);
  if(!Number.isFinite(midnight)||new Date(midnight).toISOString().slice(0,10)!==isoDay||hour>'23'||minute>'59'||second>'59')return null;
  const tz=zone.toUpperCase()==='Z'?'Z':`${zone.slice(0,3)}:${zone.slice(-2)}`;
  const t=Date.parse(`${isoDay}T${hour}:${minute}:${second}.${fraction.padEnd(3,'0').slice(0,3)}${tz}`);
  return Number.isFinite(t)?t:null;
}
function timeFrom(f,utc,other){
  for(const [names,assume] of [[utc,true],[other,false]])for(const n of names){const t=parseTime(f.get(n),assume);if(t!==null)return t;}
  return null;
}
const modeAliases = new Map([
  ['ranked','competitive'], ['hurm','teamdeathmatch'], ['ggteam','escalation'], ['normal','unrated'],
  ['practice','range'], ['shootingrange','range'], ['therange','range'], ['customgame','custom'],
  ['newplayerexperience','tutorial'],
]);
const matchmakingTypes = new Set(['matchmaking','matchmade','matchmakinggame','matchmadegame','standard']);
const unspecifiedModes = new Set(['unknown','notapplicable']);
function modeCode(raw){
  if(!raw)return 'unknown';
  const k=key(raw);
  return modeAliases.get(k) ?? (modes.has(k)?k:raw);
}
const nonMM = new Set(['custom','range','tutorial']);
function matchRow(row){
  if(!obj(row))return null;
  const f=fields(row);
  if(!f.has(...startsUTC,...starts,...endsUTC,...ends))return null;
  const time=timeFrom(f,startsUTC,starts);
  const end=timeFrom(f,endsUTC,ends);
  const rawMode=text(f.get('queue_id','match_mode','game_mode','mode','queue','mode_name','game_mode_name'));
  const type=text(f.get('match_type','game_type','queue_type','scope'));
  let mode=modeCode(rawMode);
  const k=key(type??''); const typeMode=modeCode(type);
  const gameMode=text(f.get('game_mode'));
  const exportMode=modeCode(gameMode);
  const isExportMatchmaking=matchmakingTypes.has(key(gameMode??''));
  const mm=f.get('is_matchmaking','is_matchmade','matchmade');
  let scope='unknown';
  // In Riot's export, game_mode is the scope and game_type is the queue.
  // Keep a nonstandard queue visible under Matchmaking even if its label is unknown.
  if(isExportMatchmaking){
    scope='matchmaking';
    mode=modeCode(text(f.get('queue_id','match_mode','game_type','queue','mode')));
  }else if(nonMM.has(exportMode)||nonMM.has(typeMode)||nonMM.has(mode)||mm===false||['other','nonmatchmade','nonmatchmaking'].includes(k)){
    scope='other';if(nonMM.has(exportMode)) mode=exportMode;else if(nonMM.has(typeMode)) mode=typeMode;
  }else{
    if(mode==='unknown'&&modes.has(typeMode))mode=typeMode;
    if(mm===true||matchmakingTypes.has(k)||modes.has(mode)&&!unspecifiedModes.has(mode))scope='matchmaking';
  }
  const result=f.get('game_outcome','won','has_won','is_win','match_result','game_result','result','outcome','win','victory');
  const r=key(text(result)??'');
  return {time,duration:time!==null&&end!==null&&end>=time?end-time:null,mode,scope,
    result:result===true||['win','won','victory','true'].includes(r)?'win':result===false||['loss','lose','lost','defeat','false'].includes(r)?'loss':['draw','tie','tied'].includes(r)?'draw':'unknown'};
}
function currency(value){return text(value,24)?.toUpperCase()??'不明';}
const currencies = ['currency_code','real_currency_code','real_currency','real_currency_iso_code','payment_currency','currency'];
const paid = ['real_currency_paid_x100'];
const grantAmounts = ['game_currency_amount','game_currency_granted','game_currency_credited','game_currency_received','game_currency_purchased','virtual_currency_granted','virtual_currency_amount','vp_granted','vp_amount','paid_amount'];
const grantCurrency = ['game_currency_code','game_currency_type','game_currency_name','game_currency','virtual_currency_code','virtual_currency_type','virtual_currency'];
function grantedRows(f){
  const list=f.get('currencies_granted','granted_currencies','granted','virtual_currencies','game_currencies');
  if(Array.isArray(list))return list.filter(obj).map(g=>{const d=fields(g);return {currency:currency(d.get('currency','currency_code','currency_type','code','type')),amount:nonneg(d.get('amount','quantity','units'))};}).filter(g=>g.amount!==null);
  const amount=nonneg(f.get(...grantAmounts));
  const code=f.get(...grantCurrency)??(f.has('vp_granted','vp_amount')?'VP':null);
  return amount!==null?[{amount,currency:currency(code)}]:[];
}
function paymentRow(row){
  if(!obj(row))return null;
  const f=fields(row);
  if(!f.has(...paid,...grantAmounts,'currencies_granted','granted_currencies','granted'))return null;
  return {time:timeFrom(f,dateFieldsUTC,dateFields),currency:currency(f.get(...currencies)),amountX100:units(f.get(...paid)),granted:grantedRows(f)};
}
const storeNames=['item_name','item_display_name','item_name_english','offer_name','product_name','content_name','display_name','name'];
const storeAmounts=['spent_currency_amount','game_currency_spent','game_currency_amount_spent','game_currency_spent_amount','game_currency_cost','game_currency_amount','virtual_currency_spent','virtual_currency_amount','price_amount','quantity_spent','amount_spent','amount','cost','price'];
const storeKinds=['transaction_type','transaction_category','purchase_type','purchase_category','event_type','item_action','kind','type'];
const storeCurrencyNames = new Map([['valorantpoints','VP'], ['radianitepoints','RP'], ['kingdomcredits','KC'], ['characterrecruitmenttoken','エージェント採用トークン']]);
function unzonedStoreTime(f){
  for(const name of dateFields){
    const value=f.get(name);
    const m=typeof value==='string'&&value.trim().match(timestamp);
    if(m&&!m[8]&&parseTime(value,true)!==null)return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`;
  }
  return null;
}
function storeRow(row){
  if(!obj(row))return null;
  const f=fields(row);
  if(!f.has(...storeNames,...storeAmounts,...storeKinds))return null;
  const time=timeFrom(f,dateFieldsUTC,dateFields);
  const unit=f.get('spent_currency_name','spent_currency_code','spent_currency_type',...grantCurrency,'currency_code','currency_type','currency');
  // A present-but-null spent amount is not interchangeable with another amount field.
  const amount=f.has('spent_currency_amount')?f.get('spent_currency_amount'):f.get(...storeAmounts);
  return {time,timeUnzoned:time===null?unzonedStoreTime(f):null,name:text(f.get(...storeNames))??'名称未記録',kind:text(f.get(...storeKinds),50)??'未記録',
    itemType:text(f.get('item_type'),50),transactionSource:text(f.get('transaction_source'),100),
    currency:storeCurrencyNames.get(key(text(unit)??''))??currency(unit),amount:nonneg(amount)};
}
export function formatStoreDate(row, lang = 'ja'){
  if (row.timeUnzoned) {
    return lang === 'en' ? `${row.timeUnzoned.replaceAll('/', '-')} (time zone unknown)` : `${row.timeUnzoned}（タイムゾーン不明）`;
  }
  return formatDate(row.time, lang);
}
function list(value, names){
  if(Array.isArray(value))return value;
  if(!obj(value))return null;
  const f=fields(value), nested=f.get(...names,'data','records','events','results');
  if(Array.isArray(nested))return nested;
  if(obj(nested)){const inner=fields(nested).get(...names,'records','events','results');if(Array.isArray(inner))return inner;}
  return null;
}
const specs={matches:[matchRow,['valorant_match_history_uc','match_history','matches','games']],payments:[paymentRow,['valorant_payment_event_uc','payment_events','payment_history','payments']],store:[storeRow,['valorant_purchase_event_uc','purchase_events','purchase_history','purchases','store_transactions']]};
function normalizeList(value, type){
  const [make,names]=specs[type], rows=list(value,names);
  if(!rows)return {status:'invalid'};
  const mapped=rows.map(make).filter(Boolean);
  if(rows.length&&!mapped.length)return {status:'invalid'};
  return {status:'ready',value:mapped.sort((a,b)=>(b.time??-Infinity)-(a.time??-Infinity)),skipped:rows.length-mapped.length};
}
function normalizeCounts(value){
  if(value==null)return {value:null,invalid:0};
  const rows=Array.isArray(value)?value:obj(value)?Object.entries(value):null;
  if(!rows)return {value:null,invalid:1};
  const counts=new Map();let invalid=0;
  for(const e of rows){
    const f=obj(e)?fields(e):null;
    const code=text(Array.isArray(e)?e[0]:f?.get('reason','reason_code','report_reason','report_reason_code','report_category','report_type','category','code','type'),160);
    const n=units(Array.isArray(e)?e[1]:f?.get('count','report_count','num_reports','total','quantity'));
    const next=code===null||n===null?null:(counts.get(code)??0)+n;
    if(!Number.isSafeInteger(next)){invalid++;continue;}
    counts.set(code,next);
  }
  return {value:rows.length&&!counts.size?null:[...counts].map(([code,count])=>({code,count})).sort((a,b)=>b.count-a.count),invalid};
}
function normalizeReports(value){
  // Both null and omitted are 'データなし' directionally, not zero. An unfamiliar
  // top-level payload must not impersonate a valid empty report category.
  if(Array.isArray(value)&&value.length===1&&obj(value[0]))value=value[0];
  if(!obj(value))return {status:'invalid'};
  let f=fields(value);
  if(!f.has('reports_made','reports_received')){
    const nested=f.get('data','grouped_reports','valorant_grouped_reports');
    if(!obj(nested))return {status:'invalid'};
    f=fields(nested);
  }
  if(!f.has('reports_made','reports_received'))return {status:'invalid'};
  const made=normalizeCounts(f.get('reports_made')), received=normalizeCounts(f.get('reports_received'));
  return {status:'ready',value:{made:made.value,received:received.value},skipped:made.invalid+received.invalid};
}
export function normalizeCategory(type,value){
  if(type==='reports')return normalizeReports(value);
  return Object.hasOwn(specs,type)?normalizeList(value,type):{status:'invalid'};
}
export function summarizeMatches(rows){
  let duration=null,lastTime=null,decided=0,wins=0;const counts=new Map();
  for(const r of rows){
    if(r.duration!==null)duration=(duration??0)+r.duration;
    if(r.time!==null)lastTime=lastTime===null?r.time:Math.max(lastTime,r.time);
    if(r.mode==='competitive'&&(r.result==='win'||r.result==='loss')){decided++;if(r.result==='win')wins++;}
    counts.set(r.mode,(counts.get(r.mode)??0)+1);
  }
  return {count:rows.length,duration:rows.length?duration:0,competitiveRate:decided?wins/decided:null,lastTime,modeCounts:[...counts].map(([mode,count])=>({mode,count})).sort((a,b)=>b.count-a.count)};
}
