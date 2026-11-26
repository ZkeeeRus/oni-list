import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Edit3,
  ExternalLink,
  Play,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { BacklogItem } from '../types';
import { CoverImage } from '../components/CoverImage';
import {
  BACKLOG_PRIORITIES,
  BACKLOG_STATUSES,
  PriorityBadge,
  StatusBadge,
} from '../components/Badges';

interface BacklogViewProps {
  backlog: BacklogItem[];
  canEdit: boolean;
  statusTag?: string;
  onSelectStatusTag?: (status: string) => void;
  onAddBacklog: () => void;
  onInspectBacklog: (id: string) => void;
  onEditBacklog: (item: BacklogItem) => void;
  onDeleteBacklog: (id: string) => void;
  onPromoteToGame: (item: BacklogItem) => void;
}

export const BacklogView: React.FC<BacklogViewProps> = ({
  backlog,
  canEdit,
  statusTag = 'ALL',
  onSelectStatusTag,
  onAddBacklog,
  onInspectBacklog,
  onEditBacklog,
  onDeleteBacklog,
  onPromoteToGame,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(statusTag || 'ALL');
  const [prioFilter, setPrioFilter] = useState('ALL');

  useEffect(() => {
    setStatusFilter(statusTag || 'ALL');
  }, [statusTag]);

  const handleChangeStatus = (nextStatus: string) => {
    setStatusFilter(nextStatus);
    onSelectStatusTag?.(nextStatus);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return backlog.filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (prioFilter !== 'ALL' && b.priority !== prioFilter) return false;
      if (q && !`${b.title} ${b.idea} ${b.notes} ${b.genre}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [backlog, search, statusFilter, prioFilter]);

  return (
    <div className="view-stack">
      <div className="page-header">
        <div>
          <h1>Бэклог идей для будущих стримов ({filtered.length})</h1>
          <p className="muted-sm">
            Нажми на любую карточку, чтобы открыть полное описание идеи
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={onAddBacklog}>
            <Plus size={16} /> Добавить идею
          </button>
        )}
      </div>

      <div className="filters-bar">
        <div className="search-input-wrap">
          <Search size={16} />
          <input
            className="input"
            placeholder="Поиск по играм, идеям и заметкам бэклога..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="clear-input-btn" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="input select-auto"
          value={prioFilter}
          onChange={(e) => setPrioFilter(e.target.value)}
        >
          <option value="ALL">Любой приоритет</option>
          {BACKLOG_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="status-pills-row">
        <button
          className={`status-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => handleChangeStatus('ALL')}
        >
          Все <span>{backlog.length}</span>
        </button>
        {BACKLOG_STATUSES.map((s) => {
          const cnt = backlog.filter((b) => b.status === s).length;
          return (
            <button
              key={s}
              className={`status-tab ${statusFilter === s ? 'active' : ''}`}
              onClick={() => handleChangeStatus(s)}
            >
              {s} <span>{cnt}</span>
            </button>
          );
        })}
      </div>

      <div className="media-cards-grid">
        {filtered.map((b) => (
          <article
            key={b.id}
            className="media-card"
            onClick={() => onInspectBacklog(b.id)}
          >
            <div className="media-card-poster">
              <CoverImage
                title={b.title}
                coverUrl={b.coverUrl}
                steamAppId={b.steamAppId}
                badgeText={b.genre || undefined}
              />
            </div>

            <div className="media-card-body">
              <div className="row-gap-xs wrap">
                <StatusBadge status={b.status} />
                <PriorityBadge priority={b.priority} />
              </div>

              <h3 className="media-card-title">{b.title}</h3>

              {b.idea && (
                <div className="card-note conditions-note clamp-2">
                  <strong>Идея:</strong> {b.idea}
                </div>
              )}
              {b.notes && <p className="card-comment clamp-3">{b.notes}</p>}

              {b.link && (
                <a
                  href={b.link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-xs"
                  style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={12} /> Источник / мод <ArrowUpRight size={12} />
                </a>
              )}

              {canEdit && (
                <div
                  className="card-mod-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => onPromoteToGame(b)}
                    title="Перенести в Список игр со статусом В процессе"
                  >
                    <Play size={13} /> На стрим
                  </button>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => onEditBacklog(b)}
                  >
                    <Edit3 size={13} /> Править
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
