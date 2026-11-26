import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Cookie,
  Cpu,
  Download,
  ExternalLink,
  HeartHandshake,
  History,
  ImagePlus,
  LogOut,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserPlus,
  Volume2,
  X,
} from 'lucide-react';
import { AuthStatsData, SiteData, TwitchUser, UserRole } from '../types';
import {
  fetchTwitchAuthStats,
  PERMANENT_ADMINS,
  restoreCloudBackupSlot,
} from '../services/authAndStorage';
import {
  PRIVACY_ACCEPT_ALL,
  PRIVACY_ESSENTIAL_ONLY,
  TelemetryPrivacyPrefs,
} from '../utils/analytics';
import { compressWallpaperToWebpDataUrl } from '../utils/imageCompress';
import {
  APP_VERSION,
  BgStyle,
  DEFAULT_PREFERENCES,
  FestiveShapesMode,
  getFestiveSeasonKey,
  isHolidayActive,
  PerformanceMode,
  SnowIntensity,
  ThemeId,
  UserPreferences,
} from '../utils/preferences';
import { playBellJingle, playUiClick } from '../utils/soundEffects';

export type SettingsTabId =
  | 'appearance'
  | 'sound'
  | 'perf'
  | 'privacy'
  | 'admin'
  | 'credits';

interface SiteSettingsModalProps {
  initialTab?: SettingsTabId;
  onSelectTab?: (tab: SettingsTabId) => void;
  prefs: UserPreferences;
  onChangePrefs: (next: UserPreferences) => void;
  customWallpaperUrl: string;
  onChangeCustomWallpaper: (urlOrData: string) => void;
  privacyPrefs: TelemetryPrivacyPrefs;
  onChangePrivacyPrefs: (next: TelemetryPrivacyPrefs) => void;
  user: TwitchUser | null;
  role: UserRole;
  apiBaseUrl: string;
  data: SiteData;
  dataSource: 'remote' | 'local' | 'seed';
  onClose: () => void;
  onLogout: () => void;
  onUpdateModerators: (mods: string[]) => void;
  onImportJson: (imported: SiteData) => void;
  onRestoreCloudBackup: (restored: SiteData) => void;
  onForceCloudPush: () => void;
}

const ACCENT_THEMES: Array<{
  id: ThemeId;
  name: string;
  desc: string;
  swatch: string;
}> = [
  {
    id: 'default',
    name: 'Они-Твич (по умолчанию)',
    desc: 'Фирменный фиолетовый неон и бирюзовый акцент',
    swatch: 'linear-gradient(135deg, #9146ff, #06b6d4)',
  },
  {
    id: 'winter',
    name: 'Зимний лед',
    desc: 'Морозный голубой и северное сияние индиго',
    swatch: 'linear-gradient(135deg, #38bdf8, #818cf8)',
  },
  {
    id: 'ruby',
    name: 'Кибер-рубин',
    desc: 'Алый рубин с теплым янтарным отблеском',
    swatch: 'linear-gradient(135deg, #f43f5e, #fb923c)',
  },
  {
    id: 'emerald',
    name: 'Хвойный изумруд',
    desc: 'Лесной изумруд и теплое золото',
    swatch: 'linear-gradient(135deg, #10b981, #fbbf24)',
  },
];

const BG_STYLES: Array<{ id: BgStyle; name: string; desc: string }> = [
  {
    id: 'stars',
    name: 'Звездная сетка',
    desc: 'Кибер-сетка, созвездия и объемное свечение',
  },
  {
    id: 'aurora',
    name: 'Северное сияние',
    desc: 'Переливающиеся волны авроры и мягкие звезды',
  },
  {
    id: 'nebula',
    name: 'Туманность',
    desc: 'Глубокие неоновые облака и звезды без сетки',
  },
  {
    id: 'minimal',
    name: 'Чистый минимализм',
    desc: 'Спокойный фон без сетки и фоновых фигур',
  },
  {
    id: 'custom',
    name: 'Своя картинка',
    desc: 'Загрузи свои обои с ПК/телефона или по ссылке',
  },
];

const TAB_LABELS: Record<string, string> = {
  hub: 'Хаб (Главная)',
  games: 'Список игр',
  watchlist: 'Просмотровое',
  tierlist: 'Тир-листы',
  backlog: 'Бэклог',
  stats: 'Рулетка и Стата',
  rules: 'Правила и оценки',
};

