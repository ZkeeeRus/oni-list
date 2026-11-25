// Обработчик для Yandex Cloud Functions (Node.js 22, Always Free в РФ - 1 млн вызовов/мес бесплатно).
// Хранит состояние в бакете Yandex Object Storage (1 ГБ бесплатно) и проверяет токен Twitch OAuth.
// Поддерживает оба способа доступа к бакету:
// 1) Сервисный аккаунт с ролью storage.editor, выбранный в параметрах функции (IAM-токен из context.token).
// 2) Статические ключи AWS_ACCESS_KEY_ID и AWS_SECRET_ACCESS_KEY + BUCKET_NAME в переменных окружения.

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const PERMANENT_ADMINS = ['onized', 'zkeeerus'];
const STATE_KEY = 'onized-hub-state.json';

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

function getStaticCredentials() {
  let accessKeyId = cleanEnv(process.env.AWS_ACCESS_KEY_ID);
  let secretAccessKey = cleanEnv(process.env.AWS_SECRET_ACCESS_KEY);
  if (secretAccessKey.startsWith('YCAJ') && !accessKeyId.startsWith('YCAJ')) {
    [accessKeyId, secretAccessKey] = [secretAccessKey, accessKeyId];
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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Twitch-Token',
  'Content-Type': 'application/json; charset=utf-8',
};

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

async function readState(iamToken) {
  const bucket = getBucketName();
  if (!bucket) return createEmptyState();

  if (iamToken) {
    try {
      const r = await fetch(
        `https://storage.yandexcloud.net/${encodeURIComponent(bucket)}/${STATE_KEY}`,
        { headers: { 'X-YaCloud-SubjectToken': iamToken } }
      );
      if (r.status === 404) return createEmptyState();
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
      new GetObjectCommand({ Bucket: bucket, Key: STATE_KEY })
    );
    const str = await out.Body.transformToString('utf-8');
    return JSON.parse(str);
  } catch {
    return createEmptyState();
  }
}

async function writeState(jsonString, iamToken) {
  const bucket = getBucketName();
  if (!bucket) {
    throw new Error('Не задана переменная окружения BUCKET_NAME в настройках функции');
  }

  let iamError = '';
  if (iamToken) {
    try {
      const r = await fetch(
        `https://storage.yandexcloud.net/${encodeURIComponent(bucket)}/${STATE_KEY}`,
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
        Key: STATE_KEY,
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

export async function handler(event, context) {
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
    if (storageCheck !== 'ok_iam_empty' && storageCheck !== 'ok_iam_loaded' && bucket && accessKeyId && secretAccessKey) {
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

  if (method === 'GET') {
    const state = await readState(iamToken);
    return { statusCode: 200, headers: CORS, body: JSON.stringify(state) };
  }

  if (method === 'PUT' || method === 'POST') {
    try {
      const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf-8')
        : event.body || '{}';
      const next = JSON.parse(rawBody);

      const headerTok =
        event.headers?.['X-Twitch-Token'] ||
        event.headers?.['x-twitch-token'] ||
        '';
      const authHeader =
        event.headers?.Authorization || event.headers?.authorization || '';
      const bearerOrOauth = authHeader.replace(/^(Bearer|OAuth)\s+/i, '').trim();
      const token = (
        next._twitchToken ||
        headerTok ||
        event.queryStringParameters?.token ||
        bearerOrOauth ||
        ''
      ).trim();
      delete next._twitchToken;

      if (!token) {
        return {
          statusCode: 401,
          headers: CORS,
          body: JSON.stringify({ error: 'Войдите через Twitch' }),
        };
      }

      const vRes = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` },
      });
      if (!vRes.ok) {
        return {
          statusCode: 401,
          headers: CORS,
          body: JSON.stringify({ error: 'Сессия Twitch истекла, перезайдите на сайте' }),
        };
      }

      const vJson = await vRes.json();
      const login = String(vJson.login || '').toLowerCase().trim();
      const currentState = await readState(iamToken);
      const allowed = new Set([
        ...PERMANENT_ADMINS,
        ...(currentState.admins || []).map((a) => String(a).toLowerCase()),
        ...(currentState.moderators || []).map((m) => String(m).toLowerCase()),
      ]);

      if (!allowed.has(login)) {
        return {
          statusCode: 403,
          headers: CORS,
          body: JSON.stringify({ error: `Нет прав редактора у @${login}` }),
        };
      }

      next.admins = Array.from(
        new Set([
          ...PERMANENT_ADMINS,
          ...(next.admins || []).map((a) => String(a).toLowerCase()),
        ])
      );
      next.updatedAt = new Date().toISOString();

      await writeState(JSON.stringify(next), iamToken);

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ ok: true, updatedBy: login, updatedAt: next.updatedAt }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: err?.message || 'Ошибка сохранения в Object Storage' }),
      };
    }
  }

  return { statusCode: 405, headers: CORS, body: '{"error":"Method not allowed"}' };
}
