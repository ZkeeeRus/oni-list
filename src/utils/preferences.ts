export type ThemeId = 'default' | 'winter' | 'ruby' | 'emerald' | 'light';
export type SnowIntensity = 'off' | 'light' | 'rich';
export type PerformanceMode = 'high' | 'balanced' | 'eco';

export interface UserPreferences {
  theme: ThemeId;
  // Хранит год начала сезона (напр. "2026"), если пользователь отключил новогоднее оформление в этом сезоне.
  // На следующий Новый год ключ сезона станет "2027", и новогоднее оформление включится заново само!
  dismissedHolidaySeason: string | null;
  snowIntensity: SnowIntensity;
  garlandEnabled: boolean;
  footerTreeEnabled: boolean;
  parallaxEnabled: boolean;
  performanceMode: PerformanceMode;
  soundEnabled: boolean;
  soundVolume: number;
  rouletteSound: boolean;
  uiSound: boolean;
}

const PREFS_STORAGE_KEY = 'onized_hub_user_prefs_v2';

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'default',
  dismissedHolidaySeason: null,
  snowIntensity: 'light',
  garlandEnabled: true,
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
  const m = now.getMonth(); // 0 = январь, 10 = ноябрь, 11 = декабрь
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

export function isFestiveSeasonDate(now: Date = new Date()): boolean {
  return getFestiveSeasonKey(now) !== null;
}

export function isHolidayActive(prefs: UserPreferences, now?: Date): boolean {
  const seasonKey = getFestiveSeasonKey(now);
  if (!seasonKey) return false;
  return prefs.dismissedHolidaySeason !== seasonKey;
}

export function loadUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
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
