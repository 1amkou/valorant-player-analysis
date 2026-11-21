import {mkdir,writeFile} from 'node:fs/promises';
import {PATHS} from '../site/lib/data.mjs';
import {demoRaw} from '../site/lib/demo.mjs';
import {makeZip} from './zip-fixture.mjs';

const sampleDir = new URL('../samples/',import.meta.url);
const cases = {
  'valorant-sample': [...Object.entries(PATHS).map(([type,name])=>({name,data:JSON.stringify(demoRaw[type],null,2)})),
    {name:'valorant/valorant_audio_transcripts_uc.json',data:'[]'},
    {name:'sample/not-read.json',data:'{ intentionally not JSON }'}],
  'valorant-sample-partial': [
    {name:PATHS.matches,data:JSON.stringify(demoRaw.matches)},
    {name:PATHS.reports,data:JSON.stringify({reports_made:{AFK:1},reports_received:{}})},
    {name:PATHS.payments,data:'{ broken JSON'},
  ],
  'valorant-sample-no-target': [{name:'example/sample.json',data:'[]',method:0}],
};
await mkdir(sampleDir,{recursive:true});
for(const [name,entries] of Object.entries(cases))await writeFile(new URL(`${name}.zip`,sampleDir),makeZip(entries));
await writeFile(new URL('valorant-sample-broken.zip',sampleDir), 'This deliberately broken sample contains no personal data.\n');
console.log('Generated 4 entirely fictional ZIP test cases in samples/.');
