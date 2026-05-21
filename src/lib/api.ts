const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('koi-token');
}

export function setToken(token: string): void {
  localStorage.setItem('koi-token', token);
}

export function clearToken(): void {
  localStorage.removeItem('koi-token');
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Auth ──

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    stats: { gamesPlayed: number; gamesWon: number; totalPoints: number; instantWins: number };
  };
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export interface ProfileResponse {
  id: string;
  username: string;
  displayName: string;
  stats: { gamesPlayed: number; gamesWon: number; totalPoints: number; instantWins: number };
  createdAt: string;
  recentGames: GameHistoryItem[];
  winRate: number;
}

export function fetchMe(): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>('/auth/me');
}

export function fetchProfile(): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>('/profile');
}

// ── History ──

export interface GameHistoryItem {
  _id: string;
  playedAt: string;
  opponentCount: number;
  coinValue: number;
  winType: 'instant_win' | 'normal';
  winnerId: string;
  totalPoints: number;
  instantWinSets: { name: string; points: number }[];
  payouts: Record<string, number>;
  players: { id: string; name: string; isAI: boolean; handSize: number }[];
}

export interface HistoryResponse {
  items: GameHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

export function fetchHistory(page = 1, limit = 10): Promise<HistoryResponse> {
  return apiFetch<HistoryResponse>(`/history?page=${page}&limit=${limit}`);
}

export interface SaveGamePayload {
  opponentCount: number;
  coinValue: number;
  winType: 'instant_win' | 'normal';
  winnerId: string;
  totalPoints: number;
  instantWinSets: { name: string; points: number }[];
  normalBreakdown: {
    twos: number;
    centralMatches: number;
    specialSets: { type: string; count: number; points: number }[];
    zeroPointBonus: boolean;
  } | null;
  payouts: Record<string, number>;
  players: { id: string; name: string; isAI: boolean; handSize: number }[];
}

export function saveGame(data: SaveGamePayload): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/history', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
