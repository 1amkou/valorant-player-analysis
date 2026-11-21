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
import {modeDisplayLabel, reportDisplayLabel, kindDisplayLabel, tokyoMonth, formatDate, formatStoreDate, summarizeMatches} from './lib/data.mjs';
import {itemDisplayLabel} from './lib/item-label.mjs';
import {loadSavedData, saveData, clearSavedData} from './lib/storage.mjs';
import {currentLang, setLang, langName, t, fmtNumber, fmtPercent, fmtMoney, fmtDuration, monthShort, monthFull} from './lib/i18n.mjs';

const app = document.querySelector('#app');
const picker = document.querySelector('#zip-file');
const dialog = document.querySelector('#confirm');
const announce = document.querySelector('#announce');
const pages = ['home','play','reports','payment','store','voice','guide'];
const homePages = ['reports', 'payment', 'store', 'voice', 'guide'];
const requestUrl = () => currentLang() === 'en' ? 'https://support.riotgames.com/en-us/riot/data-request' : 'https://support.riotgames.com/ja-jp/riot/data-request';
// Lucide (ISC) icons for navigation and actions; the site logo is a separate image.
const icons = {
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
const number = fmtNumber;
const count = (value, unit = t('unit.records')) => unit ? `${number(value)} ${unit}` : number(value);
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const button = (action, text, kind = '', attrs = '') => `<button type="button" class="button ${kind}" data-action="${action}" ${attrs}${(action === 'open' && workerPreparing) || (state.storageBusy && ['open','demo','clear'].includes(action)) ? ' disabled' : ''}>${text}</button>`;
const empty = text => `<p class="empty">${escape(text)}</p>`;
const card = (title, html, link = '', classes = '') => `<section class="card ${classes}"><div class="card-head"><h2>${title}</h2>${link}</div>${html}</section>`;
const category = key => state.dataset?.[key];
const isReady = key => category(key)?.status === 'ready';
const rows = key => isReady(key) ? category(key).value : [];
const brand = () => `<div class="brand"><span class="mark"><img src="./assets/nisyon.png" alt="" width="32" height="32"></span><div><strong>VALORANT</strong><small>Player Analytics</small></div></div>`;
const title = key => t('nav.' + key);
const detail = (key, label = t('detail.view'), action = `go:${key}`) => button(action, `${label}${icon('next')}`, 'text-button', `aria-label="${t('detail.aria', {title: title(key), label})}"`);
const badge = () => state.demo ? `<span class="badge sample">${t('badge.sample')}</span>` : '';
const heading = (hTitle, info = '') => `<header class="headline"><div class="headline-title"><h1 id="page-title" tabindex="-1">${hTitle}</h1>${badge()}</div>${info ? `<p>${info}</p>` : ''}</header>`;
const timezone = () => `<p class="fine-print">${t('zone.note')}</p>`;
const totals = items => `<dl class="totals">${items.map(([label, val]) => `<div><dt>${label}</dt><dd>${val}</dd></div>`).join('')}</dl>`;
const announceText = text => { announce.textContent = text; };
const currencyUnit = currency => currency || t('currency.unrecorded');
const resultLabel = key => t('result.' + key);
const categoryLabel = key => t('cat.' + key);
const phaseText = key => t('phase.' + key);
const errorText = code => [t('err.' + code + '.title'), t('err.' + code + '.copy')];
const brandTitle = () => t('brand.title');

function categoryStatus(key) {
  if (isReady(key)) return '';
  return empty(`${categoryLabel(key)}：${category(key)?.status === 'invalid' ? t('status.invalid') : t('status.missing')}`);
}

function skipped(key) {
  const n = category(key)?.skipped;
  return isReady(key) && n > 0 ? `<p class="fine-print">${t('skipped', {n: count(n)})}</p>` : '';
}

function metrics(summary, unavailable = false) {
  const nothing = `<span class="metric-none">${t('metric.none')}</span>`;
  const metricValues = [
    ['swords', t('metric.matches'), unavailable ? nothing : number(summary.count)],
    ['play', t('metric.duration'), unavailable || summary.duration === null ? nothing : fmtDuration(summary.duration)],
    ['trophy', t('metric.rate'), unavailable || summary.competitiveRate === null ? nothing : fmtPercent(summary.competitiveRate)]
  ];
  return `<dl class="metrics" aria-label="${t('aria.metrics')}">${metricValues.map(([symbol, label, value]) => `<div class="card metric metric-${symbol}"><dt>${icon(symbol)}<span>${label}</span></dt><dd>${value}</dd></div>`).join('')}</dl>`;
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
  const month = monthFull(point.month);
  return currency !== undefined
    ? t('chart.copy.amount', {month, amount: point.known ? fmtMoney(point.sum, currency) : t('unrecorded')})
    : t('chart.copy.matches', {month, count: count(point.count), duration: fmtDuration(point.known ? point.sum : null)});
}

// Line/bar charts share one geometry. The SVG uses a fixed 600x225 viewBox so
// axis labels stay proportional at every width; month/axis text is rendered as
// HTML outside the SVG to keep it crisp and readable on small screens.
const chartSize = 6;
function axisTop(max, minStep=1) {
  const guess = Math.max(minStep, max / 4);
  const mag = 10 ** Math.floor(Math.log10(guess));
  const unit = [1, 2, 5, 10].map(n=>n*mag).find(n=>n>=guess);
  return unit * 4;
}
function chart(items, key, currency) {
  const paymentChart = currency !== undefined;
  const {months, undated} = dateBuckets(items, paymentChart);
  if (!months.length) return empty(items.length ? t('chart.noDated') : t('chart.noMonthly'));
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
  const paging = windowCount > 1 && key !== 'home' ? `<div class="chart-paging">${button(`chart-page:${key}:older`, t('chart.past'), 'secondary', offset === windowCount - 1 ? 'disabled' : '')}<span>${offset + 1} / ${windowCount}</span>${button(`chart-page:${key}:newer`, t('chart.newer'), 'secondary', offset === 0 ? 'disabled' : '')}</div>` : '';
  return `<div class="chart-box" data-chart="${key}">${paymentChart?'':`<p class="chart-legend"><span class="series-count">${t('chart.matches')}</span><span class="series-time">${t('chart.time')}</span></p>`}
    <div class="plot-wrap">${axis(paymentChart?amountTop:countTop,'left')}${paymentChart?'':axis(amountTop,'right')}<svg class="chart" viewBox="0 0 600 225" aria-hidden="true" focusable="false">
      <defs><linearGradient id="plot-fill-${key}" x2="0%" y2="100%"><stop stop-color="#6B9EEA" stop-opacity=".19"/><stop offset="1" stop-color="#6B9EEA" stop-opacity=".015"/></linearGradient></defs>
      ${horizontal}${vertical}<line class="chart-cursor" x1="${x(selected??0)}" x2="${x(selected??0)}" y1="30" y2="195"${selected===null?' visibility="hidden"':''}/>
      ${paymentChart?bars:lines}${targets}
    </svg><div class="plot-tooltip"${selected===null?' hidden':''}>${selected===null?'':tooltipCopy(points[selected],currency)}</div></div>
    <div class="months" role="group" aria-label="${t('aria.chartMonths')}">${points.map((p,i)=>button(`point:${key}:${i}`,monthShort(p.month),'month',`aria-label="${escape(chartCopy(p,currency))}" aria-pressed="${i===selected}"`)).join('')}</div>
    <output class="chart-value visually-hidden" aria-live="polite">${selected===null?'':escape(chartCopy(points[selected],currency))}</output>
    ${paging}${key==='home'&&!undated?'':`<p class="fine-print">${t('chart.fineprint')}${undated ? ` ${t('chart.undated', {n: count(undated)})}` : ''}</p>`}
  </div>`;
}
function tooltipCopy(point,currency){
  return `<strong>${monthFull(point.month)}</strong>${currency!==undefined?`<span>${t('tooltip.amount')}：${escape(point.known?fmtMoney(point.sum,currency):t('unrecorded'))}</span>`:`<span>${t('tooltip.matches')}：${count(point.count)}</span><span>${t('tooltip.time')}：${fmtDuration(point.known?point.sum:null)}</span>`}`;
}

function modeChart(summary, compact=false) {
  if (!summary.count) return empty(t('donut.none'));
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
  const legend = parts.map(({mode, count: n}, i) => `<li><span class="dot tint-${i % palette}" aria-hidden="true"></span><span>${escape(compact?(mode==='competitive'?t('donut.comp'):mode==='その他'?t('donut.other'):modeDisplayLabel(mode, currentLang())):modeDisplayLabel(mode, currentLang()))}</span><strong>${fmtPercent(n / summary.count)}</strong></li>`).join('');
  return `<div class="modes"><svg class="ring" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><g transform="rotate(-90 48 48)">${ring}</g></svg><ul class="legend">${legend}</ul></div>`;
}

const list = (items, row) => `<ul class="rows">${items.map(row).join('')}</ul>`;
const matchRow = m => {
  const result = m.result === 'win' || m.result === 'loss' || m.result === 'draw' ? m.result : 'unknown';
  return `<li><div><strong>${escape(modeDisplayLabel(m.mode, currentLang()))}</strong><small>${escape(formatDate(m.time, currentLang()))}</small></div><div class="end"><strong class="result ${result}">${resultLabel(result)}</strong><small>${fmtDuration(m.duration)}</small></div></li>`;
};
const pageSize = 15;
function rowList(items, key, row, none) {
  if (!items.length) return empty(none);
  const maxPage = Math.ceil(items.length / pageSize) - 1;
  const page = state.offsets[key] = Math.min(maxPage, state.offsets[key] ?? 0);
  const start = pageSize * page;
  const end = Math.min(start + pageSize, items.length);
  const summary = maxPage ? t('play.listSummary', {total: number(items.length), start: number(start + 1), end: number(end)}) : count(items.length);
  return `<p class="fine-print list-summary" id="list-${key}" tabindex="-1">${summary}</p>${list(items.slice(start, end), row)}${maxPage ? `<div class="list-paging">${button(`list:${key}:prev`, t('play.prev'), 'secondary', page ? '' : 'disabled')}<span>${page + 1} / ${maxPage + 1}</span>${button(`list:${key}:next`, t('play.next'), 'secondary', page === maxPage ? 'disabled' : '')}</div>` : ''}`;
}

function reportTotal(entries) {
  return entries === null ? t('report.nodata') : count(entries.reduce((sum, entry) => sum + entry.count, 0));
}

function reportTotals() {
  const {made, received} = category('reports').value;
  return totals([[t('report.made'), reportTotal(made)], [t('report.received'), reportTotal(received)]]);
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
  return totals([[t('payment.total'), groups.length ? groups.map(([c, n]) => `<span>${escape(fmtMoney(n, c))}</span>`).join('') : items.length ? t('unrecorded') : t('payment.none')], [t('payment.count'), count(items.length, t('unit.times'))]]);
}

function storeTotals() {
  const items = rows('store');
  const groups = amounts(items, 'amount');
  return totals([[t('store.total'), groups.length ? groups.map(([c, n]) => `<span>${count(n, escape(currencyUnit(c)))}</span>`).join('') : items.length ? t('unrecorded') : t('store.none')], [t('store.count'), count(items.length)]]);
}

function playDonut(summary, compact=false) {
  if (!compact) return modeChart(summary);
  const byMode=new Map(summary.modeCounts.map(row=>[row.mode,row.count]));
  const comp=byMode.get('competitive')??0;
  const unrated=byMode.get('unrated')??0;
  return modeChart({...summary,modeCounts:[{mode:'competitive',count:comp},{mode:'unrated',count:unrated},{mode:'その他',count:summary.count-comp-unrated}]},true);
}

function playerProfile(summary, available){
  const last=available&&summary.lastTime!==null?formatDate(summary.lastTime, currentLang()):t('metric.none');
  const riotId=state.demo?'Player#JP1':category('profile')?.riotId;
  return `<div class="player-profile">${profileAvatarUrl?`<img class="profile-avatar" src="${profileAvatarUrl}" width="84" height="84" alt="">`:'<span class="profile-avatar" aria-hidden="true"></span>'}<div class="profile-copy"><h1 id="page-title" tabindex="-1" aria-label="${t('profile.title')}">${escape(riotId||t('profile.title'))}</h1><p>${t('profile.last')} ${escape(last)}</p>${badge()}</div></div>`;
}

function reportStack(){
  const made=category('reports').value.made;
  if(!made?.length)return '';
  const segments=[{name:t('report.stack.cheat'),count:0},{name:t('report.stack.rank'),count:0},{name:t('report.stack.behavior'),count:0},{name:t('report.stack.other'),count:0}];
  const behavior=new Set(['ABUSING_GLITCHES','COMMS_ABUSE_TEXT','COMMS_ABUSE_VOICE','INAPPROPRIATE_TEAM_NAME','OFFENSIVE_NAME','SABOTAGING_TEAM']);
  for(const {code,count:n} of made){const k=code.toUpperCase();segments[k==='CHEATING'?0:k==='RANK_MANIPULATION'?1:behavior.has(k)?2:3].count+=n;}
  const total=segments.reduce((sum,p)=>sum+p.count,0);
  if(!total)return '';
  let x=0;
  return `<div class="report-stack"><svg class="report-bar" viewBox="0 0 400 26" preserveAspectRatio="none" aria-label="${t('report.stack.aria')}" role="img">${segments.map((p,i)=>{const w=400*p.count/total;const rect=p.count?`<rect class="report-tone-${i}" x="${x}" y="0" width="${w}" height="26"><title>${p.name}：${count(p.count)}</title></rect>`:'';x+=w;return rect;}).join('')}</svg><ul class="report-legend">${segments.map((p,i)=>`<li title="${p.name}：${count(p.count)}"><span class="report-tone-${i}"></span>${p.name}</li>`).join('')}</ul></div>`;
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
  const unit=payment?t('payment.monthly',{currency}):t('store.monthly');
  const multipleYears=new Set(points.map(([month])=>month.slice(0,4))).size>1;
  const monthTick = month => multipleYears ? `${month.slice(2,4)} ${monthShort(month)}` : monthShort(month);
  return `<figure class="mini-chart" aria-label="${t('mini.monthly')}${escape(unit)}"><svg class="mini-plot" viewBox="0 0 400 60" role="img" aria-label="${t('mini.monthly')}${escape(unit)}"><path class="chart-grid" d="M0 4H400M0 29H400M0 54H400"/>${points.map(([month,n],i)=>{const h=n/top*50,x=(i+.5)*step,w=Math.min(36,step*.65);return `<rect class="chart-bar" x="${x-w/2}" y="${54-h}" width="${w}" height="${h}" rx="2"><title>${monthFull(month)}：${escape(payment?fmtMoney(n,currency):count(n))}</title></rect>`;}).join('')}</svg><div class="mini-months" aria-hidden="true">${points.map(([month])=>`<span>${escape(monthTick(month))}</span>`).join('')}</div>${payment&&currencies.length>1?`<figcaption>${escape(currency)} ${t('payment.monthlyShort')}</figcaption>`:''}</figure>`;
}

function recentMatchRow(m){
  const result = m.result === 'win' || m.result === 'loss' || m.result === 'draw' ? m.result : 'unknown';
  return `<li><span class="recent-icon" aria-hidden="true">${icon('recent')}</span><time>${escape(formatDate(m.time, currentLang()))}</time><span class="recent-mode">${escape(modeDisplayLabel(m.mode, currentLang()))}</span><strong class="result ${result}">${resultLabel(result)}</strong><span class="recent-duration">${fmtDuration(m.duration)}</span></li>`;
}

function matchScope() {
  return rows('matches').filter(row => row.scope === 'matchmaking');
}

function byDate(items) {
  return [...items].sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity));
}

