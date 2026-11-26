import React, { memo, useEffect, useRef, useState } from 'react';
import { isHolidayActive, UserPreferences } from '../utils/preferences';
import {
  playBellJingle,
  playGarlandShatter,
  playGarlandSpark,
} from '../utils/soundEffects';
import { trackSiteAction } from '../utils/analytics';

/* ---------- Новогодние векторные рисунки для параллакса ---------- */
const WinterParallaxDrawings: React.FC = () => (
  <>
    {/* 1. Крупная ажурная снежинка */}
    <svg className="winter-fig wf-1" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M32 6v52M9.5 19l45 26M54.5 19l-45 26" />
      <path d="M26 12l6 6 6-6M26 52l6-6 6 6M13 27l7-2-2-7M51 37l-7 2 2 7M49 20l-5 5 7 2M15 44l5-5-7-2" />
      <circle cx="32" cy="32" r="5" />
    </svg>

    {/* 2. Абстрактная неоновая елочка со звездой */}
    <svg className="winter-fig wf-2" viewBox="0 0 64 72" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="32,6 34.5,12 41,12 36,16 38,22 32,18.5 26,22 28,16 23,12 29.5,12" stroke="#fde047" />
      <path d="M32 20L17 39h30L32 20z" />
      <path d="M32 33L13 54h38L32 33z" />
      <path d="M28 54v10h8V54" stroke="#fbbf24" />
      <circle cx="26" cy="36" r="1.8" fill="#f43f5e" stroke="none" />
      <circle cx="38" cy="48" r="2" fill="#38bdf8" stroke="none" />
      <circle cx="24" cy="49" r="1.8" fill="#fde047" stroke="none" />
    </svg>

    {/* 3. Подарок с лентой и бантом */}
    <svg className="winter-fig wf-3" viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="10" y="24" width="40" height="28" rx="4" />
      <rect x="7" y="17" width="46" height="8" rx="3" />
      <path d="M30 17v35M10 36h40" stroke="#fde047" />
      <path d="M30 17c-5-8-14-7-13-1s7 3 13 1zm0 0c5-8 14-7 13-1s-7 3-13 1z" stroke="#fde047" />
    </svg>

    {/* 4. Новогодний леденец-трость */}
    <svg className="winter-fig wf-4" viewBox="0 0 56 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M20 24a11 11 0 0 1 22 0v30a4.5 4.5 0 0 1-9 0V24a2 2 0 0 0-4 0v2a4.5 4.5 0 0 1-9 0v-2z" />
      <path d="M33 15l7 5M33 27l9 6M33 39l9 6" stroke="#fda4af" />
    </svg>

    {/* 5. Елочный шар с узором */}
    <svg className="winter-fig wf-5" viewBox="0 0 60 68" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M26 10h8v6h-8z" stroke="#fde047" />
      <path d="M30 4a3 3 0 0 1 3 3v3h-6V7a3 3 0 0 1 3-3z" stroke="#fde047" />
      <circle cx="30" cy="38" r="21" />
      <path d="M11 33q9.5 7 19 0t19 0" stroke="#fde047" />
      <path d="M12 44q9 6 18 0t18 0" opacity="0.7" />
    </svg>

    {/* 6. Вторая малая снежинка */}
    <svg className="winter-fig wf-6" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M28 6v44M9 17l38 22M47 17L9 39" />
      <polygon points="28,18 36,23 36,33 28,38 20,33 20,23" opacity="0.75" />
    </svg>

    {/* 7. Второй подарок */}
    <svg className="winter-fig wf-7" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="11" y="22" width="34" height="25" rx="3.5" />
      <rect x="8" y="16" width="40" height="7" rx="2.5" />
      <path d="M28 16v31" stroke="#67e8f9" />
      <path d="M28 16c-4-6-11-5-10 0s6 2 10 0zm0 0c4-6 11-5 10 0s-6 2-10 0z" stroke="#67e8f9" />
    </svg>

    {/* 8. Рождественская восьмилучевая звезда */}
    <svg className="winter-fig wf-8" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="28,4 32,22 50,28 32,34 28,52 24,34 6,28 24,22" />
      <line x1="15" y1="15" x2="41" y2="41" opacity="0.6" />
      <line x1="41" y1="15" x2="15" y2="41" opacity="0.6" />
    </svg>
  </>
);

