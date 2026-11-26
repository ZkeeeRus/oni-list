import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Dices,
  Film,
  Gamepad2,
  Home,
  Layers,
  ListTodo,
  LogIn,
  Redo2,
  Settings,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import {
  BacklogItem,
  GameItem,
  MemeItem,
  RuntimeConfig,
  SiteData,
  TwitchUser,
  WatchItem,
} from './types';
import {
  clearTwitchSession,
  DEFAULT_API_BASE_URL,
  DEFAULT_TWITCH_CLIENT_ID,
  getUserRole,
  initTwitchSession,
  loadInitialSiteData,
  loadRuntimeConfig,
  logTwitchAuthEvent,
  PERMANENT_ADMINS,
  PersistOptions,
  persistSiteData,
  pollRemoteStateIfChanged,
  startTwitchOAuth,
} from './services/authAndStorage';
import { HubView, NavTab } from './views/HubView';
import { GamesView } from './views/GamesView';
import { WatchlistView } from './views/WatchlistView';
import { TierListView } from './views/TierListView';
import { BacklogView } from './views/BacklogView';
import { StatsRandomizerView } from './views/StatsRandomizerView';
import { RulesView } from './views/RulesView';
import {
  AdminSettingsModal,
  BacklogModal,
  GameModal,
  MemeLightbox,
  MemeModal,
  WatchModal,
} from './components/Modals';
import {
  BacklogDetailModal,
  GameDetailModal,
  WatchDetailModal,
} from './components/DetailModals';
import { collectOrdererStats } from './utils/orderers';
import { loadGameMetaMap } from './utils/gameMeta';
import {
  isHolidayActive,
  loadCustomWallpaper,
  loadUserPreferences,
  saveCustomWallpaper,
  saveUserPreferences,
  UserPreferences,
} from './utils/preferences';
import { playUiClick } from './utils/soundEffects';
import {
  FestiveFooter,
  HeaderGarland,
  SnowAndParallaxLayer,
} from './components/FestiveEffects';
import { SettingsTabId, SiteSettingsModal } from './components/SiteSettingsModal';
import { CookieBanner } from './components/CookieBanner';
import {
  flushTelemetry,
  initTelemetrySession,
  loadPrivacyPrefs,
  savePrivacyPrefs,
  TelemetryPrivacyPrefs,
  trackSiteAction,
  trackTabView,
  updateTelemetryAuthState,
} from './utils/analytics';
import {
  buildHashFromRoute,
  canStepBackToRoute,
  commitRouteNavigation,
  getTabHref,
  handleBrowserPopState,
  initRouterHistory,
  isTwitchOAuthHash,
  parseRouteFromHash,
  RouteState,
  stripOverlays,
} from './utils/router';

