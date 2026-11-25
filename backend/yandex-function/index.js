// Обработчик для Yandex Cloud Functions (Node.js 22, Always Free в РФ - 1 млн вызовов/мес бесплатно).
// Хранит состояние в бакете Yandex Object Storage (1 ГБ бесплатно) и проверяет токен Twitch OAuth.
// Переменные окружения функции: BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (сервисный аккаунт storage.editor).

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const PERMANENT_ADMINS = ['onized', 'zkeeerus'];
const STATE_KEY = 'onized-hub-state.json';

const s3 = new S3Client({
  region: 'ru-central1',
  endpoint: 'https://storage.yandexcloud.net',
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Twitch-Token',
  'Content-Type': 'application/json; charset=utf-8',
};

async function readState() {
  try {
    const out = await s3.send(
      new GetObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: STATE_KEY })
    );
    const str = await out.Body.transformToString('utf-8');
    return JSON.parse(str);
  } catch {
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
}

export async function handler(event) {
  const method = event.httpMethod;
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '{}' };
  }

  const path = event.path || event.url || '';
  const action = event.queryStringParameters?.action || '';

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
    const state = await readState();
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
      const currentState = await readState();
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

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.BUCKET_NAME,
          Key: STATE_KEY,
          Body: JSON.stringify(next),
          ContentType: 'application/json',
        })
      );

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
