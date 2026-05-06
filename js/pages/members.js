import { CONFIG } from '../config.js';
import { fetchJSON, writeJSON, ConflictError } from '../api.js';
import { renderHeader, renderNav, requireAuth, showToast, escapeHtml, uid } from '../app.js';

renderHeader();
renderNav('members');

let membersState = { members: [] };
let membersSha = null;
let gamesState = { games: [] };

requireAuth(async () => {
  await Promise.all([loadMembers(), loadGames()]);
  render();
  document.getElementById('add-member-btn').addEventListener('click', openAddDialog);
});

async function loadMembers() {
  const { data, sha } = await fetchJSON(CONFIG.DATA_PATHS.members);
  membersState = data || { members: [] };
  membersSha = sha;
}

async function loadGames() {
  const { data } = await fetchJSON(CONFIG.DATA_PATHS.games);
  gamesState = data || { games: [] };
}

function render() {
  const list = document.getElementById('members-list');
  const members = [...membersState.members].sort((a, b) => {
    const na = a.number ?? 999, nb = b.number ?? 999;
    if (na !== nb) return na - nb;
    return (a.name || '').localeCompare(b.name || '', 'ja');
  });
  if (members.length === 0) {
    list.innerHTML = '<div class="empty">まだメンバーが登録されていません。<br>「＋ 新規登録」から登録してください。</div>';
    return;
  }
  list.innerHTML = members.map((m) => renderMemberCard(m)).join('');
  list.querySelectorAll('[data-detail]').forEach((btn) => {
    btn.addEventListener('click', () => openDetailDialog(btn.dataset.detail));
  });
  list.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditDialog(btn.dataset.edit);
    });
  });
  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteMember(btn.dataset.delete);
    });
  });
}

function renderMemberCard(m) {
  const mvpCount = gamesState.games.filter((g) => g.mvpId === m.id).length;
  return `
    <div class="card" style="cursor:pointer" data-detail="${m.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            ${m.number != null ? `<span style="background:var(--color-primary);color:#fff;padding:2px 8px;border-radius:12px;font-size:.8rem;font-weight:600">#${m.number}</span>` : ''}
            <span class="card-title" style="margin:0">${escapeHtml(m.name)}</span>
          </div>
          <div class="card-meta">
            ${m.position ? escapeHtml(m.position) : '—'}
            ${mvpCount > 0 ? ` ・ 🏆 MVP ${mvpCount}回` : ''}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btn-sm" data-edit="${m.id}">編集</button>
          <button class="btn btn-sm btn-danger" data-delete="${m.id}">削除</button>
        </div>
      </div>
    </div>
  `;
}

function openDetailDialog(id) {
  const m = membersState.members.find((x) => x.id === id);
  if (!m) return;
  const myGames = gamesState.games
    .filter((g) => g.mvpId === id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const stats = m.stats || {};
  const html = `
    <div class="modal-backdrop open" id="detail-modal" role="dialog" aria-modal="true">
      <div class="modal">
        <h3>${m.number != null ? `#${m.number} ` : ''}${escapeHtml(m.name)}</h3>
        <div class="card-meta" style="margin-bottom:12px">
          ${m.position ? `ポジション: ${escapeHtml(m.position)}` : ''}
          ${m.joinedDate ? ` ・ 入部: ${escapeHtml(m.joinedDate)}` : ''}
        </div>

        <h4 style="margin:16px 0 8px;font-size:.95rem">通算成績</h4>
        <table class="stats-table">
          <tr><td>打席</td><td>${stats.atBats ?? 0}</td><td>安打</td><td>${stats.hits ?? 0}</td></tr>
          <tr><td>本塁打</td><td>${stats.homeRuns ?? 0}</td><td>打点</td><td>${stats.rbis ?? 0}</td></tr>
          <tr><td>勝</td><td>${stats.wins ?? 0}</td><td>敗</td><td>${stats.losses ?? 0}</td></tr>
        </table>

        <h4 style="margin:16px 0 8px;font-size:.95rem">MVP獲得試合 (${myGames.length}試合)</h4>
        ${myGames.length === 0
          ? '<div class="card-meta">まだありません</div>'
          : myGames.map(g => `<div class="card-meta">・ ${escapeHtml(g.date)} vs ${escapeHtml(g.opponent)}</div>`).join('')}

        ${m.notes ? `<h4 style="margin:16px 0 8px;font-size:.95rem">メモ</h4><p style="margin:0;white-space:pre-wrap;font-size:.9rem">${escapeHtml(m.notes)}</p>` : ''}

        <div class="modal-actions">
          <button type="button" class="btn btn-block" id="detail-close">閉じる</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('detail-close').addEventListener('click', () => {
    document.getElementById('detail-modal').remove();
  });
}

