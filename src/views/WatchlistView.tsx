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
  ImagePlus,
  Plus,
  Search,
  Trash2,
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
  onAddWatch: () => void;
  onInspectWatch: (id: string) => void;
  onEditWatch: (item: WatchItem) => void;
  onDeleteWatch: (id: string) => void;
  onAddMeme: (target: { type: 'watch'; id: string; title: string }) => void;
  onViewMeme: (meme: MemeItem) => void;
}

const EMPTY_MEMES: MemeItem[] = [];
const WATCH_BATCH = 36;

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
            <button
              className="btn btn-ghost btn-xs"
              onClick={() =>
                onAddMeme({ type: 'watch', id: w.id, title: w.title })
              }
            >
              <ImagePlus size={13} /> + Мем
            </button>
            <button
              className="btn btn-ghost btn-xs danger-text"
              onClick={() => {
                if (confirm(`Удалить «${w.title}»?`)) onDeleteWatch(w.id);
              }}
            >
              <Trash2 size={13} />
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
    onAddWatch,
    onInspectWatch,
    onEditWatch,
    onDeleteWatch,
    onAddMeme,
    onViewMeme,
  }) => {
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [ratingFilter, setRatingFilter] = useState('ALL');
    const [onlyMine, setOnlyMine] = useState(false);
    const [ordererFilter, setOrdererFilter] = useState('');

    const deferredSearch = useDeferredValue(search);
    const deferredOrderer = useDeferredValue(ordererFilter);

    const [visibleCount, setVisibleCount] = useState(WATCH_BATCH);
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
      setVisibleCount(WATCH_BATCH);
    }, [
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
              Math.min(filtered.length, prev + WATCH_BATCH)
            );
          }
        },
        { rootMargin: '750px 0px' }
      );
      obs.observe(node);
      return () => obs.disconnect();
    }, [hasMore, filtered.length]);

    const visibleItems = useMemo(
      () => filtered.slice(0, visibleCount),
      [filtered, visibleCount]
    );

    const handleSelectOrderer = useCallback((ord: string) => {
      setOrdererFilter(ord);
    }, []);

    return (
      <div className="view-stack">
        <div className="page-header">
          <div>
            <h1>Просмотровый список ({filtered.length})</h1>
            <p className="muted-sm">
              Фильмы, сериалы, аниме и манга - нажми на любую карточку, чтобы открыть подробности и мемы со стрима
            </p>
          </div>

          {canEdit && (
            <div className="row-gap-sm wrap">
              <button className="btn btn-primary" onClick={onAddWatch}>
                <Plus size={16} /> Добавить тайтл
              </button>
            </div>
          )}
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
            onChange={setOrdererFilter}
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
              <button onClick={() => setOrdererFilter('')}>
                <X size={12} />
              </button>
            </span>
          )}
        </div>

        <div className="status-pills-row">
          <button
            className={`status-tab ${catFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setCatFilter('ALL')}
          >
            Все <span>{watchlist.length}</span>
          </button>
          {WATCH_CATEGORIES.map((c) => (
            <button
              key={c}
              className={`status-tab ${catFilter === c ? 'active' : ''}`}
              onClick={() => setCatFilter(c)}
            >
              {c} <span>{catCounts[c] || 0}</span>
            </button>
          ))}
          {memesByWatchId.size > 0 && (
            <button
              className={`status-tab ${catFilter === 'WITH_MEMES' ? 'active' : ''}`}
              onClick={() => setCatFilter('WITH_MEMES')}
            >
              🖼 С мемами <span>{memesByWatchId.size}</span>
            </button>
          )}
        </div>

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
                  Math.min(filtered.length, prev + WATCH_BATCH * 2)
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
