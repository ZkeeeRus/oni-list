import { checkBackendCapabilities } from '../services/authAndStorage';

export type CookieConsentState = 'accepted' | 'essential' | null;
export type TrackableTab =
  | 'hub'
  | 'games'
  | 'watchlist'
  | 'tierlist'
  | 'backlog'
  | 'stats'
  | 'rules';
export type TrackableAction = 'roulette_spin' | 'card_open' | 'tree_click';

const CONSENT_STORAGE_KEY = 'onized_hub_cookie_consent_v1';
const SESSION_FLAG_KEY = 'onized_hub_telemetry_session_v1';
const VISITOR_COOKIE_NAME = 'oni_vid';

function readCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const prefix = `${name}=`;
  const parts = document.cookie.split(';');
  for (const raw of parts) {
    const c = raw.trim();
    if (c.startsWith(prefix)) {
      return decodeURIComponent(c.slice(prefix.length));
    }
  }
  return '';
}

function writeVisitorCookie(val: string): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${VISITOR_COOKIE_NAME}=${encodeURIComponent(
    val
  )}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function deleteVisitorCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${VISITOR_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getCookieConsent(): CookieConsentState {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (raw === 'accepted' || raw === 'essential') return raw;
  } catch {
    // Ignore
  }
  return null;
}

export function setCookieConsent(choice: 'accepted' | 'essential'): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Ignore
  }
  if (choice === 'accepted') {
    ensureVisitorId();
  } else {
    deleteVisitorCookie();
  }
}

function ensureVisitorId(): string {
  if (getCookieConsent() !== 'accepted') return '';
  let existing = readCookie(VISITOR_COOKIE_NAME);
  if (existing && existing.length >= 12) return existing;

  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  existing =
    'v_' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  writeVisitorCookie(existing);
  return existing;
}

function detectDeviceCategory(): 'desktop' | 'mobile' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth || 1280;
  if (w <= 640) return 'mobile';
  if (w <= 1024 && navigator.maxTouchPoints > 0) return 'tablet';
  return 'desktop';
}

function detectReferrerCategory(): 'direct' | 'twitch' | 'social' | 'search' | 'other' {
  if (typeof document === 'undefined' || !document.referrer) return 'direct';
  try {
    const host = new URL(document.referrer).hostname.toLowerCase();
    if (host.includes('onihub.ru') || host.includes('github.io')) return 'direct';
    if (host.includes('twitch.tv')) return 'twitch';
    if (
      host.includes('t.me') ||
      host.includes('telegram') ||
      host.includes('discord') ||
      host.includes('vk.com') ||
      host.includes('vkvideo.ru') ||
      host.includes('youtube.com')
    ) {
      return 'social';
    }
    if (
      host.includes('yandex.') ||
      host.includes('ya.ru') ||
      host.includes('google.') ||
      host.includes('bing.com') ||
      host.includes('duckduckgo.com')
    ) {
      return 'search';
    }
    return 'other';
  } catch {
    return 'other';
  }
}

// Очередь обезличенной аналитики (отправляется пачкой раз в 25 сек или при сворачивании вкладки)
let configuredApiUrl = '';
let configuredIsAuthed = false;
let pendingNewSession = false;
const pendingTabs: Partial<Record<TrackableTab, number>> = {};
const pendingActions: Partial<Record<TrackableAction, number>> = {};
let flushTimer: number | null = null;
let listenersBound = false;

function hasPendingData(): boolean {
  return (
    pendingNewSession ||
    Object.keys(pendingTabs).length > 0 ||
    Object.keys(pendingActions).length > 0
  );
}

export async function flushTelemetry(keepalive = false): Promise<void> {
  if (flushTimer) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!configuredApiUrl || !hasPendingData()) return;

  const caps = await checkBackendCapabilities(configuredApiUrl);
  if (!caps.telemetrySupported) return;

  const consent = getCookieConsent();
  // Пока пользователь не выбрал режим в баннере (consent === null), куки не ставим, но если уже выбрал 'accepted' - передаем анонимный ID
  const vid = consent === 'accepted' ? ensureVisitorId() : '';

  const payload = {
    consent: consent === 'accepted',
    vid,
    newSession: pendingNewSession,
    authed: configuredIsAuthed,
    device: pendingNewSession ? detectDeviceCategory() : undefined,
    ref: pendingNewSession ? detectReferrerCategory() : undefined,
    tabs: { ...pendingTabs },
    actions: { ...pendingActions },
  };

  pendingNewSession = false;
  for (const k of Object.keys(pendingTabs) as TrackableTab[]) delete pendingTabs[k];
  for (const k of Object.keys(pendingActions) as TrackableAction[]) {
    delete pendingActions[k];
  }

  try {
    const cleanBase = configuredApiUrl.replace(/\/+$/, '');
    await fetch(`${cleanBase}?action=telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive,
    });
  } catch {
    // Ошибки аналитики никогда не мешают работе сайта
  }
}

function scheduleFlush(delayMs = 22000): void {
  if (typeof window === 'undefined') return;
  if (flushTimer) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushTelemetry(false);
  }, delayMs);
}

export function initTelemetrySession(apiBaseUrl: string, isAuthed: boolean): void {
  configuredApiUrl = apiBaseUrl;
  configuredIsAuthed = isAuthed;

  if (typeof window === 'undefined') return;

  try {
    const alreadyStarted = sessionStorage.getItem(SESSION_FLAG_KEY);
    if (!alreadyStarted) {
      sessionStorage.setItem(SESSION_FLAG_KEY, '1');
      pendingNewSession = true;
      pendingTabs.hub = (pendingTabs.hub || 0) + 1;
      scheduleFlush(6000);
    }
  } catch {
    // Ignore sessionStorage restrictions
  }

  if (!listenersBound) {
    listenersBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushTelemetry(true);
      }
    });
    window.addEventListener('pagehide', () => {
      flushTelemetry(true);
    });
  }
}

export function updateTelemetryAuthState(isAuthed: boolean): void {
  configuredIsAuthed = isAuthed;
}

export function trackTabView(tab: TrackableTab): void {
  pendingTabs[tab] = (pendingTabs[tab] || 0) + 1;
  scheduleFlush();
}

export function trackSiteAction(action: TrackableAction): void {
  pendingActions[action] = (pendingActions[action] || 0) + 1;
  scheduleFlush();
}
