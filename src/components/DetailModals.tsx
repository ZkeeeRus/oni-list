import React from 'react';
import {
  Edit3,
  ExternalLink,
  ImagePlus,
  Play,
  Video,
  X,
} from 'lucide-react';
import { BacklogItem, GameItem, MemeItem, WatchItem } from '../types';
import { CoverImage } from './CoverImage';
import {
  BACKLOG_STATUSES,
  DropPriceBadge,
  GAME_STATUSES,
  PriorityBadge,
  RATINGS_ORDER,
  RatingBadge,
  ReturnPriceBadge,
  StatusBadge,
  WATCH_STATUSES,
} from './Badges';

export const GameDetailModal: React.FC<{
  game: GameItem;
  memes: MemeItem[];
  canEdit: boolean;
  onClose: () => void;
  onEdit: (g: GameItem) => void;
  onQuickUpdate: (g: GameItem) => void;
  onAddMeme: (g: GameItem) => void;
  onViewMeme: (m: MemeItem) => void;
  onFilterByOrderer?: (orderer: string) => void;
}> = ({
  game,
  memes,
  canEdit,
  onClose,
  onEdit,
  onQuickUpdate,
  onAddMeme,
  onViewMeme,
  onFilterByOrderer,
}) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{game.title}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body detail-modal-grid">
          <CoverImage
            title={game.title}
            coverUrl={game.coverUrl}
            steamAppId={game.steamAppId}
            className="detail-modal-cover"
          />
          <div className="detail-modal-info">
            <div className="row-gap-xs wrap">
              <StatusBadge status={game.status} />
              <RatingBadge rating={game.rating} />
              <DropPriceBadge price={game.dropPrice} />
              <ReturnPriceBadge price={game.returnPrice} />
              {game.hours && <span className="badge">{game.hours} ч.</span>}
            </div>

            <p>
              <strong>Кто заказал:</strong>{' '}
              {onFilterByOrderer && game.orderedBy && game.orderedBy !== '-' ? (
                <button
                  type="button"
                  className="link-inline"
                  onClick={() => {
                    onClose();
                    onFilterByOrderer(game.orderedBy);
                  }}
                >
                  {game.orderedBy}
                </button>
              ) : (
                game.orderedBy
              )}
            </p>

            {canEdit && (
              <div className="form-row-2 detail-quick-controls">
                <div>
                  <label className="field-label">Быстрая смена статуса</label>
                  <select
                    className="input input-sm"
                    value={game.status}
                    onChange={(e) =>
                      onQuickUpdate({ ...game, status: e.target.value })
                    }
                  >
                    {GAME_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Быстрая оценка</label>
                  <select
                    className="input input-sm"
                    value={game.rating}
                    onChange={(e) =>
                      onQuickUpdate({ ...game, rating: e.target.value })
                    }
                  >
                    <option value="">Без оценки</option>
                    {RATINGS_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {game.conditions && (
              <div className="detail-box">
                <strong>Условия прохождения:</strong>
                <p style={{ whiteSpace: 'pre-line' }}>{game.conditions}</p>
              </div>
            )}

            {game.comment && (
              <div className="detail-box">
                <strong>Комментарий / мнение стримера и чата:</strong>
                <p style={{ whiteSpace: 'pre-line' }}>{game.comment}</p>
              </div>
            )}

            {memes.length > 0 && (
              <div className="detail-box">
                <strong>Мемы с этого прохождения ({memes.length}):</strong>
                <div className="detail-memes-grid">
                  {memes.map((m) => (
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

            <div className="row-gap-sm wrap" style={{ marginTop: 10 }}>
              {game.vodUrl && (
                <a
                  href={game.vodUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  <Video size={14} /> Запись стрима (VOD)
                </a>
              )}
              {game.link && (
                <a
                  href={game.link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  <ExternalLink size={14} /> Ссылка / страница
                </a>
              )}
              {canEdit && (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onAddMeme(game)}
                  >
                    <ImagePlus size={14} /> + Мем (Ctrl+V)
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onClose();
                      onEdit(game);
                    }}
                  >
                    <Edit3 size={14} /> Полное редактирование
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const WatchDetailModal: React.FC<{
  item: WatchItem;
  memes: MemeItem[];
  canEdit: boolean;
  onClose: () => void;
  onEdit: (w: WatchItem) => void;
  onQuickUpdate: (w: WatchItem) => void;
  onAddMeme: (w: WatchItem) => void;
  onViewMeme: (m: MemeItem) => void;
}> = ({
  item,
  memes,
  canEdit,
  onClose,
  onEdit,
  onQuickUpdate,
  onAddMeme,
  onViewMeme,
}) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{item.title}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body detail-modal-grid">
          <CoverImage
            title={item.title}
            coverUrl={item.coverUrl}
            badgeText={item.category}
            className="detail-modal-cover"
          />
          <div className="detail-modal-info">
            <div className="row-gap-xs wrap">
              <span className="pill-type watch">{item.category}</span>
              <StatusBadge status={item.status} />
              <RatingBadge rating={item.rating} />
            </div>

            <p>
              <strong>Кто заказал:</strong> {item.orderedBy}
            </p>

            {canEdit && (
              <div className="form-row-2 detail-quick-controls">
                <div>
                  <label className="field-label">Быстрая смена статуса</label>
                  <select
                    className="input input-sm"
                    value={item.status}
                    onChange={(e) =>
                      onQuickUpdate({ ...item, status: e.target.value })
                    }
                  >
                    {WATCH_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Быстрая оценка</label>
                  <select
                    className="input input-sm"
                    value={item.rating}
                    onChange={(e) =>
                      onQuickUpdate({ ...item, rating: e.target.value })
                    }
                  >
                    <option value="">Без оценки</option>
                    {RATINGS_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {item.conditions && (
              <div className="detail-box">
                <strong>Условия / описание:</strong>
                <p style={{ whiteSpace: 'pre-line' }}>{item.conditions}</p>
              </div>
            )}

            {item.comment && (
              <div className="detail-box">
                <strong>Комментарий / прогресс просмотра:</strong>
                <p style={{ whiteSpace: 'pre-line' }}>{item.comment}</p>
              </div>
            )}

            {memes.length > 0 && (
              <div className="detail-box">
                <strong>Мемы с этого стрима ({memes.length}):</strong>
                <div className="detail-memes-grid">
                  {memes.map((m) => (
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
              <div className="row-gap-sm wrap" style={{ marginTop: 10 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onAddMeme(item)}
                >
                  <ImagePlus size={14} /> + Прикрепить мем (Ctrl+V)
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    onClose();
                    onEdit(item);
                  }}
                >
                  <Edit3 size={14} /> Полное редактирование
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BacklogDetailModal: React.FC<{
  item: BacklogItem;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (b: BacklogItem) => void;
  onQuickUpdate: (b: BacklogItem) => void;
  onPromoteToGame: (b: BacklogItem) => void;
}> = ({ item, canEdit, onClose, onEdit, onQuickUpdate, onPromoteToGame }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{item.title}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body detail-modal-grid">
          <CoverImage
            title={item.title}
            coverUrl={item.coverUrl}
            steamAppId={item.steamAppId}
            badgeText={item.genre || undefined}
            className="detail-modal-cover"
          />
          <div className="detail-modal-info">
            <div className="row-gap-xs wrap">
              <StatusBadge status={item.status} />
              <PriorityBadge priority={item.priority} />
            </div>

            {canEdit && (
              <div>
                <label className="field-label">Статус идеи</label>
                <select
                  className="input input-sm"
                  value={item.status}
                  onChange={(e) =>
                    onQuickUpdate({ ...item, status: e.target.value })
                  }
                >
                  {BACKLOG_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {item.idea && (
              <div className="detail-box">
                <strong>Идея для стрима:</strong>
                <p style={{ whiteSpace: 'pre-line' }}>{item.idea}</p>
              </div>
            )}

            {item.notes && (
              <div className="detail-box">
                <strong>Заметки / что попробовать:</strong>
                <p style={{ whiteSpace: 'pre-line' }}>{item.notes}</p>
              </div>
            )}

            <div className="row-gap-sm wrap" style={{ marginTop: 10 }}>
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  <ExternalLink size={14} /> Источник / ссылка
                </a>
              )}
              {canEdit && (
                <>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      onClose();
                      onPromoteToGame(item);
                    }}
                  >
                    <Play size={14} /> Взять на стрим (в Список игр)
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onClose();
                      onEdit(item);
                    }}
                  >
                    <Edit3 size={14} /> Редактировать
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
