// UI localization. Japanese is the default language; English is available via the
// toggle in the site header. The chosen language is stored only as a UI preference
// (localStorage) and never mixed with the imported player data.

export const LANGS = ['ja', 'en'];
const LABEL = { ja: '日本語', en: 'English' };
export const langName = lang => LABEL[lang];

let lang = 'ja';
export const currentLang = () => lang;
export function setLang(next) {
  if (LANGS.includes(next)) lang = next;
}

// Message catalog. Keys are grouped by feature; `t` falls back to Japanese so a
// missing English entry can never blank the UI.
const M = {
  ja: {
    'nav.home':'ホーム', 'nav.play':'プレー記録', 'nav.reports':'通報', 'nav.payment':'課金',
    'nav.store':'ストア取引', 'nav.voice':'ボイスチャット', 'nav.guide':'使い方', 'nav.more':'その他',

    'phase.checking':'ファイルの形式を確認中…', 'phase.reading':'必要なデータを読み込み中…', 'phase.normalizing':'ダッシュボードを準備中…',

    'err.broken.title':'ZIPを開けませんでした', 'err.broken.copy':'ZIPが破損しているか、正しくダウンロードできていない可能性があります。',
    'err.unsupported.title':'対応していないZIP形式です', 'err.unsupported.copy':'Riotから受け取った元のZIPを、解凍せずに選んでください。',
    'err.sizeLimit.title':'ZIPのサイズまたは構成が上限を超えています', 'err.sizeLimit.copy':'ZIPファイルの大きさ、または中に含まれるファイルの一覧が、読み込み可能な範囲を超えています。',
    'err.expandedLimit.title':'展開するデータ量が上限を超えています', 'err.expandedLimit.copy':'ファイルのサイズにかかわらず、展開に必要なデータ量が多すぎるため、読み込めません。',
    'err.noTarget.title':'VALORANTの対象データが見つかりません', 'err.noTarget.copy':'Riotから受け取ったVALORANTの記録を含むZIPを選んでください。',
    'err.unreadable.title':'対象データを読み込めません', 'err.unreadable.copy':'対象ファイルは見つかりましたが、解析できませんでした。',
    'err.multiple.title':'ファイルは1つずつ開いてください', 'err.multiple.copy':'複数のファイルから、読み込むファイルを1つ選んでください。',
    'err.startup.title':'ZIPの読み込み機能を準備できませんでした', 'err.startup.copy':'ネットワークに接続した状態でページを開き直してください。デモは引き続き利用できます。',
    'err.worker.title':'ファイルの読み込みを完了できませんでした', 'err.worker.copy':'もう一度試すか、別のファイルを選んでください。',
    'err.jsonSizeLimit.title':'JSONのサイズが上限を超えています', 'err.jsonSizeLimit.copy':'16 MiB以下の対象JSON、または元のZIPを選んでください。',
    'err.invalidJson.title':'JSONを読み込めませんでした', 'err.invalidJson.copy':'ファイルの内容が正しいJSONになっているか確認してください。',
    'err.unrecognizedJson.title':'対応するデータがJSONに見つかりません', 'err.unrecognizedJson.copy':'Riotから取得した元のZIPか、対象のVALORANT JSONを選んでください。',

    'zone.note':'日時・月別集計は日本時間（JST）。日時やタイムゾーンを確認できない記録は「未記録」と表示します。',
    'cat.matches':'対戦履歴', 'cat.reports':'通報集計', 'cat.payments':'決済履歴', 'cat.store':'ストア取引',
    'result.win':'勝ち', 'result.loss':'負け', 'result.draw':'引き分け', 'result.unknown':'不明',
    'status.invalid':'読み込めませんでした', 'status.missing':'未収録',
    'skipped':'形式を確認できない {n} は集計・明細に含まれません。',

    'metric.matches':'対戦数', 'metric.duration':'合計試合時間', 'metric.rate':'コンペ勝率', 'metric.none':'データなし',
    'unrecorded':'未記録', 'currency.unrecorded':'（通貨未記録）',
    'duration.seconds':'秒', 'duration.minutes':'分', 'duration.hours':'時間',

    'chart.matches':'対戦数', 'chart.time':'試合時間（時間）', 'chart.amount':'支払額',
    'chart.copy.matches':'{month} · 対戦 {count} ／ 試合時間 {duration}',
    'chart.copy.amount':'{month} · 支払額 {amount}',
    'chart.noDated':'日時のある記録がありません。', 'chart.noMonthly':'月別に表示できる記録がありません。',
    'chart.fineprint':'記録がある月を最大6か月ずつ表示。', 'chart.undated':'日時未記録の {n} はグラフに含まれません。',

    'donut.comp':'コンペ', 'donut.other':'その他', 'donut.none':'表示できる対戦がありません。',

    'report.made':'送った通報', 'report.received':'受けた通報', 'report.nodata':'データなし',
    'report.nodataCopy':'データなし（件数は記録されていません）。',
    'report.stack.cheat':'チート', 'report.stack.rank':'ランク操作', 'report.stack.behavior':'不適切行為', 'report.stack.other':'その他',
    'report.stack.aria':'送った通報の理由別割合',

    'payment.total':'総支払額', 'payment.count':'決済回数', 'payment.none':'支払いの記録なし',
    'payment.currency':'グラフの通貨', 'payment.jpy':'日本円（JPY）', 'payment.usd':'米ドル（USD）',
    'payment.details':'決済明細', 'payment.granted':'付与された通貨', 'payment.noRecords':'決済の記録はありません。',
    'payment.noMonthly':'月別に表示できる決済記録がありません。',
    'payment.monthly':'支払額（{currency}）',

    'store.total':'ゲーム内通貨の消費量', 'store.count':'取引件数', 'store.none':'消費の記録なし',
    'store.details':'取引明細', 'store.noRecords':'取引の記録はありません。',
    'store.monthly':'取引件数（時差不明の記録はZIP記載月）',
    'store.note':'タイムゾーンがわかる日時は日本時間（JST）で表示します。不明な日時はZIPに記載された時刻のまま表示します。',

    'recent.title':'最近の試合', 'recent.more':'もっと見る', 'recent.none':'マッチメイキングの記録はありません。',
    'profile.last':'最終プレー', 'profile.title':'プレーの概要', 'badge.sample':'サンプルデータ',

    'play.info':'試合の推移・モード別内訳・明細',
    'play.filters':'絞り込み', 'play.scope':'記録の種類', 'play.matchmaking':'マッチメイキング', 'play.other':'その他のプレー', 'play.unknown':'種類が不明なプレー',
    'play.period':'期間', 'play.all':'全期間', 'play.mode':'モード', 'play.modeAll':'すべて', 'play.reset':'リセット',
    'play.monthly':'月別の対戦数・試合時間', 'play.list':'試合一覧',
    'play.noneFiltered':'条件に一致する試合がありません。絞り込みを変更するか、リセットしてください。', 'play.none':'この種類の対戦記録はありません。',
    'play.listSummary':'{total} 件中 {start}–{end} 件を表示',
    'play.prev':'前のページ', 'play.next':'次のページ',

    'reports.info':'ZIPに収録された集計です。試合の期間フィルターは適用されません。',
    'payment.info':'支払額は通貨ごとに表示します。',
    'store.info':'消費量が未記録の取引も明細に表示します。',

    'voice.title':'ボイスチャット', 'voice.section':'文字起こし',
    'voice.ready':'ボイスチャットの文字起こしは記録されていません。',
    'voice.unsupported':'文字起こしファイルはありますが、内容の形式を確認できていないため表示できません。',
    'voice.invalid':'ボイスチャットのデータを読み込めませんでした。',
    'voice.missing':'ボイスチャットのデータは収録されていません。',
    'voice.fineprint':'音声の再生や他のユーザーへの送信は行いません。',

    'guide.info':'Riot Gamesのデータを取得し、この端末で確認する方法',
    'guide.step1.title':'Riot Gamesにデータを申請する', 'guide.step1.copy':'公式ページにアクセスし、VALORANTで使っているRiotアカウントでログインして、案内に沿って申請します。',
    'guide.step1.link':'Riot公式のデータ申請ページを開く',
    'guide.step2.title':'レポートを端末に保存する', 'guide.step2.copy':'Riot Gamesから受け取ったZIPをそのままダウンロードしてください。解凍は不要です。',
    'guide.step3.title':'このサイトでファイルを選ぶ', 'guide.step3.copy':'「データをアップロード」からZIPまたは対象のJSONを選びます。PCではドラッグ＆ドロップでも開けます。',
    'guide.step3.button':'ファイルを選ぶ',
    'guide.section.title':'データの取得から表示まで', 'guide.privacy.title':'個人データの扱い',
    'guide.privacy.1':'選んだファイルの中身は、お使いのスマートフォンやパソコンの中だけで読み取り・集計します。',
    'guide.privacy.2':'ファイルや表示された集計結果が、このサイトや外部のサーバーへ送信されることはありません。他の人にも公開されません。',
    'guide.privacy.3':'読み取った表示用データは、このブラウザ内に保存されるため、ページを閉じたり再読み込みしたりしても残ります。同じ端末・ブラウザを使う人は閲覧できるため、共有端末ではご注意ください。「その他」のデータ管理から消去できます。元のファイルは保存・削除されません。',
    'guide.privacy.4':'※ サイト自体を開くときやRiot公式の申請ページを利用するときは、インターネット通信が必要です。',
    'guide.privacy.5':'開示データの内容によっては、一部の項目が表示されません。プロフィールの画像はイメージです。',

    'more.info':'カテゴリ別の詳細とデータ管理', 'more.categories':'カテゴリ', 'more.manage':'データ管理',
    'more.manageCopy':'表示用データはこの端末のブラウザ内に保存され、再読み込み後も表示されます。別のファイルは読み込みが成功したときだけ入れ替えます。共有端末では利用後に消去してください。',
    'more.upload':'データをアップロード', 'more.clear':'表示データを消去',

    'intro.title':'あなたのプレー記録を、手元で。',
    'intro.copy':'Riot Gamesから受け取ったZIPや対象のJSONを選ぶと、VALORANTのプレー記録や取引履歴を確認できます。',
    'intro.upload':'データをアップロード', 'intro.uploadOther':'別のファイルを選ぶ', 'intro.demo':'デモを見る', 'intro.guide':'使い方',
    'intro.privacy.title':'解凍不要・ファイルは送信されません',
    'intro.privacy.save':'表示用データは再読み込みできるよう、この端末のブラウザ内に保存されます。共有端末では利用後に消去してください。',
    'intro.privacy.how':'端末の「ファイル」や「ダウンロード」からZIPまたはJSONを選びます。',
    'intro.privacy.drop':'PCでは、この画面にファイルをドラッグ＆ドロップできます。',
    'footer.unofficial':'Riot Gamesの公式サービスではありません',

    'loading.title':'読み込み中', 'loading.new':'ファイルは端末内で処理され、送信されません。',
    'loading.keep':'完了するまで現在の表示は変わりません。',
    'loading.cancel':'読み込みを取り消す', 'loading.other':'別のファイルを選ぶ',

    'error.keep':'前の表示はそのままです。', 'error.dismiss':'閉じる',
    'notice.partial':'一部のデータを表示できません。読めたカテゴリを表示しています。',
    'storage.saving':'この端末にデータを保存しています…',
    'storage.saved':'表示用データをこの端末に保存しました。',
    'storage.fail.current':'端末に保存できませんでした。現在のデータは表示できますが、再読み込みすると消えます。',
    'storage.fail.stale':'端末に保存できませんでした。再読み込みすると以前のデータが表示される場合があります。ブラウザのサイトデータ設定も確認してください。',
    'storage.clear.fail':'ブラウザ内のデータを消去できませんでした。再度お試しいただくか、ブラウザのサイトデータを削除してください。',
    'storage.read.fail':'ブラウザ内の保存データを確認できませんでした。保存設定をご確認ください。',

    'announce.demo':'サンプルデータを表示しました。', 'announce.loaded':'ファイルの読み込みが完了しました。', 'announce.cleared':'表示データを消去しました。',
    'announce.cancel.keep':'読み込みを取り消しました。前の表示はそのままです。', 'announce.cancel':'読み込みを取り消しました。',
    'announce.reset':'絞り込みをリセットしました。', 'announce.noMatches':'条件に一致する試合はありません。',
    'announce.noPayment':'月別に表示できる決済記録がありません。',

    'header.upload':'データをアップロード', 'header.menu':'メニュー', 'header.home':'ホームへ戻る',
    'sidebar.manage':'データ管理',
    'confirm.title':'表示データを消去しますか？', 'confirm.copy':'画面のデータと、このブラウザに保存した表示用データを消去します。元のZIPやJSONは削除しません。',
    'confirm.back':'戻る', 'confirm.clear':'消去する',

    'brand.title':'VALORANT プレイヤー分析',
    'unit.records':'件', 'unit.times':'回',
    'tooltip.matches':'対戦数', 'tooltip.time':'試合時間', 'tooltip.amount':'支払額',
    'aria.nav':'画面ナビゲーション', 'aria.chartMonths':'グラフの月を選択', 'aria.metrics':'対戦指標（マッチメイキング）',
    'skip':'本文へ移動',
    'chart.past':'過去の月', 'chart.newer':'新しい月',
    'detail.view':'詳細を見る', 'detail.aria':'{title}の{label}',
    'home.modes':'モード別の内訳',
    'payment.summary':'課金の概要', 'payment.monthlyTitle':'月別の支払額', 'payment.monthlyShort':'月別支払額',
    'store.summary':'ストア取引の概要',
    'mini.monthly':'月別',
  },

  en: {
    'nav.home':'Home', 'nav.play':'Play History', 'nav.reports':'Reports', 'nav.payment':'Payments',
    'nav.store':'Store Purchases', 'nav.voice':'Voice Chat', 'nav.guide':'How to Use', 'nav.more':'More',

    'phase.checking':'Checking file format…', 'phase.reading':'Reading data…', 'phase.normalizing':'Preparing dashboard…',

    'err.broken.title':'Couldn\u2019t open the ZIP', 'err.broken.copy':'The ZIP may be corrupted or not downloaded correctly.',
    'err.unsupported.title':'Unsupported ZIP format', 'err.unsupported.copy':'Select the original ZIP you received from Riot, without extracting it.',
    'err.sizeLimit.title':'ZIP size or structure exceeds the limit', 'err.sizeLimit.copy':'The ZIP file size, or the list of files it contains, is too large to read.',
    'err.expandedLimit.title':'Expanded data exceeds the limit', 'err.expandedLimit.copy':'Regardless of file size, the amount of data needed after extraction is too large to read.',
    'err.noTarget.title':'No VALORANT data found', 'err.noTarget.copy':'Select a ZIP that contains the VALORANT records you received from Riot.',
    'err.unreadable.title':'Couldn\u2019t read the target data', 'err.unreadable.copy':'The target file was found but could not be parsed.',
    'err.multiple.title':'Open one file at a time', 'err.multiple.copy':'Choose a single file to read.',
    'err.startup.title':'Couldn\u2019t prepare the import feature', 'err.startup.copy':'Reload the page while connected to the internet. The demo remains available.',
    'err.worker.title':'Couldn\u2019t finish reading the file', 'err.worker.copy':'Try again, or choose another file.',
    'err.jsonSizeLimit.title':'JSON exceeds the size limit', 'err.jsonSizeLimit.copy':'Choose a target JSON under 16 MiB, or the original ZIP.',
    'err.invalidJson.title':'Couldn\u2019t read the JSON', 'err.invalidJson.copy':'Check that the file contains valid JSON.',
    'err.unrecognizedJson.title':'No VALORANT data found in this JSON', 'err.unrecognizedJson.copy':'Choose the original ZIP from Riot, or a target VALORANT JSON.',

    'zone.note':'Dates and monthly totals are shown in Japan time (JST). Records whose date or time zone can\u2019t be confirmed are shown as "Unrecorded".',
    'cat.matches':'Match History', 'cat.reports':'Report Summary', 'cat.payments':'Payment History', 'cat.store':'Store Purchases',
    'result.win':'Win', 'result.loss':'Loss', 'result.draw':'Draw', 'result.unknown':'Unknown',
    'status.invalid':'Couldn\u2019t read', 'status.missing':'Not included',
    'skipped':'{n} records of unrecognized format are excluded from totals and lists.',

    'metric.matches':'Matches', 'metric.duration':'Total play time', 'metric.rate':'Competitive win rate', 'metric.none':'No data',
    'unrecorded':'Unrecorded', 'currency.unrecorded':'(currency unrecorded)',
    'duration.seconds':'sec', 'duration.minutes':'min', 'duration.hours':'h',

    'chart.matches':'Matches', 'chart.time':'Play time (hours)', 'chart.amount':'Amount paid',
    'chart.copy.matches':'{month} \u00b7 {count} matches / {duration} play time',
    'chart.copy.amount':'{month} \u00b7 {amount} paid',
    'chart.noDated':'No records with dates.', 'chart.noMonthly':'No monthly data to display.',
    'chart.fineprint':'Shows up to 6 months that have records.', 'chart.undated':'{n} records without a date are excluded from the chart.',

    'donut.comp':'Comp', 'donut.other':'Other', 'donut.none':'No matches to display.',

    'report.made':'Reports made', 'report.received':'Reports received', 'report.nodata':'No data',
    'report.nodataCopy':'No data (counts are not recorded).',
    'report.stack.cheat':'Cheating', 'report.stack.rank':'Rank manipulation', 'report.stack.behavior':'Inappropriate conduct', 'report.stack.other':'Other',
    'report.stack.aria':'Breakdown of reports made by reason',

    'payment.total':'Total paid', 'payment.count':'Payments', 'payment.none':'No payment records',
    'payment.currency':'Chart currency', 'payment.jpy':'Japanese yen (JPY)', 'payment.usd':'US dollar (USD)',
    'payment.details':'Payment details', 'payment.granted':'Currency granted', 'payment.noRecords':'No payment records.',
    'payment.noMonthly':'No monthly payment data to display.',
    'payment.monthly':'Amount paid ({currency})',

    'store.total':'In-game currency spent', 'store.count':'Transactions', 'store.none':'No purchases',
    'store.details':'Transaction details', 'store.noRecords':'No transactions.',
    'store.monthly':'Transactions (records with unknown time zone use the ZIP month)',
    'store.note':'Dates with a known time zone are shown in Japan time (JST). Unknown dates are shown as recorded in the ZIP.',

    'recent.title':'Recent matches', 'recent.more':'See more', 'recent.none':'No matchmaking records.',
    'profile.last':'Last played', 'profile.title':'Play overview', 'badge.sample':'Sample data',

    'play.info':'Trends, mode breakdown, and match details',
    'play.filters':'Filters', 'play.scope':'Record type', 'play.matchmaking':'Matchmaking', 'play.other':'Other play', 'play.unknown':'Unknown type',
    'play.period':'Period', 'play.all':'All time', 'play.mode':'Mode', 'play.modeAll':'All', 'play.reset':'Reset',
    'play.monthly':'Matches and play time by month', 'play.list':'Match list',
    'play.noneFiltered':'No matches match the filters. Change them or reset.', 'play.none':'No records for this type.',
    'play.listSummary':'Showing {start}\u2013{end} of {total}',
    'play.prev':'Previous page', 'play.next':'Next page',

    'reports.info':'This is the summary included in the ZIP; the match period filter does not apply.',
    'payment.info':'Amounts are shown per currency.',
    'store.info':'Transactions with unrecorded amounts are also listed.',

    'voice.title':'Voice Chat', 'voice.section':'Transcripts',
    'voice.ready':'No voice chat transcripts are recorded.',
    'voice.unsupported':'Transcript files exist, but their format is unconfirmed, so they can\u2019t be displayed.',
    'voice.invalid':'The voice chat data could not be read.',
    'voice.missing':'No voice chat data is included.',
    'voice.fineprint':'Audio is not played or shared with others.',

    'guide.info':'How to get your Riot data and view it on this device',
    'guide.step1.title':'Request your data from Riot Games', 'guide.step1.copy':'Open the official page, sign in with the Riot account you use for VALORANT, and follow the instructions.',
    'guide.step1.link':'Open Riot\u2019s official data request page',
    'guide.step2.title':'Save the report to your device', 'guide.step2.copy':'Download the ZIP you receive from Riot Games as-is. No extraction is needed.',
    'guide.step3.title':'Choose the file on this site', 'guide.step3.copy':'Select a ZIP or a target JSON via "Upload data". On a PC you can also drag and drop it.',
    'guide.step3.button':'Choose a file',
    'guide.section.title':'From request to display', 'guide.privacy.title':'How your personal data is handled',
    'guide.privacy.1':'The contents of the file you choose are read and aggregated only inside your smartphone or computer.',
    'guide.privacy.2':'The file and the resulting totals are never sent to this site or any external server, and are never shared with others.',
    'guide.privacy.3':'The display data is saved inside this browser, so it remains after closing or reloading the page. Anyone using the same device and browser can view it, so please clear it on shared devices. You can clear it from "More" > data management. The original file is neither saved nor deleted.',
    'guide.privacy.4':'* Internet access is required to open the site itself and to use Riot\u2019s official request page.',
    'guide.privacy.5':'Depending on the disclosure data, some sections may not be shown. The profile image is an illustration.',

    'more.info':'Category details and data management', 'more.categories':'Categories', 'more.manage':'Data management',
    'more.manageCopy':'Display data is saved inside this browser and remains after a reload. A different file replaces it only after loading succeeds. Please clear it after use on shared devices.',
    'more.upload':'Upload data', 'more.clear':'Clear data',

    'intro.title':'Your play history, on this device.',
    'intro.copy':'Choose the ZIP or a target JSON you received from Riot Games to view your VALORANT play and transaction history.',
    'intro.upload':'Upload data', 'intro.uploadOther':'Choose another file', 'intro.demo':'View demo', 'intro.guide':'How to use',
    'intro.privacy.title':'No extraction needed \u00b7 your file is never sent',
    'intro.privacy.save':'Display data is saved inside this browser so it survives a reload. Please clear it after use on shared devices.',
    'intro.privacy.how':'Choose a ZIP or JSON from your device\u2019s Files or Downloads.',
    'intro.privacy.drop':'On a PC you can also drag and drop a file onto this screen.',
    'footer.unofficial':'Not an official Riot Games service',

    'loading.title':'Loading', 'loading.new':'The file is processed on this device and is not sent anywhere.',
    'loading.keep':'The current view stays until loading finishes.',
    'loading.cancel':'Cancel loading', 'loading.other':'Choose another file',

    'error.keep':'Previous view kept.', 'error.dismiss':'Close',
    'notice.partial':'Some data couldn\u2019t be shown. Readable categories are displayed.',
    'storage.saving':'Saving data to this device…',
    'storage.saved':'Display data saved to this device.',
    'storage.fail.current':'Couldn\u2019t save to this device. The current data is visible, but it will disappear on reload.',
    'storage.fail.stale':'Couldn\u2019t save to this device. A previous dataset may reappear on reload. Check your browser\u2019s site data settings.',
    'storage.clear.fail':'Couldn\u2019t clear the data in this browser. Try again, or delete this site\u2019s data in your browser settings.',
    'storage.read.fail':'Couldn\u2019t check the saved data in this browser. Check your storage settings.',

    'announce.demo':'Sample data shown.', 'announce.loaded':'File loaded.', 'announce.cleared':'Data cleared.',
    'announce.cancel.keep':'Reading canceled; the previous view is kept.', 'announce.cancel':'Reading canceled.',
    'announce.reset':'Filters reset.', 'announce.noMatches':'No matches match the filters.',
    'announce.noPayment':'No monthly payment data to display.',

    'header.upload':'Upload data', 'header.menu':'Menu', 'header.home':'Back to home',
    'sidebar.manage':'Data management',
    'confirm.title':'Clear the displayed data?', 'confirm.copy':'Clears the on-screen data and the display data saved in this browser. The original ZIP or JSON is not deleted.',
    'confirm.back':'Back', 'confirm.clear':'Clear',

    'brand.title':'VALORANT Player Analysis',
    'unit.records':'', 'unit.times':'',
    'tooltip.matches':'Matches', 'tooltip.time':'Play time', 'tooltip.amount':'Amount paid',
    'aria.nav':'Screen navigation', 'aria.chartMonths':'Select chart month', 'aria.metrics':'Match stats (matchmaking)',
    'skip':'Skip to content',
    'chart.past':'Older months', 'chart.newer':'Newer months',
    'detail.view':'View details', 'detail.aria':'{label} for {title}',
    'home.modes':'Mode breakdown',
    'payment.summary':'Payment summary', 'payment.monthlyTitle':'Monthly spending', 'payment.monthlyShort':'monthly spending',
    'store.summary':'Store summary',
    'mini.monthly':'Monthly ',
  },
};

