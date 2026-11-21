import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { makeZip } from '../scripts/zip-fixture.mjs';
import { readZip } from '../site/lib/zip.mjs';

const MiB = 1024 * 1024;
const target = 'valorant/matches.json';
const another = 'valorant/payments.json';
const entry = (name = target, options) => ({ name, method: 0, data: '[]', ...options });
const load = (bytes, targets = [target]) => readZip(new Blob([bytes]), targets);
const centralAt = (zip) => zip.readUInt32LE(zip.length - 6);
const hasRawDeflate = (() => {
  try { new DecompressionStream('deflate-raw'); return true; } catch { return false; }
})();

function zipWithDescriptor(signed, corrupt = false) {
  const zip = makeZip([entry(target, { flags: 0x808 })]);
  const at = centralAt(zip);
  const footer = Buffer.alloc(signed ? 16 : 12);
  if (signed) footer.writeUInt32LE(0x08074b50);
  zip.copy(footer, signed ? 4 : 0, at + 16, at + 28); // CRC, packed and expanded sizes
  if (corrupt) footer[footer.length - 1] ^= 1;
  zip.fill(0, 14, 26); // Size and CRC are only in the descriptor and central record.
  const result = Buffer.concat([zip.subarray(0, at), footer, zip.subarray(at)]);
  result.writeUInt32LE(at + footer.length, result.length - 6);
  return result;
}

test('selects only exact root paths and omits missing paths', async () => {
  const zip = makeZip([
    entry(), entry(`nested/${another}`), entry(`./${another}`), entry(another.toUpperCase()),
    entry('valorant\\payments.json'), entry('unrelated', { method: 99, uncompressedSize: 200 * MiB }),
    entry('__proto__'),
  ], { comment: Buffer.alloc(0xffff, 65) });
  const { entries } = await load(zip, [target, another, '__proto__']);
  assert.deepEqual(Object.keys(entries).sort(), ['__proto__', target]);
  assert.deepEqual(entries[target].bytes, new Uint8Array([91, 93]));
  assert.deepEqual(entries.__proto__.bytes, entries[target].bytes);
});

test('supports UTF-8 and legacy CP437 names without normalization', async () => {
  const zip = makeZip([
    entry('valorant/日本語.json'),
    entry(Buffer.from([0x82, 0x2e, 0x6a, 0x73, 0x6f, 0x6e]), { flags: 0 }),
  ]);
  const { entries } = await load(zip, ['valorant/日本語.json', 'é.json', 'e\u0301.json']);
  assert.deepEqual(Object.keys(entries), ['valorant/日本語.json', 'é.json']);
});

test('accepts ZIP comments containing a misleading end signature', async () => {
  const comment = makeZip([]); // Looks like an end record but has impossible offsets at this location.
  assert.deepEqual((await load(makeZip([entry()], { comment }))).entries[target].bytes, new Uint8Array([91, 93]));
});

test('accepts empty archives and signed and unsigned data descriptors', async () => {
  assert.deepEqual(Object.keys((await load(makeZip([]))).entries), []);
  for (const signed of [false, true]) {
    const { entries } = await load(zipWithDescriptor(signed));
    assert.deepEqual(entries[target].bytes, new Uint8Array([91, 93]));
  }
  assert.equal((await load(zipWithDescriptor(true, true))).entries[target].error, 'broken');
});

test('reports selected-entry corruption and unsupported features without hiding other entries', async () => {
  const malformed = [
    [entry(target, { crc: 0 }), 'broken'],
    [entry(target, { compressedSize: 1 }), 'broken'],
    [entry(target, { localName: 'valorant/anomaly.json' }), 'broken'],
    [entry(target, { compressedSize: 128, uncompressedSize: 128 }), 'broken'],
    [entry(target, { flags: 1 }), 'unsupported'],
    [entry(target, { method: 99 }), 'unsupported'],
    [entry(target, { uncompressedSize: 0xffffffff }), 'unsupported'],
  ];
  for (const [item, code] of malformed) {
    const { entries } = await load(makeZip([item, entry(another)]), [target, another]);
    assert.equal(entries[target].error, code);
    assert.deepEqual(entries[another].bytes, new Uint8Array([91, 93]));
  }
  assert.equal((await load(makeZip([entry(), entry()]))).entries[target].error, 'broken');
});

