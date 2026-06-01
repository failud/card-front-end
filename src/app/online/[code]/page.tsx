"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  useDroppable,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useAuthStore } from "@/stores/auth-store";
import { useOnlineGameStore } from "@/stores/online-game-store";
import { getSocket } from "@/lib/socket";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useToastStore } from "@/stores/toast-store";
import { useViewportStore } from "@/stores/viewport-store";
import {
  PlayerHand,
  type PlayerHandHandle,
} from "@/components/game/player-hand";
import { GameCard } from "@/components/game/card";
import { CardBack } from "@/components/game/card-back";
import { PlayedCards } from "@/components/game/played-cards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SUIT_SYMBOLS } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import type { Card as CardType, PlayRecord } from "@/types";

/* ── Fanned card backs for opponent hand ── */
function FannedCardBacks({
  count,
  maxFan = 5,
}: {
  count: number;
  maxFan?: number;
}) {
  const displayCount = Math.min(count, maxFan);
  const width = 20 + displayCount * 14;
  return (
    <div
      className="relative flex items-end justify-center"
      style={{ width, height: 50 }}
    >
      {Array.from({ length: displayCount }).map((_, i) => {
        const offset = i - (displayCount - 1) / 2;
        const rotate = offset * 5;
        const lift = Math.abs(offset) * 3;
        return (
          <div
            key={i}
            className="absolute bottom-0"
            style={{
              left: `calc(50% + ${offset * 13}px)`,
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

function OpponentCard({
  name,
  handSize,
  isActive,
  history,
  t,
  isMobile: compact,
}: {
  name: string;
  handSize: number;
  isActive: boolean;
  history: PlayRecord[];
  t: (key: string, params?: Record<string, string | number>) => string;
  isMobile?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 bg-gray-900/70 border rounded-xl p-1.5 sm:p-3 min-w-0 sm:min-w-30 transition-colors",
        isActive
          ? "border-yellow-500/50 bg-yellow-500/5"
          : "border-gray-700/50",
      )}
    >
      <FannedCardBacks count={handSize} />
      <p
        className={cn(
          "text-[10px] sm:text-xs font-medium text-center truncate max-w-18 sm:max-w-25 text-white",
          isActive && "text-yellow-400",
        )}
      >
        {name}
      </p>
      <div className="flex gap-1 justify-center">
        {isActive && (
          <span className="text-[9px] text-yellow-400 animate-pulse">
            {t("game.thinking")}
          </span>
        )}
      </div>
      <span className="text-[9px] text-gray-500">
        {handSize} {t("common.cards")}
      </span>
      <PlayedCards
        records={history.slice(-1)}
        fanned={false}
      />
    </div>
  );
}

function PlayDropZone({ isHumanTurn }: { isHumanTurn: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "play-area",
    disabled: !isHumanTurn,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute inset-0 z-30 rounded-[45%] transition-colors pointer-events-none",
        isOver && "bg-yellow-500/10 border-2 border-yellow-500/40",
      )}
    />
  );
}

export default function OnlineGamePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const { nickname, token, userId } = useAuthStore();
  const { t } = useTranslations();
  const toast = useToastStore((s) => s.show);

  const {
    phase,
    roomCode,
    hand,
    opponents,
    players,
    centralCard,
    currentPlayerId,
    currentPlayerName,
    currentPlay,
    gameHistory,
    instantWinResults,
    showInstantWin,
    timer,
    readyPlayers,
    winner,
    winnerName,
    payouts,
    winDetail,
    coinValue,
    error,
    playCards: storePlayCards,
    pass: storePass,
    declareInstantWin,
    leaveRoom,
    reset,
    listenToEvents,
    arrangeHand,
    playerReady,
  } = useOnlineGameStore();

  const [draggedCard, setDraggedCard] = useState<CardType | null>(null);
  const [mounted, setMounted] = useState(false);
  const handRef = useRef<PlayerHandHandle>(null);
  const autoPassedRef = useRef(false);
  const isMobile = useViewportStore((s) => s.isMobile);
  const isLandscape = useViewportStore((s) => s.isLandscape);
  const compact = isMobile && isLandscape;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Warn before leaving while in a game
  useBeforeUnload(phase === "playing" || phase === "ready-check");

  const isMyTurn = currentPlayerId !== null && currentPlayerId === userId;

  // Filter opponents (exclude self)
  const otherOpponents = opponents.filter((o) => o.id !== userId);

  // Setup socket listeners and reconnect to room
  useEffect(() => {
    if (!nickname || !token) {
      router.push("/");
      return;
    }

    listenToEvents(token);

    const doRejoin = () => {
      const socket = getSocket();
      if (!socket?.connected) return;
      socket.emit(
        "join_room",
        { roomCode: roomCode || code },
        (res: { ok?: boolean; error?: string }) => {
          if (res.error) {
            router.push("/online");
          }
        },
      );
    };

    const socket = getSocket();
    if (socket?.connected && !roomCode) {
      // Fresh load — no roomCode in store, join using URL param
      doRejoin();
    }

    // Always listen for reconnect events to re-establish room membership
    // after a network drop (socket.io reconnects but backend needs the new socket ID)
    socket?.on("connect", doRejoin);
    return () => {
      socket?.off("connect", doRejoin);
    };
  }, [nickname, token, router, listenToEvents, roomCode, code]);

  // Show error as toast
  useEffect(() => {
    if (error) {
      toast(error);
    }
  }, [error, toast]);

  // Auto-pass when timer expires (never auto-play cards)
  useEffect(() => {
    if (phase === "playing" && isMyTurn && timer <= 0 && !autoPassedRef.current) {
      autoPassedRef.current = true;
      storePass();
    }
  }, [timer, phase, isMyTurn, storePass]);

  // Reset auto-pass guard when my turn changes
  useEffect(() => {
    autoPassedRef.current = false;
  }, [currentPlayerId]);

  const handlePlay = useCallback(
    (cards: CardType[]) => {
      storePlayCards(cards.map((c) => c.id));
    },
    [storePlayCards],
  );

  const handlePass = useCallback(() => {
    storePass();
  }, [storePass]);

  const handleInstantWin = () => {
    declareInstantWin();
  };

  const handleLeave = () => {
    leaveRoom();
    reset();
    router.push("/online");
  };

  const handlePlayAgain = () => {
    reset();
    router.push("/online");
  };

  if (!nickname) return null;

  // Loading state
  if (
    !mounted ||
    phase === "idle" ||
    (phase === "lobby" && roomCode !== code)
  ) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-green-950">
        <p className="text-green-400/60">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <DndContext
      onDragStart={(event: DragStartEvent) => {
        const card = event.active.data.current?.card as CardType | undefined;
        if (card) setDraggedCard(card);
      }}
      onDragEnd={(event: DragEndEvent) => {
        setDraggedCard(null);
        if (event.over?.id === "play-area") {
          const cardId = event.active.data.current?.card?.id as
            | string
            | undefined;
          if (cardId) handRef.current?.handleDragPlay(cardId);
        }
      }}
    >
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col bg-green-950">
        {/* ======== TABLE AREA ======== */}
        <div className="flex-1 relative mx-1 sm:mx-2 mt-1 sm:mt-2 mb-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.15),transparent_70%)] pointer-events-none" />

          {/* ── Opponents at top, pinned to edges ── */}
          <div
            className={`absolute top-0 gap-2 z-20 grid grid-cols-2 left-0 right-0 ${compact ? "px-0.5 py-0.5" : isMobile ? "px-2 py-1" : "p-2 sm:p-4"}`}
          >
            {otherOpponents.map((opp, i) => {
              const isActive =
                currentPlayerId === opp.id && phase === "playing";
              const playerHistory = gameHistory.filter(
                (r) => r.playerId === opp.id,
              );
              return (
                <div
                  key={opp.id}
                  className={i % 2 === 0 ? "justify-self-start" : "justify-self-end"}
                >
                  <OpponentCard
                    name={opp.name}
                    handSize={opp.handSize}
                    isActive={isActive}
                    history={playerHistory}
                    t={t}
                    isMobile={isMobile}
                  />
                </div>
              );
            })}
          </div>

          {/* ── Center: Current Play + Central Card + Turn badge ── */}
          <PlayDropZone isHumanTurn={isMyTurn} />
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div
              className={`flex flex-col items-center ${compact ? "gap-1" : "gap-3"}`}
            >
              {centralCard && (
                <div
                  className={`flex flex-col items-center ${compact ? "gap-0" : "gap-0.5"}`}
                >
                  <span className="text-[9px] text-yellow-400/70">
                    {t("game.central")}
                  </span>
                  <div className="w-10 h-14 bg-white rounded-lg border-2 border-yellow-500 flex flex-col items-center justify-center shadow-lg text-xs font-bold">
                    <span
                      className={
                        centralCard.color === "red"
                          ? "text-red-500"
                          : "text-black"
                      }
                    >
                      {centralCard.rank}
                    </span>
                    <span
                      className={
                        centralCard.color === "red"
                          ? "text-red-500"
                          : "text-black"
                      }
                    >
                      {SUIT_SYMBOLS[centralCard.suit]}
                    </span>
                  </div>
                </div>
              )}

              {currentPlay && currentPlay.type !== "pass" ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-green-300/80 bg-black/40 px-1 py-0.5 rounded-full">
                    {currentPlay.playerId === userId
                      ? t("common.you")
                      : currentPlayerName || currentPlay.playerId}
                  </span>
                  <div className="flex gap-1">
                    {currentPlay.cards.map((card: CardType, i: number) => (
                      <div
                        key={card.id}
                        style={{
                          animation: `card-fly-from-top 0.5s ease-out ${i * 80}ms both`,
                        }}
                      >
                        <GameCard card={card} size="lg" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <span className="text-green-400/40 text-sm bg-black/30 px-3 py-1 rounded-full">
                  {t("game.newRound")}
                </span>
              )}

              {phase === "playing" && (
                <Badge className={isMyTurn ? "bg-green-600" : "bg-gray-600"}>
                  {isMyTurn
                    ? t("game.yourTurn")
                    : t("game.turn", {
                        name: currentPlayerName || currentPlayerId || "",
                      })}
                </Badge>
              )}
            </div>
          </div>

          {/* ── Current player seat at bottom ── */}
          <div
            className={`absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center bg-black/50 rounded ${compact ? "gap-0 px-1.5 py-0" : "gap-0.5 px-2 py-0.5"}`}
          >
            <p
              className={`font-medium text-white whitespace-nowrap ${compact ? "text-[10px]" : "text-[11px]"}`}
            >
              {nickname} ({t("common.you")})
            </p>
            <p
              className={`text-green-400 ${compact ? "text-[9px]" : "text-[10px]"}`}
            >
              {hand.length} {t("common.cards")}
            </p>
            <PlayedCards
              records={
                isMobile
                  ? gameHistory.filter((r) => r.playerId === userId).slice(-1)
                  : gameHistory.filter((r) => r.playerId === userId)
              }
              fanned={!isMobile}
            />
          </div>

          {/* ── Ready Check overlay ── */}
          {phase === "ready-check" && !showInstantWin && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 rounded-[45%]">
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 sm:p-6 max-w-sm w-full mx-2 sm:mx-4 max-h-[85vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-white mb-3 text-center">
                  {t("common.gameName")}
                </h2>
                <p className="text-gray-400 text-center mb-2">
                  {t("game.noInstantWin")}
                </p>
                <p className="text-gray-500 text-sm text-center mb-6">
                  {t("game.readyPrompt")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ======== BOTTOM: Hand + Controls ======== */}
        <div
          className={`bg-black/50 backdrop-blur border-t border-green-900/50 ${compact ? "p-1" : "p-2 sm:p-1"}`}
        >
          {(phase === "playing" || phase === "ready-check") && (
            <PlayerHand
              ref={handRef}
              cards={hand}
              isMyTurn={isMyTurn && phase === "playing"}
              currentPlay={currentPlay}
              leadingSuit={currentPlay?.cards[0]?.suit || null}
              time={timer}
              onPlay={handlePlay}
              onPass={handlePass}
              onArrange={arrangeHand}
              instantWinAvailable={showInstantWin && isMyTurn && phase === "playing"}
              instantWinResults={showInstantWin ? instantWinResults : undefined}
              onInstantWin={handleInstantWin}
            />
          )}
          {phase !== "playing" && phase !== "ready-check" && (
            <div className="text-center text-green-500/40 text-sm py-4">
              {t("game.waiting")}
            </div>
          )}
        </div>

        {/* ======== Game Over Dialog ======== */}
        {phase === "game-over" && winDetail && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2 sm:p-2 overflow-y-auto">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-2 sm:p-1 max-w-lg w-full my-4 sm:my-2 max-h-[90vh] overflow-y-auto">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-white mb-1">
                  {winner === userId ? t("game.youWon") : t("game.youLost")}
                </h2>
                <p className="text-gray-400 text-sm">
                  {winnerName} — {winDetail.totalPoints} {t("common.points")}
                </p>
              </div>
              <Separator className="bg-gray-700 mb-4" />
              <div className="space-y-3 mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  {t("game.winDetails")}
                </p>
                <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">{t("game.winType")}</span>
                    <Badge
                      className={
                        winDetail.winType === "instant_win"
                          ? "bg-yellow-600"
                          : "bg-green-600"
                      }
                    >
                      {winDetail.winType === "instant_win"
                        ? t("game.instantWin")
                        : t("game.normalWin")}
                    </Badge>
                  </div>
                  {winDetail.winType === "instant_win" &&
                    winDetail.instantWinSets.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">
                          {t("game.instantWinSets")}
                        </p>
                        {winDetail.instantWinSets.map((s, i) => (
                          <div
                            key={i}
                            className="flex justify-between text-sm pl-2"
                          >
                            <span className="text-gray-300">
                              {t(`instantWinNames.${s.name}`, {
                                defaultValue: s.name,
                              })}
                            </span>
                            <span className="text-yellow-400">+{s.points}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  {winDetail.winType === "normal" &&
                    winDetail.normalBreakdown && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">
                          {t("game.pointsBreakdown")}
                        </p>
                        <div className="space-y-1 pl-2">
                          {winDetail.normalBreakdown.twos > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-300">
                                {t("game.twos", {
                                  count: winDetail.normalBreakdown.twos,
                                })}
                              </span>
                              <span className="text-blue-400">
                                +{winDetail.normalBreakdown.twos}
                              </span>
                            </div>
                          )}
                          {winDetail.normalBreakdown.centralMatches > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-300">
                                {t("game.centralMatches", {
                                  count:
                                    winDetail.normalBreakdown.centralMatches,
                                })}
                              </span>
                              <span className="text-purple-400">
                                +{winDetail.normalBreakdown.centralMatches}
                              </span>
                            </div>
                          )}
                          {winDetail.normalBreakdown.specialSets.map(
                            (set, i) => (
                              <div
                                key={i}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-gray-300">
                                  {set.type.replace(/_/g, " ")} ({set.count}x)
                                </span>
                                <span className="text-orange-400">
                                  +{set.points}
                                </span>
                              </div>
                            ),
                          )}
                          {winDetail.normalBreakdown.zeroPointBonus && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-300">
                                {t("game.zeroPointWin")}
                              </span>
                              <span className="text-green-400">+5</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  <Separator className="bg-gray-700" />
                  <div className="flex justify-between font-bold text-white">
                    <span>{t("game.totalPoints")}</span>
                    <span>
                      {winDetail.totalPoints} {t("common.points")}
                    </span>
                  </div>
                </div>
              </div>
              {payouts && (
                <div className="bg-gray-800/30 rounded-lg p-3 mb-4 space-y-1">
                  <p className="text-xs text-gray-500 mb-1">
                    {t("game.payoutSummary", { value: coinValue })}
                  </p>
                  {Object.entries(payouts).map(([id, amount]) => {
                    const isWinner = id === winner;
                    const myId = userId;
                    const name =
                      id === myId
                        ? t("common.you")
                        : opponents.find((o) => o.id === id)?.name || id;
                    return (
                      <div key={id} className="flex justify-between text-sm">
                        <span
                          className={
                            isWinner ? "text-green-400" : "text-gray-400"
                          }
                        >
                          {name}
                          {isWinner ? ` (Winner)` : ""}
                        </span>
                        <span
                          className={
                            amount >= 0 ? "text-green-400" : "text-red-400"
                          }
                        >
                          {amount >= 0 ? "+" : ""}
                          {amount} {t("common.coins")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Winner's played cards */}
              <div className="bg-gray-800/30 rounded-lg p-1 mb-4 space-y-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  {t("game.winnerCards")}
                </p>
                {(() => {
                  const winnerDisplayName =
                    players.find((p) => p.id === winner)?.name ||
                    winnerName ||
                    "";
                  const winnerHistory = gameHistory.filter(
                    (r) => r.playerId === winner && r.type !== "pass",
                  );
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-400">
                          {winnerDisplayName} (Winner)
                        </span>
                        <span className="text-green-400 text-xs">
                          {t("game.out")}
                        </span>
                      </div>
                      <span className="flex justify-center">
                        {winnerHistory.length > 0 ? (
                          <div className="flex gap-0.5 flex-wrap">
                            {winnerHistory.flatMap((record) =>
                              record.cards.map((card) => (
                                <GameCard key={card.id} card={card} size="sm" />
                              )),
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-xs">
                            {t("game.noPlaysThisRound")}
                          </p>
                        )}
                      </span>
                    </div>
                  );
                })()}
              </div>
              {/* Ready status — all players */}
              <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  {t("game.readyPlayers")}
                </p>
                <div className="space-y-1.5">
                  {players.map((p) => {
                    const isReady = readyPlayers.includes(p.id);
                    const isMe = p.id === userId;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span
                          className={
                            isReady ? "text-green-400" : "text-gray-400"
                          }
                        >
                          {isMe ? t("common.you") : p.name}
                        </span>
                        <Badge
                          className={isReady ? "bg-green-600" : "bg-gray-600"}
                        >
                          {isReady ? t("game.ready") : t("game.waitingReady")}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300"
                  onClick={handleLeave}
                >
                  {t("game.exitGame")}
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => router.push("/online")}
                >
                  {t("online.backToLobby")}
                </Button>
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