// Home composes the profile, three KPI cards, and the overview cards. Each card
// degrades independently when its category is missing, so a partial import still
// renders a coherent page.
function home() {
  const items=matchScope(), summary=summarizeMatches(items), matchesAvailable=isReady('matches');
  return `<div class="home-overview">${playerProfile(summary,matchesAvailable)}${metrics(summary,!matchesAvailable)}</div>
    <div class="cards home-grid">
      <div class="play-overview">
        ${card(title('play'),matchesAvailable?chart(items,'home')+skipped('matches'):categoryStatus('matches'),detail('play'),'play-card')}
        ${card(t('home.modes'),matchesAvailable?playDonut(summary,true):categoryStatus('matches'),'','mode-card')}
      </div>
      ${card(title('reports'),isReady('reports')?reportTotals()+reportStack()+skipped('reports'):categoryStatus('reports'),detail('reports'),'report-card')}
      ${card(title('payment'),isReady('payments')?paymentTotals()+miniChart(rows('payments'),'payment')+skipped('payments'):categoryStatus('payments'),detail('payment'),'payment-card')}
      ${card(title('store'),isReady('store')?storeTotals()+miniChart(rows('store'),'store')+skipped('store'):categoryStatus('store'),detail('store'),'store-card')}
      ${card(t('recent.title'),matchesAvailable?(items.length?`<ul class="rows recent-matches">${byDate(items).slice(0,3).map(recentMatchRow).join('')}</ul>`:empty(t('recent.none'))):categoryStatus('matches'),detail('play',t('recent.more'),'go-list'),'recent-card')}
    </div>`;
}

