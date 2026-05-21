'use client';

import { create } from 'zustand';
import type { Card, Player, PlayRecord, GamePhase, ArrangeMode, InstantWinResult, WinDetail, NormalBreakdown } from '@/types';
import { createDeck, shuffle, deal, sortHand } from '@/lib/deck';
import { detectPlayType, canBeat, checkInstantWin } from '@/lib/rules';
import { calculateScore, calculatePayout } from '@/lib/scoring';
import { aiDecide } from '@/lib/ai';
import { CARDS_PER_PLAYER, AI_NAMES, INSTANT_WIN_POINTS } from '@/lib/constants';

function shouldEndRound(players: Player[], currentPlay: PlayRecord | null, passedPlayerIds: Set<string>): boolean {
  if (!currentPlay || currentPlay.type === 'pass') return false;

  const leaderId = currentPlay.playerId;

  // All active players except the round leader must have passed
  return players.every(
    (p) => p.id === leaderId || p.lockedOut || p.isOut || passedPlayerIds.has(p.id),
  );
}

function findNextPlayerIndex(currentIndex: number, players: Player[], passedPlayerIds: Set<string>): number {
  const total = players.length;
  let next = (currentIndex + 1) % total;
  let tries = 0;
  while (tries < total) {
    const p = players[next];
    if (!p.lockedOut && !p.isOut && !passedPlayerIds.has(p.id)) return next;
    next = (next + 1) % total;
    tries++;
  }
  return next; // fallback (should not happen — round should have ended)
}

function buildWinDetail(
  winnerId: string,
  players: Player[],
  winType: 'normal' | 'instant_win',
  totalPoints: number,
  instantWinSets: InstantWinResult[],
  gameHistory: PlayRecord[],
  centralCard: Card | null,
): WinDetail {
  const winner = players.find((p) => p.id === winnerId)!;
  const sets = instantWinSets.map((s) => ({
    ...s,
    name: s.name,
  }));

  let normalBreakdown: NormalBreakdown | null = null;
  let summaryKey: string;
  let summaryParams: Record<string, string | number>;

  if (winType === 'instant_win') {
    const setNames = sets.map((s) => s.name).join(', ');
    summaryKey = 'game.summaryInstantWin';
    summaryParams = { name: winner.name, sets: setNames, points: totalPoints };
  } else {
    const winnerRecords = gameHistory.filter((r) => r.playerId === winnerId && r.type !== 'pass');
    const twos = winnerRecords.reduce((sum, r) => sum + r.cards.filter((c) => c.rank === '2').length, 0);
    const centralMatches = winnerRecords.reduce(
      (sum, r) => sum + r.cards.filter((c) => centralCard && c.rank === centralCard.rank).length,
      0,
    );
    const setCounts = new Map<string, number>();
    for (const r of winnerRecords) {
      if (r.type !== 'single') {
        setCounts.set(r.type, (setCounts.get(r.type) || 0) + 1);
      }
    }
    const specialSets = Array.from(setCounts.entries()).map(([type, count]) => {
      const pts = type === 'two_straight_good_pairs' ? 3 : 1;
      return { type, count, points: pts * count };
    });

    const zeroPointBonus = twos === 0 && centralMatches === 0 && specialSets.length === 0;

    normalBreakdown = { twos, centralMatches, specialSets, zeroPointBonus };

    if (zeroPointBonus) {
      summaryKey = 'game.summaryZeroPoint';
      summaryParams = { name: winner.name, points: totalPoints };
    } else {
      summaryKey = 'game.summaryNormal';
      summaryParams = { name: winner.name, points: totalPoints };
    }
  }

  return { winType, winnerName: winner.name, winnerId, totalPoints, instantWinSets: sets, normalBreakdown, summaryKey, summaryParams };
}

interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  centralCard: Card | null;
  deck: Card[];
  roundHistory: PlayRecord[];
  leadingSuit: Card['suit'] | null;
  currentPlay: PlayRecord | null;
  gameHistory: PlayRecord[];
  instantWinResults: InstantWinResult[];
  showInstantWin: boolean;
  passedPlayerIds: string[];
  timer: number;
  winner: string | null;
  scores: Record<string, number> | null;
  payouts: Record<string, number> | null;
  coinValue: number;
  winDetail: WinDetail | null;

  initGame: (playerName: string, opponentCount: number, coinValue: number) => void;
  playCards: (cards: Card[]) => string | void;
  pass: () => string | void;
  declareInstantWin: () => void;
  dismissInstantWin: () => void;
  arrangeHand: (mode: ArrangeMode) => void;
  startPlaying: () => void;
  runAITurns: () => void;
  nextRound: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  phase: 'idle',
  players: [],
  currentPlayerIndex: 0,
  centralCard: null,
  deck: [],
  roundHistory: [],
  leadingSuit: null,
  currentPlay: null,
  gameHistory: [],
  instantWinResults: [],
  showInstantWin: false,
  passedPlayerIds: [],
  timer: 30,
  winner: null,
  scores: null,
  payouts: null,
  coinValue: 1,
  winDetail: null,

  initGame: (playerName: string, opponentCount: number, coinValue: number) => {
    const deck = shuffle(createDeck());
    const totalPlayers = opponentCount + 1;
    const { hands, remaining, centralCard } = deal(deck, totalPlayers);

    const players: Player[] = [
      {
        id: 'player',
        name: playerName,
        hand: sortHand(hands[0], 'low-to-high'),
        isAI: false,
        lockedOut: false,
        cardsPlayed: 0,
        isOut: false,
      },
    ];

    for (let i = 0; i < opponentCount; i++) {
      players.push({
        id: `ai-${i}`,
        name: AI_NAMES[i] || `AI ${i + 1}`,
        hand: sortHand(hands[i + 1], 'low-to-high'),
        isAI: true,
        lockedOut: false,
        cardsPlayed: 0,
        isOut: false,
      });
    }

    // Check AI instant wins first — if any AI has one, game over immediately
    for (let i = 1; i < players.length; i++) {
      const aiWins = checkInstantWin(players[i].hand, centralCard);
      if (aiWins.length > 0) {
        const pts = aiWins.reduce((s, r) => s + r.points, 0);
        const payoutMap = calculatePayout(players[i].id, players, pts, coinValue, true);
        const detail = buildWinDetail(players[i].id, players, 'instant_win', pts, aiWins, [], centralCard);
        set({
          phase: 'game-over',
          players,
          centralCard,
          deck: remaining,
          currentPlayerIndex: 0,
          roundHistory: [],
          leadingSuit: null,
          currentPlay: null,
          gameHistory: [],
          instantWinResults: [],
          showInstantWin: false,
          passedPlayerIds: [],
          timer: 30,
          winner: players[i].id,
          scores: { [players[i].id]: pts },
          payouts: payoutMap,
          coinValue,
          winDetail: detail,
        });
        return;
      }
    }

    const humanInstantWins = checkInstantWin(players[0].hand, centralCard);

    set({
      phase: 'ready-check',
      players,
      centralCard,
      deck: remaining,
      currentPlayerIndex: 0,
      roundHistory: [],
      leadingSuit: null,
      currentPlay: null,
      gameHistory: [],
      instantWinResults: humanInstantWins,
      showInstantWin: humanInstantWins.length > 0,
      passedPlayerIds: [],
      timer: 30,
      winner: null,
      scores: null,
      payouts: null,
      coinValue,
      winDetail: null,
    });
  },

  startPlaying: () => {
    set({ phase: 'playing', showInstantWin: false, timer: 30 });
    get().runAITurns();
  },

  playCards: (cards: Card[]) => {
    const { players, currentPlayerIndex, currentPlay, leadingSuit } = get();
    const player = players[currentPlayerIndex];
    if (player.isAI || player.lockedOut || player.isOut) return 'error_cannot_play';

    const playType = detectPlayType(cards);
    if (!playType) return 'error_invalid_play';

    const record: PlayRecord = { playerId: player.id, cards, type: playType };

    if (!canBeat(record, currentPlay)) return 'error_cannot_beat';

    // Update player
    const updatedPlayers = [...players];
    const updatedPlayer = { ...updatedPlayers[currentPlayerIndex] };
    updatedPlayer.hand = updatedPlayer.hand.filter((c) => !cards.some((pc) => pc.id === c.id));
    updatedPlayer.cardsPlayed += cards.length;
    if (updatedPlayer.hand.length === 0) updatedPlayer.isOut = true;
    updatedPlayers[currentPlayerIndex] = updatedPlayer;

    const newLeadingSuit = !currentPlay || currentPlay.type === 'pass' ? cards[0].suit : leadingSuit;
    const newRoundHistory = [...get().roundHistory, record];
    const newGameHistory = [...get().gameHistory, record];

    // Check if game is over
    if (updatedPlayer.isOut) {
      const finalScore = calculateScore(
        newGameHistory.filter((r) => r.playerId === player.id),
        get().centralCard!,
        0,
        false,
      );
      const payoutMap = calculatePayout(
        player.id,
        updatedPlayers,
        finalScore,
        get().coinValue,
        false,
      );
      const detail = buildWinDetail(player.id, updatedPlayers, 'normal', finalScore, [], newGameHistory, get().centralCard);

      set({
        players: updatedPlayers,
        roundHistory: newRoundHistory,
        gameHistory: newGameHistory,
        currentPlay: record,
        leadingSuit: newLeadingSuit,
        phase: 'game-over',
        winner: player.id,
        scores: { [player.id]: finalScore },
        payouts: payoutMap,
        winDetail: detail,
      });
      return;
    }

    // Move to next player
    const nextIndex = findNextPlayerIndex(currentPlayerIndex, updatedPlayers, new Set());
    set({
      players: updatedPlayers,
      roundHistory: newRoundHistory,
      gameHistory: newGameHistory,
      currentPlay: record,
      leadingSuit: newLeadingSuit,
      passedPlayerIds: [],
      currentPlayerIndex: nextIndex,
      timer: 30,
    });

    get().runAITurns();
  },

  pass: () => {
    const { players, currentPlayerIndex, currentPlay, roundHistory, gameHistory, passedPlayerIds } = get();
    const player = players[currentPlayerIndex];
    if (player.isAI || player.lockedOut || player.isOut) return 'error_cannot_play';
    if (!currentPlay || currentPlay.type === 'pass') return 'error_cannot_pass';

    const newPassedPlayerIds = [...passedPlayerIds, player.id];
    const record: PlayRecord = { playerId: player.id, cards: [], type: 'pass' };
    const newRoundHistory = [...roundHistory, record];
    const newGameHistory = [...gameHistory, record];

    if (shouldEndRound(players, currentPlay, new Set(newPassedPlayerIds))) {
      const winnerIndex = players.findIndex((p) => p.id === currentPlay.playerId);
      set({
        roundHistory: [],
        leadingSuit: null,
        currentPlay: null,
        currentPlayerIndex: winnerIndex,
        gameHistory: newGameHistory,
        passedPlayerIds: [],
        timer: 30,
      });
      get().runAITurns();
      return;
    }

    const nextIndex = findNextPlayerIndex(currentPlayerIndex, players, new Set(newPassedPlayerIds));

    set({
      roundHistory: newRoundHistory,
      gameHistory: newGameHistory,
      currentPlayerIndex: nextIndex,
      passedPlayerIds: newPassedPlayerIds,
      timer: 30,
    });

    get().runAITurns();
  },

  declareInstantWin: () => {
    const { players, instantWinResults, coinValue } = get();
    if (instantWinResults.length === 0) return;

    const totalPoints = instantWinResults.reduce((sum, r) => sum + r.points, 0);
    const player = players[0];

    const payoutMap = calculatePayout(
      player.id,
      players,
      totalPoints,
      coinValue,
      true,
    );

    const detail = buildWinDetail(player.id, players, 'instant_win', totalPoints, instantWinResults, [], get().centralCard);

    set({
      phase: 'game-over',
      winner: player.id,
      scores: { [player.id]: totalPoints },
      payouts: payoutMap,
      showInstantWin: false,
      winDetail: detail,
    });
  },

  dismissInstantWin: () => {
    set({ showInstantWin: false });
  },

  arrangeHand: (mode: ArrangeMode) => {
    const { players } = get();
    const updatedPlayers = [...players];
    updatedPlayers[0] = { ...updatedPlayers[0], hand: sortHand(updatedPlayers[0].hand, mode) };
    set({ players: updatedPlayers });
  },

  runAITurns: () => {
    const state = get();
    if (state.phase !== 'playing') return;

    const { players, currentPlayerIndex, currentPlay } = state;
    const player = players[currentPlayerIndex];
    if (!player || !player.isAI || player.lockedOut || player.isOut) return;

    const isStartingRound = !currentPlay || currentPlay.type === 'pass';
    const decision = aiDecide(player.hand, currentPlay, isStartingRound);

    // Small delay to make it feel natural
    setTimeout(() => {
      const currentState = get();
      if (currentState.phase !== 'playing') return;

      if (decision.action === 'play') {
        // Use gameStore's play logic directly
        const updatedPlayers = [...currentState.players];
        const updatedPlayer = { ...updatedPlayers[currentPlayerIndex] };
        updatedPlayer.hand = updatedPlayer.hand.filter(
          (c) => !decision.cards.some((dc) => dc.id === c.id),
        );
        updatedPlayer.cardsPlayed += decision.cards.length;
        if (updatedPlayer.hand.length === 0) updatedPlayer.isOut = true;
        updatedPlayers[currentPlayerIndex] = updatedPlayer;

        const playType = detectPlayType(decision.cards) || 'single';
        const record: PlayRecord = { playerId: player.id, cards: decision.cards, type: playType };
        const newLeadingSuit = isStartingRound ? decision.cards[0].suit : currentState.leadingSuit;

        if (updatedPlayer.isOut) {
          const aiPoints = calculateScore(
            [...currentState.gameHistory, record].filter((r) => r.playerId === player.id),
            currentState.centralCard!,
            0,
            false,
          );
          const payoutMap = calculatePayout(
            player.id,
            updatedPlayers,
            aiPoints,
            currentState.coinValue,
            false,
          );
          const detail = buildWinDetail(player.id, updatedPlayers, 'normal', aiPoints, [], [...currentState.gameHistory, record], currentState.centralCard);
          set({
            players: updatedPlayers,
            phase: 'game-over',
            winner: player.id,
            scores: { [player.id]: aiPoints },
            payouts: payoutMap,
            winDetail: detail,
          });
          return;
        }

        const nextIndex = findNextPlayerIndex(currentPlayerIndex, updatedPlayers, new Set());
        set({
          players: updatedPlayers,
          roundHistory: [...currentState.roundHistory, record],
          gameHistory: [...currentState.gameHistory, record],
          currentPlay: record,
          leadingSuit: newLeadingSuit,
          passedPlayerIds: [],
          currentPlayerIndex: nextIndex,
          timer: 30,
        });

        // Continue AI chain
        get().runAITurns();
      } else {
        // AI passes
        const record: PlayRecord = { playerId: player.id, cards: [], type: 'pass' };
        const newPassedPlayerIds = [...(currentState.passedPlayerIds || []), player.id];
        const newRoundHistory = [...currentState.roundHistory, record];
        const newGameHistory = [...currentState.gameHistory, record];

        // Check if round should end: all others passed on current play
        if (currentPlay && shouldEndRound(currentState.players, currentPlay, new Set(newPassedPlayerIds))) {
          const winnerIndex = currentState.players.findIndex((p) => p.id === currentPlay.playerId);
          set({
            roundHistory: [],
            leadingSuit: null,
            currentPlay: null,
            currentPlayerIndex: winnerIndex,
            gameHistory: newGameHistory,
            passedPlayerIds: [],
            timer: 30,
          });
          get().runAITurns();
          return;
        }

        const nextIndex = findNextPlayerIndex(currentPlayerIndex, currentState.players, new Set(newPassedPlayerIds));
        set({
          roundHistory: newRoundHistory,
          gameHistory: newGameHistory,
          currentPlayerIndex: nextIndex,
          passedPlayerIds: newPassedPlayerIds,
        });
        get().runAITurns();
      }
    }, 800);
  },

  nextRound: () => {
    set({ phase: 'idle' });
  },

  resetGame: () => {
    set({
      phase: 'idle',
      players: [],
      currentPlayerIndex: 0,
      centralCard: null,
      deck: [],
      roundHistory: [],
      leadingSuit: null,
      currentPlay: null,
      gameHistory: [],
      instantWinResults: [],
      showInstantWin: false,
      passedPlayerIds: [],
      timer: 30,
      winner: null,
      scores: null,
      payouts: null,
      winDetail: null,
    });
  },
}));
