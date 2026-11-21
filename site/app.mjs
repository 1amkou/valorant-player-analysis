// VALORANT player data viewer — browser-side UI controller.
//
// Responsibilities
//   * Render every screen (intro, home, details, guide, voice) from normalized data.
//   * Own the import flow: file/drag input -> web worker -> dataset -> local storage.
//   * Persist only normalized display data in IndexedDB so a reload restores the view.
//
// Privacy invariants
//   * The original ZIP/JSON never leaves this device and is never stored.
//   * Only the normalized dataset (labels, numbers, dates) is saved locally.
//   * Clearing data removes both the on-screen state and the saved copy.
//
// The app uses plain ES modules with no framework, so it ships as a static site
// under a strict Content-Security-Policy with no UI build step.

import {demoDataset} from './lib/demo.mjs';
import {modeDisplayLabel, reportLabel, kindDisplayLabel, tokyoMonth, formatDate, formatStoreDate, summarizeMatches} from './lib/data.mjs';
import {itemDisplayLabel} from './lib/item-label.mjs';
import {loadSavedData, saveData, clearSavedData} from './lib/storage.mjs';

const app = document.querySelector('#app');
const picker = document.querySelector('#zip-file');
const dialog = document.querySelector('#confirm');
const announce = document.querySelector('#announce');
const titles = {home:'ホーム', play:'プレー記録', reports:'通報', payment:'課金', store:'ストア取引', voice:'ボイスチャット', guide:'使い方', more:'その他'};
const pages = ['home','play','reports','payment','store','voice','guide'];
const homePages = ['reports', 'payment', 'store', 'voice', 'guide'];
const requestUrl = 'https://support.riotgames.com/ja-jp/riot/data-request';
// Lucide (ISC), with a separate Valorant mark.
const icons = {
  brand:'<path fill="currentColor" stroke="none" d="M2 3v8.2l9.3 9.3h6.2L2 3Zm20 0-8.5 9.7h6.7l1.8-1.8V3Z"/>',
  home:'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
  play:'<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />',
  more:'<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />',
  reports:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />',
  payment:'<rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />',
  store:'<circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />',
  upload:'<path d="M12 13v8" /><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="m8 17 4-4 4 4" />',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" />',
  trophy:'<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />',
  next:'<path d="m9 18 6-6-6-6" />',
  menu:'<line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />',
  reload:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />',
  voice:'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" />',
  guide:'<path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />',
  swords:'<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /><line x1="13" x2="19" y1="19" y2="13" /><line x1="16" x2="20" y1="16" y2="20" /><line x1="19" x2="21" y1="21" y2="19" /><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" /><line x1="5" x2="9" y1="14" y2="18" /><line x1="7" x2="4" y1="17" y2="20" /><line x1="3" x2="5" y1="19" y2="21" />',
  recent:'<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />'
};
const phases = {
  checking:'ファイルの形式を確認中…', reading:'必要なデータを読み込み中…', normalizing:'ダッシュボードを準備中…'
};
const errors = {
  broken:['ZIPを開けませんでした', 'ZIPが破損しているか、正しくダウンロードできていない可能性があります。'],
  unsupported:['対応していないZIP形式です', 'Riotから受け取った元のZIPを、解凍せずに選んでください。'],
  sizeLimit:['ZIPのサイズまたは構成が上限を超えています', 'ZIPファイルの大きさ、または中に含まれるファイルの一覧が、読み込み可能な範囲を超えています。'],
  expandedLimit:['展開するデータ量が上限を超えています', 'ファイルのサイズにかかわらず、展開に必要なデータ量が多すぎるため、読み込めません。'],
  noTarget:['VALORANTの対象データが見つかりません', 'Riotから受け取ったVALORANTの記録を含むZIPを選んでください。'],
  unreadable:['対象データを読み込めません', '対象ファイルは見つかりましたが、解析できませんでした。'],
  multiple:['ファイルは1つずつ開いてください', '複数のファイルから、読み込むファイルを1つ選んでください。'],
  startup:['ZIPの読み込み機能を準備できませんでした', 'ネットワークに接続した状態でページを開き直してください。デモは引き続き利用できます。'],
  worker:['ファイルの読み込みを完了できませんでした', 'もう一度試すか、別のファイルを選んでください。'],
  jsonSizeLimit:['JSONのサイズが上限を超えています', '16 MiB以下の対象JSON、または元のZIPを選んでください。'],
  invalidJson:['JSONを読み込めませんでした', 'ファイルの内容が正しいJSONになっているか確認してください。'],
  unrecognizedJson:['対応するデータがJSONに見つかりません', 'Riotから取得した元のZIPか、対象のVALORANT JSONを選んでください。']
};
const zoneNote = '日時・月別集計は日本時間（JST）。日時やタイムゾーンを確認できない記録は「未記録」と表示します。';
const numberFormat = new Intl.NumberFormat('ja-JP', {maximumFractionDigits:2});
const percentFormat = new Intl.NumberFormat('ja-JP', {style:'percent', minimumFractionDigits:1, maximumFractionDigits:1});
const moneyFormatters = new Map();
const categoryLabels = {matches:'対戦履歴', reports:'通報集計', payments:'決済履歴', store:'ストア取引'};
const resultLabels = {win:'勝ち', loss:'負け', draw:'引き分け', unknown:'不明'};
const filtersInitial = () => ({scope:'matchmaking', period:null, mode:null, currency:null});
// Single source of truth for the UI. `dataset` holds normalized categories, or
// null before anything is loaded; `view` is the active screen key from `views`.
const state = {dataset:null, demo:false, view:'home', reading:null, error:null, storageWarning:null, storageBusy:false, loadedAt:null, menuOpen:false, filters:filtersInitial(), charts:{}, offsets:{}};
const chartModels = new Map();
const filterOptions = new Map();
const monthCache = new WeakMap();
const monthOf = row => {
  if (!monthCache.has(row)) monthCache.set(row, tokyoMonth(row.time));
  return monthCache.get(row);
};
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const finite = Number.isFinite;
const number = value => numberFormat.format(value);
const count = (value, unit = '件') => `${number(value)} ${unit}`;
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const button = (action, text, kind = '', attrs = '') => `<button type="button" class="button ${kind}" data-action="${action}" ${attrs}${(action === 'open' && workerPreparing) || (state.storageBusy && ['open','demo','clear'].includes(action)) ? ' disabled' : ''}>${text}</button>`;
const empty = text => `<p class="empty">${escape(text)}</p>`;
const card = (title, html, link = '', classes = '') => `<section class="card ${classes}"><div class="card-head"><h2>${title}</h2>${link}</div>${html}</section>`;
const category = key => state.dataset?.[key];
const isReady = key => category(key)?.status === 'ready';
const rows = key => isReady(key) ? category(key).value : [];
const brand = () => `<div class="brand"><span class="mark">${icon('brand')}</span><div><strong>VALORANT</strong><small>Player Analytics</small></div></div>`;
const detail = (key, label = '詳細を見る', action = `go:${key}`) => button(action, `${label}${icon('next')}`, 'text-button', `aria-label="${titles[key]}の${label}"`);
const badge = () => state.demo ? '<span class="badge sample">サンプルデータ</span>' : '';
const heading = (title, info = '') => `<header class="headline"><div class="headline-title"><h1 id="page-title" tabindex="-1">${title}</h1>${badge()}</div>${info ? `<p>${info}</p>` : ''}</header>`;
const timezone = () => `<p class="fine-print">${zoneNote}</p>`;
const totals = items => `<dl class="totals">${items.map(([label, val]) => `<div><dt>${label}</dt><dd>${val}</dd></div>`).join('')}</dl>`;
const announceText = text => { announce.textContent = text; };