function openAddDialog() {
  openDialog({
    id: '',
    name: '',
    number: '',
    position: '',
    joinedDate: '',
    stats: { atBats: 0, hits: 0, homeRuns: 0, rbis: 0, wins: 0, losses: 0 },
    notes: '',
  }, false);
}

function openEditDialog(id) {
  const m = membersState.members.find((x) => x.id === id);
  if (!m) return;
  openDialog({ ...m, stats: { ...(m.stats || {}) } }, true);
}

function openDialog(m, isEdit) {
  const positionOptions = ['', ...CONFIG.POSITIONS]
    .map((p) => `<option value="${escapeHtml(p)}" ${p === m.position ? 'selected' : ''}>${p || '-- 未設定 --'}</option>`)
    .join('');
  const html = `
    <div class="modal-backdrop open" id="member-modal" role="dialog" aria-modal="true">
      <div class="modal">
        <h3>${isEdit ? 'メンバーを編集' : '新しいメンバーを登録'}</h3>
        <form id="member-form">
          <div class="field-row">
            <div class="field" style="max-width:90px">
              <label class="field-label">背番号</label>
              <input class="field-input" type="number" name="number" value="${m.number ?? ''}" min="0" />
            </div>
            <div class="field">
              <label class="field-label">名前</label>
              <input class="field-input" type="text" name="name" value="${escapeHtml(m.name)}" required />
            </div>
          </div>
          <div class="field">
            <label class="field-label">ポジション</label>
            <select class="field-select" name="position">${positionOptions}</select>
          </div>
          <div class="field">
            <label class="field-label">入部日</label>
            <input class="field-input" type="date" name="joinedDate" value="${m.joinedDate || ''}" />
          </div>

          <h4 style="margin:16px 0 8px;font-size:.9rem">通算成績</h4>
          <div class="field-row">
            <div class="field">
              <label class="field-label">打席</label>
              <input class="field-input" type="number" name="atBats" value="${m.stats.atBats ?? 0}" min="0" />
            </div>
            <div class="field">
              <label class="field-label">安打</label>
              <input class="field-input" type="number" name="hits" value="${m.stats.hits ?? 0}" min="0" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">本塁打</label>
              <input class="field-input" type="number" name="homeRuns" value="${m.stats.homeRuns ?? 0}" min="0" />
            </div>
            <div class="field">
              <label class="field-label">打点</label>
              <input class="field-input" type="number" name="rbis" value="${m.stats.rbis ?? 0}" min="0" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">勝</label>
              <input class="field-input" type="number" name="wins" value="${m.stats.wins ?? 0}" min="0" />
            </div>
            <div class="field">
              <label class="field-label">敗</label>
              <input class="field-input" type="number" name="losses" value="${m.stats.losses ?? 0}" min="0" />
            </div>
          </div>

          <div class="field">
            <label class="field-label">メモ</label>
            <textarea class="field-textarea" name="notes">${escapeHtml(m.notes || '')}</textarea>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn" id="member-cancel">キャンセル</button>
            <button type="submit" class="btn btn-primary" id="member-submit">${isEdit ? '更新' : '登録'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('member-modal');
  const form = document.getElementById('member-form');
  const submitBtn = document.getElementById('member-submit');
  document.getElementById('member-cancel').addEventListener('click', () => modal.remove());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const numberRaw = fd.get('number').toString();
    const newMember = {
      id: m.id || uid('m'),
      name: fd.get('name').toString().trim(),
      number: numberRaw === '' ? null : Number(numberRaw),
      position: fd.get('position').toString(),
      joinedDate: fd.get('joinedDate').toString(),
      stats: {
        atBats: Number(fd.get('atBats') || 0),
        hits: Number(fd.get('hits') || 0),
        homeRuns: Number(fd.get('homeRuns') || 0),
        rbis: Number(fd.get('rbis') || 0),
        wins: Number(fd.get('wins') || 0),
        losses: Number(fd.get('losses') || 0),
      },
      notes: fd.get('notes').toString().trim(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = '保存中...';
    try {
      const next = { ...membersState };
      if (isEdit) {
        next.members = next.members.map((x) => (x.id === newMember.id ? newMember : x));
      } else {
        next.members = [...next.members, newMember];
      }
      membersSha = await writeJSON(
        CONFIG.DATA_PATHS.members,
        next,
        membersSha,
        isEdit ? `update member ${newMember.name}` : `add member ${newMember.name}`
      );
      membersState = next;
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

async function deleteMember(id) {
  const m = membersState.members.find((x) => x.id === id);
  if (!m) return;
  if (!confirm(`${m.name} さんを削除しますか？`)) return;
  try {
    const next = { ...membersState, members: membersState.members.filter((x) => x.id !== id) };
    membersSha = await writeJSON(
      CONFIG.DATA_PATHS.members,
      next,
      membersSha,
      `delete member ${m.name}`
    );
    membersState = next;
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
