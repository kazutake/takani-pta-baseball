/**
 * Google Form 送信時の自動処理
 * - LINE グループに通知メッセージを送信
 * - 入部希望者本人に確認メールを送信
 *
 * 使い方は同ディレクトリの README.md 参照
 */

// =============================================================
// 設定 (ここを書き換える)
// =============================================================

// LINE Messaging API
const LINE_CHANNEL_ACCESS_TOKEN = 'YOUR_CHANNEL_ACCESS_TOKEN_HERE'; // 長期トークン
const LINE_TARGET_ID = 'YOUR_GROUP_ID_OR_USER_ID_HERE'; // groupId (または userId)

// 確認メール
const TEAM_NAME = '高井戸第二小学校PTA野球部';
const REPLY_SUBJECT = '【受付完了】PTA野球部 入部問い合わせ';
const SITE_URL = 'https://takani-pta-baseball-team.github.io/ourpage/';

// フォームの「メールアドレス」項目のタイトル文言（フォームのメール質問の名前と一致させる）
// メール収集をフォーム設定でオンにしている場合は空文字でOK（自動取得される）
const EMAIL_FIELD_TITLE = 'メールアドレス';

// =============================================================
// メインハンドラ（フォーム送信時トリガで呼ばれる）
// =============================================================

function onFormSubmit(e) {
  if (!e || !e.response) {
    Logger.log('e.response がありません。トリガ設定を「フォーム送信時」にしてください。');
    return;
  }

  // 回答内容を取得
  const responses = e.response.getItemResponses();
  const data = responses.map((r) => ({
    title: r.getItem().getTitle(),
    answer: r.getResponse(),
  }));

  const submitTime = e.response.getTimestamp();

  // 回答者のメールアドレス（フォーム設定「メールアドレスを収集する」がオンなら取得可能）
  let respondentEmail = '';
  try {
    respondentEmail = e.response.getRespondentEmail() || '';
  } catch (err) {
    respondentEmail = '';
  }
  // フィールドからもメールを探す（明示的に質問項目で聞いている場合）
  const emailFromField = (data.find((d) => d.title === EMAIL_FIELD_TITLE) || {}).answer || '';
  const targetEmail = emailFromField || respondentEmail;

  // ----- 1. LINE 通知 -----
  try {
    const lineText = buildLineMessage(data, submitTime);
    sendLineMessage(lineText);
    Logger.log('LINE通知 送信成功');
  } catch (err) {
    Logger.log('LINE通知 送信失敗: ' + err);
  }

  // ----- 2. 確認メール送信 -----
  if (targetEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    try {
      sendConfirmationEmail(targetEmail, data);
      Logger.log('確認メール 送信成功 → ' + targetEmail);
    } catch (err) {
      Logger.log('確認メール 送信失敗: ' + err);
    }
  } else {
    Logger.log('メールアドレス未取得のため確認メールはスキップ');
  }
}

// =============================================================
// LINE 通知用メッセージ組み立て
// =============================================================

function buildLineMessage(data, time) {
  const lines = [];
  lines.push('⚾ 入部問い合わせがありました');
  lines.push('');
  lines.push('受付日時: ' + Utilities.formatDate(time, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'));
  lines.push('');
  data.forEach((d) => {
    lines.push('・' + d.title + ': ' + d.answer);
  });
  return lines.join('\n');
}

function sendLineMessage(text) {
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: LINE_TARGET_ID,
    messages: [{ type: 'text', text: text }],
  };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + LINE_CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200) {
    throw new Error('LINE API ' + code + ': ' + res.getContentText());
  }
}

// =============================================================
// 確認メール送信
// =============================================================

function sendConfirmationEmail(toEmail, data) {
  const lines = [];
  lines.push('この度は ' + TEAM_NAME + ' にお問い合わせいただきありがとうございます。');
  lines.push('');
  lines.push('以下の内容で受付いたしました。');
  lines.push('近日中に部の代表者よりご連絡いたします。');
  lines.push('');
  lines.push('---------- お問い合わせ内容 ----------');
  data.forEach((d) => lines.push(d.title + ': ' + d.answer));
  lines.push('--------------------------------------');
  lines.push('');
  lines.push('チームの活動はホームページからもご覧いただけます:');
  lines.push(SITE_URL);
  lines.push('');
  lines.push('-- ');
  lines.push(TEAM_NAME);

  GmailApp.sendEmail(toEmail, REPLY_SUBJECT, lines.join('\n'), {
    name: TEAM_NAME,
    noReply: false,
  });
}

// =============================================================
// 動作テスト用関数（手動で実行）
// =============================================================

// 「フォーム送信」を擬似的に発火させてLINE/メール両方をテスト
function testSubmit() {
  const fakeEvent = {
    response: {
      getItemResponses: () => [
        { getItem: () => ({ getTitle: () => 'お名前' }), getResponse: () => 'テスト 太郎' },
        { getItem: () => ({ getTitle: () => 'メールアドレス' }), getResponse: () => Session.getActiveUser().getEmail() },
        { getItem: () => ({ getTitle: () => '電話番号' }), getResponse: () => '090-0000-0000' },
        { getItem: () => ({ getTitle: () => 'ひとこと' }), getResponse: () => 'テスト送信です' },
      ],
      getTimestamp: () => new Date(),
      getRespondentEmail: () => Session.getActiveUser().getEmail(),
    },
  };
  onFormSubmit(fakeEvent);
}

// LINE通知だけテスト
function testLine() {
  sendLineMessage('テスト送信: ' + new Date().toLocaleString('ja-JP'));
}
