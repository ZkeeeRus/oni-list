import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 7860);
const DB_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SITE_DIR = process.env.SITE_DIR || path.join(__dirname, '..', '..', 'site');
const SEED_PATH =
  process.env.SEED_PATH || path.join(__dirname, '..', '..', 'public', 'seed-data.json');

const PERMANENT_ADMINS = ['onized', 'zkeeerus'];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

fs.mkdirSync(DB_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DB_DIR, 'onized.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS site_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

function getStoredState() {
  const row = db.prepare('SELECT payload FROM site_state WHERE id = 1').get();
  if (row && row.payload) {
    return JSON.parse(row.payload);
  }
  if (fs.existsSync(SEED_PATH)) {
    const seedRaw = fs.readFileSync(SEED_PATH, 'utf-8');
    const now = new Date().toISOString();
    db.prepare(
      'INSERT OR REPLACE INTO site_state (id, payload, updated_at) VALUES (1, ?, ?)'
    ).run(seedRaw, now);
    return JSON.parse(seedRaw);
  }
  return {
    version: 1,
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

async function verifyTwitchEditor(authHeader, currentState) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Требуется вход через Twitch' };
  }
  const token = authHeader.slice(7).trim();
  const res = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
  });
  if (!res.ok) {
    return { ok: false, status: 401, error: 'Сессия Twitch истекла, войдите заново' };
  }
  const info = await res.json();
  const login = String(info.login || '').toLowerCase().trim();
  const allowed = new Set([
    ...PERMANENT_ADMINS,
    ...(currentState.admins || []).map((x) => String(x).toLowerCase().trim()),
    ...(currentState.moderators || []).map((x) => String(x).toLowerCase().trim()),
  ]);
  if (!allowed.has(login)) {
    return {
      ok: false,
      status: 403,
      error: `У аккаунта @${login} нет прав стримера или модератора`,
    };
  }
  return { ok: true, login };
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const reqUrl = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && reqUrl.pathname === '/api/state') {
    const state = getStoredState();
    sendJson(res, 200, state);
    return;
  }

  if (req.method === 'GET' && reqUrl.pathname === '/api/covers/steam') {
    const q = (reqUrl.searchParams.get('q') || '').trim();
    if (!q) {
      sendJson(res, 200, { items: [] });
      return;
    }
    try {
      const stRes = await fetch(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
          q
        )}&l=russian&cc=US`
      );
      const stJson = await stRes.json();
      const items = (stJson.items || []).slice(0, 6).map((it) => ({
        title: it.name,
        steamAppId: it.id,
        url: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${it.id}/library_600x900.jpg`,
        source: 'Steam CDN',
      }));
      sendJson(res, 200, { items });
    } catch {
      sendJson(res, 200, { items: [] });
    }
    return;
  }

  if (req.method === 'PUT' && reqUrl.pathname === '/api/state') {
    const currentState = getStoredState();
    const check = await verifyTwitchEditor(req.headers.authorization, currentState);
    if (!check.ok) {
      sendJson(res, check.status, { error: check.error });
      return;
    }

    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 25 * 1024 * 1024) {
        sendJson(res, 413, { error: 'Слишком большой размер запроса' });
        return;
      }
      chunks.push(chunk);
    }

    try {
      const next = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      next.admins = Array.from(
        new Set([
          ...PERMANENT_ADMINS,
          ...(next.admins || []).map((a) => String(a).toLowerCase().trim()),
        ])
      );
      next.updatedAt = new Date().toISOString();
      db.prepare(
        'INSERT OR REPLACE INTO site_state (id, payload, updated_at) VALUES (1, ?, ?)'
      ).run(JSON.stringify(next), next.updatedAt);
      sendJson(res, 200, { ok: true, updatedBy: check.login, updatedAt: next.updatedAt });
    } catch {
      sendJson(res, 400, { error: 'Некорректный JSON' });
    }
    return;
  }

  // Static site serving when deployed all-in-one
  if (req.method === 'GET' && fs.existsSync(SITE_DIR)) {
    const safeRel = path
      .normalize(decodeURIComponent(reqUrl.pathname))
      .replace(/^(\.\.(\/|\\|$))+/, '');
    let filePath = path.join(SITE_DIR, safeRel === '/' ? 'index.html' : safeRel);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(SITE_DIR, 'index.html');
    }
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  sendJson(res, 200, { service: 'onized-hub-api', status: 'ok' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`OniZeD Hub running on http://localhost:${PORT}`);
});
