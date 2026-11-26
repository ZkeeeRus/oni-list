import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const activeSrc =
    failedAll || idx >= candidates.length ? DEFAULT_COVER_URL : candidates[idx];

  useEffect(() => {
    setIdx(0);
    setFailedAll(candidates.length === 0);
  }, [candidates]);

  useEffect(() => {
    if (activeSrc.startsWith('data:')) {
      setLoaded(true);
      return;
    }
    setLoaded(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [activeSrc]);

  const aspectClass =
    aspect === 'wide'
      ? 'cover-wide'
      : aspect === 'square'
        ? 'cover-square'
        : 'cover-portrait';

  const isFallback = failedAll || idx >= candidates.length;

  return (
    <div className={`cover-wrap ${aspectClass} ${className}`}>
      {!loaded && (
        <div className="img-loading-overlay" aria-hidden="true">
          <span className="img-loading-dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}
      <img
        ref={imgRef}
        src={activeSrc}
        alt={title}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={loaded ? 'cover-img-loaded' : 'cover-img-loading'}
        style={
          isFallback && aspect === 'wide'
            ? { objectFit: 'contain', background: '#110e1b' }
            : undefined
        }
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!isFallback) {
            if (idx + 1 < candidates.length) {
              setIdx(idx + 1);
            } else {
              setFailedAll(true);
            }
          } else {
            setLoaded(true);
          }
        }}
      />
      {badgeText && <span className="cover-badge">{badgeText}</span>}
    </div>
  );
};
