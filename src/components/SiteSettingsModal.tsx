import React, { useRef, useState } from 'react';
import {
  Cpu,
  Download,
  ExternalLink,
  HeartHandshake,
  LogOut,
  Palette,
  Shield,
  Sparkles,
  Upload,
  UserPlus,
  Volume2,
  X,
} from 'lucide-react';
import { SiteData, TwitchUser, UserRole } from '../types';
import { PERMANENT_ADMINS } from '../services/authAndStorage';
import {
  DEFAULT_PREFERENCES,
  HolidayMode,
  isFestiveSeasonDate,
  PerformanceMode,
  SnowIntensity,
  ThemeId,
  UserPreferences,
} from '../utils/preferences';
import { playBellJingle, playUiClick } from '../utils/soundEffects';

export type SettingsTabId = 'appearance' | 'sound' | 'perf' | 'admin' | 'credits';

interface SiteSettingsModalProps {
  initialTab?: SettingsTabId;
  prefs: UserPreferences;
  onChangePrefs: (next: UserPreferences) => void;
  user: TwitchUser | null;
  role: UserRole;
  data: SiteData;
  dataSource: 'remote' | 'local' | 'seed';
  onClose: () => void;
  onLogout: () => void;
  onUpdateModerators: (mods: string[]) => void;
  onImportJson: (imported: SiteData) => void;
  onForceCloudPush: () => void;
}

const THEMES: Array<{
  id: ThemeId;
  name: string;
  desc: string;
  swatch: string;
}> = [
  {
    id: 'default',
    name: 'Они-Твич',
    desc: 'Фирменный темный неон с фиолетовым акцентом',
    swatch: 'linear-gradient(135deg, #9146ff, #06b6d4)',
  },
  {
    id: 'winter',
    name: 'Зимняя ночь',
    desc: 'Морозный индиго, ледяной голубой и северное сияние',
    swatch: 'linear-gradient(135deg, #38bdf8, #818cf8)',
  },
  {
    id: 'ruby',
    name: 'Кибер-рубин',
    desc: 'Глубокий обсидиан с алым и теплым янтарным свечением',
    swatch: 'linear-gradient(135deg, #f43f5e, #fb923c)',
  },
  {
    id: 'emerald',
    name: 'Хвойный лес',
    desc: 'Темная хвоя, изумруд и новогоднее золото',
    swatch: 'linear-gradient(135deg, #10b981, #fbbf24)',
  },
  {
    id: 'light',
    name: 'Светлый снег',
    desc: 'Чистая дневная тема в светлых морозных тонах',
    swatch: 'linear-gradient(135deg, #e2e8f0, #7c3aed)',
  },
];

