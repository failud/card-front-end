'use client';

import { GameCard } from './card';
import { useTranslations } from '@/lib/i18n';
import type { Card as CardType, Player } from '@/types';

interface GameBoardProps {
  currentPlay: { playerId: string; cards: CardType[]; type: string } | null;
  players: Player[];
}

export function GameBoard({ currentPlay, players }: GameBoardProps) {
  const { t } = useTranslations();

  if (!currentPlay || currentPlay.type === 'pass') {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">{t('game.newRoundWaiting')}</p>
      </div>
    );
  }

  const player = players.find((p) => p.id === currentPlay.playerId);

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-sm text-gray-400">{t('game.playerPlayed', { name: player?.name ?? '' })}</span>
      <div className="flex gap-2 flex-wrap justify-center">
        {currentPlay.cards.map((card) => (
          <GameCard key={card.id} card={card} size="lg" />
        ))}
      </div>
      <span className="text-xs text-gray-500">{currentPlay.type.replace(/_/g, ' ')}</span>
    </div>
  );
}
