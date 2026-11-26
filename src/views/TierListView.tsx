import React, { useMemo, useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  CustomTierList,
  GameItem,
  RatingScaleItem,
  TierCardItem,
  WatchItem,
} from '../types';
import { CoverImage } from '../components/CoverImage';
import { getRatingColor } from '../components/Badges';
import { searchCoversOnline } from '../utils/covers';

interface TierListViewProps {
  games: GameItem[];
  watchlist: WatchItem[];
  ratingScale: RatingScaleItem[];
  customTierLists: CustomTierList[];
  canEdit: boolean;
  authorName: string;
  apiBaseUrl: string;
  onSaveCustomTierLists: (lists: CustomTierList[]) => void;
  onInspectGame: (id: string) => void;
  onInspectWatch: (id: string) => void;
}

const DEFAULT_NEW_TIERS = [
  { id: 't-s', label: 'S - Шедевр', color: '#f59e0b', items: [] },
  { id: 't-a', label: 'A - Великолепно', color: '#10b981', items: [] },
  { id: 't-b', label: 'B - Похвально', color: '#06b6d4', items: [] },
  { id: 't-c', label: 'C - Проходняк', color: '#a855f7', items: [] },
  { id: 't-d', label: 'D - Полный кал', color: '#ef4444', items: [] },
];

