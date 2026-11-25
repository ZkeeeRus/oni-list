import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ImagePlus,
  LogIn,
  LogOut,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import {
  BacklogItem,
  GameItem,
  MemeItem,
  RuntimeConfig,
  SiteData,
  TwitchUser,
  UserRole,
  WatchItem,
} from '../types';
import {
  BACKLOG_PRIORITIES,
  BACKLOG_STATUSES,
  GAME_STATUSES,
  RATINGS_ORDER,
  WATCH_CATEGORIES,
  WATCH_STATUSES,
} from './Badges';
import {
  CoverCandidate,
  extractSteamAppId,
  getSteamPortraitUrl,
  searchCoversOnline,
} from '../utils/covers';
import { compressImageToWebpDataUrl } from '../utils/imageCompress';
import { CoverImage } from './CoverImage';
import { getRedirectUri, PERMANENT_ADMINS } from '../services/authAndStorage';

/* ---------- Cover Picker Block ---------- */
const CoverPicker: React.FC<{
  title: string;
  kind: 'game' | 'Аниме' | 'Манга' | 'Фильм' | 'Сериал';
  coverUrl: string;
  steamAppId?: number | null;
  apiBaseUrl: string;
  onChange: (coverUrl: string, steamAppId?: number | null) => void;
}> = ({ title, kind, coverUrl, steamAppId, apiBaseUrl, onChange }) => {
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<CoverCandidate[]>([]);
  const [customQuery, setCustomQuery] = useState('');

  const handleSearch = async () => {
    const q = (customQuery || title).trim();
    if (!q) return;
    setSearching(true);
    try {
      const found = await searchCoversOnline(q, kind, apiBaseUrl);
      setCandidates(found);
      if (found.length > 0 && !coverUrl && !steamAppId) {
        onChange(found[0].url, found[0].steamAppId ?? null);
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="cover-picker-box">
      <div className="cover-picker-row">
        <div className="cover-mini-preview">
          <CoverImage title={title || '?'} coverUrl={coverUrl} steamAppId={steamAppId} />
        </div>
        <div className="cover-picker-controls">
          <label className="field-label">Портрет / обложка (внешняя ссылка, без хранения файла)</label>
          <input
            type="text"
            className="input"
            placeholder="URL обложки или ссылка на игру в Steam (store.steampowered.com/app/...)"
            value={coverUrl}
            onChange={(e) => {
              const val = e.target.value;
              const appId = extractSteamAppId(val);
              if (appId && val.includes('store.steampowered.com')) {
                onChange(getSteamPortraitUrl(appId), appId);
              } else {
                onChange(val, appId ?? steamAppId ?? null);
              }
            }}
          />
          <div className="inline-search-row">
            <input
              type="text"
              className="input input-sm"
              placeholder={title ? `Поиск обложки: ${title}` : 'Название на англ./рус. или Steam ID'}
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleSearch}
              disabled={searching || !(customQuery || title).trim()}
            >
              <Search size={14} />
              {searching ? 'Ищем...' : 'Найти портрет'}
            </button>
          </div>
        </div>
      </div>

      {candidates.length > 0 && (
        <div className="candidates-strip">
          {candidates.map((c) => (
            <button
              key={c.url}
              type="button"
              className={`candidate-thumb ${coverUrl === c.url ? 'selected' : ''}`}
              onClick={() => onChange(c.url, c.steamAppId ?? null)}
              title={`${c.title} (${c.source})`}
            >
              <img src={c.url} alt={c.title} referrerPolicy="no-referrer" />
              <span>{c.source}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------- Game Add/Edit Modal ---------- */
export const GameModal: React.FC<{
  initial?: GameItem | null;
  apiBaseUrl: string;
  onClose: () => void;
  onSave: (game: GameItem) => void;
}> = ({ initial, apiBaseUrl, onClose, onSave }) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [orderedBy, setOrderedBy] = useState(initial?.orderedBy ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'Заказано');
  const [rating, setRating] = useState(initial?.rating ?? '');
  const [conditions, setConditions] = useState(initial?.conditions ?? '');
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [dropPrice, setDropPrice] = useState(initial?.dropPrice ?? '');
  const [returnPrice, setReturnPrice] = useState(initial?.returnPrice ?? '');
  const [link, setLink] = useState(initial?.link ?? '');
  const [vodUrl, setVodUrl] = useState(initial?.vodUrl ?? '');
  const [hours, setHours] = useState(initial?.hours ?? '');
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? '');
  const [steamAppId, setSteamAppId] = useState<number | null>(initial?.steamAppId ?? null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const detectedSteam = steamAppId || extractSteamAppId(link) || extractSteamAppId(coverUrl);
    onSave({
      id: initial?.id || `game-${Date.now()}`,
      title: title.trim(),
      orderedBy: orderedBy.trim() || '-',
      status,
      rating,
      conditions: conditions.trim(),
      comment: comment.trim(),
      dropPrice: dropPrice.trim(),
      returnPrice: returnPrice.trim(),
      link: link.trim(),
      vodUrl: vodUrl.trim(),
      hours: hours.trim(),
      coverUrl:
        coverUrl.trim() || (detectedSteam ? getSteamPortraitUrl(detectedSteam) : ''),
      steamAppId: detectedSteam ?? null,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial ? 'Редактировать игру' : 'Добавить игру в список'}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body form-grid">
          <div className="form-row-2">
            <div>
              <label className="field-label">Название игры *</label>
              <input
                className="input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Persona 3 Reload"
              />
            </div>
            <div>
              <label className="field-label">Кто заказал</label>
              <input
                className="input"
                value={orderedBy}
                onChange={(e) => setOrderedBy(e.target.value)}
                placeholder="Ник зрителя или Стример"
              />
            </div>
          </div>

          <div className="form-row-3">
            <div>
              <label className="field-label">Статус прохождения</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {GAME_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Оценка</label>
              <select className="input" value={rating} onChange={(e) => setRating(e.target.value)}>
                <option value="">Без оценки</option>
                {RATINGS_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Кол-во часов</label>
              <input
                className="input"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="Напр. 14"
              />
            </div>
          </div>

          <CoverPicker
            title={title}
            kind="game"
            coverUrl={coverUrl}
            steamAppId={steamAppId}
            apiBaseUrl={apiBaseUrl}
            onChange={(u, sid) => {
              setCoverUrl(u);
              setSteamAppId(sid ?? null);
            }}
          />

          <div className="form-row-2">
            <div>
              <label className="field-label">Цена дропа зрителями (если был выкуп/дроп)</label>
              <input
                className="input"
                value={dropPrice}
                onChange={(e) => setDropPrice(e.target.value)}
                placeholder="Напр.: 250 ₽ или 750 ₽"
              />
            </div>
            <div>
              <label className="field-label">Сумма возврата игры (если вернули)</label>
              <input
                className="input"
                value={returnPrice}
                onChange={(e) => setReturnPrice(e.target.value)}
                placeholder="Напр.: 2700 ₽ или 6000 ₽ (Палс)"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Условия заказа</label>
            <textarea
              className="input textarea-sm"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="Особые условия прохождения, билд, сложность, моды..."
            />
          </div>

          <div>
            <label className="field-label">Комментарий / отзыв стримера и мнение чата</label>
            <textarea
              className="input"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Впечатления от игры, причина дропа или цитата из чата..."
            />
          </div>

          <div className="form-row-2">
            <div>
              <label className="field-label">Ссылка (Steam / моды / сборка)</label>
              <input
                className="input"
                value={link}
                onChange={(e) => {
                  const v = e.target.value;
                  setLink(v);
                  const sid = extractSteamAppId(v);
                  if (sid && !coverUrl) {
                    setSteamAppId(sid);
                    setCoverUrl(getSteamPortraitUrl(sid));
                  }
                }}
                placeholder="https://store.steampowered.com/app/..."
              />
            </div>
            <div>
              <label className="field-label">Ссылка на запись стрима (VOD)</label>
              <input
                className="input"
                value={vodUrl}
                onChange={(e) => setVodUrl(e.target.value)}
                placeholder="https://vk.com/videos-85096257?..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------- Watchlist Add/Edit Modal ---------- */
export const WatchModal: React.FC<{
  initial?: WatchItem | null;
  apiBaseUrl: string;
  onClose: () => void;
  onSave: (item: WatchItem) => void;
}> = ({ initial, apiBaseUrl, onClose, onSave }) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<string>(initial?.category ?? 'Фильм');
  const [orderedBy, setOrderedBy] = useState(initial?.orderedBy ?? '');
  const [status, setStatus] = useState<string>(initial?.status ?? 'Заказано');
  const [rating, setRating] = useState(initial?.rating ?? '');
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [conditions, setConditions] = useState(initial?.conditions ?? '');
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: initial?.id || `watch-${Date.now()}`,
      title: title.trim(),
      category,
      orderedBy: orderedBy.trim() || '-',
      status,
      rating,
      comment: comment.trim(),
      conditions: conditions.trim(),
      coverUrl: coverUrl.trim(),
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial ? 'Редактировать тайтл' : 'Добавить в просмотровый список'}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body form-grid">
          <div className="form-row-2">
            <div>
              <label className="field-label">Название тайтла *</label>
              <input
                className="input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Фильм, аниме, сериал или манга"
              />
            </div>
            <div>
              <label className="field-label">Кто заказал</label>
              <input
                className="input"
                value={orderedBy}
                onChange={(e) => setOrderedBy(e.target.value)}
                placeholder="Ник зрителя"
              />
            </div>
          </div>

          <div className="form-row-3">
            <div>
              <label className="field-label">Категория</label>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {WATCH_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Статус просмотра</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {WATCH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Оценка</label>
              <select className="input" value={rating} onChange={(e) => setRating(e.target.value)}>
                <option value="">Без оценки</option>
                {RATINGS_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <CoverPicker
            title={title}
            kind={(category as any) || 'Фильм'}
            coverUrl={coverUrl}
            apiBaseUrl={apiBaseUrl}
            onChange={(u) => setCoverUrl(u)}
          />

          <div className="form-row-2">
            <div>
              <label className="field-label">Комментарий / прогресс серий</label>
              <textarea
                className="input textarea-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Напр.: 4/12 серий или впечатления от просмотра"
              />
            </div>
            <div>
              <label className="field-label">Условия / описание</label>
              <textarea
                className="input textarea-sm"
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="Дополнительная заметка..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------- Stream Meme Add Modal (Ctrl+V + File + URL) ---------- */
export const MemeModal: React.FC<{
  watchlist: WatchItem[];
  games: GameItem[];
  preselectedTarget?: { type: 'watch' | 'game' | 'general'; id: string; title: string } | null;
  authorName: string;
  onClose: () => void;
  onSave: (meme: MemeItem) => void;
}> = ({ watchlist, games, preselectedTarget, authorName, onClose, onSave }) => {
  const [targetType, setTargetType] = useState<'watch' | 'game' | 'general'>(
    preselectedTarget?.type ?? 'watch'
  );
  const [targetId, setTargetId] = useState<string>(
    preselectedTarget?.id ?? (watchlist[0]?.id || '')
  );
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [compressing, setCompressing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            setCompressing(true);
            try {
              const webp = await compressImageToWebpDataUrl(f);
              setImageUrl(webp);
            } finally {
              setCompressing(false);
            }
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCompressing(true);
    try {
      const webp = await compressImageToWebpDataUrl(f);
      setImageUrl(webp);
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) return;
    let resolvedTitle = 'Общий мем стрима';
    if (targetType === 'watch') {
      resolvedTitle = watchlist.find((w) => w.id === targetId)?.title || '';
    } else if (targetType === 'game') {
      resolvedTitle = games.find((g) => g.id === targetId)?.title || '';
    }
    onSave({
      id: `meme-${Date.now()}`,
      targetType,
      targetId: targetType === 'general' ? '' : targetId,
      targetTitle: resolvedTitle,
      imageUrl: imageUrl.trim(),
      caption: caption.trim() || resolvedTitle,
      addedBy: authorName || 'Модератор',
      createdAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Добавить мем со стрима на память</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body form-grid">
          <div
            className="paste-dropzone"
            onClick={() => fileRef.current?.click()}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="Превью мема" className="meme-upload-preview" />
            ) : (
              <div className="paste-dropzone-empty">
                <ImagePlus size={32} />
                <p>
                  Нажмите <strong>Ctrl+V</strong>, чтобы вставить скриншот/мем из буфера обмена,
                  или кликните для выбора файла
                </p>
                <span>Картинка автоматически сжимается в лёгкий WebP (~35 КБ)</span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileChange}
            />
          </div>

          <div>
            <label className="field-label">Или прямая ссылка на картинку (URL)</label>
            <input
              className="input"
              value={imageUrl.startsWith('data:') ? '' : imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="form-row-2">
            <div>
              <label className="field-label">Привязка к разделу</label>
              <select
                className="input"
                value={targetType}
                onChange={(e) => {
                  const nextType = e.target.value as 'watch' | 'game' | 'general';
                  setTargetType(nextType);
                  if (nextType === 'watch') setTargetId(watchlist[0]?.id || '');
                  if (nextType === 'game') setTargetId(games[0]?.id || '');
                }}
              >
                <option value="watch">Тайтл из просмотрового</option>
                <option value="game">Игра из списка</option>
                <option value="general">Общий мем канала</option>
              </select>
            </div>

            {targetType !== 'general' && (
              <div>
                <label className="field-label">Выберите тайтл / игру</label>
                <select
                  className="input"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  {(targetType === 'watch' ? watchlist : games).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="field-label">Подпись к мему (локальный прикол / цитата)</label>
            <input
              className="input"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Напр.: 9.5 Яндекс.Такси / 10"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={compressing || !imageUrl.trim()}
            >
              {compressing ? 'Сжимаем...' : 'Сохранить мем'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------- Meme Lightbox ---------- */
export const MemeLightbox: React.FC<{
  meme: MemeItem;
  canEdit: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}> = ({ meme, canEdit, onClose, onDelete }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-top">
          <div>
            <strong>{meme.caption || meme.targetTitle}</strong>
            {meme.targetTitle && meme.caption !== meme.targetTitle && (
              <span className="lightbox-sub"> • {meme.targetTitle}</span>
            )}
          </div>
          <div className="row-gap-sm">
            {canEdit && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  onDelete(meme.id);
                  onClose();
                }}
              >
                <Trash2 size={14} /> Удалить
              </button>
            )}
            <button className="icon-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="lightbox-img-wrap">
          <img src={meme.imageUrl} alt={meme.caption} referrerPolicy="no-referrer" />
        </div>
        <div className="lightbox-meta">
          Добавил: <strong>{meme.addedBy}</strong> • {meme.createdAt}
        </div>
      </div>
    </div>
  );
};

/* ---------- Backlog Add/Edit Modal ---------- */
export const BacklogModal: React.FC<{
  initial?: BacklogItem | null;
  apiBaseUrl: string;
  onClose: () => void;
  onSave: (item: BacklogItem) => void;
}> = ({ initial, apiBaseUrl, onClose, onSave }) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [genre, setGenre] = useState(initial?.genre ?? '');
  const [idea, setIdea] = useState(initial?.idea ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [priority, setPriority] = useState<string>(initial?.priority ?? 'Средний');
  const [status, setStatus] = useState<string>(initial?.status ?? 'Готово к стриму');
  const [link, setLink] = useState(initial?.link ?? '');
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? '');
  const [steamAppId, setSteamAppId] = useState<number | null>(initial?.steamAppId ?? null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: initial?.id || `backlog-${Date.now()}`,
      title: title.trim(),
      genre: genre.trim(),
      idea: idea.trim(),
      notes: notes.trim(),
      priority,
      status,
      link: link.trim(),
      coverUrl: coverUrl.trim(),
      steamAppId,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial ? 'Редактировать идею бэклога' : 'Добавить идею в бэклог'}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body form-grid">
          <div className="form-row-2">
            <div>
              <label className="field-label">Игра / идея для стрима *</label>
              <input
                className="input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Напр.: Elden Ring или Просмотр трилогии..."
              />
            </div>
            <div>
              <label className="field-label">Жанр / формат</label>
              <input
                className="input"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="RPG, челлендж, кинострим..."
              />
            </div>
          </div>

          <div className="form-row-2">
            <div>
              <label className="field-label">Приоритет</label>
              <select
                className="input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {BACKLOG_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Статус идеи</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {BACKLOG_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <CoverPicker
            title={title}
            kind="game"
            coverUrl={coverUrl}
            steamAppId={steamAppId}
            apiBaseUrl={apiBaseUrl}
            onChange={(u, sid) => {
              setCoverUrl(u);
              setSteamAppId(sid ?? null);
            }}
          />

          <div className="form-row-2">
            <div>
              <label className="field-label">Суть идеи для стрима</label>
              <textarea
                className="input textarea-sm"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Прохождение с модом, марафон, кооп..."
              />
            </div>
            <div>
              <label className="field-label">Заметки / что подготовить</label>
              <textarea
                className="input textarea-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Детали настройки, сколько серий уже посмотрели и т.д."
              />
            </div>
          </div>

          <div>
            <label className="field-label">Ссылка / источник (мод, коллекция)</label>
            <input
              className="input"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------- Twitch Auth & Moderator / DB Settings Modal ---------- */
export const AdminSettingsModal: React.FC<{
  user: TwitchUser | null;
  role: UserRole;
  data: SiteData;
  cfg: RuntimeConfig;
  dataSource: 'remote' | 'local' | 'seed';
  onClose: () => void;
  onTwitchLogin: (clientId: string) => void;
  onPreviewLogin: (login: 'onized' | 'zkeeerus') => void;
  onLogout: () => void;
  onSaveConfig: (nextCfg: Partial<RuntimeConfig>) => void;
  onUpdateModerators: (mods: string[]) => void;
  onImportJson: (imported: SiteData) => void;
}> = ({
  user,
  role,
  data,
  cfg,
  dataSource,
  onClose,
  onTwitchLogin,
  onPreviewLogin,
  onLogout,
  onSaveConfig,
  onUpdateModerators,
  onImportJson,
}) => {
  const [clientIdInput, setClientIdInput] = useState(cfg.twitchClientId);
  const [apiUrlInput, setApiUrlInput] = useState(cfg.apiBaseUrl);
  const [newMod, setNewMod] = useState('');
  const [copiedUri, setCopiedUri] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);
  const redirectUri = getRedirectUri();

  const canManageMods = role === 'admin' || role === 'moderator';

  const handleCopyUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `onized-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const parsed = JSON.parse(txt) as SiteData;
      if (Array.isArray(parsed.games) && Array.isArray(parsed.watchlist)) {
        onImportJson(parsed);
        onClose();
      }
    } catch {
      alert('Не удалось прочитать JSON-файл резервной копии.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <Shield size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Доступ Twitch, модераторы и база данных
          </h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body form-grid">
          {/* Current User Status */}
          <div className="settings-section">
            <h4>Ваш профиль и роль</h4>
            {user ? (
              <div className="user-status-row">
                <div className="row-gap-sm">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} className="avatar-md" />
                  ) : (
                    <div className="avatar-placeholder">{user.displayName[0]?.toUpperCase()}</div>
                  )}
                  <div>
                    <div>
                      <strong>{user.displayName}</strong>{' '}
                      <span className="muted">(@{user.login})</span>
                      {user.isPreview && (
                        <span className="badge prio-mid" style={{ marginLeft: 8 }}>
                          Локальный тест-режим
                        </span>
                      )}
                    </div>
                    <div className="muted-sm">
                      Роль:{' '}
                      <strong>
                        {role === 'admin'
                          ? 'Админ (Стример / Владелец)'
                          : role === 'moderator'
                          ? 'Модератор (полный доступ редактора)'
                          : 'Зритель (просмотр)'}
                      </strong>
                    </div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={onLogout}>
                  <LogOut size={14} /> Выйти
                </button>
              </div>
            ) : (
              <div className="login-box">
                <p className="muted-sm">
                  Зрителям вход не обязателен. Стример (<strong>onized</strong>), создатель (
                  <strong>zkeeerus</strong>) и добавленные модераторы входят через Twitch и получают
                  полный доступ к редактированию.
                </p>
                <div className="row-gap-sm wrap">
                  <button
                    type="button"
                    className="btn btn-twitch"
                    onClick={() => {
                      if (!clientIdInput.trim()) {
                        alert(
                          'Сначала вставьте Client ID вашего бесплатного приложения Twitch в поле ниже (занимает 1 минуту на dev.twitch.tv).'
                        );
                        return;
                      }
                      onSaveConfig({ twitchClientId: clientIdInput.trim() });
                      onTwitchLogin(clientIdInput.trim());
                    }}
                  >
                    <LogIn size={16} /> Войти через Twitch
                  </button>

                  {!cfg.apiBaseUrl && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onPreviewLogin('zkeeerus')}
                        title="Быстрый локальный тест интерфейса редактора до подключения сервера БД"
                      >
                        <Sparkles size={14} /> Тест от ZkeeeRus
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onPreviewLogin('onized')}
                      >
                        <Sparkles size={14} /> Тест от OniZeD
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Admins & Moderators */}
          <div className="settings-section">
            <h4>Админы и модераторы (единый доступ к правкам)</h4>
            <div className="chips-wrap">
              {PERMANENT_ADMINS.map((adm) => (
                <span key={adm} className="mod-chip owner-chip">
                  👑 {adm} <small>(админ)</small>
                </span>
              ))}
              {data.moderators.map((mod) => (
                <span key={mod} className="mod-chip">
                  ⚔️ {mod}
                  {canManageMods && (
                    <button
                      type="button"
                      className="chip-del"
                      onClick={() =>
                        onUpdateModerators(data.moderators.filter((m) => m !== mod))
                      }
                      title="Убрать модератора"
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>

            {canManageMods && (
              <div className="inline-search-row" style={{ marginTop: 10 }}>
                <input
                  className="input input-sm"
                  placeholder="Ник модератора на Twitch (напр. samarhik, s1men5)"
                  value={newMod}
                  onChange={(e) => setNewMod(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const clean = newMod.toLowerCase().trim().replace(/^@/, '');
                    if (
                      clean &&
                      !PERMANENT_ADMINS.includes(clean) &&
                      !data.moderators.includes(clean)
                    ) {
                      onUpdateModerators([...data.moderators, clean]);
                      setNewMod('');
                    }
                  }}
                >
                  <UserPlus size={14} /> Добавить модератора
                </button>
              </div>
            )}
          </div>

          {/* Connection Config */}
          <div className="settings-section">
            <h4>Подключение Twitch OAuth и бесплатной облачной БД (работает в РФ без VPN)</h4>
            <p className="muted-sm">
              Источник данных сейчас:{' '}
              <strong>
                {dataSource === 'remote'
                  ? 'Облачная БД (синхронизировано для всех)'
                  : dataSource === 'local'
                  ? 'Локальный черновик браузера + база из Excel'
                  : 'База из Excel (369 игр, 34 тайтла, 6 мемов, 24 идеи бэклога)'}
              </strong>
            </p>

            <div className="form-grid" style={{ marginTop: 10 }}>
              <div>
                <label className="field-label">
                  1. OAuth Redirect URL для консоли dev.twitch.tv/console/apps
                </label>
                <div className="inline-search-row">
                  <input className="input input-sm" readOnly value={redirectUri} />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyUri}>
                    {copiedUri ? <Check size={14} /> : <Copy size={14} />}
                    {copiedUri ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
              </div>

              <div className="form-row-2">
                <div>
                  <label className="field-label">2. Публичный Twitch Client ID</label>
                  <input
                    className="input input-sm"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    placeholder="Client ID из dev.twitch.tv"
                  />
                </div>
                <div>
                  <label className="field-label">
                    3. URL бэкенда БД (Yandex Cloud Serverless / SQLite API)
                  </label>
                  <input
                    className="input input-sm"
                    value={apiUrlInput}
                    onChange={(e) => setApiUrlInput(e.target.value)}
                    placeholder="https://functions.yandexcloud.net/..."
                  />
                </div>
              </div>

              <div className="row-between wrap">
                <div className="row-gap-sm">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      onSaveConfig({
                        twitchClientId: clientIdInput.trim(),
                        apiBaseUrl: apiUrlInput.trim(),
                      });
                      alert('Настройки подключения сохранены!');
                    }}
                  >
                    Сохранить подключение
                  </button>
                </div>

                <div className="row-gap-sm">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleExport}>
                    <Download size={14} /> Скачать JSON бэкап
                  </button>
                  {canManageMods && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => importRef.current?.click()}
                      >
                        <Upload size={14} /> Импорт JSON
                      </button>
                      <input
                        ref={importRef}
                        type="file"
                        accept="application/json"
                        hidden
                        onChange={handleFileImport}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
