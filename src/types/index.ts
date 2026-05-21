export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Color = 'red' | 'black';
export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'J' | 'Q' | 'K' | 'A' | '2';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  color: Color;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  isAI: boolean;
  lockedOut: boolean;
  cardsPlayed: number;
  isOut: boolean;
}

export type PlayType =
  | 'single'
  | 'good_pair'
  | 'triple_straight_flush'
  | 'quad_plus_straight_flush'
  | 'triple'
  | 'two_straight_good_pairs'
  | 'pass';

export interface PlayRecord {
  playerId: string;
  cards: Card[];
  type: PlayType;
}

export type GamePhase = 'idle' | 'ready-check' | 'playing' | 'round-end' | 'game-over';

export type ArrangeMode = 'shuffle' | 'suit' | 'sets' | 'low-to-high' | 'manual';

export interface InstantWinResult {
  type: 'A' | 'B';
  name: string;
  points: number;
  canUseCentral: boolean;
}

export interface GameResult {
  winnerId: string;
  scores: Record<string, number>;
  payouts: Record<string, number>;
  instantWin: boolean;
  coinValue: number;
}

export interface NormalBreakdown {
  twos: number;
  centralMatches: number;
  specialSets: { type: string; count: number; points: number }[];
  zeroPointBonus: boolean;
}

export interface WinDetail {
  winType: 'normal' | 'instant_win';
  winnerName: string;
  winnerId: string;
  totalPoints: number;
  instantWinSets: InstantWinResult[];
  normalBreakdown: NormalBreakdown | null;
  summaryKey: string;
  summaryParams: Record<string, string | number>;
}

export type Theme = 'light' | 'dark';

export type Locale = 'en' | 'th' | 'lo';

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'th', label: 'ไทย', flag: '🇹🇭' },
  { code: 'lo', label: 'ລາວ', flag: '🇱🇦' },
];

export const RANK_ORDER: Rank[] = [3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A', '2'];

export const RANK_VALUES: Record<Rank, number> = {
  3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7,
  J: 8, Q: 9, K: 10, A: 11, 2: 12,
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export const SUIT_COLORS: Record<Suit, Color> = {
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
  spades: 'black',
};

export const SUIT_NAMES: Record<Suit, string> = {
  hearts: 'โพธิ์แดง',
  diamonds: 'ข้าวหลามตัด',
  clubs: 'ดอกจิก',
  spades: 'โพธิ์ดำ',
};

export const RANK_NAMES: Record<Rank, string> = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  J: 'J', Q: 'Q', K: 'K', A: 'A', 2: '2',
};
