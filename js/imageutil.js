const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.85;

export async function processImage(file, { maxWidth = MAX_WIDTH, quality = JPEG_QUALITY } = {}) {
  if (!file.type.startsWith('image/')) {
    throw new Error('画像ファイルを選択してください');
  }
  const img = await loadImage(file);
  const ratio = Math.min(1, maxWidth / img.naturalWidth);
  const w = Math.round(img.naturalWidth * ratio);
  const h = Math.round(img.naturalHeight * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像変換に失敗しました'))), 'image/jpeg', quality);
  });
  return blob;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像を読み込めませんでした'));
    };
    img.src = url;
  });
}

export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('画像エンコードに失敗しました'));
    reader.readAsDataURL(blob);
  });
}

export function rawUrlFor(path) {
  // raw.githubusercontent.com の方が GitHub Pages よりキャッシュが短く、新しい写真がすぐ見える
  return path;
}