function money(amount, currency) {
  if (!finite(amount)) return '未記録';
  if (!/^[A-Z]{3}$/.test(currency)) return `${number(amount / 100)} ${currency || '（通貨未記録）'}`;
  if (!moneyFormatters.has(currency)) {
    moneyFormatters.set(currency, new Intl.NumberFormat('ja-JP', {
      style:'currency', currency, currencyDisplay:currency === 'JPY' ? 'symbol' : 'code', maximumFractionDigits:2
    }));
  }
  return moneyFormatters.get(currency).format(amount / 100);
}

function duration(ms) {
  if (!finite(ms)) return '未記録';
  if (ms === 0) return '0分';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}秒`;
  const minutes = Math.floor(ms / 60_000);
  return minutes < 60 ? `${number(minutes)}分` : `${number(Math.floor(minutes / 60))}時間${minutes % 60}分`;
}

function byDate(items) {
  return [...items].sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity));
}

function matchScope() {
  return rows('matches').filter(row => row.scope === 'matchmaking');
}

function categoryStatus(key) {
  if (isReady(key)) return '';
  return empty(`${categoryLabels[key]}：${category(key)?.status === 'invalid' ? '読み込めませんでした' : '未収録'}`);
}

function skipped(key) {
  const n = category(key)?.skipped;
  return isReady(key) && n > 0 ? `<p class="fine-print">形式を確認できない ${count(n)} は集計・明細に含まれません。</p>` : '';
}

function metrics(summary, unavailable = false) {
  const nothing = '<span class="metric-none">データなし</span>';
  const metricValues = [
    ['swords', '対戦数', unavailable ? nothing : number(summary.count)],
    ['play', '合計試合時間', unavailable || summary.duration === null ? nothing : duration(summary.duration)],
    ['trophy', 'コンペ勝率', unavailable || summary.competitiveRate === null ? nothing : percentFormat.format(summary.competitiveRate)]
  ];
  return `<dl class="metrics" aria-label="対戦指標（マッチメイキング）">${metricValues.map(([symbol, label, value]) => `<div class="card metric metric-${symbol}"><dt>${icon(symbol)}<span>${label}</span></dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function dateBuckets(items, includePayment = false) {
  const buckets = new Map();
  let undated = 0;
  for (const row of items) {
    const month = monthOf(row);
    if (!month) { undated++; continue; }
    if (!buckets.has(month)) buckets.set(month, {month, count:0, known:0, sum:0});
    const bucket = buckets.get(month);
    const value = includePayment ? row.amountX100 : row.duration;
    bucket.count++;
    if (finite(value)) { bucket.sum += value; bucket.known++; }
  }
  return {months:[...buckets.values()].sort((a, b) => a.month.localeCompare(b.month)), undated};
}

function chartCopy(point, currency) {
  const month = `${point.month.slice(0, -3)}年${Number(point.month.slice(-2))}月`;
  return currency !== undefined
    ? `${month} · 支払額 ${point.known ? money(point.sum, currency) : '未記録'}`
    : `${month} · 対戦 ${count(point.count)} ／ 試合時間 ${duration(point.known ? point.sum : null)}`;
}

// Line/bar charts share one geometry. The SVG uses a fixed 600x225 viewBox so
// axis labels stay proportional at every width; month/axis text is rendered as
// HTML outside the SVG to keep it crisp and readable on small screens.
const chartSize = 6;
const monthLabel = month => `${Number(month.slice(5))}月`;
const monthFull = month => `${month.slice(0,4)}年${monthLabel(month)}`;
function axisTop(max, minStep=1) {
  const guess = Math.max(minStep, max / 4);
  const mag = 10 ** Math.floor(Math.log10(guess));
  const unit = [1, 2, 5, 10].map(n=>n*mag).find(n=>n>=guess);
  return unit * 4;
}
function chart(items, key, currency) {
  const paymentChart = currency !== undefined;
  const {months, undated} = dateBuckets(items, paymentChart);
  if (!months.length) return empty(items.length ? '日時のある記録がありません。' : '月別に表示できる記録がありません。');
  const chartState = state.charts[key] ??= {offset:0, point:null};
  const windowCount = Math.ceil(months.length / chartSize);
  const offset = chartState.offset = Math.min(windowCount - 1, chartState.offset);
  const end = months.length - chartSize * offset;
  const points = months.slice(Math.max(0, end - chartSize), end);
  const selected = chartState.point === null ? null : Math.min(points.length - 1, chartState.point);
  chartState.point=selected;
  const x = i => paymentChart ? 42+(i+.5)*516/points.length : points.length===1 ? 300 : 42+i*516/(points.length-1);
  const y = (n, max) => 195 - n*165/max;
  chartModels.set(key, {points, currency, x});
  const countTop = axisTop(Math.max(...points.map(p=>p.count)), 1);
  const amountTop = axisTop(Math.max(...points.map(p=>p.sum))/(paymentChart?100:3600000), paymentChart?1:0.5);
  const valueOf = p => p.sum/(paymentChart?100:3600000);
  const series = points.map((p,i)=>`${x(i)},${y(p.count,countTop)}`).join(' ');
  const ticks = [1,.75,.5,.25,0];
  const horizontal = ticks.map(v=>`<path class="chart-grid" d="M42 ${y(v,1)}H558"/>`).join('');
  const axis = (top, side) => `<div class="plot-axis plot-axis-${side}" aria-hidden="true">${ticks.map(v=>`<span>${number(v*top)}</span>`).join('')}</div>`;
  const vertical = points.map((p,i)=>`<path class="chart-grid-x" d="M${x(i)} 30V195"/>`).join('');
  const timeLine = points.slice(1).map((p,i)=>p.known&&points[i].known?`<path class="chart-time-line" d="M${x(i)} ${y(valueOf(points[i]),amountTop)}L${x(i+1)} ${y(valueOf(p),amountTop)}"/>`:'').join('');
  const lines = `<polygon class="chart-area" points="${x(0)},195 ${series} ${x(points.length-1)},195" fill="url(#plot-fill-${key})"/>${timeLine}<polyline class="chart-line" points="${series}"/>${points.map((p,i)=>`<circle class="chart-dot" cx="${x(i)}" cy="${y(p.count,countTop)}" r="4"/>`).join('')}`;
  const barWidth=Math.min(36,400/points.length);
  const bars=points.map((p,i)=>p.known?`<rect class="chart-bar payment-bar" x="${x(i)-barWidth/2}" y="${y(valueOf(p),amountTop)}" width="${barWidth}" height="${195-y(valueOf(p),amountTop)}" rx="2"/>`:'').join('');
  const targetStart=i=>paymentChart?42+i*516/points.length:points.length===1?42:Math.max(42,x(i)-258/(points.length-1));
  const targetWidth=i=>paymentChart?516/points.length:points.length===1?516:(i===0||i===points.length-1?258:516)/(points.length-1);
  const targets=points.map((p,i)=>`<rect class="plot-target" data-plot-point="${i}" x="${targetStart(i)}" y="28" width="${targetWidth(i)}" height="170" fill="transparent"/>`).join('');
  const paging = windowCount > 1 && key !== 'home' ? `<div class="chart-paging">${button(`chart-page:${key}:older`, '過去の月', 'secondary', offset === windowCount - 1 ? 'disabled' : '')}<span>${offset + 1} / ${windowCount}</span>${button(`chart-page:${key}:newer`, '新しい月', 'secondary', offset === 0 ? 'disabled' : '')}</div>` : '';
  return `<div class="chart-box" data-chart="${key}">${paymentChart?'':'<p class="chart-legend"><span class="series-count">対戦数</span><span class="series-time">試合時間（時間）</span></p>'}
    <div class="plot-wrap">${axis(paymentChart?amountTop:countTop,'left')}${paymentChart?'':axis(amountTop,'right')}<svg class="chart" viewBox="0 0 600 225" aria-hidden="true" focusable="false">
      <defs><linearGradient id="plot-fill-${key}" x2="0%" y2="100%"><stop stop-color="#6B9EEA" stop-opacity=".19"/><stop offset="1" stop-color="#6B9EEA" stop-opacity=".015"/></linearGradient></defs>
      ${horizontal}${vertical}<line class="chart-cursor" x1="${x(selected??0)}" x2="${x(selected??0)}" y1="30" y2="195"${selected===null?' visibility="hidden"':''}/>
      ${paymentChart?bars:lines}${targets}
    </svg><div class="plot-tooltip"${selected===null?' hidden':''}>${selected===null?'':tooltipCopy(points[selected],currency)}</div></div>
    <div class="months" role="group" aria-label="グラフの月を選択">${points.map((p,i)=>button(`point:${key}:${i}`,monthLabel(p.month),'month',`aria-label="${escape(chartCopy(p,currency))}" aria-pressed="${i===selected}"`)).join('')}</div>
    <output class="chart-value visually-hidden" aria-live="polite">${selected===null?'':escape(chartCopy(points[selected],currency))}</output>
    ${paging}${key==='home'&&!undated?'':`<p class="fine-print">記録がある月を最大6か月ずつ表示。${undated ? `日時未記録の ${count(undated)} はグラフに含まれません。` : ''}</p>`}
  </div>`;
}
function tooltipCopy(point,currency){
  return `<strong>${monthFull(point.month)}</strong>${currency!==undefined?`<span>支払額：${escape(point.known?money(point.sum,currency):'未記録')}</span>`:`<span>対戦数：${count(point.count)}</span><span>試合時間：${duration(point.known?point.sum:null)}</span>`}`;
}

function modeChart(summary, compact=false) {
  if (!summary.count) return empty('表示できる対戦がありません。');
  const parts = [...summary.modeCounts];
  if (!compact) parts.sort((a,b)=>b.count-a.count);
  const palette = 6;
  let offset = 0;
  const ring = parts.map(({count: n}, i) => {
    const share = n / summary.count * 100;
    const arc = `<circle class="tint-${i % palette}" cx="48" cy="48" r="38" pathLength="100" stroke-dasharray="${share} ${Math.max(0, 100 - share)}" stroke-dashoffset="${-offset}"/>`;
    offset += share;
    return arc;
  }).join('');
  const legend = parts.map(({mode, count: n}, i) => `<li><span class="dot tint-${i % palette}" aria-hidden="true"></span><span>${escape(compact?(mode==='competitive'?'コンペ':mode==='その他'?mode:modeDisplayLabel(mode)):modeDisplayLabel(mode))}</span><strong>${percentFormat.format(n / summary.count)}</strong></li>`).join('');
  return `<div class="modes"><svg class="ring" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><g transform="rotate(-90 48 48)">${ring}</g></svg><ul class="legend">${legend}</ul></div>`;
}

const list = (items, row) => `<ul class="rows">${items.map(row).join('')}</ul>`;
const matchRow = m => {
  const result = Object.hasOwn(resultLabels, m.result) ? m.result : 'unknown';
  return `<li><div><strong>${escape(modeDisplayLabel(m.mode))}</strong><small>${escape(formatDate(m.time))}</small></div><div class="end"><strong class="result ${result}">${resultLabels[result]}</strong><small>${duration(m.duration)}</small></div></li>`;
};
const pageSize = 15;
function rowList(items, key, row, none) {
  if (!items.length) return empty(none);
  const maxPage = Math.ceil(items.length / pageSize) - 1;
  const page = state.offsets[key] = Math.min(maxPage, state.offsets[key] ?? 0);
  const start = pageSize * page;
  const end = Math.min(start + pageSize, items.length);
  return `<p class="fine-print list-summary" id="list-${key}" tabindex="-1">${count(items.length)}${maxPage ? `中 ${number(start + 1)}–${number(end)} 件を表示` : ''}</p>${list(items.slice(start, end), row)}${maxPage ? `<div class="list-paging">${button(`list:${key}:prev`, '前のページ', 'secondary', page ? '' : 'disabled')}<span>${page + 1} / ${maxPage + 1}</span>${button(`list:${key}:next`, '次のページ', 'secondary', page === maxPage ? 'disabled' : '')}</div>` : ''}`;
}

function reportTotal(entries) {
  return entries === null ? 'データなし' : count(entries.reduce((sum, entry) => sum + entry.count, 0));
}

function reportTotals() {
  const {made, received} = category('reports').value;
  return totals([['送った通報', reportTotal(made)], ['受けた通報', reportTotal(received)]]);
}

function amounts(items, field) {
  const values = new Map();
  for (const row of items) {
    if (finite(row[field])) values.set(row.currency, (values.get(row.currency) ?? 0) + row[field]);
  }
  return [...values.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function paymentTotals() {
  const items = rows('payments');
  const groups = amounts(items, 'amountX100');
  return totals([['総支払額', groups.length ? groups.map(([c, n]) => `<span>${escape(money(n, c))}</span>`).join('') : items.length ? '未記録' : '支払いの記録なし'], ['決済回数', count(items.length, '回')]]);
}

const currencyUnit = currency => currency || '（通貨未記録）';
function storeTotals() {
  const items = rows('store');
  const groups = amounts(items, 'amount');
  return totals([['ゲーム内通貨の消費量', groups.length ? groups.map(([c, n]) => `<span>${count(n, escape(currencyUnit(c)))}</span>`).join('') : items.length ? '未記録' : '消費の記録なし'], ['取引件数', count(items.length)]]);
}

function playDonut(summary, compact=false) {
  if (!compact) return modeChart(summary);
  const byMode=new Map(summary.modeCounts.map(row=>[row.mode,row.count]));
  const comp=byMode.get('competitive')??0;
  const unrated=byMode.get('unrated')??0;
  return modeChart({...summary,modeCounts:[{mode:'competitive',count:comp},{mode:'unrated',count:unrated},{mode:'その他',count:summary.count-comp-unrated}]},true);
}

function playerProfile(summary, available){
  const last=available&&summary.lastTime!==null?formatDate(summary.lastTime):'データなし';
  const riotId=state.demo?'Player#JP1':category('profile')?.riotId;
  return `<div class="player-profile">${profileAvatarUrl?`<img class="profile-avatar" src="${profileAvatarUrl}" width="84" height="84" alt="">`:'<span class="profile-avatar" aria-hidden="true"></span>'}<div class="profile-copy"><h1 id="page-title" tabindex="-1" aria-label="プレーの概要">${escape(riotId||'プレーの概要')}</h1><p>最終プレー ${escape(last)}</p>${badge()}</div></div>`;
}

function reportStack(){
  const made=category('reports').value.made;
  if(!made?.length)return '';
  const segments=[{name:'チート',count:0},{name:'ランク操作',count:0},{name:'不適切行為',count:0},{name:'その他',count:0}];
  const behavior=new Set(['ABUSING_GLITCHES','COMMS_ABUSE_TEXT','COMMS_ABUSE_VOICE','INAPPROPRIATE_TEAM_NAME','OFFENSIVE_NAME','SABOTAGING_TEAM']);
  for(const {code,count:n} of made){const k=code.toUpperCase();segments[k==='CHEATING'?0:k==='RANK_MANIPULATION'?1:behavior.has(k)?2:3].count+=n;}
  const total=segments.reduce((sum,p)=>sum+p.count,0);
  if(!total)return '';
  let x=0;
  return `<div class="report-stack"><svg class="report-bar" viewBox="0 0 400 26" preserveAspectRatio="none" aria-label="送った通報の理由別割合" role="img">${segments.map((p,i)=>{const w=400*p.count/total;const rect=p.count?`<rect class="report-tone-${i}" x="${x}" y="0" width="${w}" height="26"><title>${p.name}：${count(p.count)}</title></rect>`:'';x+=w;return rect;}).join('')}</svg><ul class="report-legend">${segments.map((p,i)=>`<li title="${p.name}：${count(p.count)}"><span class="report-tone-${i}"></span>${p.name}</li>`).join('')}</ul></div>`;
}

function miniChart(items, type){
  const payment=type==='payment';
  const available=payment?items.filter(r=>finite(r.amountX100)):items;
  // For the small payments graph, show one currency only; totals above remain separated.
  const currencies=[...new Set(available.map(r=>r.currency))].sort();
  const currency=currencies.includes('JPY')?'JPY':currencies[0];
  const series=new Map();
  for(const row of available){
    if(payment&&row.currency!==currency)continue;
    const month=monthOf(row)??(!payment?row.timeUnzoned?.slice(0,7).replace('/','-'):null);
    if(month)series.set(month,(series.get(month)??0)+(payment?row.amountX100:1));
  }
  if(!series.size)return '';
  const points=[...series].sort(([a],[b])=>a.localeCompare(b)).slice(-6);
  const top=Math.max(1,...points.map(([,n])=>n));
  const step=400/points.length;
  const unit=payment?`支払額（${currency}）`:'取引件数（時差不明の記録はZIP記載月）';
  const multipleYears=new Set(points.map(([month])=>month.slice(0,4))).size>1;
  return `<figure class="mini-chart" aria-label="月別${escape(unit)}"><svg class="mini-plot" viewBox="0 0 400 60" role="img" aria-label="月別${escape(unit)}"><path class="chart-grid" d="M0 4H400M0 29H400M0 54H400"/>${points.map(([month,n],i)=>{const h=n/top*50,x=(i+.5)*step,w=Math.min(36,step*.65);return `<rect class="chart-bar" x="${x-w/2}" y="${54-h}" width="${w}" height="${h}" rx="2"><title>${monthFull(month)}：${escape(payment?money(n,currency):count(n))}</title></rect>`;}).join('')}</svg><div class="mini-months" aria-hidden="true">${points.map(([month])=>`<span>${multipleYears?`${month.slice(2,4)}年`:''}${monthLabel(month)}</span>`).join('')}</div>${payment&&currencies.length>1?`<figcaption>${escape(currency)} の月別支払額</figcaption>`:''}</figure>`;
}

function recentMatchRow(m){
  const result=Object.hasOwn(resultLabels,m.result)?m.result:'unknown';
  return `<li><span class="recent-icon" aria-hidden="true">${icon('recent')}</span><time>${escape(formatDate(m.time))}</time><span class="recent-mode">${escape(modeDisplayLabel(m.mode))}</span><strong class="result ${result}">${resultLabels[result]}</strong><span class="recent-duration">${duration(m.duration)}</span></li>`;
}

// Home composes the profile, three KPI cards, and the overview cards. Each card
// degrades independently when its category is missing, so a partial import still
// renders a coherent page.
function home() {
  const items=matchScope(), summary=summarizeMatches(items), matchesAvailable=isReady('matches');
  return `<div class="home-overview">${playerProfile(summary,matchesAvailable)}${metrics(summary,!matchesAvailable)}</div>
    <div class="cards home-grid">
      <div class="play-overview">
        ${card('プレー記録',matchesAvailable?chart(items,'home')+skipped('matches'):categoryStatus('matches'),detail('play'),'play-card')}
        ${card('モード別の内訳',matchesAvailable?playDonut(summary,true):categoryStatus('matches'),'','mode-card')}
      </div>
      ${card('通報',isReady('reports')?reportTotals()+reportStack()+skipped('reports'):categoryStatus('reports'),detail('reports'),'report-card')}
      ${card('課金',isReady('payments')?paymentTotals()+miniChart(rows('payments'),'payment')+skipped('payments'):categoryStatus('payments'),detail('payment'),'payment-card')}
      ${card('ストア取引',isReady('store')?storeTotals()+miniChart(rows('store'),'store')+skipped('store'):categoryStatus('store'),detail('store'),'store-card')}
      ${card('最近の試合',matchesAvailable?(items.length?`<ul class="rows recent-matches">${byDate(items).slice(0,3).map(recentMatchRow).join('')}</ul>`:empty('マッチメイキングの記録はありません。')):categoryStatus('matches'),detail('play','もっと見る','go-list'),'recent-card')}
    </div>`;
}

function select(key, label, options, selected = state.filters[key]) {
  filterOptions.set(key, options);
  return `<label>${label}<select data-filter="${key}">${options.map(([value, text], i) => `<option value="${i}" ${selected === value ? 'selected' : ''}>${escape(text)}</option>`).join('')}</select></label>`;
}

function play() {
  const intro = heading('プレー記録', '試合の推移・モード別内訳・明細');
  if (!isReady('matches')) return intro + card('対戦履歴', categoryStatus('matches'));
  const filter = state.filters;
  const items = rows('matches');
  const scoped = items.filter(m => m.scope === filter.scope);
  const displayed = byDate(scoped.filter(m => (filter.period === null || monthOf(m) === filter.period) && (filter.mode === null || m.mode === filter.mode)));
  const summary = summarizeMatches(displayed);
  const modes = [...new Set(scoped.map(m => m.mode))].map(m => [m, modeDisplayLabel(m)]).sort((a, b) => a[1].localeCompare(b[1], 'ja'));
  const months = [...new Set(scoped.map(monthOf).filter(Boolean))].sort().reverse();
  const monthOptions = months.map(m => [m, `${m.slice(0, -3)}年${Number(m.slice(-2))}月`]);
  const scopes = [['matchmaking', 'マッチメイキング'], ['other', 'その他のプレー']];
  if (items.some(m => m.scope === 'unknown')) scopes.push(['unknown', '種類が不明なプレー']);
  const filters = `<div class="filters">${select('scope', '記録の種類', scopes)}${select('period', '期間', [[null, '全期間'], ...monthOptions])}${select('mode', 'モード', [[null, 'すべて'], ...modes])}${button('reset', 'リセット', 'secondary')}</div>`;
  const none = filter.period !== null || filter.mode !== null ? '条件に一致する試合がありません。絞り込みを変更するか、リセットしてください。' : 'この種類の対戦記録はありません。';
  return `${intro}${card('絞り込み', filters + skipped('matches'))}${metrics(summary)}
    <div class="cards"><div class="cols">${card('月別の対戦数・試合時間', chart(displayed, 'play'))}${card('モード別の内訳', modeChart(summary))}</div>
    <section class="card"><h2 id="match-list-title" tabindex="-1">試合一覧</h2>${rowList(displayed, 'matches', matchRow, none)}</section></div>${timezone()}`;
}

function reports() {
  const intro = heading('通報', 'ZIPに収録された集計です。試合の期間フィルターは適用されません。');
  if (!isReady('reports')) return intro + card('通報集計', categoryStatus('reports'));
  const {made, received} = category('reports').value;
  const box = entries => entries === null ? empty('データなし（件数は記録されていません）。') : `<p class="lead-number">${reportTotal(entries)}</p>${entries.length ? list([...entries].sort((a, b) => b.count - a.count), r => `<li><span>${escape(reportLabel(r.code))}</span><strong class="end">${count(r.count)}</strong></li>`) : ''}`;
  return `${intro}<div class="cols">${card('送った通報', box(made))}${card('受けた通報', box(received))}</div>${skipped('reports')}`;
}

function payment() {
  const intro = heading('課金', '支払額は通貨ごとに表示します。');
  if (!isReady('payments')) return intro + card('決済履歴', categoryStatus('payments'));
  const items = rows('payments');
  const currencies = [...new Set(items.map(row => row.currency))].sort((a, b) => a.localeCompare(b));
  const currency = state.filters.currency ?? currencies[0];
  const labels = {JPY:'日本円（JPY）', USD:'米ドル（USD）'};
  const paymentRow = p => `<li><div><strong>${escape(money(p.amountX100, p.currency))}</strong><small>${escape(formatDate(p.time))}</small></div><div class="end"><small>付与された通貨</small>${p.granted.length ? p.granted.map(g => `<strong>${finite(g.amount) ? count(g.amount, escape(currencyUnit(g.currency))) : '未記録'}</strong>`).join('') : '<strong>未記録</strong>'}</div></li>`;
  const graph = currencies.length ? `<div class="filters">${select('currency', 'グラフの通貨', currencies.map(c => [c, Object.hasOwn(labels, c) ? labels[c] : currencyUnit(c)]), currency)}</div>${chart(items.filter(p => p.currency === currency), 'payment', currency)}` : empty('月別に表示できる決済記録がありません。');
  return `${intro}<div class="cards">${card('課金の概要', paymentTotals() + skipped('payments'))}${card('月別の支払額', graph)}${card('決済明細', rowList(byDate(items), 'payments', paymentRow, '決済の記録はありません。'))}</div>${timezone()}`;
}

function store() {
  const intro = heading('ストア取引', '消費量が未記録の取引も明細に表示します。');
  if (!isReady('store')) return intro + card('取引履歴', categoryStatus('store'));
  const storeRow = p => `<li><div><strong>${escape(itemDisplayLabel(p))}</strong><small>${escape(formatStoreDate(p))} · ${escape(kindDisplayLabel(p.kind))}</small></div><strong class="end store-amount">${finite(p.amount) ? count(p.amount, escape(currencyUnit(p.currency))) : '未記録'}</strong></li>`;
  const note = '<p class="fine-print">タイムゾーンがわかる日時は日本時間（JST）で表示します。不明な日時はZIPに記載された時刻のまま表示します。</p>';
  return `${intro}<div class="cards">${card('ストア取引の概要', storeTotals() + skipped('store'))}${card('取引明細', rowList(byDate(rows('store')), 'store', storeRow, '取引の記録はありません。'))}</div>${note}`;
}

function voice(){
  const record=category('voice');
  const status=record?.status;
  const message=status==='ready'?'ボイスチャットの文字起こしは記録されていません。':status==='unsupported'?'文字起こしファイルはありますが、内容の形式を確認できていないため表示できません。':status==='invalid'?'ボイスチャットのデータを読み込めませんでした。':'ボイスチャットのデータは収録されていません。';
  return heading('ボイスチャット')+card('文字起こし',`<div class="voice-info">${empty(message)}<p class="fine-print">音声の再生や他のユーザーへの送信は行いません。</p></div>`);
}

function guide(){
  const steps=`<ol class="guide-steps"><li><h3>Riot Gamesにデータを申請する</h3><p>公式ページにアクセスし、VALORANTで使っているRiotアカウントでログインして、案内に沿って申請します。</p><a class="button secondary guide-link" href="${requestUrl}" target="_blank" rel="noopener noreferrer">Riot公式のデータ申請ページを開く ${icon('next')}</a></li><li><h3>レポートを端末に保存する</h3><p>Riot Gamesから受け取ったZIPをそのままダウンロードしてください。解凍は不要です。</p></li><li><h3>このサイトでファイルを選ぶ</h3><p>「データをアップロード」からZIPまたは対象のJSONを選びます。PCではドラッグ＆ドロップでも開けます。</p>${button('open',`${icon('upload')} ファイルを選ぶ`,'secondary')}</li></ol>`;
  return `<div class="guide-view">${heading('使い方','Riot Gamesのデータを取得し、この端末で確認する方法')}
    ${card('データの取得から表示まで',steps)}
    <div class="cards">${card('個人データの扱い','<p><strong>選んだファイルの中身は、お使いのスマートフォンやパソコンの中だけで読み取り・集計します。</strong></p><p>ファイルや表示された集計結果が、このサイトや外部のサーバーへ送信されることはありません。他の人にも公開されません。</p><p>読み取った表示用データは、このブラウザ内に保存されるため、ページを閉じたり再読み込みしたりしても残ります。同じ端末・ブラウザを使う人は閲覧できるため、共有端末ではご注意ください。「その他」のデータ管理から消去できます。元のファイルは保存・削除されません。</p><p>※ サイト自体を開くときやRiot公式の申請ページを利用するときは、インターネット通信が必要です。</p><p>開示データの内容によっては、一部の項目が表示されません。プロフィールの画像はイメージです。</p>')}</div></div>`;
}

function more() {
  const menu=homePages.map(key=>button(`go:${key}`,`${icon(key)}<span>${titles[key]}</span>${icon('next')}`,'menu-item')).join('');
  const manage=`<p class="muted">表示用データはこの端末のブラウザ内に保存され、再読み込み後も表示されます。別のファイルは読み込みが成功したときだけ入れ替えます。共有端末では利用後に消去してください。</p><div class="actions">${button('open','データをアップロード','secondary')}${button('clear','表示データを消去','danger')}</div>`;
  return `${heading('その他','カテゴリ別の詳細とデータ管理')}<div class="cols">${card('カテゴリ',`<div class="menu">${menu}</div>`)}${card('データ管理',manage)}</div>`;
}

function intro() {
  return `<div class="intro"><section class="intro-card card" id="drop-target">
    <h1 id="page-title" tabindex="-1">あなたのプレー記録を、手元で。</h1>
    <p class="intro-copy">Riot Gamesから受け取ったZIPや対象のJSONを選ぶと、VALORANTのプレー記録や取引履歴を確認できます。</p>
    <div class="actions intro-actions">${button('open',`${icon('upload')}${state.error?'別のファイルを選ぶ':'データをアップロード'}`,'primary')}${button('demo','デモを見る','secondary')}${button('go:guide','使い方','text-button')}</div>
    <div class="privacy">${icon('shield')}<div><strong>解凍不要・ファイルは送信されません</strong><p>表示用データは再読み込みできるよう、この端末のブラウザ内に保存されます。共有端末では利用後に消去してください。</p><p>端末の「ファイル」や「ダウンロード」からZIPまたはJSONを選びます。</p><p class="drop-copy">PCでは、この画面にファイルをドラッグ＆ドロップできます。</p></div></div>
  </section><p class="footer-note">Riot Gamesの公式サービスではありません</p></div>`;
}

function loading() {
  const title = state.dataset || state.view==='guide' ? '<h2 id="loading-title" tabindex="-1">読み込み中</h2>' : '<h1 id="page-title" tabindex="-1">読み込み中</h1>';
  return `<section class="card loading">${title}<div class="progress" aria-hidden="true"></div>
    <p id="load-phase" role="status" aria-atomic="true">${phases[state.reading.phase]}</p>
    <p class="muted">${state.dataset ? '完了するまで現在の表示は変わりません。' : 'ファイルは端末内で処理され、送信されません。'}</p>
    <div class="actions">${button('cancel', '読み込みを取り消す', 'secondary')}${button('open', '別のファイルを選ぶ')}</div></section>`;
}

function errorBlock() {
  if (!state.error) return '';
  const [title, copy] = errors[state.error];
  return `<section class="alert" aria-labelledby="error-title"><h2 id="error-title" tabindex="-1">${title}</h2><p>${copy}${state.dataset ? ' 前の表示はそのままです。' : ''}</p>${state.dataset ? `<div class="actions">${button('open', '別のファイルを選ぶ', 'secondary')}${button('dismiss', '閉じる')}</div>` : ''}</section>`;
}

function nav(keys, css) {
  return `<nav aria-label="画面ナビゲーション" class="${css}">${keys.map(key => {
    const current = state.view === key ? 'aria-current="page"' : key === 'more' && css === 'bottom' && homePages.includes(state.view) ? 'aria-current="location"' : '';
    return button(`go:${key}`, `${icon(key)}<span>${titles[key]}</span>`, 'nav-item', current);
  }).join('')}</nav>`;
}

const views = {home,play,reports,payment,store,voice,guide,more};
function sidebar(){
  return `<aside class="rail">${brand()}${nav(pages,'side-nav')}<div class="rail-bottom">${button('go:more','データ管理','text-button')}<p class="footer-note">Riot Gamesの公式サービスではありません</p></div></aside>`;
}
function appHeader(active){
  const menuKeys=active?['home','play',...homePages,'more']:['home','guide'];
  return `<header class="top"><div class="top-in"><button type="button" class="brand-link" data-action="go:home" aria-label="ホームへ戻る">${brand()}</button><div class="header-tools">${button('open',`${icon('upload')}データをアップロード`,'secondary desktop-upload')}${button('toggle-menu',icon('menu'),'mobile-menu-toggle','aria-label="メニュー" aria-controls="mobile-menu" aria-expanded="'+state.menuOpen+'"')}</div></div>
    <div id="mobile-menu" class="mobile-menu-panel"${state.menuOpen?'':' hidden'}>${nav(menuKeys,'menu')} ${button('open',`${icon('upload')}データをアップロード`,'secondary')}</div></header>`;
}
function render() {
  const active=Boolean(state.dataset);
  chartModels.clear();
  filterOptions.clear();
  app.classList.toggle('loaded',active);
  document.title=active||state.view==='guide'?`${titles[state.view]}｜VALORANT プレイヤー分析`:'VALORANT プレイヤー分析';
  const notice=active&&state.view==='home'&&Object.keys(categoryLabels).some(key=>!isReady(key))?'<p class="notice">一部のデータを表示できません。読めたカテゴリを表示しています。</p>':'';
  const view=active||state.view==='guide'?views[state.view]():state.reading?'':intro();
  const storageStatus=state.storageWarning?`<p class="alert" role="alert">${escape(state.storageWarning)}</p>`:state.storageBusy?'<p class="notice" role="status">この端末にデータを保存しています…</p>':'';
  app.innerHTML=`<a class="skip" href="#content">本文へ移動</a>${appHeader(active)}${active?sidebar():''}<div class="body"><main id="content" tabindex="-1">${state.reading?loading():''}${errorBlock()}${storageStatus}${notice}${view}</main></div>${active?nav(['home','play','more'],'bottom'):''}`;
}

function focus(target = '#page-title', scroll = false) {
  const element = document.querySelector(target);
  if (scroll) window.scrollTo(0, 0);
  element?.focus({preventScroll:scroll});
}

function routeUrl(view) {
  const url = new URL(location.href);
  url.hash = view === 'home' ? '' : view;
  return url;
}

function navigate(view, listTarget = false) {
  if (!Object.hasOwn(views, view) || (!state.dataset && !['home','guide'].includes(view))) return;
  state.menuOpen=false;
  if (view !== state.view || listTarget !== (history.state?.listTarget === true)) {
    history.pushState({view, listTarget}, '', routeUrl(view));
  }
  state.view = view;
  render();
  if (listTarget && isReady('matches')) focus('#match-list-title');
  else focus('#page-title', true);
}

window.addEventListener('popstate', () => {
  const route=history.state?.view;
  state.view=Object.hasOwn(views,route)&&(state.dataset||route==='guide')?route:'home';
  state.menuOpen=false;
  render();
  if(state.view==='play'&&history.state?.listTarget&&isReady('matches'))focus('#match-list-title');
  else focus('#page-title',true);
});

function showDataset(dataset = null, demo = false) {
  stopWorker();
  moneyFormatters.clear();
  Object.assign(state, {dataset, demo, error:null, reading:null, view:'home', loadedAt:dataset&&!demo?Date.now():null, menuOpen:false, filters:filtersInitial(), charts:{}, offsets:{}});
  picker.value = '';
  history.replaceState(dataset ? {view:'home'} : null, '', routeUrl('home'));
  render();
  focus('#page-title', true);
  announceText(demo ? 'サンプルデータを表示しました。' : dataset ? 'ファイルの読み込みが完了しました。' : '表示データを消去しました。');
}

// Persist a freshly imported dataset. Saving happens after the UI is shown so a
// slow storage write never blocks the view; failures degrade to a visible warning.
async function acceptDataset(dataset) {
  state.storageBusy=true;
  state.storageWarning=null;
  showDataset(dataset);
  try {
    await saveData(dataset);
  } catch {
    let previousCleared=false;
    try { await clearSavedData(); previousCleared=true; } catch {}
    state.storageWarning=previousCleared
      ? '端末に保存できませんでした。現在のデータは表示できますが、再読み込みすると消えます。'
      : '端末に保存できませんでした。再読み込みすると以前のデータが表示される場合があります。ブラウザのサイトデータ設定も確認してください。';
  } finally {
    state.storageBusy=false;
    render();
    if(state.storageWarning)announceText(state.storageWarning);
    else announceText('表示用データをこの端末に保存しました。');
  }
}

async function clearDataset() {
  state.storageBusy=true;
  render();
  try {
    await clearSavedData();
    state.storageWarning=null;
    state.storageBusy=false;
    showDataset();
  } catch {
    state.storageBusy=false;
    state.storageWarning='ブラウザ内のデータを消去できませんでした。再度お試しいただくか、ブラウザのサイトデータを削除してください。';
    render();
    announceText(state.storageWarning);
  }
}

// Fetch the standalone worker with the initial page assets. All subsequent
// workers use that same in-memory URL, including after cancellation or offline.
let workerURL;
let profileAvatarUrl;
let worker;
let workerPreparing = true;
let startupFailed = false;
let currentDrag = 0;

function stopWorker() {
  if (!worker) return;
  worker.terminate();
  worker = null;
}

function fail(code) {
  stopWorker();
  if(code==='sizeLimit'&&state.reading?.json)code='jsonSizeLimit';
  state.reading = null;
  state.error = Object.hasOwn(errors, code) ? code : 'worker';
  render();
  focus('#error-title', true);
  announceText(errors[state.error].join(' ') + (state.dataset ? ' 前の表示はそのままです。' : ''));
}

function makeWorker() {
  const instance = new Worker(workerURL, {type:'module', name:'valorant-zip'});
  worker = instance;
  instance.addEventListener('message', ({data}) => {
    if (worker !== instance || !state.reading || !data) return;
    if (data.type === 'progress' && Object.hasOwn(phases, data.phase)) {
      state.reading.phase = data.phase;
      const phase = document.querySelector('#load-phase');
      if (phase && phase.textContent !== phases[data.phase]) phase.textContent = phases[data.phase];
    } else if (data.type === 'success') {
      void acceptDataset(data.dataset);
    } else if (data.type === 'error') {
      fail(data.code);
    }
  });
  const workerError = event => {
    event.preventDefault();
    if (worker !== instance) return;
    if (state.reading) fail('worker');
    else { stopWorker(); startupFailed = true; }
  };
  instance.addEventListener('error', workerError);
  instance.addEventListener('messageerror', workerError);
  return instance;
}

function processFile() {
  if (!state.reading?.file || !workerURL) return;
  try {
    (worker ?? makeWorker()).postMessage({file:state.reading.file});
    state.reading.file = null;
  } catch {
    fail('worker');
  }
}

async function prepareWorker() {
  try {
    const response = await fetch(new URL('./zip-worker.mjs', import.meta.url), {credentials:'omit', redirect:'error'});
    if (!response.ok) throw new Error('Worker asset did not load');
    const source = await response.text();
    workerURL = URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
    makeWorker(); // Evaluates all bundled dependencies before the first selection.
    processFile();
  } catch {
    startupFailed = true;
    if (state.reading) fail('startup');
  } finally {
    workerPreparing = false;
    app.querySelectorAll('[data-action="open"]').forEach(open => { open.disabled = false; });
  }
}

function startFile(file) {
  if (!file || state.storageBusy) return;
  if (state.reading) stopWorker();
  if (startupFailed) { fail('startup'); return; }
  announceText('');
  state.reading = {file, phase:'checking', json:/\.json$/i.test(file.name)||(!/\.zip$/i.test(file.name)&&/json/i.test(file.type))};
  state.menuOpen=false;
  state.error = null;
  render();
  focus(state.dataset || state.view==='guide' ? '#loading-title' : '#page-title', true);
  processFile();
}

function cancelReading() {
  stopWorker();
  state.reading = null;
  picker.value = '';
  render();
  focus(state.dataset || state.view==='guide' ? '#page-title' : '.intro [data-action="open"]', true);
  announceText(state.dataset ? '読み込みを取り消しました。前の表示はそのままです。' : '読み込みを取り消しました。');
}

picker.addEventListener('change', () => {
  const file = picker.files?.[0];
  picker.value = ''; // Allow the same ZIP to be selected again.
  startFile(file);
});

const isFileDrag = e => Array.from(e.dataTransfer?.types ?? []).includes('Files');
function dropHighlight(active) {
  app.classList.toggle('drag-active', active);
}
window.addEventListener('dragenter', e => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  if (dialog.open) return;
  currentDrag++;
  dropHighlight(true);
});
window.addEventListener('dragover', e => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = dialog.open ? 'none' : 'copy';
});
window.addEventListener('dragleave', () => {
  currentDrag = Math.max(0, currentDrag - 1);
  if (!currentDrag) dropHighlight(false);
});
window.addEventListener('drop', e => {
  if (!isFileDrag(e) && !e.dataTransfer?.files.length) return;
  e.preventDefault();
  currentDrag = 0;
  dropHighlight(false);
  if (dialog.open) return;
  const files = e.dataTransfer.files;
  if (files.length > 1) {
    if (state.reading) announceText(errors.multiple.join(' '));
    else {
      state.error = 'multiple';
      render();
      focus('#error-title', true);
      announceText(errors.multiple.join(' '));
    }
  } else startFile(files[0]);
});

app.addEventListener('change', e => {
  const key = e.target.dataset.filter;
  const options = filterOptions.get(key);
  if (!options) return;
  const entry = options[Number(e.target.value)];
  if (!entry) return;
  state.filters[key] = entry[0];
  if (key === 'currency') delete state.charts.payment;
  else {
    if (key === 'scope') { state.filters.mode = null; state.filters.period = null; }
    delete state.charts.play;
    state.offsets.matches = 0;
  }
  render();
  focus(`[data-filter="${key}"]`);
  const updated = key === 'currency' ? document.querySelector('[data-chart="payment"] output')?.textContent : document.querySelector('#list-matches')?.textContent;
  announceText(updated || (key === 'currency' ? '月別に表示できる決済記録がありません。' : '条件に一致する試合はありません。'));
});

function updatePlot(key,i,commit=false){
  const model=chartModels.get(key);
  const el=document.querySelector(`[data-chart="${key}"]`);
  if(!model||!el)return;
  const point=model.points[i];
  const cursor=el.querySelector('.chart-cursor');
  const tooltip=el.querySelector('.plot-tooltip');
  tooltip.hidden=!point;
  if(!point){cursor.setAttribute('visibility','hidden');return;}
  const x=model.x(i);
  cursor.removeAttribute('visibility');
  cursor.setAttribute('x1',x);
  cursor.setAttribute('x2',x);
  tooltip.innerHTML=tooltipCopy(point,model.currency);
  tooltip.classList.toggle('plot-tooltip-left',x>380);
  if(commit){
    state.charts[key].point=i;
    el.querySelectorAll('.month').forEach((b,index)=>b.setAttribute('aria-pressed',index===i));
    el.querySelector('output').textContent=chartCopy(point,model.currency);
  }
}
app.addEventListener('pointerover',event=>{
  const point=event.target.closest('[data-plot-point]');
  if(point&&event.pointerType!=='touch')updatePlot(point.closest('[data-chart]').dataset.chart,Number(point.dataset.plotPoint));
});
app.addEventListener('pointerout',event=>{
  const plot=event.target.closest('.plot-wrap');
  if(!plot||plot.contains(event.relatedTarget))return;
  const key=plot.closest('[data-chart]').dataset.chart;
  updatePlot(key,state.charts[key]?.point ?? undefined);
});
app.addEventListener('focusin',event=>{
  const [action,key,i]=event.target.dataset?.action?.split(':')??[];
  if(action==='point')updatePlot(key,Number(i));
});
app.addEventListener('focusout',event=>{
  const [action,key]=event.target.dataset?.action?.split(':')??[];
  if(action==='point')updatePlot(key,state.charts[key]?.point??undefined);
});
function toggleMenu(open=!state.menuOpen){
  state.menuOpen=open;
  const toggle=document.querySelector('.mobile-menu-toggle');
  toggle.setAttribute('aria-expanded',String(open));
  const panel=document.querySelector('#mobile-menu');
  panel.hidden=!open;
  if(open)panel.querySelector('button')?.focus();
  else toggle.focus();
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.menuOpen)toggleMenu(false);});

document.addEventListener('click', e => {
  const b = e.target.closest('button[data-action]');
  if (!b){
    const point=e.target.closest('[data-plot-point]');
    if(point)updatePlot(point.closest('[data-chart]').dataset.chart,Number(point.dataset.plotPoint),true);
    return;
  }
  const [action, arg, point] = b.dataset.action.split(':');
  switch (action) {
    case 'open': if(state.menuOpen)toggleMenu(false); picker.click(); break;
    case 'toggle-menu': toggleMenu(); break;
    case 'demo': showDataset(demoDataset, true); break;
    case 'cancel': cancelReading(); break;
    case 'clear': dialog.showModal(); break;
    case 'close': dialog.close(); break;
    case 'confirm-clear': dialog.close(); void clearDataset(); break;
    case 'go': navigate(arg); break;
    case 'go-list': navigate('play', true); break;
    case 'dismiss': state.error = null; render(); focus(); break;
    case 'reset': {
      Object.assign(state.filters, {scope:'matchmaking', period:null, mode:null});
      state.offsets.matches = 0;
      delete state.charts.play;
      render();
      focus('[data-action="reset"]');
      announceText('絞り込みをリセットしました。');
      break;
    }
    case 'point': updatePlot(arg, Number(point),true); break;
    case 'chart-page': {
      state.charts[arg].offset += point === 'older' ? 1 : -1;
      state.charts[arg].point = null;
      render();
      const control = `[data-action="chart-page:${arg}:${point}"]:not([disabled])`;
      focus(document.querySelector(control) ? control : `[data-chart="${arg}"] .month[aria-pressed="true"]`);
      break;
    }
    case 'list': {
      state.offsets[arg] += point === 'next' ? 1 : -1;
      render();
      focus(`#list-${arg}`);
      break;
    }
  }
});

