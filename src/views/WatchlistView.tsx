import React, { useMemo, useState } from 'react';
import {
  Edit3,
  Film,
  Image as ImageIcon,
  ImagePlus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { MemeItem, WatchItem } from '../types';
import { CoverImage } from '../components/CoverImage';
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
  initialSubView?: 'list' | 'memes';
  onAddWatch: () => void;
  onEditWatch: (item: WatchItem) => void;
  onDeleteWatch: (id: string) => void;
  onAddMeme: (target?: { type: 'watch' | 'game' | 'general'; id: string; title: string }) => void;
  onViewMeme: (meme: MemeItem) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlist,
  memes,
  canEdit,
  initialSubView = 'list',
  onAddWatch,
  onEditWatch,
  onDeleteWatch,
  onAddMeme,
  onViewMeme,
}) => {
  const [subView, setSubView] = useState<'list' | 'memes'>(initialSubView);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [ratingFilter, setRatingFilter] = useState('ALL');

  React.useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  const memesByWatchId = useMemo(() => {
    const map = new Map<string, MemeItem[]>();
    for (const m of memes) {
      if (m.targetType === 'watch' && m.targetId) {
        const list = map.get(m.targetId) || [];
        list.push(m);
        map.set(m.targetId, list);
      }
    }
    return map;
  }, [memes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return watchlist.filter((w) => {
      if (catFilter !== 'ALL' && w.category !== catFilter) return false;
      if (statusFilter !== 'ALL' && w.status !== statusFilter) return false;
      if (ratingFilter !== 'ALL' && w.rating !== ratingFilter) return false;
      if (q) {
        const hay = `${w.title} ${w.orderedBy} ${w.comment} ${w.conditions}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [watchlist, search, catFilter, statusFilter, ratingFilter]);

  return (
    <div className="view-stack">
      <div className="page-header">
        <div>
          <h1>Просмотровый список и мемы со стримов</h1>
          <p className="muted-sm">
            Фильмы, сериалы, аниме и манга + памятные мемы с совместных просмотров
          </p>
        </div>

        <div className="row-gap-sm wrap">
          <div className="segmented">
            <button
              className={subView === 'list' ? 'active' : ''}
              onClick={() => setSubView('list')}
            >
              <Film size={15} /> Тайтлы ({watchlist.length})
            </button>
            <button
              className={subView === 'memes' ? 'active' : ''}
              onClick={() => setSubView('memes')}
            >
              <ImageIcon size={15} /> Стена мемов ({memes.length})
            </button>
          </div>

          {canEdit && (
            <>
              <button className="btn btn-secondary" onClick={() => onAddMeme()}>
                <ImagePlus size={16} /> + Мем (Ctrl+V)
              </button>
              <button className="btn btn-primary" onClick={onAddWatch}>
                <Plus size={16} /> + Тайтл
              </button>
            </>
          )}
        </div>
      </div>

      {subView === 'memes' ? (
        <section className="section-block">
          <div className="section-head">
            <div>
              <h2>Мемы со стримов на память ({memes.length})</h2>
              <p className="muted-sm">
                Кликните на любой мем, чтобы открыть в полном размере. Модераторы могут
                добавлять новые мемы прямо через Ctrl+V из буфера обмена.
              </p>
            </div>
            {canEdit && (
              <button className="btn btn-primary btn-sm" onClick={() => onAddMeme()}>
                <ImagePlus size={15} /> Добавить мем
              </button>
            )}
          </div>

          <div className="memes-wall-grid">
            {memes.map((m) => (
              <div
                key={m.id}
                className="meme-wall-card"
                onClick={() => onViewMeme(m)}
              >
                <div className="meme-wall-img">
                  <img src={m.imageUrl} alt={m.caption} referrerPolicy="no-referrer" />
                </div>
                <div className="meme-wall-info">
                  <strong>{m.caption}</strong>
                  {m.targetTitle && <span className="muted-xs">{m.targetTitle}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
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
                <button className="clear-input-btn" onClick={() => setSearch('')}>
                  <X size={14} />
                </button>
              )}
            </div>

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
          </div>

          <div className="status-pills-row">
            <button
              className={`status-tab ${catFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setCatFilter('ALL')}
            >
              Все <span>{watchlist.length}</span>
            </button>
            {WATCH_CATEGORIES.map((c) => {
              const cnt = watchlist.filter((w) => w.category === c).length;
              return (
                <button
                  key={c}
                  className={`status-tab ${catFilter === c ? 'active' : ''}`}
                  onClick={() => setCatFilter(c)}
                >
                  {c} <span>{cnt}</span>
                </button>
              );
            })}
          </div>

          <div className="media-cards-grid">
            {filtered.map((w) => {
              const itemMemes = memesByWatchId.get(w.id) || [];
              return (
                <article key={w.id} className="media-card">
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
                      Заказал: <strong>{w.orderedBy}</strong>
                    </div>

                    {w.conditions && (
                      <div className="card-note conditions-note">{w.conditions}</div>
                    )}
                    {w.comment && <p className="card-comment">{w.comment}</p>}

                    {/* Stream Memes attached to this Watchlist item */}
                    {itemMemes.length > 0 && (
                      <div className="watch-memes-box">
                        <span className="muted-xs">Мемы с того стрима:</span>
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
                                src={m.imageUrl}
                                alt={m.caption}
                                referrerPolicy="no-referrer"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {canEdit && (
                      <div className="card-mod-actions">
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
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
