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
  Edit3,
  LayoutGrid,
  List,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { MemeItem, TwitchUser, WatchItem } from '../types';
import { CoverImage } from '../components/CoverImage';
import { OrdererAutocomplete } from '../components/OrdererAutocomplete';
import { resolveMemeImageUrl } from '../utils/builtinMemes';
import { collectOrdererStats } from '../utils/orderers';
import {
  RATINGS_ORDER,
  RatingBadge,
  StatusBadge,
  WATCH_CATEGORIES,
  WATCH_STATUSES,
} from '../components/Badges';

interface WatchlistViewProps {
  watchlist: WatchItem[];
  memes: MemeItem[];
  canEdit: boolean;
  currentUser: TwitchUser | null;
  catTag?: string;
  onSelectCatTag?: (cat: string) => void;
  ordererTag?: string;
  onSelectOrdererTag?: (orderer: string, pushHistory?: boolean) => void;
  onAddWatch: () => void;
  onInspectWatch: (id: string) => void;
  onEditWatch: (item: WatchItem) => void;
  onDeleteWatch: (id: string) => void;
  onQuickUpdateWatch?: (item: WatchItem) => void;
  onAddMeme: (target: { type: 'watch'; id: string; title: string }) => void;
  onViewMeme: (meme: MemeItem) => void;
}

const EMPTY_MEMES: MemeItem[] = [];
const WATCH_GRID_BATCH = 36;
const WATCH_TABLE_BATCH = 60;

interface WatchGridCardProps {
  item: WatchItem;
  memes: MemeItem[];
  canEdit: boolean;
  onInspectWatch: (id: string) => void;
  onSelectOrderer: (orderer: string) => void;
  onEditWatch: (item: WatchItem) => void;
  onDeleteWatch: (id: string) => void;
  onAddMeme: (target: { type: 'watch'; id: string; title: string }) => void;
  onViewMeme: (meme: MemeItem) => void;
}