function select(key, label, options, selected = state.filters[key]) {
  filterOptions.set(key, options);
  return `<label>${label}<select data-filter="${key}">${options.map(([value, text], i) => `<option value="${i}" ${selected === value ? 'selected' : ''}>${escape(text)}</option>`).join('')}</select></label>`;
}

function play() {
  const intro = heading(title('play'), t('play.info'));
  if (!isReady('matches')) return intro + card(categoryLabel('matches'), categoryStatus('matches'));
  const filter = state.filters;
  const items = rows('matches');
  const scoped = items.filter(m => m.scope === filter.scope);
  const displayed = byDate(scoped.filter(m => (filter.period === null || monthOf(m) === filter.period) && (filter.mode === null || m.mode === filter.mode)));
  const summary = summarizeMatches(displayed);
  const modes = [...new Set(scoped.map(m => m.mode))].map(m => [m, modeDisplayLabel(m, currentLang())]).sort((a, b) => a[1].localeCompare(b[1], currentLang()));
  const months = [...new Set(scoped.map(monthOf).filter(Boolean))].sort().reverse();
  const monthOptions = months.map(m => [m, monthFull(m)]);
  const scopes = [['matchmaking', t('play.matchmaking')], ['other', t('play.other')]];
  if (items.some(m => m.scope === 'unknown')) scopes.push(['unknown', t('play.unknown')]);
  const filters = `<div class="filters">${select('scope', t('play.scope'), scopes)}${select('period', t('play.period'), [[null, t('play.all')], ...monthOptions])}${select('mode', t('play.mode'), [[null, t('play.modeAll')], ...modes])}${button('reset', t('play.reset'), 'secondary')}</div>`;
  const none = filter.period !== null || filter.mode !== null ? t('play.noneFiltered') : t('play.none');
  return `${intro}${card(t('play.filters'), filters + skipped('matches'))}${metrics(summary)}
    <div class="cards"><div class="cols">${card(t('play.monthly'), chart(displayed, 'play'))}${card(t('home.modes'), modeChart(summary))}</div>
    <section class="card"><h2 id="match-list-title" tabindex="-1">${t('play.list')}</h2>${rowList(displayed, 'matches', matchRow, none)}</section></div>${timezone()}`;
}

