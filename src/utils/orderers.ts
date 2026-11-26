import { GameItem, WatchItem } from '../types';

export interface OrdererStat {
  key: string;
  display: string;
  total: number;
  gamesCount: number;
  watchCount: number;
  completedGames: number;
  droppedGames: number;
}

const STREAMER_ALIASES = new Set([
  'я',
  'стример',
  'onized',
  'onized (бэклог)',
  'стример (бэклог)',
]);

export function normalizeOrdererName(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '-';
  if (STREAMER_ALIASES.has(trimmed.toLowerCase())) {
    return 'Стример';
  }
  return trimmed;
}

export function collectOrdererStats(
  games: GameItem[],
  watchlist: WatchItem[] = []
): OrdererStat[] {
  const map = new Map<
    string,
    {
      variants: Map<string, number>;
      total: number;
      gamesCount: number;
      watchCount: number;
      completedGames: number;
      droppedGames: number;
    }
  >();

  const register = (raw: string | undefined, isGame: boolean, status = '') => {
    const norm = normalizeOrdererName(raw);
    if (!norm || norm === '-' || norm === '?') return;
    const key = norm.toLowerCase();
    let entry = map.get(key);
    if (!entry) {
      entry = {
        variants: new Map(),
        total: 0,
        gamesCount: 0,
        watchCount: 0,
        completedGames: 0,
        droppedGames: 0,
      };
      map.set(key, entry);
    }
    entry.variants.set(norm, (entry.variants.get(norm) || 0) + 1);
    entry.total += 1;
    if (isGame) {
      entry.gamesCount += 1;
      if (status === 'Игра пройдена') entry.completedGames += 1;
      if (status.toLowerCase().includes('дроп')) entry.droppedGames += 1;
    } else {
      entry.watchCount += 1;
    }
  };

  for (const g of games) {
    register(g.orderedBy, true, g.status);
  }
  for (const w of watchlist) {
    register(w.orderedBy, false, w.status);
  }

  const out: OrdererStat[] = [];
  for (const [key, entry] of map.entries()) {
    let bestDisplay = key;
    let bestCnt = -1;
    for (const [variant, cnt] of entry.variants.entries()) {
      if (cnt > bestCnt) {
        bestCnt = cnt;
        bestDisplay = variant;
      }
    }
    if (key === 'стример') {
      bestDisplay = 'Стример';
    }
    out.push({
      key,
      display: bestDisplay,
      total: entry.total,
      gamesCount: entry.gamesCount,
      watchCount: entry.watchCount,
      completedGames: entry.completedGames,
      droppedGames: entry.droppedGames,
    });
  }

  return out.sort(
    (a, b) =>
      b.total - a.total ||
      b.gamesCount - a.gamesCount ||
      a.display.localeCompare(b.display, 'ru')
  );
}
