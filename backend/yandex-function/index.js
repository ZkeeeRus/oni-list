// Обработчик для Yandex Cloud Functions (Node.js 22).
// Отвечает за:
// 1) Хранение и защиту базы OniZeD Hub в Yandex Object Storage (проверка Twitch OAuth + client_id + Origin + роли + антивандал + защита от перезаписи со старой вкладки).
// 2) Автоматические облачные бэкапы (10 ротируемых слотов в бакете с восстановлением в 1 клик из админки).
// 3) Обезличенную аналитику посещаемости сайта, вкладок, устройств и входов через Twitch (без IP, почт и личных данных).

import crypto from 'node:crypto';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const PERMANENT_ADMINS = ['onized', 'zkeeerus'];
const DEFAULT_TWITCH_CLIENT_ID = 'v78wuh35wmptpayuqj81a7y55y6l8s';

const STATE_KEY = 'onized-hub-state.json';
const AUTH_STATS_KEY = 'onized-hub-auth-stats.json';
const ANALYTICS_KEY = 'onized-hub-analytics.json';
const BACKUPS_INDEX_KEY = 'backups/index.json';

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 МБ максимум
const MAX_RECENT_LOGINS = 150;
const MAX_BACKUP_SLOTS = 10;
const MIN_BACKUP_INTERVAL_MS = 10 * 60 * 1000; // Не чаще 1 авто-снапшота в 10 минут
const ALLOWED_TABS = [
  'hub',
  'games',
  'watchlist',
  'tierlist',
  'backlog',
  'stats',
  'rules',
];
const ALLOWED_DEVICES = ['desktop', 'mobile', 'tablet'];
const ALLOWED_REFERRERS = ['direct', 'twitch', 'social', 'search', 'other'];
const ALLOWED_ACTIONS = ['roulette_spin', 'card_open', 'tree_click'];

