import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {makeZip} from '../scripts/zip-fixture.mjs';
import * as dataLib from '../site/lib/data.mjs';
import * as zipLib from '../site/lib/zip.mjs';

const source = await readFile(new URL('../scripts/worker-core.mjs',import.meta.url),'utf8');
const profilePath = 'riotAccount/account_info.json';
const voicePath = 'valorant/valorant_audio_transcripts_uc.json';
const filename = path => path.split('/').at(-1);
const bare = new Blob(['x']);
const zip = (...items) => new Blob([makeZip(items)]);
const entry = (name,value) => ({name,data:JSON.stringify(value)});
const json = (name,value,type='') => new File([JSON.stringify(value)],name,{type});
const missing = () => Object.fromEntries(Object.keys(dataLib.PATHS).map(type=>[type,{status:'missing'}]));
const success = overrides => ({type:'success',dataset:{...missing(),...overrides}});
const error = code => ({type:'error',code});
const ready = {status:'ready',value:[],skipped:0};
const account = {game_name:'Fictional Player',tagline:'DEMO',username:'discard-login-example',email:'ignored@example.invalid',date_of_birth:'discard-date-example'};
const profile = {riotId:'Fictional Player#DEMO'};

async function run(file){
  const messages=[];let listen;
  const self={addEventListener(type,handler){assert.equal(type,'message');listen=handler;},postMessage(message){messages.push(structuredClone(message));}};
  vm.runInNewContext(source,{self,Blob,TextDecoder,dataLib,zipLib},{filename:'worker-core.mjs'});
  await listen({data:{file}});
  return messages;
}
const final = async file => (await run(file)).at(-1);

test('ZIP intake exposes only the confirmed Riot ID and empty Valorant transcript metadata',async()=>{
  const messages=await run(zip(
    entry(dataLib.PATHS.matches,[]), entry(profilePath,account), entry(voicePath,[]),
    entry('league/league_audio_transcripts_uc.json',[{ignored:'discard-voice-example'}]),
  ));
  assert.deepEqual(messages,[{type:'ready'},...['checking','reading','normalizing'].map(phase=>({type:'progress',phase})),
    success({matches:ready, profile, voice:{status:'ready',value:[]}})]);
  assert.deepEqual(await final(zip(entry(dataLib.PATHS.matches,[]),entry(profilePath,{username:'Not a Riot ID'}))),success({matches:ready}));
});

test('a ZIP with only Valorant voice exposes status even if the entry cannot be shown',async()=>{
  const cases = [
    [entry(voicePath,[]),{status:'ready',value:[]}],
    [entry(voicePath,[{unconfirmed:'synthetic text'}]),{status:'unsupported'}],
    [entry(voicePath,{transcripts:[]}),{status:'invalid'}],
    [{name:voicePath,data:'{'},{status:'invalid'}],
    [{name:voicePath,data:'[]',method:99},{status:'unsupported'}],
  ];
  for(const [item,voice] of cases)assert.deepEqual(await final(zip(item)),success({voice}));
  assert.deepEqual(await final(zip(entry('elsewhere/valorant_audio_transcripts_uc.json',[]))),error('noTarget'));
});

test('known JSON export basenames accept empty data with the correct category',async()=>{
  for(const type of ['matches','payments','store']){
    assert.deepEqual(await final(json(filename(dataLib.PATHS[type]).toUpperCase(),[])),success({[type]:ready}));
  }
  const rawReports={reports_made:[],reports_received:null};
  assert.deepEqual(await final(json(filename(dataLib.PATHS.reports),rawReports)),success({reports:dataLib.normalizeCategory('reports',rawReports)}));
  assert.deepEqual(await final(json(filename(profilePath),account)),success({profile}));
  assert.deepEqual(await final(json(filename(voicePath),[])),success({voice:{status:'ready',value:[]}}));
  assert.deepEqual(await final(json(filename(voicePath),['synthetic value'])),success({voice:{status:'unsupported'}}));
  assert.deepEqual(await final(json(filename(voicePath),null)),success({voice:{status:'invalid'}}));
});

test('renamed JSON detects narrow Riot export signatures but rejects generic or ambiguous shapes',async()=>{
  const examples = {
    matches:[{game_start_time_utc:'2026-01-01T00:00:00Z',game_mode:'Matchmaking',game_type:'Competitive'}],
    payments:[{currency_code:'JPY',real_currency_paid_x100:500,payment_time_utc:'2026-01-01T00:00:00Z'}],
    store:[{item_name:'Fictional Item',spent_currency_name:'VALORANT Points',spent_currency_amount:50}],
    reports:[{reports_received:[]}],
  };
  for(const [type,raw] of Object.entries(examples)){
    assert.deepEqual(await final(json('renamed.json',raw)),success({[type]:dataLib.normalizeCategory(type,raw)}));
  }
  assert.deepEqual(await final(new Blob([JSON.stringify(account)],{type:'application/json'})),success({profile}));
  for(const raw of [[],{},null,[{name:'Generic',amount:100,timestamp:'2026-01-01'}],
    [...examples.matches,...examples.store], {data:[]}, {username:'Not an ID'}, {riotId:'Unconfirmed#TEST'},
    {game_name:'Not#Valid',tagline:'TEST'}, {game_name:'Game Name',tagline:' '},
  ])assert.deepEqual(await final(json('renamed.json',raw)),error('unrecognizedJson'));
});

test('aggregate JSON preserves invalid and missing categories without leaking raw metadata',async()=>{
  const input={matches:[], [dataLib.PATHS.payments]:{unexpected:[]},
    [filename(voicePath).slice(0,-5)]:[{example:'not a confirmed schema'}],
    account_info:account, other:{ignore:[]}};
  assert.deepEqual(await final(json('aggregate.json',input)),success({matches:ready,payments:{status:'invalid'},
    profile,voice:{status:'unsupported'}}));
  assert.deepEqual(await final(json('aggregate.json',{matches:{unexpected:[]},payments:null})),error('unrecognizedJson'));
});

test('JSON is strictly UTF-8, has a 16 MiB byte limit, and does not reclassify ZIP errors',async()=>{
  for(const file of [new File(['{'],'broken.json'),new File([Uint8Array.of(0x22,0xc3,0x28,0x22)],'bad-utf8.json')]){
    assert.deepEqual(await run(file),[{type:'ready'},{type:'progress',phase:'checking'},{type:'progress',phase:'reading'},error('invalidJson')]);
  }
  const limit = 16 * 1024 * 1024;
  const spaces = new Uint8Array(limit-2).fill(0x20);
  assert.deepEqual(await final(new File(['[]',spaces],filename(voicePath))),success({voice:{status:'ready',value:[]}}));
  const tooBig = new File(['[]',spaces,' '],filename(voicePath));
  tooBig.arrayBuffer = () => assert.fail('oversized JSON was read');
  assert.deepEqual(await final(tooBig),error('sizeLimit'));
  assert.deepEqual(await final(bare),error('broken'));
  assert.deepEqual(await final(new File(['[]'],'corrupt.zip',{type:'application/json'})),error('broken'));
});
