export const CONFIG = {
  TEAM_NAME: '高井戸第二小学校PTA野球部',
  CONTACT_EMAIL: 'kazutake.asahi@gmail.com',

  GITHUB_OWNER: 'kazutake',
  GITHUB_REPO: 'takani-pta-baseball',
  BRANCH: 'main',

  ENCRYPTED_PAT_PATH: 'encrypted-pat.json',
  DATA_PATHS: {
    members: 'data/members.json',
    games: 'data/games.json',
    events: 'data/events.json',
    attendance: 'data/attendance.json',
  },

  POSITIONS: ['投手', '捕手', '一塁手', '二塁手', '三塁手', '遊撃手', '左翼手', '中堅手', '右翼手', '指名打者', '控え'],
  ATTENDANCE_STATUSES: [
    { value: 'yes', label: '○', meaning: '出席' },
    { value: 'maybe', label: '△', meaning: '未定' },
    { value: 'no', label: '×', meaning: '欠席' },
  ],
};
