import React, { useMemo, useState } from 'react';
import { Dices, Play, Sparkles, Trophy, Users } from 'lucide-react';
import { SiteData } from '../types';
import { CoverImage } from '../components/CoverImage';
import { getRatingColor, RATINGS_ORDER, StatusBadge } from '../components/Badges';

interface StatsRandomizerViewProps {
  data: SiteData;
  canEdit: boolean;
  onStartRolledGame: (gameId: string) => void;
  onFilterByOrderer: (orderer: string) => void;
}

type RollSource = 'QUEUED_GAMES' | 'PAUSED_AND_QUEUED' | 'BACKLOG_READY' | 'WATCH_QUEUE';

export const StatsRandomizerView: React.FC<StatsRandomizerViewProps> = ({
  data,
  canEdit,
  onStartRolledGame,
  onFilterByOrderer,
}) => {
  const [rollSource, setRollSource] = useState<RollSource>('BACKLOG_READY');
  const [rolling, setRolling] = useState(false);
  const [currentPreviewIdx, setCurrentPreviewIdx] = useState<number | null>(null);
  const [winnerIdx, setWinnerIdx] = useState<number | null>(null);

  const pool = useMemo(() => {
    if (rollSource === 'QUEUED_GAMES') {
      return data.games
        .filter((g) => g.status === 'Заказано')
        .map((g) => ({
          id: g.id,
          kind: 'game' as const,
          title: g.title,
          sub: `Заказал: ${g.orderedBy}`,
          coverUrl: g.coverUrl,
          steamAppId: g.steamAppId,
          extra: g.conditions,
        }));
    }
    if (rollSource === 'PAUSED_AND_QUEUED') {
      return data.games
        .filter((g) => g.status === 'Заказано' || g.status === 'Отложено')
        .map((g) => ({
          id: g.id,
          kind: 'game' as const,
          title: g.title,
          sub: `${g.status} • ${g.orderedBy}`,
          coverUrl: g.coverUrl,
          steamAppId: g.steamAppId,
          extra: g.conditions,
        }));
    }
    if (rollSource === 'WATCH_QUEUE') {
      return data.watchlist
        .filter((w) => w.status === 'Заказано' || w.status === 'В процессе' || w.status === 'Отложено')
        .map((w) => ({
          id: w.id,
          kind: 'watch' as const,
          title: w.title,
          sub: `${w.category} • ${w.orderedBy}`,
          coverUrl: w.coverUrl,
          steamAppId: null,
          extra: w.comment,
        }));
    }
    return data.backlog
      .filter((b) => b.status === 'Готово к стриму' || b.status === 'На примете')
      .map((b) => ({
        id: b.id,
        kind: 'backlog' as const,
        title: b.title,
        sub: b.status,
        coverUrl: b.coverUrl,
        steamAppId: b.steamAppId,
        extra: b.idea || b.notes,
      }));
  }, [data, rollSource]);

  React.useEffect(() => {
    const hasQueued = data.games.some((g) => g.status === 'Заказано');
    if (hasQueued) {
      setRollSource('QUEUED_GAMES');
    }
  }, []);

  const handleSpin = () => {
    if (pool.length === 0 || rolling) return;
    setRolling(true);
    setWinnerIdx(null);
    let ticks = 0;
    const totalTicks = 22;
    const finalIdx = Math.floor(Math.random() * pool.length);

    const step = () => {
      ticks++;
      if (ticks < totalTicks) {
        setCurrentPreviewIdx(Math.floor(Math.random() * pool.length));
        setTimeout(step, 55 + ticks * 8);
      } else {
        setCurrentPreviewIdx(finalIdx);
        setWinnerIdx(finalIdx);
        setRolling(false);
      }
    };
    step();
  };

  const shownItem =
    winnerIdx !== null
      ? pool[winnerIdx]
      : currentPreviewIdx !== null
      ? pool[currentPreviewIdx]
      : null;

  const dropChance = pool.length > 0 ? (100 / pool.length).toFixed(2) : '0';

  // Top Orderers calculation
  const topOrderers = useMemo(() => {
    const counts = new Map<string, { display: string; count: number; completed: number }>();
    for (const g of data.games) {
      const raw = (g.orderedBy || '').trim();
      if (!raw || raw === '-' || raw === '?') continue;
      // Normalize case
      const key = raw.toLowerCase();
      const entry = counts.get(key) || { display: raw, count: 0, completed: 0 };
      entry.count += 1;
      if (g.status === 'Игра пройдена') entry.completed += 1;
      counts.set(key, entry);
    }
    const total = data.games.length || 1;
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((e) => ({
        ...e,
        pct: ((e.count / total) * 100).toFixed(1),
      }));
  }, [data.games]);

  const ratingStats = useMemo(() => {
    return RATINGS_ORDER.filter((r) => r !== 'Нет мнения').map((r) => {
      const cnt = data.games.filter((g) => g.rating === r).length;
      return { rating: r, count: cnt, color: getRatingColor(r) };
    });
  }, [data.games]);

  const maxRatingCount = Math.max(1, ...ratingStats.map((r) => r.count));
  const maxOrderCount = Math.max(1, ...topOrderers.map((o) => o.count));

  return (
    <div className="view-stack">
      <div className="page-header">
        <div>
          <h1>Рандомайзер и Статистика канала</h1>
          <p className="muted-sm">
            Рулетка выбора следующей игры / идеи + топ заказчиков и распределение оценок
          </p>
        </div>
      </div>

      {/* Randomizer Box */}
      <section className="section-block randomizer-box">
        <div className="section-head">
          <div>
            <h2>
              <Dices size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Рулетка на стрим
            </h2>
            <p className="muted-sm">
              В пуле сейчас: <strong>{pool.length}</strong> позиций • Шанс выпадения одной позиции:{' '}
              <strong>{dropChance}%</strong>
            </p>
          </div>

          <div className="row-gap-sm wrap">
            <select
              className="input select-auto"
              value={rollSource}
              onChange={(e) => {
                setRollSource(e.target.value as RollSource);
                setWinnerIdx(null);
                setCurrentPreviewIdx(null);
              }}
            >
              <option value="QUEUED_GAMES">
                Игры: статус «Заказано» (
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
              <option value="BACKLOG_READY">
                Бэклог идей ({data.backlog.length})
              </option>
              <option value="WATCH_QUEUE">
                Просмотровое в очереди (
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
            </select>

            <button
              className="btn btn-primary"
              onClick={handleSpin}
              disabled={rolling || pool.length === 0}
            >
              <Sparkles size={16} /> {rolling ? 'Крутим...' : 'Крутить рулетку!'}
            </button>
          </div>
        </div>

        {pool.length === 0 ? (
          <div className="empty-roll-hint">
            В выбранной категории сейчас 0 позиций (все заказанные игры пройдены или список
            заморожен). Выберите «Бэклог идей» или добавьте новые заказы!
          </div>
        ) : (
          <div className="roulette-stage">
            {shownItem ? (
              <div className={`roulette-winner-card ${winnerIdx !== null ? 'won' : 'spinning'}`}>
                <CoverImage
                  title={shownItem.title}
                  coverUrl={shownItem.coverUrl}
                  steamAppId={shownItem.steamAppId}
                  className="roulette-cover"
                />
                <div className="roulette-winner-info">
                  {winnerIdx !== null && (
                    <span className="badge tone-active">🎉 Выпало на стрим!</span>
                  )}
                  <h3>{shownItem.title}</h3>
                  <p className="muted-sm">{shownItem.sub}</p>
                  {shownItem.extra && <p className="card-note">{shownItem.extra}</p>}
                  {canEdit && winnerIdx !== null && shownItem.kind === 'game' && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: 10 }}
                      onClick={() => onStartRolledGame(shownItem.id)}
                    >
                      <Play size={14} /> Перевести в статус «В процессе»
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="roulette-pool-preview">
                {pool.slice(0, 12).map((item) => (
                  <div key={item.id} className="mini-pool-card">
                    <CoverImage
                      title={item.title}
                      coverUrl={item.coverUrl}
                      steamAppId={item.steamAppId}
                    />
                    <span>{item.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Stats Grid: Top Orderers + Ratings */}
      <div className="two-col-hub">
        <section className="section-block">
          <div className="section-head">
            <div>
              <h2>
                <Users size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Топ заказчиков игр
              </h2>
              <p className="muted-sm">Кликните на ник, чтобы открыть все заказы зрителя</p>
            </div>
          </div>

          <div className="bars-list">
            {topOrderers.map((ord, i) => (
              <button
                key={ord.display}
                type="button"
                className="bar-row-btn"
                onClick={() => onFilterByOrderer(ord.display)}
              >
                <div className="row-between">
                  <span>
                    <strong className="rank-num">#{i + 1}</strong> {ord.display}
                  </span>
                  <span className="muted-sm">
                    <strong>{ord.count}</strong> игр ({ord.pct}%) • пройдено {ord.completed}
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill purple"
                    style={{ width: `${(ord.count / maxOrderCount) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
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
