// Provisional mobile limits, in bytes unless otherwise noted. Only selected
// entries count toward the expanded limits; unrelated payloads are not extracted.
const MiB = 1024 * 1024;
const MAX_UPLOAD = 64 * MiB;
const MAX_DIRECTORY = 4 * MiB;
const MAX_RECORDS = 4096;
const MAX_ENTRY = 16 * MiB;
const MAX_EXPANDED = 32 * MiB;
const INPUT_CHUNK = 16 * 1024;

const END = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const DESCRIPTOR = 0x08074b50;
const END_LENGTH = 22;
const CENTRAL_LENGTH = 46;
const LOCAL_LENGTH = 30;
const UTF8 = 1 << 11;
const HAS_DESCRIPTOR = 1 << 3;
const SUPPORTED_FLAGS = UTF8 | HAS_DESCRIPTOR | (1 << 1) | (1 << 2);
const UINT32_MAX = 0xffffffff;

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
// Legacy ZIP names use CP437 when the UTF-8 flag is not set.
const cp437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0);
  return n;
});

function zipError(code, message) {
  return Object.assign(new Error(message), { code });
}

function updateCrc(crc, bytes) {
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return crc;
}

const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const u16 = (data, at) => data.getUint16(at, true);
const u32 = (data, at) => data.getUint32(at, true);

async function readRange(file, offset, length) {
  if (offset < 0 || length < 0 || offset + length > file.size) {
    throw zipError('broken', 'ZIP range outside the archive');
  }
  try {
    const bytes = new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
    if (bytes.length === length) return bytes;
  } catch {
    // A File may become unreadable between selection and reading.
  }
  throw zipError('broken', 'Could not read the ZIP range');
}

async function findDirectory(file) {
  if (file.size < END_LENGTH) throw zipError('broken', 'No ZIP end record');
  const tailStart = Math.max(0, file.size - END_LENGTH - 0xffff - 20);
  const tail = view(await readRange(file, tailStart, file.size - tailStart));
  let rejected;
  for (let at = tail.byteLength - END_LENGTH; at >= 0; at--) {
    if (u32(tail, at) !== END || at + END_LENGTH + u16(tail, at + 20) !== tail.byteLength) continue;
    const disk = u16(tail, at + 4);
    const centralDisk = u16(tail, at + 6);
    const diskCount = u16(tail, at + 8);
    const count = u16(tail, at + 10);
    const size = u32(tail, at + 12);
    const start = u32(tail, at + 16);
    const end = tailStart + at;
    if (disk || centralDisk || count === 0xffff || diskCount === 0xffff ||
        start === UINT32_MAX || size === UINT32_MAX ||
        (start + size !== end && at >= 20 && u32(tail, at - 20) === ZIP64_LOCATOR)) {
      rejected ??= zipError('unsupported', 'Split archives and ZIP64 are not supported');
      continue;
    }
    if (diskCount !== count || start + size !== end || count * CENTRAL_LENGTH > size) {
      // An arbitrary comment can contain a false end signature. Keep scanning.
      rejected ??= zipError('broken', 'Invalid ZIP central directory bounds');
      continue;
    }
    if (size > MAX_DIRECTORY || count > MAX_RECORDS) {
      throw zipError('sizeLimit', 'ZIP central directory exceeds the metadata limit');
    }
    return { start, size, count };
  }
  throw rejected ?? zipError('broken', 'No ZIP end record');
}

function decodeName(bytes, flags) {
  if (flags & UTF8) {
    try {
      return utf8.decode(bytes);
    } catch {
      return null; // An invalid UTF-8 name cannot match an exact target.
    }
  }
  let name = '';
  for (const byte of bytes) name += byte < 128 ? String.fromCharCode(byte) : cp437[byte - 128];
  return name;
}

