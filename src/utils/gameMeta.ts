import { useEffect, useState } from 'react';
import { GameItem } from '../types';
import { extractSteamAppId } from './covers';

export interface GameMetaInfo {
  year?: number;
  genres?: string;
  dev?: string;
  steamScore?: number;
  estHours?: string;
  hltbId?: string;
  ru?: boolean;
}

export type GameMetaMap = Record<string, GameMetaInfo>;

let cachedMeta: GameMetaMap | null = null;
let pendingPromise: Promise<GameMetaMap> | null = null;

export function loadGameMetaMap(): Promise<GameMetaMap> {
  if (cachedMeta) return Promise.resolve(cachedMeta);
  if (!pendingPromise) {
    pendingPromise = fetch('./game-meta.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: GameMetaMap) => {
        cachedMeta = d || {};
        return cachedMeta;
      })
      .catch(() => {
        cachedMeta = {};
        return cachedMeta;
      });
  }
  return pendingPromise;
}

export function useGameMetaMap(): GameMetaMap {
  const [meta, setMeta] = useState<GameMetaMap>(cachedMeta || {});
  useEffect(() => {
    if (!cachedMeta) {
      loadGameMetaMap().then(setMeta);
    }
  }, []);
  return meta;
}

export function lookupGameMeta(
  game: Pick<GameItem, 'steamAppId' | 'link' | 'coverUrl'>,
  metaMap: GameMetaMap
): GameMetaInfo | undefined {
  const sid =
    game.steamAppId ||
    extractSteamAppId(game.link || '') ||
    extractSteamAppId(game.coverUrl || '');
  if (!sid) return undefined;
  return metaMap[String(sid)];
}

export function getGameSteamStoreUrl(
  game: Pick<GameItem, 'steamAppId' | 'link' | 'coverUrl'>
): string {
  if (game.link && game.link.includes('store.steampowered.com')) {
    return game.link;
  }
  const sid =
    game.steamAppId ||
    extractSteamAppId(game.link || '') ||
    extractSteamAppId(game.coverUrl || '');
  if (sid) {
    return `https://store.steampowered.com/app/${sid}/`;
  }
  return '';
}

export function getGameHltbUrl(
  title: string,
  meta?: GameMetaInfo
): string {
  if (meta?.hltbId) {
    return `https://howlongtobeat.com/game/${meta.hltbId}`;
  }
  const cleaned = title
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `https://howlongtobeat.com/?q=${encodeURIComponent(cleaned || title)}`;
}
