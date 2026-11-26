import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Clock,
  Edit3,
  ExternalLink,
  LayoutGrid,
  List,
  Plus,
  Search,
  Video,
  X,
} from 'lucide-react';
import { GameItem, MemeItem, TwitchUser } from '../types';
import { CoverImage } from '../components/CoverImage';
import { OrdererAutocomplete } from '../components/OrdererAutocomplete';
import { resolveMemeImageUrl } from '../utils/builtinMemes';
import { collectOrdererStats } from '../utils/orderers';
import {
  GameMetaInfo,
  getGameHltbUrl,
  getGameSteamStoreUrl,
  lookupGameMeta,
  useGameMetaMap,
} from '../utils/gameMeta';
import {
  DropPriceBadge,
  GAME_STATUSES,
  RATINGS_ORDER,
  RatingBadge,
  ReturnPriceBadge,
  StatusBadge,
} from '../components/Badges';

interface GamesViewProps {
  games: GameItem[];
  memes: MemeItem[];
  canEdit: boolean;
  currentUser: TwitchUser | null;
  statusTag?: string;
  onSelectStatusTag?: (status: string) => void;
  initialOrdererFilter?: string;
  onSelectOrdererTag?: (orderer: string, pushHistory?: boolean) => void;
  onClearInitialOrderer?: () => void;
  onAddGame: () => void;
  onInspectGame: (id: string) => void;
  onEditGame: (game: GameItem) => void;
  onDeleteGame: (id: string) => void;
  onQuickUpdateGame: (game: GameItem) => void;
  onAddMemeForGame: (game: GameItem) => void;
  onViewMeme: (meme: MemeItem) => void;
}

interface PrecomputedGameExtra {
  meta?: GameMetaInfo;
  steamUrl: string;
  hltbUrl: string;
  displayTime: string;
  metaLine: string;
  lowerOrderedBy: string;
  searchHaystack: string;
}

const EMPTY_MEMES: MemeItem[] = [];
const GRID_BATCH = 36;
const TABLE_BATCH = 72;

const RATING_RANK: Record<string, number> = {
  Шедевр: 1,
  Великолепно: 2,
  Похвально: 3,
  Проходняк: 4,
  'Полный кал': 5,
  'Нет мнения': 6,
  '': 7,
};

interface GameGridCardProps {
  game: GameItem;
  extra: PrecomputedGameExtra;
  memes: MemeItem[];
  canEdit: boolean;
  onInspectGame: (id: string) => void;
  onSelectOrderer: (orderer: string) => void;
  onEditGame: (game: GameItem) => void;
  onDeleteGame: (id: string) => void;
  onAddMemeForGame: (game: GameItem) => void;
  onViewMeme: (meme: MemeItem) => void;
}

