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

export const App: React.FC = () => {
  const [cfg, setCfg] = useState<RuntimeConfig>({
    apiBaseUrl: DEFAULT_API_BASE_URL,
    twitchClientId: DEFAULT_TWITCH_CLIENT_ID,
    rootAdmins: PERMANENT_ADMINS,
  });
  const [data, setData] = useState<SiteData | null>(null);
  const [dataSource, setDataSource] = useState<'remote' | 'local' | 'seed'>('seed');
  const [user, setUser] = useState<TwitchUser | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('hub');
  const [gamesOrdererPreset, setGamesOrdererPreset] = useState<string>('');
  const [toast, setToast] = useState<{ text: string; canUndo?: boolean } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Undo / Redo history stack
  const [undoStack, setUndoStack] = useState<Array<{ snapshot: SiteData; label: string }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ snapshot: SiteData; label: string }>>([]);
  const [pendingCloudMigration, setPendingCloudMigration] = useState(false);

  // Global Detail Inspection Modals (openable from ANY page!)
  const [inspectGameId, setInspectGameId] = useState<string | null>(null);
  const [inspectWatchId, setInspectWatchId] = useState<string | null>(null);
  const [inspectBacklogId, setInspectBacklogId] = useState<string | null>(null);

  // Add/Edit Modals state
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
  const [lightboxMeme, setLightboxMeme] = useState<MemeItem | null>(null);
  const [viewerAccountOpen, setViewerAccountOpen] = useState(false);
  const [siteSettingsTab, setSiteSettingsTab] = useState<SettingsTabId | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences>(() => loadUserPreferences());
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string>('');
  const [privacyPrefs, setPrivacyPrefs] = useState<TelemetryPrivacyPrefs>(() =>
    loadPrivacyPrefs()
  );

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
    lightboxMeme !== null ||
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
      initTelemetrySession(loadedCfg.apiBaseUrl, Boolean(twitchSession.user));
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
          setSiteSettingsTab('admin');
        } else {
          setViewerAccountOpen(true);
        }
      }
    })();
  }, []);

  const role = getUserRole(user, data, cfg);
  const canEdit = role === 'admin' || role === 'moderator';

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
    setActiveTab(tab);
    trackTabView(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          <button
            type="button"
            className="brand-btn"
            onClick={() => handleNavigate('hub')}
          >
            <span className="brand-dot" />
            <strong>OniZeD</strong>
            <span className="brand-tag">HUB</span>
          </button>

          <nav className="nav-links">
            <button
              className={activeTab === 'hub' ? 'active' : ''}
              onClick={() => handleNavigate('hub')}
            >
              <Home size={15} /> Хаб
            </button>
            <button
              className={activeTab === 'games' ? 'active' : ''}
              onClick={() => handleNavigate('games')}
            >
              <Gamepad2 size={15} /> Игры
              <span className="nav-count">{data.games.length}</span>
            </button>
            <button
              className={activeTab === 'watchlist' ? 'active' : ''}
              onClick={() => handleNavigate('watchlist')}
            >
              <Film size={15} /> Просмотровое
              <span className="nav-count">{data.watchlist.length}</span>
            </button>
            <button
              className={activeTab === 'tierlist' ? 'active' : ''}
              onClick={() => handleNavigate('tierlist')}
            >
              <Layers size={15} /> Тир-листы
            </button>
            <button
              className={activeTab === 'backlog' ? 'active' : ''}
              onClick={() => handleNavigate('backlog')}
            >
              <ListTodo size={15} /> Бэклог
              <span className="nav-count">{data.backlog.length}</span>
            </button>
            <button
              className={activeTab === 'stats' ? 'active' : ''}
              onClick={() => handleNavigate('stats')}
            >
              <Dices size={15} /> Рулетка / Стата
            </button>
            <button
              className={activeTab === 'rules' ? 'active' : ''}
              onClick={() => handleNavigate('rules')}
            >
              <BookOpen size={15} /> Правила
            </button>
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
                setSiteSettingsTab('appearance');
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
                    setSiteSettingsTab('admin');
                  } else {
                    setViewerAccountOpen(true);
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
        <HeaderGarland prefs={prefs} />
      </header>

      {/* Main Content */}
      <main className="main-container">
        {activeTab === 'hub' && (
          <HubView
            data={data}
            canEdit={canEdit}
            onNavigate={handleNavigate}
            onFilterByOrderer={(orderer) => {
              setGamesOrdererPreset(orderer);
              setActiveTab('games');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onUpdateHubConfig={(hubConfig) =>
              commitData({ ...data, hubConfig }, 'Планы хаба обновлены')
            }
            onOpenAddGame={() => setGameModalItem(null)}
            onOpenAddWatch={() => setWatchModalItem(null)}
            onInspectGame={(id) => setInspectGameId(id)}
            onInspectWatch={(id) => setInspectWatchId(id)}
            onInspectBacklog={(id) => setInspectBacklogId(id)}
          />
        )}

        {activeTab === 'games' && (
          <GamesView
            games={data.games}
            memes={data.memes}
            canEdit={canEdit}
            currentUser={user}
            initialOrdererFilter={gamesOrdererPreset}
            onClearInitialOrderer={() => setGamesOrdererPreset('')}
            onAddGame={() => setGameModalItem(null)}
            onInspectGame={(id) => setInspectGameId(id)}
            onEditGame={(g) => setGameModalItem(g)}
            onDeleteGame={(id) =>
              commitData(
                { ...data, games: data.games.filter((x) => x.id !== id) },
                'Игра удалена'
              )
            }
            onQuickUpdateGame={(updated) =>
              commitData(
                {
                  ...data,
                  games: data.games.map((x) => (x.id === updated.id ? updated : x)),
                },
                'Статус/оценка обновлены'
              )
            }
            onAddMemeForGame={(g) =>
              setMemeModalTarget({ type: 'game', id: g.id, title: g.title })
            }
            onViewMeme={(m) => setLightboxMeme(m)}
          />
        )}

        {activeTab === 'watchlist' && (
          <WatchlistView
            watchlist={data.watchlist}
            memes={data.memes}
            canEdit={canEdit}
            currentUser={user}
            onAddWatch={() => setWatchModalItem(null)}
            onInspectWatch={(id) => setInspectWatchId(id)}
            onEditWatch={(w) => setWatchModalItem(w)}
            onDeleteWatch={(id) =>
              commitData(
                { ...data, watchlist: data.watchlist.filter((x) => x.id !== id) },
                'Тайтл удалён'
              )
            }
            onAddMeme={(target) => setMemeModalTarget(target)}
            onViewMeme={(m) => setLightboxMeme(m)}
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
                : `Порядок в тире «${toTier || 'Без оценки'}» обновлён`;

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
              commitData({ ...data, customTierLists: lists }, 'Тир-лист сохранён')
            }
            onInspectGame={(id) => setInspectGameId(id)}
            onInspectWatch={(id) => setInspectWatchId(id)}
          />
        )}

        {activeTab === 'backlog' && (
          <BacklogView
            backlog={data.backlog}
            canEdit={canEdit}
            onAddBacklog={() => setBacklogModalItem(null)}
            onInspectBacklog={(id) => setInspectBacklogId(id)}
            onEditBacklog={(b) => setBacklogModalItem(b)}
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
                `Статус игры изменён на «${status}»`
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
                `Статус тайтла изменён на «${status}»`
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
                `Статус бэклога изменён на «${status}»`
              );
            }}
            onPromoteBacklogToGame={handlePromoteBacklog}
            onInspectGame={(id) => setInspectGameId(id)}
            onInspectWatch={(id) => setInspectWatchId(id)}
            onInspectBacklog={(id) => setInspectBacklogId(id)}
            onFilterByOrderer={(orderer) => {
              setGamesOrdererPreset(orderer);
              setActiveTab('games');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeTab === 'rules' && (
          <RulesView
            rules={data.rules}
            ratingScale={data.ratingScale}
            canEdit={canEdit}
            onSaveRules={(rules) =>
              commitData({ ...data, rules }, 'Свод правил обновлён')
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
          onClose={() => setInspectGameId(null)}
          onEdit={(g) => setGameModalItem(g)}
          onQuickUpdate={(updated) =>
            commitData(
              {
                ...data,
                games: data.games.map((x) => (x.id === updated.id ? updated : x)),
              },
              'Игра обновлена'
            )
          }
          onAddMeme={(g) =>
            setMemeModalTarget({ type: 'game', id: g.id, title: g.title })
          }
          onViewMeme={(m) => setLightboxMeme(m)}
          onEditMeme={(m) => setEditingMeme(m)}
          onFilterByOrderer={(orderer) => {
            setGamesOrdererPreset(orderer);
            setActiveTab('games');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
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
          onClose={() => setInspectWatchId(null)}
          onEdit={(w) => setWatchModalItem(w)}
          onQuickUpdate={(updated) =>
            commitData(
              {
                ...data,
                watchlist: data.watchlist.map((x) =>
                  x.id === updated.id ? updated : x
                ),
              },
              'Тайтл обновлён'
            )
          }
          onAddMeme={(w) =>
            setMemeModalTarget({ type: 'watch', id: w.id, title: w.title })
          }
          onViewMeme={(m) => setLightboxMeme(m)}
          onEditMeme={(m) => setEditingMeme(m)}
        />
      )}

      {inspectedBacklog && (
        <BacklogDetailModal
          item={inspectedBacklog}
          canEdit={canEdit}
          onClose={() => setInspectBacklogId(null)}
          onEdit={(b) => setBacklogModalItem(b)}
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
          onClose={() => setGameModalItem(undefined)}
          onSave={(saved) => {
            const exists = data.games.some((x) => x.id === saved.id);
            const nextGames = exists
              ? data.games.map((x) => (x.id === saved.id ? saved : x))
              : [saved, ...data.games];
            commitData({ ...data, games: nextGames }, 'Игра сохранена');
            setGameModalItem(undefined);
          }}
        />
      )}

      {watchModalItem !== undefined && (
        <WatchModal
          initial={watchModalItem}
          apiBaseUrl={cfg.apiBaseUrl}
          orderers={allOrdererStats}
          siteData={data}
          onClose={() => setWatchModalItem(undefined)}
          onSave={(saved) => {
            const exists = data.watchlist.some((x) => x.id === saved.id);
            const nextWatch = exists
              ? data.watchlist.map((x) => (x.id === saved.id ? saved : x))
              : [saved, ...data.watchlist];
            commitData({ ...data, watchlist: nextWatch }, 'Тайтл сохранён');
            setWatchModalItem(undefined);
          }}
        />
      )}

      {backlogModalItem !== undefined && (
        <BacklogModal
          initial={backlogModalItem}
          apiBaseUrl={cfg.apiBaseUrl}
          siteData={data}
          onClose={() => setBacklogModalItem(undefined)}
          onSave={(saved) => {
            const exists = data.backlog.some((x) => x.id === saved.id);
            const nextBacklog = exists
              ? data.backlog.map((x) => (x.id === saved.id ? saved : x))
              : [saved, ...data.backlog];
            commitData({ ...data, backlog: nextBacklog }, 'Бэклог обновлён');
            setBacklogModalItem(undefined);
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
          }}
        />
      )}

      {lightboxMeme && (
        <MemeLightbox
          meme={lightboxMeme}
          canEdit={canEdit}
          onClose={() => setLightboxMeme(null)}
          onEdit={(m) => setEditingMeme(m)}
          onDelete={(id) =>
            commitData(
              { ...data, memes: data.memes.filter((m) => m.id !== id) },
              'Мем удалён'
            )
          }
        />
      )}

      {viewerAccountOpen && user && (
        <AdminSettingsModal
          user={user}
          role={role}
          data={data}
          dataSource={dataSource}
          onClose={() => setViewerAccountOpen(false)}
          onLogout={() => {
            clearTwitchSession();
            setUser(null);
            showToast('Вы вышли из аккаунта');
          }}
          onUpdateModerators={(moderators) =>
            commitData({ ...data, moderators }, 'Список модераторов обновлён')
          }
          onImportJson={(imported) =>
            commitData(imported, 'Резервная копия успешно загружена!')
          }
          onForceCloudPush={() =>
            commitData(data, 'Все текущие данные отправлены в облако!')
          }
        />
      )}

      {siteSettingsTab !== null && (
        <SiteSettingsModal
          initialTab={siteSettingsTab}
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
          onClose={() => setSiteSettingsTab(null)}
          onLogout={() => {
            clearTwitchSession();
            setUser(null);
            showToast('Вы вышли из аккаунта');
          }}
          onUpdateModerators={(moderators) =>
            commitData({ ...data, moderators }, 'Список модераторов обновлён')
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
        />
      )}

      <FestiveFooter
        prefs={prefs}
        onShowWish={(wish) => showToast(wish, false)}
      />

      <CookieBanner
        privacy={privacyPrefs}
        onApply={handleApplyPrivacy}
        onOpenCustomize={() => setSiteSettingsTab('privacy')}
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
