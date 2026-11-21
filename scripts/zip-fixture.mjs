import {deflateRawSync} from 'node:zlib';

// A small ZIP writer only for generating synthetic, classic (non-ZIP64) test inputs.
const table = Uint32Array.from({length:256},(_,byte)=>{
  for(let j=0;j<8;j++)byte=(byte>>>1)^((byte&1)?0xedb88320:0);
  return byte>>>0;
});
export function crc32(bytes){
  let crc=0xffffffff;
  for(const b of bytes)crc=(crc>>>8)^table[(crc^b)&255];
  return (crc^0xffffffff)>>>0;
}
export function makeZip(items,{comment=''}={}){
  const records=[],central=[];let offset=0,centralSize=0;
  for(const item of items){
    const {method=8,flags=0x800}=item;
    const bytes=Buffer.from(item.data);
    const compressed=method===8?deflateRawSync(bytes):bytes;
    const crc=item.crc??crc32(bytes);
    const ucLen=item.uncompressedSize??bytes.length, cLen=item.compressedSize??compressed.length;
    const name=Buffer.from(item.name),localName=Buffer.from(item.localName??item.name);
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
    local.writeUInt16LE(flags,6);local.writeUInt16LE(method,8);local.writeUInt16LE(0x5a21,12);
    local.writeUInt32LE(crc,14);local.writeUInt32LE(cLen,18);local.writeUInt32LE(ucLen,22);local.writeUInt16LE(localName.length,26);
    const dir=Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50,0);dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);
    dir.writeUInt16LE(flags,8);dir.writeUInt16LE(method,10);dir.writeUInt16LE(0x5a21,14);
    dir.writeUInt32LE(crc,16);dir.writeUInt32LE(cLen,20);dir.writeUInt32LE(ucLen,24);
    dir.writeUInt16LE(name.length,28);dir.writeUInt32LE(offset,42);
    records.push(local,localName,compressed);central.push(dir,name);
    offset+=local.length+localName.length+compressed.length;centralSize+=dir.length+name.length;
  }
  const end=Buffer.alloc(22),commentBytes=Buffer.from(comment);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(items.length,8);end.writeUInt16LE(items.length,10);
  end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(commentBytes.length,20);
  return Buffer.concat([...records,...central,end,commentBytes]);
}
