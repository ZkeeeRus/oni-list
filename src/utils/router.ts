import { NavTab } from '../views/HubView';
import { SettingsTabId } from '../components/SiteSettingsModal';

export type EditorModalTag = 'game' | 'watch' | 'backlog' | 'meme' | 'account';

export interface RouteState {
  tab: NavTab;
  gameStatus: string;
  gameOrderer: string;
  watchCat: string;
  watchOrderer: string;
  tierBoard: string;
  backlogStatus: string;
  inspectGameId: string | null;
  inspectWatchId: string | null;
  inspectBacklogId: string | null;
  memeId: string | null;
  settingsTab: SettingsTabId | null;
  editorModal: EditorModalTag | null;
}

export const DEFAULT_ROUTE: RouteState = {
  tab: 'hub',
  gameStatus: 'ALL',
  gameOrderer: '',
  watchCat: 'ALL',
  watchOrderer: '',
  tierBoard: 'AUTO_GAMES',
  backlogStatus: 'ALL',
  inspectGameId: null,
  inspectWatchId: null,
  inspectBacklogId: null,
  memeId: null,
  settingsTab: null,
  editorModal: null,
};

const VALID_TABS = new Set<NavTab>([
  'hub',
  'games',
  'watchlist',
  'tierlist',
  'backlog',
  'stats',
  'rules',
]);

const VALID_SETTINGS = new Set<SettingsTabId>([
  'appearance',
  'sound',
  'perf',
  'privacy',
  'admin',
  'credits',
]);

const VALID_EDITORS = new Set<EditorModalTag>([
  'game',
  'watch',
  'backlog',
  'meme',
  'account',
]);

const TAB_TITLES: Record<NavTab, string> = {
  hub: 'OniZeD Hub',
  games: 'Список игр - OniZeD Hub',
  watchlist: 'Просмотровое - OniZeD Hub',
  tierlist: 'Тир-листы - OniZeD Hub',
  backlog: 'Бэклог - OniZeD Hub',
  stats: 'Рулетка и Стата - OniZeD Hub',
  rules: 'Правила и оценки - OniZeD Hub',
};

export function isTwitchOAuthHash(hash: string): boolean {
  if (!hash) return false;
  return (
    hash.includes('access_token=') ||
    hash.includes('id_token=') ||
    hash.includes('error_description=')
  );
}

export function hasAnyOverlay(r: RouteState): boolean {
  return Boolean(
    r.inspectGameId ||
      r.inspectWatchId ||
      r.inspectBacklogId ||
      r.memeId ||
      r.settingsTab ||
      r.editorModal
  );
}

export function stripOverlays(r: RouteState): RouteState {
  return {
    ...r,
    inspectGameId: null,
    inspectWatchId: null,
    inspectBacklogId: null,
    memeId: null,
    settingsTab: null,
    editorModal: null,
  };
}