function reports() {
  const intro = heading(title('reports'), t('reports.info'));
  if (!isReady('reports')) return intro + card(categoryLabel('reports'), categoryStatus('reports'));
  const {made, received} = category('reports').value;
  const box = entries => entries === null ? empty(t('report.nodataCopy')) : `<p class="lead-number">${reportTotal(entries)}</p>${entries.length ? list([...entries].sort((a, b) => b.count - a.count), r => `<li><span>${escape(reportDisplayLabel(r.code, currentLang()))}</span><strong class="end">${count(r.count)}</strong></li>`) : ''}`;
  return `${intro}<div class="cols">${card(t('report.made'), box(made))}${card(t('report.received'), box(received))}</div>${skipped('reports')}`;
}

function payment() {
  const intro = heading(title('payment'), t('payment.info'));
  if (!isReady('payments')) return intro + card(categoryLabel('payments'), categoryStatus('payments'));
  const items = rows('payments');
  const currencies = [...new Set(items.map(row => row.currency))].sort((a, b) => a.localeCompare(b));
  const currency = state.filters.currency ?? currencies[0];
  const labels = {JPY: t('payment.jpy'), USD: t('payment.usd')};
  const paymentRow = p => `<li><div><strong>${escape(fmtMoney(p.amountX100, p.currency))}</strong><small>${escape(formatDate(p.time, currentLang()))}</small></div><div class="end"><small>${t('payment.granted')}</small>${p.granted.length ? p.granted.map(g => `<strong>${finite(g.amount) ? count(g.amount, escape(currencyUnit(g.currency))) : t('unrecorded')}</strong>`).join('') : `<strong>${t('unrecorded')}</strong>`}</div></li>`;
  const graph = currencies.length ? `<div class="filters">${select('currency', t('payment.currency'), currencies.map(c => [c, Object.hasOwn(labels, c) ? labels[c] : currencyUnit(c)]), currency)}</div>${chart(items.filter(p => p.currency === currency), 'payment', currency)}` : empty(t('payment.noMonthly'));
  return `${intro}<div class="cards">${card(t('payment.summary'), paymentTotals() + skipped('payments'))}${card(t('payment.monthlyTitle'), graph)}${card(t('payment.details'), rowList(byDate(items), 'payments', paymentRow, t('payment.noRecords')))}</div>${timezone()}`;
}