async function findMatches(file, directory, targets) {
  const bytes = await readRange(file, directory.start, directory.size);
  const data = view(bytes);
  const matches = new Map();
  const offsets = new Set();
  let longestTarget = 0;
  for (const target of targets) longestTarget = Math.max(longestTarget, target.length);
  let at = 0;
  for (let i = 0; i < directory.count; i++) {
    const nameStart = at + CENTRAL_LENGTH;
    if (nameStart > bytes.length || u32(data, at) !== CENTRAL) {
      throw zipError('broken', 'Invalid ZIP central directory record');
    }
    const nameEnd = nameStart + u16(data, at + 28);
    const next = nameEnd + u16(data, at + 30) + u16(data, at + 32);
    if (next > bytes.length) throw zipError('broken', 'Truncated ZIP central directory record');
    const flags = u16(data, at + 8);
    const disk = u16(data, at + 34);
    const offset = u32(data, at + 42);
    if (disk === 0 && offset < directory.start) offsets.add(offset);
    const nameBytes = bytes.subarray(nameStart, nameEnd);
    const maxNameBytes = (flags & UTF8 ? 3 : 1) * longestTarget;
    const name = nameBytes.length <= maxNameBytes ? decodeName(nameBytes, flags) : null;
    if (targets.has(name)) {
      if (matches.has(name)) {
        matches.set(name, { error: 'broken' }); // Ambiguous; never pick an arbitrary duplicate.
      } else {
        matches.set(name, {
          nameBytes, flags, method: u16(data, at + 10), crc: u32(data, at + 16),
          compressed: u32(data, at + 20), expanded: u32(data, at + 24),
          disk, offset,
        });
      }
    }
    at = next;
  }
  if (at !== bytes.length) throw zipError('broken', 'Unexpected ZIP central directory data');

  // Bound each selected record by the next local record as well as the directory.
  // This prevents overlapping metadata from making us process the same payload repeatedly.
  const sorted = [...offsets].sort((a, b) => a - b);
  const nextOffset = new Map(sorted.map((offset, i) => [offset, sorted[i + 1] ?? directory.start]));
  for (const entry of matches.values()) entry.end = nextOffset.get(entry.offset) ?? directory.start;
  return matches;
}

function entryProblem(entry) {
  if (entry.error) return entry.error;
  if (entry.disk || entry.flags & ~SUPPORTED_FLAGS || (entry.method !== 0 && entry.method !== 8) ||
      entry.offset === UINT32_MAX || entry.compressed === UINT32_MAX || entry.expanded === UINT32_MAX) {
    return 'unsupported';
  }
  if (entry.method === 0 && entry.compressed !== entry.expanded) return 'broken';
  if (entry.expanded > MAX_ENTRY) return 'expandedLimit';
  return null;
}

async function payloadOffset(file, entry) {
  const { offset, end: recordEnd, nameBytes, flags, method, crc, compressed, expanded } = entry;
  const descriptor = (flags & HAS_DESCRIPTOR) !== 0;
  const invalid = () => zipError('broken', 'ZIP local record does not match its central record');
  if (offset + LOCAL_LENGTH > recordEnd) throw invalid();
  const data = view(await readRange(file, offset, LOCAL_LENGTH));
  if (u32(data, 0) !== LOCAL || u16(data, 6) !== flags ||
      u16(data, 8) !== method || u16(data, 26) !== nameBytes.length) throw invalid();
  const agrees = (at, expected) => u32(data, at) === expected || (descriptor && u32(data, at) === 0);
  if (!agrees(14, crc) || !agrees(18, compressed) || !agrees(22, expanded)) throw invalid();

  const nameStart = offset + LOCAL_LENGTH;
  const start = nameStart + nameBytes.length + u16(data, 28);
  const end = start + compressed;
  if (end + (descriptor ? 12 : 0) > recordEnd) throw invalid();
  const localName = await readRange(file, nameStart, nameBytes.length);
  if (localName.some((byte, i) => byte !== nameBytes[i])) throw invalid();

  if (descriptor) {
    const footer = view(await readRange(file, end, Math.min(16, recordEnd - end)));
    const matches = (at) => u32(footer, at) === crc && u32(footer, at + 4) === compressed &&
      u32(footer, at + 8) === expanded;
    if (!matches(0) && !(footer.byteLength === 16 && u32(footer, 0) === DESCRIPTOR && matches(4))) {
      throw invalid();
    }
  }
  return start;
}

