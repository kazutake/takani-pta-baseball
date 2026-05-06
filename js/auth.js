import { decryptPAT } from './crypto.js';
import { fetchEncryptedPAT } from './api.js';

const STORAGE_KEY = 'pat';

export function isAuthed() {
  return !!sessionStorage.getItem(STORAGE_KEY);
}

export function logout() {
  sessionStorage.removeItem(STORAGE_KEY);
  location.reload();
}

export async function login(password) {
  const enc = await fetchEncryptedPAT();
  const pat = await decryptPAT(enc, password);
  sessionStorage.setItem(STORAGE_KEY, pat);
  return pat;
}

export function ensureAuth({ onUnauth } = {}) {
  if (isAuthed()) return true;
  if (onUnauth) onUnauth();
  return false;
}

export function showLoginModal({ onSuccess } = {}) {
  const existing = document.getElementById('login-modal');
  if (existing) existing.remove();

  const html = `
    <div class="modal-backdrop open" id="login-modal" role="dialog" aria-modal="true">
      <div class="modal">
        <h3>メンバーログイン</h3>
        <p style="margin:0 0 12px;font-size:.85rem;color:var(--color-text-muted)">
          チーム共通パスワードを入力してください。
        </p>
        <form id="login-form">
          <div class="field">
            <label class="field-label" for="login-password">パスワード</label>
            <input id="login-password" class="field-input" type="password" autocomplete="current-password" required />
          </div>
          <div id="login-error" style="color:var(--color-danger);font-size:.85rem;display:none;margin-bottom:8px"></div>
          <div class="modal-actions">
            <button type="button" class="btn" id="login-cancel">キャンセル</button>
            <button type="submit" class="btn btn-primary" id="login-submit">ログイン</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('login-modal');
  const form = document.getElementById('login-form');
  const pwInput = document.getElementById('login-password');
  const errEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');
  const cancelBtn = document.getElementById('login-cancel');

  setTimeout(() => pwInput.focus(), 50);

  cancelBtn.addEventListener('click', () => {
    modal.remove();
    if (location.pathname.endsWith('index.html') || location.pathname.endsWith('/')) return;
    location.href = './';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = '確認中...';
    try {
      await login(pwInput.value);
      modal.remove();
      if (onSuccess) onSuccess();
      else location.reload();
    } catch (err) {
      errEl.textContent = err.message || 'ログインに失敗しました';
      errEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'ログイン';
      pwInput.select();
    }
  });
}
