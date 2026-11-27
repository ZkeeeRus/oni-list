import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  Check,
  Edit3,
  Eraser,
  Info,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wand2,
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

// Автоматическое распознавание для старых правил (до первого сохранения в новом редакторе)
const LEGACY_RULE_TOKEN_RE =
  /(https?:\/\/[^\s)]+|==[^=\n]+==|\*\*[^*\n]+\*\*|!![^!\n]+!!|«[^»\n]+»|\b\d[\d\s.,]*(?:\s?(?:₽|руб(?:лей|\.)?|р\.|ч\.|час(?:а|ов)?|%|раз(?:а)?|мин\.|дн\.))|\b[xхXХ]\d+\b|\b(?:Дроп[а-яё]*|дроп[а-яё]*|Возврат[а-яё]*|возврат[а-яё]*|Аукцион[а-яё]*|аукцион[а-яё]*|Рулетк[а-яё]*|рулетк[а-яё]*|Запрещ[а-яё]*|запрещ[а-яё]*|Важно|Внимание|СмолДик)\b)/g;

// Явные теги выделения, которыми управляет редактор: ==плашка==, **акцент**, !!важно!!, «кавычки» и ссылки
const EXPLICIT_RULE_TOKEN_RE =
  /(https?:\/\/[^\s)»*!=]+|==[^=\n]+==|\*\*[^*\n]+\*\*|!![^!\n]+!!|«[^»\n]+»)/g;

const MARKER_ONLY_RE = /(==[^=\n]+==|\*\*[^*\n]+\*\*|!![^!\n]+!!|«[^»\n]+»)/g;

// Переводит старые авто-выделения в явные теги, чтобы при открытии редактора они сразу были видны и редактировались
function convertLegacyRuleHighlightsToMarkers(text: string): string {
  if (!text) return '';
  const parts = text.split(LEGACY_RULE_TOKEN_RE);
  return parts
    .map((part) => {
      if (!part) return '';
      if (
        /^https?:\/\//.test(part) ||
        (part.startsWith('==') && part.endsWith('==')) ||
        (part.startsWith('**') && part.endsWith('**')) ||
        (part.startsWith('!!') && part.endsWith('!!')) ||
        (part.startsWith('«') && part.endsWith('»'))
      ) {
        return part;
      }
      if (/^(?:\d|[xхXХ]\d)/.test(part)) {
        return `==${part}==`;
      }
      if (
        /^(?:Дроп|дроп|Возврат|возврат|Аукцион|аукцион|Рулетк|рулетк|Запрещ|запрещ|Важно|Внимание|СмолДик)/.test(
          part
        )
      ) {
        return `**${part}**`;
      }
      return part;
    })
    .join('');
}

function unwrapSingleToken(tok: string): string {
  if (
    (tok.startsWith('==') && tok.endsWith('==')) ||
    (tok.startsWith('**') && tok.endsWith('**')) ||
    (tok.startsWith('!!') && tok.endsWith('!!'))
  ) {
    return tok.slice(2, -2);
  }
  if (tok.startsWith('«') && tok.endsWith('»')) {
    return tok.slice(1, -1);
  }
  return tok;
}