const WatchGridCard: React.FC<WatchGridCardProps> = memo(
  ({
    item: w,
    memes: itemMemes,
    canEdit,
    onInspectWatch,
    onSelectOrderer,
    onEditWatch,
    onDeleteWatch,
    onAddMeme,
    onViewMeme,
  }) => (
    <article className="media-card" onClick={() => onInspectWatch(w.id)}>
      <div className="media-card-poster">
        <CoverImage
          title={w.title}
          coverUrl={w.coverUrl}
          badgeText={w.category}
        />
        {itemMemes.length > 0 && (
          <span className="meme-count-badge">
            🖼 {itemMemes.length} мем{itemMemes.length > 1 ? 'а' : ''}
          </span>
        )}
      </div>

      <div className="media-card-body">
        <div className="row-gap-xs wrap">
          <StatusBadge status={w.status} />
          <RatingBadge rating={w.rating} />
        </div>
        <h3 className="media-card-title">{w.title}</h3>
        <div className="media-card-orderer">
          Заказал:{' '}
          {w.orderedBy && w.orderedBy !== '-' ? (
            <button
              type="button"
              className="link-inline"
              onClick={(e) => {
                e.stopPropagation();
                onSelectOrderer(w.orderedBy);
              }}
            >
              {w.orderedBy}
            </button>
          ) : (
            <strong>{w.orderedBy}</strong>
          )}
        </div>

        {w.conditions && (
          <div className="card-note conditions-note clamp-2">{w.conditions}</div>
        )}
        {w.comment && <p className="card-comment clamp-3">{w.comment}</p>}

        {itemMemes.length > 0 && (
          <div className="watch-memes-box" onClick={(e) => e.stopPropagation()}>
            <span className="muted-xs">Мемы с этого стрима:</span>
            <div className="attached-memes-strip">
              {itemMemes.map((m) => (
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

        {canEdit && (
          <div
            className="card-mod-actions"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => onEditWatch(w)}
            >
              <Edit3 size={13} /> Править
            </button>
          </div>
        )}
      </div>
    </article>
  )
);

export const WatchlistView: React.FC<WatchlistViewProps> = memo(
  ({
    watchlist,
    memes,
    canEdit,
    currentUser,
    catTag = 'ALL',
    onSelectCatTag,
    ordererTag = '',
    onSelectOrdererTag,
    onAddWatch,
    onInspectWatch,
    onEditWatch,
    onDeleteWatch,
    onQuickUpdateWatch,
    onAddMeme,
    onViewMeme,
  }) => {
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState(catTag || 'ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [ratingFilter, setRatingFilter] = useState('ALL');
    const [onlyMine, setOnlyMine] = useState(false);
    const [ordererFilter, setOrdererFilter] = useState(ordererTag || '');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
      try {
        return localStorage.getItem('onized_view_watch') === 'table'
          ? 'table'
          : 'grid';
      } catch {
        return 'grid';
      }
    });

    const changeViewMode = useCallback((mode: 'grid' | 'table') => {
      setViewMode(mode);
      try {
        localStorage.setItem('onized_view_watch', mode);
      } catch {
        // Ignore
      }
    }, []);

    useEffect(() => {
      setCatFilter(catTag || 'ALL');
    }, [catTag]);

    useEffect(() => {
      setOrdererFilter(ordererTag || '');
    }, [ordererTag]);

    const deferredSearch = useDeferredValue(search);
    const deferredOrderer = useDeferredValue(ordererFilter);

    const batchSize = viewMode === 'grid' ? WATCH_GRID_BATCH : WATCH_TABLE_BATCH;
    const [visibleCount, setVisibleCount] = useState(batchSize);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    const ordererStats = useMemo(
      () => collectOrdererStats([], watchlist),
      [watchlist]
    );

    const { catCounts, searchIndex } = useMemo(() => {
      const counts: Record<string, number> = {};
      const idxMap = new Map<string, { lowerOrd: string; hay: string }>();
      for (const w of watchlist) {
        counts[w.category] = (counts[w.category] || 0) + 1;
        idxMap.set(w.id, {
          lowerOrd: w.orderedBy.toLowerCase(),
          hay: `${w.title} ${w.orderedBy} ${w.comment} ${w.conditions}`.toLowerCase(),
        });
      }
      return { catCounts: counts, searchIndex: idxMap };
    }, [watchlist]);

    const memesByWatchId = useMemo(() => {
      const titleToId = new Map<string, string>();
      for (const w of watchlist) {
        titleToId.set(w.title, w.id);
      }
      const map = new Map<string, MemeItem[]>();
      for (const m of memes) {
        if (m.targetType === 'watch') {
          const matchedId = m.targetId || titleToId.get(m.targetTitle) || '';
          if (matchedId) {
            const list = map.get(matchedId);
            if (list) {
              list.push(m);
            } else {
              map.set(matchedId, [m]);
            }
          }
        }
      }
      return map;
    }, [memes, watchlist]);

    const filtered = useMemo(() => {
      const q = deferredSearch.trim().toLowerCase();
      const ordQ = deferredOrderer.trim().toLowerCase();
      const myLogin = currentUser?.login.toLowerCase() || '';

      return watchlist.filter((w) => {
        if (catFilter === 'WITH_MEMES') {
          if (!memesByWatchId.has(w.id)) return false;
        } else if (catFilter !== 'ALL' && w.category !== catFilter) {
          return false;
        }
        if (statusFilter !== 'ALL' && w.status !== statusFilter) return false;
        if (ratingFilter !== 'ALL' && w.rating !== ratingFilter) return false;

        const pre = searchIndex.get(w.id);
        const lowerOrd = pre ? pre.lowerOrd : w.orderedBy.toLowerCase();

        if (onlyMine && myLogin) {
          const isStreamerMatch = myLogin === 'onized' && lowerOrd === 'стример';
          if (!lowerOrd.includes(myLogin) && !isStreamerMatch) {
            return false;
          }
        }
        if (ordQ && !lowerOrd.includes(ordQ)) {
          return false;
        }
        if (q) {
          const hay = pre
            ? pre.hay
            : `${w.title} ${w.orderedBy} ${w.comment} ${w.conditions}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    }, [
      watchlist,
      searchIndex,
      deferredSearch,
      catFilter,
      statusFilter,
      ratingFilter,
      onlyMine,
      deferredOrderer,
      currentUser,
      memesByWatchId,
    ]);

    useEffect(() => {
      setVisibleCount(batchSize);
    }, [
      batchSize,
      deferredSearch,
      catFilter,
      statusFilter,
      ratingFilter,
      onlyMine,
      deferredOrderer,
    ]);

    const hasMore = visibleCount < filtered.length;

    useEffect(() => {
      if (!hasMore) return;
      const node = loadMoreRef.current;
      if (!node || typeof IntersectionObserver === 'undefined') return;

      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setVisibleCount((prev) =>
              Math.min(filtered.length, prev + batchSize)
            );
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

    const handleSelectOrderer = useCallback(
      (ord: string) => {
        setOrdererFilter(ord);
        onSelectOrdererTag?.(ord, true);
      },
      [onSelectOrdererTag]
    );

    const handleChangeCat = useCallback(
      (nextCat: string) => {
        setCatFilter(nextCat);
        onSelectCatTag?.(nextCat);
      },
      [onSelectCatTag]
    );

    return (
      <div className="view-stack">
        <div className="page-header">
          <div>
            <h1>Просмотровый список ({filtered.length})</h1>
            <p className="muted-sm">
              Фильмы, сериалы, аниме и манга - нажми на любую карточку, чтобы открыть подробности и мемы со стрима
            </p>
          </div>

          <div className="row-gap-sm wrap">
            <div className="segmented">
              <button
                type="button"
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => changeViewMode('grid')}
                title="Карточки с постерами"
              >
                <LayoutGrid size={16} /> Плитка
              </button>
              <button
                type="button"
                className={viewMode === 'table' ? 'active' : ''}
                onClick={() => changeViewMode('table')}
                title="Компактная таблица"
              >
                <List size={16} /> Таблица
              </button>
            </div>
            {canEdit && (
              <button className="btn btn-primary" onClick={onAddWatch}>
                <Plus size={16} /> Добавить тайтл
              </button>
            )}
          </div>
        </div>

        <div className="filters-bar">
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              className="input"
              placeholder="Поиск по фильму, аниме, заказчику или комментарию..."
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
            }}
            orderers={ordererStats}
            placeholder="Заказчик (подсказки)..."
          />

          <select
            className="input select-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Все статусы</option>
            {WATCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

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
          </select>

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
                }}
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>

        <div className="status-pills-row">
          <button
            className={`status-tab ${catFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => handleChangeCat('ALL')}
          >
            Все <span>{watchlist.length}</span>
          </button>
          {WATCH_CATEGORIES.map((c) => (
            <button
              key={c}
              className={`status-tab ${catFilter === c ? 'active' : ''}`}
              onClick={() => handleChangeCat(c)}
            >
              {c} <span>{catCounts[c] || 0}</span>
            </button>
          ))}
          {memesByWatchId.size > 0 && (
            <button
              className={`status-tab ${catFilter === 'WITH_MEMES' ? 'active' : ''}`}
              onClick={() => handleChangeCat('WITH_MEMES')}
            >
              🖼 С мемами <span>{memesByWatchId.size}</span>
            </button>
          )}
        </div>

        {viewMode === 'grid' ? (
          <div className="media-cards-grid">
            {visibleItems.map((w) => (
              <WatchGridCard
                key={w.id}
                item={w}
                memes={memesByWatchId.get(w.id) || EMPTY_MEMES}
                canEdit={canEdit}
                onInspectWatch={onInspectWatch}
                onSelectOrderer={handleSelectOrderer}
                onEditWatch={onEditWatch}
                onDeleteWatch={onDeleteWatch}
                onAddMeme={onAddMeme}
                onViewMeme={onViewMeme}
              />
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-game">Тайтл</th>
                  <th className="col-orderer">Кто заказал</th>
                  <th className="col-status">Статус</th>
                  <th className="col-rating">Оценка</th>
                  <th className="col-notes">Условия и комментарий</th>
                  <th className="col-links">Мемы / действия</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((w) => {
                  const itemMemes = memesByWatchId.get(w.id) || EMPTY_MEMES;
                  return (
                    <tr key={w.id} onClick={() => onInspectWatch(w.id)}>
                      <td className="col-game">
                        <div className="table-title-cell">
                          <CoverImage
                            title={w.title}
                            coverUrl={w.coverUrl}
                            className="table-thumb"
                          />
                          <div className="table-game-meta">
                            <strong className="table-game-name">{w.title}</strong>
                            <span className="table-sub-meta">{w.category}</span>
                          </div>
                        </div>
                      </td>
                      <td className="col-orderer">
                        {w.orderedBy && w.orderedBy !== '-' ? (
                          <button
                            type="button"
                            className="link-inline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectOrderer(w.orderedBy);
                            }}
                          >
                            {w.orderedBy}
                          </button>
                        ) : (
                          <span>{w.orderedBy}</span>
                        )}
                      </td>
                      <td
                        className="col-status"
                        onClick={(e) => canEdit && e.stopPropagation()}
                      >
                        {canEdit && onQuickUpdateWatch ? (
                          <select
                            className="input table-select"
                            value={w.status}
                            onChange={(e) =>
                              onQuickUpdateWatch({ ...w, status: e.target.value })
                            }
                          >
                            {WATCH_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <StatusBadge status={w.status} />
                        )}
                      </td>
                      <td
                        className="col-rating"
                        onClick={(e) => canEdit && e.stopPropagation()}
                      >
                        {canEdit && onQuickUpdateWatch ? (
                          <select
                            className="input table-select table-select-rating"
                            value={w.rating}
                            onChange={(e) =>
                              onQuickUpdateWatch({ ...w, rating: e.target.value })
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
                          <RatingBadge rating={w.rating} />
                        )}
                      </td>
                      <td className="col-notes table-notes-cell">
                        {w.conditions && (
                          <div className="conditions-inline clamp-2">
                            <strong>Условия:</strong> {w.conditions}
                          </div>
                        )}
                        {w.comment && (
                          <div className="muted-sm clamp-2">{w.comment}</div>
                        )}
                        {!w.conditions && !w.comment && (
                          <span className="muted-xs">-</span>
                        )}
                      </td>
                      <td
                        className="col-links"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="table-links-wrap">
                          {itemMemes.length > 0 ? (
                            <button
                              type="button"
                              className="ext-chip"
                              onClick={() => onViewMeme(itemMemes[0])}
                              title="Открыть мем"
                            >
                              🖼 {itemMemes.length} мем{itemMemes.length > 1 ? 'а' : ''}
                            </button>
                          ) : (
                            !canEdit && <span className="muted-xs">-</span>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              className="icon-btn header-edit-btn"
                              onClick={() => onEditWatch(w)}
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
                setVisibleCount((prev) =>
                  Math.min(filtered.length, prev + batchSize * 2)
                )
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