export function parseRouteFromHash(rawHash: string): RouteState {
  if (!rawHash || isTwitchOAuthHash(rawHash)) {
    return { ...DEFAULT_ROUTE };
  }

  const trimmed = rawHash.replace(/^#\/?/, '').trim();
  if (!trimmed) {
    return { ...DEFAULT_ROUTE };
  }

  const qPos = trimmed.indexOf('?');
  const rawTab = (qPos >= 0 ? trimmed.slice(0, qPos) : trimmed)
    .replace(/\/+$/, '')
    .toLowerCase();
  const rawQuery = qPos >= 0 ? trimmed.slice(qPos + 1) : '';

  const tab: NavTab = VALID_TABS.has(rawTab as NavTab)
    ? (rawTab as NavTab)
    : 'hub';

  const params = new URLSearchParams(rawQuery);
  const statusParam = params.get('status') || '';
  const ordererParam = params.get('orderer') || '';
  const catParam = params.get('cat') || '';
  const boardParam = params.get('board') || '';

  const rawSettings = params.get('settings') || '';
  const settingsTab: SettingsTabId | null = VALID_SETTINGS.has(
    rawSettings as SettingsTabId
  )
    ? (rawSettings as SettingsTabId)
    : null;

  const rawEditor = params.get('editor') || '';
  const editorModal: EditorModalTag | null = VALID_EDITORS.has(
    rawEditor as EditorModalTag
  )
    ? (rawEditor as EditorModalTag)
    : null;

  return {
    tab,
    gameStatus: tab === 'games' && statusParam ? statusParam : 'ALL',
    gameOrderer: tab === 'games' ? ordererParam : '',
    watchCat: tab === 'watchlist' && catParam ? catParam : 'ALL',
    watchOrderer: tab === 'watchlist' ? ordererParam : '',
    tierBoard: tab === 'tierlist' && boardParam ? boardParam : 'AUTO_GAMES',
    backlogStatus: tab === 'backlog' && statusParam ? statusParam : 'ALL',
    inspectGameId: params.get('game') || null,
    inspectWatchId: params.get('watch') || null,
    inspectBacklogId: params.get('backlog') || null,
    memeId: params.get('meme') || null,
    settingsTab,
    editorModal,
  };
}

export function buildHashFromRoute(r: RouteState): string {
  const params = new URLSearchParams();

  if (r.tab === 'games') {
    if (r.gameStatus && r.gameStatus !== 'ALL') {
      params.set('status', r.gameStatus);
    }
    if (r.gameOrderer) {
      params.set('orderer', r.gameOrderer);
    }
  } else if (r.tab === 'watchlist') {
    if (r.watchCat && r.watchCat !== 'ALL') {
      params.set('cat', r.watchCat);
    }
    if (r.watchOrderer) {
      params.set('orderer', r.watchOrderer);
    }
  } else if (r.tab === 'tierlist') {
    if (r.tierBoard && r.tierBoard !== 'AUTO_GAMES') {
      params.set('board', r.tierBoard);
    }
  } else if (r.tab === 'backlog') {
    if (r.backlogStatus && r.backlogStatus !== 'ALL') {
      params.set('status', r.backlogStatus);
    }
  }

  if (r.inspectGameId) params.set('game', r.inspectGameId);
  if (r.inspectWatchId) params.set('watch', r.inspectWatchId);
  if (r.inspectBacklogId) params.set('backlog', r.inspectBacklogId);
  if (r.memeId) params.set('meme', r.memeId);
  if (r.settingsTab) params.set('settings', r.settingsTab);
  if (r.editorModal) params.set('editor', r.editorModal);

  const qs = params.toString();
  if (r.tab === 'hub' && !qs) {
    return '';
  }
  return qs ? `#${r.tab}?${qs}` : `#${r.tab}`;
}

export function getTabHref(tab: NavTab): string {
  return tab === 'hub' ? '#hub' : `#${tab}`;
}

export function getDocumentTitleForRoute(r: RouteState): string {
  return TAB_TITLES[r.tab] || 'OniZeD Hub';
}

function buildFullUrlWithHash(hash: string): string {
  const base = `${window.location.pathname}${window.location.search}`;
  return hash ? `${base}${hash}` : base;
}

// Стек хэшей и скроллов текущей сессии для предсказуемой работы кнопки «Назад»
let currentHistoryIdx = 0;
const sessionHashes: string[] = [''];
const scrollPositions = new Map<number, number>();

export function initRouterHistory(): RouteState {
  if (isTwitchOAuthHash(window.location.hash)) {
    return { ...DEFAULT_ROUTE };
  }

  const parsed = parseRouteFromHash(window.location.hash);
  const fullHash = buildHashFromRoute(parsed);
  const existingState = window.history.state;

  if (existingState && existingState.oniHub === true && typeof existingState.idx === 'number') {
    currentHistoryIdx = existingState.idx;
    sessionHashes[currentHistoryIdx] = fullHash;
  } else if (hasAnyOverlay(parsed)) {
    // Если открыли прямую ссылку сразу на карточку/модалку - кладем под нее базовый раздел (и главную хаба), чтобы «Назад» закрывал карточку, а не выкидывал с сайта
    const baseRoute = stripOverlays(parsed);
    const baseHash = buildHashFromRoute(baseRoute);
    if (baseRoute.tab !== 'hub') {
      sessionHashes[0] = '';
      window.history.replaceState(
        { oniHub: true, idx: 0 },
        '',
        buildFullUrlWithHash('')
      );
      sessionHashes[1] = baseHash;
      window.history.pushState(
        { oniHub: true, idx: 1 },
        '',
        buildFullUrlWithHash(baseHash)
      );
      currentHistoryIdx = 2;
      sessionHashes[2] = fullHash;
      window.history.pushState(
        { oniHub: true, idx: 2 },
        '',
        buildFullUrlWithHash(fullHash)
      );
    } else {
      sessionHashes[0] = baseHash;
      window.history.replaceState(
        { oniHub: true, idx: 0 },
        '',
        buildFullUrlWithHash(baseHash)
      );
      currentHistoryIdx = 1;
      sessionHashes[1] = fullHash;
      window.history.pushState(
        { oniHub: true, idx: 1 },
        '',
        buildFullUrlWithHash(fullHash)
      );
    }
  } else if (parsed.tab !== 'hub') {
    // Если зашли по прямой ссылке сразу на #games / #watchlist - кладем под нее #hub, чтобы кнопка «Назад» возвращала на главную хаба, а не выбрасывала с сайта
    sessionHashes[0] = '';
    window.history.replaceState(
      { oniHub: true, idx: 0 },
      '',
      buildFullUrlWithHash('')
    );
    currentHistoryIdx = 1;
    sessionHashes[1] = fullHash;
    window.history.pushState(
      { oniHub: true, idx: 1 },
      '',
      buildFullUrlWithHash(fullHash)
    );
  } else {
    currentHistoryIdx = 0;
    sessionHashes[0] = fullHash;
    window.history.replaceState(
      { oniHub: true, idx: 0 },
      '',
      buildFullUrlWithHash(fullHash)
    );
  }

  document.title = getDocumentTitleForRoute(parsed);
  return parsed;
}

export function commitRouteNavigation(
  next: RouteState,
  options?: { replace?: boolean; scrollTop?: boolean }
): void {
  const nextHash = buildHashFromRoute(next);
  const curHash = sessionHashes[currentHistoryIdx] ?? buildHashFromRoute(parseRouteFromHash(window.location.hash));

  scrollPositions.set(currentHistoryIdx, window.scrollY || 0);
  document.title = getDocumentTitleForRoute(next);

  if (nextHash === curHash) {
    if (options?.scrollTop) {
      window.scrollTo(0, 0);
    }
    return;
  }

  const targetUrl = buildFullUrlWithHash(nextHash);
  if (options?.replace) {
    sessionHashes[currentHistoryIdx] = nextHash;
    window.history.replaceState(
      { oniHub: true, idx: currentHistoryIdx },
      '',
      targetUrl
    );
  } else {
    currentHistoryIdx += 1;
    sessionHashes.length = currentHistoryIdx;
    sessionHashes[currentHistoryIdx] = nextHash;
    window.history.pushState(
      { oniHub: true, idx: currentHistoryIdx },
      '',
      targetUrl
    );
  }

  if (options?.scrollTop) {
    window.scrollTo(0, 0);
  }
}

/**
 * Закрытие модалки крестиком / кликом по фону / клавишей Esc:
 * если предыдущий шаг в истории ровно соответствует маршруту без этой модалки - делаем history.back(),
 * чтобы в истории не оставалось закрытых фантомных окон; иначе делаем replaceState.
 */
export function canStepBackToRoute(target: RouteState): boolean {
  const targetHash = buildHashFromRoute(target);
  return currentHistoryIdx > 0 && sessionHashes[currentHistoryIdx - 1] === targetHash;
}

export function handleBrowserPopState(stateObj: any): {
  route: RouteState;
  restoredScrollY: number | null;
} {
  const parsed = parseRouteFromHash(window.location.hash);
  const hash = buildHashFromRoute(parsed);

  let savedY: number | null = null;
  if (stateObj && stateObj.oniHub === true && typeof stateObj.idx === 'number') {
    currentHistoryIdx = stateObj.idx;
    sessionHashes[currentHistoryIdx] = hash;
    if (scrollPositions.has(currentHistoryIdx)) {
      savedY = scrollPositions.get(currentHistoryIdx) ?? null;
    }
  } else {
    sessionHashes[currentHistoryIdx] = hash;
  }

  document.title = getDocumentTitleForRoute(parsed);
  return { route: parsed, restoredScrollY: savedY };
}
