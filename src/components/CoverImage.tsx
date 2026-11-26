import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
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

// Кэш уже загруженных обложек за сессию - повторный рендер идет мгновенно без анимации точек
const loadedUrlsCache = new Set<string>();

// Единый общий IntersectionObserver на все карточки вместо сотен отдельных подписок
type RevealCallback = () => void;
let sharedObserver: IntersectionObserver | null = null;
const observerCallbacks = new WeakMap<Element, RevealCallback>();

function observeOnceInViewport(el: Element, onReveal: RevealCallback): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    onReveal();
    return () => {};
  }
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            const cb = observerCallbacks.get(entry.target);
            if (cb) {
              observerCallbacks.delete(entry.target);
              sharedObserver?.unobserve(entry.target);
              cb();
            }
          }
        }
      },
      { rootMargin: '340px 0px' }
    );
  }
  observerCallbacks.set(el, onReveal);
  sharedObserver.observe(el);
  return () => {
    observerCallbacks.delete(el);
    sharedObserver?.unobserve(el);
  };
}

export const CoverImage: React.FC<CoverImageProps> = memo(
  ({
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

    const activeSrc =
      failedAll || idx >= candidates.length ? DEFAULT_COVER_URL : candidates[idx];

    const isAlreadyCached =
      activeSrc.startsWith('data:') || loadedUrlsCache.has(activeSrc);

    const [inView, setInView] = useState(isAlreadyCached);
    const [loaded, setLoaded] = useState(isAlreadyCached);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
      setIdx(0);
      setFailedAll(candidates.length === 0);
    }, [candidates]);

    useEffect(() => {
      if (inView) return;
      const node = wrapRef.current;
      if (!node) return;
      return observeOnceInViewport(node, () => setInView(true));
    }, [inView]);

    useEffect(() => {
      if (activeSrc.startsWith('data:') || loadedUrlsCache.has(activeSrc)) {
        setLoaded(true);
        return;
      }
      setLoaded(false);
      if (
        imgRef.current &&
        imgRef.current.complete &&
        imgRef.current.naturalWidth > 0
      ) {
        loadedUrlsCache.add(activeSrc);
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
      <div ref={wrapRef} className={`cover-wrap ${aspectClass} ${className}`}>
        {inView && !loaded && (
          <div className="img-loading-overlay" aria-hidden="true">
            <span className="img-loading-dots">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        {inView && (
          <img
            ref={imgRef}
            src={activeSrc}
            alt={title}
            decoding="async"
            referrerPolicy="no-referrer"
            className={loaded ? 'cover-img-loaded' : 'cover-img-loading'}
            style={
              isFallback && aspect === 'wide'
                ? { objectFit: 'contain', background: '#110e1b' }
                : undefined
            }
            onLoad={() => {
              loadedUrlsCache.add(activeSrc);
              setLoaded(true);
            }}
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
        )}
        {badgeText && <span className="cover-badge">{badgeText}</span>}
      </div>
    );
  }
);