function cleanEnv(val) {
  return String(val || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
}

function getBucketName() {
  let b = cleanEnv(process.env.BUCKET_NAME);
  b = b.replace(/^https?:\/\/storage\.yandexcloud\.net\//i, '');
  b = b.replace(/^s3:\/\//i, '');
  b = b.replace(/\/+.*$/, '');
  return b.trim();
}

function getExpectedClientId() {
  return cleanEnv(process.env.TWITCH_CLIENT_ID) || DEFAULT_TWITCH_CLIENT_ID;
}

function getHashSalt() {
  return cleanEnv(process.env.ANALYTICS_SALT) || `onized-anon-salt-${getBucketName()}`;
}

function hashVisitorId(rawVid) {
  const s = String(rawVid || '').trim();
  if (!s || s.length < 8 || s.length > 80) return '';
  return crypto
    .createHash('sha256')
    .update(`${getHashSalt()}:${s}`)
    .digest('hex')
    .slice(0, 12);
}

function getStaticCredentials() {
  let accessKeyId = cleanEnv(process.env.AWS_ACCESS_KEY_ID);
  let secretAccessKey = cleanEnv(process.env.AWS_SECRET_ACCESS_KEY);
  if (secretAccessKey.startsWith('YCAJ') && !accessKeyId.startsWith('YCAJ')) {
    [accessKeyId, secretAccessKey] = [secretAccessKey, secretAccessKey];
  }
  return { accessKeyId, secretAccessKey };
}

function createS3Client() {
  const { accessKeyId, secretAccessKey } = getStaticCredentials();
  const cfg = {
    region: 'ru-central1',
    endpoint: 'https://storage.yandexcloud.net',
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  };
  if (accessKeyId && secretAccessKey) {
    cfg.credentials = { accessKeyId, secretAccessKey };
  }
  return new S3Client(cfg);
}

const s3 = createS3Client();

function buildCorsHeaders(event) {
  const origin = String(event?.headers?.Origin || event?.headers?.origin || '').trim();
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Twitch-Token',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function isAllowedOrigin(event) {
  const origin = String(event?.headers?.Origin || event?.headers?.origin || '')
    .trim()
    .toLowerCase();
  // Если заголовок Origin отсутствует (например серверная диагностика), разрешаем; если браузер прислал чужой домен - проверяем белый список
  if (!origin) return true;
  if (
    origin === 'https://onihub.ru' ||
    origin === 'https://www.onihub.ru' ||
    origin === 'http://onihub.ru' ||
    origin === 'http://www.onihub.ru' ||
    origin === 'https://zkeeerus.github.io' ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  ) {
    return true;
  }
  const extraOrigin = cleanEnv(process.env.ALLOWED_ORIGIN).toLowerCase();
  if (extraOrigin && origin === extraOrigin) return true;
  return false;
}

function createEmptyState() {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    admins: PERMANENT_ADMINS,
    moderators: [],
    games: [],
    watchlist: [],
    memes: [],
    backlog: [],
    customTierLists: [],
  };
}

function createEmptyAuthStats() {
  return {
    version: 1,
    totalLogins: 0,
    users: {},
    recent: [],
  };
}

function createEmptyAnalytics() {
  return {
    version: 1,
    totalSessions: 0,
    totalTabViews: 0,
    authedSessions: 0,
    guestSessions: 0,
    consentlessHits: 0,
    visitorHashes: [],
    authedVisitorHashes: [],
    tabs: {},
    devices: {},
    referrers: {},
    actions: {},
    daily: {},
  };
}

function createEmptyBackupsIndex() {
  return {
    version: 1,
    nextSlot: 0,
    lastBackupAtMs: 0,
    items: [],
  };
}

async function readJsonFromBucket(objectKey, iamToken, createFallback) {
  const bucket = getBucketName();
  if (!bucket) return createFallback();

  if (iamToken) {
    try {
      const r = await fetch(
        `https://storage.yandexcloud.net/${encodeURIComponent(bucket)}/${objectKey}`,
        { headers: { 'X-YaCloud-SubjectToken': iamToken } }
      );
      if (r.status === 404) return createFallback();
      if (r.ok) {
        const text = await r.text();
        return JSON.parse(text);
      }
    } catch {
      // Переходим к запасному чтению через S3Client
    }
  }

  try {
    const out = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: objectKey })
    );
    const str = await out.Body.transformToString('utf-8');
    return JSON.parse(str);
  } catch {
    return createFallback();
  }
}

async function writeJsonToBucket(objectKey, jsonString, iamToken) {
  const bucket = getBucketName();
  if (!bucket) {
    throw new Error('Не задана переменная окружения BUCKET_NAME в настройках функции');
  }

  let iamError = '';
  if (iamToken) {
    try {
      const r = await fetch(
        `https://storage.yandexcloud.net/${encodeURIComponent(bucket)}/${objectKey}`,
        {
          method: 'PUT',
          headers: {
            'X-YaCloud-SubjectToken': iamToken,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: jsonString,
        }
      );
      if (r.ok) {
        return;
      }
      iamError = `IAM ${r.status}: ${(await r.text()).slice(0, 180)}`;
    } catch (e) {
      iamError = e?.message || 'ошибка запроса IAM';
    }
  }

  const { accessKeyId, secretAccessKey } = getStaticCredentials();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      iamError
        ? `Не удалось записать через сервисный аккаунт (${iamError}), а статические ключи не заданы`
        : 'Не заданы AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY и не привязан сервисный аккаунт функции'
    );
  }

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: Buffer.from(jsonString, 'utf-8'),
        ContentType: 'application/json; charset=utf-8',
      })
    );
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg.includes('signature') || err?.name === 'SignatureDoesNotMatch') {
      throw new Error(
        'Не совпала подпись статического ключа S3: перепроверьте AWS_SECRET_ACCESS_KEY без пробелов или выберите ваш сервисный аккаунт (storage.editor) в поле "Сервисный аккаунт" функции'
      );
    }
    throw err;
  }
}

