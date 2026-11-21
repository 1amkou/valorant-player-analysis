import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {makeZip} from '../scripts/zip-fixture.mjs';
import {PATHS} from '../site/lib/data.mjs';
import {demoDataset,demoRaw} from '../site/lib/demo.mjs';

const source=await readFile(new URL('../site/zip-worker.mjs',import.meta.url),'utf8');
async function runWorker(blob){
  const messages=[];let listen;
  const self={addEventListener(type,handler){assert.equal(type,'message');listen=handler;},postMessage(value){messages.push(structuredClone(value));}};
  vm.runInNewContext(source,{self,Blob,TextDecoder,DecompressionStream,ReadableStream,Response,Uint8Array},{filename:'zip-worker.mjs'});
  await listen({data:{file:blob}});
  return messages;
}
const entry=(type,value)=>({name:PATHS[type],data:JSON.stringify(value)});
const zip=(...entries)=>new Blob([makeZip(entries)]);

test('standalone worker produces the same dataset as the demo from a deflated ZIP',async()=>{
  const messages=await runWorker(zip(...Object.entries(demoRaw).map(([type,value])=>entry(type,value)),{name:'account/ignored.json',data:'not JSON'}));
  assert.deepEqual(messages.slice(0,-1),[
    {type:'ready'}, {type:'progress',phase:'checking'}, {type:'progress',phase:'reading'}, {type:'progress',phase:'normalizing'},
  ]);
  assert.deepEqual(messages.at(-1),{type:'success',dataset:demoDataset});
});
test('worker preserves usable categories with broken JSON, non-UTF-8 and missing files',async()=>{
  const final=(await runWorker(zip(entry('matches',[]),{name:PATHS.payments,data:'{'},{name:PATHS.reports,data:Buffer.from([0xff,0x98])}))).at(-1);
  assert.deepEqual(final,{type:'success',dataset:{matches:{status:'ready',value:[],skipped:0},reports:{status:'invalid'},payments:{status:'invalid'},store:{status:'missing'}}});
});
test('worker distinguishes broken archive, ZIP with no target, and all unparsable categories',async()=>{
  const inputs = [[new Blob(['corrupt']),'broken'],[zip({name:'other/data.json',data:'[]'}),'noTarget'],[zip(entry('matches',{differentShape:[]})),'unreadable']];
  for(const [input,code] of inputs)assert.deepEqual((await runWorker(input)).at(-1),{type:'error',code});
});