function renderExplicitRuleText(text: string): React.ReactNode {
  const parts = text.split(EXPLICIT_RULE_TOKEN_RE);
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
    if (part.startsWith('==') && part.endsWith('==') && part.length > 4) {
      return (
        <span key={idx} className="rule-accent-num">
          {part.slice(2, -2)}
        </span>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="rule-accent-term">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('!!') && part.endsWith('!!') && part.length > 4) {
      return (
        <span key={idx} className="rule-accent-danger">
          {part.slice(2, -2)}
        </span>
      );
    }
    if (part.startsWith('«') && part.endsWith('»') && part.length > 2) {
      return (
        <span key={idx} className="rule-accent-quote">
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderFormattedRuleText(
  text: string,
  manualFormatting?: boolean
): React.ReactNode {
  if (
    manualFormatting ||
    text.includes('==') ||
    text.includes('**') ||
    text.includes('!!')
  ) {
    return renderExplicitRuleText(text);
  }

  const parts = text.split(LEGACY_RULE_TOKEN_RE);
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

// Подсветка прямо внутри текстового поля с 100% сохранением ширины символов (курсор не съезжает)
function renderEditorBackdropTokens(text: string): React.ReactNode {
  const parts = text.split(EXPLICIT_RULE_TOKEN_RE);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (/^https?:\/\//.test(part)) {
      return (
        <span key={idx} className="hl-tok-link">
          {part}
        </span>
      );
    }
    if (part.startsWith('==') && part.endsWith('==') && part.length > 4) {
      return (
        <span key={idx} className="hl-tok-amber">
          <span className="hl-delim">==</span>
          {part.slice(2, -2)}
          <span className="hl-delim">==</span>
        </span>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <span key={idx} className="hl-tok-purple">
          <span className="hl-delim">**</span>
          {part.slice(2, -2)}
          <span className="hl-delim">**</span>
        </span>
      );
    }
    if (part.startsWith('!!') && part.endsWith('!!') && part.length > 4) {
      return (
        <span key={idx} className="hl-tok-red">
          <span className="hl-delim">!!</span>
          {part.slice(2, -2)}
          <span className="hl-delim">!!</span>
        </span>
      );
    }
    if (part.startsWith('«') && part.endsWith('»') && part.length > 2) {
      return (
        <span key={idx} className="hl-tok-cyan">
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

interface RuleRichInputProps {
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
}

const RuleRichInput: React.FC<RuleRichInputProps> = ({
  value,
  placeholder,
  onChange,
}) => {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);

  const applyMarker = (open: string, close: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;

    // Если текст не выделен - проверяем, не стоит ли курсор уже внутри такого тега
    if (start === end) {
      const matches = Array.from(value.matchAll(MARKER_ONLY_RE));
      for (const m of matches) {
        const mIdx = m.index ?? 0;
        const tok = m[0];
        if (start >= mIdx && start <= mIdx + tok.length) {
          const inner = unwrapSingleToken(tok);
          if (tok.startsWith(open) && tok.endsWith(close)) {
            const next = value.slice(0, mIdx) + inner + value.slice(mIdx + tok.length);
            onChange(next);
            const pos = Math.max(mIdx, Math.min(mIdx + inner.length, start - open.length));
            requestAnimationFrame(() => {
              ta.focus();
              ta.setSelectionRange(pos, pos);
            });
            return;
          }
          const replaced = `${open}${inner}${close}`;
          const next = value.slice(0, mIdx) + replaced + value.slice(mIdx + tok.length);
          onChange(next);
          requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(mIdx + open.length, mIdx + open.length + inner.length);
          });
          return;
        }
      }

      const sample = 'текст';
      const inserted = `${open}${sample}${close}`;
      const next = value.slice(0, start) + inserted + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + open.length, start + open.length + sample.length);
      });
      return;
    }

    const selected = value.slice(start, end);

    // Повторное нажатие на тот же тип выделения снимает его
    if (
      selected.startsWith(open) &&
      selected.endsWith(close) &&
      selected.length > open.length + close.length
    ) {
      const inner = selected.slice(open.length, selected.length - close.length);
      const next = value.slice(0, start) + inner + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start, start + inner.length);
      });
      return;
    }

    if (
      start >= open.length &&
      value.slice(start - open.length, start) === open &&
      value.slice(end, end + close.length) === close
    ) {
      const next =
        value.slice(0, start - open.length) +
        selected +
        value.slice(end + close.length);
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(
          start - open.length,
          start - open.length + selected.length
        );
      });
      return;
    }

    // Если выделенный фрагмент уже обернут другим маркером - меняем стиль в 1 клик без вложенности
    let cleanStart = start;
    let cleanEnd = end;
    let inner = selected;
    for (const [o, c] of [
      ['==', '=='],
      ['**', '**'],
      ['!!', '!!'],
      ['«', '»'],
    ]) {
      if (
        cleanStart >= o.length &&
        value.slice(cleanStart - o.length, cleanStart) === o &&
        value.slice(cleanEnd, cleanEnd + c.length) === c
      ) {
        cleanStart -= o.length;
        cleanEnd += c.length;
        inner = value.slice(cleanStart + o.length, cleanEnd - c.length);
        break;
      }
      if (
        inner.startsWith(o) &&
        inner.endsWith(c) &&
        inner.length > o.length + c.length
      ) {
        inner = inner.slice(o.length, inner.length - c.length);
        break;
      }
    }

    const wrapped = `${open}${inner}${close}`;
    const next = value.slice(0, cleanStart) + wrapped + value.slice(cleanEnd);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(
        cleanStart + open.length,
        cleanStart + open.length + inner.length
      );
    });
  };

  const clearHighlight = () => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;

    if (start === end) {
      const matches = Array.from(value.matchAll(MARKER_ONLY_RE));
      for (const m of matches) {
        const mIdx = m.index ?? 0;
        const tok = m[0];
        if (start >= mIdx && start <= mIdx + tok.length) {
          const inner = unwrapSingleToken(tok);
          const next = value.slice(0, mIdx) + inner + value.slice(mIdx + tok.length);
          onChange(next);
          const pos = Math.max(mIdx, Math.min(mIdx + inner.length, start - 2));
          requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(pos, pos);
          });
          return;
        }
      }
      return;
    }

    let rangeStart = start;
    let rangeEnd = end;
    for (const [o, c] of [
      ['==', '=='],
      ['**', '**'],
      ['!!', '!!'],
      ['«', '»'],
    ]) {
      if (
        rangeStart >= o.length &&
        value.slice(rangeStart - o.length, rangeStart) === o &&
        value.slice(rangeEnd, rangeEnd + c.length) === c
      ) {
        rangeStart -= o.length;
        rangeEnd += c.length;
        break;
      }
    }

    const slice = value
      .slice(rangeStart, rangeEnd)
      .replace(MARKER_ONLY_RE, (tok) => unwrapSingleToken(tok))
      .replace(/==|\*\*|!!/g, '');
    const next = value.slice(0, rangeStart) + slice + value.slice(rangeEnd);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(rangeStart, rangeStart + slice.length);
    });
  };

  return (
    <div className={`rule-hl-field ${focused ? 'is-focused' : ''}`}>
      <div className="rule-hl-editor-wrap">
        <div className="rule-hl-backdrop" aria-hidden="true">
          {value ? (
            renderEditorBackdropTokens(value)
          ) : (
            <span className="rule-hl-placeholder">{placeholder || ''}</span>
          )}
          {'\n '}
        </div>
        <textarea
          ref={taRef}
          className="rule-hl-textarea"
          rows={1}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </div>

      {focused && (
        <div
          className="rule-fmt-panel"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="rule-fmt-toolbar">
            <span className="muted-xs">Выделить:</span>
            <button
              type="button"
              className="rule-fmt-btn fmt-amber"
              onClick={() => applyMarker('==', '==')}
              title="Выделить золотистой плашкой (цены, часы, условия)"
            >
              Плашка
            </button>
            <button
              type="button"
              className="rule-fmt-btn fmt-purple"
              onClick={() => applyMarker('**', '**')}
              title="Выделить жирным фиолетовым акцентом"
            >
              Акцент
            </button>
            <button
              type="button"
              className="rule-fmt-btn fmt-cyan"
              onClick={() => applyMarker('«', '»')}
              title="Обернуть в голубые кавычки «...»"
            >
              «Кавычки»
            </button>
            <button
              type="button"
              className="rule-fmt-btn fmt-red"
              onClick={() => applyMarker('!!', '!!')}
              title="Выделить красной плашкой (запреты и важное)"
            >
              Важно
            </button>
            <button
              type="button"
              className="rule-fmt-btn fmt-clear"
              onClick={clearHighlight}
              title="Убрать выделение у выбранного слова или под курсором"
            >
              <Eraser size={12} /> Снять цвет
            </button>
          </div>
          {value.trim() && (
            <div className="rule-live-preview">
              <span className="rule-live-preview-label">На сайте:</span>
              <div className="rule-live-preview-body">
                {renderExplicitRuleText(value)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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

    // Если правила еще ни разу не сохранялись с ручной разметкой - автоматически переносим текущие подсветки в редактируемые теги
    if (!clonedRules.manualFormatting) {
      clonedRules.intro = convertLegacyRuleHighlightsToMarkers(
        clonedRules.intro || ''
      );
      clonedRules.sections = clonedRules.sections.map((sec) => ({
        ...sec,
        items: (sec.items || []).map((it) =>
          convertLegacyRuleHighlightsToMarkers(it)
        ),
      }));
      clonedRules.footnotes = clonedRules.footnotes.map((fn) =>
        convertLegacyRuleHighlightsToMarkers(fn)
      );
      clonedRules.manualFormatting = true;
    }

    setDraft(clonedRules);
    setScaleDraft(JSON.parse(JSON.stringify(ratingScale)));
    setEditing(true);
  };

  const handleAutoHighlightAll = () => {
    setDraft((prev) => ({
      ...prev,
      manualFormatting: true,
      intro: convertLegacyRuleHighlightsToMarkers(prev.intro || ''),
      sections: (prev.sections || []).map((sec) => ({
        ...sec,
        items: sec.items.map((it) => convertLegacyRuleHighlightsToMarkers(it)),
      })),
      footnotes: (prev.footnotes || []).map((fn) =>
        convertLegacyRuleHighlightsToMarkers(fn)
      ),
    }));
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
      manualFormatting: true,
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
          <div className="rule-fmt-guide-bar">
            <div className="rule-fmt-guide-items">
              <span className="muted-xs">Подсветка текста в правилах:</span>
              <span className="rule-accent-num">==плашка==</span>
              <strong className="rule-accent-term">**акцент**</strong>
              <span className="rule-accent-quote">«кавычки»</span>
              <span className="rule-accent-danger">!!важно!!</span>
              <span className="muted-xs">
                (выделите любой кусок текста мышкой и нажмите кнопку цвета под полем)
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={handleAutoHighlightAll}
              title="Автоматически подсветить цены, часы и ключевые слова в новом тексте"
            >
              <Wand2 size={13} /> Авто-разметить цены и термины
            </button>
          </div>

          <div className="settings-section form-grid">
            <label className="field-label">Вступление (верхняя плашка над разделами)</label>
            <RuleRichInput
              placeholder="Вступительный текст над правилами (оставьте пустым, чтобы скрыть плашку)..."
              value={draft.intro}
              onChange={(val) => setDraft({ ...draft, intro: val })}
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
                        confirm(
                          `Удалить раздел «${sec.title || sIdx + 1}» со всеми его пунктами?`
                        )
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
                  <RuleRichInput
                    placeholder="Текст пункта правил..."
                    value={item}
                    onChange={(val) => {
                      const next = [...draft.sections];
                      const items = [...sec.items];
                      items[iIdx] = val;
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
                  <RuleRichInput
                    placeholder="Текст примечания или сноски..."
                    value={fn}
                    onChange={(val) => {
                      const nextFn = [...(draft.footnotes || [])];
                      nextFn[fIdx] = val;
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
                <span className="muted-xs">
                  Основные условия заказов, дропов и возвратов
                </span>
              </div>
            </div>

            {rules.intro && (
              <div className="rules-intro-banner">
                <Sparkles size={16} className="rules-intro-icon" />
                <p>{renderFormattedRuleText(rules.intro, rules.manualFormatting)}</p>
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
                          {renderFormattedRuleText(it, rules.manualFormatting)}
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
                    <span>{renderFormattedRuleText(fn, rules.manualFormatting)}</span>
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