export const TierListView: React.FC<TierListViewProps> = ({
  games,
  watchlist,
  ratingScale,
  customTierLists,
  canEdit,
  authorName,
  apiBaseUrl,
  onSaveCustomTierLists,
  onInspectGame,
  onInspectWatch,
}) => {
  const [selectedBoardId, setSelectedBoardId] = useState<string>('AUTO_GAMES');
  const [autoFilter, setAutoFilter] = useState('');
  const [statusScope, setStatusScope] = useState<'ALL' | 'COMPLETED'>('ALL');

  const [dragItem, setDragItem] = useState<{
    card: TierCardItem;
    fromContainerId: string;
  } | null>(null);
  const [dbSearch, setDbSearch] = useState('');
  const [customTitleInput, setCustomTitleInput] = useState('');
  const [customCoverInput, setCustomCoverInput] = useState('');
  const [searchingCustomCover, setSearchingCustomCover] = useState(false);

  const activeCustomList = useMemo(
    () => customTierLists.find((t) => t.id === selectedBoardId) || null,
    [customTierLists, selectedBoardId]
  );

  const openByTitleOrId = (card: TierCardItem) => {
    const tLow = card.title.trim().toLowerCase();
    const matchedGame = games.find((g) => g.title.trim().toLowerCase() === tLow);
    if (matchedGame) {
      onInspectGame(matchedGame.id);
      return;
    }
    const matchedWatch = watchlist.find((w) => w.title.trim().toLowerCase() === tLow);
    if (matchedWatch) {
      onInspectWatch(matchedWatch.id);
    }
  };

  const autoRows = useMemo(() => {
    const q = autoFilter.trim().toLowerCase();
    const tiers = ['Шедевр', 'Великолепно', 'Похвально', 'Проходняк', 'Полный кал'];

    return tiers.map((tierName) => {
      const color = getRatingColor(tierName);
      const items: Array<{
        id: string;
        kind: 'game' | 'watch';
        title: string;
        coverUrl: string;
        steamAppId?: number | null;
        sub: string;
        comment?: string;
      }> = [];

      if (selectedBoardId === 'AUTO_GAMES' || selectedBoardId === 'AUTO_ALL') {
        for (const g of games) {
          if (g.rating !== tierName) continue;
          if (statusScope === 'COMPLETED' && g.status !== 'Игра пройдена') continue;
          if (
            q &&
            !`${g.title} ${g.orderedBy} ${g.status}`.toLowerCase().includes(q)
          ) {
            continue;
          }
          items.push({
            id: g.id,
            kind: 'game',
            title: g.title,
            coverUrl: g.coverUrl,
            steamAppId: g.steamAppId,
            sub: g.orderedBy,
            comment: g.comment,
          });
        }
      }

      if (selectedBoardId === 'AUTO_WATCH' || selectedBoardId === 'AUTO_ALL') {
        for (const w of watchlist) {
          if (w.rating !== tierName) continue;
          if (q && !`${w.title} ${w.orderedBy} ${w.category}`.toLowerCase().includes(q)) {
            continue;
          }
          items.push({
            id: w.id,
            kind: 'watch',
            title: w.title,
            coverUrl: w.coverUrl,
            sub: `${w.category} • ${w.orderedBy}`,
            comment: w.comment,
          });
        }
      }

      return { tierName, color, items };
    });
  }, [games, watchlist, selectedBoardId, autoFilter, statusScope]);

  const handleCreateNewBoard = () => {
    const name = prompt('Название нового тир-листа для стрима:', 'Новый тир-лист');
    if (!name || !name.trim()) return;
    const newBoard: CustomTierList = {
      id: `tl-${Date.now()}`,
      title: name.trim(),
      description: 'Кастомный тир-лист канала',
      createdBy: authorName || 'OniZeD',
      createdAt: new Date().toISOString().slice(0, 10),
      tiers: DEFAULT_NEW_TIERS.map((t) => ({ ...t, items: [] })),
      pool: [],
    };
    onSaveCustomTierLists([...customTierLists, newBoard]);
    setSelectedBoardId(newBoard.id);
  };

  const updateCurrentBoard = (updater: (b: CustomTierList) => CustomTierList) => {
    if (!activeCustomList) return;
    const next = customTierLists.map((b) =>
      b.id === activeCustomList.id ? updater(b) : b
    );
    onSaveCustomTierLists(next);
  };

  const moveCardToContainer = (
    card: TierCardItem,
    fromId: string,
    toId: string
  ) => {
    if (!activeCustomList || fromId === toId) return;
    updateCurrentBoard((board) => {
      const cleanPool = board.pool.filter((c) => c.id !== card.id);
      const cleanTiers = board.tiers.map((t) => ({
        ...t,
        items: t.items.filter((c) => c.id !== card.id),
      }));

      if (toId === 'POOL') {
        return { ...board, tiers: cleanTiers, pool: [...cleanPool, card] };
      }
      return {
        ...board,
        pool: cleanPool,
        tiers: cleanTiers.map((t) =>
          t.id === toId ? { ...t, items: [...t.items, card] } : t
        ),
      };
    });
  };

  const removeCardFromBoard = (cardId: string) => {
    updateCurrentBoard((board) => ({
      ...board,
      pool: board.pool.filter((c) => c.id !== cardId),
      tiers: board.tiers.map((t) => ({
        ...t,
        items: t.items.filter((c) => c.id !== cardId),
      })),
    }));
  };

  const dbMatches = useMemo(() => {
    const q = dbSearch.trim().toLowerCase();
    if (!q || !activeCustomList) return [];
    const usedTitles = new Set<string>();
    activeCustomList.pool.forEach((i) => usedTitles.add(i.title.toLowerCase()));
    activeCustomList.tiers.forEach((t) =>
      t.items.forEach((i) => usedTitles.add(i.title.toLowerCase()))
    );

    const out: TierCardItem[] = [];
    for (const g of games) {
      if (usedTitles.has(g.title.toLowerCase())) continue;
      if (`${g.title} ${g.orderedBy}`.toLowerCase().includes(q)) {
        out.push({
          id: `tc-${g.id}-${Date.now()}`,
          title: g.title,
          coverUrl: g.coverUrl,
          steamAppId: g.steamAppId,
        });
      }
      if (out.length >= 10) break;
    }
    for (const w of watchlist) {
      if (usedTitles.has(w.title.toLowerCase())) continue;
      if (`${w.title} ${w.orderedBy}`.toLowerCase().includes(q)) {
        out.push({
          id: `tc-${w.id}-${Date.now()}`,
          title: w.title,
          coverUrl: w.coverUrl,
        });
      }
      if (out.length >= 14) break;
    }
    return out;
  }, [dbSearch, games, watchlist, activeCustomList]);

  const handleAddCustomCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitleInput.trim() || !activeCustomList) return;
    let cover = customCoverInput.trim();
    let steamId: number | null = null;
    if (!cover) {
      setSearchingCustomCover(true);
      try {
        const found = await searchCoversOnline(customTitleInput.trim(), 'game', apiBaseUrl);
        if (found[0]) {
          cover = found[0].url;
          steamId = found[0].steamAppId ?? null;
        }
      } finally {
        setSearchingCustomCover(false);
      }
    }
    const card: TierCardItem = {
      id: `custom-${Date.now()}`,
      title: customTitleInput.trim(),
      coverUrl: cover,
      steamAppId: steamId,
    };
    updateCurrentBoard((b) => ({ ...b, pool: [...b.pool, card] }));
    setCustomTitleInput('');
    setCustomCoverInput('');
  };

  return (
    <div className="view-stack">
      <div className="page-header">
        <div>
          <h1>Тир-листы канала</h1>
          <p className="muted-sm">
            Нажми на любую карточку в тир-листе, чтобы открыть подробности игры или тайтла
          </p>
        </div>

        {canEdit && (
          <button className="btn btn-primary" onClick={handleCreateNewBoard}>
            <Plus size={16} /> Создать тир-лист
          </button>
        )}
      </div>

      {/* Board Selector */}
      <div className="status-pills-row">
        <button
          className={`status-tab ${selectedBoardId === 'AUTO_GAMES' ? 'active' : ''}`}
          onClick={() => setSelectedBoardId('AUTO_GAMES')}
        >
          🎮 Авто-тирлист игр
        </button>
        <button
          className={`status-tab ${selectedBoardId === 'AUTO_WATCH' ? 'active' : ''}`}
          onClick={() => setSelectedBoardId('AUTO_WATCH')}
        >
          🎬 Авто-тирлист просмотрового
        </button>
        <button
          className={`status-tab ${selectedBoardId === 'AUTO_ALL' ? 'active' : ''}`}
          onClick={() => setSelectedBoardId('AUTO_ALL')}
        >
          ⭐ Всё вместе
        </button>

        {customTierLists.map((tl) => (
          <button
            key={tl.id}
            className={`status-tab custom-tab ${selectedBoardId === tl.id ? 'active' : ''}`}
            onClick={() => setSelectedBoardId(tl.id)}
          >
            <Layers size={13} /> {tl.title}
          </button>
        ))}
      </div>

      {/* AUTO TIER LIST MODE */}
      {!activeCustomList ? (
        <>
          <div className="filters-bar">
            <div className="search-input-wrap">
              <Search size={16} />
              <input
                className="input"
                placeholder="Фильтр по названию, заказчику или ивенту (напр. Скачки Дурки)..."
                value={autoFilter}
                onChange={(e) => setAutoFilter(e.target.value)}
              />
              {autoFilter && (
                <button type="button" className="clear-input-btn" onClick={() => setAutoFilter('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            {selectedBoardId === 'AUTO_GAMES' && (
              <div className="segmented">
                <button
                  className={statusScope === 'ALL' ? 'active' : ''}
                  onClick={() => setStatusScope('ALL')}
                >
                  Все оценённые
                </button>
                <button
                  className={statusScope === 'COMPLETED' ? 'active' : ''}
                  onClick={() => setStatusScope('COMPLETED')}
                >
                  Только пройденные
                </button>
              </div>
            )}
          </div>

          <div className="tier-board">
            {autoRows.map((row) => {
              const scaleInfo = ratingScale.find((r) => r.rating === row.tierName);
              return (
                <div key={row.tierName} className="tier-row">
                  <div
                    className="tier-label-col"
                    style={{
                      backgroundColor: `${row.color}26`,
                      borderLeft: `5px solid ${row.color}`,
                    }}
                  >
                    <strong style={{ color: row.color }}>{row.tierName}</strong>
                    <span className="tier-count">{row.items.length} шт.</span>
                    {scaleInfo && (
                      <small className="tier-desc-hint">{scaleInfo.description}</small>
                    )}
                  </div>
                  <div className="tier-items-wrap">
                    {row.items.map((item) => (
                      <div
                        key={item.id}
                        className="tier-tile clickable-tile"
                        onClick={() =>
                          item.kind === 'game'
                            ? onInspectGame(item.id)
                            : onInspectWatch(item.id)
                        }
                        title={`${item.title} (${item.sub}) - нажми, чтобы открыть`}
                      >
                        <CoverImage
                          title={item.title}
                          coverUrl={item.coverUrl}
                          steamAppId={item.steamAppId}
                        />
                        <div className="tier-tile-caption">{item.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* CUSTOM INTERACTIVE TIER LIST BUILDER MODE */
        <div className="view-stack">
          <div className="custom-tl-header">
            <div>
              <h2>{activeCustomList.title}</h2>
              <p className="muted-sm">
                Автор: {activeCustomList.createdBy} • {activeCustomList.createdAt}
                {canEdit && ' • Перетаскивай карточки мышкой или кликай для просмотра!'}
              </p>
            </div>
            {canEdit && (
              <div className="row-gap-sm">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const nextTierName = prompt('Название нового ряда тира:', 'Новый тир');
                    if (!nextTierName) return;
                    updateCurrentBoard((b) => ({
                      ...b,
                      tiers: [
                        ...b.tiers,
                        {
                          id: `tier-${Date.now()}`,
                          label: nextTierName.trim(),
                          color: '#6366f1',
                          items: [],
                        },
                      ],
                    }));
                  }}
                >
                  <Plus size={14} /> + Ряд тира
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm(`Удалить тир-лист «${activeCustomList.title}»?`)) {
                      onSaveCustomTierLists(
                        customTierLists.filter((x) => x.id !== activeCustomList.id)
                      );
                      setSelectedBoardId('AUTO_GAMES');
                    }
                  }}
                >
                  <Trash2 size={14} /> Удалить тир-лист
                </button>
              </div>
            )}
          </div>

          <div className="tier-board">
            {activeCustomList.tiers.map((tier) => (
              <div
                key={tier.id}
                className="tier-row"
                onDragOver={(e) => canEdit && e.preventDefault()}
                onDrop={() => {
                  if (canEdit && dragItem) {
                    moveCardToContainer(dragItem.card, dragItem.fromContainerId, tier.id);
                    setDragItem(null);
                  }
                }}
              >
                <div
                  className="tier-label-col"
                  style={{
                    backgroundColor: `${tier.color}26`,
                    borderLeft: `5px solid ${tier.color}`,
                  }}
                >
                  {canEdit ? (
                    <input
                      className="tier-inline-input"
                      style={{ color: tier.color }}
                      value={tier.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateCurrentBoard((b) => ({
                          ...b,
                          tiers: b.tiers.map((t) =>
                            t.id === tier.id ? { ...t, label: val } : t
                          ),
                        }));
                      }}
                    />
                  ) : (
                    <strong style={{ color: tier.color }}>{tier.label}</strong>
                  )}
                  <span className="tier-count">{tier.items.length} шт.</span>
                </div>

                <div className="tier-items-wrap min-drop-zone">
                  {tier.items.map((card) => (
                    <div
                      key={card.id}
                      className={`tier-tile clickable-tile ${canEdit ? 'draggable' : ''}`}
                      draggable={canEdit}
                      onClick={() => openByTitleOrId(card)}
                      onDragStart={() =>
                        canEdit && setDragItem({ card, fromContainerId: tier.id })
                      }
                    >
                      <CoverImage
                        title={card.title}
                        coverUrl={card.coverUrl}
                        steamAppId={card.steamAppId}
                      />
                      <div className="tier-tile-caption">{card.title}</div>
                      {canEdit && (
                        <button
                          className="tile-remove-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCardFromBoard(card.id);
                          }}
                          title="Убрать из тир-листа"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {canEdit && (
            <div
              className="section-block"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragItem) {
                  moveCardToContainer(dragItem.card, dragItem.fromContainerId, 'POOL');
                  setDragItem(null);
                }
              }}
            >
              <h3>Пул нераспределённых карточек ({activeCustomList.pool.length})</h3>
              <div className="tier-items-wrap pool-zone">
                {activeCustomList.pool.length === 0 ? (
                  <span className="muted-sm">
                    Добавьте игры/фильмы из базы ниже или впишите свою карточку - затем
                    перетащите в нужный тир!
                  </span>
                ) : (
                  activeCustomList.pool.map((card) => (
                    <div
                      key={card.id}
                      className="tier-tile clickable-tile draggable"
                      draggable
                      onClick={() => openByTitleOrId(card)}
                      onDragStart={() =>
                        setDragItem({ card, fromContainerId: 'POOL' })
                      }
                    >
                      <CoverImage
                        title={card.title}
                        coverUrl={card.coverUrl}
                        steamAppId={card.steamAppId}
                      />
                      <div className="tier-tile-caption">{card.title}</div>
                      <button
                        className="tile-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCardFromBoard(card.id);
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="two-col-hub" style={{ marginTop: 16 }}>
                <div>
                  <label className="field-label">
                    Быстро взять игру или фильм из базы сайта
                  </label>
                  <input
                    className="input input-sm"
                    placeholder="Начните вводить название игры или фильма..."
                    value={dbSearch}
                    onChange={(e) => setDbSearch(e.target.value)}
                  />
                  {dbMatches.length > 0 && (
                    <div className="quick-pick-chips">
                      {dbMatches.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() =>
                            updateCurrentBoard((b) => ({
                              ...b,
                              pool: [...b.pool, m],
                            }))
                          }
                        >
                          <Plus size={12} /> {m.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddCustomCard}>
                  <label className="field-label">
                    Или добавить любую свою карточку (авто-поиск обложки)
                  </label>
                  <div className="inline-search-row">
                    <input
                      className="input input-sm"
                      placeholder="Название карточки..."
                      value={customTitleInput}
                      onChange={(e) => setCustomTitleInput(e.target.value)}
                    />
                    <input
                      className="input input-sm"
                      placeholder="URL картинки (необязательно)"
                      value={customCoverInput}
                      onChange={(e) => setCustomCoverInput(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={searchingCustomCover || !customTitleInput.trim()}
                    >
                      <Sparkles size={14} />{' '}
                      {searchingCustomCover ? 'Ищем...' : 'В пул'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
