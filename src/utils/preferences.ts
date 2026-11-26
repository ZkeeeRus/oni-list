export const APP_VERSION = '2.6.0';

export type ThemeId = 'default' | 'winter' | 'ruby' | 'emerald';
export type ColorMode = 'dark' | 'light';
export type BgStyle = 'stars' | 'aurora' | 'nebula' | 'minimal' | 'custom';
export type FestiveShapesMode = 'winter' | 'abstract' | 'off';
export type SnowIntensity = 'off' | 'light' | 'rich';
export type PerformanceMode = 'high' | 'balanced' | 'eco';

export interface UserPreferences {
  theme: ThemeId;
  colorMode: ColorMode;
  bgStyle: BgStyle;
  customBgDimming: number;
  customBgBlur: number;
  festiveShapes: FestiveShapesMode;
  // Хранит год начала сезона (напр. "2026"), если пользователь отключил новогоднее оформление в этом сезоне.
  // На следующий Новый год ключ сезона станет "2027", и новогоднее оформление включится заново само!
  dismissedHolidaySeason: string | null;
  snowIntensity: SnowIntensity;
  garlandEnabled: boolean;
  garlandBroken: boolean;
  footerTreeEnabled: boolean;
  parallaxEnabled: boolean;
  performanceMode: PerformanceMode;
  soundEnabled: boolean;
  soundVolume: number;
  rouletteSound: boolean;
  uiSound: boolean;
}

const PREFS_STORAGE_KEY = 'onized_hub_user_prefs_v3';
const LEGACY_PREFS_KEY = 'onized_hub_user_prefs_v2';
const WALLPAPER_DB_NAME = 'onized_hub_assets_v1';
const WALLPAPER_STORE = 'kv';
const WALLPAPER_KEY = 'custom_wallpaper';
const WALLPAPER_FALLBACK_LS = 'onized_hub_custom_bg_v1';

// По умолчанию ВСЕГДА темная дефолтная Они-версия
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'default',
  colorMode: 'dark',
  bgStyle: 'stars',
  customBgDimming: 0.62,
  customBgBlur: 2,
  festiveShapes: 'winter',
  dismissedHolidaySeason: null,
  snowIntensity: 'light',
  garlandEnabled: true,
  garlandBroken: false,
  footerTreeEnabled: true,
  parallaxEnabled: true,
  performanceMode: 'high',
  soundEnabled: true,
  soundVolume: 0.45,
  rouletteSound: true,
  uiSound: true,
};

// Возвращает идентификатор новогоднего сезона (с 25 ноября Y по 25 января Y+1 -> "Y"), либо null вне сезона
export function getFestiveSeasonKey(now: Date = new Date()): string | null {
  const m = now.getMonth();
  const d = now.getDate();
  const y = now.getFullYear();
  if ((m === 10 && d >= 25) || m === 11) {
    return String(y);
  }
  if (m === 0 && d <= 25) {
    return String(y - 1);
  }
  return null;
}

export function isHolidayActive(prefs: UserPreferences, now?: Date): boolean {
  const seasonKey = getFestiveSeasonKey(now);
  if (!seasonKey) return false;
  return prefs.dismissedHolidaySeason !== seasonKey;
}

export function loadUserPreferences(): UserPreferences {
  try {
    const raw =
      localStorage.getItem(PREFS_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_PREFS_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);

    let theme: ThemeId = DEFAULT_PREFERENCES.theme;
    let colorMode: ColorMode =
      parsed.colorMode === 'light' ? 'light' : 'dark';

    if (parsed.theme === 'light') {
      theme = 'default';
      colorMode = 'light';
    } else if (
      parsed.theme === 'default' ||
      parsed.theme === 'winter' ||
      parsed.theme === 'ruby' ||
      parsed.theme === 'emerald'
    ) {
      theme = parsed.theme;
    }

    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      theme,
      colorMode,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

function openWallpaperDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(WALLPAPER_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(WALLPAPER_STORE)) {
        db.createObjectStore(WALLPAPER_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB error'));
  });
}

export async function loadCustomWallpaper(): Promise<string> {
  try {
    const db = await openWallpaperDb();
    const val = await new Promise<string>((resolve) => {
      const tx = db.transaction(WALLPAPER_STORE, 'readonly');
      const r = tx.objectStore(WALLPAPER_STORE).get(WALLPAPER_KEY);
      r.onsuccess = () => resolve(typeof r.result === 'string' ? r.result : '');
      r.onerror = () => resolve('');
    });
    db.close();
    if (val) return val;
  } catch {
    // Fallback to localStorage
  }
  try {
    return localStorage.getItem(WALLPAPER_FALLBACK_LS) || '';
  } catch {
    return '';
  }
}

export async function saveCustomWallpaper(urlOrData: string): Promise<void> {
  const clean = urlOrData.trim();
  try {
    const db = await openWallpaperDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WALLPAPER_STORE, 'readwrite');
      const store = tx.objectStore(WALLPAPER_STORE);
      if (clean) {
        store.put(clean, WALLPAPER_KEY);
      } else {
        store.delete(WALLPAPER_KEY);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    try {
      localStorage.removeItem(WALLPAPER_FALLBACK_LS);
    } catch {
      // Ignore
    }
    return;
  } catch {
    // Fallback to localStorage
  }
  try {
    if (clean) {
      localStorage.setItem(WALLPAPER_FALLBACK_LS, clean);
    } else {
      localStorage.removeItem(WALLPAPER_FALLBACK_LS);
    }
  } catch {
    // Ignore
  }
}
