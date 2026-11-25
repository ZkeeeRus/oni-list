import React, { useState } from 'react';
import { Check, Edit3, Plus, Trash2 } from 'lucide-react';
import { RatingScaleItem, RulesData } from '../types';

interface RulesViewProps {
  rules: RulesData;
  ratingScale: RatingScaleItem[];
  canEdit: boolean;
  onSaveRules: (rules: RulesData) => void;
}

export const RulesView: React.FC<RulesViewProps> = ({
  rules,
  ratingScale,
  canEdit,
  onSaveRules,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RulesData>(rules);

  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(rules)));
    setEditing(true);
  };

  const handleSave = () => {
    onSaveRules(draft);
    setEditing(false);
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
      </div>

      {editing ? (
        <section className="section-block form-grid">
          <div>
            <label className="field-label">Вступление</label>
            <input
              className="input"
              value={draft.intro}
              onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
            />
          </div>

          {draft.sections.map((sec, sIdx) => (
            <div key={sec.id} className="settings-section form-grid">
              <input
                className="input"
                value={sec.title}
                onChange={(e) => {
                  const next = [...draft.sections];
                  next[sIdx] = { ...sec, title: e.target.value };
                  setDraft({ ...draft, sections: next });
                }}
              />
              {sec.items.map((item, iIdx) => (
                <div key={iIdx} className="inline-search-row">
                  <input
                    className="input input-sm"
                    value={item}
                    onChange={(e) => {
                      const next = [...draft.sections];
                      const items = [...sec.items];
                      items[iIdx] = e.target.value;
                      next[sIdx] = { ...sec, items };
                      setDraft({ ...draft, sections: next });
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn danger-text"
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
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => {
                  const next = [...draft.sections];
                  next[sIdx] = { ...sec, items: [...sec.items, 'Новый пункт правил'] };
                  setDraft({ ...draft, sections: next });
                }}
              >
                <Plus size={12} /> + Пункт
              </button>
            </div>
          ))}

          <div className="row-gap-sm">
            <button className="btn btn-primary" onClick={handleSave}>
              <Check size={15} /> Сохранить правила
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>
              Отмена
            </button>
          </div>
        </section>
      ) : (
        <div className="two-col-hub">
          <section className="section-block">
            <h2>Свод правил заказа</h2>
            <p className="muted-sm" style={{ marginBottom: 16 }}>
              {rules.intro}
            </p>

            <div className="rules-stack">
              {rules.sections.map((sec) => (
                <div key={sec.id} className="rule-group-card">
                  <h3>{sec.title}</h3>
                  <ul className="rules-list">
                    {sec.items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="footnotes-box">
              {rules.footnotes.map((fn, i) => (
                <p key={i} className="muted-xs">
                  {fn}
                </p>
              ))}
            </div>
          </section>

          <section className="section-block">
            <h2>Шкала оценок канала</h2>
            <p className="muted-sm" style={{ marginBottom: 16 }}>
              Как стример оценивает пройденные и просмотренные тайтлы
            </p>

            <div className="scale-cards">
              {ratingScale.map((rs) => (
                <div
                  key={rs.rating}
                  className="scale-card"
                  style={{ borderLeft: `4px solid ${rs.color}` }}
                >
                  <strong style={{ color: rs.color, fontSize: '1.05rem' }}>
                    {rs.rating}
                  </strong>
                  <p>{rs.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
