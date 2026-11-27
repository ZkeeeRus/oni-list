import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Dices,
  Edit3,
  ExternalLink,
  Film,
  Gamepad2,
  Layers,
  ListTodo,
  PlayCircle,
  Plus,
  Trophy,
  Users,
} from 'lucide-react';
import { HubConfig, SiteData } from '../types';
import { CoverImage } from '../components/CoverImage';
import { collectOrdererStats } from '../utils/orderers';
import {
  DropPriceBadge,
  PriorityBadge,
  RatingBadge,
  ReturnPriceBadge,
  StatusBadge,
} from '../components/Badges';

export type NavTab =
  | 'hub'
  | 'games'
  | 'watchlist'
  | 'tierlist'
  | 'backlog'
  | 'stats'
  | 'rules';

interface HubViewProps {
  data: SiteData;
  canEdit: boolean;
  onNavigate: (tab: NavTab) => void;
  onFilterByOrderer: (orderer: string) => void;
  onUpdateHubConfig: (cfg: HubConfig) => void;
  onOpenAddGame: () => void;
  onOpenAddWatch: () => void;
  onInspectGame: (gameId: string) => void;
  onInspectWatch: (watchId: string) => void;
  onInspectBacklog: (backlogId: string) => void;
}

export const HubView: React.FC<HubViewProps> = ({
  data,
  canEdit,
  onNavigate,
  onFilterByOrderer,
  onUpdateHubConfig,
  onOpenAddGame,
  onOpenAddWatch,
  onInspectGame,
  onInspectWatch,
  onInspectBacklog,
}) => {
  const { hubConfig, games, watchlist, backlog, customTierLists } = data;
  const [editingPlan, setEditingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState(hubConfig.currentPlanNote);
  const [hubOrderersExpanded, setHubOrderersExpanded] = useState(false);

  const activeGames = games.filter(
    (g) => g.status === 'В процессе' || g.status === 'Проходится'
  );
  const queuedGames = games.filter((g) => g.status === 'Заказано');
  const completedGames = games.filter((g) => g.status === 'Игра пройдена');
  const activeWatch = watchlist.filter((w) => w.status === 'В процессе');
  const readyBacklog = backlog.filter((b) => b.status === 'Готово к стриму');

  const recentReviewed = games
    .filter((g) => g.comment && g.comment.length > 35 && g.rating)
    .slice(0, 6);

  const allOrderers = useMemo(
    () => collectOrdererStats(games, watchlist),
    [games, watchlist]
  );
  const topOrderers = useMemo(
    () => (hubOrderersExpanded ? allOrderers : allOrderers.slice(0, 6)),
    [allOrderers, hubOrderersExpanded]
  );

  const handleSavePlan = () => {
    onUpdateHubConfig({
      ...hubConfig,
      currentPlanNote: planDraft.trim(),
    });
    setEditingPlan(false);
  };

  return (
    <div className="view-stack">
      {/* Hero + Current Plan */}
      <section className="hub-hero">
        <div className="hub-hero-main">
          <div className="eyebrow">TWITCH.TV/ONIZED • СТРИМ-ХАБ</div>
          <h1>{hubConfig.headline}</h1>
          <p className="hub-sub">{hubConfig.subheadline}</p>

          <div className="hub-plan-box">
            <div className="row-between">
              <span className="plan-label">Текущие планы на стримы</span>
              {canEdit && !editingPlan && (
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    setPlanDraft(hubConfig.currentPlanNote);
                    setEditingPlan(true);
                  }}
                >
                  <Edit3 size={13} /> Изменить план
                </button>
              )}
            </div>

            {editingPlan ? (
              <div className="form-grid" style={{ marginTop: 8 }}>
                <textarea
                  className="input textarea-sm"
                  rows={4}
                  value={planDraft}
                  onChange={(e) => setPlanDraft(e.target.value)}
                  placeholder="Что проходим и смотрим в ближайшее время (каждый пункт можно с новой строки)..."
                />
                <div className="row-gap-sm">
                  <button className="btn btn-primary btn-sm" onClick={handleSavePlan}>
                    <Check size={14} /> Сохранить
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditingPlan(false)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <p className="plan-text">{hubConfig.currentPlanNote}</p>
            )}
          </div>

          <div className="row-gap-sm wrap" style={{ marginTop: 14 }}>
            <a
              href={hubConfig.twitchUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-twitch"
            >
              <PlayCircle size={16} /> Канал Twitch
            </a>
            <a
              href={hubConfig.vkVodUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
            >
              <ExternalLink size={15} /> Архив записей (VOD)
            </a>
            {canEdit && (
              <>
                <button className="btn btn-primary" onClick={onOpenAddGame}>
                  <Plus size={16} /> + Игра
                </button>
                <button className="btn btn-secondary" onClick={onOpenAddWatch}>
                  <Plus size={16} /> + Просмотровое
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Navigation KPI Grid */}
        <div className="hub-kpi-grid">
          <button className="kpi-card" onClick={() => onNavigate('games')}>
            <div className="kpi-icon purple">
              <Gamepad2 size={20} />
            </div>
            <div className="kpi-num">{games.length}</div>
            <div className="kpi-title">Всего игр в базе</div>
            <div className="kpi-sub">
              {completedGames.length} пройдено • {queuedGames.length} заказано
            </div>
          </button>

          <button className="kpi-card" onClick={() => onNavigate('watchlist')}>
            <div className="kpi-icon cyan">
              <Film size={20} />
            </div>
            <div className="kpi-num">{watchlist.length}</div>
            <div className="kpi-title">Просмотровый список</div>
            <div className="kpi-sub">Фильмы, сериалы, аниме и манга</div>
          </button>

          <button className="kpi-card" onClick={() => onNavigate('tierlist')}>
            <div className="kpi-icon amber">
              <Layers size={20} />
            </div>
            <div className="kpi-num">
              {games.filter((g) => g.rating && g.rating !== 'Нет мнения').length}
            </div>
            <div className="kpi-title">Тир-листы канала</div>
            <div className="kpi-sub">
              Авто-тирлист + {customTierLists.length} кастомных
            </div>
          </button>

          <button className="kpi-card" onClick={() => onNavigate('backlog')}>
            <div className="kpi-icon emerald">
              <ListTodo size={20} />
            </div>
            <div className="kpi-num">{backlog.length}</div>
            <div className="kpi-title">Бэклог идей</div>
            <div className="kpi-sub">{readyBacklog.length} готово к запуску</div>
          </button>

          <button className="kpi-card" onClick={() => onNavigate('stats')}>
            <div className="kpi-icon pink">
              <Dices size={20} />
            </div>
            <div className="kpi-num">Ролл</div>
            <div className="kpi-title">Рулетка и Статистика</div>
            <div className="kpi-sub">Топ заказчиков и выбор игры</div>
          </button>

          <button className="kpi-card" onClick={() => onNavigate('rules')}>
            <div className="kpi-icon slate">
              <BookOpen size={20} />
            </div>
            <div className="kpi-num">Инфо</div>
            <div className="kpi-title">Правила и Оценки</div>
            <div className="kpi-sub">Условия заказов, дропов и шкала</div>
          </button>
        </div>
      </section>

      {/* Active Now: Playing & Watching */}
      <section className="section-block">
        <div className="section-head">
          <div>
            <h2>Сейчас в процессе</h2>
            <p className="muted-sm">Нажми на любую карточку, чтобы открыть подробности</p>
          </div>
          <div className="row-gap-sm">
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('games')}>
              Все игры <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="active-now-grid">
          {activeGames.map((g) => (
            <div
              key={g.id}
              className="spotlight-card"
              onClick={() => onInspectGame(g.id)}
            >
              <CoverImage
                title={g.title}
                coverUrl={g.coverUrl}
                steamAppId={g.steamAppId}
                className="spotlight-cover"
              />
              <div className="spotlight-info">
                <div className="row-gap-xs wrap">
                  <span className="pill-type game">Игра</span>
                  <StatusBadge status={g.status} />
                  <RatingBadge rating={g.rating} />
                  <DropPriceBadge price={g.dropPrice} />
                  <ReturnPriceBadge price={g.returnPrice} />
                </div>
                <h3>{g.title}</h3>
                <div className="muted-sm">
                  Заказал: <strong>{g.orderedBy}</strong>
                </div>
                {g.conditions && <p className="clamp-2">{g.conditions}</p>}
                {g.comment && <p className="clamp-2 muted-sm">{g.comment}</p>}
              </div>
            </div>
          ))}

          {activeWatch.map((w) => (
            <div
              key={w.id}
              className="spotlight-card"
              onClick={() => onInspectWatch(w.id)}
            >
              <CoverImage
                title={w.title}
                coverUrl={w.coverUrl}
                className="spotlight-cover"
              />
              <div className="spotlight-info">
                <div className="row-gap-xs wrap">
                  <span className="pill-type watch">{w.category}</span>
                  <StatusBadge status={w.status} />
                  <RatingBadge rating={w.rating} />
                </div>
                <h3>{w.title}</h3>
                <div className="muted-sm">
                  Заказал: <strong>{w.orderedBy}</strong>
                </div>
                {w.comment && <p className="clamp-2">Прогресс: {w.comment}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Backlog Plans + Top Orderers */}
      <div className="two-col-hub">
        <section className="section-block">
          <div className="section-head">
            <div>
              <h2>Ближайшие идеи из бэклога</h2>
              <p className="muted-sm">Нажми на идею, чтобы посмотреть описание</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('backlog')}>
              Весь бэклог ({backlog.length}) <ArrowRight size={14} />
            </button>
          </div>
          <div className="compact-list">
            {backlog.slice(0, 6).map((b) => (
              <div
                key={b.id}
                className="compact-row"
                onClick={() => onInspectBacklog(b.id)}
              >
                <CoverImage
                  title={b.title}
                  coverUrl={b.coverUrl}
                  steamAppId={b.steamAppId}
                  className="mini-row-cover"
                />
                <div className="compact-row-body">
                  <strong>{b.title}</strong>
                  <div className="muted-sm clamp-1">
                    {b.idea || b.notes || 'Готово к запуску на стриме'}
                  </div>
                </div>
                <div className="row-gap-xs">
                  <PriorityBadge priority={b.priority} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-head">
            <div>
              <h2>
                <Users size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Топ заказчиков канала
              </h2>
              <p className="muted-sm">Кликни на зрителя, чтобы открыть все его заказы</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('stats')}>
              Вся статистика <ArrowRight size={14} />
            </button>
          </div>

          <div className="compact-list hub-orderers-scroll">
            {topOrderers.map((ord, idx) => (
              <button
                key={ord.key}
                type="button"
                className="compact-row orderer-hub-row"
                onClick={() => onFilterByOrderer(ord.display)}
              >
                <div className="rank-badge-circle">#{idx + 1}</div>
                <div className="compact-row-body orderer-name-cell">
                  <strong>{ord.display}</strong>
                </div>
                <span className="badge tone-queued">
                  {ord.gamesCount} игр{ord.watchCount > 0 ? ` + ${ord.watchCount} просм.` : ''}
                </span>
              </button>
            ))}
          </div>
          {allOrderers.length > 6 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
              onClick={() => setHubOrderersExpanded((v) => !v)}
            >
              {hubOrderersExpanded
                ? 'Свернуть до топ-6'
                : `Развернуть всех (${allOrderers.length} заказчиков)`}
            </button>
          )}
        </section>
      </div>

      {/* Detailed Reviews Highlight */}
      <section className="section-block">
        <div className="section-head">
          <div>
            <h2>Развёрнутые отзывы и мнения из чата</h2>
            <p className="muted-sm">Нажми на отзыв, чтобы открыть карточку игры целиком</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('tierlist')}>
            <Trophy size={14} /> Открыть тир-лист
          </button>
        </div>
        <div className="reviews-grid">
          {recentReviewed.map((g) => (
            <div
              key={g.id}
              className="review-card clickable-card"
              onClick={() => onInspectGame(g.id)}
            >
              <CoverImage
                title={g.title}
                coverUrl={g.coverUrl}
                steamAppId={g.steamAppId}
                className="review-cover"
              />
              <div className="review-content">
                <div className="row-between wrap">
                  <strong>{g.title}</strong>
                  <RatingBadge rating={g.rating} />
                </div>
                <div className="muted-xs">Заказал: {g.orderedBy}</div>
                <p className="review-quote clamp-3">{g.comment}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
