'use client';

import { create } from 'zustand';
import { getSocket, connectSocket } from '@/lib/socket';
import type { Card, PlayRecord, InstantWinResult, WinDetail } from '@/types';
import { useAuthStore } from './auth-store';

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
  winner: string | null;
  winnerName: string | null;
  scores: Record<string, number> | null;
  payouts: Record<string, number> | null;
  winDetail: WinDetail | null;
  coinValue: number;
  error: string | null;
}

interface OnlineGameActions {
  // Room actions
  createRoom: (playerCount: number, coinValue: number) => void;
  joinRoom: (roomCode: string) => void;
  leaveRoom: () => void;
  startGame: () => void;

  // Game actions
  playCards: (cardIds: string[]) => void;
  pass: () => void;
  declareInstantWin: () => void;

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
  winner: null,
  winnerName: null,
  scores: null,
  payouts: null,
  winDetail: null,
  coinValue: 1,
  error: null,
};

const onlineGameStore = create<OnlineGameStore>((set, get) => ({
  ...initialState,

  createRoom: (playerCount: number, coinValue: number) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('create_room', { playerCount, coinValue }, (res: { ok?: boolean; error?: string; roomCode?: string }) => {
      if (res.error) { set({ error: res.error }); return; }
      const { nickname, userId } = useAuthStore.getState();
      const rc = res.roomCode || '';
      set({
        roomCode: rc,
        isHost: true,
        phase: 'lobby',
        players: [{ id: userId, name: nickname, connected: true }],
        error: null,
      });
    });
  },

  joinRoom: (roomCode: string) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('join_room', { roomCode }, (res: { ok?: boolean; error?: string; roomCode?: string }) => {
      if (res.error) { set({ error: res.error }); return; }
      const { nickname, userId } = useAuthStore.getState();
      const rc = res.roomCode || roomCode.toUpperCase();
      set((s) => ({
        roomCode: rc,
        isHost: false,
        phase: 'lobby',
        players: s.players.some((p) => p.id === userId) ? s.players : [...s.players, { id: userId, name: nickname, connected: true }],
        error: null,
      }));
    });
  },

  leaveRoom: () => {
    const { roomCode } = get();
    const socket = getSocket();
    if (socket && roomCode) socket.emit('leave_room', { roomCode });
    set({ ...initialState, phase: 'idle' });
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
    socket.off('game_over');
    socket.off('error');
    socket.off('disconnect');

    socket.on('room_state', (data: { room: { code: string; hostId: string; config: { playerCount: number; coinValue: number }; players: RoomPlayer[]; phase: string } }) => {
      const { room } = data;
      set({
        roomCode: room.code,
        playerCount: room.config.playerCount,
        players: room.players,
        coinValue: room.config.coinValue,
        phase: room.phase as OnlinePhase,
        error: null,
      });
    });

    socket.on('game_started', (data: { opponents: RoomOpponent[]; centralCard: Card; coinValue: number; playerOrder: string[] }) => {
      set({
        opponents: data.opponents,
        centralCard: data.centralCard,
        coinValue: data.coinValue,
        phase: 'ready-check',
      });
    });

    socket.on('hand_dealt', (data: { cards: Card[] }) => {
      set({ hand: data.cards });
    });

    socket.on('hand_update', (data: { cards: Card[] }) => {
      set({ hand: data.cards });
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
      set((s) => ({
        currentPlay: record,
        roundHistory: [...s.roundHistory, record],
        gameHistory: [...s.gameHistory, record],
        // Update opponent hand size
        opponents: s.opponents.map((o) =>
          o.id === data.playerId ? { ...o, handSize: Math.max(0, o.handSize - data.cards.length) } : o
        ),
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

  reset: () => set({ ...initialState }),

  setError: (error: string | null) => set({ error }),
}));

export const useOnlineGameStore = onlineGameStore;