export const App: React.FC = () => {
  const [cfg, setCfg] = useState<RuntimeConfig>({
    apiBaseUrl: DEFAULT_API_BASE_URL,
    twitchClientId: DEFAULT_TWITCH_CLIENT_ID,
    rootAdmins: PERMANENT_ADMINS,
  });
  const [data, setData] = useState<SiteData | null>(null);
  const [dataSource, setDataSource] = useState<'remote' | 'local' | 'seed'>('seed');
  const [user, setUser] = useState<TwitchUser | null>(null);

  // Единое состояние маршрута (#games, #watchlist, теги статусов/категорий и открытые окна)
  const [route, setRoute] = useState<RouteState>(() => initRouterHistory());
  const routeRef = useRef<RouteState>(route);
  routeRef.current = route;

  const [toast, setToast] = useState<{ text: string; canUndo?: boolean } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Undo / Redo history stack
  const [undoStack, setUndoStack] = useState<Array<{ snapshot: SiteData; label: string }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ snapshot: SiteData; label: string }>>([]);
  const [pendingCloudMigration, setPendingCloudMigration] = useState(false);

  // Локальные черновики форм редактора (само открытие/закрытие синхронизировано с историей браузера)
  const [gameModalItem, setGameModalItem] = useState<GameItem | null | undefined>(
    undefined
  );
  const [watchModalItem, setWatchModalItem] = useState<WatchItem | null | undefined>(
    undefined
  );
  const [backlogModalItem, setBacklogModalItem] = useState<
    BacklogItem | null | undefined
  >(undefined);
  const [memeModalTarget, setMemeModalTarget] = useState<
    { type: 'watch' | 'game' | 'general'; id: string; title: string } | null | undefined
  >(undefined);
  const [editingMeme, setEditingMeme] = useState<MemeItem | null>(null);
  const [lightboxMemeFallback, setLightboxMemeFallback] = useState<MemeItem | null>(
    null
  );
  const [viewerAccountOpen, setViewerAccountOpen] = useState(false);

  const [prefs, setPrefs] = useState<UserPreferences>(() => loadUserPreferences());
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string>('');
  const [privacyPrefs, setPrivacyPrefs] = useState<TelemetryPrivacyPrefs>(() =>
    loadPrivacyPrefs()
  );

  // Навигация с записью шага в историю браузера (кнопки Назад / Вперед)
  const navigateRoute = useCallback(
    (
      updater: (prev: RouteState) => RouteState,
      options?: { replace?: boolean; scrollTop?: boolean }
    ) => {
      const next = updater(routeRef.current);
      routeRef.current = next;
      commitRouteNavigation(next, options);
      setRoute(next);
    },
    []
  );

  // Закрытие модального окна: если предыдущая запись истории - эта же страница без модалки, делаем history.back()
  const closeOverlayRoute = useCallback(
    (updater: (prev: RouteState) => RouteState) => {
      const target = updater(routeRef.current);
      if (canStepBackToRoute(target)) {
        window.history.back();
      } else {
        routeRef.current = target;
        commitRouteNavigation(target, { replace: true });
        setRoute(target);
      }
    },
    []
  );

  // Обработка кнопок браузера «Назад» / «Вперед» и свайпа назад на телефоне
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const prevTab = routeRef.current.tab;
      const { route: popped, restoredScrollY } = handleBrowserPopState(e.state);
      routeRef.current = popped;
      setRoute(popped);

      if (!popped.memeId) {
        setLightboxMemeFallback(null);
      }
      if (popped.editorModal !== 'game') {
        setGameModalItem(undefined);
      }
      if (popped.editorModal !== 'watch') {
        setWatchModalItem(undefined);
      }
      if (popped.editorModal !== 'backlog') {
        setBacklogModalItem(undefined);
      }
      if (popped.editorModal !== 'meme') {
        setMemeModalTarget(undefined);
        setEditingMeme(null);
      }
      if (popped.editorModal !== 'account') {
        setViewerAccountOpen(false);
      }

      if (popped.tab !== prevTab) {
        trackTabView(popped.tab);
        requestAnimationFrame(() => {
          window.scrollTo(0, restoredScrollY ?? 0);
        });
      }
    };

    const onHashChange = () => {
      if (isTwitchOAuthHash(window.location.hash)) return;
      const expectedHash = buildHashFromRoute(routeRef.current);
      const actualParsed = parseRouteFromHash(window.location.hash);
      const actualCanonical = buildHashFromRoute(actualParsed);
      if (actualCanonical !== expectedHash) {
        const prevTab = routeRef.current.tab;
        routeRef.current = actualParsed;
        setRoute(actualParsed);
        if (actualParsed.tab !== prevTab) {
          trackTabView(actualParsed.tab);
          window.scrollTo(0, 0);
        }
      }
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  useEffect(() => {
    loadCustomWallpaper().then((saved) => {
      if (saved) setCustomWallpaperUrl(saved);
    });
  }, []);

  const handleChangeCustomWallpaper = useCallback((urlOrData: string) => {
    setCustomWallpaperUrl(urlOrData);
    saveCustomWallpaper(urlOrData);
  }, []);

  const handleApplyPrivacy = useCallback((next: TelemetryPrivacyPrefs) => {
    const saved = savePrivacyPrefs(next);
    setPrivacyPrefs(saved);
    if (
      saved.allowVisitorCookie ||
      saved.allowTabStats ||
      saved.allowActionStats ||
      saved.allowDeviceAndRef
    ) {
      flushTelemetry(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.dataset.mode = prefs.colorMode;
    document.documentElement.dataset.perf = prefs.performanceMode;
    document.documentElement.dataset.holiday = isHolidayActive(prefs)
      ? 'true'
      : 'false';
  }, [prefs]);

  const role = getUserRole(user, data, cfg);
  const canEdit = role === 'admin' || role === 'moderator';

  const activeTab = route.tab;
  const inspectGameId = route.inspectGameId;
  const inspectWatchId = route.inspectWatchId;
  const inspectBacklogId = route.inspectBacklogId;
  const siteSettingsTab =
    route.settingsTab === 'admin' && !canEdit ? 'appearance' : route.settingsTab;

  const activeLightboxMeme = useMemo(() => {
    if (route.memeId && data) {
      const found = data.memes.find((m) => m.id === route.memeId);
      if (found) return found;
    }
    return route.memeId ? lightboxMemeFallback : null;
  }, [route.memeId, data, lightboxMemeFallback]);

  // Блокировка прокрутки основного окна колесиком при открытии любого модального окна
  const anyModalOpen =
    inspectGameId !== null ||
    inspectWatchId !== null ||
    inspectBacklogId !== null ||
    gameModalItem !== undefined ||
    watchModalItem !== undefined ||
    backlogModalItem !== undefined ||
    memeModalTarget !== undefined ||
    editingMeme !== null ||
    activeLightboxMeme !== null ||
    viewerAccountOpen ||
    siteSettingsTab !== null;

  useEffect(() => {
    if (!anyModalOpen) return;
    const scrollbarW =
      window.innerWidth - document.documentElement.clientWidth;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (scrollbarW > 0) {
      document.body.style.paddingRight = `${scrollbarW}px`;
    }

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [anyModalOpen]);

  // Закрытие верхнего открытого модального окна по клавише Escape
  useEffect(() => {
    if (!anyModalOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (routeRef.current.memeId) {
        setLightboxMemeFallback(null);
        closeOverlayRoute((r) => ({ ...r, memeId: null }));
        return;
      }
      if (
        gameModalItem !== undefined ||
        watchModalItem !== undefined ||
        backlogModalItem !== undefined ||
        memeModalTarget !== undefined ||
        editingMeme !== null ||
        viewerAccountOpen
      ) {
        setGameModalItem(undefined);
        setWatchModalItem(undefined);
        setBacklogModalItem(undefined);
        setMemeModalTarget(undefined);
        setEditingMeme(null);
        setViewerAccountOpen(false);
        if (routeRef.current.editorModal) {
          closeOverlayRoute((r) => ({ ...r, editorModal: null }));
        }
        return;
      }
      if (routeRef.current.settingsTab !== null) {
        closeOverlayRoute((r) => ({ ...r, settingsTab: null }));
        return;
      }
      if (
        routeRef.current.inspectGameId ||
        routeRef.current.inspectWatchId ||
        routeRef.current.inspectBacklogId
      ) {
        closeOverlayRoute((r) => ({
          ...r,
          inspectGameId: null,
          inspectWatchId: null,
          inspectBacklogId: null,
        }));
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [
    anyModalOpen,
    gameModalItem,
    watchModalItem,
    backlogModalItem,
    memeModalTarget,
    editingMeme,
    viewerAccountOpen,
    closeOverlayRoute,
  ]);

  const handleUpdatePrefs = useCallback((next: UserPreferences) => {
    setPrefs(next);
    saveUserPreferences(next);
  }, []);

  const showToast = useCallback((text: string, canUndo = false) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ text, canUndo });
    toastTimerRef.current = window.setTimeout(
      () => {
        setToast((prev) => (prev?.text === text ? null : prev));
      },
      canUndo ? 6500 : 3200
    );
  }, []);

  useEffect(() => {
    const hadOAuthHash = isTwitchOAuthHash(window.location.hash);
    loadGameMetaMap();
    (async () => {
      const loadedCfg = await loadRuntimeConfig();
      setCfg(loadedCfg);
      const [loadedData, twitchSession] = await Promise.all([
        loadInitialSiteData(loadedCfg.apiBaseUrl),
        initTwitchSession(loadedCfg.twitchClientId),
      ]);
      setData(loadedData.data);
      setDataSource(loadedData.source);
      if (loadedData.needsMigration) {
        setPendingCloudMigration(true);
      }
      setUser(twitchSession.user);

      let activeInitialTab = routeRef.current.tab;
      if (hadOAuthHash) {
        const restored = initRouterHistory();
        routeRef.current = restored;
        setRoute(restored);
        activeInitialTab = restored.tab;
      }

      initTelemetrySession(loadedCfg.apiBaseUrl, Boolean(twitchSession.user));
      if (activeInitialTab !== 'hub') {
        trackTabView(activeInitialTab);
      }

      if (twitchSession.user) {
        logTwitchAuthEvent(
          twitchSession.user,
          loadedCfg.apiBaseUrl,
          Boolean(twitchSession.justLoggedIn)
        );
      }
      if (twitchSession.justLoggedIn && twitchSession.user) {
        const loggedRole = getUserRole(twitchSession.user, loadedData.data, loadedCfg);
        if (loggedRole === 'admin' || loggedRole === 'moderator') {
          navigateRoute((r) => ({ ...r, settingsTab: 'admin' }));
        } else {
          setViewerAccountOpen(true);
          navigateRoute((r) => ({ ...r, editorModal: 'account' }));
        }
      }
    })();
  }, [navigateRoute]);

  // Auto-persist one-time migration (inline WebP memes + normalized orderer names) into cloud
  useEffect(() => {
    if (
      data &&
      pendingCloudMigration &&
      canEdit &&
      user &&
      !user.isPreview &&
      user.accessToken &&
      cfg.apiBaseUrl
    ) {
      setPendingCloudMigration(false);
      persistSiteData(data, cfg.apiBaseUrl, user).then((res) => {
        if (res.savedRemote) {
          setDataSource('remote');
        }
      });
    }
  }, [data, pendingCloudMigration, canEdit, user, cfg.apiBaseUrl]);

  const isDataLoaded = data !== null;

  // Бесшумное фоновое автообновление списка для зрителей и модераторов без перезагрузки страницы
  useEffect(() => {
    if (!isDataLoaded || !cfg.apiBaseUrl) return;

    let cancelled = false;
    let timerId: number | null = null;
    let lastCheckedAt = Date.now();
    let currentIntervalMs = 25000;

    const scheduleNext = (delayMs: number) => {
      if (cancelled) return;
      if (timerId !== null) window.clearTimeout(timerId);
      timerId = window.setTimeout(runPoll, delayMs);
    };

    const runPoll = async () => {
      if (cancelled) return;
      if (document.hidden) {
        scheduleNext(currentIntervalMs);
        return;
      }
      lastCheckedAt = Date.now();
      const res = await pollRemoteStateIfChanged(cfg.apiBaseUrl);
      if (cancelled) return;

      // Пока на сервере крутится старый index.js - опрашиваем раз в 45 сек; с новым ping (~65 байт) - раз в 25 сек
      currentIntervalMs = res.legacyMode ? 45000 : 25000;

      if (res.changed && res.data) {
        setData(res.data);
        setDataSource('remote');
      }
      scheduleNext(currentIntervalMs);
    };

    const handleVisibilityOrFocus = () => {
      if (cancelled || document.hidden) return;
      if (Date.now() - lastCheckedAt >= 12000) {
        runPoll();
      }
    };

    scheduleNext(currentIntervalMs);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isDataLoaded, cfg.apiBaseUrl]);

  useEffect(() => {
    updateTelemetryAuthState(Boolean(user));
  }, [user]);

  useEffect(() => {
    if (inspectGameId || inspectWatchId || inspectBacklogId) {
      trackSiteAction('card_open');
    }
  }, [inspectGameId, inspectWatchId, inspectBacklogId]);

  const commitData = async (
    next: SiteData,
    message?: string,
    options?: PersistOptions
  ) => {
    if (data) {
      setUndoStack((prev) => [
        ...prev.slice(-24),
        { snapshot: data, label: message || 'Изменение' },
      ]);
      setRedoStack([]);
    }
    setData(next);
    const res = await persistSiteData(next, cfg.apiBaseUrl, user, options);
    if (res.savedRemote) {
      setDataSource('remote');
      showToast(message || 'Сохранено в облачную БД', true);
    } else if (res.error) {
      showToast(res.error, !res.conflict);
    } else {
      setDataSource('local');
      showToast(`${message || 'Сохранено'} (черновик в браузере)`, true);
    }
  };

  const handleUndo = useCallback(async () => {
    if (!data || undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev.slice(-24), { snapshot: data, label: last.label }]);
    setData(last.snapshot);
    const res = await persistSiteData(last.snapshot, cfg.apiBaseUrl, user);
    if (res.savedRemote) {
      setDataSource('remote');
    }
    showToast(`Отменено: ${last.label}`, false);
  }, [data, undoStack, cfg.apiBaseUrl, user, showToast]);

  const handleRedo = useCallback(async () => {
    if (!data || redoStack.length === 0) return;
    const nextEntry = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [
      ...prev.slice(-24),
      { snapshot: data, label: nextEntry.label },
    ]);
    setData(nextEntry.snapshot);
    const res = await persistSiteData(nextEntry.snapshot, cfg.apiBaseUrl, user);
    if (res.savedRemote) {
      setDataSource('remote');
    }
    showToast(`Возвращено: ${nextEntry.label}`, false);
  }, [data, redoStack, cfg.apiBaseUrl, user, showToast]);

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y support outside text inputs
  useEffect(() => {
    if (!canEdit) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable)
      ) {
        return;
      }
      if (e.code === 'KeyZ' && !e.shiftKey) {
        if (undoStack.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY') {
        if (redoStack.length > 0) {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit, undoStack.length, redoStack.length, handleUndo, handleRedo]);

  const inspectedGame = useMemo(
    () => (inspectGameId && data ? data.games.find((g) => g.id === inspectGameId) || null : null),
    [inspectGameId, data]
  );

  const inspectedWatch = useMemo(
    () =>
      inspectWatchId && data
        ? data.watchlist.find((w) => w.id === inspectWatchId) || null
        : null,
    [inspectWatchId, data]
  );

  const inspectedBacklog = useMemo(
    () =>
      inspectBacklogId && data
        ? data.backlog.find((b) => b.id === inspectBacklogId) || null
        : null,
    [inspectBacklogId, data]
  );

  const allOrdererStats = useMemo(
    () => (data ? collectOrdererStats(data.games, data.watchlist) : []),
    [data]
  );

  // Стабильные ссылки на колбэки, чтобы открытие модалок/тостов не перерисовывало сетку игр
  const dataRef = useRef(data);
  dataRef.current = data;
  const commitDataRef = useRef(commitData);
  commitDataRef.current = commitData;

  const handleClearInitialOrderer = useCallback(() => {
    navigateRoute((r) => ({ ...r, gameOrderer: '' }), { replace: true });
  }, [navigateRoute]);

  const handleSelectGameStatusTag = useCallback(
    (status: string) => {
      navigateRoute((r) => ({ ...r, gameStatus: status || 'ALL' }));
    },
    [navigateRoute]
  );

  const handleSelectGameOrdererTag = useCallback(
    (orderer: string, pushHistory = false) => {
      navigateRoute(
        (r) => ({ ...r, gameOrderer: orderer }),
        { replace: !pushHistory }
      );
    },
    [navigateRoute]
  );

  const handleSelectWatchCatTag = useCallback(
    (cat: string) => {
      navigateRoute((r) => ({ ...r, watchCat: cat || 'ALL' }));
    },
    [navigateRoute]
  );

  const handleSelectWatchOrdererTag = useCallback(
    (orderer: string, pushHistory = false) => {
      navigateRoute(
        (r) => ({ ...r, watchOrderer: orderer }),
        { replace: !pushHistory }
      );
    },
    [navigateRoute]
  );

  const handleSelectTierBoardTag = useCallback(
    (boardId: string) => {
      navigateRoute((r) => ({ ...r, tierBoard: boardId || 'AUTO_GAMES' }));
    },
    [navigateRoute]
  );

  const handleSelectBacklogStatusTag = useCallback(
    (status: string) => {
      navigateRoute((r) => ({ ...r, backlogStatus: status || 'ALL' }));
    },
    [navigateRoute]
  );

  const handleOpenAddGame = useCallback(() => {
    setGameModalItem(null);
    navigateRoute((r) => ({ ...r, editorModal: 'game' }));
  }, [navigateRoute]);

  const handleInspectGame = useCallback(
    (id: string) => {
      navigateRoute((r) => ({
        ...r,
        inspectGameId: id,
        inspectWatchId: null,
        inspectBacklogId: null,
      }));
    },
    [navigateRoute]
  );

  const handleEditGame = useCallback(
    (g: GameItem) => {
      setGameModalItem(g);
      navigateRoute((r) => ({ ...r, editorModal: 'game' }));
    },
    [navigateRoute]
  );

  const handleDeleteGame = useCallback((id: string) => {
    const cur = dataRef.current;
    if (!cur) return;
    commitDataRef.current(
      { ...cur, games: cur.games.filter((x) => x.id !== id) },
      'Игра удалена'
    );
  }, []);

  const handleQuickUpdateGame = useCallback((updated: GameItem) => {
    const cur = dataRef.current;
    if (!cur) return;
    commitDataRef.current(
      {
        ...cur,
        games: cur.games.map((x) => (x.id === updated.id ? updated : x)),
      },
      'Статус/оценка обновлены'
    );
  }, []);

  const handleAddMemeForGame = useCallback(
    (g: GameItem) => {
      setMemeModalTarget({ type: 'game', id: g.id, title: g.title });
      navigateRoute((r) => ({ ...r, editorModal: 'meme' }));
    },
    [navigateRoute]
  );

  const handleOpenAddWatch = useCallback(() => {
    setWatchModalItem(null);
    navigateRoute((r) => ({ ...r, editorModal: 'watch' }));
  }, [navigateRoute]);

  const handleInspectWatch = useCallback(
    (id: string) => {
      navigateRoute((r) => ({
        ...r,
        inspectWatchId: id,
        inspectGameId: null,
        inspectBacklogId: null,
      }));
    },
    [navigateRoute]
  );

  const handleEditWatch = useCallback(
    (w: WatchItem) => {
      setWatchModalItem(w);
      navigateRoute((r) => ({ ...r, editorModal: 'watch' }));
    },
    [navigateRoute]
  );

  const handleDeleteWatch = useCallback((id: string) => {
    const cur = dataRef.current;
    if (!cur) return;
    commitDataRef.current(
      { ...cur, watchlist: cur.watchlist.filter((x) => x.id !== id) },
      'Тайтл удален'
    );
  }, []);

  const handleInspectBacklog = useCallback(
    (id: string) => {
      navigateRoute((r) => ({
        ...r,
        inspectBacklogId: id,
        inspectGameId: null,
        inspectWatchId: null,
      }));
    },
    [navigateRoute]
  );

  const handleOpenAddBacklog = useCallback(() => {
    setBacklogModalItem(null);
    navigateRoute((r) => ({ ...r, editorModal: 'backlog' }));
  }, [navigateRoute]);

  const handleEditBacklog = useCallback(
    (b: BacklogItem) => {
      setBacklogModalItem(b);
      navigateRoute((r) => ({ ...r, editorModal: 'backlog' }));
    },
    [navigateRoute]
  );

  const handleOpenMemeForTarget = useCallback(
    (target: { type: 'watch' | 'game' | 'general'; id: string; title: string }) => {
      setMemeModalTarget(target);
      navigateRoute((r) => ({ ...r, editorModal: 'meme' }));
    },
    [navigateRoute]
  );

  const handleViewMeme = useCallback(
    (m: MemeItem) => {
      setLightboxMemeFallback(m);
      navigateRoute((r) => ({ ...r, memeId: m.id }));
    },
    [navigateRoute]
  );

  const handleJumpToOrdererInGames = useCallback(
    (orderer: string) => {
      navigateRoute(
        (r) => ({
          ...stripOverlays(r),
          tab: 'games',
          gameStatus: 'ALL',
          gameOrderer: orderer,
        }),
        { scrollTop: true }
      );
      trackTabView('games');
    },
    [navigateRoute]
  );

  if (!data) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Загружаем список игр и просмотрового OniZeD...</p>
      </div>
    );
  }

  const handleNavigate = (tab: NavTab) => {
    playUiClick(prefs);
    const prevTab = routeRef.current.tab;
    navigateRoute(
      (r) => ({
        ...stripOverlays(r),
        tab,
        // Повторный клик по уже открытой вкладке сбрасывает ее быстрые теги к дефолту
        ...(prevTab === tab && tab === 'games'
          ? { gameStatus: 'ALL', gameOrderer: '' }
          : {}),
        ...(prevTab === tab && tab === 'watchlist'
          ? { watchCat: 'ALL', watchOrderer: '' }
          : {}),
        ...(prevTab === tab && tab === 'backlog'
          ? { backlogStatus: 'ALL' }
          : {}),
      }),
      { scrollTop: true }
    );
    if (prevTab !== tab) {
      trackTabView(tab);
    }
  };

  const onNavAnchorClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    tab: NavTab
  ) => {
    if (
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return; // Разрешаем открытие в новой вкладке колесиком мыши / Ctrl+кликом
    }
    e.preventDefault();
    handleNavigate(tab);
  };

  const handlePromoteBacklog = (b: BacklogItem) => {
    const promoted: GameItem = {
      id: `game-${Date.now()}`,
      title: b.title,
      orderedBy: 'Стример',
      status: 'В процессе',
      rating: '',
      conditions: b.idea,
      comment: b.notes,
      dropPrice: '',
      returnPrice: '',
      link: b.link,
      vodUrl: '',
      hours: '',
      coverUrl: b.coverUrl,
      steamAppId: b.steamAppId ?? null,
    };
    commitData(
      {
        ...data,
        games: [promoted, ...data.games],
        backlog: data.backlog.filter((x) => x.id !== b.id),
      },
      `«${b.title}» перенесена в Список игр («В процессе»)!`
    );
  };

  return (
    <div className="app-shell">
      <SnowAndParallaxLayer prefs={prefs} customWallpaperUrl={customWallpaperUrl} />

      {/* Sticky Top Navbar */}
      <header className="top-nav">
        <div className="top-nav-inner">
          <a
            href="#hub"
            className="brand-btn"
            onClick={(e) => onNavAnchorClick(e, 'hub')}
          >
            <span className="brand-dot" />
            <strong>OniZeD</strong>
            <span className="brand-tag">HUB</span>
          </a>

          <nav className="nav-links">
            <a
              href={getTabHref('hub')}
              className={activeTab === 'hub' ? 'active' : ''}
              onClick={(e) => onNavAnchorClick(e, 'hub')}
            >
              <Home size={15} /> Хаб
            </a>
            <a
              href={getTabHref('games')}
              className={activeTab === 'games' ? 'active' : ''}
              onClick={(e) => onNavAnchorClick(e, 'games')}
            >
              <Gamepad2 size={15} /> Игры
              <span className="nav-count">{data.games.length}</span>
            </a>
            <a
              href={getTabHref('watchlist')}
              className={activeTab === 'watchlist' ? 'active' : ''}
              onClick={(e) => onNavAnchorClick(e, 'watchlist')}
            >
              <Film size={15} /> Просмотровое
              <span className="nav-count">{data.watchlist.length}</span>
            </a>
            <a
              href={getTabHref('tierlist')}
              className={activeTab === 'tierlist' ? 'active' : ''}
              onClick={(e) => onNavAnchorClick(e, 'tierlist')}
            >
              <Layers size={15} /> Тир-листы
            </a>
            <a
              href={getTabHref('backlog')}
              className={activeTab === 'backlog' ? 'active' : ''}
              onClick={(e) => onNavAnchorClick(e, 'backlog')}
            >
              <ListTodo size={15} /> Бэклог
              <span className="nav-count">{data.backlog.length}</span>
            </a>
            <a
              href={getTabHref('stats')}
              className={activeTab === 'stats' ? 'active' : ''}
              onClick={(e) => onNavAnchorClick(e, 'stats')}
            >
              <Dices size={15} /> Рулетка / Стата
            </a>
            <a
              href={getTabHref('rules')}
              className={activeTab === 'rules' ? 'active' : ''}
              onClick={(e) => onNavAnchorClick(e, 'rules')}
            >
              <BookOpen size={15} /> Правила
            </a>
          </nav>

          <div className="nav-right">
            {canEdit && undoStack.length > 0 && (
              <button
                type="button"
                className="undo-nav-btn"
                onClick={handleUndo}
                title={`Отменить: ${undoStack[undoStack.length - 1].label} (Ctrl+Z)`}
              >
                <Undo2 size={15} />
                <span className="undo-nav-label">Отменить</span>
              </button>
            )}
            {canEdit && redoStack.length > 0 && (
              <button
                type="button"
                className="undo-nav-btn redo-only"
                onClick={handleRedo}
                title={`Вернуть: ${redoStack[redoStack.length - 1].label} (Ctrl+Y)`}
              >
                <Redo2 size={15} />
              </button>
            )}
            <button
              type="button"
              className="settings-gear-btn"
              onClick={() => {
                playUiClick(prefs);
                navigateRoute((r) => ({ ...r, settingsTab: 'appearance' }));
              }}
              title="Настройки сайта: оформление, новогодний режим, звуки и производительность"
            >
              <Settings size={16} />
            </button>
            {user ? (
              <button
                type="button"
                className={`auth-pill ${canEdit ? 'is-mod' : ''}`}
                onClick={() => {
                  playUiClick(prefs);
                  if (canEdit) {
                    navigateRoute((r) => ({ ...r, settingsTab: 'admin' }));
                  } else {
                    setViewerAccountOpen(true);
                    navigateRoute((r) => ({ ...r, editorModal: 'account' }));
                  }
                }}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName} className="avatar-xs" />
                ) : (
                  <ShieldCheck size={15} />
                )}
                <span>{user.displayName}</span>
                {canEdit && (
                  <small className="role-tag">
                    {role === 'admin' ? 'АДМИН' : 'МОДЕР'}
                  </small>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-twitch auth-twitch-btn"
                onClick={() => startTwitchOAuth(cfg.twitchClientId || DEFAULT_TWITCH_CLIENT_ID)}
              >
                <LogIn size={15} />
                <span>Войти через Twitch</span>
              </button>
            )}
          </div>
        </div>
        <HeaderGarland prefs={prefs} onUpdatePrefs={handleUpdatePrefs} />
      </header>

      {/* Main Content */}
      <main className="main-container">
        {activeTab === 'hub' && (
          <HubView
            data={data}
            canEdit={canEdit}
            onNavigate={handleNavigate}
            onFilterByOrderer={handleJumpToOrdererInGames}
            onUpdateHubConfig={(hubConfig) =>
              commitData({ ...data, hubConfig }, 'Планы хаба обновлены')
            }
            onOpenAddGame={handleOpenAddGame}
            onOpenAddWatch={handleOpenAddWatch}
            onInspectGame={handleInspectGame}
            onInspectWatch={handleInspectWatch}
            onInspectBacklog={handleInspectBacklog}
          />
        )}

        {activeTab === 'games' && (
          <GamesView
            games={data.games}
            memes={data.memes}
            canEdit={canEdit}
            currentUser={user}
            statusTag={route.gameStatus}
            onSelectStatusTag={handleSelectGameStatusTag}
            initialOrdererFilter={route.gameOrderer}
            onSelectOrdererTag={handleSelectGameOrdererTag}
            onClearInitialOrderer={handleClearInitialOrderer}
            onAddGame={handleOpenAddGame}
            onInspectGame={handleInspectGame}
            onEditGame={handleEditGame}
            onDeleteGame={handleDeleteGame}
            onQuickUpdateGame={handleQuickUpdateGame}
            onAddMemeForGame={handleAddMemeForGame}
            onViewMeme={handleViewMeme}
          />
        )}

        {activeTab === 'watchlist' && (
          <WatchlistView
            watchlist={data.watchlist}
            memes={data.memes}
            canEdit={canEdit}
            currentUser={user}
            catTag={route.watchCat}
            onSelectCatTag={handleSelectWatchCatTag}
            ordererTag={route.watchOrderer}
            onSelectOrdererTag={handleSelectWatchOrdererTag}
            onAddWatch={handleOpenAddWatch}
            onInspectWatch={handleInspectWatch}
            onEditWatch={handleEditWatch}
            onDeleteWatch={handleDeleteWatch}
            onAddMeme={handleOpenMemeForTarget}
            onViewMeme={handleViewMeme}
          />
        )}

        {activeTab === 'tierlist' && (
          <TierListView
            games={data.games}
            watchlist={data.watchlist}
            ratingScale={data.ratingScale}
            customTierLists={data.customTierLists}
            tierItemOrder={data.tierItemOrder || {}}
            canEdit={canEdit}
            authorName={user?.displayName || 'OniZeD'}
            apiBaseUrl={cfg.apiBaseUrl}
            boardTag={route.tierBoard}
            onSelectBoardTag={handleSelectTierBoardTag}
            onMoveAutoTierItem={({
              itemId,
              itemKind,
              itemTitle,
              fromTier,
              toTier,
              nextTierOrder,
            }) => {
              const ratingChanged = fromTier !== toTier;
              const nextGames =
                ratingChanged && itemKind === 'game'
                  ? data.games.map((g) =>
                      g.id === itemId ? { ...g, rating: toTier } : g
                    )
                  : data.games;
              const nextWatch =
                ratingChanged && itemKind === 'watch'
                  ? data.watchlist.map((w) =>
                      w.id === itemId ? { ...w, rating: toTier } : w
                    )
                  : data.watchlist;
              const msg = ratingChanged
                ? toTier
                  ? `«${itemTitle}»: оценка изменена на «${toTier}»`
                  : `«${itemTitle}»: оценка снята`
                : `Порядок в тире «${toTier || 'Без оценки'}» обновлен`;

              commitData(
                {
                  ...data,
                  games: nextGames,
                  watchlist: nextWatch,
                  tierItemOrder: nextTierOrder,
                },
                msg
              );
            }}
            onSaveCustomTierLists={(lists) =>
              commitData({ ...data, customTierLists: lists }, 'Тир-лист сохранен')
            }
            onInspectGame={handleInspectGame}
            onInspectWatch={handleInspectWatch}
          />
        )}

        {activeTab === 'backlog' && (
          <BacklogView
            backlog={data.backlog}
            canEdit={canEdit}
            statusTag={route.backlogStatus}
            onSelectStatusTag={handleSelectBacklogStatusTag}
            onAddBacklog={handleOpenAddBacklog}
            onInspectBacklog={handleInspectBacklog}
            onEditBacklog={handleEditBacklog}
            onDeleteBacklog={(id) =>
              commitData(
                { ...data, backlog: data.backlog.filter((x) => x.id !== id) },
                'Идея удалена из бэклога'
              )
            }
            onPromoteToGame={handlePromoteBacklog}
          />
        )}

        {activeTab === 'stats' && (
          <StatsRandomizerView
            data={data}
            prefs={prefs}
            canEdit={canEdit}
            onUpdateGameStatus={(gameId, status) => {
              commitData(
                {
                  ...data,
                  games: data.games.map((g) =>
                    g.id === gameId ? { ...g, status } : g
                  ),
                },
                `Статус игры изменен на «${status}»`
              );
            }}
            onUpdateWatchStatus={(watchId, status) => {
              commitData(
                {
                  ...data,
                  watchlist: data.watchlist.map((w) =>
                    w.id === watchId ? { ...w, status } : w
                  ),
                },
                `Статус тайтла изменен на «${status}»`
              );
            }}
            onUpdateBacklogStatus={(backlogId, status) => {
              commitData(
                {
                  ...data,
                  backlog: data.backlog.map((b) =>
                    b.id === backlogId ? { ...b, status } : b
                  ),
                },
                `Статус бэклога изменен на «${status}»`
              );
            }}
            onPromoteBacklogToGame={handlePromoteBacklog}
            onInspectGame={handleInspectGame}
            onInspectWatch={handleInspectWatch}
            onInspectBacklog={handleInspectBacklog}
            onFilterByOrderer={handleJumpToOrdererInGames}
          />
        )}

        {activeTab === 'rules' && (
          <RulesView
            rules={data.rules}
            ratingScale={data.ratingScale}
            canEdit={canEdit}
            onSaveRules={(rules) =>
              commitData({ ...data, rules }, 'Свод правил обновлен')
            }
          />
        )}
      </main>

      {/* Global Detail Inspection Popups */}
      {inspectedGame && (
        <GameDetailModal
          game={inspectedGame}
          memes={data.memes.filter(
            (m) =>
              m.targetType === 'game' &&
              (m.targetId === inspectedGame.id ||
                (!m.targetId && m.targetTitle === inspectedGame.title))
          )}
          canEdit={canEdit}
          onClose={() =>
            closeOverlayRoute((r) => ({ ...r, inspectGameId: null }))
          }
          onEdit={handleEditGame}
          onQuickUpdate={(updated) =>
            commitData(
              {
                ...data,
                games: data.games.map((x) => (x.id === updated.id ? updated : x)),
              },
              'Игра обновлена'
            )
          }
          onViewMeme={handleViewMeme}
          onEditMeme={(m) => {
            setEditingMeme(m);
            navigateRoute((r) => ({ ...r, editorModal: 'meme' }));
          }}
          onFilterByOrderer={handleJumpToOrdererInGames}
        />
      )}

      {inspectedWatch && (
        <WatchDetailModal
          item={inspectedWatch}
          memes={data.memes.filter(
            (m) =>
              m.targetType === 'watch' &&
              (m.targetId === inspectedWatch.id ||
                (!m.targetId && m.targetTitle === inspectedWatch.title))
          )}
          canEdit={canEdit}
          onClose={() =>
            closeOverlayRoute((r) => ({ ...r, inspectWatchId: null }))
          }
          onEdit={handleEditWatch}
          onQuickUpdate={(updated) =>
            commitData(
              {
                ...data,
                watchlist: data.watchlist.map((x) =>
                  x.id === updated.id ? updated : x
                ),
              },
              'Тайтл обновлен'
            )
          }
          onViewMeme={handleViewMeme}
          onEditMeme={(m) => {
            setEditingMeme(m);
            navigateRoute((r) => ({ ...r, editorModal: 'meme' }));
          }}
        />
      )}

      {inspectedBacklog && (
        <BacklogDetailModal
          item={inspectedBacklog}
          canEdit={canEdit}
          onClose={() =>
            closeOverlayRoute((r) => ({ ...r, inspectBacklogId: null }))
          }
          onEdit={handleEditBacklog}
          onQuickUpdate={(updated) =>
            commitData(
              {
                ...data,
                backlog: data.backlog.map((x) =>
                  x.id === updated.id ? updated : x
                ),
              },
              'Идея бэклога обновлена'
            )
          }
          onPromoteToGame={handlePromoteBacklog}
        />
      )}

      {/* Add/Edit Modals */}
      {gameModalItem !== undefined && (
        <GameModal
          initial={gameModalItem}
          apiBaseUrl={cfg.apiBaseUrl}
          orderers={allOrdererStats}
          siteData={data}
          onClose={() => {
            setGameModalItem(undefined);
            if (routeRef.current.editorModal === 'game') {
              closeOverlayRoute((r) => ({ ...r, editorModal: null }));
            }
          }}
          onSave={(saved) => {
            const exists = data.games.some((x) => x.id === saved.id);
            const nextGames = exists
              ? data.games.map((x) => (x.id === saved.id ? saved : x))
              : [saved, ...data.games];
            commitData({ ...data, games: nextGames }, 'Игра сохранена');
            setGameModalItem(undefined);
            if (routeRef.current.editorModal === 'game') {
              closeOverlayRoute((r) => ({ ...r, editorModal: null }));
            }
          }}
          onDelete={(id) => {
            handleDeleteGame(id);
            setGameModalItem(undefined);
            navigateRoute(
              (r) => ({
                ...r,
                editorModal: null,
                inspectGameId: r.inspectGameId === id ? null : r.inspectGameId,
              }),
              { replace: true }
            );
          }}
          onAddMeme={(g) => {
            setGameModalItem(undefined);
            setMemeModalTarget({ type: 'game', id: g.id, title: g.title });
            navigateRoute((r) => ({ ...r, editorModal: 'meme' }), { replace: true });
          }}
        />
      )}

      {watchModalItem !== undefined && (
        <WatchModal
          initial={watchModalItem}
          apiBaseUrl={cfg.apiBaseUrl}
          orderers={allOrdererStats}
          siteData={data}
          onClose={() => {
            setWatchModalItem(undefined);
            if (routeRef.current.editorModal === 'watch') {
              closeOverlayRoute((r) => ({ ...r, editorModal: null }));
            }
          }}
          onSave={(saved) => {
            const exists = data.watchlist.some((x) => x.id === saved.id);
            const nextWatch = exists
              ? data.watchlist.map((x) => (x.id === saved.id ? saved : x))
              : [saved, ...data.watchlist];
            commitData({ ...data, watchlist: nextWatch }, 'Тайтл сохранен');
            setWatchModalItem(undefined);
            if (routeRef.current.editorModal === 'watch') {
              closeOverlayRoute((r) => ({ ...r, editorModal: null }));
            }
          }}
          onDelete={(id) => {
            handleDeleteWatch(id);
            setWatchModalItem(undefined);
            navigateRoute(
              (r) => ({
                ...r,
                editorModal: null,
                inspectWatchId: r.inspectWatchId === id ? null : r.inspectWatchId,
              }),
              { replace: true }
            );
          }}
          onAddMeme={(w) => {
            setWatchModalItem(undefined);
            setMemeModalTarget({ type: 'watch', id: w.id, title: w.title });
            navigateRoute((r) => ({ ...r, editorModal: 'meme' }), { replace: true });
          }}
        />
      )}

      {backlogModalItem !== undefined && (
        <BacklogModal
          initial={backlogModalItem}
          apiBaseUrl={cfg.apiBaseUrl}
          siteData={data}
          onClose={() => {
            setBacklogModalItem(undefined);
            if (routeRef.current.editorModal === 'backlog') {
              closeOverlayRoute((r) => ({ ...r, editorModal: null }));
            }
          }}
          onSave={(saved) => {
            const exists = data.backlog.some((x) => x.id === saved.id);
            const nextBacklog = exists
              ? data.backlog.map((x) => (x.id === saved.id ? saved : x))
              : [saved, ...data.backlog];
            commitData({ ...data, backlog: nextBacklog }, 'Бэклог обновлен');
            setBacklogModalItem(undefined);
            if (routeRef.current.editorModal === 'backlog') {
              closeOverlayRoute((r) => ({ ...r, editorModal: null }));
            }
          }}
          onDelete={(id) => {
            commitData(
              { ...data, backlog: data.backlog.filter((x) => x.id !== id) },
              'Идея удалена из бэклога'
            );
            setBacklogModalItem(undefined);
            navigateRoute(
              (r) => ({
                ...r,
                editorModal: null,
                inspectBacklogId: r.inspectBacklogId === id ? null : r.inspectBacklogId,
              }),
              { replace: true }
            );
          }}
        />
      )}

      {(memeModalTarget !== undefined || editingMeme !== null) && (
        <MemeModal
          watchlist={data.watchlist}
          games={data.games}
          preselectedTarget={memeModalTarget}
          initialMeme={editingMeme}
          authorName={user?.displayName || 'Стример'}
          onClose={() => {
            setMemeModalTarget(undefined);
            setEditingMeme(null);
            if (routeRef.current.editorModal === 'meme') {
              closeOverlayRoute((r) => ({ ...r, editorModal: null }));
            }
          }}
          onSave={(meme) => {
            const exists = data.memes.some((x) => x.id === meme.id);
            const nextMemes = exists
              ? data.memes.map((x) => (x.id === meme.id ? meme : x))
              : [meme, ...data.memes];
            commitData(
              { ...data, memes: nextMemes },
              exists ? 'Описание мема обновлено!' : 'Мем прикреплен!'
            );
            setMemeModalTarget(undefined);
            setEditingMeme(null);
            if (routeRef.current.editorModal === 'meme') {
              closeOverlayRoute((r) => ({ ...r, editorModal: null }));
            }
          }}
          onDelete={(id) => {
            commitData(
              { ...data, memes: data.memes.filter((m) => m.id !== id) },
              'Мем удален'
            );
            setMemeModalTarget(undefined);
            setEditingMeme(null);
            if (routeRef.current.memeId === id) {
              setLightboxMemeFallback(null);
            }
            navigateRoute(
              (r) => ({
                ...r,
                editorModal: null,
                memeId: r.memeId === id ? null : r.memeId,
              }),
              { replace: true }
            );
          }}
        />
      )}

      {activeLightboxMeme && (
        <MemeLightbox
          meme={activeLightboxMeme}
          canEdit={canEdit}
          onClose={() => {
            setLightboxMemeFallback(null);
            closeOverlayRoute((r) => ({ ...r, memeId: null }));
          }}
          onEdit={(m) => {
            setEditingMeme(m);
            navigateRoute((r) => ({ ...r, editorModal: 'meme' }));
          }}
        />
      )}

      {viewerAccountOpen && user && (
        <AdminSettingsModal
          user={user}
          onClose={() => {
            setViewerAccountOpen(false);
            if (routeRef.current.editorModal === 'account') {
              closeOverlayRoute((r) => ({ ...r, editorModal: null }));
            }
          }}
          onLogout={() => {
            clearTwitchSession();
            setUser(null);
            setViewerAccountOpen(false);
            if (routeRef.current.editorModal === 'account') {
              closeOverlayRoute((r) => ({ ...r, editorModal: null }));
            }
            showToast('Вы вышли из аккаунта');
          }}
        />
      )}

      {siteSettingsTab !== null && (
        <SiteSettingsModal
          initialTab={siteSettingsTab}
          onSelectTab={(nextTab) =>
            navigateRoute((r) => ({ ...r, settingsTab: nextTab }), {
              replace: true,
            })
          }
          prefs={prefs}
          onChangePrefs={handleUpdatePrefs}
          customWallpaperUrl={customWallpaperUrl}
          onChangeCustomWallpaper={handleChangeCustomWallpaper}
          privacyPrefs={privacyPrefs}
          onChangePrivacyPrefs={handleApplyPrivacy}
          user={user}
          role={role}
          apiBaseUrl={cfg.apiBaseUrl}
          data={data}
          dataSource={dataSource}
          onClose={() =>
            closeOverlayRoute((r) => ({ ...r, settingsTab: null }))
          }
          onLogout={() => {
            clearTwitchSession();
            setUser(null);
            showToast('Вы вышли из аккаунта');
          }}
          onUpdateModerators={(moderators) =>
            commitData({ ...data, moderators }, 'Список модераторов обновлен')
          }
          onImportJson={(imported) =>
            commitData(imported, 'Резервная копия успешно загружена!', {
              forceOverwrite: true,
              allowMassDelete: true,
            })
          }
          onRestoreCloudBackup={(restored) => {
            setData(restored);
            setDataSource('remote');
            showToast('База восстановлена из облачного снимка!', false);
          }}
          onForceCloudPush={() =>
            commitData(data, 'Все текущие данные отправлены в облако!', {
              forceOverwrite: true,
            })
          }
          onShowToast={(msg) => showToast(msg, false)}
        />
      )}

      <FestiveFooter
        prefs={prefs}
        onShowWish={(wish) => showToast(wish, false)}
      />

      <CookieBanner
        privacy={privacyPrefs}
        onApply={handleApplyPrivacy}
        onOpenCustomize={() =>
          navigateRoute((r) => ({ ...r, settingsTab: 'privacy' }))
        }
      />

      {toast && (
        <div className="toast-popup">
          <span>{toast.text}</span>
          {toast.canUndo && canEdit && undoStack.length > 0 && (
            <button type="button" className="toast-undo-btn" onClick={handleUndo}>
              <Undo2 size={14} /> Отменить
            </button>
          )}
        </div>
      )}
    </div>
  );
};
