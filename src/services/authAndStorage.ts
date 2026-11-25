import { RuntimeConfig, SiteData, TwitchUser, UserRole } from '../types';

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

export async function loadInitialSiteData(apiBaseUrl: string): Promise<{
  data: SiteData;
  source: 'remote' | 'local' | 'seed';
}> {
  const seedRes = await fetch('./seed-data.json');
  const seedData = (await seedRes.json()) as SiteData;

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
          return { data: ensurePermanentAdmins(remote), source: 'remote' };
        }
      }
    } catch {
      // Fallback to local / seed if remote temporarily unreachable
    }
  }

  try {
    const localRaw = localStorage.getItem(LOCAL_DATA_KEY);
    if (localRaw) {
      const localData = JSON.parse(localRaw) as SiteData;
      if (
        localData &&
        Array.isArray(localData.games) &&
        (localData.version || 1) >= (seedData.version || 1)
      ) {
        return { data: ensurePermanentAdmins(localData), source: 'local' };
      }
    }
  } catch {
    // Ignore
  }

  return { data: ensurePermanentAdmins(seedData), source: 'seed' };
}

function ensurePermanentAdmins(d: SiteData): SiteData {
  const admins = Array.from(
    new Set([...PERMANENT_ADMINS, ...(d.admins || []).map((a) => a.toLowerCase().trim())])
  );
  return {
    ...d,
    admins,
    moderators: (d.moderators || []).map((m) => m.toLowerCase().trim()).filter(Boolean),
    customTierLists: d.customTierLists || [],
    memes: d.memes || [],
  };
}

export async function persistSiteData(
  next: SiteData,
  apiBaseUrl: string,
  user: TwitchUser | null
): Promise<{ savedRemote: boolean; error?: string }> {
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
      ? { ...stamped, _twitchToken: user.accessToken }
      : stamped;

    const res = await fetch(buildStateEndpoint(apiBaseUrl), {
      method: 'PUT',
      headers,
      body: JSON.stringify(payloadObj),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return { savedRemote: false, error: errBody || `Ошибка сервера (${res.status})` };
    }
    return { savedRemote: true };
  } catch (e: any) {
    return { savedRemote: false, error: e?.message || 'Не удалось связаться с сервером БД' };
  }
}

export function resetLocalDraft(): void {
  localStorage.removeItem(LOCAL_DATA_KEY);
}