export const t = (key, vars = {}) => {
  const template = M[lang]?.[key] ?? M.ja[key] ?? key;
  return Object.keys(vars).reduce((out, name) => out.replaceAll(`{${name}}`, String(vars[name])), template);
};

// Locale-aware formatters.
const loc = () => (lang === 'en' ? 'en-US' : 'ja-JP');
export const fmtNumber = value => new Intl.NumberFormat(loc(), { maximumFractionDigits: 2 }).format(value);
export const fmtPercent = value => new Intl.NumberFormat(loc(), { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
const moneyCache = new Map();
export const fmtMoney = (amountX100, currency) => {
  if (!Number.isFinite(amountX100)) return t('unrecorded');
  if (!/^[A-Z]{3}$/.test(currency)) return `${fmtNumber(amountX100 / 100)} ${currency || t('currency.unrecorded')}`;
  const key = `${lang}:${currency}`;
  if (!moneyCache.has(key)) {
    moneyCache.set(key, new Intl.NumberFormat(loc(), {
      style: 'currency', currency,
      currencyDisplay: lang === 'en' || currency === 'JPY' ? 'symbol' : 'code',
      maximumFractionDigits: 2,
    }));
  }
  return moneyCache.get(key).format(amountX100 / 100);
};
export const fmtDuration = ms => {
  if (!Number.isFinite(ms)) return t('unrecorded');
  if (ms === 0) return `0${t('duration.minutes')}`;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}${t('duration.seconds')}`;
  const minutes = Math.floor(ms / 60_000);
  return minutes < 60 ? `${fmtNumber(minutes)}${t('duration.minutes')}` : `${fmtNumber(Math.floor(minutes / 60))}${t('duration.hours')}${minutes % 60}${t('duration.minutes')}`;
};

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthShort = month => (lang === 'en' ? EN_MONTHS[Number(month.slice(5)) - 1] : `${Number(month.slice(5))}月`);
export const monthFull = month => (lang === 'en' ? `${EN_MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}` : `${month.slice(0, 4)}年${Number(month.slice(5))}月`);
