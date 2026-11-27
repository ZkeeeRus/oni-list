import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  Check,
  Edit3,
  Info,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { RatingScaleItem, RulesData } from '../types';

interface RulesViewProps {
  rules: RulesData;
  ratingScale: RatingScaleItem[];
  canEdit: boolean;
  onSaveRules: (rules: RulesData, nextRatingScale?: RatingScaleItem[]) => void;
}

const TIER_LETTERS: Record<string, string> = {
  Шедевр: 'S',
  Великолепно: 'A',
  Похвально: 'B',
  Проходняк: 'C',
  'Полный кал': 'D',
  'Нет мнения': '?',
};

const RULE_TOKEN_RE =
  /(https?:\/\/[^\s)]+|«[^»]+»|\b\d[\d\s.,]*(?:\s?(?:₽|руб(?:лей|\.)?|р\.|ч\.|час(?:а|ов)?|%|раз(?:а)?|мин\.|дн\.))|\b[xхXХ]\d+\b|\b(?:Дроп[а-яё]*|дроп[а-яё]*|Возврат[а-яё]*|возврат[а-яё]*|Аукцион[а-яё]*|аукцион[а-яё]*|Рулетк[а-яё]*|рулетк[а-яё]*|Запрещ[а-яё]*|запрещ[а-яё]*|Важно|Внимание|СмолДик)\b)/g;

