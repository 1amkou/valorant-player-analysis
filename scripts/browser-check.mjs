import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Use a fresh Chromium profile, a private loopback server, and no test dependency.
// Set VALORANT_CHROME (or pass the binary as argv[2]) on the OS running Node.
const chromium = process.argv[2] || process.env.VALORANT_CHROME || (process.platform==='win32'
  ? path.join(process.env.ProgramFiles ?? 'C:\\Program Files','Google','Chrome','Application','chrome.exe') : 'chromium');
const mime={'fonts/inter.woff2':'font/woff2','fonts/notosansjp.woff2':'font/woff2','assets/jett.png':'image/png','assets/nisyon.png':'image/png','index.html':'text/html; charset=utf-8','app.mjs':'text/javascript; charset=utf-8','styles.css':'text/css; charset=utf-8',
  'lib/data.mjs':'text/javascript; charset=utf-8','lib/demo.mjs':'text/javascript; charset=utf-8','zip-worker.mjs':'text/javascript; charset=utf-8',
  ...Object.fromEntries(['item-label','item-catalog','item-name-key','storage','i18n'].map(file=>[`lib/${file}.mjs`,'text/javascript; charset=utf-8']))};
const hit=[];
const server=createServer(async (req,res)=>{
  hit.push(`${req.method} ${req.url}`);
  const prefix='/review/';
  const key=req.url===prefix?'index.html':req.url.startsWith(prefix)?req.url.slice(prefix.length):'';
  if(req.method!=='GET'||!Object.hasOwn(mime,key)){res.writeHead(404).end();return;}
  try {res.writeHead(200,{'Content-Type':mime[key],'Cache-Control':'no-store'}).end(await readFile(new URL(`../site/${key}`,import.meta.url)));}
  catch {res.destroy();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const testUrl=`http://127.0.0.1:${server.address().port}/review/`;
const tempRoot=await realpath(tmpdir());
const prefix='valorant-browser-test-';
const profile=await mkdtemp(path.join(tempRoot,prefix));
const child=spawn(chromium,['--headless','--disable-gpu','--disable-background-networking','--no-first-run',
  '--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
let spawnError;
child.on('error',error=>{spawnError=error;});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(check,label){
  for(let attempt=0;attempt<100;attempt++){
    const result=await check();if(result)return result;
    await sleep(50);
  }
  throw Error(`Timed out: ${label}`);
}
let ws;
try {
  const port=await waitFor(async()=>{
    if(spawnError)throw spawnError;
    try{return (await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{return null;}
  },'Chrome DevTools endpoint');
  const tab=await waitFor(async()=>{
    const list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    return list.find(target=>target.type==='page');
  },'browser tab');
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let requestId=0;
  const pending=new Map(), http=[], pageErrors=[];
  ws.addEventListener('message',({data})=>{
    const msg=JSON.parse(data);
    if(msg.id){const cb=pending.get(msg.id);if(cb){pending.delete(msg.id);msg.error?cb.reject(Error(msg.error.message)):cb.resolve(msg.result);}}
    if(msg.method==='Network.requestWillBeSent'&&/^https?:/.test(msg.params.request.url))http.push(msg.params.request.url);
    if(msg.method==='Runtime.exceptionThrown')pageErrors.push(msg.params.exceptionDetails.exception?.description??msg.params.exceptionDetails.text);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++requestId;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evalJS=async expression=>{
    const {result,exceptionDetails}=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(exceptionDetails)throw Error(exceptionDetails.exception?.description??exceptionDetails.text);
    return result.value;
  };
  await send('Runtime.enable');await send('Network.enable');await send('Page.enable');await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:800,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:testUrl});
  await waitFor(()=>evalJS(`Array.from(performance.getEntriesByType('resource')).filter(e=>e.name.endsWith('/zip-worker.mjs')||e.name.endsWith('/assets/jett.png')).length===2&&document.querySelector('[data-action="demo"]')!==null`),'initial assets');
  await evalJS(`document.fonts.ready.then(()=>true)`);
  const beforeRequests=http.length,beforeHits=hit.length;
  const click=async(action,scope='')=>{
    await evalJS(`([ ...document.querySelectorAll(${JSON.stringify(`${scope} [data-action="${action}"]`.trim())}) ].find(b=>b.getClientRects().length)||(()=>{throw Error(${JSON.stringify(`Missing ${action}`)})})()).click()`);
    if(action==='confirm-clear')await waitFor(()=>evalJS(`!document.querySelector('.notice[role="status"]')`),'clear storage');
  };
  const matches=needle=>evalJS(`document.querySelector('main').innerText.includes(${JSON.stringify(needle)})`);
  const check=async needle=>assert(await matches(needle),`Missing ${needle}`);
  const isHome=()=>evalJS(`document.querySelector('.home-overview')!==null && document.querySelector('#load-phase')===null && !document.querySelector('.notice[role="status"]')`);
  const matchTotal=()=>evalJS(`document.querySelector('.metric-swords dd')?.textContent.trim()`);
  const checkSampleCount=async()=>assert.equal(await matchTotal(),'65');
  const fit=async width=>assert(await evalJS(`innerWidth===${width} && document.documentElement.scrollWidth <= ${width}`),`Horizontal overflow at ${width}px`);
  const setFilePath=async filePath=>{
    const {root}=await send('DOM.getDocument');
    const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#zip-file'});
    await send('DOM.setFileInputFiles',{nodeId,files:[filePath]});
  };
  const setFile=name=>setFilePath(fileURLToPath(new URL(`../samples/${name}.zip`,import.meta.url)));
  if(process.argv.includes('--capture')){
    const out=new URL('../aidlc-docs/construction/visual/',import.meta.url);
    await mkdir(out,{recursive:true});
    await click('demo');
    await waitFor(()=>evalJS(`!!document.querySelector('.profile-avatar')?.naturalWidth`),'profile avatar decoded');
    for(const [w,h,k] of [[1440,900,'desktop'],[390,844,'mobile']]){
      await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:k==='mobile'});
      await sleep(150);
      await fit(w);
      if(k==='desktop')await evalJS(`document.querySelector('[data-chart=home] [data-plot-point="3"]').dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));`);
      const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      await writeFile(new URL(`${k}-${w}x${h}.png`,out),Buffer.from(data,'base64'));
      if(k==='desktop')await evalJS(`document.querySelector('[data-chart=home] [data-plot-point="3"]').dispatchEvent(new PointerEvent('pointerout',{bubbles:true,pointerType:'mouse'}));`);
    }
    await click('go:more');await click('clear','main');await click('confirm-clear');
  }
  for(const width of [360,375,390,768,1024,1280,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:false});
    await fit(width);await click('go:guide','main');await check('Riot公式のデータ申請ページ');await check('中だけで読み取り・集計');await check('外部のサーバーへ送信されることはありません');
    assert.equal(await evalJS(`document.querySelector('.guide-link').href`),'https://support.riotgames.com/ja-jp/riot/data-request');
    if(width<1024){await click('toggle-menu');assert(await evalJS(`!document.querySelector('#mobile-menu').hidden`));await click('go:home','.top-in');}
    else await evalJS(`history.back()`);
    await waitFor(()=>evalJS(`!!document.querySelector('.intro [data-action=demo]')`),'return from guide');
    await click('demo');await check('サンプルデータ');await fit(width);
    assert(await evalJS(`!document.querySelector('.reload-panel')`),'Unexpected reload panel');
    assert(await evalJS(`Array.from(document.querySelectorAll('.chart,.mini-plot')).every(svg=>{const c=svg.getScreenCTM();return c&&Math.abs(c.a-c.d)<0.01})`),'Chart SVG is stretched');
    assert(await evalJS(`document.querySelectorAll('.plot-axis span').length===10 && document.querySelectorAll('.mini-months span').length>0`),'Missing readable graph labels');
    assert.equal(await evalJS(`Boolean(document.querySelector('.bottom').getClientRects().length)`),width<1024);
    assert.equal(await evalJS(`Boolean(document.querySelector('.rail').getClientRects().length)`),width>=1024);
    if(width<1024)assert(await evalJS(`Math.abs(document.querySelector('.bottom').getBoundingClientRect().bottom - innerHeight) < 1`),'Bottom nav not fixed');
    assert.equal(await evalJS(`getComputedStyle(document.querySelector('.profile-copy h1')).caretColor`),'rgba(0, 0, 0, 0)');
    await click('point:home:0','main');await check('2025年1月');
    await click('go:play');await fit(width);await check('試合一覧');
    await click('list:matches:next');await check('16–30');
    await evalJS(`{const e=document.querySelector('[data-filter="scope"]');e.selectedIndex=1;e.dispatchEvent(new Event('change',{bubbles:true}));}`);await check('カスタム');
    await click('go:more');await click('go:reports','main');await check('SAMPLE_OTHER');await check('データなし');await fit(width);
    await click('go:more');await click('go:payment','main');await check('USD');await fit(width);
    await click('go:more');await click('go:store','main');await check('プライム ヴァンダル');await check('2,650 VP');await check('未記録');await check('タイムゾーン不明');await fit(width);
    assert(await evalJS(`Array.from(document.querySelectorAll('.store-amount')).every(el=>{const range=document.createRange();range.selectNodeContents(el);const text=range.getBoundingClientRect(),box=el.getBoundingClientRect();return text.top>=box.top&&text.bottom<=box.bottom&&parseFloat(getComputedStyle(el).lineHeight)>=parseFloat(getComputedStyle(el).fontSize)*1.5})`),'Store amounts may be clipped');
    if(width<1024){
      await evalJS(`scrollTo(0,document.documentElement.scrollHeight)`);await sleep(50);
      assert(await evalJS(`getComputedStyle(document.querySelector('.top')).position==='sticky' && (document.documentElement.scrollHeight<=innerHeight || scrollY>0 && Math.abs(document.querySelector('.top').getBoundingClientRect().top)<1)`),'Mobile header does not follow scrolling');
      await click('go:home','.top-in');assert(await isHome(),'Logo did not return to home');await check('サンプルデータ');
    }
    await click('go:more');await click('clear','main');await click('close');await check('その他');
    await click('clear','main');await click('confirm-clear');await check('あなたのプレー記録');
    console.log(`${width}px: demo, filters, details, responsive navigation, clear`);
  }
  // English localization: toggle, render, persist, and restore to Japanese.
  {
    await click('toggle-lang');
    await waitFor(()=>matches('Upload data'),'English intro');
    assert.equal(await evalJS(`document.documentElement.lang`),'en','html lang not switched');
    await click('demo');
    await check('Sample data');
    await check('Total play time');
    assert(await evalJS(`document.querySelector('.profile-copy p').textContent.includes('Last played')`),'English profile');
    assert(!(await matches('対戦数')),'Japanese leaked into English view');
    await click('toggle-lang');
    await waitFor(()=>matches('サンプルデータ'),'back to Japanese');
    assert.equal(await evalJS(`document.documentElement.lang`),'ja','html lang not restored');
    assert.equal(await evalJS(`localStorage.getItem('valorant-lang')`),'ja','language preference not persisted');
    console.log('Language toggle EN/JP and persistence: PASS');
  }
  await setFile('valorant-sample');
  await waitFor(isHome,'ZIP ingestion via actual file input');
  assert(!(await matches('サンプルデータ')),'ZIP upload mistaken for demo');
  await checkSampleCount();
  await setFile('valorant-sample');await waitFor(()=>evalJS(`document.querySelector('#load-phase')===null`),'same ZIP reread');await checkSampleCount();
  await setFile('valorant-sample-broken');await waitFor(()=>matches('ZIPを開けませんでした'),'broken ZIP');await check('前の表示はそのままです');await checkSampleCount();
  await setFile('valorant-sample-no-target');await waitFor(()=>matches('VALORANTの対象データが見つかりません'),'no-target ZIP');await checkSampleCount();
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  assert.equal(await evalJS('navigator.onLine'),false,'Chrome did not switch offline');
  await setFile('valorant-sample-partial');
  await waitFor(()=>matches('一部のデータを表示できません'),'partial ZIP and fresh worker while offline');
  await check('決済履歴：読み込めませんでした');await check('ストア取引：未収録');
  await click('go:reports');await check('離席・放置');await check('0 件');
  const b64=(await readFile(new URL('../samples/valorant-sample.zip',import.meta.url))).toString('base64');
  await evalJS(`{const t=new DataTransfer();t.items.add(new File([Uint8Array.from(atob(${JSON.stringify(b64)}),c=>c.charCodeAt(0))],'fake-drop.zip'));window.dispatchEvent(new DragEvent('drop',{dataTransfer:t,bubbles:true,cancelable:true}));document.querySelector('[data-action="cancel"]').click();}`);
  await check('通報');await check('離席・放置');
  await evalJS(`{const t=new DataTransfer();t.items.add(new File([Uint8Array.from(atob(${JSON.stringify(b64)}),c=>c.charCodeAt(0))],'fake-drop.zip'));window.dispatchEvent(new DragEvent('drop',{dataTransfer:t,bubbles:true,cancelable:true}));}`);
  await waitFor(isHome,'offline drag/drop after cancellation');await checkSampleCount();
  await evalJS(`{const t=new DataTransfer();t.items.add(new File(['{bad'],'export.json',{type:'application/json'}));window.dispatchEvent(new DragEvent('drop',{dataTransfer:t,bubbles:true,cancelable:true}));}`);
  await waitFor(()=>matches('JSONを読み込めませんでした'),'invalid JSON while offline');await checkSampleCount();
  await evalJS(`{const t=new DataTransfer();t.items.add(new File(['{"reports_made":{"AFK":1},"reports_received":{}}'],'export.json',{type:'application/json'}));window.dispatchEvent(new DragEvent('drop',{dataTransfer:t,bubbles:true,cancelable:true}));}`);
  await waitFor(()=>matches('一部のデータを表示できません'),'recognized JSON while offline');
  await click('go:reports');await check('離席・放置');
  // Opt-in only for a local archive expected to contain all four categories.
  // Do not print its filename, contents, or aggregate values.
  const privateZip = (process.argv[3]?.startsWith('--') ? '' : process.argv[3]) || process.env.VALORANT_PRIVATE_ZIP;
  if(privateZip){
    await click('go:more');await click('clear','main');await click('confirm-clear');
    await setFilePath(path.resolve(privateZip));
    await waitFor(isHome,'private ZIP ingestion');
    assert(!(await matches('一部のデータを表示できません')),'Private ZIP is missing a usable category');
    assert(await evalJS(`document.querySelector('.profile-copy h1').textContent.includes('#')`),'Riot ID not shown');
    assert(await evalJS(`document.querySelector('.metric:last-child dd').textContent.includes('%')`),'Competitive win rate not shown');
    await click('go:voice');await check('文字起こしは記録されていません');
    await click('go:play');await check('コンペティティブ');
    assert(await evalJS(`document.querySelectorAll('.rows .win,.rows .loss').length>0`),'Match outcomes not shown');
    await click('go:reports');await check('送った通報');
    await click('go:payment');await check('付与された通貨');
    await click('go:store');await check('取引明細');
    assert(await evalJS(`Array.from(document.querySelectorAll('.totals dd span')).some(el=>/[0-9]/.test(el.textContent))`),'Store spend totals not shown');
    await click('go:more');await click('clear','main');await click('confirm-clear');await check('あなたのプレー記録');
    console.log('Private ZIP: all four views, match outcomes and win rate, store totals, offline processing: PASS');
  }
  assert.equal(http.length,beforeRequests,`Unexpected HTTP requests: ${http.slice(beforeRequests)}`);
  assert.equal(hit.length,beforeHits,`Unexpected server requests: ${hit.slice(beforeHits)}`);
  assert.deepEqual(pageErrors,[]);
  assert(await evalJS(`sessionStorage.length===0 && Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).every(k=>k==='valorant-lang')`),'Unexpected storage usage');
  console.log('Actual ZIP input, reread, error retention, offline partial/cancel/replacement, zero post-start HTTP requests: PASS');
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  const reload=async()=>{
    const loaded=new Promise(resolve=>{
      const listener=({data})=>{if(JSON.parse(data).method==='Page.loadEventFired'){ws.removeEventListener('message',listener);resolve();}};
      ws.addEventListener('message',listener);
    });
    await send('Page.reload',{ignoreCache:true});await loaded;
  };
  await setFile('valorant-sample');await waitFor(isHome,'saved sample import');await checkSampleCount();
  await reload();await waitFor(isHome,'restore after reload');await checkSampleCount();
  await setFile('valorant-sample-partial');await waitFor(()=>matches('一部のデータを表示できません'),'partial replacement');
  await waitFor(()=>evalJS(`!document.querySelector('.notice[role="status"]')`),'replacement saved');
  await reload();await waitFor(()=>matches('一部のデータを表示できません'),'restore replacement');await check('決済履歴：読み込めませんでした');
  await setFile('valorant-sample-broken');await waitFor(()=>matches('ZIPを開けませんでした'),'failed replacement');
  await reload();await waitFor(()=>matches('一部のデータを表示できません'),'failed replacement did not overwrite saved data');
  await click('go:more');await click('clear','main');await click('confirm-clear');await check('あなたのプレー記録');
  await reload();await waitFor(()=>matches('あなたのプレー記録'),'cleared data stays deleted');
  await click('demo');await check('サンプルデータ');await reload();await waitFor(()=>matches('あなたのプレー記録'),'demo not persisted');
  console.log('Reload restore, replacement, failed import, clear and demo privacy: PASS');
} finally {
  ws?.close();
  if(child.pid&&child.exitCode===null){
    const exited=new Promise(resolve=>child.once('exit',resolve));
    child.kill();await Promise.race([exited,sleep(1500)]);
  }
  await new Promise(resolve=>server.close(resolve));
  const resolved=await realpath(profile).catch(()=>null);
  if(resolved&&path.dirname(resolved)===tempRoot&&path.basename(resolved).startsWith(prefix))await rm(resolved,{recursive:true,force:true,maxRetries:4,retryDelay:150}).catch(()=>{});
}
