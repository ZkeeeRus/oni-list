import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Settings, Sparkles } from 'lucide-react';
import { isHolidayActive, UserPreferences } from '../utils/preferences';
import { playBellJingle } from '../utils/soundEffects';
import { trackSiteAction } from '../utils/analytics';

/* ---------- Multi-Plane 3D Parallax + Falling Snow Canvas ---------- */
export const SnowAndParallaxLayer: React.FC<{
  prefs: UserPreferences;
}> = ({ prefs }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const farPlaneRef = useRef<HTMLDivElement | null>(null);
  const midPlaneRef = useRef<HTMLDivElement | null>(null);
  const shardsPlaneRef = useRef<HTMLDivElement | null>(null);
  const nearPlaneRef = useRef<HTMLDivElement | null>(null);

  const holiday = isHolidayActive(prefs);
  const showSnow =
    holiday && prefs.snowIntensity !== 'off' && prefs.performanceMode !== 'eco';
  const enableParallax =
    prefs.parallaxEnabled && prefs.performanceMode !== 'eco';

  useEffect(() => {
    if (!enableParallax) {
      if (farPlaneRef.current) farPlaneRef.current.style.transform = 'none';
      if (midPlaneRef.current) midPlaneRef.current.style.transform = 'none';
      if (shardsPlaneRef.current) shardsPlaneRef.current.style.transform = 'none';
      if (nearPlaneRef.current) nearPlaneRef.current.style.transform = 'none';
      return;
    }

    let raf = 0;
    let mx = 0;
    let my = 0;
    let sy = window.scrollY || 0;
    let curMx = 0;
    let curMy = 0;
    let curSy = sy;

    const onMove = (e: MouseEvent) => {
      mx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2; // -1 .. +1
      my = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2; // -1 .. +1
    };

    const onScroll = () => {
      sy = window.scrollY || 0;
    };

    const tick = () => {
      curMx += (mx - curMx) * 0.095;
      curMy += (my - curMy) * 0.095;
      curSy += (sy - curSy) * 0.12;

      // 180px - точный период сетки и звезд plane-far (60px и 180px)
      if (farPlaneRef.current) {
        const fx = curMx * -28;
        const fy = curMy * -22 - ((curSy * 0.18) % 180);
        farPlaneRef.current.style.transform = `translate3d(${fx.toFixed(1)}px, ${fy.toFixed(1)}px, 0)`;
      }
      // 300px - точный период созвездий plane-mid
      if (midPlaneRef.current) {
        const mdx = curMx * -56;
        const mdy = curMy * -44 - ((curSy * 0.36) % 300);
        midPlaneRef.current.style.transform = `translate3d(${mdx.toFixed(1)}px, ${mdy.toFixed(1)}px, 0)`;
      }
      if (shardsPlaneRef.current) {
        const sx = curMx * -78;
        const syShift = curMy * -62 + Math.sin(curSy * 0.003) * 48;
        shardsPlaneRef.current.style.transform = `translate3d(${sx.toFixed(1)}px, ${syShift.toFixed(1)}px, 0)`;
      }
      if (nearPlaneRef.current) {
        const nrx = curMx * -105;
        const nry = curMy * -82 + Math.cos(curSy * 0.0022) * 55;
        nearPlaneRef.current.style.transform = `translate3d(${nrx.toFixed(1)}px, ${nry.toFixed(1)}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [enableParallax]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showSnow) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const isMobile = width < 640;
    const baseCount = prefs.snowIntensity === 'rich' ? 95 : 48;
    const count =
      prefs.performanceMode === 'balanced'
        ? Math.round(baseCount * 0.6)
        : isMobile
          ? Math.round(baseCount * 0.65)
          : baseCount;

    const flakes = Array.from({ length: count }, () => {
      const depth = 0.45 + Math.random() * 1.15;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: (0.9 + Math.random() * 2.1) * depth,
        vy: (0.45 + Math.random() * 0.95) * depth,
        vx: (Math.random() - 0.5) * 0.4,
        depth,
        phase: Math.random() * Math.PI * 2,
        alpha: Math.min(0.85, (0.28 + Math.random() * 0.42) * depth),
      };
    });

    let mouseWind = 0;
    const onMouse = (e: MouseEvent) => {
      if (!enableParallax) return;
      mouseWind = (e.clientX / Math.max(1, width) - 0.5) * 1.35;
    };

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    let rafId = 0;
    const render = () => {
      if (!document.hidden) {
        ctx.clearRect(0, 0, width, height);
        for (const f of flakes) {
          f.phase += 0.015;
          f.y += f.vy;
          f.x += f.vx + Math.sin(f.phase) * 0.3 + mouseWind * f.depth;

          if (f.y > height + 8) {
            f.y = -8;
            f.x = Math.random() * width;
          }
          if (f.x > width + 8) f.x = -8;
          if (f.x < -8) f.x = width + 8;

          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(241, 245, 249, ${f.alpha})`;
          ctx.fill();
        }
      }
      rafId = requestAnimationFrame(render);
    };

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('mousemove', onMouse, { passive: true });
    rafId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouse);
      cancelAnimationFrame(rafId);
    };
  }, [showSnow, prefs.snowIntensity, prefs.performanceMode, enableParallax]);

  return (
    <>
      {enableParallax && (
        <div className="parallax-scene" aria-hidden="true">
          {/* Дальний план: кибер-сетка и дальние звезды */}
          <div className="parallax-plane plane-far" ref={farPlaneRef} />
          {/* Средний план: яркие созвездия */}
          <div className="parallax-plane plane-mid" ref={midPlaneRef} />
          {/* Плавающие неоновые фигуры */}
          <div className="parallax-plane plane-shards" ref={shardsPlaneRef}>
            <span className="p-shard s1" />
            <span className="p-shard s2" />
            <span className="p-shard s3" />
            <span className="p-shard s4" />
            <span className="p-shard s5" />
            <span className="p-shard s6" />
          </div>
          {/* Ближний план: объемные световые пятна */}
          <div className="parallax-plane plane-near" ref={nearPlaneRef}>
            <span className="orb orb-1" />
            <span className="orb orb-2" />
            <span className="orb orb-3" />
          </div>
        </div>
      )}
      {showSnow && (
        <canvas
          ref={canvasRef}
          className="snow-overlay-canvas"
          aria-hidden="true"
        />
      )}
    </>
  );
};

