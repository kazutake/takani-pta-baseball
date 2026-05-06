import { CONFIG } from '../config.js';
import { fetchJSON, writeJSON, ConflictError } from '../api.js';
import { renderHeader, renderNav, requireAuth, showToast, escapeHtml, formatDate, uid, todayISO } from '../app.js';

renderHeader();
renderNav('attendance');

let eventsState = { events: [] };
let eventsSha = null;
let attendanceState = { attendance: {} };
let attendanceSha = null;
let membersState = { members: [] };

requireAuth(async () => {
  await Promise.all([loadEvents(), loadAttendance(), loadMembers()]);
  render();
  document.getElementById('add-event-btn').addEventListener('click', openAddEventDialog);
});

async function loadEvents() {
  const { data, sha } = await fetchJSON(CONFIG.DATA_PATHS.events);
  eventsState = data || { events: [] };
  eventsSha = sha;
}

async function loadAttendance() {
  const { data, sha } = await fetchJSON(CONFIG.DATA_PATHS.attendance);
  attendanceState = data || { attendance: {} };
  attendanceSha = sha;
}

async function loadMembers() {
  const { data } = await fetchJSON(CONFIG.DATA_PATHS.members);
  membersState = data || { members: [] };
}

function render() {
  const list = document.getElementById('events-list');
  const today = todayISO();
  const upcoming = eventsState.events
    .filter((e) => (e.date || '') >= today)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const past = eventsState.events
    .filter((e) => (e.date || '') < today)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);

  if (upcoming.length === 0 && past.length === 0) {
    list.innerHTML = '<div class="empty">まだ予定が登録されていません。<br>「＋ 予定追加」から登録してください。</div>';
    return;
  }

  let html = '';
  if (upcoming.length > 0) {
    html += '<h3 style="font-size:.9rem;color:var(--color-text-muted);margin:0 0 8px">これからの予定</h3>';
    html += upcoming.map((e) => renderEventCard(e, false)).join('');
  }
  if (past.length > 0) {
    html += '<h3 style="font-size:.9rem;color:var(--color-text-muted);margin:16px 0 8px">過去の予定</h3>';
    html += past.map((e) => renderEventCard(e, true)).join('');
  }
  list.innerHTML = html;

  list.querySelectorAll('[data-att]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { eventId, memberId, status } = btn.dataset;
      setAttendance(eventId, memberId, status);
    });
  });
  list.querySelectorAll('[data-edit-event]').forEach((btn) => {
    btn.addEventListener('click', () => openEditEventDialog(btn.dataset.editEvent));
  });
  list.querySelectorAll('[data-delete-event]').forEach((btn) => {
    btn.addEventListener('click', () => deleteEvent(btn.dataset.deleteEvent));
  });
}

