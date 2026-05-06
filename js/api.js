import { CONFIG } from './config.js';

const API_BASE = 'https://api.github.com';

function getToken() {
  return sessionStorage.getItem('pat') || null;
}

function authHeaders(token) {
  const t = token || getToken();
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (t) headers['Authorization'] = `Bearer ${t}`;
  return headers;
}

export async function fetchJSON(path, { token } = {}) {
  const url = `${API_BASE}/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${path}?ref=${CONFIG.BRANCH}`;
  const res = await fetch(url, { headers: authHeaders(token), cache: 'no-store' });
  if (res.status === 404) {
    return { data: null, sha: null };
  }
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const decoded = decodeBase64Utf8(json.content.replace(/\s/g, ''));
  return { data: JSON.parse(decoded), sha: json.sha };
}

export async function writeJSON(path, data, sha, message) {
  const url = `${API_BASE}/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${path}`;
  const content = encodeBase64Utf8(JSON.stringify(data, null, 2) + '\n');
  const body = {
    message: message || `update ${path}`,
    content,
    branch: CONFIG.BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 409 || res.status === 422) {
    throw new ConflictError('他の人が先に更新しました。再読み込みしてやり直してください。');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${path} failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json.content.sha;
}

export async function writeBinary(path, base64Content, message) {
  const url = `${API_BASE}/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${path}`;
  const body = {
    message: message || `add ${path}`,
    content: base64Content,
    branch: CONFIG.BRANCH,
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${path} failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return { sha: json.content.sha, downloadUrl: json.content.download_url, path: json.content.path };
}

export async function fetchFileSha(path) {
  const url = `${API_BASE}/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${path}?ref=${CONFIG.BRANCH}`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HEAD ${path} failed: ${res.status}`);
  const json = await res.json();
  return json.sha;
}

export async function deleteFile(path, sha, message) {
  const fileSha = sha || (await fetchFileSha(path));
  if (!fileSha) return;
  const url = `${API_BASE}/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${path}`;
  const body = {
    message: message || `delete ${path}`,
    sha: fileSha,
    branch: CONFIG.BRANCH,
  };
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`DELETE ${path} failed: ${res.status} ${text}`);
  }
}

export async function fetchEncryptedPAT() {
  const url = `${API_BASE}/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.ENCRYPTED_PAT_PATH}?ref=${CONFIG.BRANCH}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('暗号化PATファイルが見つかりません。セットアップが完了していない可能性があります。');
  }
  const json = await res.json();
  const decoded = decodeBase64Utf8(json.content.replace(/\s/g, ''));
  return JSON.parse(decoded);
}

export class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
  }
}

function encodeBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decodeBase64Utf8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
