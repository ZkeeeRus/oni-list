import React from 'react';
import { Cookie } from 'lucide-react';
import { CookieConsentState } from '../utils/analytics';

export const CookieBanner: React.FC<{
  consent: CookieConsentState;
  onDecide: (choice: 'accepted' | 'essential') => void;
}> = ({ consent, onDecide }) => {
  if (consent !== null) return null;

  return (
    <div className="cookie-banner" role="region" aria-label="Настройки cookie">
      <div className="cookie-banner-head">
        <Cookie size={17} className="cookie-icon" />
        <strong>Файлы cookie и анонимная статистика</strong>
      </div>
      <p className="muted-xs">
        Мы используем технические cookie (для темы оформления и входа через Twitch), а с твоего согласия - анонимный счетчик посещений и популярных вкладок без сбора личных данных и IP.
      </p>
      <div className="row-gap-xs wrap" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-primary btn-xs"
          onClick={() => onDecide('accepted')}
        >
          Принять все
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={() => onDecide('essential')}
        >
          Только необходимые
        </button>
      </div>
    </div>
  );
};
