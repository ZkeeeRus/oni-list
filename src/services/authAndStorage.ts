import { AuthStatsData, RuntimeConfig, SiteData, TwitchUser, UserRole } from '../types';
import { normalizeOrdererName } from '../utils/orderers';
import { resolveMemeImageUrl } from '../utils/builtinMemes';

const LOCAL_DATA_KEY = 'onized_hub_local_state_v1';
const LOCAL_USER_KEY = 'onized_hub_twitch_user_v1';
const LOCAL_CONFIG_KEY = 'onized_hub_runtime_cfg_v1';

export const PERMANENT_ADMINS = ['onized', 'zkeeerus'];
export const DEFAULT_API_BASE_URL = 'https://functions.yandexcloud.net/d4ehsd85qrdehg8058ue';
export const DEFAULT_TWITCH_CLIENT_ID = 'v78wuh35wmptpayuqj81a7y55y6l8s';

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  let fileCfg: Partial<RuntimeConfig> = {};
  try {
    const res = await fetch('./config.json', { cache: 'no-store' });
    if (res.ok) {
      fileCfg = await res.json();
    }
  } catch {
    // Ignore
  }

  try {
    localStorage.removeItem(LOCAL_CONFIG_KEY);
  } catch {
    // Ignore
  }

  const adminsSet = new Set([
    ...PERMANENT_ADMINS,
    ...(fileCfg.rootAdmins || []).map((a) => a.toLowerCase().trim()),
  ]);

  return {
    apiBaseUrl: (fileCfg.apiBaseUrl || DEFAULT_API_BASE_URL).trim(),
    twitchClientId: (fileCfg.twitchClientId || DEFAULT_TWITCH_CLIENT_ID).trim(),
    rootAdmins: Array.from(adminsSet),
  };
}

export function getRedirectUri(): string {
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  return url.toString();
}

export function startTwitchOAuth(clientId: string): void {
  const redirectUri = getRedirectUri();
  const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
  authUrl.searchParams.set('client_id', clientId.trim());
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', '');
  window.location.href = authUrl.toString();
}

export async function validateTwitchToken(
  token: string,
  clientId?: string
): Promise<TwitchUser | null> {
  try {
    const valRes = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
    });
    if (!valRes.ok) return null;
    const valData = await valRes.json();
    const login = String(valData.login || '').toLowerCase();
    const userId = String(valData.user_id || '');
    const effectiveClientId = clientId || String(valData.client_id || '');
    if (!login || !userId) return null;

    let displayName = valData.login || login;
    let avatarUrl = '';

    if (effectiveClientId) {
      try {
        const helixRes = await fetch('https://api.twitch.tv/helix/users', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Client-Id': effectiveClientId,
          },
        });
        if (helixRes.ok) {
          const helixJson = await helixRes.json();
          const u = helixJson?.data?.[0];
          if (u) {
            displayName = u.display_name || displayName;
            avatarUrl = u.profile_image_url || '';
          }
        }
      } catch {
        // Fallback to validate info
      }
    }

    const user: TwitchUser = {
      userId,
      login,
      displayName,
      avatarUrl,
      accessToken: token,
    };
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    return null;
  }
}

export async function initTwitchSession(clientId?: string): Promise<{
  user: TwitchUser | null;
  justLoggedIn: boolean;
}> {
  // 1. Check URL hash after redirect from id.twitch.tv
  if (window.location.hash && window.location.hash.includes('access_token=')) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('access_token');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (token) {
      const verified = await validateTwitchToken(token, clientId);
      if (verified) return { user: verified, justLoggedIn: true };
    }
  }

  // 2. Check stored session
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (!raw) return { user: null, justLoggedIn: false };
    const parsed = JSON.parse(raw) as TwitchUser;
    if (parsed.isPreview) {
      localStorage.removeItem(LOCAL_USER_KEY);
      return { user: null, justLoggedIn: false };
    }
    if (parsed.accessToken) {
      const verified = await validateTwitchToken(parsed.accessToken, clientId);
      if (verified) return { user: verified, justLoggedIn: false };
      localStorage.removeItem(LOCAL_USER_KEY);
    }
  } catch {
    localStorage.removeItem(LOCAL_USER_KEY);
  }
  return { user: null, justLoggedIn: false };
}

