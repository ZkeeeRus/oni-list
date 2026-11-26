import React, { useEffect, useMemo, useState } from 'react';
import { buildCoverCandidatesChain } from '../utils/covers';
import { DEFAULT_COVER_URL } from '../utils/defaultCover';

interface CoverImageProps {
  title: string;
  coverUrl?: string;
  steamAppId?: number | null;
  badgeText?: string;
  className?: string;
  aspect?: 'portrait' | 'wide' | 'square';
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

  const aspectClass =
    aspect === 'wide'
      ? 'cover-wide'
      : aspect === 'square'
        ? 'cover-square'
        : 'cover-portrait';

  if (failedAll || idx >= candidates.length) {
    return (
      <div className={`cover-wrap ${aspectClass} ${className}`}>
        <img
          src={DEFAULT_COVER_URL}
          alt={title}
          style={
            aspect === 'wide'
              ? { objectFit: 'contain', background: '#110e1b' }
              : undefined
          }
        />
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