function store() {
  const intro = heading(title('store'), t('store.info'));
  if (!isReady('store')) return intro + card(categoryLabel('store'), categoryStatus('store'));
  const storeRow = p => `<li><div><strong>${escape(itemDisplayLabel(p, currentLang()))}</strong><small>${escape(formatStoreDate(p, currentLang()))} · ${escape(kindDisplayLabel(p.kind, currentLang()))}</small></div><strong class="end store-amount">${finite(p.amount) ? count(p.amount, escape(currencyUnit(p.currency))) : t('unrecorded')}</strong></li>`;
  return `${intro}<div class="cards">${card(t('store.summary'), storeTotals() + skipped('store'))}${card(t('store.details'), rowList(byDate(rows('store')), 'store', storeRow, t('store.noRecords')))}</div><p class="fine-print">${t('store.note')}</p>`;
}

function voice(){
  const record=category('voice');
  const status=record?.status;
  const message=status==='ready'?t('voice.ready'):status==='unsupported'?t('voice.unsupported'):status==='invalid'?t('voice.invalid'):t('voice.missing');
  return heading(title('voice'))+card(t('voice.section'),`<div class="voice-info">${empty(message)}<p class="fine-print">${t('voice.fineprint')}</p></div>`);
}

function guide(){
  const steps=`<ol class="guide-steps"><li><h3>${t('guide.step1.title')}</h3><p>${t('guide.step1.copy')}</p><a class="button secondary guide-link" href="${requestUrl()}" target="_blank" rel="noopener noreferrer">${t('guide.step1.link')} ${icon('next')}</a></li><li><h3>${t('guide.step2.title')}</h3><p>${t('guide.step2.copy')}</p></li><li><h3>${t('guide.step3.title')}</h3><p>${t('guide.step3.copy')}</p>${button('open',`${icon('upload')} ${t('guide.step3.button')}`,'secondary')}</li></ol>`;
  return `<div class="guide-view">${heading(title('guide'),t('guide.info'))}
    ${card(t('guide.section.title'),steps)}
    <div class="cards">${card(t('guide.privacy.title'),`<p><strong>${t('guide.privacy.1')}</strong></p><p>${t('guide.privacy.2')}</p><p>${t('guide.privacy.3')}</p><p>${t('guide.privacy.4')}</p><p>${t('guide.privacy.5')}</p>`)}</div></div>`;
}