test('rejects invalid archive metadata, split archives, and ZIP64', async () => {
  const zip = makeZip([entry()]);
  await assert.rejects(load(zip.subarray(0, -1)), { code: 'broken' });
  const badCentral = Buffer.from(zip);
  badCentral.writeUInt16LE(0xffff, centralAt(badCentral) + 28);
  await assert.rejects(load(badCentral), { code: 'broken' });
  const badBounds = Buffer.from(zip);
  badBounds.writeUInt32LE(64 * MiB, badBounds.length - 6);
  await assert.rejects(load(badBounds), { code: 'broken' });
  const split = Buffer.from(zip);
  split.writeUInt16LE(1, split.length - 18);
  await assert.rejects(load(split), { code: 'unsupported' });
  const zip64 = Buffer.from(zip);
  zip64.writeUInt32LE(0xffffffff, zip64.length - 6);
  await assert.rejects(load(zip64), { code: 'unsupported' });
});

test('enforces upload, central-directory, and declared expansion limits', async () => {
  class OversizeBlob extends Blob {
    get size() { return 64 * MiB + 1; }
    slice() { assert.fail('oversize upload should not be read'); }
  }
  await assert.rejects(readZip(new OversizeBlob(), [target]), { code: 'sizeLimit' });
  const records = Array.from({ length: 4097 }, (_, i) => entry(`entry-${i}`));
  await assert.rejects(load(makeZip(records)), { code: 'sizeLimit' });
  const directory = Buffer.alloc(4 * MiB + 1);
  const end = makeZip([]);
  end.writeUInt32LE(directory.length, 12);
  await assert.rejects(readZip(new Blob([directory, end]), []), { code: 'sizeLimit' });

  const oversized = entry(target, { method: 8, uncompressedSize: 16 * MiB + 1 });
  assert.equal((await load(makeZip([oversized]))).entries[target].error, 'expandedLimit');
  const names = [target, another, 'third'];
  const total = makeZip(names.map((name) => entry(name, { method: 8, uncompressedSize: 11 * MiB })));
  await assert.rejects(load(total, names), { code: 'expandedLimit' });
});

test('reports missing native raw DEFLATE support per entry', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'DecompressionStream');
  Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, value: undefined });
  try {
    const zip = makeZip([entry(target, { method: 8 }), entry(another)]);
    const { entries } = await load(zip, [target, another]);
    assert.equal(entries[target].error, 'unsupported');
    assert.deepEqual(entries[another].bytes, new Uint8Array([91, 93]));
  } finally {
    if (original) Object.defineProperty(globalThis, 'DecompressionStream', original);
    else delete globalThis.DecompressionStream;
  }
});

test('inflates multiple input chunks and validates actual sizes and CRCs', { skip: !hasRawDeflate }, async () => {
  const data = randomBytes(48 * 1024);
  const zip = makeZip([entry(target, { method: 8, data })]);
  assert.deepEqual((await load(zip)).entries[target].bytes, new Uint8Array(data));
  for (const options of [{ crc: 0 }, { uncompressedSize: 1 }, { uncompressedSize: 3 }, { compressedSize: 1 }]) {
    const bad = makeZip([entry(target, { method: 8, ...options })]);
    assert.equal((await load(bad)).entries[target].error, 'broken');
  }
});

test('enforces combined expansion again as bytes arrive', { skip: !hasRawDeflate }, async () => {
  const data = Buffer.alloc(16 * MiB);
  const names = [target, another, 'third'];
  const zip = makeZip([
    entry(target, { method: 8, data }), entry(another, { method: 8, data }),
    entry('third', { method: 8, uncompressedSize: 0 }),
  ]);
  await assert.rejects(load(zip, names), { code: 'expandedLimit' });
});
