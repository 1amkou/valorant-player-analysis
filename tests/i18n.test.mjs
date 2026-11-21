import test from 'node:test';
import assert from 'node:assert/strict';
import {modeDisplayLabel, reportDisplayLabel, kindDisplayLabel, formatDate, formatStoreDate} from '../site/lib/data.mjs';
import {itemDisplayLabel} from '../site/lib/item-label.mjs';

test('English display labels localize without hiding raw codes', () => {
  assert.equal(modeDisplayLabel('competitive', 'en'), 'Competitive');
  assert.equal(modeDisplayLabel('SAMPLE_QUEUE', 'en'), 'Unknown mode (SAMPLE_QUEUE)');
  assert.equal(modeDisplayLabel('', 'en'), 'Unknown');
  assert.equal(reportDisplayLabel('AFK', 'en'), 'AFK');
  assert.equal(reportDisplayLabel('CHEATING', 'en'), 'Cheating');
  assert.equal(kindDisplayLabel('giftpurchase', 'en'), 'Gift purchase');
  assert.equal(kindDisplayLabel('未記録', 'en'), 'Unrecorded');
  assert.equal(kindDisplayLabel('SAMPLE_KIND', 'en'), 'Unknown type (SAMPLE_KIND)');
});

test('Japanese remains the default for label and date helpers', () => {
  assert.equal(modeDisplayLabel('competitive'), 'コンペティティブ');
  assert.equal(formatDate(0, 'en'), '1970-01-01 09:00');
  assert.equal(formatDate(0), '1970/01/01 09:00');
  assert.equal(formatStoreDate({timeUnzoned: '2025/06/01 12:00'}, 'en'), '2025-06-01 12:00 (time zone unknown)');
});

test('English item labels return the export name and translate bookkeeping labels', () => {
  assert.equal(itemDisplayLabel({name: 'Prime Vandal Level 2'}, 'en'), 'Prime Vandal Level 2');
  assert.equal(itemDisplayLabel({name: 'Bundle'}, 'en'), 'Item bundle (unnamed)');
  assert.equal(itemDisplayLabel({name: 'Unknown'}, 'en'), 'Unnamed item');
  assert.equal(itemDisplayLabel({name: 'X', itemType: 'BP Bundle', transactionSource: 'Ep9 Act3 Battle Pass Unlock'}, 'en'), 'Episode 9 Act 3 Battle Pass');
});