export function clearTwitchSession(): void {
  localStorage.removeItem(LOCAL_USER_KEY);
}

export function getUserRole(
  user: TwitchUser | null,
  data: SiteData | null,
  cfg: RuntimeConfig
): UserRole {
  if (!user) return 'viewer';
  const login = user.login.toLowerCase().trim();
  const admins = new Set([
    ...PERMANENT_ADMINS,
    ...(cfg.rootAdmins || []).map((x) => x.toLowerCase().trim()),
    ...(data?.admins || []).map((x) => x.toLowerCase().trim()),
  ]);
  if (admins.has(login)) return 'admin';
  const mods = new Set((data?.moderators || []).map((x) => x.toLowerCase().trim()));
  if (mods.has(login)) return 'moderator';
  return 'viewer';
}

export function buildStateEndpoint(apiBaseUrl: string): string {
  const cleanBase = apiBaseUrl.replace(/\/+$/, '');
  if (cleanBase.includes('functions.yandexcloud.net')) {
    return `${cleanBase}?action=state`;
  }
  return `${cleanBase}/api/state`;
}

function createEmptyFallbackData(): SiteData {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    admins: PERMANENT_ADMINS,
    moderators: [],
    hubConfig: {
      channelName: 'OniZeD',
      headline: 'OniZeD Hub',
      subheadline: 'База прохождений, заказов зрителей, просмотрового и тир-листов',
      isListFrozen: false,
      freezeBannerText: '',
      currentPlanNote: '',
      twitchUrl: 'https://www.twitch.tv/onized',
      vkVodUrl: 'https://vkvideo.ru/@onized',
    },
    games: [],
    watchlist: [],
    memes: [],
    backlog: [],
    ratingScale: [],
    rules: {
      intro: '',
      sections: [],
      footnotes: [],
    },
    customTierLists: [],
  };
}

export async function loadInitialSiteData(apiBaseUrl: string): Promise<{
  data: SiteData;
  source: 'remote' | 'local' | 'seed';
  needsMigration?: boolean;
}> {
  if (apiBaseUrl) {
    try {
      const res = await fetch(buildStateEndpoint(apiBaseUrl), { cache: 'no-store' });
      if (res.ok) {
        const remote = await res.json();
        if (
          remote &&
          Array.isArray(remote.games) &&
          (remote.games.length > 0 || (remote.watchlist && remote.watchlist.length > 0))
        ) {
          const hadLegacyMemes = (remote.memes || []).some(
            (m: any) => m?.imageUrl && !String(m.imageUrl).startsWith('data:') && String(m.imageUrl).includes('memes/')
          );
          const hadLegacyStreamer = [...(remote.games || []), ...(remote.watchlist || [])].some(
            (x: any) => {
              const low = String(x?.orderedBy || '').trim().toLowerCase();
              return low === 'я' || low === 'onized';
            }
          );
          const normalized = ensurePermanentAdmins(remote);
          lastKnownServerUpdatedAt = String(remote.updatedAt || '');
          try {
            localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(normalized));
          } catch {
            // Ignore quota
          }
          return {
            data: normalized,
            source: 'remote',
            needsMigration: hadLegacyMemes || hadLegacyStreamer,
          };
        }
      }
    } catch {
      // Fallback to local cache if remote temporarily unreachable
    }
  }

  try {
    const localRaw = localStorage.getItem(LOCAL_DATA_KEY);
    if (localRaw) {
      const localData = JSON.parse(localRaw) as SiteData;
      if (localData && Array.isArray(localData.games)) {
        return { data: ensurePermanentAdmins(localData), source: 'local' };
      }
    }
  } catch {
    // Ignore
  }

  return { data: createEmptyFallbackData(), source: 'seed' };
}

