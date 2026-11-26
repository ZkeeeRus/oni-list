import React from 'react';
import {
  Clock,
  Edit3,
  ExternalLink,
  Play,
  Video,
  X,
} from 'lucide-react';
import { BacklogItem, GameItem, MemeItem, WatchItem } from '../types';
import { CoverImage } from './CoverImage';
import { resolveMemeImageUrl } from '../utils/builtinMemes';
import {
  getGameHltbUrl,
  getGameSteamStoreUrl,
  lookupGameMeta,
  useGameMetaMap,
} from '../utils/gameMeta';
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
  onViewMeme: (m: MemeItem) => void;
  onEditMeme?: (m: MemeItem) => void;
  onFilterByOrderer?: (orderer: string) => void;
}> = ({
  game,
  memes,
  canEdit,
  onClose,
  onEdit,
  onQuickUpdate,
  onViewMeme,
  onEditMeme,
  onFilterByOrderer,
}) => {
  const metaMap = useGameMetaMap();
  const meta = lookupGameMeta(game, metaMap);
  const steamUrl = getGameSteamStoreUrl(game);
  const hltbUrl = getGameHltbUrl(game.title, meta);
  const extraLink =
    game.link && !game.link.includes('store.steampowered.com') ? game.link : '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>{game.title}</h3>
            {canEdit && (
              <button
                type="button"
                className="icon-btn header-edit-btn"
                onClick={() => onEdit(game)}
                title="Редактировать игру"
              >
                <Edit3 size={16} />
              </button>
            )}
          </div>
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
              {game.hours ? (
                <span className="badge">{game.hours} ч.</span>
              ) : meta?.estHours ? (
                <span className="badge meta-pill-time">{meta.estHours}</span>
              ) : null}
              {meta?.steamScore && (
                <span className="badge meta-pill-steam">Steam {meta.steamScore}%</span>
              )}
              {meta?.year && <span className="badge">{meta.year}</span>}
            </div>

            {(meta?.genres || meta?.dev) && (
              <div className="muted-sm">
                {[meta.genres, meta.dev].filter(Boolean).join(' • ')}
              </div>
            )}

            <p>
              <strong>Кто заказал:</strong>{' '}
              {onFilterByOrderer && game.orderedBy && game.orderedBy !== '-' ? (
                <button
                  type="button"
                  className="link-inline"
                  onClick={() => onFilterByOrderer(game.orderedBy)}
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
                    <div key={m.id} className="detail-meme-wrap">
                      <button
                        type="button"
                        className="detail-meme-card"
                        onClick={() => onViewMeme(m)}
                      >
                        <img
                          src={resolveMemeImageUrl(m.imageUrl)}
                          alt={m.caption}
                          referrerPolicy="no-referrer"
                        />
                        <span>{m.caption}</span>
                      </button>
                      {canEdit && onEditMeme && (
                        <button
                          type="button"
                          className="meme-card-edit-btn"
                          title="Редактировать мем"
                          onClick={() => onEditMeme(m)}
                        >
                          <Edit3 size={12} />
                        </button>
                      )}
                    </div>
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
              {steamUrl && (
                <a
                  href={steamUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  <ExternalLink size={14} /> Steam
                </a>
              )}
              <a
                href={hltbUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <Clock size={14} /> HowLongToBeat
              </a>
              {extraLink && (
                <a
                  href={extraLink}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  <ExternalLink size={14} /> Ссылка / моды
                </a>
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
  onViewMeme: (m: MemeItem) => void;
  onEditMeme?: (m: MemeItem) => void;
}> = ({
  item,
  memes,
  canEdit,
  onClose,
  onEdit,
  onQuickUpdate,
  onViewMeme,
  onEditMeme,
}) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>{item.title}</h3>
            {canEdit && (
              <button
                type="button"
                className="icon-btn header-edit-btn"
                onClick={() => onEdit(item)}
                title="Редактировать тайтл"
              >
                <Edit3 size={16} />
              </button>
            )}
          </div>
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
                    <div key={m.id} className="detail-meme-wrap">
                      <button
                        type="button"
                        className="detail-meme-card"
                        onClick={() => onViewMeme(m)}
                      >
                        <img
                          src={resolveMemeImageUrl(m.imageUrl)}
                          alt={m.caption}
                          referrerPolicy="no-referrer"
                        />
                        <span>{m.caption}</span>
                      </button>
                      {canEdit && onEditMeme && (
                        <button
                          type="button"
                          className="meme-card-edit-btn"
                          title="Редактировать мем"
                          onClick={() => onEditMeme(m)}
                        >
                          <Edit3 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
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
          <div className="modal-title-group">
            <h3>{item.title}</h3>
            {canEdit && (
              <button
                type="button"
                className="icon-btn header-edit-btn"
                onClick={() => onEdit(item)}
                title="Редактировать идею"
              >
                <Edit3 size={16} />
              </button>
            )}
          </div>
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

            {(item.link || canEdit) && (
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
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      onClose();
                      onPromoteToGame(item);
                    }}
                  >
                    <Play size={14} /> Взять на стрим (в Список игр)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
