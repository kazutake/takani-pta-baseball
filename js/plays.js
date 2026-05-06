// 打席結果の定義と集計ヘルパー
// Phase 1: 我々の攻撃側のみ。守備（相手の攻撃）/ 投手 / 補正 は後続フェーズ。

export const RESULT_TYPES = [
  { key: 'single', label: 'ヒット', short: '安' },
  { key: 'double', label: '二塁打', short: '二' },
  { key: 'triple', label: '三塁打', short: '三' },
  { key: 'homeRun', label: '本塁打', short: '本' },
  { key: 'walk', label: '四球', short: '四' },
  { key: 'hbp', label: '死球', short: '死' },
  { key: 'strikeout', label: '三振', short: 'K' },
  { key: 'flyOut', label: 'フライ', short: '飛' },
  { key: 'groundOut', label: 'ゴロ', short: 'ゴ' },
  { key: 'reachedOnError', label: 'エラー', short: '失' },
];

export const OUT_RESULTS = ['strikeout', 'flyOut', 'groundOut'];
export const HIT_RESULTS = ['single', 'double', 'triple', 'homeRun'];
export const ON_BASE_NO_AB_RESULTS = ['walk', 'hbp']; // 打数に含めない

export function isOut(result) {
  return OUT_RESULTS.includes(result);
}

export function resultLabel(key) {
  return RESULT_TYPES.find((r) => r.key === key)?.label || key;
}

export function resultShort(key) {
  return RESULT_TYPES.find((r) => r.key === key)?.short || '?';
}

// 各プレイから次のイニングを計算
// 直近イニングが3アウト以上 → 次の回、未満 → 同じ回
export function computeNextInning(plays) {
  if (!plays || plays.length === 0) return 1;
  let maxInning = 1;
  for (const p of plays) maxInning = Math.max(maxInning, p.inning);
  const outsInLast = plays.filter((p) => p.inning === maxInning && isOut(p.result)).length;
  return outsInLast >= 3 ? maxInning + 1 : maxInning;
}

// あるイニングのアウト数
export function outsInInning(plays, inning) {
  return plays.filter((p) => p.inning === inning && isOut(p.result)).length;
}

// あるイニングの得点 (RBI合計)
export function runsInInning(plays, inning) {
  return plays.filter((p) => p.inning === inning).reduce((s, p) => s + (p.rbi || 0), 0);
}

// プレイから自動でイニングごとのスコア配列を生成
// Phase 1: 我々のみ。相手側は0で埋める（Phase 2で oppPlays を反映する）。
export function deriveInningsFromPlays(ourPlays, oppPlays, isHome, oursAdj = {}, oppsAdj = {}) {
  const hasOurs = ourPlays && ourPlays.length > 0;
  const hasOpps = oppPlays && oppPlays.length > 0;
  if (!hasOurs && !hasOpps) return null;

  let maxInning = 1;
  for (const p of ourPlays || []) maxInning = Math.max(maxInning, p.inning);
  for (const p of oppPlays || []) maxInning = Math.max(maxInning, p.inning);
  const adjKeys = [
    ...Object.keys(oursAdj || {}).map(Number),
    ...Object.keys(oppsAdj || {}).map(Number),
  ];
  for (const k of adjKeys) maxInning = Math.max(maxInning, k);

  const innings = [];
  for (let i = 1; i <= maxInning; i++) {
    const ourRuns = runsInInning(ourPlays || [], i) + (oursAdj?.[i] || 0);
    const oppRuns = runsInInning(oppPlays || [], i) + (oppsAdj?.[i] || 0);
    // top = 先攻 (相手の表 / 我々の裏 はisHomeで逆転)
    const top = !isHome ? ourRuns : oppRuns;
    const bottom = !isHome ? oppRuns : ourRuns;
    innings.push({ top, bottom });
  }
  return innings;
}

// 個人成績の集計（打撃）。プレイから集計する。
export function aggregateBattingFromPlays(memberId, plays) {
  const r = {
    singles: 0, doubles: 0, triples: 0, homeRuns: 0,
    walks: 0, hbp: 0,
    strikeouts: 0, flyOuts: 0, groundOuts: 0, reachedOnError: 0,
    rbis: 0,
    pa: 0,  // 打席数
    ab: 0,  // 打数 (PA - 四球 - 死球)
    hits: 0,
  };
  for (const p of plays || []) {
    if (p.batterId !== memberId) continue;
    r.pa++;
    if (p.result === 'walk') r.walks++;
    else if (p.result === 'hbp') r.hbp++;
    else if (p.result === 'single') r.singles++;
    else if (p.result === 'double') r.doubles++;
    else if (p.result === 'triple') r.triples++;
    else if (p.result === 'homeRun') r.homeRuns++;
    else if (p.result === 'strikeout') r.strikeouts++;
    else if (p.result === 'flyOut') r.flyOuts++;
    else if (p.result === 'groundOut') r.groundOuts++;
    else if (p.result === 'reachedOnError') r.reachedOnError++;
    r.rbis += p.rbi || 0;
  }
  r.hits = r.singles + r.doubles + r.triples + r.homeRuns;
  r.ab = r.pa - r.walks - r.hbp;
  return r;
}

// 投手の成績集計（Phase 2 で oppPlays を使って実装）
export function aggregatePitchingFromOppPlays(pitcherId, oppPlays) {
  const r = {
    games: 0,
    strikeouts: 0,
    walks: 0,
    hitBatters: 0,
    hitsAllowed: 0,
    runsAllowed: 0,
  };
  if (!oppPlays || oppPlays.length === 0) return r;
  const inningsWithThisPitcher = new Set();
  for (const p of oppPlays) {
    if (p.pitcherId !== pitcherId) continue;
    inningsWithThisPitcher.add(p.inning);
    if (p.result === 'strikeout') r.strikeouts++;
    else if (p.result === 'walk') r.walks++;
    else if (p.result === 'hbp') r.hitBatters++;
    else if (p.result === 'single' || p.result === 'double' || p.result === 'triple' || p.result === 'homeRun') r.hitsAllowed++;
    r.runsAllowed += p.rbi || 0;
  }
  r.games = inningsWithThisPitcher.size > 0 ? 1 : 0;
  return r;
}
