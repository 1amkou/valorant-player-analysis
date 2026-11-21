import test from 'node:test';
import assert from 'node:assert/strict';
import {kindDisplayLabel,kindLabel,modeDisplayLabel,modeLabel,normalizeCategory,reportLabel} from '../site/lib/data.mjs';

const started = {game_start_time_utc:'2025-01-01 00:00:00'};

const queueLabels = [
  ['Hurm','チームデスマッチ'],
  ['Ranked','コンペティティブ'],
  ['Not Applicable','該当なし'],
  ['Deathmatch','デスマッチ'],
  ['Unrated','アンレート'],
  ['Premier','プレミア（PREMIER）'],
  ['Spike Rush','スパイクラッシュ'],
  ['Swiftplay','スイフトプレイ'],
  ['Ggteam','エスカレーション'],
  ['Skirmish2V2','スカーミッシュ：2v2'],
  ['Skirmishascension1V1','スカーミッシュ 1v1：Ascension'],
  ['Skirmishascension2V2','スカーミッシュ 2v2：Ascension'],
  ['Unknown','不明'],
  ['Abilitydraftarena','ガントレット: グリッチ'],
  ['Newmap','新マップ専用'],
];

test('Riot queue codes have Japanese labels before and after normalization',()=>{
  const {status,value}=normalizeCategory('matches',queueLabels.map(([game_type])=>({...started,game_mode:'Matchmaking',game_type})));
  assert.equal(status,'ready');
  assert.equal(value.length,queueLabels.length);
  for(const [i,[code,label]] of queueLabels.entries()){
    assert.equal(modeLabel(code),label,code);
    assert.equal(value[i].scope,'matchmaking',code);
    assert.equal(modeDisplayLabel(value[i].mode),label,code);
  }
  assert.equal(new Set(value.map(x=>x.mode)).size,queueLabels.length);
});

test('Not Applicable is not evidence of matchmaking and does not replace a practice mode',()=>{
  const {value}=normalizeCategory('matches',[
    {...started,game_type:'Not Applicable'},
    {...started,game_mode:'ShootingRange',game_type:'Not Applicable'},
  ]);
  assert.deepEqual(value.map(x=>[x.scope,modeDisplayLabel(x.mode)]),[['unknown','該当なし'],['other','射撃場']]);
});

test('unfamiliar modes and transaction kinds have Japanese UI fallbacks with the raw code',()=>{
  const queue='SAMPLE_Unfamiliar_QUEUE';
  const {value:[match]}=normalizeCategory('matches',[{...started,game_mode:'Matchmaking',game_type:queue}]);
  assert.equal(match.scope,'matchmaking');
  assert.equal(match.mode,queue);
  assert.equal(modeLabel(match.mode),queue);
  assert.equal(modeDisplayLabel(match.mode),`不明なモード（${queue}）`);
  assert.equal(modeDisplayLabel(''), '不明');
  assert.equal(kindDisplayLabel(' Gift Purchase '),'ギフト購入');
  assert.equal(kindLabel('SAMPLE_Kind'),'SAMPLE_Kind');
  assert.equal(kindDisplayLabel('SAMPLE_Kind'),'不明な取引種別（SAMPLE_Kind）');
  assert.equal(kindDisplayLabel('未記録'),'未記録');
  assert.equal(kindDisplayLabel(null),'未記録');
  assert.equal(reportLabel('  SAMPLE_REASON  '),'  SAMPLE_REASON  ');
});

test('normalized store rows keep bounded optional localization metadata',()=>{
  const {value}=normalizeCategory('store',[
    {item_name:'Fictional item',item_type:` ${'T'.repeat(51)} `,transaction_source:` ${'S'.repeat(101)} `,transaction_type:'Unlock',spent_currency_name:'Radianite Points'},
    {item_name:'Another fictional item'},
  ]);
  assert.deepEqual(value.map(({itemType,transactionSource,currency})=>[itemType,transactionSource,currency]),[
    ['T'.repeat(50),'S'.repeat(100),'RP'],
    [null,null,'不明'],
  ]);
});