// Bound the compressed chunk handed to the native inflater even in browsers
// that implement Blob.stream() with large chunks. No full input copy is made.
function compressedStream(file, start, length) {
  const end = start + length;
  let cancelled = false;
  return new ReadableStream({
    async pull(controller) {
      if (start < end) {
        const bytes = await readRange(file, start, Math.min(INPUT_CHUNK, end - start));
        if (cancelled) return;
        start += bytes.length;
        controller.enqueue(bytes);
      }
      if (start === end) controller.close();
    },
    cancel() { cancelled = true; },
  });
}

async function inflate(file, start, entry, account) {
  // Modern browsers with native raw-deflate support can import compressed ZIPs.
  // Without it, stored entries still work; there is no network-loaded fallback.
  let decoder;
  try {
    decoder = new DecompressionStream('deflate-raw');
  } catch {
    throw zipError('unsupported', 'This browser does not support raw DEFLATE');
  }
  const bytes = new Uint8Array(entry.expanded);
  const reader = compressedStream(file, start, entry.compressed).pipeThrough(decoder).getReader();
  let written = 0;
  let crc = UINT32_MAX;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      account(value.length);
      const end = written + value.length;
      if (end > MAX_ENTRY) throw zipError('expandedLimit', 'ZIP entry exceeds the expansion limit');
      if (end > bytes.length) throw zipError('broken', 'ZIP entry exceeds its declared size');
      bytes.set(value, written);
      written = end;
      crc = updateCrc(crc, value);
    }
    if (written !== bytes.length) throw zipError('broken', 'ZIP entry has the wrong expanded size');
    return { bytes, crc };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Read the requested exact paths from a local File or Blob. No extraction or network I/O. */
export async function readZip(file, targets) {
  if (file.size > MAX_UPLOAD) throw zipError('sizeLimit', 'ZIP exceeds the upload size limit');
  const directory = await findDirectory(file);
  const matches = await findMatches(file, directory, new Set(targets));
  const entries = Object.create(null);
  let declared = 0;
  for (const [name, entry] of matches) {
    const error = entryProblem(entry);
    if (error) entries[name] = { error };
    else declared += entry.expanded;
  }
  if (declared > MAX_EXPANDED) throw zipError('expandedLimit', 'Selected ZIP entries exceed the expansion limit');

  let expanded = 0;
  const account = (length) => {
    // Count even output from entries later rejected by size or CRC checks.
    expanded += length;
    if (expanded > MAX_EXPANDED) throw zipError('expandedLimit', 'ZIP exceeds the total expansion limit');
  };
  for (const [name, entry] of matches) {
    if (entries[name]) continue;
    try {
      const start = await payloadOffset(file, entry);
      let output;
      if (entry.method === 0) {
        const bytes = await readRange(file, start, entry.compressed);
        account(bytes.length);
        output = { bytes, crc: updateCrc(UINT32_MAX, bytes) };
      } else {
        output = await inflate(file, start, entry, account);
      }
      if (((output.crc ^ UINT32_MAX) >>> 0) !== entry.crc) {
        throw zipError('broken', 'ZIP entry failed its CRC check');
      }
      entries[name] = { bytes: output.bytes };
    } catch (error) {
      if (expanded > MAX_EXPANDED) throw error;
      const code = error?.code;
      entries[name] = { error: code === 'unsupported' || code === 'expandedLimit' ? code : 'broken' };
    }
  }
  return { entries };
}