function parseEventBody(event) {
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf-8')
    : event.body || '{}';
  if (Buffer.byteLength(rawBody, 'utf-8') > MAX_BODY_BYTES) {
    throw new Error('Превышен допустимый размер запроса (макс. 4 МБ)');
  }
  return JSON.parse(rawBody || '{}');
}

function extractToken(event, bodyObj) {
  const headerTok =
    event.headers?.['X-Twitch-Token'] ||
    event.headers?.['x-twitch-token'] ||
    '';
  const authHeader =
    event.headers?.Authorization || event.headers?.authorization || '';
  const bearerOrOauth = authHeader.replace(/^(Bearer|OAuth)\s+/i, '').trim();
  return String(
    bodyObj?._twitchToken ||
      headerTok ||
      event.queryStringParameters?.token ||
      bearerOrOauth ||
      ''
  ).trim();
}

async function verifyTwitchToken(token) {
  if (!token) {
    return { ok: false, status: 401, error: 'Войдите через Twitch' };
  }
  const vRes = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
  });
  if (!vRes.ok) {
    return {
      ok: false,
      status: 401,
      error: 'Сессия Twitch истекла, перезайдите на сайте',
    };
  }
  const vJson = await vRes.json();
  const login = String(vJson.login || '').toLowerCase().trim();
  const clientId = String(vJson.client_id || '').trim();
  const expectedClientId = getExpectedClientId();

  if (!login) {
    return { ok: false, status: 401, error: 'Некорректный ответ Twitch OAuth' };
  }
  if (expectedClientId && clientId && clientId !== expectedClientId) {
    return {
      ok: false,
      status: 403,
      error: 'Токен выдан сторонним приложением Twitch',
    };
  }
  return { ok: true, login };
}

function sanitizeAvatarUrl(url) {
  const s = String(url || '').trim();
  if (s.startsWith('https://static-cdn.jtvnw.net/')) {
    return s.slice(0, 300);
  }
  return '';
}

function clampSmallInt(val, max = 25) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(max, Math.floor(n));
}

async function maybeCreateRollingBackup(currentState, triggeredBy, iamToken, force = false) {
  try {
    if (!currentState || !Array.isArray(currentState.games) || currentState.games.length === 0) {
      return;
    }
    const idx = await readJsonFromBucket(
      BACKUPS_INDEX_KEY,
      iamToken,
      createEmptyBackupsIndex
    );
    const nowMs = Date.now();
    if (!force && idx.lastBackupAtMs && nowMs - idx.lastBackupAtMs < MIN_BACKUP_INTERVAL_MS) {
      return;
    }

    const slot = (idx.nextSlot || 0) % MAX_BACKUP_SLOTS;
    const slotKey = `backups/state-slot-${slot}.json`;
    const savedAt = new Date(nowMs).toISOString();

    await writeJsonToBucket(slotKey, JSON.stringify(currentState), iamToken);

    const meta = {
      slot,
      key: slotKey,
      savedAt,
      stateUpdatedAt: currentState.updatedAt || savedAt,
      savedBeforeEditBy: triggeredBy,
      gamesCount: currentState.games.length,
      watchCount: Array.isArray(currentState.watchlist) ? currentState.watchlist.length : 0,
    };

    const filteredItems = (Array.isArray(idx.items) ? idx.items : []).filter(
      (it) => it.slot !== slot
    );
    const nextIndex = {
      version: 1,
      nextSlot: (slot + 1) % MAX_BACKUP_SLOTS,
      lastBackupAtMs: nowMs,
      items: [meta, ...filteredItems].slice(0, MAX_BACKUP_SLOTS),
    };

    await writeJsonToBucket(BACKUPS_INDEX_KEY, JSON.stringify(nextIndex), iamToken);
  } catch {
    // Не блокируем основное сохранение, если снимок не записался
  }
}

