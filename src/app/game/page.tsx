'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, useDroppable, DragOverlay, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { useAuthStore } from '@/stores/auth-store';
import { useGameStore } from '@/stores/game-store';
import { PlayerHand, type PlayerHandHandle } from '@/components/game/player-hand';
import { GameCard } from '@/components/game/card';
import { CardBack } from '@/components/game/card-back';
import { PlayedCards } from '@/components/game/played-cards';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTimer } from '@/hooks/use-timer';
import { TURN_TIME_SECONDS } from '@/lib/constants';
import { SUIT_SYMBOLS } from '@/types';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import { saveGame } from '@/lib/api';
import type { Player, Card as CardType } from '@/types';

/* ── fanned card backs for opponent hand ── */
function FannedCardBacks({ count, maxFan = 5 }: { count: number; maxFan?: number }) {
  const displayCount = Math.min(count, maxFan);
  const width = 24 + displayCount * 20;
  return (
    <div className="relative flex items-end justify-center" style={{ width, height: 80 }}>
      {Array.from({ length: displayCount }).map((_, i) => {
        const offset = i - (displayCount - 1) / 2;
        const rotate = offset * 6;
        const lift = Math.abs(offset) * 4;
        return (
          <div
            key={i}
            className="absolute bottom-0"
            style={{
              left: `calc(50% + ${offset * 16}px)`,
              transform: `translateX(-50%) rotate(${rotate}deg)`,
              marginBottom: `${lift}px`,
              zIndex: i,
              animation: `card-fan 0.3s ease-out ${i * 60}ms both`,
            }}
          >
            <CardBack size="sm" />
          </div>
        );
      })}
      {count > maxFan && (
        <span
          className="absolute bg-gray-900 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-gray-600"
          style={{ right: -4, bottom: -4, zIndex: 99 }}
        >
          +{count - maxFan}
        </span>
      )}
    </div>
  );
}

function OpponentCard({ player, isActive, history, t }: { player: Player; isActive: boolean; history: { cards: CardType[]; type: string }[]; t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 bg-gray-900/70 border rounded-xl p-3 min-w-30 transition-colors',
        isActive ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-gray-700/50',
      )}
    >
      <FannedCardBacks count={player.hand.length} />
      <p className={cn(
        'text-xs font-medium text-center truncate max-w-25',
        player.isOut ? 'text-green-500' : 'text-white',
        isActive && 'text-yellow-400',
      )}>
        {player.name}
      </p>
      <div className="flex gap-1 justify-center">
        {player.lockedOut && <span className="text-[10px] text-red-400">{t('game.locked')}</span>}
        {player.isOut && <span className="text-[10px] text-green-400">{t('game.out')}</span>}
        {isActive && <span className="text-[10px] text-yellow-400 animate-pulse">{t('game.thinking')}</span>}
      </div>
      <span className="text-[10px] text-gray-500">{player.hand.length} {t('common.cards')}</span>
      <PlayedCards records={history} fanned />
    </div>
  );
}

function PlayDropZone({ isHumanTurn }: { isHumanTurn: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'play-area', disabled: !isHumanTurn });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'absolute inset-0 z-30 rounded-[45%] transition-colors pointer-events-none',
        isOver && 'bg-yellow-500/10 border-2 border-yellow-500/40',
      )}
    />
  );
}