function renderEventCard(ev, isPast) {
  const att = attendanceState.attendance[ev.id] || {};
  const members = [...membersState.members].sort((a, b) => {
    const na = a.number ?? 999, nb = b.number ?? 999;
    if (na !== nb) return na - nb;
    return (a.name || '').localeCompare(b.name || '', 'ja');
  });

  const counts = { yes: 0, maybe: 0, no: 0 };
  for (const m of members) {
    const s = att[m.id];
    if (s && counts[s] != null) counts[s]++;
  }

  const memberRows = members.length === 0
    ? '<div class="card-meta">まだメンバーが登録されていません</div>'
    : members.map((m) => {
        const cur = att[m.id] || '';
        return `
          <div class="attendance-grid" style="padding:6px 0;border-bottom:1px solid var(--color-border)">
            <span class="name">${m.number != null ? `<span style="color:var(--color-text-muted);font-size:.8rem">#${m.number}</span> ` : ''}${escapeHtml(m.name)}</span>
            <div class="attendance-buttons">
              ${CONFIG.ATTENDANCE_STATUSES.map((s) => `
                <button class="att-btn ${cur === s.value ? 'active-' + s.value : ''}"
                  data-att data-event-id="${ev.id}" data-member-id="${m.id}" data-status="${s.value}"
                  title="${s.meaning}" ${isPast ? 'disabled' : ''}>${s.label}</button>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');

  return `
    <div class="card" ${isPast ? 'style="opacity:.7"' : ''}>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <div class="card-title">${escapeHtml(formatDate(ev.date))} ${ev.startTime ? `${escapeHtml(ev.startTime)}` : ''}${ev.endTime ? `〜${escapeHtml(ev.endTime)}` : ''}</div>
          <div class="card-meta">
            ${ev.type ? `<strong>${escapeHtml(ev.type)}</strong>` : ''}
            ${ev.location ? ` ・ 📍 ${escapeHtml(ev.location)}` : ''}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btn-sm" data-edit-event="${ev.id}">編集</button>
          <button class="btn btn-sm btn-danger" data-delete-event="${ev.id}">削除</button>
        </div>
      </div>
      ${ev.description ? `<p style="margin:8px 0;font-size:.9rem;white-space:pre-wrap">${escapeHtml(ev.description)}</p>` : ''}
      <div style="display:flex;gap:12px;margin:8px 0;font-size:.85rem">
        <span style="color:var(--color-success)">○ ${counts.yes}</span>
        <span style="color:var(--color-warning)">△ ${counts.maybe}</span>
        <span style="color:var(--color-danger)">× ${counts.no}</span>
      </div>
      <details ${isPast ? '' : 'open'}>
        <summary style="cursor:pointer;font-size:.85rem;color:var(--color-text-muted);margin-bottom:8px">出欠を見る・登録する</summary>
        ${memberRows}
      </details>
    </div>
  `;
}

async function setAttendance(eventId, memberId, status) {
  const cur = (attendanceState.attendance[eventId] || {})[memberId];
  const next = JSON.parse(JSON.stringify(attendanceState));
  if (!next.attendance[eventId]) next.attendance[eventId] = {};
  if (cur === status) {
    delete next.attendance[eventId][memberId];
  } else {
    next.attendance[eventId][memberId] = status;
  }
  try {
    attendanceSha = await writeJSON(
      CONFIG.DATA_PATHS.attendance,
      next,
      attendanceSha,
      `update attendance ${eventId}`
    );
    attendanceState = next;
    render();
  } catch (err) {
    if (err instanceof ConflictError) {
      showToast(err.message, 'error');
      await loadAttendance();
      render();
    } else {
      showToast('保存に失敗しました: ' + err.message, 'error');
    }
  }
}

function openAddEventDialog() {
  openEventDialog({
    id: '',
    date: todayISO(),
    startTime: '09:00',
    endTime: '12:00',
    type: '練習',
    location: '高井戸第二小学校 校庭',
    description: '',
  }, false);
}

function openEditEventDialog(id) {
  const ev = eventsState.events.find((x) => x.id === id);
  if (!ev) return;
  openEventDialog({ ...ev }, true);
}

function openEventDialog(ev, isEdit) {
  const html = `
    <div class="modal-backdrop open" id="event-modal" role="dialog" aria-modal="true">
      <div class="modal">
        <h3>${isEdit ? '予定を編集' : '新しい予定を追加'}</h3>
        <form id="event-form">
          <div class="field">
            <label class="field-label">日付</label>
            <input class="field-input" type="date" name="date" value="${ev.date}" required />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">開始時刻</label>
              <input class="field-input" type="time" name="startTime" value="${ev.startTime || ''}" />
            </div>
            <div class="field">
              <label class="field-label">終了時刻</label>
              <input class="field-input" type="time" name="endTime" value="${ev.endTime || ''}" />
            </div>
          </div>
          <div class="field">
            <label class="field-label">種別</label>
            <select class="field-select" name="type">
              <option value="練習" ${ev.type === '練習' ? 'selected' : ''}>練習</option>
              <option value="試合" ${ev.type === '試合' ? 'selected' : ''}>試合</option>
              <option value="懇親会" ${ev.type === '懇親会' ? 'selected' : ''}>懇親会</option>
              <option value="その他" ${ev.type === 'その他' ? 'selected' : ''}>その他</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">場所</label>
            <input class="field-input" type="text" name="location" value="${escapeHtml(ev.location)}" />
          </div>
          <div class="field">
            <label class="field-label">メモ</label>
            <textarea class="field-textarea" name="description">${escapeHtml(ev.description)}</textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn" id="event-cancel">キャンセル</button>
            <button type="submit" class="btn btn-primary" id="event-submit">${isEdit ? '更新' : '追加'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('event-modal');
  const form = document.getElementById('event-form');
  const submitBtn = document.getElementById('event-submit');
  document.getElementById('event-cancel').addEventListener('click', () => modal.remove());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const newEv = {
      id: ev.id || uid('e'),
      date: fd.get('date').toString(),
      startTime: fd.get('startTime').toString(),
      endTime: fd.get('endTime').toString(),
      type: fd.get('type').toString(),
      location: fd.get('location').toString().trim(),
      description: fd.get('description').toString().trim(),
    };
    submitBtn.disabled = true;
    submitBtn.textContent = '保存中...';
    try {
      const next = { ...eventsState };
      if (isEdit) {
        next.events = next.events.map((x) => (x.id === newEv.id ? newEv : x));
      } else {
        next.events = [...next.events, newEv];
      }
      eventsSha = await writeJSON(
        CONFIG.DATA_PATHS.events,
        next,
        eventsSha,
        isEdit ? `update event ${newEv.date}` : `add event ${newEv.date}`
      );
      eventsState = next;
      modal.remove();
      render();
      showToast('保存しました', 'success');
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? '更新' : '追加';
      if (err instanceof ConflictError) {
        showToast(err.message, 'error');
      } else {
        showToast('保存に失敗しました: ' + err.message, 'error');
      }
    }
  });
}

async function deleteEvent(id) {
  const ev = eventsState.events.find((x) => x.id === id);
  if (!ev) return;
  if (!confirm(`${formatDate(ev.date)} の予定を削除しますか？\n（出欠データも一緒に削除されます）`)) return;
  try {
    const nextEvents = { ...eventsState, events: eventsState.events.filter((x) => x.id !== id) };
    const nextAtt = JSON.parse(JSON.stringify(attendanceState));
    delete nextAtt.attendance[id];

    eventsSha = await writeJSON(CONFIG.DATA_PATHS.events, nextEvents, eventsSha, `delete event ${ev.date}`);
    eventsState = nextEvents;

    if (attendanceState.attendance[id]) {
      attendanceSha = await writeJSON(CONFIG.DATA_PATHS.attendance, nextAtt, attendanceSha, `delete attendance for ${ev.date}`);
      attendanceState = nextAtt;
    }
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
