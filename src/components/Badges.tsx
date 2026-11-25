import React from 'react';

export const GAME_STATUSES = [
  'В процессе',
  'Проходится',
  'Заказано',
  'Игра пройдена',
  'Игра дропнута зрителями',
  'Стример дропнул',
  'Тех дроп',
  'Отложено',
  'СмолДик момент',
];

export const WATCH_CATEGORIES = ['Аниме', 'Фильм', 'Сериал', 'Манга'];

export const WATCH_STATUSES = [
  'В процессе',
  'Заказано',
  'Просмотрено',
  'Отложено',
  'Стример дропнул',
];

export const RATINGS_ORDER = [
  'Шедевр',
  'Великолепно',
  'Похвально',
  'Проходняк',
  'Полный кал',
  'Нет мнения',
];

export const BACKLOG_PRIORITIES = ['Высокий', 'Средний', 'Низкий'];
export const BACKLOG_STATUSES = ['Готово к стриму', 'На примете', 'Идея', 'Отложено'];

export function getRatingColor(rating?: string): string {
  switch (rating) {
    case 'Шедевр':
      return '#f59e0b';
    case 'Великолепно':
      return '#10b981';
    case 'Похвально':
      return '#06b6d4';
    case 'Проходняк':
      return '#a855f7';
    case 'Полный кал':
      return '#ef4444';
    case 'Нет мнения':
      return '#64748b';
    default:
      return '#475569';
  }
}

export function getStatusTone(status?: string): string {
  if (!status) return 'neutral';
  const s = status.toLowerCase();
  if (s.includes('процессе') || s.includes('проходится')) return 'active';
  if (s.includes('пройдена') || s.includes('просмотрено') || s.includes('готово')) return 'done';
  if (s.includes('заказано') || s.includes('примете') || s.includes('идея')) return 'queued';
  if (s.includes('отложено')) return 'paused';
  if (s.includes('тех')) return 'tech';
  if (s.includes('дроп') || s.includes('смолдик')) return 'dropped';
  return 'neutral';
}

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const tone = getStatusTone(status);
  return <span className={`badge badge-status tone-${tone}`}>{status}</span>;
};

export const RatingBadge: React.FC<{ rating?: string }> = ({ rating }) => {
  if (!rating || rating === '-') return null;
  const color = getRatingColor(rating);
  return (
    <span
      className="badge badge-rating"
      style={{
        borderColor: `${color}66`,
        backgroundColor: `${color}22`,
        color,
      }}
    >
      {rating}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const cls =
    priority === 'Высокий' ? 'prio-high' : priority === 'Средний' ? 'prio-mid' : 'prio-low';
  return <span className={`badge ${cls}`}>{priority}</span>;
};

export const DropPriceBadge: React.FC<{ price?: string }> = ({ price }) => {
  if (!price || !price.trim()) return null;
  return <span className="badge badge-drop-price">💸 Дроп: {price}</span>;
};

export const ReturnPriceBadge: React.FC<{ price?: string }> = ({ price }) => {
  if (!price || !price.trim()) return null;
  return <span className="badge badge-return-price">🔄 Вернули: {price}</span>;
};
