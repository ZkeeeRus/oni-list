import React, { useMemo, useState } from 'react';
import {
  Edit3,
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
  onAddWatch: () => void;
  onEditWatch: (item: WatchItem) => void;
  onDeleteWatch: (id: string) => void;
  onAddMeme: (target: { type: 'watch'; id: string; title: string }) => void;
  onViewMeme: (meme: MemeItem) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlist,
  memes,
  canEdit,
  onAddWatch,
  onEditWatch,
  onDeleteWatch,
  onAddMeme,
  onViewMeme,
}) => {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [ratingFilter, setRatingFilter] = useState('ALL');
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);

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

  const selectedDetail = useMemo(
    () =>
      selectedDetailId ? watchlist.find((w) => w.id === selectedDetailId) || null : null,
    [watchlist, selectedDetailId]
  );

  const selectedMemes = selectedDetail
    ? memesByWatchId.get(selectedDetail.id) || []
    : [];

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
            <article
              key={w.id}
              className="media-card"
              onClick={() => setSelectedDetailId(w.id)}
            >
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
                  <div className="card-note conditions-note clamp-2">{w.conditions}</div>
                )}
                {w.comment && <p className="card-comment clamp-3">{w.comment}</p>}

                {/* Stream Memes attached right under this Watchlist item */}
                {itemMemes.length > 0 && (
                  <div
                    className="watch-memes-box"
                    onClick={(e) => e.stopPropagation()}
                  >
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
          );
        })}
      </div>

      {/* Detailed Popup Modal when clicking a Watchlist Card */}
      {selectedDetail && (
        <div className="modal-backdrop" onClick={() => setSelectedDetailId(null)}>
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedDetail.title}</h3>
              <button className="icon-btn" onClick={() => setSelectedDetailId(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body detail-modal-grid">
              <CoverImage
                title={selectedDetail.title}
                coverUrl={selectedDetail.coverUrl}
                badgeText={selectedDetail.category}
                className="detail-modal-cover"
              />
              <div className="detail-modal-info">
                <div className="row-gap-xs wrap">
                  <span className="pill-type watch">{selectedDetail.category}</span>
                  <StatusBadge status={selectedDetail.status} />
                  <RatingBadge rating={selectedDetail.rating} />
                </div>

                <p>
                  <strong>Кто заказал:</strong> {selectedDetail.orderedBy}
                </p>

                {selectedDetail.conditions && (
                  <div className="detail-box">
                    <strong>Условия / описание:</strong>
                    <p style={{ whiteSpace: 'pre-line' }}>{selectedDetail.conditions}</p>
                  </div>
                )}

                {selectedDetail.comment && (
                  <div className="detail-box">
                    <strong>Комментарий / прогресс просмотра:</strong>
                    <p style={{ whiteSpace: 'pre-line' }}>{selectedDetail.comment}</p>
                  </div>
                )}

                {selectedMemes.length > 0 && (
                  <div className="detail-box">
                    <strong>Мемы с этого стрима ({selectedMemes.length}):</strong>
                    <div className="detail-memes-grid">
                      {selectedMemes.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="detail-meme-card"
                          onClick={() => onViewMeme(m)}
                        >
                          <img
                            src={m.imageUrl}
                            alt={m.caption}
                            referrerPolicy="no-referrer"
                          />
                          <span>{m.caption}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {canEdit && (
                  <div className="row-gap-sm wrap" style={{ marginTop: 12 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        onAddMeme({
                          type: 'watch',
                          id: selectedDetail.id,
                          title: selectedDetail.title,
                        })
                      }
                    >
                      <ImagePlus size={14} /> + Прикрепить мем (Ctrl+V)
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const item = selectedDetail;
                        setSelectedDetailId(null);
                        onEditWatch(item);
                      }}
                    >
                      <Edit3 size={14} /> Редактировать тайтл
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
