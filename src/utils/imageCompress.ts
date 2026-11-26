function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл изображения'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Некорректный формат картинки'));
      img.onload = () => resolve(img);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function renderWebp(
  img: HTMLImageElement,
  maxDim: number,
  quality: number
): string {
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * maxDim) / width));
      width = maxDim;
    } else {
      width = Math.max(1, Math.round((width * maxDim) / height));
      height = maxDim;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas недоступен');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/webp', quality);
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  return Math.round(((dataUrl.length - commaIdx - 1) * 3) / 4);
}

export function formatDataUrlKb(dataUrl: string): string {
  const kb = Math.max(1, Math.round(estimateDataUrlBytes(dataUrl) / 1024));
  return `${kb} КБ`;
}

// Адаптивное сильное сжатие для обложек игр/тайтлов (~10-18 КБ на обложку)
export async function compressCoverToWebpDataUrl(
  file: File,
  targetMaxBytes = 18 * 1024
): Promise<string> {
  const img = await loadImageFromFile(file);
  const attempts: Array<[number, number]> = [
    [440, 0.74],
    [420, 0.64],
    [380, 0.56],
    [340, 0.5],
    [300, 0.45],
  ];

  let best = '';
  for (const [dim, q] of attempts) {
    best = renderWebp(img, dim, q);
    if (estimateDataUrlBytes(best) <= targetMaxBytes) {
      return best;
    }
  }
  return best;
}

// Адаптивное сжатие для мемов (~15-28 КБ, сохраняя читаемость текста на мемах)
export async function compressImageToWebpDataUrl(
  file: File,
  targetMaxBytes = 28 * 1024
): Promise<string> {
  const img = await loadImageFromFile(file);
  const attempts: Array<[number, number]> = [
    [720, 0.78],
    [660, 0.68],
    [600, 0.58],
    [520, 0.5],
  ];

  let best = '';
  for (const [dim, q] of attempts) {
    best = renderWebp(img, dim, q);
    if (estimateDataUrlBytes(best) <= targetMaxBytes) {
      return best;
    }
  }
  return best;
}

// Сжатие пользовательских обоев фона сайта (~1600px WebP, высокая четкость при малом весе)
export async function compressWallpaperToWebpDataUrl(
  file: File,
  targetMaxBytes = 320 * 1024
): Promise<string> {
  const img = await loadImageFromFile(file);
  const attempts: Array<[number, number]> = [
    [1920, 0.82],
    [1600, 0.76],
    [1440, 0.68],
    [1280, 0.6],
  ];

  let best = '';
  for (const [dim, q] of attempts) {
    best = renderWebp(img, dim, q);
    if (estimateDataUrlBytes(best) <= targetMaxBytes) {
      return best;
    }
  }
  return best;
}
