import { CONFIG } from './config.js';
import { isAuthed, logout, showLoginModal } from './auth.js';

export function renderHeader({ showLogout = true } = {}) {
  const header = document.getElementById('app-header');
  if (!header) return;
  const authed = isAuthed();
  header.innerHTML = `
    <h1>${escapeHtml(CONFIG.TEAM_NAME)}</h1>
    <div class="header-status">
      ${authed && showLogout
        ? '<button class="btn btn-sm" id="logout-btn" style="background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.3)">ログアウト</button>'
        : ''}
    </div>
  `;
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    if (confirm('ログアウトしますか？')) logout();
  });
}

export function renderNav(activeKey) {
  const nav = document.getElementById('app-nav');
  if (!nav) return;
  const items = [
    { key: 'home', label: 'ホーム', icon: '🏠', href: './' },
    { key: 'games', label: '試合', icon: '⚾', href: 'games.html' },
    { key: 'members', label: 'メンバー', icon: '👥', href: 'members.html' },
    { key: 'attendance', label: '出欠', icon: '📅', href: 'attendance.html' },
  ];
  nav.innerHTML = items
    .map(
      (it) => `
    <a href="${it.href}" class="${it.key === activeKey ? 'active' : ''}">
      <span class="nav-icon">${it.icon}</span>
      <span>${it.label}</span>
    </a>
  `
    )
    .join('');
}

export function requireAuth(callback) {
  if (isAuthed()) {
    callback();
    return;
  }
  showLoginModal({
    onSuccess: () => {
      renderHeader();
      callback();
    },
  });
}

export function showToast(message, type = 'info') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast ${type}`;
  toast.textContent = message;
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2500);
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${yyyy}/${mm}/${dd}(${wd})`;
}

export function uid(prefix) {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${t}${r}`;
}

export function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