const GameGridCard: React.FC<GameGridCardProps> = memo(
  ({
    game: g,
    extra,
    memes: gMemes,
    canEdit,
    onInspectGame,
    onSelectOrderer,
    onEditGame,
    onDeleteGame,
    onAddMemeForGame,
    onViewMeme,
  }) => {
    const { meta, steamUrl, hltbUrl, displayTime, metaLine } = extra;

    return (
      <article className="media-card" onClick={() => onInspectGame(g.id)}>
        <div className="media-card-poster">
          <CoverImage
            title={g.title}
            coverUrl={g.coverUrl}
            steamAppId={g.steamAppId}
          />
          {g.vodUrl && (
            <a
              href={g.vodUrl}
              target="_blank"
              rel="noreferrer"
              className="vod-floating-badge"
              onClick={(e) => e.stopPropagation()}
              title="Смотреть запись стрима (VOD)"
            >
              <Video size={13} /> VOD
            </a>
          )}
          {meta?.steamScore && (
            <span
              className="steam-score-badge"
              title="Процент положительных отзывов в Steam"
            >
              👍 {meta.steamScore}%
            </span>
          )}
          {displayTime && (
            <span className="hours-floating-badge">
              <Clock size={12} /> {displayTime}
            </span>
          )}
        </div>

        <div className="media-card-body">
          <div className="row-gap-xs wrap">
            <StatusBadge status={g.status} />
            <RatingBadge rating={g.rating} />
            <DropPriceBadge price={g.dropPrice} />
            <ReturnPriceBadge price={g.returnPrice} />
          </div>
          <h3 className="media-card-title">{g.title}</h3>
          {metaLine && <div className="card-meta-sub">{metaLine}</div>}
          <div className="media-card-orderer">
            Заказал:{' '}
            <button
              type="button"
              className="link-inline"
              onClick={(e) => {
                e.stopPropagation();
                onSelectOrderer(g.orderedBy);
              }}
            >
              {g.orderedBy}
            </button>
          </div>

          {g.conditions && (
            <div className="card-note conditions-note clamp-2">
              <strong>Условия:</strong> {g.conditions}
            </div>
          )}

          {g.comment && <p className="card-comment clamp-3">{g.comment}</p>}

          {gMemes.length > 0 && (
            <div className="watch-memes-box" onClick={(e) => e.stopPropagation()}>
              <span className="muted-xs">Мемы со стрима:</span>
              <div className="attached-memes-strip">
                {gMemes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="attached-meme-thumb"
                    onClick={() => onViewMeme(m)}
                    title={m.caption}
                  >
                    <img
                      src={resolveMemeImageUrl(m.imageUrl)}
                      alt={m.caption}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card-ext-links" onClick={(e) => e.stopPropagation()}>
            {steamUrl && (
              <a
                href={steamUrl}
                target="_blank"
                rel="noreferrer"
                className="ext-chip steam-chip"
              >
                Steam <ExternalLink size={11} />
              </a>
            )}
            <a
              href={hltbUrl}
              target="_blank"
              rel="noreferrer"
              className="ext-chip hltb-chip"
              title="Время прохождения на HowLongToBeat"
            >
              HLTB <Clock size={11} />
            </a>
            {g.link && !g.link.includes('store.steampowered.com') && (
              <a
                href={g.link}
                target="_blank"
                rel="noreferrer"
                className="ext-chip"
              >
                Ссылка <ExternalLink size={11} />
              </a>
            )}
          </div>

          {canEdit && (
            <div
              className="card-mod-actions"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => onEditGame(g)}
              >
                <Edit3 size={13} /> Править
              </button>
            </div>
          )}
        </div>
      </article>
    );
  }
);

export const GamesView: React.FC<GamesViewProps> = memo(
  ({
    games,
    memes,
    canEdit,
    currentUser,
    statusTag = 'ALL',
    onSelectStatusTag,
    initialOrdererFilter,
    onSelectOrdererTag,
    onClearInitialOrderer,
    onAddGame,
    onInspectGame,
    onEditGame,
    onDeleteGame,
    onQuickUpdateGame,
    onAddMemeForGame,
    onViewMeme,
  }) => {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>(statusTag || 'ALL');
    const [ratingFilter, setRatingFilter] = useState<string>('ALL');
    const [onlyVod, setOnlyVod] = useState(false);
    const [onlyReturned, setOnlyReturned] = useState(false);
    const [onlyMine, setOnlyMine] = useState(false);
    const [ordererFilter, setOrdererFilter] = useState(initialOrdererFilter || '');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [sortBy, setSortBy] = useState<'default' | 'title' | 'rating'>('default');

    const deferredSearch = useDeferredValue(search);
    const deferredOrderer = useDeferredValue(ordererFilter);

    const batchSize = viewMode === 'grid' ? GRID_BATCH : TABLE_BATCH;
    const [visibleCount, setVisibleCount] = useState(batchSize);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      setStatusFilter(statusTag || 'ALL');
    }, [statusTag]);

    useEffect(() => {
      if (initialOrdererFilter !== undefined) {
        setOrdererFilter(initialOrdererFilter);
      }
    }, [initialOrdererFilter]);

    const metaMap = useGameMetaMap();
    const ordererStats = useMemo(() => collectOrdererStats(games), [games]);

    // Предрасчет метаданных, ссылок и поисковых строк 1 раз вместо пересчета на каждый ввод
    const gameExtrasMap = useMemo(() => {
      const map = new Map<string, PrecomputedGameExtra>();
      for (const g of games) {
        const meta = lookupGameMeta(g, metaMap);
        const steamUrl = getGameSteamStoreUrl(g);
        const hltbUrl = getGameHltbUrl(g.title, meta);
        const displayTime = g.hours ? `${g.hours}ч` : meta?.estHours || '';
        const metaLine = [meta?.year, meta?.genres].filter(Boolean).join(' • ');
        const lowerOrderedBy = g.orderedBy.toLowerCase();
        const searchHaystack =
          `${g.title} ${g.orderedBy} ${g.conditions} ${g.comment} ${g.dropPrice || ''} ${g.returnPrice || ''}`.toLowerCase();

        map.set(g.id, {
          meta,
          steamUrl,
          hltbUrl,
          displayTime,
          metaLine,
          lowerOrderedBy,
          searchHaystack,
        });
      }
      return map;
    }, [games, metaMap]);

    const memesByGame = useMemo(() => {
      const map = new Map<string, MemeItem[]>();
      for (const m of memes) {
        if (m.targetType === 'game' && m.targetId) {
          const arr = map.get(m.targetId);
          if (arr) {
            arr.push(m);
          } else {
            map.set(m.targetId, [m]);
          }
        }
      }
      return map;
    }, [memes]);

    const filtered = useMemo(() => {
      const q = deferredSearch.trim().toLowerCase();
      const ordQ = deferredOrderer.trim().toLowerCase();
      const myLogin = currentUser?.login.toLowerCase() || '';

      const list = games.filter((g) => {
        if (statusFilter !== 'ALL' && g.status !== statusFilter) return false;
        if (ratingFilter !== 'ALL') {
          if (ratingFilter === 'UNRATED') {
            if (g.rating && g.rating !== 'Нет мнения') return false;
          } else if (g.rating !== ratingFilter) {
            return false;
          }
        }
        if (onlyVod && !g.vodUrl) return false;
        if (onlyReturned && !g.returnPrice) return false;

        const extra = gameExtrasMap.get(g.id);
        const lowerOrd = extra ? extra.lowerOrderedBy : g.orderedBy.toLowerCase();

        if (onlyMine && myLogin) {
          const isStreamerMatch = myLogin === 'onized' && lowerOrd === 'стример';
          if (!lowerOrd.includes(myLogin) && !isStreamerMatch) return false;
        }
        if (ordQ && !lowerOrd.includes(ordQ)) return false;
        if (q) {
          const hay = extra
            ? extra.searchHaystack
            : `${g.title} ${g.orderedBy} ${g.conditions} ${g.comment}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      if (sortBy === 'title') {
        return [...list].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
      }
      if (sortBy === 'rating') {
        return [...list].sort(
          (a, b) => (RATING_RANK[a.rating] ?? 9) - (RATING_RANK[b.rating] ?? 9)
        );
      }
      return list;
    }, [
      games,
      gameExtrasMap,
      deferredSearch,
      statusFilter,
      ratingFilter,
      onlyVod,
      onlyReturned,
      onlyMine,
      deferredOrderer,
      currentUser,
      sortBy,
    ]);

    // Сброс окна подгрузки при смене фильтров / режима отображения
    useEffect(() => {
      setVisibleCount(batchSize);
    }, [
      batchSize,
      deferredSearch,
      statusFilter,
      ratingFilter,
      onlyVod,
      onlyReturned,
      onlyMine,
      deferredOrderer,
      sortBy,
    ]);

    const hasMore = visibleCount < filtered.length;

    // Автоматическая бесшовная подгрузка следующей порции карточек при прокрутке
    useEffect(() => {
      if (!hasMore) return;
      const node = loadMoreRef.current;
      if (!node || typeof IntersectionObserver === 'undefined') return;

      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setVisibleCount((prev) => Math.min(filtered.length, prev + batchSize));
          }
        },
        { rootMargin: '750px 0px' }
      );
      obs.observe(node);
      return () => obs.disconnect();
    }, [hasMore, filtered.length, batchSize]);

    const visibleItems = useMemo(
      () => filtered.slice(0, visibleCount),
      [filtered, visibleCount]
    );

    const statusCounts = useMemo(() => {
      const c: Record<string, number> = { ALL: games.length };
      for (const g of games) {
        c[g.status] = (c[g.status] || 0) + 1;
      }
      return c;
    }, [games]);

    const handleSelectOrderer = useCallback(
      (ord: string) => {
        setOrdererFilter(ord);
        onSelectOrdererTag?.(ord, true);
      },
      [onSelectOrdererTag]
    );

    const handleChangeStatus = useCallback(
      (nextStatus: string) => {
        setStatusFilter(nextStatus);
        onSelectStatusTag?.(nextStatus);
      },
      [onSelectStatusTag]
    );

    return (
      <div className="view-stack">
        <div className="page-header">
          <div>
            <h1>Список игр ({filtered.length})</h1>
            <p className="muted-sm">
              Все заказы, прохождения, условия, оценки, цены дропов/возвратов и записи VOD
            </p>
          </div>
          <div className="row-gap-sm wrap">
            <div className="segmented">
              <button
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => setViewMode('grid')}
                title="Карточки с портретами"
              >
                <LayoutGrid size={16} /> Плитка
              </button>
              <button
                className={viewMode === 'table' ? 'active' : ''}
                onClick={() => setViewMode('table')}
                title="Компактная таблица"
              >
                <List size={16} /> Таблица
              </button>
            </div>
            {canEdit && (
              <button className="btn btn-primary" onClick={onAddGame}>
                <Plus size={16} /> Добавить игру
              </button>
            )}
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="filters-bar">
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              className="input"
              placeholder="Поиск по названию, заказчику, условиям или отзыву..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="clear-input-btn"
                onClick={() => setSearch('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <OrdererAutocomplete
            value={ordererFilter}
            onChange={(val) => {
              setOrdererFilter(val);
              onSelectOrdererTag?.(val, false);
              if (!val) onClearInitialOrderer?.();
            }}
            orderers={ordererStats}
            placeholder="Заказчик (подсказки)..."
          />

          <select
            className="input select-auto"
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
          >
            <option value="ALL">Любая оценка</option>
            {RATINGS_ORDER.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value="UNRATED">Без оценки</option>
          </select>

          <select
            className="input select-auto"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="default">Порядок списка</option>
            <option value="rating">Сначала лучшие</option>
            <option value="title">По алфавиту</option>
          </select>

          <label className="check-pill">
            <input
              type="checkbox"
              checked={onlyVod}
              onChange={(e) => setOnlyVod(e.target.checked)}
            />
            <span>С записью VOD</span>
          </label>

          <label className="check-pill">
            <input
              type="checkbox"
              checked={onlyReturned}
              onChange={(e) => setOnlyReturned(e.target.checked)}
            />
            <span>Вернули за донат</span>
          </label>

          {currentUser && (
            <label className="check-pill">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
              />
              <span>Мои заказы (@{currentUser.login})</span>
            </label>
          )}

          {ordererFilter && (
            <span className="active-filter-tag">
              Заказчик: <strong>{ordererFilter}</strong>
              <button
                onClick={() => {
                  setOrdererFilter('');
                  onSelectOrdererTag?.('', true);
                  onClearInitialOrderer?.();
                }}
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>

        {/* Status Pills */}
        <div className="status-pills-row">
          <button
            className={`status-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => handleChangeStatus('ALL')}
          >
            Все <span>{statusCounts.ALL}</span>
          </button>
          {GAME_STATUSES.filter((s) => statusCounts[s]).map((s) => (
            <button
              key={s}
              className={`status-tab ${statusFilter === s ? 'active' : ''}`}
              onClick={() => handleChangeStatus(s)}
            >
              {s} <span>{statusCounts[s]}</span>
            </button>
          ))}
        </div>

        {/* Grid View */}
        {viewMode === 'grid' ? (
          <div className="media-cards-grid">
            {visibleItems.map((g) => {
              const extra = gameExtrasMap.get(g.id) || {
                steamUrl: getGameSteamStoreUrl(g),
                hltbUrl: getGameHltbUrl(g.title),
                displayTime: g.hours ? `${g.hours}ч` : '',
                metaLine: '',
                lowerOrderedBy: g.orderedBy.toLowerCase(),
                searchHaystack: '',
              };
              const gMemes = memesByGame.get(g.id) || EMPTY_MEMES;

              return (
                <GameGridCard
                  key={g.id}
                  game={g}
                  extra={extra}
                  memes={gMemes}
                  canEdit={canEdit}
                  onInspectGame={onInspectGame}
                  onSelectOrderer={handleSelectOrderer}
                  onEditGame={onEditGame}
                  onDeleteGame={onDeleteGame}
                  onAddMemeForGame={onAddMemeForGame}
                  onViewMeme={onViewMeme}
                />
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-game">Игра</th>
                  <th className="col-orderer">Заказчик</th>
                  <th className="col-status">Статус</th>
                  <th className="col-rating">Оценка</th>
                  <th className="col-notes">Условия и отзыв</th>
                  <th className="col-links">Ссылки</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((g) => {
                  const extra = gameExtrasMap.get(g.id);
                  const steamUrl = extra?.steamUrl ?? getGameSteamStoreUrl(g);
                  const hltbUrl = extra?.hltbUrl ?? getGameHltbUrl(g.title);
                  const displayTime =
                    extra?.displayTime ?? (g.hours ? `${g.hours}ч` : '');
                  const metaLine = extra?.metaLine || '';

                  return (
                    <tr key={g.id} onClick={() => onInspectGame(g.id)}>
                      <td className="col-game">
                        <div className="table-title-cell">
                          <CoverImage
                            title={g.title}
                            coverUrl={g.coverUrl}
                            steamAppId={g.steamAppId}
                            className="table-thumb"
                          />
                          <div className="table-game-meta">
                            <strong className="table-game-name">{g.title}</strong>
                            {metaLine && (
                              <span className="table-sub-meta">{metaLine}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="col-orderer">
                        <button
                          type="button"
                          className="link-inline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectOrderer(g.orderedBy);
                          }}
                        >
                          {g.orderedBy}
                        </button>
                      </td>
                      <td
                        className="col-status"
                        onClick={(e) => canEdit && e.stopPropagation()}
                      >
                        <div className="table-status-stack">
                          {canEdit ? (
                            <select
                              className="input table-select"
                              value={g.status}
                              onChange={(e) =>
                                onQuickUpdateGame({ ...g, status: e.target.value })
                              }
                            >
                              {GAME_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <StatusBadge status={g.status} />
                          )}
                          {(g.dropPrice || g.returnPrice) && (
                            <div className="row-gap-xs wrap">
                              <DropPriceBadge price={g.dropPrice} />
                              <ReturnPriceBadge price={g.returnPrice} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td
                        className="col-rating"
                        onClick={(e) => canEdit && e.stopPropagation()}
                      >
                        {canEdit ? (
                          <select
                            className="input table-select table-select-rating"
                            value={g.rating}
                            onChange={(e) =>
                              onQuickUpdateGame({ ...g, rating: e.target.value })
                            }
                          >
                            <option value="">Без оценки</option>
                            {RATINGS_ORDER.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <RatingBadge rating={g.rating} />
                        )}
                      </td>
                      <td className="col-notes table-notes-cell">
                        {g.conditions && (
                          <div className="conditions-inline clamp-2">
                            <strong>Условия:</strong> {g.conditions}
                          </div>
                        )}
                        {g.comment && (
                          <div className="muted-sm clamp-2">{g.comment}</div>
                        )}
                        {!g.conditions && !g.comment && (
                          <span className="muted-xs">-</span>
                        )}
                      </td>
                      <td
                        className="col-links"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="table-links-wrap">
                          {displayTime && (
                            <span className="badge">{displayTime}</span>
                          )}
                          {g.vodUrl && (
                            <a
                              href={g.vodUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ext-chip"
                            >
                              <Video size={11} /> VOD
                            </a>
                          )}
                          {steamUrl && (
                            <a
                              href={steamUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ext-chip steam-chip"
                              title="Открыть в Steam"
                            >
                              Steam <ExternalLink size={11} />
                            </a>
                          )}
                          <a
                            href={hltbUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ext-chip hltb-chip"
                            title="HowLongToBeat"
                          >
                            HLTB <Clock size={11} />
                          </a>
                          {canEdit && (
                            <button
                              type="button"
                              className="icon-btn header-edit-btn"
                              onClick={() => onEditGame(g)}
                              title="Редактировать"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && (
          <div ref={loadMoreRef} className="load-more-sentinel">
            <span className="muted-xs">
              Показано {visibleItems.length} из {filtered.length}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setVisibleCount((prev) => Math.min(filtered.length, prev + batchSize * 2))
              }
            >
              Показать еще
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setVisibleCount(filtered.length)}
            >
              Показать все ({filtered.length})
            </button>
          </div>
        )}
      </div>
    );
  }
);