export default function GamePage() {
  const router = useRouter();
  const nickname = useAuthStore((s) => s.nickname);
  const { t } = useTranslations();

  const phase = useGameStore((s) => s.phase);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const centralCard = useGameStore((s) => s.centralCard);
  const roundHistory = useGameStore((s) => s.roundHistory);
  const gameHistory = useGameStore((s) => s.gameHistory);
  const currentPlay = useGameStore((s) => s.currentPlay);
  const instantWinResults = useGameStore((s) => s.instantWinResults);
  const showInstantWin = useGameStore((s) => s.showInstantWin);
  const winner = useGameStore((s) => s.winner);
  const scores = useGameStore((s) => s.scores);
  const payouts = useGameStore((s) => s.payouts);
  const coinValue = useGameStore((s) => s.coinValue);
  const winDetail = useGameStore((s) => s.winDetail);
  const declareInstantWin = useGameStore((s) => s.declareInstantWin);
  const startPlaying = useGameStore((s) => s.startPlaying);
  const resetGame = useGameStore((s) => s.resetGame);

  const handRef = useRef<PlayerHandHandle>(null);
  const [draggedCard, setDraggedCard] = useState<CardType | null>(null);

  const humanPlayer = players[0];
  const opponents = players.slice(1);
  const isHumanTurn = currentPlayerIndex === 0 && !humanPlayer?.lockedOut && !humanPlayer?.isOut;
  const gridCols = opponents.length <= 2 ? 'grid-cols-2' : opponents.length === 3 ? 'grid-cols-3' : 'grid-cols-4';

  const handleTimeExpire = useCallback(() => {
    if (isHumanTurn) useGameStore.getState().pass();
  }, [isHumanTurn]);

  const time = useTimer(TURN_TIME_SECONDS, handleTimeExpire, isHumanTurn && phase === 'playing');

  useEffect(() => {
    if (!nickname || players.length === 0) router.push('/modes');
  }, [nickname, players, router]);

  // Save game to backend when game ends
  const savedRef = useRef(false);
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    if (phase === 'game-over' && winDetail && !savedRef.current && token) {
      savedRef.current = true;
      const payload = {
        opponentCount: players.length - 1,
        coinValue,
        winType: winDetail.winType,
        winnerId: winDetail.winnerId,
        totalPoints: winDetail.totalPoints,
        instantWinSets: winDetail.instantWinSets,
        normalBreakdown: winDetail.normalBreakdown,
        payouts: payouts || {},
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          isAI: p.isAI,
          handSize: p.hand.length,
        })),
      };
      saveGame(payload).catch(() => {});
    }
    if (phase !== 'game-over') savedRef.current = false;
  }, [phase, winDetail, players, coinValue, payouts, token]);

  if (!nickname || players.length === 0) return null;

  return (
    <DndContext
      onDragStart={(event: DragStartEvent) => {
        const card = event.active.data.current?.card as CardType | undefined;
        if (card) setDraggedCard(card);
      }}
      onDragEnd={(event: DragEndEvent) => {
        setDraggedCard(null);
        if (event.over?.id === 'play-area') {
          const cardId = event.active.data.current?.card?.id as string | undefined;
          if (cardId) handRef.current?.handleDragPlay(cardId);
        }
      }}
    >
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col bg-green-950">
        {/* ======== TABLE AREA ======== */}
        <div className="flex-1 relative mx-2 mt-2 mb-0">

        {/* Table surface (green felt oval, clipped) */}
        {/* <div className="absolute inset-x-0 top-6 bottom-8 rounded-[45%] border-[3px] border-amber-900/60 bg-green-800/50 shadow-[inset_0_0_120px_rgba(0,0,0,0.5)] overflow-hidden"> */}
          {/* Felt texture overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.15),transparent_70%)] pointer-events-none" />

          {/* History cards removed — now shown per player */}
        {/* </div> */}

        {/* ── Opponents grid opposite main player ── */}
        <div className={`absolute top-0 left-0 right-0 z-20 grid ${gridCols} gap-3 p-4 justify-items-center`}>
          {opponents.map((opp, i) => {
            const isActive = currentPlayerIndex === i + 1 && !opp.lockedOut && !opp.isOut && phase === 'playing';
            const playerHistory = gameHistory.filter(r => r.playerId === opp.id);
            return <OpponentCard key={opp.id} player={opp} isActive={isActive} history={playerHistory} t={t} />;
          })}
        </div>

        {/* ── Center: Current Play + Central Card + Turn badge ── */}
        <PlayDropZone isHumanTurn={isHumanTurn} />
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            {centralCard && (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-yellow-400/70">{t('game.central')}</span>
                <div className="w-10 h-14 bg-white rounded-lg border-2 border-yellow-500 flex flex-col items-center justify-center shadow-lg text-xs font-bold">
                  <span className={centralCard.color === 'red' ? 'text-red-500' : 'text-black'}>{centralCard.rank}</span>
                  <span className={centralCard.color === 'red' ? 'text-red-500' : 'text-black'}>{SUIT_SYMBOLS[centralCard.suit]}</span>
                </div>
              </div>
            )}

            {currentPlay && currentPlay.type !== 'pass' ? (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-green-300/80 bg-black/40 px-2 py-0.5 rounded-full">
                  {players.find((p) => p.id === currentPlay.playerId)?.name}
                </span>
                <div className="flex gap-1">
                  {currentPlay.cards.map((card, i) => {
                    const fromBottom = currentPlay.playerId === humanPlayer?.id;
                    const animName = fromBottom ? 'card-fly-from-bottom' : 'card-fly-from-top';
                    return (
                      <div key={card.id} style={{ animation: `${animName} 0.5s ease-out ${i * 80}ms both` }}>
                        <GameCard card={card} size="lg" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <span className="text-green-400/40 text-sm bg-black/30 px-3 py-1 rounded-full">
                {t('game.newRound')}
              </span>
            )}

            {phase === 'playing' && (
              <Badge className={isHumanTurn ? 'bg-green-600' : 'bg-gray-600'}>
                {isHumanTurn ? t('game.yourTurn') : t('game.turn', { name: players[currentPlayerIndex]?.name ?? '' })}
              </Badge>
            )}
          </div>
        </div>

        {/* ── Human player seat at bottom of table ── */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-0.5 bg-black/50 px-2 py-0.5 rounded">
          <p className="text-[11px] font-medium text-white whitespace-nowrap">{humanPlayer?.name} ({t('common.you')})</p>
          <p className="text-[10px] text-green-400">{humanPlayer?.hand.length} {t('common.cards')}</p>
          <PlayedCards records={gameHistory.filter(r => r.playerId === humanPlayer?.id)} />
        </div>

        {/* ── Ready Check overlay (inside table area, doesn't cover hand) ── */}
        {phase === 'ready-check' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 rounded-[45%]">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4">
              {showInstantWin ? (
                <>
                  <h2 className="text-xl font-bold text-white mb-3">{t('game.instantWinTitle')}</h2>
                  <div className="space-y-2 mb-6">
                    {instantWinResults.map((r, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-300">{t(`instantWinNames.${r.name}`, { defaultValue: r.name })}</span>
                        <Badge className="bg-yellow-600">{r.points} {t('common.points')}</Badge>
                      </div>
                    ))}
                    <Separator className="bg-gray-700 my-2" />
                    <div className="flex justify-between font-bold text-white">
                      <span>{t('game.totalPoints')}</span>
                      <span>{instantWinResults.reduce((s, r) => s + r.points, 0)} {t('common.points')}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" onClick={startPlaying}>
                      {t('game.readyButton')}
                    </Button>
                    <Button className="flex-1 bg-yellow-600 hover:bg-yellow-700" onClick={declareInstantWin}>
                      {t('game.instantWinButton')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white mb-3 text-center">{t('common.gameName')}</h2>
                  <p className="text-gray-400 text-center mb-2">{t('game.noInstantWin')}</p>
                  <p className="text-gray-500 text-sm text-center mb-6">{t('game.readyPrompt')}</p>
                  <Button className="w-full bg-red-600 hover:bg-red-700" onClick={startPlaying}>{t('game.startPlaying')}</Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======== BOTTOM: Hand + Timer + Controls ======== */}
      <div className="bg-black/50 backdrop-blur border-t border-green-900/50 p-3">
        {/* Player hand — visible during ready-check too so player can see cards */}
        {(phase === 'playing' || phase === 'ready-check') && humanPlayer && (
          <PlayerHand
            ref={handRef}
            cards={humanPlayer.hand}
            isMyTurn={isHumanTurn && phase === 'playing'}
            currentPlay={currentPlay}
            leadingSuit={currentPlay?.cards[0]?.suit || null}
            onArrange={(mode) => useGameStore.getState().arrangeHand(mode)}
            time={time}
          />
        )}
        {phase !== 'playing' && phase !== 'ready-check' && (
          <div className="text-center text-green-500/40 text-sm py-4">{t('game.waiting')}</div>
        )}
      </div>

      {/* ======== Game Over Dialog ======== */}
      {phase === 'game-over' && winDetail && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full my-8">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-white mb-1">
                {winner === 'player' ? t('game.youWon') : t('game.youLost')}
              </h2>
              <p className="text-gray-400 text-sm">{t(winDetail.summaryKey, winDetail.summaryParams)}</p>
            </div>
            <Separator className="bg-gray-700 mb-4" />
            <div className="space-y-3 mb-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{t('game.winDetails')}</p>
              <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">{t('game.winType')}</span>
                  <Badge className={winDetail.winType === 'instant_win' ? 'bg-yellow-600' : 'bg-green-600'}>
                    {winDetail.winType === 'instant_win' ? t('game.instantWin') : t('game.normalWin')}
                  </Badge>
                </div>
                {winDetail.winType === 'instant_win' && winDetail.instantWinSets.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('game.instantWinSets')}</p>
                    {winDetail.instantWinSets.map((s, i) => (
                      <div key={i} className="flex justify-between text-sm pl-2">
                        <span className="text-gray-300">{t(`instantWinNames.${s.name}`, { defaultValue: s.name })}</span>
                        <span className="text-yellow-400">+{s.points}</span>
                      </div>
                    ))}
                  </div>
                )}
                {winDetail.winType === 'normal' && winDetail.normalBreakdown && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('game.pointsBreakdown')}</p>
                    <div className="space-y-1 pl-2">
                      {winDetail.normalBreakdown.twos > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">{t('game.twos', { count: winDetail.normalBreakdown.twos })}</span>
                          <span className="text-blue-400">+{winDetail.normalBreakdown.twos}</span>
                        </div>
                      )}
                      {winDetail.normalBreakdown.centralMatches > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">{t('game.centralMatches', { count: winDetail.normalBreakdown.centralMatches })}</span>
                          <span className="text-purple-400">+{winDetail.normalBreakdown.centralMatches}</span>
                        </div>
                      )}
                      {winDetail.normalBreakdown.specialSets.map((set, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-300">{set.type.replace(/_/g, ' ')} ({set.count}x)</span>
                          <span className="text-orange-400">+{set.points}</span>
                        </div>
                      ))}
                      {winDetail.normalBreakdown.zeroPointBonus && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">{t('game.zeroPointWin')}</span>
                          <span className="text-green-400">+5</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <Separator className="bg-gray-700" />
                <div className="flex justify-between font-bold text-white">
                  <span>{t('game.totalPoints')}</span>
                  <span>{winDetail.totalPoints} {t('common.points')}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-800/30 rounded-lg p-3 mb-4 space-y-1">
              <p className="text-xs text-gray-500 mb-1">{t('common.cards')}:</p>
              {players.map((p) => {
                const isWinner = p.id === winner;
                const cardCount = isWinner ? 0 : p.hand.length;
                const mult = !isWinner && cardCount >= 2 ? (winDetail.winType === 'instant_win' ? '×4' : '×2') : '×1';
                return (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className={isWinner ? 'text-green-400' : 'text-gray-400'}>
                      {p.name}{isWinner ? ' (Winner)' : ''}
                    </span>
                    <span className={isWinner ? 'text-green-400' : cardCount >= 2 ? 'text-red-400 font-medium' : 'text-gray-500'}>
                      {isWinner ? t('game.out') : `${cardCount} ${t('common.cards')} ${cardCount >= 2 ? mult : ''}`}
                    </span>
                  </div>
                );
              })}
            </div>
            {payouts && (
              <div className="space-y-2 mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{t('game.payoutSummary', { value: coinValue })}</p>
                {Object.entries(payouts).map(([id, amount]) => (
                  <div key={id} className="flex justify-between text-sm">
                    <span className="text-gray-300">{players.find((p) => p.id === id)?.name}</span>
                    <span className={amount >= 0 ? 'text-green-400 font-semibold' : 'text-red-400'}>
                      {amount >= 0 ? '+' : ''}{amount} {t('common.coins')}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" onClick={() => { resetGame(); router.push('/modes'); }}>
                {t('game.exitGame')}
              </Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => {
                resetGame();
                useGameStore.getState().initGame(nickname, players.length - 1, coinValue);
              }}>{t('game.playAgain')}</Button>
            </div>
          </div>
        </div>
      )}
      </div>
      <DragOverlay>
        {draggedCard ? <GameCard card={draggedCard} size="lg" /> : null}
      </DragOverlay>
    </DndContext>
  );
}
