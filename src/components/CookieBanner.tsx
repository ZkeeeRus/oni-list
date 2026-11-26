import React from 'react';
import { Cookie, SlidersHorizontal } from 'lucide-react';
import {
  PRIVACY_ACCEPT_ALL,
  PRIVACY_ESSENTIAL_ONLY,
  TelemetryPrivacyPrefs,
} from '../utils/analytics';

export const CookieBanner: React.FC<{
  privacy: TelemetryPrivacyPrefs;
  onApply: (next: TelemetryPrivacyPrefs) => void;
  onOpenCustomize: () => void;
}> = ({ privacy, onApply, onOpenCustomize }) => {
  if (privacy.decided) return null;

  return (
    <div className="cookie-banner" role="region" aria-label="Настройки cookie">
      <div className="cookie-banner-head">
        <Cookie size={17} className="cookie-icon" />
        <strong>Файлы cookie и статистика</strong>
      </div>
      <p className="muted-xs">
        Мы используем технические cookie (для темы и входа через Twitch), а по твоему выбору - анонимную статистику посещений и популярных разделов без сбора IP и личных данных.
      </p>
      <div className="row-gap-xs wrap" style={{ marginTop: 9 }}>
        <button
          type="button"
          className="btn btn-primary btn-xs"
          onClick={() => onApply(PRIVACY_ACCEPT_ALL)}
        >
          Принять все
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={() => onApply(PRIVACY_ESSENTIAL_ONLY)}
        >
          Только необходимые
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onOpenCustomize}
        >
          <SlidersHorizontal size={12} /> Настроить
        </button>
      </div>
    </div>
  );
};
