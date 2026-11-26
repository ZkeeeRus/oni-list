import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
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
import { OrdererAutocomplete } from '../components/OrdererAutocomplete';
import { getRatingColor } from '../components/Badges';
import { searchCoversOnline } from '../utils/covers';
import { collectOrdererStats } from '../utils/orderers';

export interface AutoTierMovePayload {
  itemId: string;
  itemKind: 'game' | 'watch';
  itemTitle: string;
  fromTier: string;
  toTier: string;
  nextTierOrder: Record<string, string[]>;
}

interface TierListViewProps {
  games: GameItem[];
  watchlist: WatchItem[];
  ratingScale: RatingScaleItem[];
  customTierLists: CustomTierList[];
  tierItemOrder: Record<string, string[]>;
  canEdit: boolean;
  authorName: string;
  apiBaseUrl: string;
  onMoveAutoTierItem: (payload: AutoTierMovePayload) => void;
  onSaveCustomTierLists: (lists: CustomTierList[]) => void;
  onInspectGame: (id: string) => void;
  onInspectWatch: (id: string) => void;
}

interface AutoTileItem {
  id: string;
  kind: 'game' | 'watch';
  title: string;
  coverUrl: string;
  steamAppId?: number | null;
  sub: string;
  comment?: string;
}

interface DropIndicator {
  containerId: string;
  targetId: string | null;
  side: 'before' | 'after';
}

const DEFAULT_NEW_TIERS = [
  { id: 't-s', label: 'S - Шедевр', color: '#f59e0b', items: [] },
  { id: 't-a', label: 'A - Великолепно', color: '#10b981', items: [] },
  { id: 't-b', label: 'B - Похвально', color: '#06b6d4', items: [] },
  { id: 't-c', label: 'C - Проходняк', color: '#a855f7', items: [] },
  { id: 't-d', label: 'D - Полный кал', color: '#ef4444', items: [] },
];

const MAIN_AUTO_TIERS = [
  'Шедевр',
  'Великолепно',
  'Похвально',
  'Проходняк',
  'Полный кал',
];

function sortByTierOrder<T extends { id: string }>(
  items: T[],
  orderIds?: string[]
): T[] {
  if (!orderIds || orderIds.length === 0) return items;
  const pos = new Map<string, number>();
  orderIds.forEach((id, idx) => pos.set(id, idx));
  return [...items].sort((a, b) => {
    const ia = pos.get(a.id);
    const ib = pos.get(b.id);
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return 0;
  });
}

