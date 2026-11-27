import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Edit3,
  ExternalLink,
  LayoutGrid,
  List,
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
  onQuickUpdateBacklog?: (item: BacklogItem) => void;
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
  onQuickUpdateBacklog,
  onPromoteToGame,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(statusTag || 'ALL');
  const [prioFilter, setPrioFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      return localStorage.getItem('onized_view_backlog') === 'table'
        ? 'table'
        : 'grid';
    } catch {
      return 'grid';
    }
  });

  const changeViewMode = useCallback((mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('onized_view_backlog', mode);
    } catch {
      // Ignore
    }
  }, []);

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
        <div className="row-gap-sm wrap">
          <div className="segmented">
            <button
              type="button"
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => changeViewMode('grid')}
              title="Карточки с обложками"
            >
              <LayoutGrid size={16} /> Плитка
            </button>
            <button
              type="button"
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => changeViewMode('table')}
              title="Компактная таблица"
            >
              <List size={16} /> Таблица
            </button>
          </div>
          {canEdit && (
            <button className="btn btn-primary" onClick={onAddBacklog}>
              <Plus size={16} /> Добавить идею
            </button>
          )}
        </div>
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

      {viewMode === 'grid' ? (
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
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-game">Идея / игра</th>
                <th className="col-status">Статус</th>
                <th className="col-rating">Приоритет</th>
                <th className="col-notes">Описание идеи и заметки</th>
                <th className="col-links">Ссылки / действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} onClick={() => onInspectBacklog(b.id)}>
                  <td className="col-game">
                    <div className="table-title-cell">
                      <CoverImage
                        title={b.title}
                        coverUrl={b.coverUrl}
                        steamAppId={b.steamAppId}
                        className="table-thumb"
                      />
                      <div className="table-game-meta">
                        <strong className="table-game-name">{b.title}</strong>
                        {b.genre && <span className="table-sub-meta">{b.genre}</span>}
                      </div>
                    </div>
                  </td>
                  <td
                    className="col-status"
                    onClick={(e) => canEdit && e.stopPropagation()}
                  >
                    {canEdit && onQuickUpdateBacklog ? (
                      <select
                        className="input table-select"
                        value={b.status}
                        onChange={(e) =>
                          onQuickUpdateBacklog({ ...b, status: e.target.value })
                        }
                      >
                        {BACKLOG_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge status={b.status} />
                    )}
                  </td>
                  <td
                    className="col-rating"
                    onClick={(e) => canEdit && e.stopPropagation()}
                  >
                    {canEdit && onQuickUpdateBacklog ? (
                      <select
                        className="input table-select table-select-rating"
                        value={b.priority}
                        onChange={(e) =>
                          onQuickUpdateBacklog({
                            ...b,
                            priority: e.target.value as BacklogItem['priority'],
                          })
                        }
                      >
                        {BACKLOG_PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <PriorityBadge priority={b.priority} />
                    )}
                  </td>
                  <td className="col-notes table-notes-cell">
                    {b.idea && (
                      <div className="conditions-inline clamp-2">
                        <strong>Идея:</strong> {b.idea}
                      </div>
                    )}
                    {b.notes && <div className="muted-sm clamp-2">{b.notes}</div>}
                    {!b.idea && !b.notes && <span className="muted-xs">-</span>}
                  </td>
                  <td
                    className="col-links"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="table-links-wrap">
                      {b.link && (
                        <a
                          href={b.link}
                          target="_blank"
                          rel="noreferrer"
                          className="ext-chip"
                        >
                          Источник <ExternalLink size={11} />
                        </a>
                      )}
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            className="ext-chip hltb-chip"
                            onClick={() => onPromoteToGame(b)}
                            title="Перенести в Список игр со статусом В процессе"
                          >
                            <Play size={11} /> На стрим
                          </button>
                          <button
                            type="button"
                            className="icon-btn header-edit-btn"
                            onClick={() => onEditBacklog(b)}
                            title="Редактировать идею"
                          >
                            <Edit3 size={14} />
                          </button>
                        </>
                      )}
                      {!b.link && !canEdit && <span className="muted-xs">-</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