export const SiteSettingsModal: React.FC<SiteSettingsModalProps> = ({
  initialTab = 'appearance',
  prefs,
  onChangePrefs,
  user,
  role,
  data,
  dataSource,
  onClose,
  onLogout,
  onUpdateModerators,
  onImportJson,
  onForceCloudPush,
}) => {
  const canEdit = role === 'admin' || role === 'moderator';
  const [tab, setTab] = useState<SettingsTabId>(
    initialTab === 'admin' && !canEdit ? 'appearance' : initialTab
  );
  const [newMod, setNewMod] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);

  const updatePref = <K extends keyof UserPreferences>(
    key: K,
    val: UserPreferences[K]
  ) => {
    const next = { ...prefs, [key]: val };
    onChangePrefs(next);
    playUiClick(next);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `onized-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const parsed = JSON.parse(txt) as SiteData;
      if (Array.isArray(parsed.games) && Array.isArray(parsed.watchlist)) {
        onImportJson(parsed);
        onClose();
      }
    } catch {
      alert('Не удалось прочитать JSON-файл резервной копии.');
    }
  };

  const seasonNow = isFestiveSeasonDate();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Настройки портала</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-tabs-bar">
          <button
            type="button"
            className={tab === 'appearance' ? 'active' : ''}
            onClick={() => setTab('appearance')}
          >
            <Palette size={15} /> Оформление и тема
          </button>
          <button
            type="button"
            className={tab === 'sound' ? 'active' : ''}
            onClick={() => setTab('sound')}
          >
            <Volume2 size={15} /> Звуки
          </button>
          <button
            type="button"
            className={tab === 'perf' ? 'active' : ''}
            onClick={() => setTab('perf')}
          >
            <Cpu size={15} /> Производительность
          </button>
          {canEdit && (
            <button
              type="button"
              className={tab === 'admin' ? 'active' : ''}
              onClick={() => setTab('admin')}
            >
              <Shield size={15} /> Админка
            </button>
          )}
          <button
            type="button"
            className={tab === 'credits' ? 'active' : ''}
            onClick={() => setTab('credits')}
          >
            <HeartHandshake size={15} /> Авторы
          </button>
        </div>

        <div className="modal-body form-grid">
          {tab === 'appearance' && (
            <>
              <div className="settings-section">
                <h4>Цветовая тема</h4>
                <div className="theme-cards-grid">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`theme-choice-card ${prefs.theme === t.id ? 'selected' : ''}`}
                      onClick={() => updatePref('theme', t.id)}
                    >
                      <span
                        className="theme-swatch"
                        style={{ background: t.swatch }}
                      />
                      <div>
                        <strong>{t.name}</strong>
                        <small>{t.desc}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-section">
                <h4>
                  <Sparkles size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Новогоднее оформление и эффекты
                </h4>
                <p className="muted-sm" style={{ marginBottom: 10 }}>
                  В режиме «Авто по дате» зимний вайб сам включается каждый год с{' '}
                  <strong>25 ноября по 25 января</strong> (сейчас сезон:{' '}
                  <strong>{seasonNow ? 'активен ❄' : 'не в датах'}</strong>).
                </p>

                <div className="segmented" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                  {(
                    [
                      ['auto', 'Авто (25 нояб - 25 янв)'],
                      ['on', 'Всегда включено'],
                      ['off', 'Выключено'],
                    ] as Array<[HolidayMode, string]>
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={prefs.holidayMode === val ? 'active' : ''}
                      onClick={() => updatePref('holidayMode', val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="form-row-2">
                  <div>
                    <label className="field-label">Падающий снег на фоне</label>
                    <select
                      className="input input-sm"
                      value={prefs.snowIntensity}
                      onChange={(e) =>
                        updatePref('snowIntensity', e.target.value as SnowIntensity)
                      }
                    >
                      <option value="off">Выключен</option>
                      <option value="light">Легкий снегопад</option>
                      <option value="rich">Густой новогодний снег</option>
                    </select>
                  </div>

                  <div className="toggles-col">
                    <label className="check-pill">
                      <input
                        type="checkbox"
                        checked={prefs.garlandEnabled}
                        onChange={(e) => updatePref('garlandEnabled', e.target.checked)}
                      />
                      <span>Гирлянда на верхней шапке</span>
                    </label>
                    <label className="check-pill">
                      <input
                        type="checkbox"
                        checked={prefs.footerTreeEnabled}
                        onChange={(e) => updatePref('footerTreeEnabled', e.target.checked)}
                      />
                      <span>Сугробы и елочка в футере</span>
                    </label>
                    <label className="check-pill">
                      <input
                        type="checkbox"
                        checked={prefs.parallaxEnabled}
                        onChange={(e) => updatePref('parallaxEnabled', e.target.checked)}
                      />
                      <span>Мягкий параллакс фона</span>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'sound' && (
            <div className="settings-section form-grid">
              <h4>Звуковые эффекты</h4>
              <label className="check-pill">
                <input
                  type="checkbox"
                  checked={prefs.soundEnabled}
                  onChange={(e) => updatePref('soundEnabled', e.target.checked)}
                />
                <span>Включить звуки на сайте</span>
              </label>

              <div>
                <label className="field-label">
                  Громкость эффектов: <strong>{Math.round(prefs.soundVolume * 100)}%</strong>
                </label>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={prefs.soundVolume}
                  disabled={!prefs.soundEnabled}
                  onChange={(e) => updatePref('soundVolume', Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>

              <div className="row-gap-sm wrap">
                <label className="check-pill">
                  <input
                    type="checkbox"
                    disabled={!prefs.soundEnabled}
                    checked={prefs.rouletteSound}
                    onChange={(e) => updatePref('rouletteSound', e.target.checked)}
                  />
                  <span>Трещотка и финал рулетки</span>
                </label>

                <label className="check-pill">
                  <input
                    type="checkbox"
                    disabled={!prefs.soundEnabled}
                    checked={prefs.uiSound}
                    onChange={(e) => updatePref('uiSound', e.target.checked)}
                  />
                  <span>Переключатели и звон елочки/гирлянды</span>
                </label>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => playBellJingle({ ...prefs, soundEnabled: true, uiSound: true })}
                >
                  <Volume2 size={14} /> Проверить звук
                </button>
              </div>
            </div>
          )}

          {tab === 'perf' && (
            <div className="settings-section form-grid">
              <h4>Режим производительности</h4>
              <p className="muted-sm">
                Если открываешь сайт на ноутбуке от батареи, старом телефоне или параллельно со стримом в 1080p60 - можно облегчить анимации.
              </p>

              <div className="perf-options-stack">
                {(
                  [
                    [
                      'high',
                      'Максимум красоты',
                      'Плавный снег, стеклянное размытие шапки, свечение карточек и мягкий параллакс.',
                    ],
                    [
                      'balanced',
                      'Сбалансированный',
                      'Уменьшенное число снежинок и облегченные тени без потери стиля.',
                    ],
                    [
                      'eco',
                      'Экономия ресурсов (слабый ПК / телефон)',
                      'Отключает анимацию снега, параллакс и тяжелое размытие фона для максимального FPS.',
                    ],
                  ] as Array<[PerformanceMode, string, string]>
                ).map(([modeId, title, desc]) => (
                  <button
                    key={modeId}
                    type="button"
                    className={`theme-choice-card ${prefs.performanceMode === modeId ? 'selected' : ''}`}
                    onClick={() => updatePref('performanceMode', modeId)}
                  >
                    <div>
                      <strong>{title}</strong>
                      <small>{desc}</small>
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onChangePrefs(DEFAULT_PREFERENCES)}
                >
                  Сбросить все настройки оформления по умолчанию
                </button>
              </div>
            </div>
          )}

          {tab === 'admin' && canEdit && user && (
            <>
              <div className="settings-section">
                <div className="user-status-row">
                  <div className="row-gap-sm">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.displayName} className="avatar-md" />
                    ) : (
                      <div className="avatar-placeholder">{user.displayName[0]?.toUpperCase()}</div>
                    )}
                    <div>
                      <div>
                        <strong>{user.displayName}</strong>{' '}
                        <span className="muted">(@{user.login})</span>
                      </div>
                      <div className="muted-sm">
                        Роль:{' '}
                        <strong>
                          {role === 'admin'
                            ? 'Админ (Стример / Создатель)'
                            : 'Модератор (полный доступ редактора)'}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                  >
                    <LogOut size={14} /> Выйти из аккаунта
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <h4>Админы и модераторы канала</h4>
                <div className="chips-wrap">
                  {PERMANENT_ADMINS.map((adm) => (
                    <span key={adm} className="mod-chip owner-chip">
                      👑 {adm} <small>(админ)</small>
                    </span>
                  ))}
                  {data.moderators.map((mod) => (
                    <span key={mod} className="mod-chip">
                      ⚔️ {mod}
                      <button
                        type="button"
                        className="chip-del"
                        onClick={() =>
                          onUpdateModerators(data.moderators.filter((m) => m !== mod))
                        }
                        title="Убрать модератора"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="inline-search-row" style={{ marginTop: 10 }}>
                  <input
                    className="input input-sm"
                    placeholder="Ник модератора на Twitch (напр. samarhik, s1men5)"
                    value={newMod}
                    onChange={(e) => setNewMod(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const clean = newMod.toLowerCase().trim().replace(/^@/, '');
                      if (
                        clean &&
                        !PERMANENT_ADMINS.includes(clean) &&
                        !data.moderators.includes(clean)
                      ) {
                        onUpdateModerators([...data.moderators, clean]);
                        setNewMod('');
                      }
                    }}
                  >
                    <UserPlus size={14} /> Добавить модератора
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <h4>Облачная база данных и резервные копии</h4>
                <p className="muted-sm" style={{ marginBottom: 10 }}>
                  Статус:{' '}
                  <strong>
                    {dataSource === 'remote'
                      ? 'Облачная БД (синхронизировано для всех)'
                      : 'Локальный черновик браузера'}
                  </strong>
                </p>
                <div className="row-between wrap">
                  <button
                    type="button"
                    className="btn btn-twitch btn-sm"
                    onClick={onForceCloudPush}
                  >
                    <Upload size={14} /> Синхронизировать с облаком
                  </button>

                  <div className="row-gap-sm wrap">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleExport}
                    >
                      <Download size={14} /> Скачать JSON бэкап
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => importRef.current?.click()}
                    >
                      <Upload size={14} /> Импорт JSON
                    </button>
                    <input
                      ref={importRef}
                      type="file"
                      accept="application/json"
                      hidden
                      onChange={handleFileImport}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'credits' && (
            <div className="settings-section form-grid">
              <h4>О проекте OniZeD Hub</h4>
              <p className="muted-sm">
                Единый интерактивный портал прохождений, заказов игр, просмотрового, бэклога, рулетки и тир-листов сообщества.
              </p>

              <div className="credits-grid">
                <div className="credit-card">
                  <span className="credit-badge">СТРИМЕР И ИДЕЯ</span>
                  <strong>Ден (OniZeD)</strong>
                  <p className="muted-sm">
                    Хозяин канала, автор всех оценок, прохождений, обзоров и локальных мемов.
                  </p>
                  <a
                    href={data.hubConfig.twitchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-twitch btn-xs"
                  >
                    twitch.tv/onized <ExternalLink size={12} />
                  </a>
                </div>

                <div className="credit-card">
                  <span className="credit-badge cyan">РАЗРАБОТКА И ДИЗАЙН</span>
                  <strong>ZkeeeRus</strong>
                  <p className="muted-sm">
                    Создатель и главный разработчик OniZeD Hub, архитектура базы, рулетка и функционал портала.
                  </p>
                  <a
                    href="https://www.twitch.tv/zkeeerus"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-xs"
                  >
                    Twitch профиль <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              <div className="detail-box">
                <strong>Отдельная благодарность:</strong>
                <p className="muted-sm">
                  Модераторам и всем зрителям чата <strong>OniZeD</strong> - за сотни заказанных игр, фильмы, ивенты, пасты и поддержку канала!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
