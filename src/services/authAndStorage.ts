import { RuntimeConfig, SiteData, TwitchUser, UserRole } from '../types';

const LOCAL_DATA_KEY = 'onized_hub_local_state_v1';
const LOCAL_USER_KEY = 'onized_hub_twitch_user_v1';
const LOCAL_CONFIG_KEY = 'onized_hub_runtime_cfg_v1';

export const PERMANENT_ADMINS = ['onized', 'zkeeerus'];

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

  let savedCfg: Partial<RuntimeConfig> = {};
  try {
    const raw = localStorage.getItem(LOCAL_CONFIG_KEY);
    if (raw) savedCfg = JSON.parse(raw);
  } catch {
    // Ignore
  }

  const adminsSet = new Set([
    ...PERMANENT_ADMINS,
    ...(fileCfg.rootAdmins || []).map((a) => a.toLowerCase().trim()),
  ]);

  return {
    apiBaseUrl: (savedCfg.apiBaseUrl ?? fileCfg.apiBaseUrl ?? '').trim(),
    twitchClientId: (savedCfg.twitchClientId ?? fileCfg.twitchClientId ?? '').trim(),
    rootAdmins: Array.from(adminsSet),
  };
}

export function saveLocalRuntimeConfig(partial: Partial<RuntimeConfig>): void {
  try {
    const prevRaw = localStorage.getItem(LOCAL_CONFIG_KEY);
    const prev = prevRaw ? JSON.parse(prevRaw) : {};
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify({ ...prev, ...partial }));
  } catch {
    // Ignore
  }
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

export async function initTwitchSession(clientId?: string): Promise<TwitchUser | null> {
  // 1. Check URL hash after redirect from id.twitch.tv
  if (window.location.hash && window.location.hash.includes('access_token=')) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('access_token');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (token) {
      const verified = await validateTwitchToken(token, clientId);
      if (verified) return verified;
    }
  }

  // 2. Check stored session
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TwitchUser;
    if (parsed.isPreview) {
      return parsed;
    }
    if (parsed.accessToken) {
      const verified = await validateTwitchToken(parsed.accessToken, clientId);
      if (verified) return verified;
      localStorage.removeItem(LOCAL_USER_KEY);
    }
  } catch {
    localStorage.removeItem(LOCAL_USER_KEY);
  }
  return null;
}

export function setPreviewEditorSession(login: 'onized' | 'zkeeerus'): TwitchUser {
  const u: TwitchUser = {
    userId: `preview-${login}`,
    login,
    displayName: login === 'onized' ? 'OniZeD' : 'ZkeeeRus',
    avatarUrl: '',
    accessToken: '',
    isPreview: true,
  };
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(u));
  return u;
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
    const res = await fetch(buildStateEndpoint(apiBaseUrl), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.accessToken}`,
      },
      body: JSON.stringify(stamped),
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