const DEVICE_LABELS: Record<string, string> = {
  desktop: 'ПК / Ноутбук',
  mobile: 'Телефон',
  tablet: 'Планшет',
};

const REF_LABELS: Record<string, string> = {
  direct: 'Прямой заход / закладки',
  twitch: 'Переход с Twitch',
  social: 'ТГ / Discord / ВК / YouTube',
  search: 'Поисковики',
  other: 'Другие ссылки',
};

export const SiteSettingsModal: React.FC<SiteSettingsModalProps> = ({
  initialTab = 'appearance',
  onSelectTab,
  prefs,
  onChangePrefs,
  customWallpaperUrl,
  onChangeCustomWallpaper,
  privacyPrefs,
  onChangePrivacyPrefs,
  user,
  role,
  apiBaseUrl,
  data,
  dataSource,
  onClose,
  onLogout,
  onUpdateModerators,
  onImportJson,
  onRestoreCloudBackup,
  onForceCloudPush,
}) => {
  const canEdit = role === 'admin' || role === 'moderator';
  const [tab, setTab] = useState<SettingsTabId>(
    initialTab === 'admin' && !canEdit ? 'appearance' : initialTab
  );

  useEffect(() => {
    setTab(initialTab === 'admin' && !canEdit ? 'appearance' : initialTab);
  }, [initialTab, canEdit]);

  const switchTab = (nextTab: SettingsTabId) => {
    setTab(nextTab);
    onSelectTab?.(nextTab);
  };
  const [newMod, setNewMod] = useState('');
  const [bgUrlDraft, setBgUrlDraft] = useState(
    customWallpaperUrl.startsWith('data:') ? '' : customWallpaperUrl
  );
  const [uploadingBg, setUploadingBg] = useState(false);

  const importRef = useRef<HTMLInputElement | null>(null);
  const bgFileRef = useRef<HTMLInputElement | null>(null);

  const [authStats, setAuthStats] = useState<AuthStatsData | null>(null);
  const [authStatsLoading, setAuthStatsLoading] = useState(false);
  const [authStatsNeedFnUpdate, setAuthStatsNeedFnUpdate] = useState(false);
  const [authStatsError, setAuthStatsError] = useState<string | null>(null);
  const [authViewMode, setAuthViewMode] = useState<'overview' | 'users' | 'recent'>(
    'overview'
  );
  const [restoringSlot, setRestoringSlot] = useState<number | null>(null);

  const updatePref = <K extends keyof UserPreferences>(
    key: K,
    val: UserPreferences[K]
  ) => {
    const next = { ...prefs, [key]: val };
    onChangePrefs(next);
    playUiClick(next);
  };

  const handleBgFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploadingBg(true);
    try {
      const compressed = await compressWallpaperToWebpDataUrl(f);
      onChangeCustomWallpaper(compressed);
      setBgUrlDraft('');
      if (prefs.bgStyle !== 'custom') {
        updatePref('bgStyle', 'custom');
      }
    } catch (err: any) {
      alert(err?.message || 'Не удалось обработать картинку фона');
    } finally {
      setUploadingBg(false);
    }
  };

  const loadAuthStats = useCallback(async () => {
    if (!user || !canEdit || !apiBaseUrl) return;
    setAuthStatsLoading(true);
    setAuthStatsError(null);
    const res = await fetchTwitchAuthStats(user, apiBaseUrl);
    setAuthStatsLoading(false);
    if (res.notUpdatedYet) {
      setAuthStatsNeedFnUpdate(true);
      setAuthStats(null);
    } else if (res.error) {
      setAuthStatsError(res.error);
    } else {
      setAuthStatsNeedFnUpdate(false);
      setAuthStats(res.stats);
    }
  }, [user, canEdit, apiBaseUrl]);

  useEffect(() => {
    if (tab === 'admin' && canEdit && user) {
      loadAuthStats();
    }
  }, [tab, canEdit, user, loadAuthStats]);

  const formatShortDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
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

  const currentSeasonKey = getFestiveSeasonKey();
  const holidayActive = isHolidayActive(prefs);

  const togglePrivacyField = (key: keyof Omit<TelemetryPrivacyPrefs, 'decided'>) => {
    onChangePrivacyPrefs({
      ...privacyPrefs,
      decided: true,
      [key]: !privacyPrefs[key],
    });
    playUiClick(prefs);
  };

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
            onClick={() => switchTab('appearance')}
          >
            <Palette size={15} /> Оформление
          </button>
          <button
            type="button"
            className={tab === 'sound' ? 'active' : ''}
            onClick={() => switchTab('sound')}
          >
            <Volume2 size={15} /> Звуки
          </button>
          <button
            type="button"
            className={tab === 'perf' ? 'active' : ''}
            onClick={() => switchTab('perf')}
          >
            <Cpu size={15} /> Производительность
          </button>
          <button
            type="button"
            className={tab === 'privacy' ? 'active' : ''}
            onClick={() => switchTab('privacy')}
          >
            <Cookie size={15} /> Cookie и стата
          </button>
          {canEdit && (
            <button
              type="button"
              className={tab === 'admin' ? 'active' : ''}
              onClick={() => switchTab('admin')}
            >
              <Shield size={15} /> Админка
            </button>
          )}
          <button
            type="button"
            className={tab === 'credits' ? 'active' : ''}
            onClick={() => switchTab('credits')}
          >
            <HeartHandshake size={15} /> Авторы
          </button>
        </div>

        <div className="modal-body form-grid">
          {tab === 'appearance' && (
            <>
              <div className="settings-section form-grid">
                <div className="row-between wrap">
                  <div>
                    <h4 style={{ marginBottom: 2 }}>Режим отображения и акценты</h4>
                    <p className="muted-xs">
                      По умолчанию всегда стоит темная дефолтная Они-версия
                    </p>
                  </div>

                  <div className="segmented">
                    <button
                      type="button"
                      className={prefs.colorMode === 'dark' ? 'active' : ''}
                      onClick={() => updatePref('colorMode', 'dark')}
                    >
                      <Moon size={14} /> Темная
                    </button>
                    <button
                      type="button"
                      className={prefs.colorMode === 'light' ? 'active' : ''}
                      onClick={() => updatePref('colorMode', 'light')}
                    >
                      <Sun size={14} /> Светлая
                    </button>
                  </div>
                </div>

                <div className="theme-cards-grid">
                  {ACCENT_THEMES.map((t) => (
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

              <div className="settings-section form-grid">
                <h4>Оформление фона и параллакс</h4>
                <div className="theme-cards-grid">
                  {BG_STYLES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className={`theme-choice-card ${prefs.bgStyle === b.id ? 'selected' : ''}`}
                      onClick={() => updatePref('bgStyle', b.id)}
                    >
                      <div>
                        <strong>{b.name}</strong>
                        <small>{b.desc}</small>
                      </div>
                    </button>
                  ))}
                </div>

                {prefs.bgStyle === 'custom' && (
                  <div className="custom-bg-settings-box form-grid">
                    <div className="row-gap-sm wrap">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={uploadingBg}
                        onClick={() => bgFileRef.current?.click()}
                      >
                        <ImagePlus size={14} />{' '}
                        {uploadingBg ? 'Сжимаем картинку...' : 'Загрузить картинку фона'}
                      </button>
                      <input
                        ref={bgFileRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handleBgFileUpload}
                      />
                      {customWallpaperUrl && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm danger-text"
                          onClick={() => {
                            onChangeCustomWallpaper('');
                            setBgUrlDraft('');
                          }}
                        >
                          <Trash2 size={14} /> Убрать картинку
                        </button>
                      )}
                    </div>

                    <div className="inline-search-row">
                      <input
                        type="text"
                        className="input input-sm"
                        placeholder="Или вставь прямую ссылку на обои (https://...)"
                        value={bgUrlDraft}
                        onChange={(e) => setBgUrlDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (bgUrlDraft.trim()) {
                              onChangeCustomWallpaper(bgUrlDraft.trim());
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!bgUrlDraft.trim()}
                        onClick={() => onChangeCustomWallpaper(bgUrlDraft.trim())}
                      >
                        Применить URL
                      </button>
                    </div>

                    <div className="form-row-2">
                      <div>
                        <label className="field-label">
                          Затемнение фона:{' '}
                          <strong>{Math.round(prefs.customBgDimming * 100)}%</strong>
                        </label>
                        <input
                          type="range"
                          min={0.15}
                          max={0.9}
                          step={0.05}
                          value={prefs.customBgDimming}
                          onChange={(e) =>
                            updatePref('customBgDimming', Number(e.target.value))
                          }
                          style={{ width: '100%', accentColor: 'var(--accent)' }}
                        />
                      </div>
                      <div>
                        <label className="field-label">
                          Размытие фона: <strong>{prefs.customBgBlur} px</strong>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={16}
                          step={1}
                          value={prefs.customBgBlur}
                          onChange={(e) =>
                            updatePref('customBgBlur', Number(e.target.value))
                          }
                          style={{ width: '100%', accentColor: 'var(--accent)' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <label className="check-pill">
                  <input
                    type="checkbox"
                    checked={prefs.parallaxEnabled}
                    onChange={(e) => updatePref('parallaxEnabled', e.target.checked)}
                  />
                  <span>Многослойный 3D-параллакс фона при движении мыши и прокрутке</span>
                </label>

                {currentSeasonKey !== null && (
                  <div className="holiday-toggle-card">
                    <div className="row-between wrap">
                      <div>
                        <strong>
                          <Sparkles
                            size={15}
                            style={{ verticalAlign: 'middle', marginRight: 6 }}
                          />
                          Новогоднее оформление{' '}
                          {holidayActive ? '(включено ❄)' : '(отключено на этот сезон)'}
                        </strong>
                        <p className="muted-xs" style={{ marginTop: 3 }}>
                          Активно с 25 ноября по 25 января. На следующий Новый год включится снова само.
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm ${
                          holidayActive ? 'btn-secondary' : 'btn-primary'
                        }`}
                        onClick={() =>
                          updatePref(
                            'dismissedHolidaySeason',
                            holidayActive ? currentSeasonKey : null
                          )
                        }
                      >
                        {holidayActive
                          ? 'Выключить новогоднее оформление'
                          : 'Включить новогоднее оформление'}
                      </button>
                    </div>

                    {holidayActive && (
                      <div className="form-grid" style={{ marginTop: 12 }}>
                        <div className="form-row-2">
                          <div>
                            <label className="field-label">Падающий снег</label>
                            <select
                              className="input input-sm"
                              value={prefs.snowIntensity}
                              onChange={(e) =>
                                updatePref(
                                  'snowIntensity',
                                  e.target.value as SnowIntensity
                                )
                              }
                            >
                              <option value="off">Выключен</option>
                              <option value="light">Легкий снегопад</option>
                              <option value="rich">Густой новогодний снег</option>
                            </select>
                          </div>

                          <div>
                            <label className="field-label">Фигуры на фоне (параллакс)</label>
                            <select
                              className="input input-sm"
                              value={prefs.festiveShapes}
                              onChange={(e) =>
                                updatePref(
                                  'festiveShapes',
                                  e.target.value as FestiveShapesMode
                                )
                              }
                            >
                              <option value="winter">
                                Снежинки, елочки, подарки и шары
                              </option>
                              <option value="abstract">Обычные неоновые фигуры</option>
                              <option value="off">Без фигур</option>
                            </select>
                          </div>
                        </div>

                        <div className="row-gap-sm wrap">
                          <label className="check-pill">
                            <input
                              type="checkbox"
                              checked={prefs.garlandEnabled}
                              onChange={(e) =>
                                updatePref('garlandEnabled', e.target.checked)
                              }
                            />
                            <span>Свисающая гирлянда с игрушками под шапкой</span>
                          </label>
                          <label className="check-pill">
                            <input
                              type="checkbox"
                              checked={prefs.footerTreeEnabled}
                              onChange={(e) =>
                                updatePref('footerTreeEnabled', e.target.checked)
                              }
                            />
                            <span>Сугробы и елочка в футере</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                  <span>Трещотка, взрыв выбывания и финал рулетки</span>
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
                  onClick={() =>
                    playBellJingle({ ...prefs, soundEnabled: true, uiSound: true })
                  }
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
                      'Плавные анимации появления, снег, стеклянное размытие шапки и многослойный параллакс.',
                    ],
                    [
                      'balanced',
                      'Сбалансированный',
                      'Уменьшенное число снежинок и облегченные тени без потери стиля.',
                    ],
                    [
                      'eco',
                      'Экономия ресурсов (слабый ПК / телефон)',
                      'Отключает анимацию снега, параллакс и размытие фона для максимального FPS.',
                    ],
                  ] as Array<[PerformanceMode, string, string]>
                ).map(([modeId, title, desc]) => (
                  <button
                    key={modeId}
                    type="button"
                    className={`theme-choice-card ${
                      prefs.performanceMode === modeId ? 'selected' : ''
                    }`}
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
                  onClick={() => {
                    onChangePrefs(DEFAULT_PREFERENCES);
                    onChangeCustomWallpaper('');
                    setBgUrlDraft('');
                  }}
                >
                  Сбросить все настройки оформления к темной Они-версии
                </button>
              </div>
            </div>
          )}

          {tab === 'privacy' && (
            <div className="settings-section form-grid">
              <div className="row-between wrap">
                <div>
                  <h4 style={{ marginBottom: 2 }}>
                    <Cookie size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Файлы cookie и настройки статистики
                  </h4>
                  <p className="muted-xs">
                    Выбери сам, какие обезличенные данные разрешено передавать для статистики канала. IP-адреса, почты и отпечатки браузера никогда не собираются.
                  </p>
                </div>
              </div>

              <div className="row-gap-xs wrap">
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  onClick={() => {
                    onChangePrivacyPrefs(PRIVACY_ACCEPT_ALL);
                    playUiClick(prefs);
                  }}
                >
                  Разрешить все пункты
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => {
                    onChangePrivacyPrefs(PRIVACY_ESSENTIAL_ONLY);
                    playUiClick(prefs);
                  }}
                >
                  Отключить всю аналитику
                </button>
              </div>

              <div className="toggles-col">
                <label className="check-pill privacy-option-row">
                  <input type="checkbox" checked disabled />
                  <div>
                    <strong>Технические хранилища (обязательно)</strong>
                    <div className="muted-xs">
                      Сохранение выбранной темы оформления, громкости звуков, кэша списка и сессии входа Twitch в твоем браузере.
                    </div>
                  </div>
                </label>

                <label className="check-pill privacy-option-row">
                  <input
                    type="checkbox"
                    checked={privacyPrefs.allowVisitorCookie}
                    onChange={() => togglePrivacyField('allowVisitorCookie')}
                  />
                  <div>
                    <strong>Анонимный cookie-идентификатор визита (oni_vid)</strong>
                    <div className="muted-xs">
                      Случайный код (на сервере хранится только необратимый SHA-256 хэш), чтобы не считать тебя новым посетителем при каждом обновлении страницы.
                    </div>
                  </div>
                </label>

                <label className="check-pill privacy-option-row">
                  <input
                    type="checkbox"
                    checked={privacyPrefs.allowTabStats}
                    onChange={() => togglePrivacyField('allowTabStats')}
                  />
                  <div>
                    <strong>Популярность вкладок сайта</strong>
                    <div className="muted-xs">
                      Подсчет того, какие разделы открывают чаще всего (Хаб, Список игр, Просмотровое, Тир-листы, Рулетка).
                    </div>
                  </div>
                </label>

                <label className="check-pill privacy-option-row">
                  <input
                    type="checkbox"
                    checked={privacyPrefs.allowActionStats}
                    onChange={() => togglePrivacyField('allowActionStats')}
                  />
                  <div>
                    <strong>Интерактивные действия</strong>
                    <div className="muted-xs">
                      Общий счетчик прокрутов рулетки, открытий карточек и кликов по новогодней елочке.
                    </div>
                  </div>
                </label>

                <label className="check-pill privacy-option-row">
                  <input
                    type="checkbox"
                    checked={privacyPrefs.allowDeviceAndRef}
                    onChange={() => togglePrivacyField('allowDeviceAndRef')}
                  />
                  <div>
                    <strong>Категория экрана и источник перехода</strong>
                    <div className="muted-xs">
                      Помогает знать долю заходов с телефона и с ПК, а также переходы с Twitch/Telegram без сохранения User-Agent и полных ссылок.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {tab === 'admin' && canEdit && user && (
            <>
              <div className="settings-section">
                <div className="user-status-row">
                  <div className="row-gap-sm">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="avatar-md"
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {user.displayName[0]?.toUpperCase()}
                      </div>
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
                            : 'Модератор (доступ редактора)'}
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
                      {role === 'admin' && (
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
                      )}
                    </span>
                  ))}
                </div>

                {role === 'admin' && (
                  <div className="inline-search-row" style={{ marginTop: 10 }}>
                    <input
                      className="input input-sm"
                      placeholder="Ник модератора на Twitch (напр. samarhik, s1men5)"
                      value={newMod}
                      onChange={(e) => setNewMod(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const clean = newMod.toLowerCase().trim().replace(/^@/, '');
                          if (
                            clean &&
                            !PERMANENT_ADMINS.includes(clean) &&
                            !data.moderators.includes(clean)
                          ) {
                            onUpdateModerators([...data.moderators, clean]);
                            setNewMod('');
                          }
                        }
                      }}
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
                )}
              </div>

              <div className="settings-section form-grid">
                <div className="row-between wrap">
                  <div>
                    <h4 style={{ marginBottom: 2 }}>
                      <BarChart3
                        size={15}
                        style={{ verticalAlign: 'middle', marginRight: 6 }}
                      />
                      Аналитика сайта и авторизаций
                    </h4>
                    <p className="muted-xs">
                      Обезличенная статистика посещаемости, популярных вкладок, устройств и входов через Twitch
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    disabled={authStatsLoading}
                    onClick={loadAuthStats}
                  >
                    <RefreshCw size={12} />{' '}
                    {authStatsLoading ? 'Загрузка...' : 'Обновить'}
                  </button>
                </div>

                {authStatsNeedFnUpdate ? (
                  <p className="muted-sm">
                    Чтобы включить сбор аналитики и облачные авто-бэкапы, вставь обновленный код{' '}
                    <code>backend/yandex-function/index.js</code> в редактор функции в Yandex Cloud и нажми «Сохранить изменения».
                  </p>
                ) : authStatsError ? (
                  <p className="muted-sm danger-text">{authStatsError}</p>
                ) : authStats ? (
                  <>
                    <div className="segmented">
                      <button
                        type="button"
                        className={authViewMode === 'overview' ? 'active' : ''}
                        onClick={() => setAuthViewMode('overview')}
                      >
                        Трафик и вкладки
                      </button>
                      <button
                        type="button"
                        className={authViewMode === 'users' ? 'active' : ''}
                        onClick={() => setAuthViewMode('users')}
                      >
                        Twitch аккаунты ({authStats.users.length})
                      </button>
                      <button
                        type="button"
                        className={authViewMode === 'recent' ? 'active' : ''}
                        onClick={() => setAuthViewMode('recent')}
                      >
                        Журнал входов ({authStats.recent.length})
                      </button>
                    </div>

                    {authViewMode === 'overview' && authStats.siteAnalytics ? (
                      (() => {
                        const sa = authStats.siteAnalytics;
                        const maxTab = Math.max(
                          1,
                          ...Object.values(sa.tabs || {}).map((n) => Number(n) || 0)
                        );
                        const sortedTabs = Object.entries(TAB_LABELS)
                          .map(([id, label]) => ({
                            id,
                            label,
                            views: Number(sa.tabs?.[id] || 0),
                          }))
                          .sort((a, b) => b.views - a.views);

                        const maxDaySessions = Math.max(
                          1,
                          ...(sa.daily || []).map((d) => d.sessions)
                        );
                        const guestPct =
                          sa.totalSessions > 0
                            ? Math.round((sa.guestSessions / sa.totalSessions) * 100)
                            : 0;
                        const authedPct = sa.totalSessions > 0 ? 100 - guestPct : 0;

                        return (
                          <div className="form-grid">
                            <div className="analytics-kpi-grid">
                              <div className="analytics-kpi-box">
                                <span className="muted-xs">Уникальных (с cookie)</span>
                                <strong>{sa.uniqueVisitors}</strong>
                                {sa.consentlessHits > 0 && (
                                  <small className="muted-xs">
                                    +{sa.consentlessHits} заходов без cookie
                                  </small>
                                )}
                              </div>
                              <div className="analytics-kpi-box">
                                <span className="muted-xs">Всего визитов (сессий)</span>
                                <strong>{sa.totalSessions}</strong>
                                <small className="muted-xs">
                                  Открытий разделов: {sa.totalTabViews}
                                </small>
                              </div>
                              <div className="analytics-kpi-box">
                                <span className="muted-xs">Гости без входа / Twitch</span>
                                <strong>
                                  {guestPct}% / {authedPct}%
                                </strong>
                                <small className="muted-xs">
                                  Без входа: {sa.guestSessions} • Со входом:{' '}
                                  {sa.authedSessions}
                                </small>
                              </div>
                              <div className="analytics-kpi-box">
                                <span className="muted-xs">Интерактив</span>
                                <strong>
                                  🎲 {sa.actions?.roulette_spin || 0} • 🃏{' '}
                                  {sa.actions?.card_open || 0}
                                </strong>
                                <small className="muted-xs">
                                  Прокрутов рулетки / открытий карточек
                                </small>
                              </div>
                            </div>

                            {sa.daily && sa.daily.length > 0 && (
                              <div>
                                <div className="field-label">
                                  Посещаемость по дням (последние {sa.daily.length} дн.)
                                </div>
                                <div className="daily-chart-bars">
                                  {sa.daily.map((d) => (
                                    <div
                                      key={d.date}
                                      className="daily-bar-col"
                                      title={`${d.date}: ${d.sessions} виз. (${d.uniqueVisitors} уник., без входа: ${d.guestSessions}, со входом: ${d.authedSessions})`}
                                    >
                                      <span className="daily-bar-val">{d.sessions}</span>
                                      <div className="daily-bar-track">
                                        <div
                                          className="daily-bar-fill"
                                          style={{
                                            height: `${Math.max(
                                              8,
                                              (d.sessions / maxDaySessions) * 100
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                      <span className="daily-bar-date">
                                        {d.date.slice(8, 10)}.{d.date.slice(5, 7)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div>
                              <div className="field-label">
                                Какие вкладки открывают популярнее всего
                              </div>
                              <div className="bars-list">
                                {sortedTabs.map((t) => {
                                  const pct =
                                    sa.totalTabViews > 0
                                      ? Math.round((t.views / sa.totalTabViews) * 100)
                                      : 0;
                                  return (
                                    <div key={t.id} className="bar-row-static">
                                      <div className="row-between">
                                        <span>{t.label}</span>
                                        <span className="muted-xs">
                                          <strong>{t.views}</strong> ({pct}%)
                                        </span>
                                      </div>
                                      <div className="bar-track">
                                        <div
                                          className="bar-fill purple"
                                          style={{
                                            width: `${(t.views / maxTab) * 100}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="form-row-2">
                              <div>
                                <div className="field-label">Устройства посетителей</div>
                                <div className="chips-wrap">
                                  {Object.entries(DEVICE_LABELS).map(([k, label]) => (
                                    <span key={k} className="badge">
                                      {label}: <strong>&nbsp;{sa.devices?.[k] || 0}</strong>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="field-label">Откуда переходят</div>
                                <div className="chips-wrap">
                                  {Object.entries(REF_LABELS).map(([k, label]) => {
                                    const val = sa.referrers?.[k] || 0;
                                    if (!val && k !== 'direct' && k !== 'twitch')
                                      return null;
                                    return (
                                      <span key={k} className="badge">
                                        {label}: <strong>&nbsp;{val}</strong>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : authViewMode === 'users' ? (
                      <div className="auth-stats-scroll">
                        {authStats.users.length === 0 ? (
                          <span className="muted-sm">Пока никто не авторизовывался.</span>
                        ) : (
                          authStats.users.map((u) => (
                            <div key={u.login} className="auth-stat-row">
                              <div className="row-gap-xs" style={{ minWidth: 0 }}>
                                {u.avatarUrl ? (
                                  <img
                                    src={u.avatarUrl}
                                    alt={u.displayName}
                                    className="avatar-xs"
                                  />
                                ) : (
                                  <span className="brand-dot" />
                                )}
                                <strong className="clamp-1">{u.displayName}</strong>
                                <span className="muted-xs">@{u.login}</span>
                              </div>
                              <div className="row-gap-xs wrap">
                                <span className="badge">{u.loginCount} вх.</span>
                                <span className="muted-xs">
                                  {formatShortDate(u.lastSeenAt)}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="auth-stats-scroll">
                        {authStats.recent.length === 0 ? (
                          <span className="muted-sm">Журнал пока пуст.</span>
                        ) : (
                          authStats.recent.map((entry, idx) => (
                            <div
                              key={`${entry.login}-${entry.at}-${idx}`}
                              className="auth-stat-row"
                            >
                              <div className="row-gap-xs" style={{ minWidth: 0 }}>
                                {entry.avatarUrl ? (
                                  <img
                                    src={entry.avatarUrl}
                                    alt={entry.displayName}
                                    className="avatar-xs"
                                  />
                                ) : (
                                  <span className="brand-dot" />
                                )}
                                <strong className="clamp-1">{entry.displayName}</strong>
                                <span className="muted-xs">@{entry.login}</span>
                              </div>
                              <span className="muted-xs">
                                {formatShortDate(entry.at)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="muted-sm">Загружаем статистику...</span>
                )}
              </div>

              <div className="settings-section form-grid">
                <div>
                  <h4>Облачная база данных и резервные копии</h4>
                  <p className="muted-sm">
                    Статус:{' '}
                    <strong>
                      {dataSource === 'remote'
                        ? 'Облачная БД (синхронизировано для всех)'
                        : 'Локальный черновик браузера'}
                    </strong>
                  </p>
                </div>

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
                    {role === 'admin' && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>

                {role === 'admin' &&
                  authStats?.backups &&
                  authStats.backups.length > 0 && (
                    <div>
                      <div className="field-label">
                        <History
                          size={13}
                          style={{ verticalAlign: 'middle', marginRight: 5 }}
                        />
                        Автоматические облачные снимки в Yandex Storage (
                        {authStats.backups.length})
                      </div>
                      <div className="auth-stats-scroll">
                        {authStats.backups.map((b) => (
                          <div key={b.slot} className="auth-stat-row">
                            <div>
                              <strong>Слот #{b.slot + 1}</strong>{' '}
                              <span className="muted-xs">
                                • {formatShortDate(b.savedAt)} • {b.gamesCount} игр /{' '}
                                {b.watchCount} просм.
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              disabled={restoringSlot !== null}
                              onClick={async () => {
                                if (
                                  !confirm(
                                    `Восстановить базу из облачного снимка от ${formatShortDate(
                                      b.savedAt
                                    )} (${b.gamesCount} игр)? Текущее состояние тоже сохранится в соседний слот.`
                                  )
                                ) {
                                  return;
                                }
                                setRestoringSlot(b.slot);
                                const res = await restoreCloudBackupSlot(
                                  b.slot,
                                  user,
                                  apiBaseUrl
                                );
                                setRestoringSlot(null);
                                if (res.error) {
                                  alert(res.error);
                                } else if (res.restored) {
                                  onRestoreCloudBackup(res.restored);
                                  loadAuthStats();
                                }
                              }}
                            >
                              <RotateCcw size={12} />{' '}
                              {restoringSlot === b.slot
                                ? 'Восстановление...'
                                : 'Откатить'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </>
          )}

          {tab === 'credits' && (
            <div className="settings-section form-grid">
              <div className="row-between wrap">
                <h4 style={{ marginBottom: 0 }}>О проекте OniZeD Hub</h4>
                <span className="badge tone-queued">Версия v{APP_VERSION}</span>
              </div>
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
                  <div className="row-gap-xs wrap" style={{ marginTop: 'auto' }}>
                    <a
                      href={data.hubConfig.twitchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-twitch btn-xs"
                    >
                      Twitch <ExternalLink size={12} />
                    </a>
                    <a
                      href="https://t.me/onizedtg"
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-xs"
                    >
                      <Send size={12} /> Telegram
                    </a>
                  </div>
                </div>

                <div className="credit-card">
                  <span className="credit-badge cyan">РАЗРАБОТКА И ДИЗАЙН</span>
                  <strong>ZkeeeRus</strong>
                  <p className="muted-sm">
                    Создатель и главный разработчик OniZeD Hub, архитектура базы, рулетка и функционал портала.
                  </p>
                  <div className="row-gap-xs wrap" style={{ marginTop: 'auto' }}>
                    <a
                      href="https://www.twitch.tv/zkeeerus"
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-twitch btn-xs"
                    >
                      Twitch <ExternalLink size={12} />
                    </a>
                    <a
                      href="https://t.me/ZkeeeRusStream"
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-xs"
                    >
                      <Send size={12} /> Telegram
                    </a>
                  </div>
                </div>
              </div>

              <div className="credit-card friend-project-card">
                <div className="row-between wrap" style={{ width: '100%' }}>
                  <div>
                    <span className="credit-badge amber">ДРУЗЬЯ ПРОЕКТА</span>
                    <strong style={{ marginTop: 5, display: 'block' }}>
                      Проект Sakuya
                    </strong>
                    <p className="muted-sm" style={{ marginTop: 2 }}>
                      Дружественный сайт и быстрый хостинг медиа и картинок наших ребят.
                    </p>
                  </div>
                  <div className="row-gap-xs wrap">
                    <a
                      href="https://sakuya.su/"
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-xs"
                    >
                      sakuya.su <ExternalLink size={12} />
                    </a>
                    <a
                      href="https://lol.sakuya.su/"
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-xs"
                    >
                      lol.sakuya.su <ExternalLink size={12} />
                    </a>
                  </div>
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
