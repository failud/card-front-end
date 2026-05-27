'use client';

import { create } from 'zustand';
import { getSocket, connectSocket } from '@/lib/socket';
import { sortHand } from '@/lib/deck';
import type { Card, PlayRecord, InstantWinResult, WinDetail, ArrangeMode } from '@/types';
import { useAuthStore } from './auth-store';

// ── Reconnect persistence ──

const RECONNECT_KEY = 'koi-room-reconnect';

interface ReconnectData {
  roomCode: string;
}

function saveReconnectData(data: ReconnectData) {
  try { sessionStorage.setItem(RECONNECT_KEY, JSON.stringify(data)); } catch {}
}

function loadReconnectData(): ReconnectData | null {
  try {
    const raw = sessionStorage.getItem(RECONNECT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearReconnectData() {
  try { sessionStorage.removeItem(RECONNECT_KEY); } catch {}
}

// ── Room Types ──

export interface RoomPlayer {
  id: string;
  name: string;
  connected: boolean;
}

export interface RoomOpponent {
  id: string;
  name: string;
  handSize: number;
}

// ── Store State ──

export type OnlinePhase = 'idle' | 'lobby' | 'ready-check' | 'playing' | 'game-over';

interface OnlineGameState {
  phase: OnlinePhase;
  roomCode: string;
  isHost: boolean;
  playerCount: number;
  players: RoomPlayer[];
  hand: Card[];
  opponents: RoomOpponent[];
  centralCard: Card | null;
  currentPlayerId: string | null;
  currentPlayerName: string | null;
  currentPlay: PlayRecord | null;
  roundHistory: PlayRecord[];
  gameHistory: PlayRecord[];
  instantWinResults: InstantWinResult[];
  showInstantWin: boolean;
  timer: number;
  readyPlayers: string[];
  winner: string | null;
  winnerName: string | null;
  lastWinnerId: string | null;
  lastWinnerName: string | null;
  scores: Record<string, number> | null;
  payouts: Record<string, number> | null;
  winDetail: WinDetail | null;
  coinValue: number;
  error: string | null;
  isReconnecting: boolean;
  reconnectFailed: boolean;
  arrangeMode: ArrangeMode | null;
}

interface OnlineGameActions {
  // Room actions
  createRoom: (playerCount: number, coinValue: number, isPrivate?: boolean) => void;
  joinRoom: (roomCode: string) => void;
  leaveRoom: () => void;
  startGame: () => void;

  // Game actions
  arrangeHand: (mode: ArrangeMode) => void;
  playCards: (cardIds: string[]) => void;
  pass: () => void;
  declareInstantWin: () => void;
  playerReady: () => void;

  // Reconnection
  reconnectToRoom: () => void;

  // Internal
  listenToEvents: (token: string) => void;
  reset: () => void;
  setError: (error: string | null) => void;
}

export type OnlineGameStore = OnlineGameState & OnlineGameActions;

const initialState: OnlineGameState = {
  phase: 'idle',
  roomCode: '',
  isHost: false,
  playerCount: 3,
  players: [],
  hand: [],
  opponents: [],
  centralCard: null,
  currentPlayerId: null,
  currentPlayerName: null,
  currentPlay: null,
  roundHistory: [],
  gameHistory: [],
  instantWinResults: [],
  showInstantWin: false,
  timer: 30,
  readyPlayers: [],
  winner: null,
  winnerName: null,
  lastWinnerId: null,
  lastWinnerName: null,
  scores: null,
  payouts: null,
  winDetail: null,
  coinValue: 1,
  error: null,
  isReconnecting: false,
  reconnectFailed: false,
  arrangeMode: null,
};

const onlineGameStore = create<OnlineGameStore>((set, get) => ({
  ...initialState,

  createRoom: (playerCount: number, coinValue: number, isPrivate = false) => {
    const socket = getSocket();
    if (!socket) return;

    const doCreate = () => {
      clearReconnectData();
      socket.emit('create_room', { playerCount, coinValue, isPrivate }, (res: { ok?: boolean; error?: string; roomCode?: string }) => {
        if (res.error) { set({ error: res.error }); return; }
        const { nickname, userId } = useAuthStore.getState();
        const rc = res.roomCode || '';
        saveReconnectData({ roomCode: rc });
        set({
          roomCode: rc,
          isHost: true,
          phase: 'lobby',
          players: [{ id: userId, name: nickname, connected: true }],
          lastWinnerId: null,
          lastWinnerName: null,
          reconnectFailed: false,
          error: null,
        });
      });
    };

    // Leave any stale room first so the server releases the player slot
    const data = loadReconnectData();
    if (data?.roomCode) {
      socket.emit('leave_room', { roomCode: data.roomCode }, doCreate);
    } else {
      doCreate();
    }
  },

  joinRoom: (roomCode: string) => {
    const socket = getSocket();
    if (!socket) return;

    const doJoin = () => {
      socket.emit('join_room', { roomCode }, (res: { ok?: boolean; error?: string; roomCode?: string }) => {
        if (res.error) { set({ error: res.error }); return; }
        const { nickname, userId } = useAuthStore.getState();
        const rc = res.roomCode || roomCode.toUpperCase();
        saveReconnectData({ roomCode: rc });
        set((s) => ({
          roomCode: rc,
          isHost: false,
          phase: 'lobby',
          players: s.players.some((p) => p.id === userId) ? s.players : [...s.players, { id: userId, name: nickname, connected: true }],
          lastWinnerId: null,
          lastWinnerName: null,
          reconnectFailed: false,
        }));
      });
    };

    // Leave any stale room first so the server releases the player slot
    const data = loadReconnectData();
    if (data?.roomCode) {
      socket.emit('leave_room', { roomCode: data.roomCode }, doJoin);
    } else {
      doJoin();
    }
  },

  leaveRoom: () => {
    const { roomCode } = get();
    const socket = getSocket();
    if (socket && roomCode) socket.emit('leave_room', { roomCode });
    clearReconnectData();
    set({ ...initialState, phase: 'idle' });
  },

  reconnectToRoom: () => {
    const data = loadReconnectData();
    if (!data) return;

    const { isReconnecting } = get();
    if (isReconnecting) return;

    const socket = getSocket();
    if (!socket || !socket.connected) return;

    set({ isReconnecting: true });

    const targetCode = data.roomCode;
    let retries = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1500;

    const overallTimeoutId = setTimeout(() => {
      const state = get();
      if (state.isReconnecting) {
        // All retries exhausted — release stale room so player can create/join
        socket.emit('leave_room', { roomCode: targetCode });
        clearReconnectData();
        set({ isReconnecting: false, roomCode: '', phase: 'idle', error: null });
      }
    }, 10000);

    const attempt = () => {
      socket.emit('join_room', { roomCode: targetCode }, (res: { ok?: boolean; error?: string }) => {
        const state = get();
        if (!state.isReconnecting) return; // Already handled by overall timeout

        if (!res.error) {
          clearTimeout(overallTimeoutId);
          set({ isReconnecting: false, reconnectFailed: false });
          return;
        }

        retries++;
        if (retries < MAX_RETRIES) {
          setTimeout(attempt, RETRY_DELAY);
        } else {
          // All retries failed — clean up stale room state
          clearTimeout(overallTimeoutId);
          socket.emit('leave_room', { roomCode: targetCode });
          clearReconnectData();
          set({ isReconnecting: false, reconnectFailed: true, roomCode: '', phase: 'idle', error: null });
        }
      });
    };

    attempt();
  },

  startGame: () => {
    const socket = getSocket();
    const { roomCode } = get();
    if (!socket || !roomCode) return;
    socket.emit('start_game', { roomCode }, (res: { ok?: boolean; error?: string }) => {
      if (res.error) set({ error: res.error });
    });
  },

  playCards: (cardIds: string[]) => {
    const socket = getSocket();
    const { roomCode } = get();
    if (!socket) return;
    socket.emit('play_cards', { roomCode, cardIds }, (res: { ok?: boolean; error?: string }) => {
      if (res.error) set({ error: res.error });
    });
  },

  pass: () => {
    const socket = getSocket();
    const { roomCode } = get();
    if (!socket) return;
    socket.emit('pass', { roomCode }, (res: { ok?: boolean; error?: string }) => {
      if (res.error) set({ error: res.error });
    });
  },

  declareInstantWin: () => {
    const socket = getSocket();
    const { roomCode } = get();
    if (!socket) return;
    socket.emit('declare_instant_win', { roomCode }, (res: { ok?: boolean; error?: string }) => {
      if (res.error) set({ error: res.error });
    });
  },

  playerReady: () => {
    const socket = getSocket();
    const { roomCode } = get();
    if (!socket) return;
    socket.emit('player_ready', { roomCode }, (res: { ok?: boolean; error?: string }) => {
      if (res.error) set({ error: res.error });
    });
  },

  arrangeHand: (mode: ArrangeMode) => {
    const { hand } = get();
    set({ hand: sortHand(hand, mode), arrangeMode: mode });
  },

  listenToEvents: (token: string) => {
    const socket = connectSocket(token);

    // Remove old listeners to prevent duplicates on re-mount
    socket.off('room_state');
    socket.off('game_started');
    socket.off('hand_dealt');
    socket.off('hand_update');
    socket.off('instant_win_check');
    socket.off('your_turn');
    socket.off('play_made');
    socket.off('player_passed');
    socket.off('new_round');
    socket.off('timer_sync');
    socket.off('player_disconnected');
    socket.off('ready_state');
    socket.off('game_over');
    socket.off('error');
    socket.off('disconnect');

    socket.on('room_state', (data: { room: { code: string; hostId: string; config: { playerCount: number; coinValue: number }; players: RoomPlayer[]; phase: string; readyPlayers: string[] } }) => {
      const { room } = data;
      const myId = useAuthStore.getState().userId;
      set({
        roomCode: room.code,
        playerCount: room.config.playerCount,
        players: room.players,
        coinValue: room.config.coinValue,
        phase: room.phase as OnlinePhase,
        isHost: room.hostId === myId,
        readyPlayers: room.readyPlayers,
        reconnectFailed: false,
        error: null,
      });
    });

    socket.on('game_started', (data: { opponents: RoomOpponent[]; centralCard: Card; coinValue: number; playerOrder: string[]; isReconnect?: boolean }) => {
      set((s) => ({
        opponents: data.opponents,
        centralCard: data.centralCard,
        coinValue: data.coinValue,
        phase: data.isReconnect ? (s.phase === 'idle' ? 'ready-check' : s.phase) : 'ready-check',
        // Clear previous game state
        currentPlay: null,
        currentPlayerId: null,
        currentPlayerName: null,
        roundHistory: [],
        gameHistory: [],
        winner: null,
        winnerName: null,
        lastWinnerId: null,
        lastWinnerName: null,
        scores: null,
        payouts: null,
        winDetail: null,
        readyPlayers: [],
        error: null,
      }));
    });

    socket.on('hand_dealt', (data: { cards: Card[] }) => {
      const mode = get().arrangeMode;
      set({ hand: mode ? sortHand(data.cards, mode) : data.cards });
    });

    socket.on('hand_update', (data: { cards: Card[] }) => {
      const mode = get().arrangeMode;
      set({ hand: mode ? sortHand(data.cards, mode) : data.cards });
    });

    socket.on('instant_win_check', (data: { results: InstantWinResult[] }) => {
      if (data.results.length > 0) {
        set({ instantWinResults: data.results, showInstantWin: true, phase: 'ready-check' });
      } else {
        set({ instantWinResults: [], showInstantWin: false });
      }
    });

    socket.on('your_turn', (data: { playerId: string; playerName: string; currentPlay: PlayRecord | null; timer: number }) => {
      set({
        currentPlayerId: data.playerId,
        currentPlayerName: data.playerName,
        currentPlay: data.currentPlay,
        timer: data.timer,
        phase: 'playing',
        showInstantWin: false,
        error: null,
      });
    });

    socket.on('play_made', (data: { playerId: string; playerName: string; cards: Card[]; type: string }) => {
      const record: PlayRecord = { playerId: data.playerId, cards: data.cards, type: data.type as PlayRecord['type'] };
      const myId = useAuthStore.getState().userId;
      const playedIds = new Set(data.cards.map((c) => c.id));
      set((s) => ({
        currentPlay: record,
        roundHistory: [...s.roundHistory, record],
        gameHistory: [...s.gameHistory, record],
        // Update opponent hand size
        opponents: s.opponents.map((o) =>
          o.id === data.playerId ? { ...o, handSize: Math.max(0, o.handSize - data.cards.length) } : o
        ),
        // Remove played cards from own hand
        hand: data.playerId === myId ? s.hand.filter((c) => !playedIds.has(c.id)) : s.hand,
      }));
    });

    socket.on('player_passed', (data: { playerId: string; playerName: string }) => {
      const record: PlayRecord = { playerId: data.playerId, cards: [], type: 'pass' };
      set((s) => ({
        roundHistory: [...s.roundHistory, record],
        gameHistory: [...s.gameHistory, record],
      }));
    });

    socket.on('new_round', (data: { leaderId: string; centralCard: Card }) => {
      set({
        currentPlay: null,
        roundHistory: [],
      });
    });

    socket.on('timer_sync', (data: { remaining: number }) => {
      set({ timer: data.remaining });
    });

    socket.on('ready_state', (data: { readyPlayers: string[] }) => {
      set({ readyPlayers: data.readyPlayers });
    });

    socket.on('player_disconnected', (data: { playerId: string; playerName: string }) => {
      set((s) => ({
        players: s.players.map((p) =>
          p.id === data.playerId ? { ...p, connected: false } : p
        ),
      }));
    });

    socket.on('game_over', (data: { winner: string; winnerName: string; scores: Record<string, number>; payouts: Record<string, number>; winDetail: WinDetail; coinValue: number }) => {
      set({
        phase: 'game-over',
        winner: data.winner,
        winnerName: data.winnerName,
        lastWinnerId: data.winner,
        lastWinnerName: data.winnerName,
        scores: data.scores,
        payouts: data.payouts,
        winDetail: data.winDetail,
        coinValue: data.coinValue,
      });
    });

    socket.on('error', (data: { message: string }) => {
      set({ error: data.message });
    });

    socket.on('disconnect', () => {
      set({ error: 'Connection lost' });
    });
  },

  reset: () => set((s) => ({ ...initialState, lastWinnerId: s.lastWinnerId, lastWinnerName: s.lastWinnerName })),

  setError: (error: string | null) => set({ error }),
}));

export const useOnlineGameStore = onlineGameStore;