export const TierListView: React.FC<TierListViewProps> = ({
  games,
  watchlist,
  ratingScale,
  customTierLists,
  tierItemOrder,
  canEdit,
  authorName,
  apiBaseUrl,
  onMoveAutoTierItem,
  onSaveCustomTierLists,
  onInspectGame,
  onInspectWatch,
}) => {
  const [selectedBoardId, setSelectedBoardId] = useState<string>('AUTO_GAMES');
  const [autoFilter, setAutoFilter] = useState('');
  const [ordererFilter, setOrdererFilter] = useState('');
  const [statusScope, setStatusScope] = useState<'ALL' | 'COMPLETED'>('ALL');
  const [showUnratedPool, setShowUnratedPool] = useState(false);

  const ordererStats = useMemo(
    () => collectOrdererStats(games, watchlist),
    [games, watchlist]
  );

  // Drag state for Auto Tier-Lists
  const [autoDrag, setAutoDrag] = useState<{
    id: string;
    kind: 'game' | 'watch';
    title: string;
    fromTier: string;
  } | null>(null);

  // Drag state for Custom Tier-Lists
  const [customDrag, setCustomDrag] = useState<{
    card: TierCardItem;
    fromContainerId: string;
  } | null>(null);

  // Shared visual insertion target (left/right of a card or end of a row)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

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
    const matchedWatch = watchlist.find(
      (w) => w.title.trim().toLowerCase() === tLow
    );
    if (matchedWatch) {
      onInspectWatch(matchedWatch.id);
    }
  };

  const collectMatchingAutoItems = (tierKey: string): AutoTileItem[] => {
    const q = autoFilter.trim().toLowerCase();
    const ordQ = ordererFilter.trim().toLowerCase();
    const items: AutoTileItem[] = [];

    if (selectedBoardId === 'AUTO_GAMES' || selectedBoardId === 'AUTO_ALL') {
      for (const g of games) {
        if ((g.rating || '') !== tierKey) continue;
        if (statusScope === 'COMPLETED' && g.status !== 'Игра пройдена') continue;
        if (ordQ && !g.orderedBy.toLowerCase().includes(ordQ)) continue;
        if (
          q &&
          !`${g.title} ${g.orderedBy} ${g.status} ${g.comment}`
            .toLowerCase()
            .includes(q)
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
        if ((w.rating || '') !== tierKey) continue;
        if (ordQ && !w.orderedBy.toLowerCase().includes(ordQ)) continue;
        if (
          q &&
          !`${w.title} ${w.orderedBy} ${w.category} ${w.comment}`
            .toLowerCase()
            .includes(q)
        ) {
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

    return sortByTierOrder(items, tierItemOrder[tierKey]);
  };

  const autoRows = useMemo(() => {
    const netMneniyaItems = collectMatchingAutoItems('Нет мнения');
    const tierNames =
      canEdit || netMneniyaItems.length > 0
        ? [...MAIN_AUTO_TIERS, 'Нет мнения']
        : MAIN_AUTO_TIERS;

    return tierNames.map((tierName) => ({
      tierName,
      color: getRatingColor(tierName),
      items:
        tierName === 'Нет мнения'
          ? netMneniyaItems
          : collectMatchingAutoItems(tierName),
    }));
  }, [
    games,
    watchlist,
    selectedBoardId,
    autoFilter,
    ordererFilter,
    statusScope,
    tierItemOrder,
    canEdit,
  ]);

  const unratedItems = useMemo(
    () => collectMatchingAutoItems(''),
    [games, watchlist, selectedBoardId, autoFilter, ordererFilter, statusScope, tierItemOrder]
  );

  // Получает полный список ID в указанном тире (включая скрытые фильтрами элементы, чтобы не потерять их порядок)
  const getFullAutoTierIds = (tierKey: string, excludeId?: string): string[] => {
    const raw: Array<{ id: string }> = [];
    for (const g of games) {
      if ((g.rating || '') === tierKey && g.id !== excludeId) {
        raw.push({ id: g.id });
      }
    }
    for (const w of watchlist) {
      if ((w.rating || '') === tierKey && w.id !== excludeId) {
        raw.push({ id: w.id });
      }
    }
    return sortByTierOrder(raw, tierItemOrder[tierKey]).map((x) => x.id);
  };

  const commitAutoDrop = (
    toTier: string,
    targetId: string | null,
    side: 'before' | 'after'
  ) => {
    if (!canEdit || !autoDrag) return;
    const { id: draggedId, kind, title, fromTier } = autoDrag;
    setAutoDrag(null);
    setDropIndicator(null);

    if (fromTier === toTier && targetId === draggedId) {
      return;
    }

    const beforeIds = getFullAutoTierIds(toTier);
    const destIds = getFullAutoTierIds(toTier, draggedId);

    if (targetId && targetId !== draggedId) {
      const idx = destIds.indexOf(targetId);
      if (idx !== -1) {
        destIds.splice(side === 'before' ? idx : idx + 1, 0, draggedId);
      } else {
        destIds.push(draggedId);
      }
    } else {
      destIds.push(draggedId);
    }

    // Если карточка осталась ровно на своем прежнем месте в том же тире - ничего не сохраняем
    if (
      fromTier === toTier &&
      beforeIds.length === destIds.length &&
      beforeIds.every((val, i) => val === destIds[i])
    ) {
      return;
    }

    const nextTierOrder: Record<string, string[]> = {
      ...tierItemOrder,
      [toTier]: destIds,
    };

    if (fromTier !== toTier && nextTierOrder[fromTier]) {
      nextTierOrder[fromTier] = nextTierOrder[fromTier].filter(
        (x) => x !== draggedId
      );
    }

    onMoveAutoTierItem({
      itemId: draggedId,
      itemKind: kind,
      itemTitle: title,
      fromTier,
      toTier,
      nextTierOrder,
    });
  };

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

  const commitCustomDrop = (
    toContainerId: string,
    targetId: string | null,
    side: 'before' | 'after'
  ) => {
    if (!canEdit || !activeCustomList || !customDrag) return;
    const { card, fromContainerId } = customDrag;
    setCustomDrag(null);
    setDropIndicator(null);

    if (fromContainerId === toContainerId && targetId === card.id) {
      return;
    }

    const insertInto = (arr: TierCardItem[]): TierCardItem[] => {
      const filtered = arr.filter((c) => c.id !== card.id);
      if (targetId && targetId !== card.id) {
        const idx = filtered.findIndex((c) => c.id === targetId);
        if (idx !== -1) {
          filtered.splice(side === 'before' ? idx : idx + 1, 0, card);
          return filtered;
        }
      }
      filtered.push(card);
      return filtered;
    };

    updateCurrentBoard((board) => {
      const cleanPool = board.pool.filter((c) => c.id !== card.id);
      const cleanTiers = board.tiers.map((t) => ({
        ...t,
        items: t.items.filter((c) => c.id !== card.id),
      }));

      if (toContainerId === 'POOL') {
        return {
          ...board,
          tiers: cleanTiers,
          pool: insertInto(board.pool),
        };
      }

      return {
        ...board,
        pool: cleanPool,
        tiers: cleanTiers.map((t) =>
          t.id === toContainerId
            ? {
                ...t,
                items: insertInto(
                  board.tiers.find((orig) => orig.id === toContainerId)?.items ||
                    t.items
                ),
              }
            : t
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
        const found = await searchCoversOnline(
          customTitleInput.trim(),
          'game',
          apiBaseUrl
        );
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
            {canEdit
              ? 'Перетаскивай карточки мышкой выше/ниже внутри тира или между категориями (оценка обновится сама). Клик - открыть карточку.'
              : 'Нажми на любую карточку в тир-листе, чтобы открыть подробности игры или тайтла'}
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
                <button
                  type="button"
                  className="clear-input-btn"
                  onClick={() => setAutoFilter('')}
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
              const isRowDragOver =
                canEdit &&
                autoDrag !== null &&
                dropIndicator?.containerId === row.tierName;

              return (
                <div
                  key={row.tierName}
                  className={`tier-row ${isRowDragOver ? 'drag-over-row' : ''}`}
                  onDragOver={(e) => {
                    if (!canEdit || !autoDrag) return;
                    e.preventDefault();
                    if (
                      dropIndicator?.containerId !== row.tierName ||
                      dropIndicator?.targetId !== null
                    ) {
                      setDropIndicator({
                        containerId: row.tierName,
                        targetId: null,
                        side: 'after',
                      });
                    }
                  }}
                  onDrop={(e) => {
                    if (!canEdit || !autoDrag) return;
                    e.preventDefault();
                    const targetId =
                      dropIndicator?.containerId === row.tierName
                        ? dropIndicator.targetId
                        : null;
                    const side =
                      dropIndicator?.containerId === row.tierName
                        ? dropIndicator.side
                        : 'after';
                    commitAutoDrop(row.tierName, targetId, side);
                  }}
                >
                  <div
                    className="tier-label-col"
                    style={{
                      backgroundColor: `${row.color}22`,
                      borderLeft: `5px solid ${row.color}`,
                    }}
                  >
                    <div className="tier-label-sticky">
                      <div className="tier-label-top">
                        <strong style={{ color: row.color }}>{row.tierName}</strong>
                        <span className="tier-count">{row.items.length} шт.</span>
                      </div>
                      {scaleInfo && (
                        <small className="tier-desc-hint">
                          {scaleInfo.description}
                        </small>
                      )}
                    </div>
                  </div>
                  <div className="tier-items-wrap min-drop-zone">
                    {row.items.map((item) => {
                      const isDraggingThis = autoDrag?.id === item.id;
                      const dropSide =
                        dropIndicator?.containerId === row.tierName &&
                        dropIndicator?.targetId === item.id &&
                        autoDrag?.id !== item.id
                          ? dropIndicator.side
                          : null;

                      return (
                        <div
                          key={item.id}
                          draggable={canEdit}
                          className={`tier-tile clickable-tile ${
                            canEdit ? 'draggable' : ''
                          } ${isDraggingThis ? 'is-dragging' : ''} ${
                            dropSide === 'before' ? 'drop-before' : ''
                          } ${dropSide === 'after' ? 'drop-after' : ''}`}
                          onClick={() =>
                            item.kind === 'game'
                              ? onInspectGame(item.id)
                              : onInspectWatch(item.id)
                          }
                          onDragStart={(e) => {
                            if (!canEdit) return;
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', item.id);
                            setAutoDrag({
                              id: item.id,
                              kind: item.kind,
                              title: item.title,
                              fromTier: row.tierName,
                            });
                          }}
                          onDragOver={(e) => {
                            if (!canEdit || !autoDrag) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const side =
                              e.clientX < rect.left + rect.width / 2
                                ? 'before'
                                : 'after';
                            if (
                              dropIndicator?.containerId !== row.tierName ||
                              dropIndicator?.targetId !== item.id ||
                              dropIndicator?.side !== side
                            ) {
                              setDropIndicator({
                                containerId: row.tierName,
                                targetId: item.id,
                                side,
                              });
                            }
                          }}
                          onDrop={(e) => {
                            if (!canEdit || !autoDrag) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const side =
                              e.clientX < rect.left + rect.width / 2
                                ? 'before'
                                : 'after';
                            commitAutoDrop(row.tierName, item.id, side);
                          }}
                          onDragEnd={() => {
                            setAutoDrag(null);
                            setDropIndicator(null);
                          }}
                          title={
                            canEdit
                              ? `${item.title} (${item.sub}) - перетащи или кликни`
                              : `${item.title} (${item.sub}) - нажми, чтобы открыть`
                          }
                        >
                          <CoverImage
                            title={item.title}
                            coverUrl={item.coverUrl}
                            steamAppId={item.steamAppId}
                          />
                          <div className="tier-tile-caption">{item.title}</div>
                        </div>
                      );
                    })}
                    {row.items.length === 0 && canEdit && (
                      <span className="tier-empty-drop-hint">
                        Перетащи карточку сюда, чтобы поставить оценку «{row.tierName}»
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unrated Pool Drawer for Editors */}
          {canEdit && (
            <div
              className={`section-block unrated-pool-box ${
                autoDrag && dropIndicator?.containerId === '' ? 'drag-over-row' : ''
              }`}
              onDragOver={(e) => {
                if (!autoDrag) return;
                e.preventDefault();
                if (
                  dropIndicator?.containerId !== '' ||
                  dropIndicator?.targetId !== null
                ) {
                  setDropIndicator({
                    containerId: '',
                    targetId: null,
                    side: 'after',
                  });
                }
              }}
              onDrop={(e) => {
                if (!autoDrag) return;
                e.preventDefault();
                commitAutoDrop('', null, 'after');
              }}
            >
              <div className="row-between wrap">
                <div className="row-gap-xs">
                  <GripVertical size={16} className="muted" />
                  <strong>Без оценки ({unratedItems.length})</strong>
                  <span className="muted-xs">
                    - перетащи сюда карточку для снятия оценки или раскрой пул, чтобы выставить оценку перетаскиванием
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => setShowUnratedPool((v) => !v)}
                >
                  {showUnratedPool ? (
                    <>
                      <ChevronUp size={13} /> Скрыть пул
                    </>
                  ) : (
                    <>
                      <ChevronDown size={13} /> Показать без оценки ({unratedItems.length})
                    </>
                  )}
                </button>
              </div>

              {showUnratedPool && (
                <div className="tier-items-wrap pool-zone" style={{ marginTop: 10 }}>
                  {unratedItems.length === 0 ? (
                    <span className="muted-sm">
                      По текущему фильтру нет карточек без оценки.
                    </span>
                  ) : (
                    unratedItems.map((item) => {
                      const isDraggingThis = autoDrag?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          draggable
                          className={`tier-tile clickable-tile draggable ${
                            isDraggingThis ? 'is-dragging' : ''
                          }`}
                          onClick={() =>
                            item.kind === 'game'
                              ? onInspectGame(item.id)
                              : onInspectWatch(item.id)
                          }
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', item.id);
                            setAutoDrag({
                              id: item.id,
                              kind: item.kind,
                              title: item.title,
                              fromTier: '',
                            });
                          }}
                          onDragEnd={() => {
                            setAutoDrag(null);
                            setDropIndicator(null);
                          }}
                          title={`${item.title} (${item.sub}) - перетащи в нужный тир выше`}
                        >
                          <CoverImage
                            title={item.title}
                            coverUrl={item.coverUrl}
                            steamAppId={item.steamAppId}
                          />
                          <div className="tier-tile-caption">{item.title}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* CUSTOM INTERACTIVE TIER LIST BUILDER MODE */
        <div className="view-stack">
          <div className="custom-tl-header">
            <div>
              <h2>{activeCustomList.title}</h2>
              <p className="muted-sm">
                Автор: {activeCustomList.createdBy} • {activeCustomList.createdAt}
                {canEdit &&
                  ' • Перетаскивай карточки выше/ниже или между рядами!'}
              </p>
            </div>
            {canEdit && (
              <div className="row-gap-sm">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const nextTierName = prompt(
                      'Название нового ряда тира:',
                      'Новый тир'
                    );
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
            {activeCustomList.tiers.map((tier) => {
              const isRowDragOver =
                canEdit &&
                customDrag !== null &&
                dropIndicator?.containerId === tier.id;

              return (
                <div
                  key={tier.id}
                  className={`tier-row ${isRowDragOver ? 'drag-over-row' : ''}`}
                  onDragOver={(e) => {
                    if (!canEdit || !customDrag) return;
                    e.preventDefault();
                    if (
                      dropIndicator?.containerId !== tier.id ||
                      dropIndicator?.targetId !== null
                    ) {
                      setDropIndicator({
                        containerId: tier.id,
                        targetId: null,
                        side: 'after',
                      });
                    }
                  }}
                  onDrop={(e) => {
                    if (!canEdit || !customDrag) return;
                    e.preventDefault();
                    const targetId =
                      dropIndicator?.containerId === tier.id
                        ? dropIndicator.targetId
                        : null;
                    const side =
                      dropIndicator?.containerId === tier.id
                        ? dropIndicator.side
                        : 'after';
                    commitCustomDrop(tier.id, targetId, side);
                  }}
                >
                  <div
                    className="tier-label-col"
                    style={{
                      backgroundColor: `${tier.color}22`,
                      borderLeft: `5px solid ${tier.color}`,
                    }}
                  >
                    <div className="tier-label-sticky">
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
                  </div>

                  <div className="tier-items-wrap min-drop-zone">
                    {tier.items.map((card) => {
                      const isDraggingThis = customDrag?.card.id === card.id;
                      const dropSide =
                        dropIndicator?.containerId === tier.id &&
                        dropIndicator?.targetId === card.id &&
                        customDrag?.card.id !== card.id
                          ? dropIndicator.side
                          : null;

                      return (
                        <div
                          key={card.id}
                          className={`tier-tile clickable-tile ${
                            canEdit ? 'draggable' : ''
                          } ${isDraggingThis ? 'is-dragging' : ''} ${
                            dropSide === 'before' ? 'drop-before' : ''
                          } ${dropSide === 'after' ? 'drop-after' : ''}`}
                          draggable={canEdit}
                          onClick={() => openByTitleOrId(card)}
                          onDragStart={(e) => {
                            if (!canEdit) return;
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', card.id);
                            setCustomDrag({ card, fromContainerId: tier.id });
                          }}
                          onDragOver={(e) => {
                            if (!canEdit || !customDrag) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const side =
                              e.clientX < rect.left + rect.width / 2
                                ? 'before'
                                : 'after';
                            if (
                              dropIndicator?.containerId !== tier.id ||
                              dropIndicator?.targetId !== card.id ||
                              dropIndicator?.side !== side
                            ) {
                              setDropIndicator({
                                containerId: tier.id,
                                targetId: card.id,
                                side,
                              });
                            }
                          }}
                          onDrop={(e) => {
                            if (!canEdit || !customDrag) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const side =
                              e.clientX < rect.left + rect.width / 2
                                ? 'before'
                                : 'after';
                            commitCustomDrop(tier.id, card.id, side);
                          }}
                          onDragEnd={() => {
                            setCustomDrag(null);
                            setDropIndicator(null);
                          }}
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
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {canEdit && (
            <div
              className={`section-block ${
                customDrag && dropIndicator?.containerId === 'POOL'
                  ? 'drag-over-row'
                  : ''
              }`}
              onDragOver={(e) => {
                if (!customDrag) return;
                e.preventDefault();
                if (
                  dropIndicator?.containerId !== 'POOL' ||
                  dropIndicator?.targetId !== null
                ) {
                  setDropIndicator({
                    containerId: 'POOL',
                    targetId: null,
                    side: 'after',
                  });
                }
              }}
              onDrop={(e) => {
                if (!customDrag) return;
                e.preventDefault();
                const targetId =
                  dropIndicator?.containerId === 'POOL'
                    ? dropIndicator.targetId
                    : null;
                const side =
                  dropIndicator?.containerId === 'POOL'
                    ? dropIndicator.side
                    : 'after';
                commitCustomDrop('POOL', targetId, side);
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
                  activeCustomList.pool.map((card) => {
                    const isDraggingThis = customDrag?.card.id === card.id;
                    const dropSide =
                      dropIndicator?.containerId === 'POOL' &&
                      dropIndicator?.targetId === card.id &&
                      customDrag?.card.id !== card.id
                        ? dropIndicator.side
                        : null;

                    return (
                      <div
                        key={card.id}
                        className={`tier-tile clickable-tile draggable ${
                          isDraggingThis ? 'is-dragging' : ''
                        } ${dropSide === 'before' ? 'drop-before' : ''} ${
                          dropSide === 'after' ? 'drop-after' : ''
                        }`}
                        draggable
                        onClick={() => openByTitleOrId(card)}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', card.id);
                          setCustomDrag({ card, fromContainerId: 'POOL' });
                        }}
                        onDragOver={(e) => {
                          if (!customDrag) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const side =
                            e.clientX < rect.left + rect.width / 2
                              ? 'before'
                              : 'after';
                          setDropIndicator({
                            containerId: 'POOL',
                            targetId: card.id,
                            side,
                          });
                        }}
                        onDrop={(e) => {
                          if (!customDrag) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const side =
                            e.clientX < rect.left + rect.width / 2
                              ? 'before'
                              : 'after';
                          commitCustomDrop('POOL', card.id, side);
                        }}
                        onDragEnd={() => {
                          setCustomDrag(null);
                          setDropIndicator(null);
                        }}
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
                    );
                  })
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