/* ---------- Header Holiday Garland ---------- */
const BULB_COLORS = ['#fbbf24', '#f43f5e', '#38bdf8', '#34d399', '#c084fc'];

export const HeaderGarland: React.FC<{
  prefs: UserPreferences;
}> = ({ prefs }) => {
  const [flash, setFlash] = useState(false);
  const holiday = isHolidayActive(prefs);
  if (!holiday || !prefs.garlandEnabled) return null;

  const bulbs = Array.from({ length: 22 }, (_, i) => ({
    idx: i,
    color: BULB_COLORS[i % BULB_COLORS.length],
    delay: `${(i % 5) * 0.35}s`,
  }));

  return (
    <div
      className={`header-garland ${flash ? 'garland-flash' : ''}`}
      onClick={() => {
        playBellJingle(prefs);
        setFlash(true);
        setTimeout(() => setFlash(false), 900);
      }}
      title="Новогодняя гирлянда (нажми!)"
    >
      <div className="garland-bulbs-row">
        {bulbs.map((b) => (
          <span
            key={b.idx}
            className="garland-bulb-unit"
            style={
              {
                '--bulb-color': b.color,
                animationDelay: b.delay,
              } as React.CSSProperties
            }
          >
            <i className="bulb-cap" />
            <b className="bulb-glass" />
          </span>
        ))}
      </div>
    </div>
  );
};

/* ---------- Site Footer with Snowdrifts, Christmas Tree & Credits ---------- */
const TREE_WISHES = [
  'С наступающим! Пусть в рулетке выпадают только шедевры без тех-дропов!',
  'Новогоднего вайба чату OniZeD и годных заказов на стримах!',
  'Елочка зажглась! +100 к удаче на следующем прокруте рулетки!',
  'Теплых зимних стримов, топовых прохождений и вкусного чая!',
];