// The skip link remains keyboard-accessible without adding a history entry.
app.addEventListener('click', e => {
  if (!e.target.closest('.skip')) return;
  e.preventDefault();
  focus('#content');
});

if(location.hash==='#guide')state.view='guide';
history.replaceState({view:state.view}, '', routeUrl(state.view));
// Boot sequence: restore any previously saved dataset (with a shape check so a
// corrupt record can never crash the UI), then warm the offline-capable worker.
async function initialize() {
  try {
    const saved=await loadSavedData();
    if(saved?.version===1 && saved.dataset && ['matches','reports','payments','store'].every(key=>saved.dataset[key] && ['ready','missing','invalid'].includes(saved.dataset[key].status))) {
      state.dataset=saved.dataset;
    }
  } catch {
    state.storageWarning='ブラウザ内の保存データを確認できませんでした。保存設定をご確認ください。';
  }
  render();
  void prepareWorker();
}
void initialize();
// Preload the site artwork once so real data and demo views work offline.
void fetch(new URL('./assets/jett.png',import.meta.url),{credentials:'omit',redirect:'error'})
  .then(response=>{if(!response.ok)throw Error('Artwork not available');return response.blob();})
  .then(blob=>{
    profileAvatarUrl=URL.createObjectURL(blob);
    const placeholder=document.querySelector('span.profile-avatar');
    if(placeholder){const image=document.createElement('img');image.className='profile-avatar';image.src=profileAvatarUrl;image.alt='';image.width=84;image.height=84;placeholder.replaceWith(image);}
  }).catch(()=>{});