function more() {
  const menu=homePages.map(key=>button(`go:${key}`,`${icon(key)}<span>${title(key)}</span>${icon('next')}`,'menu-item')).join('');
  const manage=`<p class="muted">${t('more.manageCopy')}</p><div class="actions">${button('open',t('more.upload'),'secondary')}${button('clear',t('more.clear'),'danger')}</div>`;
  return `${heading(title('more'),t('more.info'))}<div class="cols">${card(t('more.categories'),`<div class="menu">${menu}</div>`)}${card(t('more.manage'),manage)}</div>`;
}

function intro() {
  return `<div class="intro"><section class="intro-card card" id="drop-target">
    <h1 id="page-title" tabindex="-1">${t('intro.title')}</h1>
    <p class="intro-copy">${t('intro.copy')}</p>
    <div class="actions intro-actions">${button('open',`${icon('upload')}${state.error?t('intro.uploadOther'):t('intro.upload')}`,'primary')}${button('demo',t('intro.demo'),'secondary')}${button('go:guide',t('intro.guide'),'text-button')}</div>
    <div class="privacy">${icon('shield')}<div><strong>${t('intro.privacy.title')}</strong><p>${t('intro.privacy.save')}</p><p>${t('intro.privacy.how')}</p><p class="drop-copy">${t('intro.privacy.drop')}</p></div></div>
  </section><p class="footer-note">${t('footer.unofficial')}</p></div>`;
}

