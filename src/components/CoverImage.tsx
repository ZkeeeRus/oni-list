import React, { useEffect, useMemo, useState } from 'react';
import { buildCoverCandidatesChain } from '../utils/covers';

interface CoverImageProps {
  title: string;
  coverUrl?: string;
  steamAppId?: number | null;
  badgeText?: string;
  className?: string;
  aspect?: 'portrait' | 'wide' | 'square';
}

const PALETTES = [
  ['#4c1d95', '#7c3aed'],
  ['#1e3a8a', '#2563eb'],
  ['#065f46', '#10b981'],
  ['#831843', '#db2777'],
  ['#78350f', '#d97706'],
  ['#1f2937', '#4b5563'],
];

function hashTitle(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export const CoverImage: React.FC<CoverImageProps> = ({
  title,
  coverUrl,
  steamAppId,
  badgeText,
  className = '',
  aspect = 'portrait',
}) => {
  const candidates = useMemo(
    () => buildCoverCandidatesChain(coverUrl, steamAppId),
    [coverUrl, steamAppId]
  );
  const [idx, setIdx] = useState(0);
  const [failedAll, setFailedAll] = useState(candidates.length === 0);

  useEffect(() => {
    setIdx(0);
    setFailedAll(candidates.length === 0);
  }, [candidates]);

  const [c1, c2] = PALETTES[hashTitle(title) % PALETTES.length];
  const aspectClass =
    aspect === 'wide' ? 'cover-wide' : aspect === 'square' ? 'cover-square' : 'cover-portrait';

  if (failedAll || idx >= candidates.length) {
    return (
      <div
        className={`cover-fallback ${aspectClass} ${className}`}
        style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}
      >
        <span className="cover-fallback-title">{title}</span>
        {badgeText && <span className="cover-badge">{badgeText}</span>}
      </div>
    );
  }

  return (
    <div className={`cover-wrap ${aspectClass} ${className}`}>
      <img
        src={candidates[idx]}
        alt={title}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          if (idx + 1 < candidates.length) {
            setIdx(idx + 1);
          } else {
            setFailedAll(true);
          }
        }}
      />
      {badgeText && <span className="cover-badge">{badgeText}</span>}
    </div>
  );
};
