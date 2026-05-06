# Google Form 自動処理（GAS）

入部問い合わせフォーム送信時に以下を自動実行する Google Apps Script。

- LINE グループに通知メッセージを送信
- 入部希望者本人のメールアドレスに確認メールを送信

対象フォーム: <https://docs.google.com/forms/d/10nsGcLKFETRge9X02gkGSIP0dfQUofEds1FzKnksHaQ/edit>

---

## セットアップ手順

### 1. LINE Bot の準備

#### 1-1. LINE Developers でチャネル作成

1. <https://developers.line.biz/console/> を開く（LINEアカウントでログイン）
2. **「新規プロバイダー作成」** （任意の名前、例: `高井戸PTA野球部`）
3. プロバイダー内で **「Messaging API チャネルを作成」**
   - チャネル名: `PTA野球部 通知Bot`（任意、利用者に見える名前）
   - チャネル説明: 適当
   - 大業種・小業種: スポーツ・スポーツチームなど
   - 同意事項にチェック → 作成

#### 1-2. Channel Access Token を発行

1. 作成したチャネルを開く → 上部タブ **「Messaging API」**
2. 一番下の **「Channel access token」** 欄
3. **「Issue」** ボタンをクリック → 長期トークンが表示される
4. 表示されたトークン文字列をコピー（後で GAS に貼る）

#### 1-3. Bot をチームの LINE グループに招待

1. 同じ「Messaging API」タブの **「QR code」** をスマホで読み取る
2. Bot を「友だち追加」
3. チームの LINE グループを開く → メンバー追加 → 友達一覧から Bot を選択 → 招待
   - グループによっては Bot 招待が制限されている場合があります（グループ設定で許可してください）

#### 1-4. グループ ID を取得

これが少しトリッキーです。以下の方法のどれかで:

**方法A: webhook.site を使う（おすすめ・5分）**

1. <https://webhook.site/> を開く（登録不要）
2. ページ上部の URL（例: `https://webhook.site/abcd-1234-...`）をコピー
3. LINE Developers → 該当チャネル → 「Messaging API」タブ
4. **「Webhook URL」** 欄にコピーしたURLを貼り付け → **Update**
5. **「Use webhook」** を ON に
6. LINE グループで何かメッセージを送信（Bot が居れば誰の発言でもOK）
7. webhook.site のページに POST リクエストが届く
8. JSON Body の中の `source.groupId` の値をコピー（`Cxxxxxxxxxxxxxx...` の文字列）

**方法B: GAS の Web App を使う（中級者向け、後述）**

#### 1-5. 自動応答を OFF にする（任意・推奨）

LINE Developers → チャネルの「Messaging API」タブ → 「LINE Official Account features」内で:
- **応答メッセージ**: OFF（Botがオウム返しするのを防ぐ）
- **あいさつメッセージ**: お好みで

---

### 2. Google Form の設定

1. <https://docs.google.com/forms/d/10nsGcLKFETRge9X02gkGSIP0dfQUofEds1FzKnksHaQ/edit> を開く
2. 上部の **「設定」** タブ
3. **「回答」** セクション → **「メールアドレスを収集する」** を ON
   - 「確認済み」を選ぶ（送信者が必ず Google アカウントで送る形）
   - または「回答者からの入力」（任意で送信者が手入力）

これで Apps Script から `e.response.getRespondentEmail()` でメールアドレスが取得できます。

または、フォームに「メールアドレス」という質問項目を作って回答必須にしても OK（その場合は GAS 側の `EMAIL_FIELD_TITLE` 定数を質問のタイトルと一致させる）。

---

### 3. Google Apps Script の設置

#### 3-1. スクリプトを開く

1. Google Form の編集画面を開く
2. 右上の **「⋮」（縦三点）** → **「スクリプトエディタ」**
3. 自動的に新しい GAS プロジェクトが開く

#### 3-2. コードを貼り付け

1. デフォルトの `function myFunction() {}` を全選択して削除
2. 同ディレクトリの `form-submit.gs` の内容をコピーして貼り付け
3. ファイル上部の **設定（5行目あたり）** を書き換え:
   ```js
   const LINE_CHANNEL_ACCESS_TOKEN = '長期トークンをここに';
   const LINE_TARGET_ID = '取得したgroupIdをここに';  // 例: Cxxxxxxxxxxxx...
   ```