/* ---------- Multi-Plane 3D Parallax + Custom Wallpaper + Falling Snow ---------- */
export const SnowAndParallaxLayer: React.FC<{
  prefs: UserPreferences;
  customWallpaperUrl?: string;
}> = memo(({ prefs, customWallpaperUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wallpaperRef = useRef<HTMLDivElement | null>(null);
  const farPlaneRef = useRef<HTMLDivElement | null>(null);
  const midPlaneRef = useRef<HTMLDivElement | null>(null);
  const shardsPlaneRef = useRef<HTMLDivElement | null>(null);
  const nearPlaneRef = useRef<HTMLDivElement | null>(null);

  const holiday = isHolidayActive(prefs);
  const showSnow =
    holiday && prefs.snowIntensity !== 'off' && prefs.performanceMode !== 'eco';
  const enableParallax =
    prefs.parallaxEnabled && prefs.performanceMode !== 'eco';

  const hasCustomBg =
    prefs.bgStyle === 'custom' && Boolean(customWallpaperUrl?.trim());
  const showScene = prefs.bgStyle !== 'minimal';
  const showWinterDrawings = holiday && prefs.festiveShapes === 'winter';
  const showAbstractShards =
    prefs.bgStyle !== 'minimal' &&
    (!holiday || prefs.festiveShapes === 'abstract');

  useEffect(() => {
    if (!enableParallax) {
      if (wallpaperRef.current) wallpaperRef.current.style.transform = 'scale(1.04)';
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

    const applyTransforms = () => {
      if (wallpaperRef.current) {
        const wx = curMx * -18;
        const wy = curMy * -14;
        wallpaperRef.current.style.transform = `translate3d(${wx.toFixed(1)}px, ${wy.toFixed(1)}px, 0) scale(1.06)`;
      }
      if (farPlaneRef.current) {
        const fx = curMx * -24;
        const fy = curMy * -18 - ((curSy * 0.14) % 180);
        farPlaneRef.current.style.transform = `translate3d(${fx.toFixed(1)}px, ${fy.toFixed(1)}px, 0)`;
      }
      if (midPlaneRef.current) {
        const mdx = curMx * -46;
        const mdy = curMy * -36 - ((curSy * 0.28) % 300);
        midPlaneRef.current.style.transform = `translate3d(${mdx.toFixed(1)}px, ${mdy.toFixed(1)}px, 0)`;
      }
      if (shardsPlaneRef.current) {
        const sx = curMx * -68;
        const syShift = curMy * -52 + Math.sin(curSy * 0.0025) * 40;
        shardsPlaneRef.current.style.transform = `translate3d(${sx.toFixed(1)}px, ${syShift.toFixed(1)}px, 0)`;
      }
      if (nearPlaneRef.current) {
        const nrx = curMx * -86;
        const nry = curMy * -66 + Math.cos(curSy * 0.002) * 44;
        nearPlaneRef.current.style.transform = `translate3d(${nrx.toFixed(1)}px, ${nry.toFixed(1)}px, 0)`;
      }
    };

    const tick = () => {
      if (document.hidden) {
        raf = 0;
        return;
      }
      const dx = mx - curMx;
      const dy = my - curMy;
      const ds = sy - curSy;

      if (
        Math.abs(dx) < 0.0015 &&
        Math.abs(dy) < 0.0015 &&
        Math.abs(ds) < 0.25
      ) {
        curMx = mx;
        curMy = my;
        curSy = sy;
        applyTransforms();
        raf = 0; // Засыпаем при покое - 0% нагрузки на CPU/GPU
        return;
      }

      curMx += dx * 0.11;
      curMy += dy * 0.11;
      curSy += ds * 0.14;
      applyTransforms();
      raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (!raf && !document.hidden) {
        raf = requestAnimationFrame(tick);
      }
    };

    const onMove = (e: MouseEvent) => {
      mx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      my = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
      wake();
    };

    const onScroll = () => {
      sy = window.scrollY || 0;
      wake();
    };

    applyTransforms();
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enableParallax, prefs.bgStyle, hasCustomBg]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showSnow) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const isMobile = width < 640;
    const baseCount = prefs.snowIntensity === 'rich' ? 78 : 42;
    const count =
      prefs.performanceMode === 'balanced'
        ? Math.round(baseCount * 0.55)
        : isMobile
          ? Math.round(baseCount * 0.6)
          : baseCount;

    const isLight = prefs.colorMode === 'light';
    const fillFar = isLight
      ? 'rgba(148, 163, 184, 0.36)'
      : 'rgba(241, 245, 249, 0.42)';
    const fillNear = isLight
      ? 'rgba(100, 116, 139, 0.62)'
      : 'rgba(248, 250, 252, 0.78)';

    const flakes = Array.from({ length: count }, (_, idx) => {
      const near = idx % 3 === 0;
      const depth = near ? 1.05 + Math.random() * 0.45 : 0.48 + Math.random() * 0.5;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: (0.9 + Math.random() * 1.9) * depth,
        vy: (0.45 + Math.random() * 0.9) * depth,
        vx: (Math.random() - 0.5) * 0.38,
        depth,
        near,
        phase: Math.random() * Math.PI * 2,
      };
    });

    let mouseWind = 0;
    const onMouse = (e: MouseEvent) => {
      if (!enableParallax) return;
      mouseWind = (e.clientX / Math.max(1, width) - 0.5) * 1.25;
    };

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    let rafId = 0;
    let lastTs = 0;
    const FRAME_MIN_MS = 25; // ~40 FPS лимит (экономит 3-6x ресурсов на 144/240 Гц мониторах)

    const render = (ts: number) => {
      rafId = requestAnimationFrame(render);
      if (document.hidden) return;
      if (ts - lastTs < FRAME_MIN_MS) return;

      const dtScale = lastTs > 0 ? Math.min(2.2, (ts - lastTs) / 16.67) : 1;
      lastTs = ts;

      ctx.clearRect(0, 0, width, height);

      // Батчинг всех снежинок всего в 2 вызова ctx.fill() за кадр
      ctx.fillStyle = fillFar;
      ctx.beginPath();
      for (const f of flakes) {
        f.phase += 0.015 * dtScale;
        f.y += f.vy * dtScale;
        f.x += (f.vx + Math.sin(f.phase) * 0.28 + mouseWind * f.depth) * dtScale;

        if (f.y > height + 8) {
          f.y = -8;
          f.x = Math.random() * width;
        }
        if (f.x > width + 8) f.x = -8;
        if (f.x < -8) f.x = width + 8;

        if (!f.near) {
          ctx.moveTo(f.x + f.r, f.y);
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      ctx.fillStyle = fillNear;
      ctx.beginPath();
      for (const f of flakes) {
        if (f.near) {
          ctx.moveTo(f.x + f.r, f.y);
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    };

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('mousemove', onMouse, { passive: true });
    rafId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouse);
      cancelAnimationFrame(rafId);
    };
  }, [
    showSnow,
    prefs.snowIntensity,
    prefs.performanceMode,
    prefs.colorMode,
    enableParallax,
  ]);

  return (
    <>
      {hasCustomBg && (
        <div className="custom-wallpaper-wrap" aria-hidden="true">
          <div
            ref={wallpaperRef}
            className="custom-wallpaper-img"
            style={{
              backgroundImage: `url("${customWallpaperUrl}")`,
              filter:
                prefs.customBgBlur > 0 ? `blur(${prefs.customBgBlur}px)` : 'none',
            }}
          />
          <div
            className="custom-wallpaper-dim"
            style={{ opacity: prefs.customBgDimming }}
          />
        </div>
      )}

      {showScene && prefs.performanceMode !== 'eco' && (
        <div
          className={`parallax-scene bg-variant-${prefs.bgStyle}`}
          aria-hidden="true"
        >
          {prefs.bgStyle === 'stars' && (
            <div className="parallax-plane plane-far" ref={farPlaneRef} />
          )}
          {prefs.bgStyle === 'aurora' && (
            <div className="parallax-plane plane-aurora" ref={farPlaneRef} />
          )}
          {prefs.bgStyle !== 'custom' && (
            <div className="parallax-plane plane-mid" ref={midPlaneRef} />
          )}

          {(showWinterDrawings || showAbstractShards) && (
            <div className="parallax-plane plane-shards" ref={shardsPlaneRef}>
              {showWinterDrawings ? (
                <WinterParallaxDrawings />
              ) : (
                <>
                  <span className="p-shard s1" />
                  <span className="p-shard s2" />
                  <span className="p-shard s3" />
                  <span className="p-shard s4" />
                  <span className="p-shard s5" />
                  <span className="p-shard s6" />
                </>
              )}
            </div>
          )}

          {prefs.bgStyle !== 'custom' && (
            <div className="parallax-plane plane-near" ref={nearPlaneRef}>
              <span className="orb orb-1" />
              <span className="orb orb-2" />
              <span className="orb orb-3" />
            </div>
          )}
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
});

/* ---------- Свисающая новогодняя гирлянда под шапкой с игрушками и хвойными дугами ---------- */
const BULB_COLORS = ['#fbbf24', '#f43f5e', '#38bdf8', '#34d399', '#c084fc'];
const SWAG_COUNT = 4;
const BULBS_PER_SWAG = 6;
const CTRL_Y_DELTA = 36; // Провисание кривой Безье (в нижней точке ~20px ниже шапки)

const SPARK_RAYS = [
  { dx: '-18px', dy: '-14px', rot: '-38deg' },
  { dx: '19px', dy: '-13px', rot: '35deg' },
  { dx: '-22px', dy: '9px', rot: '-155deg' },
  { dx: '21px', dy: '11px', rot: '150deg' },
  { dx: '-5px', dy: '20px', rot: '-96deg' },
  { dx: '8px', dy: '-20px', rot: '78deg' },
];

export const HeaderGarland: React.FC<{
  prefs: UserPreferences;
  onUpdatePrefs: (next: UserPreferences) => void;
}> = memo(({ prefs, onUpdatePrefs }) => {
  const [flash, setFlash] = useState(false);
  const [shattering, setShattering] = useState(false);
  const [sparks, setSparks] = useState<
    Array<{ id: number; leftPct: number; topPx: number }>
  >([]);
  const drapeRef = useRef<HTMLDivElement | null>(null);
  const rapidClicksRef = useRef<number[]>([]);
  const sparkIdRef = useRef(1);

  const holiday = isHolidayActive(prefs);
  if (!holiday || !prefs.garlandEnabled) return null;

  const isBroken = Boolean(prefs.garlandBroken);

  const spawnSparkAt = (leftPct: number, topPx: number) => {
    const id = sparkIdRef.current++;
    setSparks((prev) => [...prev.slice(-10), { id, leftPct, topPx }]);
    window.setTimeout(() => {
      setSparks((prev) => prev.filter((s) => s.id !== id));
    }, 460);
  };

  const handleGarlandClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = drapeRef.current?.getBoundingClientRect();
    let clickPct = 50;
    if (rect && rect.width > 0) {
      clickPct = Math.max(
        2,
        Math.min(98, ((e.clientX - rect.left) / rect.width) * 100)
      );
    }
    // Вычисляем точный Y на провисающей дуге для искры
    const swagLocalT = ((clickPct / 100) * SWAG_COUNT) % 1;
    const wireY = 2 + 2 * swagLocalT * (1 - swagLocalT) * CTRL_Y_DELTA;

    if (isBroken) {
      playGarlandSpark(prefs);
      spawnSparkAt(clickPct, wireY + 4);
      return;
    }

    const now = performance.now();
    const recent = rapidClicksRef.current.filter((t) => now - t < 2600);
    recent.push(now);
    rapidClicksRef.current = recent;

    // 7 быстрых кликов подряд - гирлянда лопается и перегорает!
    if (recent.length >= 7) {
      rapidClicksRef.current = [];
      playGarlandShatter(prefs);
      setShattering(true);
      window.setTimeout(() => setShattering(false), 800);
      [14, 32, 50, 68, 86].forEach((pct, i) => {
        const lt = ((pct / 100) * SWAG_COUNT) % 1;
        const wy = 2 + 2 * lt * (1 - lt) * CTRL_Y_DELTA;
        window.setTimeout(() => spawnSparkAt(pct, wy + 4), i * 45);
      });
      onUpdatePrefs({ ...prefs, garlandBroken: true });
      return;
    }

    playBellJingle(prefs);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 750);
  };

  const bulbs: Array<{
    key: string;
    leftPct: number;
    topPx: number;
    tiltDeg: number;
    color: string;
    delay: string;
  }> = [];

  for (let s = 0; s < SWAG_COUNT; s++) {
    for (let k = 1; k <= BULBS_PER_SWAG; k++) {
      const t = k / (BULBS_PER_SWAG + 1);
      const leftPct = ((s + t) / SWAG_COUNT) * 100;
      const topPx = 2 + 2 * t * (1 - t) * CTRL_Y_DELTA;
      const tiltDeg = (0.5 - t) * 26;
      const idx = s * BULBS_PER_SWAG + k;
      bulbs.push({
        key: `${s}-${k}`,
        leftPct,
        topPx,
        tiltDeg,
        color: BULB_COLORS[idx % BULB_COLORS.length],
        delay: `${((idx * 3) % 7) * 0.28}s`,
      });
    }
  }

  const clasps = [
    { pct: 0.8, kind: 'bow' },
    { pct: 25, kind: 'star' },
    { pct: 50, kind: 'bauble' },
    { pct: 75, kind: 'flake' },
    { pct: 99.2, kind: 'bow' },
  ];

  return (
    <div
      ref={drapeRef}
      className={`header-garland-drape ${flash ? 'garland-flash' : ''} ${
        isBroken ? 'is-broken' : ''
      } ${shattering ? 'is-shattering' : ''}`}
      onClick={handleGarlandClick}
    >
      {/* Провисающие провода с хвойной мишурой */}
      <svg
        className="garland-wire-svg"
        viewBox="0 0 1200 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,2 Q150,38 300,2 Q450,38 600,2 Q750,38 900,2 Q1050,38 1200,2"
          className="garland-hit-stroke"
        />
        <path
          d="M0,2 Q150,38 300,2 Q450,38 600,2 Q750,38 900,2 Q1050,38 1200,2"
          className="garland-pine-glow"
        />
        <path
          d="M0,2 Q150,38 300,2 Q450,38 600,2 Q750,38 900,2 Q1050,38 1200,2"
          className="garland-wire-line"
        />
      </svg>

      {/* Свисающие огоньки вдоль дуг (целые либо лопнувшие осколки) */}
      {bulbs.map((b) => (
        <span
          key={b.key}
          className="garland-drape-bulb"
          style={
            {
              left: `${b.leftPct}%`,
              top: `${b.topPx}px`,
              '--bulb-tilt': `${b.tiltDeg.toFixed(1)}deg`,
              '--bulb-color': b.color,
              animationDelay: b.delay,
            } as React.CSSProperties
          }
        >
          <i className="bulb-cap" />
          <b className="bulb-glass" />
        </span>
      ))}

      {/* Узлы крепления с бантиками и свисающими подвесками */}
      {clasps.map((c, idx) => (
        <span
          key={idx}
          className={`garland-clasp kind-${c.kind}`}
          style={{ left: `${c.pct}%` }}
          aria-hidden="true"
        >
          <i className="clasp-knot" />
          {c.kind === 'star' && <span className="dangling-charm star">★</span>}
          {c.kind === 'bauble' && <span className="dangling-charm bauble" />}
          {c.kind === 'flake' && <span className="dangling-charm flake">❄</span>}
        </span>
      ))}

      {/* Одиночные вспышки искр при клике по сломанной гирлянде */}
      {sparks.map((sp) => (
        <span
          key={sp.id}
          className="garland-spark-burst"
          style={{ left: `${sp.leftPct}%`, top: `${sp.topPx}px` }}
          aria-hidden="true"
        >
          {SPARK_RAYS.map((r, rIdx) => (
            <i
              key={rIdx}
              className="garland-spark-ray"
              style={
                {
                  '--sx': r.dx,
                  '--sy': r.dy,
                  '--srot': r.rot,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      ))}
    </div>
  );
});

/* ---------- Компактный футер с сугробами, елочкой и ненавязчивыми ссылками ---------- */
const TREE_WISHES = [
  'С наступающим! Пусть в рулетке выпадают только шедевры без тех-дропов!',
  'Новогоднего вайба чату OniZeD и годных заказов на стримах!',
  'Елочка зажглась! +100 к удаче на следующем прокруте рулетки!',
  'Теплых зимних стримов, топовых прохождений и вкусного чая!',
];

export const FestiveFooter: React.FC<{
  prefs: UserPreferences;
  onShowWish: (msg: string) => void;
}> = memo(({ prefs, onShowWish }) => {
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

      <div className="footer-inner footer-minimal">
        <div className="row-gap-xs">
          <span className="brand-dot" />
          <strong>OniZeD Hub</strong>
          {holiday && <span className="winter-pill">❄ Зимний сезон</span>}
        </div>

        <div className="footer-friend-links muted-xs">
          <span>Друзья:</span>
          <a href="https://sakuya.su/" target="_blank" rel="noreferrer">
            sakuya.su
          </a>
          <span>•</span>
          <a href="https://lol.sakuya.su/" target="_blank" rel="noreferrer">
            lol.sakuya.su
          </a>
        </div>
      </div>
    </footer>
  );
});