function ensurePermanentAdmins(d: SiteData): SiteData {
  const admins = Array.from(
    new Set([...PERMANENT_ADMINS, ...(d.admins || []).map((a) => a.toLowerCase().trim())])
  );
  return {
    ...d,
    admins,
    moderators: (d.moderators || []).map((m) => m.toLowerCase().trim()).filter(Boolean),
    games: (d.games || []).map((g) => ({
      ...g,
      orderedBy: normalizeOrdererName(g.orderedBy),
    })),
    watchlist: (d.watchlist || []).map((w) => ({
      ...w,
      orderedBy: normalizeOrdererName(w.orderedBy),
    })),
    customTierLists: d.customTierLists || [],
    memes: (d.memes || []).map((m) => ({
      ...m,
      imageUrl: resolveMemeImageUrl(m.imageUrl),
    })),
  };
}

let lastKnownServerUpdatedAt = '';

export interface PersistOptions {
  forceOverwrite?: boolean;
  allowMassDelete?: boolean;
}

export async function persistSiteData(
  next: SiteData,
  apiBaseUrl: string,
  user: TwitchUser | null,
  options?: PersistOptions
): Promise<{ savedRemote: boolean; conflict?: boolean; error?: string }> {
  const stamped: SiteData = ensurePermanentAdmins({
    ...next,
    updatedAt: new Date().toISOString(),
  });

  try {
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(stamped));
  } catch {
    // Ignore quota warnings
  }

  if (!apiBaseUrl) {
    return { savedRemote: false };
  }

  if (!user || !user.accessToken) {
    return {
      savedRemote: false,
      error: 'Для сохранения в общую БД войдите через настоящий аккаунт Twitch',
    };
  }

  try {
    const isYandexFn = apiBaseUrl.includes('functions.yandexcloud.net');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (!isYandexFn) {
      headers.Authorization = `Bearer ${user.accessToken}`;
    }
    const payloadObj = isYandexFn
      ? {
          ...stamped,
          _twitchToken: user.accessToken,
          _baseUpdatedAt: lastKnownServerUpdatedAt || undefined,
          _forceOverwrite: options?.forceOverwrite || undefined,
          _allowMassDelete: options?.allowMassDelete || undefined,
        }
      : stamped;

    const res = await fetch(buildStateEndpoint(apiBaseUrl), {
      method: 'PUT',
      headers,
      body: JSON.stringify(payloadObj),
    });
    const rawText = await res.text();
    let parsedRes: any = null;
    try {
      parsedRes = JSON.parse(rawText);
    } catch {
      // Ignore non-JSON error text
    }

    if (!res.ok) {
      const msg = parsedRes?.error || rawText || `Ошибка сервера (${res.status})`;
      return {
        savedRemote: false,
        conflict: res.status === 409 || Boolean(parsedRes?.conflict),
        error: msg,
      };
    }

    if (parsedRes?.updatedAt) {
      lastKnownServerUpdatedAt = String(parsedRes.updatedAt);
    }
    return { savedRemote: true };
  } catch (e: any) {
    return { savedRemote: false, error: e?.message || 'Не удалось связаться с сервером БД' };
  }
}

export function resetLocalDraft(): void {
  localStorage.removeItem(LOCAL_DATA_KEY);
}

const AUTH_PING_STORAGE_KEY = 'onized_hub_auth_ping_v1';
let cachedCapabilities: {
  authStatsSupported: boolean;
  telemetrySupported: boolean;
  backupsSupported: boolean;
} | null = null;