function renderFormattedRuleText(text: string): React.ReactNode {
  const parts = text.split(RULE_TOKEN_RE);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="link-inline"
        >
          {part}
        </a>
      );
    }
    if (part.startsWith('«') && part.endsWith('»')) {
      return (
        <span key={idx} className="rule-accent-quote">
          {part}
        </span>
      );
    }
    if (/^(?:\d|[xхXХ]\d)/.test(part)) {
      return (
        <span key={idx} className="rule-accent-num">
          {part}
        </span>
      );
    }
    if (
      /^(?:Дроп|дроп|Возврат|возврат|Аукцион|аукцион|Рулетк|рулетк|Запрещ|запрещ|Важно|Внимание|СмолДик)/.test(
        part
      )
    ) {
      return (
        <strong key={idx} className="rule-accent-term">
          {part}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const RulesView: React.FC<RulesViewProps> = ({
  rules,
  ratingScale,
  canEdit,
  onSaveRules,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RulesData>(rules);
  const [scaleDraft, setScaleDraft] = useState<RatingScaleItem[]>(ratingScale);

  const startEdit = () => {
    const clonedRules: RulesData = JSON.parse(JSON.stringify(rules));
    if (!Array.isArray(clonedRules.sections)) clonedRules.sections = [];
    if (!Array.isArray(clonedRules.footnotes)) clonedRules.footnotes = [];
    setDraft(clonedRules);
    setScaleDraft(JSON.parse(JSON.stringify(ratingScale)));
    setEditing(true);
  };

  const handleSave = () => {
    const cleanedRules: RulesData = {
      intro: (draft.intro || '').trim(),
      sections: (draft.sections || []).map((sec) => ({
        ...sec,
        title: sec.title.trim() || 'Раздел правил',
        items: sec.items.map((it) => it.trim()).filter(Boolean),
      })),
      footnotes: (draft.footnotes || []).map((fn) => fn.trim()).filter(Boolean),
    };
    const cleanedScale = scaleDraft.map((rs) => ({
      ...rs,
      description: rs.description.trim(),
    }));
    onSaveRules(cleanedRules, cleanedScale);
    setEditing(false);
  };

  const moveArrayItem = <T,>(arr: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= arr.length) return arr;
    const copy = [...arr];
    const [picked] = copy.splice(from, 1);
    copy.splice(to, 0, picked);
    return copy;
  };

  return (
    <div className="view-stack">
      <div className="page-header">
        <div>
          <h1>Свод правил и Шкала оценок</h1>
          <p className="muted-sm">
            Правила заказа игр, дропов, возвратов и расшифровка оценок стримера
          </p>
        </div>
        {canEdit && !editing && (
          <button className="btn btn-secondary" onClick={startEdit}>
            <Edit3 size={15} /> Редактировать правила
          </button>
        )}
        {canEdit && editing && (
          <div className="row-gap-sm wrap">
            <button className="btn btn-primary" onClick={handleSave}>
              <Check size={15} /> Сохранить все изменения
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>
              Отмена
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <section
          className="section-block form-grid"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName === 'INPUT') {
              e.preventDefault();
            }
          }}
        >
          <div className="settings-section form-grid">
            <label className="field-label">Вступление (верхняя плашка над разделами)</label>
            <textarea
              className="input textarea-sm"
              rows={2}
              placeholder="Вступительный текст над правилами (оставьте пустым, чтобы скрыть плашку)..."
              value={draft.intro}
              onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
            />
          </div>

          {draft.sections.map((sec, sIdx) => (
            <div key={sec.id} className="settings-section form-grid">
              <div className="rule-sec-edit-head">
                <span className="rule-sec-badge">Раздел {sIdx + 1}</span>
                <input
                  className="input"
                  placeholder="Название раздела..."
                  value={sec.title}
                  onChange={(e) => {
                    const next = [...draft.sections];
                    next[sIdx] = { ...sec, title: e.target.value };
                    setDraft({ ...draft, sections: next });
                  }}
                />
                <div className="rule-row-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={sIdx === 0}
                    title="Поднять раздел выше"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        sections: moveArrayItem(draft.sections, sIdx, sIdx - 1),
                      })
                    }
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={sIdx === draft.sections.length - 1}
                    title="Опустить раздел ниже"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        sections: moveArrayItem(draft.sections, sIdx, sIdx + 1),
                      })
                    }
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger-text"
                    title="Удалить раздел целиком"
                    onClick={() => {
                      if (
                        sec.items.length === 0 ||
                        confirm(`Удалить раздел «${sec.title || sIdx + 1}» со всеми его пунктами?`)
                      ) {
                        setDraft({
                          ...draft,
                          sections: draft.sections.filter((_, idx) => idx !== sIdx),
                        });
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {sec.items.map((item, iIdx) => (
                <div key={iIdx} className="rule-edit-row">
                  <span className="rule-num-pill">
                    {String(iIdx + 1).padStart(2, '0')}
                  </span>
                  <textarea
                    className="input input-sm rule-item-textarea"
                    rows={2}
                    placeholder="Текст пункта правил..."
                    value={item}
                    onChange={(e) => {
                      const next = [...draft.sections];
                      const items = [...sec.items];
                      items[iIdx] = e.target.value;
                      next[sIdx] = { ...sec, items };
                      setDraft({ ...draft, sections: next });
                    }}
                  />
                  <div className="rule-row-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={iIdx === 0}
                      title="Поднять пункт выше"
                      onClick={() => {
                        const next = [...draft.sections];
                        next[sIdx] = {
                          ...sec,
                          items: moveArrayItem(sec.items, iIdx, iIdx - 1),
                        };
                        setDraft({ ...draft, sections: next });
                      }}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={iIdx === sec.items.length - 1}
                      title="Опустить пункт ниже"
                      onClick={() => {
                        const next = [...draft.sections];
                        next[sIdx] = {
                          ...sec,
                          items: moveArrayItem(sec.items, iIdx, iIdx + 1),
                        };
                        setDraft({ ...draft, sections: next });
                      }}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger-text"
                      title="Удалить пункт"
                      onClick={() => {
                        const next = [...draft.sections];
                        next[sIdx] = {
                          ...sec,
                          items: sec.items.filter((_, idx) => idx !== iIdx),
                        };
                        setDraft({ ...draft, sections: next });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="btn btn-secondary btn-xs"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => {
                  const next = [...draft.sections];
                  next[sIdx] = { ...sec, items: [...sec.items, ''] };
                  setDraft({ ...draft, sections: next });
                }}
              >
                <Plus size={12} /> Добавить пункт
              </button>
            </div>
          ))}

          <div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setDraft({
                  ...draft,
                  sections: [
                    ...draft.sections,
                    {
                      id: `sec-${Date.now()}`,
                      title: 'Новый раздел правил',
                      items: [''],
                    },
                  ],
                })
              }
            >
              <Plus size={14} /> Добавить новый раздел правил
            </button>
          </div>

          {/* Редактор примечаний и сносок */}
          <div className="settings-section form-grid">
            <div className="row-between wrap">
              <div>
                <h4>Примечания и сноски (блок внизу под правилами)</h4>
                <p className="muted-xs">
                  Дополнительные пояснения, исключения и примечания со звездочкой
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() =>
                  setDraft({
                    ...draft,
                    footnotes: [...(draft.footnotes || []), ''],
                  })
                }
              >
                <Plus size={12} /> Добавить сноску
              </button>
            </div>

            {(draft.footnotes || []).length === 0 ? (
              <p className="muted-xs">
                Сносок пока нет. Нажмите «Добавить сноску», чтобы создать примечание.
              </p>
            ) : (
              (draft.footnotes || []).map((fn, fIdx) => (
                <div key={fIdx} className="rule-edit-row">
                  <span className="rule-num-pill">*</span>
                  <textarea
                    className="input input-sm rule-item-textarea"
                    rows={2}
                    placeholder="Текст примечания или сноски..."
                    value={fn}
                    onChange={(e) => {
                      const nextFn = [...(draft.footnotes || [])];
                      nextFn[fIdx] = e.target.value;
                      setDraft({ ...draft, footnotes: nextFn });
                    }}
                  />
                  <div className="rule-row-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={fIdx === 0}
                      title="Поднять сноску выше"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          footnotes: moveArrayItem(
                            draft.footnotes || [],
                            fIdx,
                            fIdx - 1
                          ),
                        })
                      }
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={fIdx === (draft.footnotes || []).length - 1}
                      title="Опустить сноску ниже"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          footnotes: moveArrayItem(
                            draft.footnotes || [],
                            fIdx,
                            fIdx + 1
                          ),
                        })
                      }
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger-text"
                      title="Удалить сноску"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          footnotes: (draft.footnotes || []).filter(
                            (_, idx) => idx !== fIdx
                          ),
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Редактор описаний шкалы оценок */}
          <div className="settings-section form-grid">
            <div>
              <h4>Описания шкалы оценок канала</h4>
              <p className="muted-xs">
                Пояснения к оценкам в правой колонке страницы правил
              </p>
            </div>
            {scaleDraft.map((rs, rIdx) => (
              <div key={rs.rating} className="rule-edit-row">
                <span
                  className="badge"
                  style={{
                    minWidth: 112,
                    justifyContent: 'center',
                    borderColor: `${rs.color}66`,
                    color: rs.color,
                  }}
                >
                  {rs.rating}
                </span>
                <textarea
                  className="input input-sm rule-item-textarea"
                  rows={2}
                  value={rs.description}
                  onChange={(e) => {
                    const next = [...scaleDraft];
                    next[rIdx] = { ...rs, description: e.target.value };
                    setScaleDraft(next);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="row-gap-sm">
            <button className="btn btn-primary" onClick={handleSave}>
              <Check size={15} /> Сохранить все изменения
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>
              Отмена
            </button>
          </div>
        </section>
      ) : (
        <div className="two-col-hub">
          <section className="section-block">
            <div className="rules-sec-title">
              <span className="kpi-icon purple" style={{ marginBottom: 0 }}>
                <BookOpen size={18} />
              </span>
              <div>
                <h2>Свод правил заказа</h2>
                <span className="muted-xs">Основные условия заказов, дропов и возвратов</span>
              </div>
            </div>

            {rules.intro && (
              <div className="rules-intro-banner">
                <Sparkles size={16} className="rules-intro-icon" />
                <p>{renderFormattedRuleText(rules.intro)}</p>
              </div>
            )}

            <div className="rules-stack">
              {rules.sections.map((sec, secIdx) => (
                <div key={sec.id} className="rule-group-card">
                  <div className="rule-group-head">
                    <span className="rule-sec-badge">Раздел {secIdx + 1}</span>
                    <h3>{sec.title}</h3>
                  </div>
                  <div className="rules-items-stack">
                    {sec.items.map((it, i) => (
                      <div key={i} className="rule-item-row">
                        <span className="rule-num-pill">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="rule-item-text">
                          {renderFormattedRuleText(it)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {rules.footnotes && rules.footnotes.length > 0 && (
              <div className="footnotes-box">
                <div className="footnote-head">
                  <ShieldAlert size={14} /> Примечания и сноски
                </div>
                {rules.footnotes.map((fn, i) => (
                  <div key={i} className="footnote-row">
                    <Info size={13} className="footnote-icon" />
                    <span>{renderFormattedRuleText(fn)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section-block">
            <div className="rules-sec-title" style={{ marginBottom: 16 }}>
              <span className="kpi-icon amber" style={{ marginBottom: 0 }}>
                <Award size={18} />
              </span>
              <div>
                <h2>Шкала оценок канала</h2>
                <span className="muted-xs">
                  Как Ден оценивает пройденные игры и просмотренные тайтлы
                </span>
              </div>
            </div>

            <div className="scale-cards">
              {ratingScale.map((rs) => {
                const letter = TIER_LETTERS[rs.rating] || '★';
                return (
                  <div
                    key={rs.rating}
                    className="scale-card"
                    style={{
                      borderLeft: `4px solid ${rs.color}`,
                      background: `linear-gradient(95deg, ${rs.color}14 0%, var(--bg-elev) 58%)`,
                    }}
                  >
                    <div className="scale-card-head">
                      <span
                        className="scale-tier-letter"
                        style={{
                          backgroundColor: `${rs.color}26`,
                          borderColor: `${rs.color}66`,
                          color: rs.color,
                        }}
                      >
                        {letter}
                      </span>
                      <strong style={{ color: rs.color, fontSize: '1.06rem' }}>
                        {rs.rating}
                      </strong>
                    </div>
                    <p>{rs.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
