import {normalizeCategory} from './data.mjs';

// Fictional rows only. This exercises the same normalizer used by ZIP imports.
const utc = (m,d,hhmm) => `2025-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')} ${hhmm}:00`;
const monthly = [8,11,10,13,9,14];
const matches = monthly.flatMap((n,i)=>Array.from({length:n},(_,j)=>({
  game_start_time_utc:utc(i+1,j+2,'11:30'), game_end_time_utc:j===7&&i===5?null:utc(i+1,j+2,j%5===4?'11:45':j%2===0?'12:05':'12:11'),
  game_mode:'Matchmaking', game_type:['Ranked','Ranked','Ranked','Unrated','Swiftplay'][j%5], game_outcome:j%9===8?null:j%2===0?'Win':'Loss',
})));
matches.push({game_start_time_utc:utc(6,18,'10:35'),game_end_time_utc:utc(6,18,'10:54'),game_mode:'Custom Game',game_type:'Not Applicable'}, {game_start_time_utc:utc(3,20,'11:10'),game_end_time_utc:utc(3,20,'11:18'),game_mode:'ShootingRange',game_type:'Not Applicable'});
export const demoRaw = {
  matches,
  reports:{reports_made:[['CHEATING',8],['SABOTAGING_TEAM',4],['COMMS_ABUSE_TEXT',3],['SAMPLE_OTHER',2]],reports_received:null},
  payments:[
    {payment_time_utc:utc(6,11,'13:03'),currency_code:'JPY',real_currency_paid_x100:380000,game_currency_type:'VP',game_currency_granted:3650},
    {payment_time_utc:utc(5,19,'09:21'),currency_code:'USD',real_currency_paid_x100:999,game_currency_type:'VP',game_currency_granted:1000},
    {payment_time_utc:utc(4,15,'09:02'),currency_code:'JPY',real_currency_paid_x100:240000,game_currency_type:'VP',game_currency_granted:2050},
    {payment_time_utc:utc(2,5,'03:20'),currency_code:'JPY',real_currency_paid_x100:120000,game_currency_type:'VP',game_currency_granted:1000},
  ],
  store:[
    {purchase_date:'2025-06-12T20:15:00+09:00',item_name:'Prime Vandal',spent_currency_name:'VALORANT Points',spent_currency_amount:1775,transaction_type:'Purchase'},
    {purchase_date:'2025-05-28 21:06:00.123456',item_name:'サンプルギフト B',spent_currency_name:'VALORANT Points',spent_currency_amount:null,transaction_type:'Gift Purchase'},
    {purchase_date:'2025-04-16T19:00:00+09:00',item_name:'サンプルスプレー C',spent_currency_name:'Kingdom Credits',spent_currency_amount:2000,transaction_type:'Unlock'},
    {purchase_date:'2025-04-15T20:15:00+09:00',item_name:'サンプルスキン D',spent_currency_name:'VALORANT Points',spent_currency_amount:875,transaction_type:'Purchase'},
  ],
};
export const demoDataset = Object.fromEntries(Object.entries(demoRaw).map(([type,raw])=>[type,normalizeCategory(type,raw)]));