4. **保存**（`Ctrl + S` または ディスクアイコン）
5. プロジェクト名を聞かれたら適当に（例: `Form 自動通知`）

#### 3-3. トリガを設定

1. 左サイドバーの **時計アイコン（トリガ）** をクリック
2. 右下の **「トリガを追加」**
3. 以下のように設定:
   - 実行する関数: **`onFormSubmit`**
   - イベントのソース: **「フォームから」**
   - イベントの種類: **「フォーム送信時」**
4. **保存**
5. 初回は権限の認証が求められる:
   - 「詳細」→ 「（プロジェクト名）に移動（安全ではないページ）」
   - メールアドレス選択 → 許可
   - LINE への HTTP リクエストとメール送信権限を付与

---

### 4. 動作テスト

#### 4-1. LINE 単体テスト

スクリプトエディタ:
1. 関数選択ドロップダウン（コードエディタ上部）で **`testLine`** を選択
2. **「実行」** ボタン
3. LINE グループに「テスト送信: ...」が届けば OK

問題が出る場合:
- 「実行ログ」で `LINE API 401` 等のエラー → トークン不正
- `400` → groupId が間違っている
- 何も届かない → Bot がグループに居ない、または「応答メッセージ」設定の干渉

#### 4-2. フォーム送信全体のテスト

1. 関数選択 → **`testSubmit`** → 実行
2. LINE グループに「⚾ 入部問い合わせがありました」が届く
3. あなた自身（GAS実行者）のGmailに確認メールが届く

#### 4-3. 本番テスト

1. 公開フォーム <https://forms.gle/FPEGyrrjvwNx9zow6> から実際に送信
2. LINE グループに通知が届く
3. 送信者のメールアドレスに確認メールが届く

---

## 本番運用上の注意

### LINE Messaging API の制限

- **無料プラン**: 月 200 通までのプッシュメッセージ
- 入部問い合わせ用途なら十分（月数件想定）
- 超える場合は有料プラン（月 5000円〜）への切替が必要

### 確認メールの送信元

- 確認メールは **GASの実行者の Gmail から** 送信されます
- 件名: `【受付完了】PTA野球部 入部問い合わせ`
- 表示名: `高井戸第二小学校PTA野球部`
- 送信元アドレス: GAS実行者のメール（例: `kazutake.asahi@gmail.com`）

### Channel Access Token の管理

- トークンが漏洩した場合、第三者がBotとして任意のメッセージを送れる状態になります
- スクリプトは Form のオーナーしか見れないので通常は安全
- 漏洩疑いがあれば LINE Developers で **Reissue** して GAS の定数を更新

---

## トラブルシューティング

| 症状 | 確認ポイント |
|---|---|
| LINEに通知が来ない | `testLine` でエラーが出ないか確認。Channel Access Token / groupId を見直す |
| 確認メールが届かない | フォーム設定「メールアドレスを収集する」が ON か。スパム/迷惑メールフォルダ確認 |
| `Authorization required` | GAS のトリガ設定後、初回手動実行時の権限認証を済ませたか |
| `Service invoked too many times` | 1日のメール送信制限（個人 100通/日）に達した場合 → 翌日まで待つ |
| Bot がグループで動かない | 自動応答メッセージを OFF にしたか確認 |

---

## 補足: groupId 取得方法B（GAS Web App 版）

webhook.site が使えない場合の代替案。

1. GAS で新しいプロジェクト作成
2. 以下のコードを貼り付け:
   ```js
   function doPost(e) {
     const body = JSON.parse(e.postData.contents);
     PropertiesService.getScriptProperties().setProperty('lastEvent', JSON.stringify(body));
     return ContentService.createTextOutput('ok');
   }
   function showLast() {
     Logger.log(PropertiesService.getScriptProperties().getProperty('lastEvent'));
   }
   ```
3. **「デプロイ」** → 「ウェブアプリ」 → アクセス: 全員 → デプロイ
4. 表示された URL を LINE Webhook URL に設定
5. グループでメッセージ送信
6. GAS で `showLast` 関数を実行 → 実行ログに `groupId` が含まれる

---

質問やトラブルがあれば声かけてください。
