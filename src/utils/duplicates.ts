import { SiteData } from '../types';

export interface ExistingMatch {
  id: string;
  section: 'Список игр' | 'Просмотровое' | 'Бэклог';
  title: string;
  status: string;
  sub: string;
  exact: boolean;
}

function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findExistingMatches(
  inputTitle: string,
  data: SiteData,
  excludeId?: string
): ExistingMatch[] {
  const q = normalizeForMatch(inputTitle);
  if (q.length < 2) return [];

  const matches: ExistingMatch[] = [];

  const checkItem = (
    id: string,
    section: ExistingMatch['section'],
    title: string,
    status: string,
    sub: string
  ) => {
    if (excludeId && id === excludeId) return;
    const norm = normalizeForMatch(title);
    if (!norm) return;
    const isExact = norm === q;
    const isSub =
      q.length >= 3 && (norm.includes(q) || (norm.length >= 4 && q.includes(norm)));
    if (isExact || isSub) {
      matches.push({ id, section, title, status, sub, exact: isExact });
    }
  };

  for (const g of data.games) {
    checkItem(g.id, 'Список игр', g.title, g.status, g.orderedBy);
  }
  for (const w of data.watchlist) {
    checkItem(w.id, 'Просмотровое', w.title, w.status, `${w.category} • ${w.orderedBy}`);
  }
  for (const b of data.backlog) {
    checkItem(b.id, 'Бэклог', b.title, b.status, b.priority);
  }

  return matches
    .sort((a, b) => Number(b.exact) - Number(a.exact))
    .slice(0, 5);
}
