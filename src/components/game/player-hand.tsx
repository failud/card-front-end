'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card, ArrangeMode } from '@/types';
import { GameCard } from './card';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/stores/game-store';
import { useToastStore } from '@/stores/toast-store';
import { detectPlayType } from '@/lib/rules';
import { useTranslations } from '@/lib/i18n';
import { TURN_TIME_SECONDS } from '@/lib/constants';

export interface PlayerHandHandle {
  getSelectedIds: () => Set<string>;
  handleDragPlay: (dragCardId: string) => void;
}

interface PlayerHandProps {
  cards: Card[];
  isMyTurn: boolean;
  currentPlay: { playerId: string; cards: Card[]; type: string } | null;
  leadingSuit?: Card['suit'] | null;
  onArrange?: (mode: ArrangeMode) => void;
  time?: number;
  /** Online mode: called instead of game-store.playCards */
  onPlay?: (cards: Card[]) => string | void;
  /** Online mode: called instead of game-store.pass */
  onPass?: () => string | void;
}

const arrangeModes: { mode: ArrangeMode; labelKey: string }[] = [
  { mode: 'suit', labelKey: 'game.arrangeSuit' },
  { mode: 'low-to-high', labelKey: 'game.arrangeLowHigh' },
  { mode: 'sets', labelKey: 'game.arrangeSets' },
  { mode: 'shuffle', labelKey: 'game.arrangeShuffle' },
];

function DraggableCard({
  card,
  selected,
  disabled,
  onClick,
}: {
  card: Card;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
    disabled,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 50 : undefined }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onClick}>
      <GameCard
        card={card}
        selected={selected || isDragging}
        disabled={disabled}
      />
    </div>
  );
}

export const PlayerHand = forwardRef<PlayerHandHandle, PlayerHandProps>(function PlayerHand(
  { cards, isMyTurn, currentPlay, onArrange, time = 0, onPlay, onPass },
  ref,
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragEnabled, setDragEnabled] = useState(false);
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const storePlayCards = useGameStore((s) => s.playCards);
  const storePass = useGameStore((s) => s.pass);
  const toast = useToastStore((s) => s.show);
  const { t } = useTranslations();

  const playCards = onPlay || storePlayCards;
  const pass = onPass || storePass;

  const errorMessages: Record<string, string> = {
    error_invalid_play: t('game.errorInvalidPlay'),
    error_cannot_beat: t('game.errorCannotBeat'),
    error_cannot_play: t('game.errorCannotPlay'),
    error_cannot_pass: t('game.errorCannotPass'),
  };

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useImperativeHandle(ref, () => ({
    getSelectedIds: () => selectedIdsRef.current,
    handleDragPlay: (dragCardId: string) => {
      const currentSelected = selectedIdsRef.current;
      let idsToPlay: Set<string>;
      if (currentSelected.has(dragCardId)) {
        idsToPlay = currentSelected;
      } else {
        idsToPlay = new Set([dragCardId]);
      }
      const cardsToPlay = cards.filter((c) => idsToPlay.has(c.id));
      const playType = detectPlayType(cardsToPlay);
      if (cardsToPlay.length === 0 || !playType) {
        toast(t('game.errorInvalidPlay'));
        return;
      }
      const error = playCards(cardsToPlay);
      if (error) {
        toast(errorMessages[error] || error);
        return;
      }
      setSelectedIds(new Set());
    },
  }));

  const toggleCard = (id: string) => {
    if (!isMyTurn) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectedCards = cards.filter((c) => selectedIds.has(c.id));
  const playType = detectPlayType(selectedCards);
  const canPlay = selectedCards.length > 0 && playType !== null;

  const handlePlay = () => {
    if (!canPlay) {
      toast(t('game.errorInvalidPlay'));
      return;
    }
    const error = playCards(selectedCards);
    if (error) {
      toast(errorMessages[error] || error);
      return;
    }
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-3 ">
      {/* Grid: left (arrange) | center (timer) | right (pass/play) */}
      <div className="grid grid-cols-3 items-center gap-2">
        {/* Left: Arrange buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          {onArrange ? (
            <>
              <span className="text-xs text-gray-500 mr-0.5">{t('game.arrange')}</span>
              {arrangeModes.map(({ mode, labelKey }) => (
                <Button
                  key={mode}
                  variant="outline"
                  size="sm"
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs h-7 px-2"
                  onClick={() => onArrange(mode)}
                >
                  {t(labelKey)}
                </Button>
              ))}
            </>
          ) : (
            <span /> /* empty left cell to keep grid alignment */
          )}
        </div>

        {/* Center: Timer */}
        <div className="flex justify-center">
          {isMyTurn && (
            <div className="flex flex-col items-center gap-0.5">
              <div
                className="w-40 h-2 bg-gray-700 rounded-full overflow-hidden"
                style={{
                  animation: time <= 5 ? 'timer-wave 0.8s ease-in-out infinite, timer-glow 0.8s ease-in-out infinite' : 'none',
                }}
              >
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{
                    width: `${(time / TURN_TIME_SECONDS) * 100}%`,
                    backgroundColor: time <= 5 ? '#ef4444' : time <= 10 ? '#f59e0b' : '#22c55e',
                  }}
                />
              </div>
              <span
                className="text-[11px] font-bold"
                style={{
                  color: time <= 5 ? '#ef4444' : time <= 10 ? '#f59e0b' : '#22c55e',
                  animation: time <= 5 ? 'timer-wave 0.8s ease-in-out infinite' : 'none',
                }}
              >
                {time}s
              </span>
            </div>
          )}
        </div>

        {/* Right: Pass/Play buttons */}
        <div className="flex justify-end gap-2">
          {isMyTurn && (
            <>
              {currentPlay && currentPlay.type !== 'pass' ? (
                <Button
                  variant="outline"
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 h-10 w-20 text-lg font-bold rounded-xl"
                  onClick={() => {
                    const err = pass();
                    if (err) toast(errorMessages[err] || err);
                  }}
                >
                  {t('game.pass')}
                </Button>
              ) : (
                <span className="text-xs text-yellow-500 self-center">{t('game.leadPrompt')}</span>
              )}
              <Button
                className="bg-red-600 hover:bg-red-700 h-10 w-20 text-lg font-bold rounded-xl"
                disabled={!canPlay}
                onClick={handlePlay}
              >
                {t('game.play')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="flex gap-1.5 flex-wrap justify-center">
        {cards.map((card) => (
          dragEnabled && isMyTurn ? (
            <DraggableCard
              key={card.id}
              card={card}
              selected={selectedIds.has(card.id)}
              disabled={false}
              onClick={() => toggleCard(card.id)}
            />
          ) : (
            <GameCard
              key={card.id}
              card={card}
              selected={selectedIds.has(card.id)}
              onClick={() => toggleCard(card.id)}
              disabled={!isMyTurn}
            />
          )
        ))}
      </div>
    </div>
  );
});
