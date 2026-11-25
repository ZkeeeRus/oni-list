import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Dices,
  Film,
  Gamepad2,
  Home,
  Layers,
  ListTodo,
  LogIn,
  ShieldCheck,
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
  getUserRole,
  initTwitchSession,
  loadInitialSiteData,
  loadRuntimeConfig,
  PERMANENT_ADMINS,
  persistSiteData,
  saveLocalRuntimeConfig,
  setPreviewEditorSession,
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

export const App: React.FC = () => {
  const [cfg, setCfg] = useState<RuntimeConfig>({
    apiBaseUrl: '',
    twitchClientId: '',
    rootAdmins: PERMANENT_ADMINS,
  });
  const [data, setData] = useState<SiteData | null>(null);
  const [dataSource, setDataSource] = useState<'remote' | 'local' | 'seed'>('seed');
  const [user, setUser] = useState<TwitchUser | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('hub');
  const [gamesOrdererPreset, setGamesOrdererPreset] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);

  // Modals state
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
  const [lightboxMeme, setLightboxMeme] = useState<MemeItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  useEffect(() => {
    (async () => {
      const loadedCfg = await loadRuntimeConfig();
      setCfg(loadedCfg);
      const [loadedData, twitchSession] = await Promise.all([
        loadInitialSiteData(loadedCfg.apiBaseUrl),
        initTwitchSession(loadedCfg.twitchClientId),
      ]);
      setData(loadedData.data);
      setDataSource(loadedData.source);
      setUser(twitchSession);
    })();
  }, []);

  const role = getUserRole(user, data, cfg);
  const canEdit = role === 'admin' || role === 'moderator';

  const commitData = async (next: SiteData, message?: string) => {
    setData(next);
    const res = await persistSiteData(next, cfg.apiBaseUrl, user);
    if (res.savedRemote) {
      setDataSource('remote');
      showToast(message || 'Сохранено в облачную БД');
    } else if (res.error) {
      showToast(res.error);
    } else {
      setDataSource('local');
      if (message) showToast(`${message} (черновик в браузере)`);
    }
  };

  if (!data) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Загружаем список игр и просмотрового OniZeD...</p>
      </div>
    );
  }

  const handleNavigate = (tab: NavTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-shell">
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
            <button
              type="button"
              className={`auth-pill ${canEdit ? 'is-mod' : ''}`}
              onClick={() => setSettingsOpen(true)}
            >
              {user ? (
                <>
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
                </>
              ) : (
                <>
                  <LogIn size={15} />
                  <span>Twitch / Модер</span>
                </>
              )}
            </button>
          </div>
        </div>
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
            onEditGame={(g) => setGameModalItem(g)}
            onEditWatch={(w) => setWatchModalItem(w)}
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
            onAddWatch={() => setWatchModalItem(null)}
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
            canEdit={canEdit}
            authorName={user?.displayName || 'OniZeD'}
            apiBaseUrl={cfg.apiBaseUrl}
            onSaveCustomTierLists={(lists) =>
              commitData({ ...data, customTierLists: lists }, 'Тир-лист сохранён')
            }
          />
        )}

        {activeTab === 'backlog' && (
          <BacklogView
            backlog={data.backlog}
            canEdit={canEdit}
            onAddBacklog={() => setBacklogModalItem(null)}
            onEditBacklog={(b) => setBacklogModalItem(b)}
            onDeleteBacklog={(id) =>
              commitData(
                { ...data, backlog: data.backlog.filter((x) => x.id !== id) },
                'Идея удалена из бэклога'
              )
            }
            onPromoteToGame={(b) => {
              const promoted: GameItem = {
                id: `game-${Date.now()}`,
                title: b.title,
                orderedBy: 'OniZeD (бэклог)',
                status: 'В процессе',
                rating: '',
                conditions: b.idea,
                comment: b.notes,
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
                `«${b.title}» перенесена в Список игр!`
              );
            }}
          />
        )}

        {activeTab === 'stats' && (
          <StatsRandomizerView
            data={data}
            canEdit={canEdit}
            onStartRolledGame={(gameId) => {
              commitData(
                {
                  ...data,
                  games: data.games.map((g) =>
                    g.id === gameId ? { ...g, status: 'В процессе' } : g
                  ),
                },
                'Игра переведена в статус «В процессе»!'
              );
            }}
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

      {/* Modals */}
      {gameModalItem !== undefined && (
        <GameModal
          initial={gameModalItem}
          apiBaseUrl={cfg.apiBaseUrl}
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

      {memeModalTarget !== undefined && (
        <MemeModal
          watchlist={data.watchlist}
          games={data.games}
          preselectedTarget={memeModalTarget}
          authorName={user?.displayName || 'OniZeD'}
          onClose={() => setMemeModalTarget(undefined)}
          onSave={(meme) => {
            commitData(
              { ...data, memes: [meme, ...data.memes] },
              'Мем добавлен в галерею!'
            );
            setMemeModalTarget(undefined);
          }}
        />
      )}

      {lightboxMeme && (
        <MemeLightbox
          meme={lightboxMeme}
          canEdit={canEdit}
          onClose={() => setLightboxMeme(null)}
          onDelete={(id) =>
            commitData(
              { ...data, memes: data.memes.filter((m) => m.id !== id) },
              'Мем удалён'
            )
          }
        />
      )}

      {settingsOpen && (
        <AdminSettingsModal
          user={user}
          role={role}
          data={data}
          cfg={cfg}
          dataSource={dataSource}
          onClose={() => setSettingsOpen(false)}
          onTwitchLogin={(cid) => startTwitchOAuth(cid)}
          onPreviewLogin={(login) => {
            const u = setPreviewEditorSession(login);
            setUser(u);
            showToast(`Включён локальный тест-режим редактора (@${login})`);
          }}
          onLogout={() => {
            clearTwitchSession();
            setUser(null);
            showToast('Вы вышли из аккаунта');
          }}
          onSaveConfig={async (partial) => {
            saveLocalRuntimeConfig(partial);
            const merged = { ...cfg, ...partial };
            setCfg(merged);
            if (partial.apiBaseUrl) {
              const refreshed = await loadInitialSiteData(partial.apiBaseUrl);
              setData(refreshed.data);
              setDataSource(refreshed.source);
            }
          }}
          onUpdateModerators={(moderators) =>
            commitData({ ...data, moderators }, 'Список модераторов обновлён')
          }
          onImportJson={(imported) =>
            commitData(imported, 'Резервная копия успешно загружена!')
          }
        />
      )}

      {toast && <div className="toast-popup">{toast}</div>}
    </div>
  );
};
