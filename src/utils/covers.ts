export interface CoverCandidate {
  title: string;
  url: string;
  steamAppId?: number;
  source: string;
}

export function extractSteamAppId(input: string): number | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^\d{2,9}$/.test(trimmed)) {
    return Number(trimmed);
  }
  const match = trimmed.match(/store\.steampowered\.com\/app\/(\d+)/i) ||
    trimmed.match(/steam\/apps\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function getSteamPortraitUrl(appId: number): string {
  return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
}

export function getSteamHeaderUrl(appId: number): string {
  return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
}

export function buildCoverCandidatesChain(coverUrl?: string, steamAppId?: number | null): string[] {
  const urls: string[] = [];
  const extractedFromCover = coverUrl ? extractSteamAppId(coverUrl) : null;
  const effectiveAppId = steamAppId || extractedFromCover;

  // Prefer RF-accessible Akamai Steam CDN before Cloudflare-hosted SteamGridDB
  const isCloudflareGrid = coverUrl?.includes('steamgriddb.com');

  if (coverUrl && !isCloudflareGrid) {
    urls.push(coverUrl);
  }
  if (effectiveAppId) {
    const p = getSteamPortraitUrl(effectiveAppId);
    const h = getSteamHeaderUrl(effectiveAppId);
    if (!urls.includes(p)) urls.push(p);
    if (!urls.includes(h)) urls.push(h);
  }
  if (coverUrl && !urls.includes(coverUrl)) {
    urls.push(coverUrl);
  }
  return urls;
}

async function searchWikipediaCovers(query: string, lang: 'ru' | 'en'): Promise<CoverCandidate[]> {
  const endpoint = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    query
  )}&gsrlimit=6&prop=pageimages&piprop=thumbnail&pilicense=any&pithumbsize=600&format=json&origin=*`;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return [];
    const data = await res.json();
    const pages = Object.values((data?.query?.pages ?? {}) as Record<string, any>).sort(
      (a, b) => (a.index ?? 99) - (b.index ?? 99)
    );
    const out: CoverCandidate[] = [];
    for (const p of pages) {
      const src = p?.thumbnail?.source;
      if (src) {
        out.push({
          title: p.title || query,
          url: src,
          source: lang === 'ru' ? 'Wikipedia RU' : 'Wikipedia EN',
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function searchShikimoriCovers(query: string, kind: 'animes' | 'mangas'): Promise<CoverCandidate[]> {
  try {
    const res = await fetch(
      `https://shikimori.one/api/${kind}?search=${encodeURIComponent(query)}&limit=6`
    );
    if (!res.ok) return [];
    const arr = (await res.json()) as any[];
    return (arr || [])
      .filter((item) => item?.image?.original)
      .map((item) => ({
        title: item.russian || item.name,
        url: `https://shikimori.one${item.image.original}`,
        source: 'Shikimori',
      }));
  } catch {
    return [];
  }
}

export async function searchCoversOnline(
  query: string,
  kind: 'game' | 'Аниме' | 'Манга' | 'Фильм' | 'Сериал',
  apiBaseUrl?: string
): Promise<CoverCandidate[]> {
  const q = query.trim();
  if (!q) return [];

  // Direct Steam URL or AppID check
  const directSteamId = extractSteamAppId(q);
  if (directSteamId) {
    return [
      {
        title: `Steam App #${directSteamId}`,
        url: getSteamPortraitUrl(directSteamId),
        steamAppId: directSteamId,
        source: 'Steam CDN',
      },
    ];
  }

  const results: CoverCandidate[] = [];

  if (kind === 'Аниме') {
    const shiki = await searchShikimoriCovers(q, 'animes');
    results.push(...shiki);
    if (results.length < 3) {
      results.push(...(await searchWikipediaCovers(`${q} аниме`, 'ru')));
    }
  } else if (kind === 'Манга') {
    const shiki = await searchShikimoriCovers(q, 'mangas');
    results.push(...shiki);
  } else if (kind === 'Фильм' || kind === 'Сериал') {
    const suffix = kind === 'Фильм' ? 'фильм' : 'сериал';
    const [ru, en] = await Promise.all([
      searchWikipediaCovers(`${q} ${suffix}`, 'ru'),
      searchWikipediaCovers(`${q} ${kind === 'Фильм' ? 'film' : 'TV series'}`, 'en'),
    ]);
    results.push(...ru, ...en);
  } else {
    // Game search: backend Steam endpoint if available + Wikipedia EN/RU
    if (apiBaseUrl) {
      try {
        const cleanBase = apiBaseUrl.replace(/\/+$/, '');
        const r = await fetch(`${cleanBase}/api/covers/steam?q=${encodeURIComponent(q)}`);
        if (r.ok) {
          const d = await r.json();
          if (Array.isArray(d.items)) {
            results.push(...d.items);
          }
        }
      } catch {
        // Ignore if backend cover proxy not reachable
      }
    }
    const [en, ru] = await Promise.all([
      searchWikipediaCovers(`${q} video game`, 'en'),
      searchWikipediaCovers(`${q} игра`, 'ru'),
    ]);
    results.push(...en, ...ru);
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return results.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}
