import React, { useMemo, useState } from 'react';
import {
  Clock,
  Edit3,
  ExternalLink,
  ImagePlus,
  LayoutGrid,
  List,
  Plus,
  Search,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { GameItem, MemeItem, TwitchUser } from '../types';
import { CoverImage } from '../components/CoverImage';
import { OrdererAutocomplete } from '../components/OrdererAutocomplete';
import { resolveMemeImageUrl } from '../utils/builtinMemes';
import { collectOrdererStats } from '../utils/orderers';
import {
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
  initialOrdererFilter?: string;
  onClearInitialOrderer?: () => void;
  onAddGame: () => void;
  onInspectGame: (id: string) => void;
  onEditGame: (game: GameItem) => void;
  onDeleteGame: (id: string) => void;
  onQuickUpdateGame: (game: GameItem) => void;
  onAddMemeForGame: (game: GameItem) => void;
  onViewMeme: (meme: MemeItem) => void;
}

export const GamesView: React.FC<GamesViewProps> = ({
  games,
  memes,
  canEdit,
  currentUser,
  initialOrdererFilter,
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
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [ratingFilter, setRatingFilter] = useState<string>('ALL');
  const [onlyVod, setOnlyVod] = useState(false);
  const [onlyReturned, setOnlyReturned] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [ordererFilter, setOrdererFilter] = useState(initialOrdererFilter || '');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'default' | 'title' | 'rating'>('default');

  React.useEffect(() => {
    if (initialOrdererFilter !== undefined) {
      setOrdererFilter(initialOrdererFilter);
    }
  }, [initialOrdererFilter]);

  const metaMap = useGameMetaMap();
  const ordererStats = useMemo(() => collectOrdererStats(games), [games]);

  const memesByGame = useMemo(() => {
    const map = new Map<string, MemeItem[]>();
    for (const m of memes) {
      if (m.targetType === 'game' && m.targetId) {
        const arr = map.get(m.targetId) || [];
        arr.push(m);
        map.set(m.targetId, arr);
      }
    }
    return map;
  }, [memes]);

  const ratingRank: Record<string, number> = {
    Шедевр: 1,
    Великолепно: 2,
    Похвально: 3,
    Проходняк: 4,
    'Полный кал': 5,
    'Нет мнения': 6,
    '': 7,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ordQ = ordererFilter.trim().toLowerCase();
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
      if (onlyMine && myLogin) {
        const lowerOrd = g.orderedBy.toLowerCase();
        const isStreamerMatch = myLogin === 'onized' && lowerOrd === 'стример';
        if (!lowerOrd.includes(myLogin) && !isStreamerMatch) return false;
      }
      if (ordQ && !g.orderedBy.toLowerCase().includes(ordQ)) return false;
      if (q) {
        const hay =
          `${g.title} ${g.orderedBy} ${g.conditions} ${g.comment} ${g.dropPrice || ''} ${g.returnPrice || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'title') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    }
    if (sortBy === 'rating') {
      return [...list].sort(
        (a, b) => (ratingRank[a.rating] ?? 9) - (ratingRank[b.rating] ?? 9)
      );
    }
    return list;
  }, [
    games,
    search,
    statusFilter,
    ratingFilter,
    onlyVod,
    onlyReturned,
    onlyMine,
    ordererFilter,
    currentUser,
    sortBy,
  ]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: games.length };
    for (const g of games) {
      c[g.status] = (c[g.status] || 0) + 1;
    }
    return c;
  }, [games]);

  return (
    <div className="view-stack">
      <div className="page-header">
        <div>
          <h1>Список игр ({filtered.length})</h1>
          <p className="muted-sm">
            Все заказы, прохождения, условия, оценки, цены дропов/возвратов и записи VOD
          </p>
        </div>
        <div className="row-gap-sm">
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
            <button type="button" className="clear-input-btn" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <OrdererAutocomplete
          value={ordererFilter}
          onChange={(val) => {
            setOrdererFilter(val);
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
          onClick={() => setStatusFilter('ALL')}
        >
          Все <span>{statusCounts.ALL}</span>
        </button>
        {GAME_STATUSES.filter((s) => statusCounts[s]).map((s) => (
          <button
            key={s}
            className={`status-tab ${statusFilter === s ? 'active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s} <span>{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="media-cards-grid">
          {filtered.map((g) => {
            const gMemes = memesByGame.get(g.id) || [];
            const meta = lookupGameMeta(g, metaMap);
            const steamUrl = getGameSteamStoreUrl(g);
            const hltbUrl = getGameHltbUrl(g.title, meta);
            const displayTime = g.hours ? `${g.hours}ч` : meta?.estHours || '';
            const metaLine = [meta?.year, meta?.genres].filter(Boolean).join(' • ');

            return (
              <article
                key={g.id}
                className="media-card"
                onClick={() => onInspectGame(g.id)}
              >
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
                    <span className="steam-score-badge" title="Процент положительных отзывов в Steam">
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
                        setOrdererFilter(g.orderedBy);
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
                    <div
                      className="watch-memes-box"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                              referrerPolicy="no-referrer"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className="card-ext-links"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => onAddMemeForGame(g)}
                        title="Прикрепить мем со стрима"
                      >
                        <ImagePlus size={13} /> + Мем
                      </button>
                      <button
                        className="btn btn-ghost btn-xs danger-text"
                        onClick={() => {
                          if (confirm(`Удалить «${g.title}» из списка?`)) {
                            onDeleteGame(g.id);
                          }
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
      ) : (
        /* Table View */
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Игра</th>
                <th>Кто заказал</th>
                <th>Статус / Дроп / Возврат</th>
                <th>Оценка</th>
                <th>Условия и комментарий</th>
                <th>Часы / Ссылки</th>
                {canEdit && <th>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} onClick={() => onInspectGame(g.id)}>
                  <td>
                    <div className="table-title-cell">
                      <CoverImage
                        title={g.title}
                        coverUrl={g.coverUrl}
                        steamAppId={g.steamAppId}
                        className="table-thumb"
                      />
                      <strong>{g.title}</strong>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-inline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOrdererFilter(g.orderedBy);
                      }}
                    >
                      {g.orderedBy}
                    </button>
                  </td>
                  <td onClick={(e) => canEdit && e.stopPropagation()}>
                    <div className="row-gap-xs wrap">
                      {canEdit ? (
                        <select
                          className="input input-xs"
                          style={{ width: 'auto' }}
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
                      <DropPriceBadge price={g.dropPrice} />
                      <ReturnPriceBadge price={g.returnPrice} />
                    </div>
                  </td>
                  <td onClick={(e) => canEdit && e.stopPropagation()}>
                    {canEdit ? (
                      <select
                        className="input input-xs"
                        value={g.rating}
                        onChange={(e) =>
                          onQuickUpdateGame({ ...g, rating: e.target.value })
                        }
                      >
                        <option value="">-</option>
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
                  <td className="table-notes-cell">
                    {g.conditions && (
                      <div className="conditions-inline">
                        <strong>Условия:</strong> {g.conditions}
                      </div>
                    )}
                    {g.comment && <div className="muted-sm">{g.comment}</div>}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-gap-xs wrap">
                      {(g.hours || lookupGameMeta(g, metaMap)?.estHours) && (
                        <span className="muted-sm">
                          {g.hours ? `${g.hours}ч` : lookupGameMeta(g, metaMap)?.estHours}
                        </span>
                      )}
                      {g.vodUrl && (
                        <a
                          href={g.vodUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-xs"
                        >
                          VOD
                        </a>
                      )}
                      {getGameSteamStoreUrl(g) && (
                        <a
                          href={getGameSteamStoreUrl(g)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-xs"
                          title="Открыть в Steam"
                        >
                          Steam
                        </a>
                      )}
                      <a
                        href={getGameHltbUrl(g.title, lookupGameMeta(g, metaMap))}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-xs"
                        title="HowLongToBeat"
                      >
                        HLTB
                      </a>
                    </div>
                  </td>
                  {canEdit && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row-gap-xs">
                        <button
                          className="icon-btn"
                          onClick={() => onEditGame(g)}
                          title="Редактировать"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          className="icon-btn danger-text"
                          onClick={() => {
                            if (confirm(`Удалить «${g.title}»?`)) onDeleteGame(g.id);
                          }}
                          title="Удалить"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
