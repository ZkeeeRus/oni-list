export type ThemeId = 'default' | 'winter' | 'ruby' | 'emerald' | 'light';
export type HolidayMode = 'auto' | 'on' | 'off';
export type SnowIntensity = 'off' | 'light' | 'rich';
export type PerformanceMode = 'high' | 'balanced' | 'eco';

export interface UserPreferences {
  theme: ThemeId;
  holidayMode: HolidayMode;
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

const PREFS_STORAGE_KEY = 'onized_hub_user_prefs_v1';

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'default',
  holidayMode: 'auto',
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

// Новогодний сезон с 25 ноября по 25 января включительно каждый год
export function isFestiveSeasonDate(now: Date = new Date()): boolean {
  const m = now.getMonth(); // 0 = январь, 10 = ноябрь, 11 = декабрь
  const d = now.getDate();
  if (m === 10 && d >= 25) return true;
  if (m === 11) return true;
  if (m === 0 && d <= 25) return true;
  return false;
}

export function isHolidayActive(prefs: UserPreferences, now?: Date): boolean {
  if (prefs.holidayMode === 'on') return true;
  if (prefs.holidayMode === 'off') return false;
  return isFestiveSeasonDate(now);
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
