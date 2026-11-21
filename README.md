# VALORANT プレイヤー分析（非公式）

**日本語** · [English](README.en.md)

Riot Gamesから受け取ったVALORANTの開示ZIPを解凍せず、プレー記録・通報・課金・ストア取引を日本語で見る静的サイトです。データは端末内で処理し、外へ送信しません。再読み込みに備えて表示用データをブラウザ内に保存します。共有端末では利用後に消去してください。Riot Gamesの公式サービスではありません。

## ローカルで動かす

依存パッケージはありません。サイト本体をHTTPサーバーで配信して開きます（ZIPの展開・集計はブラウザ内で行われ、サーバーへ送信されません）。

```bash
npm run preview     # Python 3 の http.server で site/ を配信
```

ブラウザで <http://127.0.0.1:4173/> を開きます。終了は `Ctrl+C`。

1. **使い方**：[Riot公式のデータ申請](https://support.riotgames.com/ja-jp/riot/data-request)から取得・読み込みまでを案内します。
2. **データをアップロード**：[架空の正常ZIP](<samples/valorant-sample.zip>)、Riotから受け取ったZIP、または対象のJSONを選びます。ZIPの解凍は不要です。実データをこのリポジトリにコピーせず、元の場所から選んでください。
3. **デモを見る**：架空データでホームと詳細を確認できます。消すには **その他（PCはデータ管理） → 表示データを消去**。元のファイルは削除されません。

WindowsのWSL環境では `npm run preview:windows` でWindows側ブラウザから開けます。

[実機レビュー手順](<aidlc-docs/construction/review.md>) · [技術設計](<aidlc-docs/construction/technical-design.md>) · [画面設計](<aidlc-docs/inception/screen-design.md>)

## 開発と検証

Node.js 22以降。npmの依存パッケージ、外部CDN、環境変数やAPIキーは不要です。ローカルプレビューにはPython 3、ブラウザテストにはChromium系ブラウザが必要です。

```bash
npm run build      # Workerの変更を配信用にまとめる
npm run fixtures   # 架空ZIPを再生成する（実ZIPでは実行しない）
npm test           # 正規化・ZIP・Workerのテスト
npm run test:browser  # ブラウザテスト（必要に応じて VALORANT_CHROME で実行ファイルを指定）
```

## ゲーム内名称の辞書

スキン・レベル・ヴァリアント、カード、バディー、スプレー等の日英名称は [Valorant-API](https://valorant-api.com/)（非公式）の公開メタデータを利用します。ゲーム内名称はRiot Gamesに帰属します。辞書はサイトに同梱し、閲覧中に外部APIへ接続しません。名称が未登録の場合は原文付きで表示します。公開データの辞書を更新する場合だけ `node scripts/update-item-catalog.mjs` を実行します。このコマンドは個人のZIPを読みません。

フォント（Noto Sans JP）はサイト内で使う文字だけを抽出して同梱しています。文言を追加・変更した場合は `node scripts/update-fonts.mjs` で再生成してください。

GitHub Pagesの配信物は [`site/`](<site/>) のみ。公開前に実機と実ZIPを確認し、公開先・表示名・Riot Developer Portalへの製品登録を決めます。実データをコミット、配信、共有しないでください。