export async function checkBackendCapabilities(
  apiBaseUrl: string,
  forceRefresh = false
): Promise<{
  authStatsSupported: boolean;
  telemetrySupported: boolean;
  backupsSupported: boolean;
}> {
  const empty = {
    authStatsSupported: false,
    telemetrySupported: false,
    backupsSupported: false,
  };
  if (!apiBaseUrl) return empty;
  if (!forceRefresh && cachedCapabilities !== null) return cachedCapabilities;
  try {
    const cleanBase = apiBaseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}?action=diag`, { cache: 'no-store' });
    if (!res.ok) return empty;
    const json = await res.json();
    cachedCapabilities = {
      authStatsSupported: Boolean(json?.authStatsSupported),
      telemetrySupported: Boolean(json?.telemetrySupported),
      backupsSupported: Boolean(json?.backupsSupported),
    };
    return cachedCapabilities;
  } catch {
    return empty;
  }
}

export async function logTwitchAuthEvent(
  user: TwitchUser,
  apiBaseUrl: string,
  isFreshLogin: boolean
): Promise<void> {
  if (!apiBaseUrl || !user || !user.accessToken || user.isPreview) return;

  if (!isFreshLogin) {
    try {
      const raw = localStorage.getItem(AUTH_PING_STORAGE_KEY);
      if (raw) {
        const prev = JSON.parse(raw) as { login?: string; ts?: number };
        if (
          prev.login === user.login &&
          prev.ts &&
          Date.now() - prev.ts < 12 * 60 * 60 * 1000
        ) {
          return;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  const caps = await checkBackendCapabilities(apiBaseUrl);
  if (!caps.authStatsSupported) return;

  try {
    const cleanBase = apiBaseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}?action=auth-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _twitchToken: user.accessToken,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isLogin: isFreshLogin,
      }),
    });
    if (res.ok) {
      try {
        localStorage.setItem(
          AUTH_PING_STORAGE_KEY,
          JSON.stringify({ login: user.login, ts: Date.now() })
        );
      } catch {
        // Ignore
      }
    }
  } catch {
    // Ignore background telemetry errors
  }
}

export async function fetchTwitchAuthStats(
  user: TwitchUser,
  apiBaseUrl: string
): Promise<{ stats: AuthStatsData | null; notUpdatedYet?: boolean; error?: string }> {
  if (!apiBaseUrl || !user?.accessToken) {
    return { stats: null, error: 'Не выполнен вход через Twitch' };
  }

  const caps = await checkBackendCapabilities(apiBaseUrl, true);
  if (!caps.authStatsSupported) {
    return { stats: null, notUpdatedYet: true };
  }

  try {
    const cleanBase = apiBaseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}?action=admin-dashboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _twitchToken: user.accessToken }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { stats: null, error: json?.error || `Ошибка (${res.status})` };
    }
    if (json && Array.isArray(json.users)) {
      return { stats: json as AuthStatsData };
    }
    return { stats: null, notUpdatedYet: true };
  } catch (e: any) {
    return { stats: null, error: e?.message || 'Не удалось загрузить статистику' };
  }
}

export async function restoreCloudBackupSlot(
  slot: number,
  user: TwitchUser,
  apiBaseUrl: string
): Promise<{ restored?: SiteData; error?: string }> {
  if (!apiBaseUrl || !user?.accessToken) {
    return { error: 'Не выполнен вход через Twitch' };
  }
  try {
    const cleanBase = apiBaseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}?action=restore-backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _twitchToken: user.accessToken,
        slot,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { error: json?.error || `Ошибка восстановления (${res.status})` };
    }
    if (json?.state && Array.isArray(json.state.games)) {
      lastKnownServerUpdatedAt = String(json.state.updatedAt || '');
      const normalized = ensurePermanentAdmins(json.state);
      try {
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(normalized));
      } catch {
        // Ignore
      }
      return { restored: normalized };
    }
    return { error: 'Пустой ответ при восстановлении бэкапа' };
  } catch (e: any) {
    return { error: e?.message || 'Не удалось восстановить бэкап' };
  }
}