function loading() {
  const hTitle = state.dataset || state.view==='guide' ? `<h2 id="loading-title" tabindex="-1">${t('loading.title')}</h2>` : `<h1 id="page-title" tabindex="-1">${t('loading.title')}</h1>`;
  return `<section class="card loading">${hTitle}<div class="progress" aria-hidden="true"></div>
    <p id="load-phase" role="status" aria-atomic="true">${phaseText(state.reading.phase)}</p>
    <p class="muted">${state.dataset ? t('loading.keep') : t('loading.new')}</p>
    <div class="actions">${button('cancel', t('loading.cancel'), 'secondary')}${button('open', t('loading.other'))}</div></section>`;
}

function errorBlock() {
  if (!state.error) return '';
  const [errTitle, copy] = errorText(state.error);
  return `<section class="alert" aria-labelledby="error-title"><h2 id="error-title" tabindex="-1">${errTitle}</h2><p>${copy}${state.dataset ? ` ${t('error.keep')}` : ''}</p>${state.dataset ? `<div class="actions">${button('open', t('loading.other'), 'secondary')}${button('dismiss', t('error.dismiss'))}</div>` : ''}</section>`;
}

function nav(keys, css) {
  return `<nav aria-label="${t('aria.nav')}" class="${css}">${keys.map(key => {
    const current = state.view === key ? 'aria-current="page"' : key === 'more' && css === 'bottom' && homePages.includes(state.view) ? 'aria-current="location"' : '';
    return button(`go:${key}`, `${icon(key)}<span>${title(key)}</span>`, 'nav-item', current);
  }).join('')}</nav>`;
}

const views = {home,play,reports,payment,store,voice,guide,more};
function sidebar(){
  return `<aside class="rail">${brand()}${nav(pages,'side-nav')}<div class="rail-bottom">${button('go:more',t('sidebar.manage'),'text-button')}<p class="footer-note">${t('footer.unofficial')}</p></div></aside>`;
}
function langToggle(){
  const target = currentLang() === 'ja' ? 'en' : 'ja';
  const label = currentLang() === 'ja' ? 'English' : '日本語';
  return button('toggle-lang', label, 'lang-toggle', `aria-label="${currentLang() === 'ja' ? 'Switch to English' : '日本語に切り替え'}"`);
}
function appHeader(active){
  const menuKeys=active?['home','play',...homePages,'more']:['home','guide'];
  return `<header class="top"><div class="top-in"><button type="button" class="brand-link" data-action="go:home" aria-label="${t('header.home')}">${brand()}</button><div class="header-tools">${langToggle()}${button('open',`${icon('upload')}${t('header.upload')}`,'secondary desktop-upload')}${button('toggle-menu',icon('menu'),'mobile-menu-toggle','aria-label="'+t('header.menu')+'" aria-controls="mobile-menu" aria-expanded="'+state.menuOpen+'"')}</div></div>
    <div id="mobile-menu" class="mobile-menu-panel"${state.menuOpen?'':' hidden'}>${nav(menuKeys,'menu')} ${button('open',`${icon('upload')}${t('header.upload')}`,'secondary')}</div></header>`;
}
function render() {
  const active=Boolean(state.dataset);
  chartModels.clear();
  filterOptions.clear();
  app.classList.toggle('loaded',active);
  document.documentElement.lang = currentLang();
  document.title=active||state.view==='guide'?`${title(state.view)}｜${brandTitle()}`:brandTitle();
  const notice=active&&state.view==='home'&&Object.keys({matches:1,reports:1,payments:1,store:1}).some(key=>!isReady(key))?`<p class="notice">${t('notice.partial')}</p>`:'';
  const view=active||state.view==='guide'?views[state.view]():state.reading?'':intro();
  const storageStatus=state.storageWarning?`<p class="alert" role="alert">${escape(state.storageWarning)}</p>`:state.storageBusy?`<p class="notice" role="status">${t('storage.saving')}</p>`:'';
  app.innerHTML=`<a class="skip" href="#content">${t('skip')}</a>${appHeader(active)}${active?sidebar():''}<div class="body"><main id="content" tabindex="-1">${state.reading?loading():''}${errorBlock()}${storageStatus}${notice}${view}</main></div>${active?nav(['home','play','more'],'bottom'):''}`;
  localizeDialog();
}

