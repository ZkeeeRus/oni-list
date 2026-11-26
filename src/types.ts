export type GameStatus =
  | 'В процессе'
  | 'Проходится'
  | 'Заказано'
  | 'Игра пройдена'
  | 'Игра дропнута зрителями'
  | 'Стример дропнул'
  | 'Тех дроп'
  | 'Отложено'
  | 'СмолДик момент';

export type RatingValue =
  | 'Шедевр'
  | 'Великолепно'
  | 'Похвально'
  | 'Проходняк'
  | 'Полный кал'
  | 'Нет мнения'
  | '';

export type WatchCategory = 'Аниме' | 'Манга' | 'Фильм' | 'Сериал';

export type WatchStatus =
  | 'В процессе'
  | 'Заказано'
  | 'Просмотрено'
  | 'Отложено'
  | 'Стример дропнул';

export type BacklogPriority = 'Высокий' | 'Средний' | 'Низкий';
export type BacklogStatus = 'Готово к стриму' | 'На примете' | 'Идея' | 'Отложено';

export interface GameItem {
  id: string;
  title: string;
  orderedBy: string;
  status: string;
  rating: string;
  conditions: string;
  comment: string;
  dropPrice?: string;
  returnPrice?: string;
  link: string;
  hours: string;
  vodUrl: string;
  coverUrl: string;
  steamAppId?: number | null;
}

export interface WatchItem {
  id: string;
  title: string;
  category: WatchCategory | string;
  orderedBy: string;
  status: WatchStatus | string;
  rating: string;
  comment: string;
  conditions: string;
  coverUrl: string;
}

export interface MemeItem {
  id: string;
  targetType: 'watch' | 'game' | 'general';
  targetId: string;
  targetTitle: string;
  imageUrl: string;
  caption: string;
  addedBy: string;
  createdAt: string;
}

export interface BacklogItem {
  id: string;
  title: string;
  genre: string;
  idea: string;
  notes: string;
  priority: BacklogPriority | string;
  status: BacklogStatus | string;
  link: string;
  coverUrl: string;
  steamAppId?: number | null;
}

export interface TierCardItem {
  id: string;
  title: string;
  coverUrl: string;
  steamAppId?: number | null;
  note?: string;
}

export interface TierRow {
  id: string;
  label: string;
  color: string;
  items: TierCardItem[];
}

export interface CustomTierList {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: string;
  tiers: TierRow[];
  pool: TierCardItem[];
}

export interface HubConfig {
  channelName: string;
  twitchUrl: string;
  vkVodUrl: string;
  headline: string;
  subheadline: string;
  currentPlanNote: string;
  isListFrozen: boolean;
  freezeBannerText: string;
}

export interface RatingScaleItem {
  rating: string;
  color: string;
  description: string;
}

export interface RuleSection {
  id: string;
  title: string;
  items: string[];
}

export interface RulesData {
  intro: string;
  sections: RuleSection[];
  footnotes: string[];
}

export interface SiteData {
  version: number;
  updatedAt: string;
  hubConfig: HubConfig;
  admins: string[];
  moderators: string[];
  ratingScale: RatingScaleItem[];
  rules: RulesData;
  games: GameItem[];
  watchlist: WatchItem[];
  memes: MemeItem[];
  backlog: BacklogItem[];
  customTierLists: CustomTierList[];
  tierItemOrder?: Record<string, string[]>;
}

export interface TwitchUser {
  userId: string;
  login: string;
  displayName: string;
  avatarUrl: string;
  accessToken: string;
  isPreview?: boolean;
}

export type UserRole = 'admin' | 'moderator' | 'viewer';

export interface RuntimeConfig {
  apiBaseUrl: string;
  twitchClientId: string;
  rootAdmins: string[];
}

export interface AuthStatUser {
  login: string;
  displayName: string;
  avatarUrl: string;
  firstSeenAt: string;
  lastSeenAt: string;
  loginCount: number;
}

export interface AuthLogEntry {
  login: string;
  displayName: string;
  avatarUrl: string;
  at: string;
}

export interface DailyTrafficPoint {
  date: string;
  sessions: number;
  tabViews: number;
  uniqueVisitors: number;
  authedSessions: number;
  guestSessions: number;
}

export interface SiteAnalyticsSummary {
  uniqueVisitors: number;
  uniqueAuthedVisitors: number;
  uniqueGuestVisitors: number;
  consentlessHits: number;
  totalSessions: number;
  totalTabViews: number;
  authedSessions: number;
  guestSessions: number;
  tabs: Record<string, number>;
  devices: Record<string, number>;
  referrers: Record<string, number>;
  actions: Record<string, number>;
  daily: DailyTrafficPoint[];
}

export interface CloudBackupMeta {
  slot: number;
  key: string;
  savedAt: string;
  stateUpdatedAt: string;
  savedBeforeEditBy: string;
  gamesCount: number;
  watchCount: number;
}

export interface AuthStatsData {
  ok: boolean;
  totalUniqueUsers: number;
  totalLogins: number;
  users: AuthStatUser[];
  recent: AuthLogEntry[];
  siteAnalytics?: SiteAnalyticsSummary;
  backups?: CloudBackupMeta[];
}
