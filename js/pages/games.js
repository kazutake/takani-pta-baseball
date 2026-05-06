import { CONFIG } from '../config.js';
import { fetchJSON, writeJSON, ConflictError } from '../api.js';
import { renderHeader, renderNav, requireAuth, showToast, escapeHtml, formatDate, uid, todayISO } from '../app.js';

renderHeader();
renderNav('games');

let gamesState = { games: [] };
let gamesSha = null;
let membersState = { members: [] };

requireAuth(async () => {
  await Promise.all([loadGames(), loadMembers()]);
  render();
  document.getElementById('add-game-btn').addEventListener('click', openAddDialog);
});

async function loadGames() {
  const { data, sha } = await fetchJSON(CONFIG.DATA_PATHS.games);
  gamesState = data || { games: [] };
  gamesSha = sha;
}

async function loadMembers() {
  const { data } = await fetchJSON(CONFIG.DATA_PATHS.members);
  membersState = data || { members: [] };
}

function render() {
  const list = document.getElementById('games-list');
  const games = [...gamesState.games].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (games.length === 0) {
    list.innerHTML = '<div class="empty">まだ試合が登録されていません。<br>「＋ 新規登録」から登録してください。</div>';
    return;
  }
  list.innerHTML = games.map((g) => renderGameCard(g)).join('');
  list.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openEditDialog(btn.dataset.edit));
  });
  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteGame(btn.dataset.delete));
  });
}

function renderGameCard(g) {
  const result = g.result || (g.ourScore > g.theirScore ? 'win' : g.ourScore < g.theirScore ? 'lose' : 'draw');
  const badge =
    result === 'win'
      ? '<span class="badge badge-win">勝</span>'
      : result === 'lose'
      ? '<span class="badge badge-lose">負</span>'
      : '<span class="badge badge-draw">分</span>';
  const mvpName = g.mvpId
    ? membersState.members.find((m) => m.id === g.mvpId)?.name
    : null;
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div class="card-meta">${escapeHtml(formatDate(g.date))} ${badge}</div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm" data-edit="${g.id}">編集</button>
          <button class="btn btn-sm btn-danger" data-delete="${g.id}">削除</button>
        </div>
      </div>
      <div class="score-line">
        <span>当チーム</span>
        <span class="score-num">${g.ourScore ?? 0}</span>
        <span class="vs">-</span>
        <span class="score-num">${g.theirScore ?? 0}</span>
        <span>${escapeHtml(g.opponent || '相手')}</span>
      </div>
      ${g.location ? `<div class="card-meta">📍 ${escapeHtml(g.location)}</div>` : ''}
      ${mvpName ? `<div class="card-meta">🏆 MVP: ${escapeHtml(mvpName)}</div>` : ''}
      ${g.highlights ? `<p style="margin:8px 0 0;font-size:.9rem;white-space:pre-wrap">${escapeHtml(g.highlights)}</p>` : ''}
    </div>
  `;
}

function openAddDialog() {
  openDialog({
    id: '',
    date: todayISO(),
    opponent: '',
    ourScore: 0,
    theirScore: 0,
    location: '',
    mvpId: '',
    highlights: '',
  }, false);
}

function openEditDialog(id) {
  const g = gamesState.games.find((x) => x.id === id);
  if (!g) return;
  openDialog({ ...g }, true);
}

function openDialog(g, isEdit) {
  const memberOptions = membersState.members
    .map((m) => `<option value="${m.id}" ${m.id === g.mvpId ? 'selected' : ''}>${escapeHtml(m.name)}</option>`)
    .join('');
  const html = `
    <div class="modal-backdrop open" id="game-modal" role="dialog" aria-modal="true">
      <div class="modal">
        <h3>${isEdit ? '試合を編集' : '新しい試合を登録'}</h3>
        <form id="game-form">
          <div class="field">
            <label class="field-label">日付</label>
            <input class="field-input" type="date" name="date" value="${g.date}" required />
          </div>
          <div class="field">
            <label class="field-label">対戦相手</label>
            <input class="field-input" type="text" name="opponent" value="${escapeHtml(g.opponent)}" required />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">当チーム得点</label>
              <input class="field-input" type="number" name="ourScore" value="${g.ourScore ?? 0}" min="0" required />
            </div>
            <div class="field">
              <label class="field-label">相手得点</label>
              <input class="field-input" type="number" name="theirScore" value="${g.theirScore ?? 0}" min="0" required />
            </div>
          </div>
          <div class="field">
            <label class="field-label">場所</label>
            <input class="field-input" type="text" name="location" value="${escapeHtml(g.location)}" placeholder="例: 高井戸第二小学校 校庭" />
          </div>
          <div class="field">
            <label class="field-label">MVP</label>
            <select class="field-select" name="mvpId">
              <option value="">-- 選択しない --</option>
              ${memberOptions}
            </select>
          </div>
          <div class="field">
            <label class="field-label">ハイライト・コメント</label>
            <textarea class="field-textarea" name="highlights" placeholder="活躍した選手や試合のポイント">${escapeHtml(g.highlights)}</textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn" id="game-cancel">キャンセル</button>
            <button type="submit" class="btn btn-primary" id="game-submit">${isEdit ? '更新' : '登録'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('game-modal');
  const form = document.getElementById('game-form');
  const submitBtn = document.getElementById('game-submit');
  document.getElementById('game-cancel').addEventListener('click', () => modal.remove());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const ourScore = Number(fd.get('ourScore'));
    const theirScore = Number(fd.get('theirScore'));
    const newGame = {
      id: g.id || uid('g'),
      date: fd.get('date'),
      opponent: fd.get('opponent').toString().trim(),
      ourScore,
      theirScore,
      result: ourScore > theirScore ? 'win' : ourScore < theirScore ? 'lose' : 'draw',
      location: fd.get('location').toString().trim(),
      mvpId: fd.get('mvpId').toString() || null,
      highlights: fd.get('highlights').toString().trim(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = '保存中...';
    try {
      const next = { ...gamesState };
      if (isEdit) {
        next.games = next.games.map((x) => (x.id === newGame.id ? newGame : x));
      } else {
        next.games = [...next.games, newGame];
      }
      gamesSha = await writeJSON(
        CONFIG.DATA_PATHS.games,
        next,
        gamesSha,
        isEdit ? `update game ${newGame.date} vs ${newGame.opponent}` : `add game ${newGame.date} vs ${newGame.opponent}`
      );
      gamesState = next;
      modal.remove();
      render();
      showToast('保存しました', 'success');
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? '更新' : '登録';
      if (err instanceof ConflictError) {
        showToast(err.message, 'error');
      } else {
        showToast('保存に失敗しました: ' + err.message, 'error');
      }
    }
  });
}

async function deleteGame(id) {
  const g = gamesState.games.find((x) => x.id === id);
  if (!g) return;
  if (!confirm(`${formatDate(g.date)} ${g.opponent} 戦を削除しますか？`)) return;
  try {
    const next = { ...gamesState, games: gamesState.games.filter((x) => x.id !== id) };
    gamesSha = await writeJSON(
      CONFIG.DATA_PATHS.games,
      next,
      gamesSha,
      `delete game ${g.date} vs ${g.opponent}`
    );
    gamesState = next;
    render();
    showToast('削除しました', 'success');
  } catch (err) {
    if (err instanceof ConflictError) {
      showToast(err.message, 'error');
    } else {
      showToast('削除に失敗しました: ' + err.message, 'error');
    }
  }
}
