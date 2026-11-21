// Included inside the standalone worker build, without external imports.
const decoder = new TextDecoder('utf-8', {fatal:true});
const knownZipErrors = new Set(['broken','unsupported','sizeLimit','expandedLimit']);
const maxJsonBytes = 16 * 1024 * 1024;
const categoryTypes = Object.keys(dataLib.PATHS);
const intakePaths = {
  ...dataLib.PATHS,
  profile:'riotAccount/account_info.json',
  voice:'valorant/valorant_audio_transcripts_uc.json',
};
const intakeTypes = Object.keys(intakePaths);
const basename = name => name.split(/[/\\]/).at(-1);
const names = new Map(intakeTypes.map(type=>[basename(intakePaths[type]).toLowerCase(),type]));
const aggregateAliases = {
  matches:['match_history'], reports:['grouped_reports'], payments:['payment_events'],
  store:['purchase_events'], profile:['account'], voice:[],
};
const aggregateKeys = Object.fromEntries(intakeTypes.map(type=>{
  const path = intakePaths[type], name = basename(path);
  return [type,[path,name,name.slice(0,-5),type,...aggregateAliases[type]]];
}));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasAny = (value,...keys) => keys.some(key=>Object.hasOwn(value,key));
const missingCategories = () => Object.fromEntries(categoryTypes.map(type=>[type,{status:'missing'}]));
const parse = bytes => JSON.parse(decoder.decode(bytes));

function riotId(value){
  // These two fields in Riot's account_info.json form the public Riot ID. Do
  // not use the login username, another field, or the selected file's name.
  if(!object(value)||!Object.hasOwn(value,'game_name')||!Object.hasOwn(value,'tagline'))return null;
  const {game_name,tagline}=value;
  const component = s => typeof s === 'string' && s.trim() && !/[#\u0000-\u001f\u007f-\u009f]/.test(s);
  return component(game_name)&&component(tagline) ? `${game_name.trim()}#${tagline.trim()}` : null;
}
function addValue(dataset,type,value){
  if(type==='profile'){
    const id = riotId(value);
    if(id!==null)dataset.profile={riotId:id};
  }else if(type==='voice'){
    // A real export confirms only an empty transcript array, not row fields.
    dataset.voice = Array.isArray(value)
      ? value.length ? {status:'unsupported'} : {status:'ready',value:[]}
      : {status:'invalid'};
  }else{
    dataset[type]=dataLib.normalizeCategory(type,value);
  }
}
function hasUsableData(dataset){
  return !!(dataset.voice || dataset.profile || categoryTypes.some(type=>dataset[type].status==='ready'));
}

async function intakeZip(file,progress){
  const targets = Object.values(intakePaths);
  const {entries} = await zipLib.readZip(file,targets);
  if(!targets.some(path=>Object.hasOwn(entries,path)))return {type:'error',code:'noTarget'};
  progress('normalizing');
  const dataset = missingCategories();
  for(const type of intakeTypes){
    const entry=entries[intakePaths[type]];
    if(!entry)continue;
    const invalid = reason => {
      if(type==='voice')dataset.voice={status:reason==='unsupported'?'unsupported':'invalid'};
      else if(type!=='profile')dataset[type]=reason ? {status:'invalid',reason} : {status:'invalid'};
    };
    if(entry.error)invalid(entry.error);
    else{
      try{addValue(dataset,type,parse(entry.bytes));}
      catch{invalid();}
    }
  }
  if(hasUsableData(dataset))return {type:'success',dataset};
  const invalid = categoryTypes.map(type=>dataset[type]).filter(category=>category.status==='invalid');
  const code = ['unsupported','expandedLimit'].find(reason=>invalid.length&&invalid.every(category=>category.reason===reason)) ?? 'unreadable';
  return {type:'error',code};
}

const reportSignature = value => object(value)&&hasAny(value,'reports_made','reports_received');
function arrayType(rows){
  if(rows.length===1&&reportSignature(rows[0]))return 'reports';
  const types = new Set();
  for(const row of rows){
    if(!object(row))continue;
    if(Object.hasOwn(row,'game_start_time_utc')&&hasAny(row,'game_end_time_utc','game_mode','game_type'))types.add('matches');
    if(Object.hasOwn(row,'real_currency_paid_x100')&&hasAny(row,'currency_code','payment_time_utc'))types.add('payments');
    if(Object.hasOwn(row,'item_name')&&hasAny(row,'spent_currency_name','spent_currency_amount'))types.add('store');
    if(types.size>1)return undefined;
  }
  return types.values().next().value;
}
function jsonValues(value,name){
  const namedType = names.get(name);
  if(namedType)return [[namedType,value]];
  if(Array.isArray(value)){
    const type = arrayType(value);
    return type ? [[type,value]] : [];
  }
  if(!object(value))return [];
  const values = [];
  for(const type of intakeTypes){
    const key = aggregateKeys[type].find(key=>Object.hasOwn(value,key));
    if(key!==undefined)values.push([type,value[key]]);
    else if(type==='reports'&&reportSignature(value))values.push([type,value]);
    else if(type==='profile'&&riotId(value)!==null)values.push([type,value]);
  }
  return values;
}
async function intakeJson(file,name,progress){
  if(file.size>maxJsonBytes)return {type:'error',code:'sizeLimit'};
  let value;
  try{value=parse(await file.arrayBuffer());}
  catch{return {type:'error',code:'invalidJson'};}
  const values = jsonValues(value,name);
  if(!values.length)return {type:'error',code:'unrecognizedJson'};
  progress('normalizing');
  const dataset = missingCategories();
  for(const [type,raw] of values)addValue(dataset,type,raw);
  return hasUsableData(dataset) ? {type:'success',dataset} : {type:'error',code:'unrecognizedJson'};
}

self.addEventListener('message', async ({data}) => {
  const file = data?.file;
  if (!(file instanceof Blob)) {self.postMessage({type:'error',code:'broken'});return;}
  const progress = phase => self.postMessage({type:'progress',phase});
  progress('checking');
  try {
    progress('reading');
    const name = typeof file.name === 'string' ? basename(file.name).toLowerCase() : '';
    const json = name.endsWith('.json') || !name.endsWith('.zip') && /^(application|text)\/json$/i.test(file.type);
    self.postMessage(await (json ? intakeJson(file,name,progress) : intakeZip(file,progress)));
  } catch (error) {self.postMessage({type:'error',code:knownZipErrors.has(error?.code)?error.code:'unreadable'});}
});
self.postMessage({type:'ready'});
