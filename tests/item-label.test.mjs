import assert from 'node:assert/strict';
import test from 'node:test';
import {itemDisplayLabel} from '../site/lib/item-label.mjs';

const label = (name,fields={})=>itemDisplayLabel({name,...fields});
test('public Japanese game labels include skin levels and tolerate export spelling variations',()=>{
  assert.equal(label(' ＰＲＩＭＥ　Vandal '),'プライム ヴァンダル');
  assert.equal(label('Prime Vandal Level 2'),'プライム ヴァンダル Lv.2');
  assert.equal(label('Jett'),'ジェット');
  assert.equal(label('架空のスキン'),'架空のスキン');
});
test('export-only labels localize battle passes and bundle formats',()=>{
  assert.equal(label('Example BP Unlock',{itemType:'BP Bundle',transactionSource:'Ep9 Act3 Battle Pass Unlock'}),'エピソード9 アクト3 バトルパス');
  assert.equal(label('Example BP Unlock',{itemType:'BP Bundle',transactionSource:'V26 Act1 Battle Pass Unlock'}),'2026年 アクト1 バトルパス');
  assert.equal(label('VCT26 x FNC Bundle'),'2026 VCT FNC チームカプセル');
  assert.equal(label('Prime, Ep 3 Bundle'),'プライム エピソード3 セット');
});
test('unrecognized text is preserved but not passed off as a Japanese name',()=>{
  assert.equal(label('Unknown'),'アイテム名未記録');
  assert.equal(label('Bundle'),'アイテムセット（名称未記録）');
  assert.equal(label('Some new store item'),'日本語名未登録（Some new store item）');
});
