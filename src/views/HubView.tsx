import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Dices,
  Edit3,
  ExternalLink,
  Film,
  Gamepad2,
  ImagePlus,
  Layers,
  ListTodo,
  Lock,
  PlayCircle,
  Plus,
  Trophy,
  Unlock,
} from 'lucide-react';
import { GameItem, HubConfig, MemeItem, SiteData, WatchItem } from '../types';
import { CoverImage } from '../components/CoverImage';
import { PriorityBadge, RatingBadge, StatusBadge } from '../components/Badges';

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
  onNavigate: (tab: NavTab, filterPreset?: string) => void;
  onUpdateHubConfig: (cfg: HubConfig) => void;
  onOpenAddGame: () => void;
  onOpenAddWatch: () => void;
  onOpenAddMeme: () => void;
  onEditGame: (g: GameItem) => void;
  onEditWatch: (w: WatchItem) => void;
  onViewMeme: (m: MemeItem) => void;
}

export const HubView: React.FC<HubViewProps> = ({
  data,
  canEdit,
  onNavigate,
  onUpdateHubConfig,
  onOpenAddGame,
  onOpenAddWatch,
  onOpenAddMeme,
  onEditGame,
  onEditWatch,
  onViewMeme,
}) => {
  const { hubConfig, games, watchlist, memes, backlog, customTierLists } = data;
  const [editingPlan, setEditingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState(hubConfig.currentPlanNote);
  const [bannerDraft, setBannerDraft] = useState(hubConfig.freezeBannerText);

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

  const handleSavePlan = () => {
    onUpdateHubConfig({
      ...hubConfig,
      currentPlanNote: planDraft.trim(),
      freezeBannerText: bannerDraft.trim(),
    });
    setEditingPlan(false);
  };

  return (
    <div className="view-stack">
      {/* Status Banner */}
      {(hubConfig.isListFrozen || canEdit) && (
        <div className={`freeze-banner ${hubConfig.isListFrozen ? 'frozen' : 'open'}`}>
          <div className="row-gap-sm">
            {hubConfig.isListFrozen ? <Lock size={18} /> : <Unlock size={18} />}
            <span>
              {hubConfig.isListFrozen
                ? hubConfig.freezeBannerText
                : 'Заказ игр в общий список сейчас открыт!'}
            </span>
          </div>
          {canEdit && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() =>
                onUpdateHubConfig({
                  ...hubConfig,
                  isListFrozen: !hubConfig.isListFrozen,
                })
              }
            >
              {hubConfig.isListFrozen ? 'Открыть заказы' : 'Заморозить список'}
            </button>
          )}
        </div>
      )}

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
                    setBannerDraft(hubConfig.freezeBannerText);
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
                  value={planDraft}
                  onChange={(e) => setPlanDraft(e.target.value)}
                  placeholder="Что проходим и смотрим в ближайшее время..."
                />
                <input
                  className="input input-sm"
                  value={bannerDraft}
                  onChange={(e) => setBannerDraft(e.target.value)}
                  placeholder="Текст плашки заморозки списка..."
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
                <button className="btn btn-secondary" onClick={onOpenAddMeme}>
                  <ImagePlus size={16} /> + Мем
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
            <div className="kpi-sub">{memes.length} мемов на память со стримов</div>
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
            <p className="muted-sm">Текущие игры и тайтлы на стримах</p>
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
              onClick={() => (canEdit ? onEditGame(g) : onNavigate('games'))}
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
              onClick={() => (canEdit ? onEditWatch(w) : onNavigate('watchlist'))}
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

      {/* Backlog Plans + Stream Memes */}
      <div className="two-col-hub">
        <section className="section-block">
          <div className="section-head">
            <div>
              <h2>Ближайшие идеи из бэклога</h2>
              <p className="muted-sm">Планы и заготовки под будущие стримы</p>
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
                onClick={() => onNavigate('backlog')}
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
              <h2>Мемы со стримов</h2>
              <p className="muted-sm">Памятные картинки из просмотрового и игр</p>
            </div>
            <div className="row-gap-xs">
              {canEdit && (
                <button className="btn btn-secondary btn-sm" onClick={onOpenAddMeme}>
                  <ImagePlus size={14} /> + Мем
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate('watchlist', 'memes')}
              >
                Все ({memes.length}) <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="hub-memes-grid">
            {memes.slice(0, 6).map((m) => (
              <button
                key={m.id}
                type="button"
                className="meme-card-mini"
                onClick={() => onViewMeme(m)}
              >
                <img src={m.imageUrl} alt={m.caption} referrerPolicy="no-referrer" />
                <div className="meme-card-overlay">
                  <span>{m.caption}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Detailed Reviews Highlight */}
      <section className="section-block">
        <div className="section-head">
          <div>
            <h2>Развёрнутые отзывы и мнения из чата</h2>
            <p className="muted-sm">Из последних оценённых прохождений</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('tierlist')}>
            <Trophy size={14} /> Открыть тир-лист
          </button>
        </div>
        <div className="reviews-grid">
          {recentReviewed.map((g) => (
            <div key={g.id} className="review-card">
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
                <p className="review-quote">{g.comment}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