function focus(target = '#page-title', scroll = false) {
  const element = document.querySelector(target);
  if (scroll) window.scrollTo(0, 0);
  element?.focus({preventScroll:scroll});
}

// The clear-confirmation dialog lives outside #app, so its static text is
// refreshed on every render to match the current language.
function localizeDialog() {
  const titleEl = document.querySelector('#confirm-title');
  const copyEl = document.querySelector('#confirm-copy');
  const backEl = document.querySelector('#confirm [data-action="close"]');
  const confirmEl = document.querySelector('#confirm [data-action="confirm-clear"]');
  if (titleEl) titleEl.textContent = t('confirm.title');
  if (copyEl) copyEl.textContent = t('confirm.copy');
  if (backEl) backEl.textContent = t('confirm.back');
  if (confirmEl) confirmEl.textContent = t('confirm.clear');
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
  Object.assign(state, {dataset, demo, error:null, reading:null, view:'home', loadedAt:dataset&&!demo?Date.now():null, menuOpen:false, filters:filtersInitial(), charts:{}, offsets:{}});
  picker.value = '';
  history.replaceState(dataset ? {view:'home'} : null, '', routeUrl('home'));
  render();
  focus('#page-title', true);
  announceText(demo ? t('announce.demo') : dataset ? t('announce.loaded') : t('announce.cleared'));
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
    state.storageWarning=previousCleared ? t('storage.fail.current') : t('storage.fail.stale');
  } finally {
    state.storageBusy=false;
    render();
    if(state.storageWarning)announceText(state.storageWarning);
    else announceText(t('storage.saved'));
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
    state.storageWarning=t('storage.clear.fail');
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
  state.error = ['broken','unsupported','sizeLimit','expandedLimit','noTarget','unreadable','multiple','startup','worker','jsonSizeLimit','invalidJson','unrecognizedJson'].includes(code) ? code : 'worker';
  render();
  focus('#error-title', true);
  announceText(errorText(state.error).join(' ') + (state.dataset ? ` ${t('error.keep')}` : ''));
}

function makeWorker() {
  const instance = new Worker(workerURL, {type:'module', name:'valorant-zip'});
  worker = instance;
  instance.addEventListener('message', ({data}) => {
    if (worker !== instance || !state.reading || !data) return;
    if (data.type === 'progress' && ['checking','reading','normalizing'].includes(data.phase)) {
      state.reading.phase = data.phase;
      const phase = document.querySelector('#load-phase');
      if (phase && phase.textContent !== phaseText(data.phase)) phase.textContent = phaseText(data.phase);
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
  announceText(state.dataset ? t('announce.cancel.keep') : t('announce.cancel'));
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
    if (state.reading) announceText(errorText('multiple').join(' '));
    else {
      state.error = 'multiple';
      render();
      focus('#error-title', true);
      announceText(errorText('multiple').join(' '));
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
  announceText(updated || (key === 'currency' ? t('announce.noPayment') : t('announce.noMatches')));
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

// UI-only language preference; stored separately from imported data.
const LANG_KEY = 'valorant-lang';
function loadLang() {
  try { const saved = localStorage.getItem(LANG_KEY); if (saved === 'ja' || saved === 'en') setLang(saved); } catch {}
}
function persistLang() {
  try { localStorage.setItem(LANG_KEY, currentLang()); } catch {}
}

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
    case 'toggle-lang': {
      setLang(currentLang() === 'ja' ? 'en' : 'ja');
      persistLang();
      render();
      focus('.lang-toggle');
      announceText(currentLang() === 'ja' ? '表示言語を日本語に切り替えました。' : 'Switched to English.');
      break;
    }
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
      announceText(t('announce.reset'));
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

loadLang();
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
    state.storageWarning=t('storage.read.fail');
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
