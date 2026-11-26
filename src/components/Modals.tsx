import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Edit3,
  ImageOff,
  ImagePlus,
  LogOut,
  Search,
  Shield,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import {
  BacklogItem,
  GameItem,
  MemeItem,
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
  isForcedNoCover,
  NO_COVER_TOKEN,
  searchCoversOnline,
} from '../utils/covers';
import {
  compressCoverToWebpDataUrl,
  compressImageToWebpDataUrl,
  formatDataUrlKb,
} from '../utils/imageCompress';
import { resolveMemeImageUrl } from '../utils/builtinMemes';
import { CoverImage } from './CoverImage';
import { OrdererAutocomplete } from './OrdererAutocomplete';
import { normalizeOrdererName, OrdererStat } from '../utils/orderers';
import { ExistingMatch, findExistingMatches } from '../utils/duplicates';
import { PERMANENT_ADMINS } from '../services/authAndStorage';

const preventInputEnterSubmit = (e: React.KeyboardEvent<HTMLFormElement>) => {
  if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName === 'INPUT') {
    e.preventDefault();
  }
};

const DuplicateNotice: React.FC<{ matches: ExistingMatch[] }> = ({ matches }) => {
  if (matches.length === 0) return null;
  return (
    <div className="duplicate-hint-box">
      <div className="duplicate-hint-head">
        <AlertTriangle size={15} />
        <strong>Похожие позиции уже есть в базе (добавление не блокируется):</strong>
      </div>
      <div className="duplicate-hint-list">
        {matches.map((m) => (
          <div key={`${m.section}-${m.id}`} className="duplicate-hint-row">
            <span className="dup-section-pill">{m.section}</span>
            <strong>{m.title}</strong>
            <span className="muted-xs">
              ({m.status} • {m.sub})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

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
  const [compressing, setCompressing] = useState(false);
  const [candidates, setCandidates] = useState<CoverCandidate[]>([]);
  const [customQuery, setCustomQuery] = useState('');
  const coverFileRef = useRef<HTMLInputElement | null>(null);

  const forcedPlaceholder = isForcedNoCover(coverUrl);
  const isUploadedFile = coverUrl.startsWith('data:image/');

  const applyCoverFile = async (file: File) => {
    setCompressing(true);
    try {
      const webp = await compressCoverToWebpDataUrl(file);
      onChange(webp, null);
    } catch (err: any) {
      alert(err?.message || 'Не удалось сжать картинку');
    } finally {
      setCompressing(false);
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            applyCoverFile(f);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

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
    <div
      className="cover-picker-box"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer?.files?.[0];
        if (f && f.type.startsWith('image/')) {
          applyCoverFile(f);
        }
      }}
    >
      <div className="cover-picker-row">
        <div
          className="cover-mini-preview"
          onClick={() => coverFileRef.current?.click()}
          style={{ cursor: 'pointer' }}
          title="Нажмите, чтобы загрузить обложку из файла"
        >
          <CoverImage title={title || '?'} coverUrl={coverUrl} steamAppId={steamAppId} />
        </div>
        <div className="cover-picker-controls">
          <label className="field-label">
            Обложка (ссылка, автопоиск, файл или Ctrl+V скриншота - автосжатие ~12-18 КБ WebP)
          </label>
          <input
            type="text"
            className="input"
            placeholder={
              isUploadedFile
                ? `Загружена сжатая обложка из файла (${formatDataUrlKb(coverUrl)}) - вставьте URL для замены`
                : forcedPlaceholder
                  ? 'Выбрана заглушка «Обложка не найдена» - вставьте URL для замены'
                  : 'URL обложки или ссылка на игру в Steam (store.steampowered.com/app/...)'
            }
            value={forcedPlaceholder || isUploadedFile ? '' : coverUrl}
            onChange={(e) => {
              const val = e.target.value;
              const appId = extractSteamAppId(val);
              if (appId && val.includes('store.steampowered.com')) {
                onChange(getSteamPortraitUrl(appId), appId);
              } else {
                onChange(val, appId ?? null);
              }
            }}
          />
          <div className="inline-search-row" style={{ flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input input-sm"
              placeholder={title ? `Поиск обложки: ${title}` : 'Название на англ./рус. или Steam ID'}
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSearch();
                }
              }}
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
            <button
              type="button"
              className={`btn btn-sm ${isUploadedFile ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => coverFileRef.current?.click()}
              disabled={compressing}
              title="Выбрать картинку с ПК (сожмется в легкий WebP ~12-18 КБ)"
            >
              <Upload size={14} />
              {compressing
                ? 'Сжимаем...'
                : isUploadedFile
                  ? `Из файла (${formatDataUrlKb(coverUrl)})`
                  : 'Из файла'}
            </button>
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) applyCoverFile(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className={`btn btn-sm ${forcedPlaceholder ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onChange(NO_COVER_TOKEN, null)}
              title="Поставить фирменную заглушку «Обложка не найдена»"
            >
              <ImageOff size={14} />
              {forcedPlaceholder ? 'Стоит заглушка' : 'Поставить заглушку'}
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
  orderers: OrdererStat[];
  siteData: SiteData;
  onClose: () => void;
  onSave: (game: GameItem) => void;
  onDelete?: (id: string) => void;
  onAddMeme?: (game: GameItem) => void;
}> = ({
  initial,
  apiBaseUrl,
  orderers,
  siteData,
  onClose,
  onSave,
  onDelete,
  onAddMeme,
}) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const existingMatches = useMemo(
    () => findExistingMatches(title, siteData, initial?.id),
    [title, siteData, initial?.id]
  );
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
    const forcedNoCover = isForcedNoCover(coverUrl);
    const isUploadedCover = coverUrl.startsWith('data:image/');
    const detectedSteam =
      forcedNoCover || isUploadedCover
        ? null
        : steamAppId || extractSteamAppId(link) || extractSteamAppId(coverUrl);
    onSave({
      id: initial?.id || `game-${Date.now()}`,
      title: title.trim(),
      orderedBy: normalizeOrdererName(orderedBy),
      status,
      rating,
      conditions: conditions.trim(),
      comment: comment.trim(),
      dropPrice: dropPrice.trim(),
      returnPrice: returnPrice.trim(),
      link: link.trim(),
      vodUrl: vodUrl.trim(),
      hours: hours.trim(),
      coverUrl: forcedNoCover
        ? NO_COVER_TOKEN
        : coverUrl.trim() || (detectedSteam ? getSteamPortraitUrl(detectedSteam) : ''),
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
        <form
          onSubmit={handleSubmit}
          onKeyDown={preventInputEnterSubmit}
          className="modal-body form-grid"
        >
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
              <OrdererAutocomplete
                variant="form"
                value={orderedBy}
                onChange={setOrderedBy}
                orderers={orderers}
                placeholder="Ник зрителя или Стример"
              />
            </div>
          </div>

          <DuplicateNotice matches={existingMatches} />

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

          <div className="modal-footer modal-footer-split">
            <div className="row-gap-xs wrap">
              {initial && onDelete && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm(`Удалить «${initial.title}» из списка игр?`)) {
                      onDelete(initial.id);
                      onClose();
                    }
                  }}
                >
                  <Trash2 size={14} /> Удалить
                </button>
              )}
              {initial && onAddMeme && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onAddMeme(initial)}
                >
                  <ImagePlus size={14} /> + Мем
                </button>
              )}
            </div>
            <div className="row-gap-sm">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary">
                Сохранить
              </button>
            </div>
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
  orderers: OrdererStat[];
  siteData: SiteData;
  onClose: () => void;
  onSave: (item: WatchItem) => void;
  onDelete?: (id: string) => void;
  onAddMeme?: (item: WatchItem) => void;
}> = ({
  initial,
  apiBaseUrl,
  orderers,
  siteData,
  onClose,
  onSave,
  onDelete,
  onAddMeme,
}) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const existingMatches = useMemo(
    () => findExistingMatches(title, siteData, initial?.id),
    [title, siteData, initial?.id]
  );
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
      orderedBy: normalizeOrdererName(orderedBy),
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
        <form
          onSubmit={handleSubmit}
          onKeyDown={preventInputEnterSubmit}
          className="modal-body form-grid"
        >
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
              <OrdererAutocomplete
                variant="form"
                value={orderedBy}
                onChange={setOrderedBy}
                orderers={orderers}
                placeholder="Ник зрителя или Стример"
              />
            </div>
          </div>

          <DuplicateNotice matches={existingMatches} />

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

          <div className="modal-footer modal-footer-split">
            <div className="row-gap-xs wrap">
              {initial && onDelete && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm(`Удалить «${initial.title}» из просмотрового?`)) {
                      onDelete(initial.id);
                      onClose();
                    }
                  }}
                >
                  <Trash2 size={14} /> Удалить
                </button>
              )}
              {initial && onAddMeme && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onAddMeme(initial)}
                >
                  <ImagePlus size={14} /> + Мем
                </button>
              )}
            </div>
            <div className="row-gap-sm">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary">
                Сохранить
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------- Stream Meme Add / Edit Modal (Ctrl+V + File + URL) ---------- */
export const MemeModal: React.FC<{
  watchlist: WatchItem[];
  games: GameItem[];
  preselectedTarget?: { type: 'watch' | 'game' | 'general'; id: string; title: string } | null;
  initialMeme?: MemeItem | null;
  authorName: string;
  onClose: () => void;
  onSave: (meme: MemeItem) => void;
  onDelete?: (id: string) => void;
}> = ({
  watchlist,
  games,
  preselectedTarget,
  initialMeme,
  authorName,
  onClose,
  onSave,
  onDelete,
}) => {
  const [targetType, setTargetType] = useState<'watch' | 'game' | 'general'>(
    initialMeme?.targetType ?? preselectedTarget?.type ?? 'watch'
  );
  const [targetId, setTargetId] = useState<string>(
    initialMeme?.targetId ?? preselectedTarget?.id ?? (watchlist[0]?.id || '')
  );
  const [imageUrl, setImageUrl] = useState(initialMeme?.imageUrl ?? '');
  const [caption, setCaption] = useState(initialMeme?.caption ?? '');
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
      id: initialMeme?.id || `meme-${Date.now()}`,
      targetType,
      targetId: targetType === 'general' ? '' : targetId,
      targetTitle: resolvedTitle,
      imageUrl: imageUrl.trim(),
      caption: caption.trim() || resolvedTitle,
      addedBy: initialMeme?.addedBy || authorName || 'Модератор',
      createdAt: initialMeme?.createdAt || new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initialMeme ? 'Редактировать мем' : 'Добавить мем со стрима на память'}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          onKeyDown={preventInputEnterSubmit}
          className="modal-body form-grid"
        >
          <div
            className="paste-dropzone"
            onClick={() => fileRef.current?.click()}
          >
            {imageUrl ? (
              <img src={resolveMemeImageUrl(imageUrl)} alt="Превью мема" className="meme-upload-preview" />
            ) : (
              <div className="paste-dropzone-empty">
                <ImagePlus size={32} />
                <p>
                  Нажмите <strong>Ctrl+V</strong>, чтобы вставить скриншот/мем из буфера обмена,
                  или кликните для выбора файла
                </p>
                <span>Картинка автоматически сжимается в легкий WebP (~15-28 КБ)</span>
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

          <div className="modal-footer modal-footer-split">
            <div>
              {initialMeme && onDelete && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm('Удалить этот мем?')) {
                      onDelete(initialMeme.id);
                      onClose();
                    }
                  }}
                >
                  <Trash2 size={14} /> Удалить
                </button>
              )}
            </div>
            <div className="row-gap-sm">
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
  onEdit: (meme: MemeItem) => void;
}> = ({ meme, canEdit, onClose, onEdit }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-top">
          <div className="modal-title-group">
            <strong>{meme.caption || meme.targetTitle}</strong>
            {meme.targetTitle && meme.caption !== meme.targetTitle && (
              <span className="lightbox-sub"> • {meme.targetTitle}</span>
            )}
            {canEdit && (
              <button
                type="button"
                className="icon-btn header-edit-btn"
                onClick={() => {
                  onClose();
                  onEdit(meme);
                }}
                title="Редактировать или удалить мем"
              >
                <Edit3 size={15} />
              </button>
            )}
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="lightbox-img-wrap">
          <img src={resolveMemeImageUrl(meme.imageUrl)} alt={meme.caption} referrerPolicy="no-referrer" />
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
  siteData: SiteData;
  onClose: () => void;
  onSave: (item: BacklogItem) => void;
  onDelete?: (id: string) => void;
}> = ({ initial, apiBaseUrl, siteData, onClose, onSave, onDelete }) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const existingMatches = useMemo(
    () => findExistingMatches(title, siteData, initial?.id),
    [title, siteData, initial?.id]
  );
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
      coverUrl: isForcedNoCover(coverUrl) ? NO_COVER_TOKEN : coverUrl.trim(),
      steamAppId:
        isForcedNoCover(coverUrl) || coverUrl.startsWith('data:image/')
          ? null
          : steamAppId,
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
        <form
          onSubmit={handleSubmit}
          onKeyDown={preventInputEnterSubmit}
          className="modal-body form-grid"
        >
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

          <DuplicateNotice matches={existingMatches} />

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

          <div className="modal-footer modal-footer-split">
            <div>
              {initial && onDelete && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm(`Удалить «${initial.title}» из бэклога?`)) {
                      onDelete(initial.id);
                      onClose();
                    }
                  }}
                >
                  <Trash2 size={14} /> Удалить
                </button>
              )}
            </div>
            <div className="row-gap-sm">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary">
                Сохранить
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------- Viewer Account Modal (без админ-элементов) ---------- */
export const AdminSettingsModal: React.FC<{
  user: TwitchUser;
  onClose: () => void;
  onLogout: () => void;
}> = ({ user, onClose, onLogout }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Аккаунт Twitch</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body form-grid">
          <div className="user-status-row">
            <div className="row-gap-sm">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName} className="avatar-md" />
              ) : (
                <div className="avatar-placeholder">
                  {user.displayName[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <div>
                  <strong>{user.displayName}</strong>{' '}
                  <span className="muted">(@{user.login})</span>
                </div>
                <div className="muted-sm">Зритель канала</div>
              </div>
            </div>
          </div>

          <p className="muted-sm">
            Пока вы в аккаунте, в разделах «Игры» и «Просмотровое» доступен фильтр «Мои заказы».
          </p>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Остаться
            </button>
            <button
              type="button"
              className="btn btn-twitch"
              onClick={() => {
                onLogout();
                onClose();
              }}
            >
              <LogOut size={15} /> Выйти из аккаунта
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