export const FestiveFooter: React.FC<{
  prefs: UserPreferences;
  twitchUrl: string;
  vodUrl: string;
  onOpenSettings: () => void;
  onShowWish: (msg: string) => void;
}> = ({ prefs, twitchUrl, vodUrl, onOpenSettings, onShowWish }) => {
  const [treeLit, setTreeLit] = useState(false);
  const holiday = isHolidayActive(prefs);
  const showWinter = holiday && prefs.footerTreeEnabled;

  const handleTreeClick = () => {
    playBellJingle(prefs);
    trackSiteAction('tree_click');
    setTreeLit(true);
    const wish = TREE_WISHES[Math.floor(Math.random() * TREE_WISHES.length)];
    onShowWish(wish);
    setTimeout(() => setTreeLit(false), 1600);
  };

  return (
    <footer className={`site-footer ${showWinter ? 'with-snow' : ''}`}>
      {showWinter && (
        <div className="footer-snow-scene">
          <svg
            className="snowdrift-svg"
            viewBox="0 0 1440 84"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0,48 C220,14 420,72 680,38 C940,4 1180,68 1440,30 L1440,84 L0,84 Z"
              className="snow-layer-back"
            />
            <path
              d="M0,62 C180,34 390,78 640,52 C910,24 1190,74 1440,48 L1440,84 L0,84 Z"
              className="snow-layer-front"
            />
          </svg>

          <button
            type="button"
            className={`christmas-tree-btn ${treeLit ? 'lit' : ''}`}
            onClick={handleTreeClick}
            title="Нажми на новогоднюю елочку!"
          >
            <svg viewBox="0 0 96 116" width="76" height="92" aria-label="Новогодняя елочка">
              <rect x="41" y="92" width="14" height="16" rx="3" fill="#78350f" />
              <rect x="20" y="96" width="16" height="13" rx="2" fill="#e11d48" />
              <rect x="27" y="96" width="2.5" height="13" fill="#fde047" />
              <rect x="61" y="98" width="15" height="11" rx="2" fill="#7c3aed" />
              <rect x="67.5" y="98" width="2.5" height="11" fill="#67e8f9" />
              <polygon points="48,46 14,94 82,94" fill="#047857" />
              <polygon points="48,30 20,72 76,72" fill="#059669" />
              <polygon points="48,14 27,50 69,50" fill="#10b981" />
              <path d="M36,36 Q48,42 60,36" stroke="#e2e8f0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M28,58 Q48,66 68,58" stroke="#e2e8f0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M21,82 Q48,91 75,82" stroke="#e2e8f0" strokeWidth="3" fill="none" strokeLinecap="round" />
              <circle cx="40" cy="43" r="3.5" className="tree-bauble b1" fill="#fbbf24" />
              <circle cx="56" cy="46" r="3.2" className="tree-bauble b2" fill="#f43f5e" />
              <circle cx="34" cy="64" r="3.8" className="tree-bauble b3" fill="#38bdf8" />
              <circle cx="51" cy="62" r="3.4" className="tree-bauble b4" fill="#c084fc" />
              <circle cx="62" cy="67" r="3.5" className="tree-bauble b1" fill="#fbbf24" />
              <circle cx="29" cy="84" r="4" className="tree-bauble b2" fill="#f43f5e" />
              <circle cx="48" cy="82" r="3.8" className="tree-bauble b3" fill="#38bdf8" />
              <circle cx="66" cy="85" r="3.8" className="tree-bauble b4" fill="#fde047" />
              <polygon
                points="48,2 51,9 59,9 52.5,14 55,21 48,16.5 41,21 43.5,14 37,9 45,9"
                className="tree-star"
                fill="#fde047"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="footer-inner">
        <div className="footer-brand-col">
          <div className="row-gap-xs">
            <span className="brand-dot" />
            <strong>OniZeD Hub</strong>
            {holiday && <span className="winter-pill">❄ Зимний сезон</span>}
          </div>
          <p className="muted-xs">
            Портал заказов, прохождений, просмотрового и тир-листов канала Дена (
            <strong>OniZeD</strong>) • Разработка: <strong>ZkeeeRus</strong>
          </p>
        </div>

        <div className="row-gap-sm wrap">
          <a
            href={twitchUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-xs"
          >
            Twitch <ExternalLink size={12} />
          </a>
          <a
            href={vodUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-xs"
          >
            Архив VOD <ExternalLink size={12} />
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onOpenSettings}
          >
            <Settings size={13} /> Оформление и настройки
          </button>
          {showWinter && (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={handleTreeClick}
            >
              <Sparkles size={13} /> Зажечь елочку
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