export async function handler(event, context) {
  const CORS = buildCorsHeaders(event);
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '{}' };
  }

  const iamToken = context?.token?.access_token || '';
  const path = event.path || event.url || '';
  const action = event.queryStringParameters?.action || '';

  if (method === 'GET' && action === 'diag') {
    const bucket = getBucketName();
    const { accessKeyId, secretAccessKey } = getStaticCredentials();
    let storageCheck = 'untested';
    if (!bucket) {
      storageCheck = 'missing_bucket_name';
    } else if (iamToken) {
      try {
        const r = await fetch(
          `https://storage.yandexcloud.net/${encodeURIComponent(bucket)}/${STATE_KEY}`,
          { headers: { 'X-YaCloud-SubjectToken': iamToken } }
        );
        storageCheck =
          r.status === 404
            ? 'ok_iam_empty'
            : r.ok
              ? 'ok_iam_loaded'
              : `iam_http_${r.status}`;
      } catch (e) {
        storageCheck = `iam_err_${e?.message || 'unknown'}`;
      }
    }
    if (
      storageCheck !== 'ok_iam_empty' &&
      storageCheck !== 'ok_iam_loaded' &&
      bucket &&
      accessKeyId &&
      secretAccessKey
    ) {
      try {
        await s3.send(new GetObjectCommand({ Bucket: bucket, Key: STATE_KEY }));
        storageCheck = 'ok_s3_loaded';
      } catch (e) {
        if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) {
          storageCheck = 'ok_s3_empty';
        } else {
          storageCheck = `s3_err_${e?.name || 'Error'}: ${e?.message || ''}`;
        }
      }
    }
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        authStatsSupported: true,
        telemetrySupported: true,
        backupsSupported: true,
        hasBucket: Boolean(bucket),
        hasIamToken: Boolean(iamToken),
        hasStaticKeys: Boolean(accessKeyId && secretAccessKey),
        keyFormatOk: accessKeyId.startsWith('YCAJ') && secretAccessKey.length >= 36,
        storageCheck,
      }),
    };
  }

  if (method === 'GET' && (action === 'steam' || path.includes('/covers/steam'))) {
    const q = event.queryStringParameters?.q || '';
    if (!q) return { statusCode: 200, headers: CORS, body: '{"items":[]}' };
    const r = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=russian&cc=US`
    );
    const d = await r.json();
    const items = (d.items || []).slice(0, 6).map((it) => ({
      title: it.name,
      steamAppId: it.id,
      url: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${it.id}/library_600x900.jpg`,
      source: 'Steam CDN',
    }));
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ items }) };
  }

  if (method !== 'GET' && !isAllowedOrigin(event)) {
    return {
      statusCode: 403,
      headers: CORS,
      body: JSON.stringify({ error: 'Запрос с неразрешенного домена отклонен' }),
    };
  }

  // 1. Обезличенная телеметрия посещаемости сайта, вкладок и активности (без IP, без User-Agent, с необратимым хэшем анонимного cookie-ID)
  if (method === 'POST' && action === 'telemetry') {
    try {
      const body = parseEventBody(event);
      const analytics = await readJsonFromBucket(
        ANALYTICS_KEY,
        iamToken,
        createEmptyAnalytics
      );

      const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      if (!analytics.daily || typeof analytics.daily !== 'object') analytics.daily = {};
      if (!analytics.tabs || typeof analytics.tabs !== 'object') analytics.tabs = {};
      if (!analytics.devices || typeof analytics.devices !== 'object') analytics.devices = {};
      if (!analytics.referrers || typeof analytics.referrers !== 'object') analytics.referrers = {};
      if (!analytics.actions || typeof analytics.actions !== 'object') analytics.actions = {};
      if (!Array.isArray(analytics.visitorHashes)) analytics.visitorHashes = [];
      if (!Array.isArray(analytics.authedVisitorHashes)) analytics.authedVisitorHashes = [];

      if (!analytics.daily[todayKey]) {
        analytics.daily[todayKey] = {
          sessions: 0,
          tabViews: 0,
          authedSessions: 0,
          guestSessions: 0,
          uniqueHashes: [],
        };
      }
      const dayRec = analytics.daily[todayKey];
      if (!Array.isArray(dayRec.uniqueHashes)) dayRec.uniqueHashes = [];

      const isNewSession = Boolean(body.newSession);
      const isAuthed = Boolean(body.authed);
      const hasConsent = Boolean(body.consent);
      const vHash = hasConsent ? hashVisitorId(body.vid) : '';

      if (vHash) {
        if (!analytics.visitorHashes.includes(vHash)) {
          analytics.visitorHashes.push(vHash);
          if (analytics.visitorHashes.length > 12000) {
            analytics.visitorHashes = analytics.visitorHashes.slice(-12000);
          }
        }
        if (isAuthed && !analytics.authedVisitorHashes.includes(vHash)) {
          analytics.authedVisitorHashes.push(vHash);
          if (analytics.authedVisitorHashes.length > 5000) {
            analytics.authedVisitorHashes = analytics.authedVisitorHashes.slice(-5000);
          }
        }
        if (!dayRec.uniqueHashes.includes(vHash) && dayRec.uniqueHashes.length < 2500) {
          dayRec.uniqueHashes.push(vHash);
        }
      } else if (isNewSession) {
        analytics.consentlessHits = (analytics.consentlessHits || 0) + 1;
      }

      if (isNewSession) {
        analytics.totalSessions = (analytics.totalSessions || 0) + 1;
        dayRec.sessions = (dayRec.sessions || 0) + 1;
        if (isAuthed) {
          analytics.authedSessions = (analytics.authedSessions || 0) + 1;
          dayRec.authedSessions = (dayRec.authedSessions || 0) + 1;
        } else {
          analytics.guestSessions = (analytics.guestSessions || 0) + 1;
          dayRec.guestSessions = (dayRec.guestSessions || 0) + 1;
        }

        const dev = String(body.device || '');
        if (ALLOWED_DEVICES.includes(dev)) {
          analytics.devices[dev] = (analytics.devices[dev] || 0) + 1;
        }
        const ref = String(body.ref || '');
        if (ALLOWED_REFERRERS.includes(ref)) {
          analytics.referrers[ref] = (analytics.referrers[ref] || 0) + 1;
        }
      }

      if (body.tabs && typeof body.tabs === 'object') {
        for (const t of ALLOWED_TABS) {
          const inc = clampSmallInt(body.tabs[t], 20);
          if (inc > 0) {
            analytics.tabs[t] = (analytics.tabs[t] || 0) + inc;
            analytics.totalTabViews = (analytics.totalTabViews || 0) + inc;
            dayRec.tabViews = (dayRec.tabViews || 0) + inc;
          }
        }
      }

      if (body.actions && typeof body.actions === 'object') {
        for (const act of ALLOWED_ACTIONS) {
          const inc = clampSmallInt(body.actions[act], 30);
          if (inc > 0) {
            analytics.actions[act] = (analytics.actions[act] || 0) + inc;
          }
        }
      }

      // Оставляем посуточную историю только за последние 90 дней
      const sortedDates = Object.keys(analytics.daily).sort();
      if (sortedDates.length > 90) {
        for (const oldDate of sortedDates.slice(0, sortedDates.length - 90)) {
          delete analytics.daily[oldDate];
        }
      }

      await writeJsonToBucket(ANALYTICS_KEY, JSON.stringify(analytics), iamToken);
      return { statusCode: 200, headers: CORS, body: '{"ok":true}' };
    } catch {
      return { statusCode: 200, headers: CORS, body: '{"ok":false}' };
    }
  }

  // 2. Запись факта авторизации через Twitch
  if (method === 'POST' && action === 'auth-log') {
    try {
      const body = parseEventBody(event);
      const token = extractToken(event, body);
      const auth = await verifyTwitchToken(token);
      if (!auth.ok) {
        return {
          statusCode: auth.status,
          headers: CORS,
          body: JSON.stringify({ error: auth.error }),
        };
      }

      const login = auth.login;
      const displayName =
        String(body.displayName || login)
          .trim()
          .slice(0, 40) || login;
      const avatarUrl = sanitizeAvatarUrl(body.avatarUrl);
      const isFreshLogin = Boolean(body.isLogin);
      const nowIso = new Date().toISOString();

      const stats = await readJsonFromBucket(
        AUTH_STATS_KEY,
        iamToken,
        createEmptyAuthStats
      );
      if (!stats.users || typeof stats.users !== 'object') stats.users = {};
      if (!Array.isArray(stats.recent)) stats.recent = [];

      const prev = stats.users[login];
      const countIncrement = isFreshLogin || !prev ? 1 : 0;

      stats.users[login] = {
        login,
        displayName,
        avatarUrl: avatarUrl || prev?.avatarUrl || '',
        firstSeenAt: prev?.firstSeenAt || nowIso,
        lastSeenAt: nowIso,
        loginCount: (prev?.loginCount || 0) + countIncrement,
      };

      if (countIncrement > 0) {
        stats.totalLogins = (stats.totalLogins || 0) + 1;
        stats.recent = [
          {
            login,
            displayName,
            avatarUrl: stats.users[login].avatarUrl,
            at: nowIso,
          },
          ...stats.recent,
        ].slice(0, MAX_RECENT_LOGINS);
      }

      await writeJsonToBucket(AUTH_STATS_KEY, JSON.stringify(stats), iamToken);
      return { statusCode: 200, headers: CORS, body: '{"ok":true}' };
    } catch (err) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: err?.message || 'Ошибка записи лога входа' }),
      };
    }
  }

  // 3. Единая сводка админки: входы Twitch + обезличенная аналитика сайта + список облачных авто-бэкапов
  if (method === 'POST' && (action === 'auth-stats' || action === 'admin-dashboard')) {
    try {
      const body = parseEventBody(event);
      const token = extractToken(event, body);
      const auth = await verifyTwitchToken(token);
      if (!auth.ok) {
        return {
          statusCode: auth.status,
          headers: CORS,
          body: JSON.stringify({ error: auth.error }),
        };
      }

      const currentState = await readJsonFromBucket(
        STATE_KEY,
        iamToken,
        createEmptyState
      );
      const allowed = new Set([
        ...PERMANENT_ADMINS,
        ...(currentState.admins || []).map((a) => String(a).toLowerCase()),
        ...(currentState.moderators || []).map((m) => String(m).toLowerCase()),
      ]);

      if (!allowed.has(auth.login)) {
        return {
          statusCode: 403,
          headers: CORS,
          body: JSON.stringify({ error: 'Доступно только админам и модераторам' }),
        };
      }

      const [authStats, analytics, backupsIdx] = await Promise.all([
        readJsonFromBucket(AUTH_STATS_KEY, iamToken, createEmptyAuthStats),
        readJsonFromBucket(ANALYTICS_KEY, iamToken, createEmptyAnalytics),
        readJsonFromBucket(BACKUPS_INDEX_KEY, iamToken, createEmptyBackupsIndex),
      ]);

      const usersList = Object.values(authStats.users || {}).sort((a, b) =>
        String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || ''))
      );

      const dailyEntries = Object.entries(analytics.daily || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14)
        .map(([date, d]) => ({
          date,
          sessions: d.sessions || 0,
          tabViews: d.tabViews || 0,
          uniqueVisitors: Array.isArray(d.uniqueHashes) ? d.uniqueHashes.length : 0,
          authedSessions: d.authedSessions || 0,
          guestSessions: d.guestSessions || 0,
        }));

      const totalUniqueWithCookie = Array.isArray(analytics.visitorHashes)
        ? analytics.visitorHashes.length
        : 0;
      const authedUniqueWithCookie = Array.isArray(analytics.authedVisitorHashes)
        ? analytics.authedVisitorHashes.length
        : 0;
      const uniqueGuestsEstimate = Math.max(
        0,
        totalUniqueWithCookie - authedUniqueWithCookie
      );

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: true,
          totalUniqueUsers: usersList.length,
          totalLogins: authStats.totalLogins || usersList.length,
          users: usersList,
          recent: Array.isArray(authStats.recent) ? authStats.recent.slice(0, 50) : [],
          siteAnalytics: {
            uniqueVisitors: totalUniqueWithCookie,
            uniqueAuthedVisitors: Math.max(usersList.length, authedUniqueWithCookie),
            uniqueGuestVisitors: uniqueGuestsEstimate,
            consentlessHits: analytics.consentlessHits || 0,
            totalSessions: analytics.totalSessions || 0,
            totalTabViews: analytics.totalTabViews || 0,
            authedSessions: analytics.authedSessions || 0,
            guestSessions: analytics.guestSessions || 0,
            tabs: analytics.tabs || {},
            devices: analytics.devices || {},
            referrers: analytics.referrers || {},
            actions: analytics.actions || {},
            daily: dailyEntries,
          },
          backups: Array.isArray(backupsIdx.items) ? backupsIdx.items : [],
        }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: err?.message || 'Ошибка чтения аналитики' }),
      };
    }
  }

  // 4. Восстановление базы из облачного авто-бэкапа (только главные админы)
  if (method === 'POST' && action === 'restore-backup') {
    try {
      const body = parseEventBody(event);
      const token = extractToken(event, body);
      const auth = await verifyTwitchToken(token);
      if (!auth.ok) {
        return {
          statusCode: auth.status,
          headers: CORS,
          body: JSON.stringify({ error: auth.error }),
        };
      }

      const currentState = await readJsonFromBucket(
        STATE_KEY,
        iamToken,
        createEmptyState
      );
      const adminSet = new Set([
        ...PERMANENT_ADMINS,
        ...(currentState.admins || []).map((a) => String(a).toLowerCase()),
      ]);
      if (!adminSet.has(auth.login)) {
        return {
          statusCode: 403,
          headers: CORS,
          body: JSON.stringify({ error: 'Восстанавливать бэкапы могут только админы' }),
        };
      }

      const slot = Number(body.slot);
      if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_BACKUP_SLOTS) {
        return {
          statusCode: 400,
          headers: CORS,
          body: JSON.stringify({ error: 'Некорректный номер слота бэкапа' }),
        };
      }

      const slotKey = `backups/state-slot-${slot}.json`;
      const restored = await readJsonFromBucket(slotKey, iamToken, () => null);
      if (!restored || !Array.isArray(restored.games)) {
        return {
          statusCode: 404,
          headers: CORS,
          body: JSON.stringify({ error: 'Слот резервной копии не найден' }),
        };
      }

      // Перед восстановлением сохраняем текущую версию в соседний слот
      await maybeCreateRollingBackup(currentState, auth.login, iamToken, true);

      restored.admins = Array.from(
        new Set([
          ...PERMANENT_ADMINS,
          ...(restored.admins || []).map((a) => String(a).toLowerCase()),
        ])
      );
      restored.updatedAt = new Date().toISOString();
      restored.lastUpdatedBy = auth.login;

      await writeJsonToBucket(STATE_KEY, JSON.stringify(restored), iamToken);

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ ok: true, state: restored }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: err?.message || 'Ошибка восстановления бэкапа' }),
      };
    }
  }

  if (method === 'GET') {
    const state = await readJsonFromBucket(
      STATE_KEY,
      iamToken,
      createEmptyState
    );
    return { statusCode: 200, headers: CORS, body: JSON.stringify(state) };
  }

  if (method === 'PUT' || method === 'POST') {
    try {
      const next = parseEventBody(event);
      const token = extractToken(event, next);
      const baseUpdatedAt = next._baseUpdatedAt ? String(next._baseUpdatedAt) : '';
      const forceOverwrite = Boolean(next._forceOverwrite);
      const allowMassDelete = Boolean(next._allowMassDelete);

      delete next._twitchToken;
      delete next._baseUpdatedAt;
      delete next._forceOverwrite;
      delete next._allowMassDelete;

      const auth = await verifyTwitchToken(token);
      if (!auth.ok) {
        return {
          statusCode: auth.status,
          headers: CORS,
          body: JSON.stringify({ error: auth.error }),
        };
      }

      if (
        !Array.isArray(next.games) ||
        !Array.isArray(next.watchlist) ||
        !Array.isArray(next.backlog) ||
        !Array.isArray(next.memes)
      ) {
        return {
          statusCode: 400,
          headers: CORS,
          body: JSON.stringify({ error: 'Некорректный формат данных состояния' }),
        };
      }

      const login = auth.login;
      const currentState = await readJsonFromBucket(
        STATE_KEY,
        iamToken,
        createEmptyState
      );

      const adminSet = new Set([
        ...PERMANENT_ADMINS,
        ...(currentState.admins || []).map((a) => String(a).toLowerCase()),
      ]);
      const modSet = new Set(
        (currentState.moderators || []).map((m) => String(m).toLowerCase())
      );

      const isAdmin = adminSet.has(login);
      const isMod = modSet.has(login);

      if (!isAdmin && !isMod) {
        return {
          statusCode: 403,
          headers: CORS,
          body: JSON.stringify({ error: `Нет прав редактора у @${login}` }),
        };
      }

      // Защита от перезаписи чужих правок со старой неактивной вкладки (optimistic concurrency)
      if (
        !forceOverwrite &&
        baseUpdatedAt &&
        currentState.updatedAt &&
        currentState.updatedAt !== baseUpdatedAt
      ) {
        const who = currentState.lastUpdatedBy
          ? `@${currentState.lastUpdatedBy}`
          : 'другое устройство';
        return {
          statusCode: 409,
          headers: CORS,
          body: JSON.stringify({
            conflict: true,
            serverUpdatedAt: currentState.updatedAt,
            updatedBy: currentState.lastUpdatedBy || '',
            error: `База уже была обновлена (${who}). Обновите страницу (F5), чтобы не затереть чужие правки!`,
          }),
        };
      }

      // Антивандал-защита от случайного или намеренного удаления > 30% базы
      const prevGamesCount = Array.isArray(currentState.games)
        ? currentState.games.length
        : 0;
      if (prevGamesCount >= 20 && next.games.length < Math.floor(prevGamesCount * 0.7)) {
        if (!isAdmin || !allowMassDelete) {
          return {
            statusCode: 403,
            headers: CORS,
            body: JSON.stringify({
              error:
                'Защита от потери данных: отклонено резкое уменьшение списка игр. Для загрузки бэкапа используйте кнопку Импорт JSON под главным админом.',
            }),
          };
        }
      }

      // Сохраняем ротируемый авто-бэкап предыдущего состояния (не чаще 1 раза в 10 минут)
      await maybeCreateRollingBackup(currentState, login, iamToken, allowMassDelete);

      // Менять список админов и модераторов могут только главные админы
      if (isAdmin) {
        next.admins = Array.from(
          new Set([
            ...PERMANENT_ADMINS,
            ...(next.admins || []).map((a) => String(a).toLowerCase()),
          ])
        );
        next.moderators = Array.from(
          new Set(
            (next.moderators || [])
              .map((m) => String(m).toLowerCase().trim())
              .filter(Boolean)
          )
        );
      } else {
        next.admins = Array.from(adminSet);
        next.moderators = Array.from(modSet);
      }

      next.updatedAt = new Date().toISOString();
      next.lastUpdatedBy = login;

      await writeJsonToBucket(STATE_KEY, JSON.stringify(next), iamToken);

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: true,
          updatedBy: login,
          updatedAt: next.updatedAt,
        }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({
          error: err?.message || 'Ошибка сохранения в Object Storage',
        }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: CORS,
    body: '{"error":"Method not allowed"}',
  };
}
