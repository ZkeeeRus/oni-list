import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  Dices,
  ExternalLink,
  Play,
  RotateCcw,
  Skull,
  Sparkles,
  Trophy,
  Undo2,
  Users,
} from 'lucide-react';
import { BacklogItem, GameItem, SiteData, WatchItem } from '../types';
import { CoverImage } from '../components/CoverImage';
import { OrdererAutocomplete } from '../components/OrdererAutocomplete';
import { collectOrdererStats } from '../utils/orderers';
import { UserPreferences } from '../utils/preferences';
import { playRouletteResult, playRouletteTick } from '../utils/soundEffects';
import { trackSiteAction } from '../utils/analytics';
import {
  BACKLOG_STATUSES,
  GAME_STATUSES,
  getRatingColor,
  RATINGS_ORDER,
  StatusBadge,
  WATCH_STATUSES,
} from '../components/Badges';

interface StatsRandomizerViewProps {
  data: SiteData;
  prefs: UserPreferences;
  canEdit: boolean;
  onUpdateGameStatus: (gameId: string, status: string) => void;
  onUpdateWatchStatus: (watchId: string, status: string) => void;
  onUpdateBacklogStatus: (backlogId: string, status: string) => void;
  onPromoteBacklogToGame: (item: BacklogItem) => void;
  onInspectGame: (gameId: string) => void;
  onInspectWatch: (watchId: string) => void;
  onInspectBacklog: (backlogId: string) => void;
  onFilterByOrderer: (orderer: string) => void;
}

type RollSource =
  | 'QUEUED_GAMES'
  | 'PAUSED_AND_QUEUED'
  | 'ACTIVE_AND_QUEUED'
  | 'VIEWER_DROPPED_GAMES'
  | 'STREAMER_TECH_DROPPED'
  | 'ALL_GAMES'
  | 'BACKLOG_READY'
  | 'BACKLOG_ALL'
  | 'WATCH_QUEUE'
  | 'WATCH_MOVIES'
  | 'WATCH_ANIME_SERIES'
  | 'WATCH_ALL'
  | 'CUSTOM_LIST';

interface RollCandidate {
  id: string;
  kind: 'game' | 'watch' | 'backlog' | 'custom';
  title: string;
  sub: string;
  status: string;
  coverUrl: string;
  steamAppId?: number | null;
  extra?: string;
}

const CARD_WIDTH = 136;
const CARD_GAP = 12;

const SHARD_VECTORS: Array<{ dx: string; dy: string; rot: string; delay: string }> = [
  { dx: '-78px', dy: '-64px', rot: '-140deg', delay: '0ms' },
  { dx: '-28px', dy: '-88px', rot: '-75deg', delay: '20ms' },
  { dx: '34px', dy: '-86px', rot: '85deg', delay: '10ms' },
  { dx: '82px', dy: '-58px', rot: '150deg', delay: '30ms' },
  { dx: '94px', dy: '-6px', rot: '195deg', delay: '15ms' },
  { dx: '80px', dy: '56px', rot: '125deg', delay: '35ms' },
  { dx: '32px', dy: '84px', rot: '65deg', delay: '25ms' },
  { dx: '-30px', dy: '86px', rot: '-65deg', delay: '15ms' },
  { dx: '-82px', dy: '54px', rot: '-130deg', delay: '30ms' },
  { dx: '-94px', dy: '-4px', rot: '-190deg', delay: '10ms' },
  { dx: '-54px', dy: '-42px', rot: '-95deg', delay: '40ms' },
  { dx: '56px', dy: '38px', rot: '110deg', delay: '45ms' },
];

function shuffleCandidates<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function isSameCandidate(a?: RollCandidate, b?: RollCandidate): boolean {
  if (!a || !b) return false;
  if (a.id === b.id) return true;
  return a.title.trim().toLowerCase() === b.title.trim().toLowerCase();
}

// Перемешивает весь пул вариантов один раз за прокрут и зацикливает его по кругу (напр. 3-4-2-1-3-4-2-1...) с точным попаданием победителя в winSlot
function buildAlternatingReelSequence(
  candidates: RollCandidate[],
  chosen: RollCandidate,
  totalSlots: number,
  winSlot: number
): RollCandidate[] {
  const n = candidates.length;
  if (n === 0) return [];
  if (n === 1) {
    return Array.from({ length: totalSlots }, () => candidates[0]);
  }

  const cycle = shuffleCandidates(candidates);
  let chosenIdx = cycle.findIndex((c) => c.id === chosen.id);
  if (chosenIdx === -1) {
    chosenIdx = cycle.findIndex((c) => isSameCandidate(c, chosen));
  }
  if (chosenIdx === -1) {
    chosenIdx = 0;
    cycle[0] = chosen;
  }

  return Array.from({ length: totalSlots }, (_, i) => {
    const pos = (((i - winSlot + chosenIdx) % n) + n) % n;
    return cycle[pos];
  });
}

