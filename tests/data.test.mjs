import test from 'node:test';
import assert from 'node:assert/strict';
import {formatDate,formatStoreDate,kindLabel,modeLabel,normalizeCategory,reportLabel,summarizeMatches,tokyoMonth} from '../site/lib/data.mjs';
import {demoDataset} from '../site/lib/demo.mjs';

test('JST uses explicit offsets or UTC-named fields and crosses month boundary',()=>{
  const {value}=normalizeCategory('payments',[
    {event_time_utc:'2025-01-31 16:01:00.0001',currency_code:'JPY',real_currency_paid_x100:100},
    {event_time:'2025-01-31 14:59:00Z',currency_code:'USD',real_currency_paid_x100:100},
    {event_time:'2025-04-01T00:30:00+10:00',currency_code:'JPY',real_currency_paid_x100:100},
    {event_time:'2025-04-01 00:30:00',real_currency_paid_x100:0},
  ]);
  assert.deepEqual(value.map(x=>tokyoMonth(x.time)),['2025-03','2025-02','2025-01',null]);
  assert.equal(formatDate(value[1].time),'2025/02/01 01:01');
  assert.equal(formatDate(value[3].time),'未記録');
  assert.equal(value[3].amountX100,0);
});
test('invalid calendar dates are not rolled forward',()=>{
  const {value}=normalizeCategory('store',[{transaction_time:'2025-02-29T00:00:00+00:00',item_name:'Fictional',game_currency_spent:null}]);
  assert.equal(value[0].time,null);
  assert.equal(value[0].amount,null);
});
test('scope, duration, outcomes and no-decided-outcome remain distinct',()=>{
  const row={game_start_time_utc:'2025-01-01 00:00:00',game_end_time_utc:'2025-01-01 00:30:00',queue_id:'Competitive'};
  const {value}=normalizeCategory('matches',[{...row,result:'Win'},{...row,result:'Loss'},{...row,result:'Draw'},{...row,game_end_time_utc:'2024-01-01 00:00:00'},{...row,match_type:'custom'},{...row,queue_id:'SAMPLE_MODE'}]);
  assert.deepEqual(value.map(x=>x.scope),['matchmaking','matchmaking','matchmaking','matchmaking','other','unknown']);
  assert.equal(value[4].mode,'custom');
  assert.equal(modeLabel(value[5].mode),'SAMPLE_MODE');
  assert.equal(summarizeMatches(value.slice(0,4)).duration,90*60000);
  assert.equal(summarizeMatches(value.slice(0,4)).competitiveRate,.5);
  assert.equal(summarizeMatches([value[3]]).duration,null);
  assert.equal(summarizeMatches([value[2]]).competitiveRate,null);
  assert.equal(summarizeMatches([]).duration,0);
});
test('a recognized empty list differs from unfamiliar or wholly invalid records',()=>{
  assert.deepEqual(normalizeCategory('matches',[]),{status:'ready',value:[],skipped:0});
  assert.equal(normalizeCategory('matches',{thing:[]}).status,'invalid');
  assert.equal(normalizeCategory('matches',[{game_mode:'unrated'}]).status,'invalid');
  const {status,skipped}=normalizeCategory('matches',[{game_start_time_utc:'2025-01-01 00:00:00'},{}]);
  assert.equal(status,'ready');assert.equal(skipped,1);
});
test('reports distinguish unknown codes, zero, null and broken reasons',()=>{
  const reports=normalizeCategory('reports',{reports_made:[{code:'AFK',count:2},['AFK',1],['SAMPLE_REASON',4],['CHEATING',-1]],reports_received:null});
  assert.deepEqual(reports.value,{made:[{code:'SAMPLE_REASON',count:4},{code:'AFK',count:3}],received:null});
  assert.equal(reports.skipped,1);assert.equal(reportLabel('AFK'),'離席・放置');assert.equal(reportLabel('SAMPLE_REASON'),'SAMPLE_REASON');
  assert.deepEqual(normalizeCategory('reports',{reports_received:{}}).value,{made:null,received:[]});
});
test('store and payments preserve separate currencies and missing amounts',()=>{
  assert.equal(demoDataset.payments.value.find(x=>x.currency==='USD').amountX100,999);
  assert.deepEqual(demoDataset.payments.value[0].granted,[{currency:'VP',amount:3650}]);
  assert.equal(demoDataset.store.value.find(x=>x.kind==='Gift Purchase').amount,null);
  assert.equal(kindLabel('gift'),'ギフト');
  assert.equal(demoDataset.store.value.find(x=>x.currency==='KC').amount,2000);
  assert.equal(Object.values(demoDataset).filter(x=>x.status==='ready').length,4);
});

test('Riot match exports use game_mode for scope and game_type for the queue',()=>{
  const timestamps={game_start_time_utc:'2025-02-02 10:00:00',game_end_time_utc:'2025-02-02 10:30:00'};
  const row=(game_mode,game_type,game_outcome)=>({...timestamps,game_mode,game_type,game_outcome});
  const {value}=normalizeCategory('matches',[
    row('Matchmaking','Ranked','Win'),row('Matchmaking','Ranked','Loss'),row('Matchmaking','Hurm','Win'),row('Matchmaking','SAMPLE_NEW_QUEUE','Loss'),
    row('ShootingRange','Not Applicable',null),row('Custom Game','Not Applicable',null),row('New Player Experience','Not Applicable',null),
  ]);
  assert.deepEqual(value.map(({scope,mode,result})=>[scope,mode,result]),[
    ['matchmaking','competitive','win'],['matchmaking','competitive','loss'],['matchmaking','teamdeathmatch','win'],['matchmaking','SAMPLE_NEW_QUEUE','loss'],
    ['other','range','unknown'],['other','custom','unknown'],['other','tutorial','unknown'],
  ]);
  assert.equal(summarizeMatches(value.filter(r=>r.scope==='matchmaking')).competitiveRate,.5);
});

test('Riot store exports use spent_currency fields and preserve an unzoned display date',()=>{
  const {value}=normalizeCategory('store',[
    {item_name:'Fictional A',purchase_date:'2025-01-31 18:00:06.123456',spent_currency_name:'Radianite Points',spent_currency_amount:7,transaction_type:'Unlock'},
    {item_name:'Fictional B',purchase_date:'2025-01-31 18:00:06.123Z',spent_currency_name:'VALORANT Points',spent_currency_amount:17,transaction_type:'Gift Purchase'},
    {item_name:'Fictional C',purchase_date:'2025-02-29 23:59:00',spent_currency_name:'Character Recruitment Token',spent_currency_amount:null,amount:1,transaction_type:'Purchase'},
  ]);
  assert.deepEqual(value.map(({amount,currency})=>[amount,currency]),[[17,'VP'],[7,'RP'],[null,'エージェント採用トークン']]);
  assert.equal(kindLabel(value[0].kind),'ギフト購入');
  assert.equal(formatStoreDate(value[0]),'2025/02/01 03:00');
  assert.equal(formatStoreDate(value[1]),'2025/01/31 18:00（タイムゾーン不明）');
  assert.equal(tokyoMonth(value[1].time),null);
  assert.equal(formatStoreDate(value[2]),'未記録');
});