export const StatsRandomizerView: React.FC<StatsRandomizerViewProps> = ({
  data,
  prefs,
  canEdit,
  onUpdateGameStatus,
  onUpdateWatchStatus,
  onUpdateBacklogStatus,
  onPromoteBacklogToGame,
  onInspectGame,
  onInspectWatch,
  onInspectBacklog,
  onFilterByOrderer,
}) => {
  const hasQueued = data.games.some((g) => g.status === 'Заказано');
  const [rollSource, setRollSource] = useState<RollSource>(
    hasQueued ? 'QUEUED_GAMES' : 'BACKLOG_READY'
  );
  const [rollMode, setRollMode] = useState<'normal' | 'elimination'>('normal');
  const [spinInput, setSpinInput] = useState<string>('5');
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([]);
  const [lastEliminated, setLastEliminated] = useState<RollCandidate | null>(null);
  const [destroyingSlot, setDestroyingSlot] = useState<number | null>(null);
  const [customLines, setCustomLines] = useState(
    'Вариант 1\nВариант 2\nВариант 3'
  );

  const parsedSpin = Number(spinInput.replace(',', '.'));
  const spinSeconds = Number.isFinite(parsedSpin) && parsedSpin > 0
    ? Math.min(60, Math.max(1, parsedSpin))
    : 5;

  // Tape animation state
  const stageRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const spinControlRef = useRef<HTMLDivElement | null>(null);
  const spinSecondsRef = useRef<number>(spinSeconds);
  spinSecondsRef.current = spinSeconds;
  const isBusyRef = useRef<boolean>(false);
  const spinTimerRef = useRef<number | null>(null);
  const destroyTimerRef = useRef<number | null>(null);
  const [reelItems, setReelItems] = useState<RollCandidate[]>([]);
  const [activeWinnerSlot, setActiveWinnerSlot] = useState(38);
  const [translateX, setTranslateX] = useState(0);
  const [animateTransition, setAnimateTransition] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [winnerKind, setWinnerKind] = useState<RollCandidate['kind'] | null>(null);
  const [customWinnerTitle, setCustomWinnerTitle] = useState<string | null>(null);
  const [showAllOrderers, setShowAllOrderers] = useState(false);
  const [viewerSearch, setViewerSearch] = useState('');

  const isBusy = rolling || destroyingSlot !== null;
  isBusyRef.current = isBusy;

  useEffect(() => {
    const el = spinControlRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (isBusyRef.current) return;
      e.preventDefault();
      const dir = e.deltaY < 0 ? 0.5 : -0.5;
      const next = Math.min(
        60,
        Math.max(1, Math.round((spinSecondsRef.current + dir) * 2) / 2)
      );
      setSpinInput(String(next));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleScrubMouseDown = (e: React.MouseEvent<HTMLLabelElement>) => {
    if (isBusy || e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startVal = spinSeconds;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const raw = startVal + dx * 0.12;
      const next = Math.min(60, Math.max(1, Math.round(raw * 2) / 2));
      setSpinInput(String(next));
    };

    const onUp = () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current);
      if (destroyTimerRef.current) window.clearTimeout(destroyTimerRef.current);
    };
  }, []);

  const mapGame = (g: GameItem): RollCandidate => ({
    id: g.id,
    kind: 'game',
    title: g.title,
    sub: `Заказал: ${g.orderedBy}`,
    status: g.status,
    coverUrl: g.coverUrl,
    steamAppId: g.steamAppId,
    extra: g.conditions || g.comment,
  });

  const mapWatch = (w: WatchItem): RollCandidate => ({
    id: w.id,
    kind: 'watch',
    title: w.title,
    sub: `${w.category} • ${w.orderedBy}`,
    status: w.status,
    coverUrl: w.coverUrl,
    steamAppId: null,
    extra: w.comment || w.conditions,
  });

  const mapBacklog = (b: BacklogItem): RollCandidate => ({
    id: b.id,
    kind: 'backlog',
    title: b.title,
    sub: `Бэклог • ${b.priority} приоритет`,
    status: b.status,
    coverUrl: b.coverUrl,
    steamAppId: b.steamAppId,
    extra: b.idea || b.notes,
  });

  const pool = useMemo<RollCandidate[]>(() => {
    switch (rollSource) {
      case 'QUEUED_GAMES':
        return data.games.filter((g) => g.status === 'Заказано').map(mapGame);
      case 'PAUSED_AND_QUEUED':
        return data.games
          .filter((g) => g.status === 'Заказано' || g.status === 'Отложено')
          .map(mapGame);
      case 'ACTIVE_AND_QUEUED':
        return data.games
          .filter(
            (g) =>
              g.status === 'В процессе' ||
              g.status === 'Проходится' ||
              g.status === 'Заказано' ||
              g.status === 'Отложено'
          )
          .map(mapGame);
      case 'VIEWER_DROPPED_GAMES':
        return data.games
          .filter((g) => g.status === 'Игра дропнута зрителями')
          .map(mapGame);
      case 'STREAMER_TECH_DROPPED':
        return data.games
          .filter(
            (g) => g.status === 'Стример дропнул' || g.status === 'Тех дроп'
          )
          .map(mapGame);
      case 'ALL_GAMES':
        return data.games.map(mapGame);
      case 'BACKLOG_READY':
        return data.backlog
          .filter(
            (b) => b.status === 'Готово к стриму' || b.status === 'На примете'
          )
          .map(mapBacklog);
      case 'BACKLOG_ALL':
        return data.backlog.map(mapBacklog);
      case 'WATCH_QUEUE':
        return data.watchlist
          .filter(
            (w) =>
              w.status === 'Заказано' ||
              w.status === 'В процессе' ||
              w.status === 'Отложено'
          )
          .map(mapWatch);
      case 'WATCH_MOVIES':
        return data.watchlist.filter((w) => w.category === 'Фильм').map(mapWatch);
      case 'WATCH_ANIME_SERIES':
        return data.watchlist
          .filter((w) => w.category === 'Аниме' || w.category === 'Сериал')
          .map(mapWatch);
      case 'WATCH_ALL':
        return data.watchlist.map(mapWatch);
      case 'CUSTOM_LIST':
        return customLines
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((line, i) => ({
            id: `custom-opt-${i}`,
            kind: 'custom' as const,
            title: line,
            sub: 'Свой вариант',
            status: 'Свой вариант',
            coverUrl: '',
          }));
    }
  }, [data, rollSource, customLines]);

  const eliminatedSet = useMemo(() => new Set(eliminatedIds), [eliminatedIds]);
  const activePool = useMemo(
    () =>
      rollMode === 'elimination'
        ? pool.filter((x) => !eliminatedSet.has(x.id))
        : pool,
    [pool, rollMode, eliminatedSet]
  );

  const handleInspectCandidate = (c: RollCandidate) => {
    if (c.kind === 'game') onInspectGame(c.id);
    else if (c.kind === 'watch') onInspectWatch(c.id);
    else if (c.kind === 'backlog') onInspectBacklog(c.id);
  };

  // Real-time sound ticks synchronized to live CSS transform of the tape!
  useEffect(() => {
    if (!rolling) return;
    let raf = 0;
    let lastIndex = -1;
    const step = CARD_WIDTH + CARD_GAP;
    const startTs = performance.now();
    const totalMs = spinSeconds * 1000;

    const checkTick = () => {
      const trackEl = trackRef.current;
      const stageEl = stageRef.current;
      if (trackEl && stageEl) {
        const style = window.getComputedStyle(trackEl);
        const matrix = new DOMMatrixReadOnly(style.transform);
        const currentOffset = -matrix.m41 + stageEl.clientWidth / 2;
        const idx = Math.floor(currentOffset / step);
        if (idx !== lastIndex && idx >= 0) {
          if (lastIndex !== -1) {
            const progress = Math.min(1, (performance.now() - startTs) / totalMs);
            playRouletteTick(prefs, progress);
          }
          lastIndex = idx;
        }
      }
      raf = requestAnimationFrame(checkTick);
    };

    raf = requestAnimationFrame(checkTick);
    return () => cancelAnimationFrame(raf);
  }, [rolling, spinSeconds, prefs]);

  const handleSpin = () => {
    if (isBusy) return;
    const currentCandidates = rollMode === 'elimination' ? activePool : pool;
    if (currentCandidates.length === 0) return;

    // Нормализуем поле ввода перед запуском прокрутки
    setSpinInput(String(spinSeconds));

    // Если в режиме на выбывание остался ровно 1 выживший - сразу объявляем его чемпионом
    if (rollMode === 'elimination' && currentCandidates.length === 1) {
      const champ = currentCandidates[0];
      setWinnerId(champ.id);
      setWinnerKind(champ.kind);
      if (champ.kind === 'custom') setCustomWinnerTitle(champ.title);
      playRouletteResult(prefs, 'win');
      return;
    }

    const winSlot = Math.max(18, Math.min(220, Math.round(spinSeconds * 8.5)));
    const totalSlots = winSlot + 14;

    const chosen =
      currentCandidates[Math.floor(Math.random() * currentCandidates.length)];
    const sequence = buildAlternatingReelSequence(
      currentCandidates,
      chosen,
      totalSlots,
      winSlot
    );

    setRolling(true);
    trackSiteAction('roulette_spin');
    setDestroyingSlot(null);
    setActiveWinnerSlot(winSlot);
    setWinnerId(null);
    setWinnerKind(null);
    setCustomWinnerTitle(null);
    setLastEliminated(null);
    setAnimateTransition(false);
    setTranslateX(0);
    setReelItems(sequence);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const viewportW = stageRef.current?.clientWidth || 800;
        const step = CARD_WIDTH + CARD_GAP;
        const cardCenter = winSlot * step + CARD_WIDTH / 2;
        const jitter = (Math.random() - 0.5) * (CARD_WIDTH * 0.52);
        const target = Math.max(0, cardCenter - viewportW / 2 + jitter);

        setAnimateTransition(true);
        setTranslateX(target);

        spinTimerRef.current = window.setTimeout(() => {
          setRolling(false);
          if (rollMode === 'elimination') {
            // Запускаем взрыв/уничтожение выпавшей карточки в ленте
            setDestroyingSlot(winSlot);
            playRouletteResult(prefs, 'eliminated');

            destroyTimerRef.current = window.setTimeout(() => {
              setDestroyingSlot(null);
              setEliminatedIds((prev) =>
                prev.includes(chosen.id) ? prev : [...prev, chosen.id]
              );
              setLastEliminated(chosen);

              const survivors = currentCandidates.filter(
                (x) => x.id !== chosen.id
              );
              if (survivors.length === 1) {
                const champ = survivors[0];
                setWinnerId(champ.id);
                setWinnerKind(champ.kind);
                if (champ.kind === 'custom') setCustomWinnerTitle(champ.title);
                playRouletteResult(prefs, 'win');
              }
            }, 880);
          } else {
            setWinnerId(chosen.id);
            setWinnerKind(chosen.kind);
            if (chosen.kind === 'custom') {
              setCustomWinnerTitle(chosen.title);
            }
            playRouletteResult(prefs, 'win');
          }
        }, spinSeconds * 1000 + 60);
      });
    });
  };

  // Live resolved winner from data so status updates reflect immediately!
  const resolvedWinner = useMemo<RollCandidate | null>(() => {
    if (!winnerId || !winnerKind) return null;
    if (winnerKind === 'game') {
      const g = data.games.find((x) => x.id === winnerId);
      return g ? mapGame(g) : null;
    }
    if (winnerKind === 'watch') {
      const w = data.watchlist.find((x) => x.id === winnerId);
      return w ? mapWatch(w) : null;
    }
    if (winnerKind === 'backlog') {
      const b = data.backlog.find((x) => x.id === winnerId);
      return b ? mapBacklog(b) : null;
    }
    if (winnerKind === 'custom' && customWinnerTitle) {
      return {
        id: winnerId,
        kind: 'custom',
        title: customWinnerTitle,
        sub: 'Свой вариант',
        status: 'Выбрано',
        coverUrl: '',
      };
    }
    return null;
  }, [winnerId, winnerKind, customWinnerTitle, data]);

  const dropChance =
    activePool.length > 0 ? (100 / activePool.length).toFixed(2) : '0';

  const allOrderers = useMemo(() => {
    const stats = collectOrdererStats(data.games, data.watchlist);
    const totalOrders = Math.max(1, data.games.length + data.watchlist.length);
    return stats.map((e, index) => ({
      ...e,
      rank: index + 1,
      pct: ((e.total / totalOrders) * 100).toFixed(1),
    }));
  }, [data.games, data.watchlist]);

  const visibleOrderers = useMemo(() => {
    const q = viewerSearch.trim().toLowerCase();
    const filtered = q
      ? allOrderers.filter((o) => o.display.toLowerCase().includes(q))
      : allOrderers;
    if (q || showAllOrderers) return filtered;
    return filtered.slice(0, 15);
  }, [allOrderers, viewerSearch, showAllOrderers]);

  const ratingStats = useMemo(() => {
    return RATINGS_ORDER.filter((r) => r !== 'Нет мнения').map((r) => {
      const cnt = data.games.filter((g) => g.rating === r).length;
      return { rating: r, count: cnt, color: getRatingColor(r) };
    });
  }, [data.games]);

  const maxRatingCount = Math.max(1, ...ratingStats.map((r) => r.count));
  const maxOrderCount = Math.max(1, ...allOrderers.map((o) => o.total));

  return (
    <div className="view-stack">
      <div className="page-header">
        <div>
          <h1>Рулетка и Статистика канала</h1>
          <p className="muted-sm">
            Прокрутка ленты как в кейсах, выбор пула и мгновенная смена статуса выпавшего варианта
          </p>
        </div>
      </div>

      {/* Roulette Section */}
      <section className="section-block randomizer-box">
        <div className="section-head">
          <div>
            <h2>
              <Dices size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Рулетка на стрим
            </h2>
            <p className="muted-sm">
              {rollMode === 'elimination' ? (
                <>
                  Осталось в игре: <strong>{activePool.length}</strong> из {pool.length} • Выбыло:{' '}
                  <strong>{eliminatedIds.length}</strong> • Шанс вылета:{' '}
                  <strong>{dropChance}%</strong>
                </>
              ) : (
                <>
                  В пуле сейчас: <strong>{pool.length}</strong> вариков • Шанс каждого:{' '}
                  <strong>{dropChance}%</strong>
                </>
              )}
            </p>
          </div>

          <div className="row-gap-sm wrap">
            <select
              className="input select-auto"
              value={rollSource}
              disabled={isBusy}
              onChange={(e) => {
                setRollSource(e.target.value as RollSource);
                setReelItems([]);
                setWinnerId(null);
                setEliminatedIds([]);
                setLastEliminated(null);
              }}
            >
              <optgroup label="Игры">
                <option value="QUEUED_GAMES">
                  Игры: «Заказано» (
                  {data.games.filter((g) => g.status === 'Заказано').length})
                </option>
                <option value="PAUSED_AND_QUEUED">
                  Игры: «Заказано» + «Отложено» (
                  {
                    data.games.filter(
                      (g) => g.status === 'Заказано' || g.status === 'Отложено'
                    ).length
                  }
                  )
                </option>
                <option value="ACTIVE_AND_QUEUED">
                  Игры: Активные + Очередь + Отложенные (
                  {
                    data.games.filter(
                      (g) =>
                        g.status === 'В процессе' ||
                        g.status === 'Проходится' ||
                        g.status === 'Заказано' ||
                        g.status === 'Отложено'
                    ).length
                  }
                  )
                </option>
                <option value="VIEWER_DROPPED_GAMES">
                  Игры: Дропнутые зрителями - на реванш (
                  {
                    data.games.filter((g) => g.status === 'Игра дропнута зрителями')
                      .length
                  }
                  )
                </option>
                <option value="STREAMER_TECH_DROPPED">
                  Игры: Дроп стримера + Тех дроп (
                  {
                    data.games.filter(
                      (g) => g.status === 'Стример дропнул' || g.status === 'Тех дроп'
                    ).length
                  }
                  )
                </option>
                <option value="ALL_GAMES">
                  Игры: Полный рандом по всей базе ({data.games.length})
                </option>
              </optgroup>

              <optgroup label="Бэклог идей">
                <option value="BACKLOG_READY">
                  Бэклог: Готово к стриму и На примете (
                  {
                    data.backlog.filter(
                      (b) =>
                        b.status === 'Готово к стриму' || b.status === 'На примете'
                    ).length
                  }
                  )
                </option>
                <option value="BACKLOG_ALL">Весь бэклог ({data.backlog.length})</option>
              </optgroup>

              <optgroup label="Просмотровое">
                <option value="WATCH_QUEUE">
                  Просмотровое: В процессе / Заказано / Отложено (
                  {
                    data.watchlist.filter(
                      (w) =>
                        w.status === 'Заказано' ||
                        w.status === 'В процессе' ||
                        w.status === 'Отложено'
                    ).length
                  }
                  )
                </option>
                <option value="WATCH_MOVIES">
                  Просмотровое: Фильмы (
                  {data.watchlist.filter((w) => w.category === 'Фильм').length})
                </option>
                <option value="WATCH_ANIME_SERIES">
                  Просмотровое: Аниме и Сериалы (
                  {
                    data.watchlist.filter(
                      (w) => w.category === 'Аниме' || w.category === 'Сериал'
                    ).length
                  }
                  )
                </option>
                <option value="WATCH_ALL">
                  Просмотровое: Все тайтлы ({data.watchlist.length})
                </option>
              </optgroup>

              <optgroup label="Кастомная рулетка">
                <option value="CUSTOM_LIST">Свои варианты (вписать вручную)</option>
              </optgroup>
            </select>

            <button
              className="btn btn-primary"
              onClick={handleSpin}
              disabled={isBusy || activePool.length === 0}
            >
              <Sparkles size={16} />{' '}
              {rolling
                ? 'Крутится...'
                : destroyingSlot !== null
                  ? 'Выбывание...'
                  : rollMode === 'elimination'
                    ? activePool.length <= 1
                      ? 'Определить чемпиона!'
                      : 'Крутить на выбывание!'
                    : 'Крутить рулетку!'}
            </button>
          </div>
        </div>

        {/* Roulette Mode & Spin Duration Bar */}
        <div className="roulette-settings-bar">
          <div className="row-gap-sm wrap">
            <span className="muted-xs">Режим:</span>
            <div className="segmented">
              <button
                type="button"
                disabled={isBusy}
                className={rollMode === 'normal' ? 'active' : ''}
                onClick={() => {
                  setRollMode('normal');
                  setLastEliminated(null);
                }}
              >
                Обычный
              </button>
              <button
                type="button"
                disabled={isBusy}
                className={rollMode === 'elimination' ? 'active' : ''}
                onClick={() => {
                  setRollMode('elimination');
                  setWinnerId(null);
                }}
              >
                <Skull size={14} /> На выбывание
              </button>
            </div>
          </div>

          <div className="row-gap-xs wrap" ref={spinControlRef}>
            <label
              className="muted-xs unity-scrub-label"
              htmlFor="spin-seconds-input"
              onMouseDown={handleScrubMouseDown}
            >
              <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Сколько крутить (сек):
            </label>
            <input
              id="spin-seconds-input"
              type="number"
              min={1}
              max={60}
              step="any"
              disabled={isBusy}
              value={spinInput}
              onChange={(e) => setSpinInput(e.target.value)}
              onBlur={() => setSpinInput(String(spinSeconds))}
              className="input input-sm spin-num-input"
            />
          </div>

          {rollMode === 'elimination' && eliminatedIds.length > 0 && (
            <div className="row-gap-xs wrap">
              <button
                type="button"
                disabled={isBusy}
                className="btn btn-secondary btn-xs"
                onClick={() => {
                  setEliminatedIds((prev) => prev.slice(0, -1));
                  setWinnerId(null);
                  setLastEliminated(null);
                }}
              >
                <Undo2 size={12} /> Вернуть последнего
              </button>
              <button
                type="button"
                disabled={isBusy}
                className="btn btn-ghost btn-xs"
                onClick={() => {
                  setEliminatedIds([]);
                  setWinnerId(null);
                  setLastEliminated(null);
                }}
              >
                <RotateCcw size={12} /> Сбросить выбывших ({eliminatedIds.length})
              </button>
            </div>
          )}
        </div>

        {rollSource === 'CUSTOM_LIST' && (
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">
              Впиши варианты (каждый с новой строки):
            </label>
            <textarea
              className="input textarea-sm"
              rows={4}
              value={customLines}
              onChange={(e) => setCustomLines(e.target.value)}
              placeholder="Каждый вариант с новой строки..."
            />
          </div>
        )}

        {pool.length === 0 ? (
          <div className="empty-roll-hint">
            В этой категории сейчас 0 вариантов. Выбери другой пул в списке выше!
          </div>
        ) : (
          <>
            {/* Animated Case-Opening Tape */}
            {reelItems.length > 0 && (
              <div
                className={`case-reel-viewport ${
                  destroyingSlot !== null ? 'reel-impact-shake' : ''
                }`}
                ref={stageRef}
              >
                <div className="case-reel-pointer-top" />
                <div className="case-reel-center-line" />
                <div
                  className="case-reel-track"
                  ref={trackRef}
                  style={{
                    transform: `translate3d(-${translateX}px, 0, 0)`,
                    transition: animateTransition
                      ? `transform ${spinSeconds}s cubic-bezier(0.11, 0.86, 0.16, 1)`
                      : 'none',
                  }}
                >
                  {reelItems.map((item, idx) => {
                    const isLanded = !rolling && idx === activeWinnerSlot;
                    const isDestroying = destroyingSlot === idx;
                    const isElimTile =
                      isLanded &&
                      !isDestroying &&
                      rollMode === 'elimination' &&
                      lastEliminated?.id === item.id;
                    const isWinTile =
                      isLanded && !isDestroying && !isElimTile && winnerId !== null;
                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        className={`case-reel-card ${isWinTile ? 'is-winner' : ''} ${
                          isDestroying ? 'is-destroying' : ''
                        } ${isElimTile ? 'is-eliminated' : ''}`}
                        onClick={() => !isBusy && handleInspectCandidate(item)}
                      >
                        <div className="case-reel-card-inner">
                          <CoverImage
                            title={item.title}
                            coverUrl={item.coverUrl}
                            steamAppId={item.steamAppId}
                          />
                          <div className="case-reel-title">{item.title}</div>
                        </div>

                        {(isDestroying || isElimTile) && (
                          <div className="destroy-fx-layer" aria-hidden="true">
                            <svg
                              className="destroy-cracks"
                              viewBox="0 0 136 210"
                              preserveAspectRatio="none"
                            >
                              <path
                                d="M68,95 L22,18 M68,95 L118,26 M68,95 L10,122 M68,95 L128,136 M68,95 L42,196 M68,95 L104,192 M46,58 L18,66 M92,62 L122,74"
                                stroke="#fca5a5"
                                strokeWidth="2.2"
                                fill="none"
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="destroy-stamp">💥 ВЫБЫЛ</span>
                            {isDestroying && (
                              <>
                                <span className="destroy-shockwave" />
                                {SHARD_VECTORS.map((vec, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="destroy-shard"
                                    style={
                                      {
                                        '--dx': vec.dx,
                                        '--dy': vec.dy,
                                        '--rot': vec.rot,
                                        animationDelay: vec.delay,
                                      } as React.CSSProperties
                                    }
                                  />
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Intermediate Eliminated Card in Elimination Mode */}
            {rollMode === 'elimination' && lastEliminated && !winnerId && !isBusy && (
              <div className="roulette-winner-card eliminated-card" style={{ marginTop: 16 }}>
                <div
                  className="clickable-card"
                  onClick={() => handleInspectCandidate(lastEliminated)}
                >
                  <CoverImage
                    title={lastEliminated.title}
                    coverUrl={lastEliminated.coverUrl}
                    steamAppId={lastEliminated.steamAppId}
                    className="roulette-cover"
                  />
                </div>
                <div className="roulette-winner-info">
                  <div className="row-gap-xs wrap">
                    <span className="badge tone-dropped">❌ Выбыл из гонки!</span>
                    <span className="muted-xs">
                      Осталось выживших: <strong>{activePool.length}</strong>
                    </span>
                  </div>
                  <h3
                    className="winner-title-link"
                    onClick={() => handleInspectCandidate(lastEliminated)}
                  >
                    {lastEliminated.title}
                  </h3>
                  <p className="muted-sm">{lastEliminated.sub}</p>
                  <div className="row-gap-sm wrap" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSpin}
                    >
                      <Sparkles size={14} /> Крутить следующий раунд ({activePool.length} в игре)
                    </button>
                    {lastEliminated.kind !== 'custom' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleInspectCandidate(lastEliminated)}
                      >
                        <ExternalLink size={14} /> Открыть карточку
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Winner Result Card with Instant Status Controls */}
            {resolvedWinner && !isBusy && (
              <div className="roulette-winner-card won" style={{ marginTop: 16 }}>
                <div
                  className="clickable-card"
                  onClick={() => handleInspectCandidate(resolvedWinner)}
                >
                  <CoverImage
                    title={resolvedWinner.title}
                    coverUrl={resolvedWinner.coverUrl}
                    steamAppId={resolvedWinner.steamAppId}
                    className="roulette-cover"
                  />
                </div>

                <div className="roulette-winner-info">
                  <div className="row-gap-xs wrap">
                    <span className="badge tone-active">
                      {rollMode === 'elimination'
                        ? '🏆 Победитель на выбывание!'
                        : '🎉 Выпало на рулетке!'}
                    </span>
                    <StatusBadge status={resolvedWinner.status} />
                  </div>

                  <h3
                    className="winner-title-link"
                    onClick={() => handleInspectCandidate(resolvedWinner)}
                  >
                    {resolvedWinner.title}
                  </h3>
                  <p className="muted-sm">{resolvedWinner.sub}</p>
                  {resolvedWinner.extra && (
                    <p className="card-note clamp-3" style={{ marginTop: 6 }}>
                      {resolvedWinner.extra}
                    </p>
                  )}

                  <div className="row-gap-sm wrap" style={{ marginTop: 12 }}>
                    {resolvedWinner.kind !== 'custom' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleInspectCandidate(resolvedWinner)}
                      >
                        <ExternalLink size={14} /> Открыть карточку
                      </button>
                    )}

                    {/* Moderator / Streamer Instant Status Controls right after Spin */}
                    {canEdit && resolvedWinner.kind === 'game' && (
                      <>
                        <select
                          className="input input-sm select-auto"
                          value={resolvedWinner.status}
                          onChange={(e) =>
                            onUpdateGameStatus(resolvedWinner.id, e.target.value)
                          }
                        >
                          {GAME_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              Статус: {s}
                            </option>
                          ))}
                        </select>
                        {resolvedWinner.status !== 'В процессе' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() =>
                              onUpdateGameStatus(resolvedWinner.id, 'В процессе')
                            }
                          >
                            <Play size={14} /> В процессе
                          </button>
                        )}
                      </>
                    )}

                    {canEdit && resolvedWinner.kind === 'watch' && (
                      <>
                        <select
                          className="input input-sm select-auto"
                          value={resolvedWinner.status}
                          onChange={(e) =>
                            onUpdateWatchStatus(resolvedWinner.id, e.target.value)
                          }
                        >
                          {WATCH_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              Статус: {s}
                            </option>
                          ))}
                        </select>
                        {resolvedWinner.status !== 'В процессе' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() =>
                              onUpdateWatchStatus(resolvedWinner.id, 'В процессе')
                            }
                          >
                            <Play size={14} /> Смотрим сейчас
                          </button>
                        )}
                      </>
                    )}

                    {canEdit && resolvedWinner.kind === 'backlog' && (
                      <>
                        <select
                          className="input input-sm select-auto"
                          value={resolvedWinner.status}
                          onChange={(e) =>
                            onUpdateBacklogStatus(resolvedWinner.id, e.target.value)
                          }
                        >
                          {BACKLOG_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              Статус: {s}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            const found = data.backlog.find(
                              (b) => b.id === resolvedWinner.id
                            );
                            if (found) onPromoteBacklogToGame(found);
                          }}
                        >
                          <Play size={14} /> Перенести в Список игр («В процессе»)
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Pool Preview Grid */}
            <div style={{ marginTop: 18 }}>
              <div className="muted-xs" style={{ marginBottom: 8 }}>
                {rollMode === 'elimination'
                  ? `Участники гонки на выбывание (в игре ${activePool.length} из ${pool.length}) - можно вручную зачеркнуть/вернуть:`
                  : `Участники текущего пула (${pool.length}) - нажми на любого, чтобы посмотреть:`}
              </div>
              <div className="roulette-pool-preview">
                {pool.slice(0, 36).map((item) => {
                  const isOut = rollMode === 'elimination' && eliminatedSet.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`mini-pool-card clickable-card ${isOut ? 'pool-out' : ''}`}
                      onClick={() => handleInspectCandidate(item)}
                    >
                      <div style={{ position: 'relative' }}>
                        <CoverImage
                          title={item.title}
                          coverUrl={item.coverUrl}
                          steamAppId={item.steamAppId}
                        />
                        {rollMode === 'elimination' && (
                          <button
                            type="button"
                            className="pool-toggle-elim-btn"
                            title={isOut ? 'Вернуть в пул' : 'Вычеркнуть из пула'}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isBusy) return;
                              setEliminatedIds((prev) =>
                                prev.includes(item.id)
                                  ? prev.filter((x) => x !== item.id)
                                  : [...prev, item.id]
                              );
                            }}
                          >
                            {isOut ? '↺' : '✕'}
                          </button>
                        )}
                      </div>
                      <span>{item.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Stats Grid: Top Orderers + Ratings */}
      <div className="two-col-hub">
        <section className="section-block">
          <div className="section-head">
            <div>
              <h2>
                <Users size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Статистика заказчиков ({allOrderers.length})
              </h2>
              <p className="muted-sm">Кликни на ник, чтобы открыть все заказы зрителя</p>
            </div>
            {allOrderers.length > 15 && !viewerSearch && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAllOrderers((v) => !v)}
              >
                {showAllOrderers
                  ? 'Свернуть'
                  : `Все (${allOrderers.length})`}
              </button>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <OrdererAutocomplete
              value={viewerSearch}
              onChange={setViewerSearch}
              orderers={allOrderers}
              placeholder="Найти зрителя в статистике..."
            />
          </div>

          <div className="bars-list">
            {visibleOrderers.map((ord) => (
              <button
                key={ord.key}
                type="button"
                className="bar-row-btn"
                onClick={() => onFilterByOrderer(ord.display)}
              >
                <div className="row-between wrap">
                  <span>
                    <strong className="rank-num">#{ord.rank}</strong> {ord.display}
                  </span>
                  <span className="muted-sm">
                    <strong>{ord.total}</strong> зак. ({ord.gamesCount} игр
                    {ord.watchCount > 0 ? `, ${ord.watchCount} просм.` : ''}) • пройдено {ord.completedGames}
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill purple"
                    style={{ width: `${(ord.total / maxOrderCount) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </div>

          {allOrderers.length > 15 && !viewerSearch && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}
              onClick={() => setShowAllOrderers((v) => !v)}
            >
              {showAllOrderers
                ? 'Свернуть до топ-15'
                : `Развернуть весь список (${allOrderers.length} заказчиков)`}
            </button>
          )}
        </section>

        <section className="section-block">
          <div className="section-head">
            <div>
              <h2>
                <Trophy size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Распределение оценок и статусов
              </h2>
              <p className="muted-sm">Всего игр в списке: {data.games.length}</p>
            </div>
          </div>

          <div className="bars-list">
            {ratingStats.map((rs) => (
              <div key={rs.rating} className="bar-row-static">
                <div className="row-between">
                  <strong style={{ color: rs.color }}>{rs.rating}</strong>
                  <span>{rs.count} игр</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(rs.count / maxRatingCount) * 100}%`,
                      backgroundColor: rs.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="status-summary-chips" style={{ marginTop: 22 }}>
            {[
              'Игра пройдена',
              'Игра дропнута зрителями',
              'Стример дропнул',
              'Тех дроп',
              'В процессе',
              'Отложено',
            ].map((st) => {
              const cnt = data.games.filter((g) => g.status === st).length;
              return (
                <div key={st} className="summary-stat-box">
                  <StatusBadge status={st} />
                  <strong>{cnt}</strong>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
