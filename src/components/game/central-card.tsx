'use client';

import { Card as CardType } from '@/types';
import { SUIT_SYMBOLS } from '@/types';

interface CentralCardProps {
  card: CardType;
}

export function CentralCard({ card }: CentralCardProps) {
  const isRed = card.color === 'red';

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-gray-500 uppercase tracking-wider">Central Card</span>
      <div className="w-14 h-20 bg-white rounded-lg border-2 border-yellow-500 flex flex-col items-center justify-center shadow-lg shadow-yellow-500/20">
        <span className={`font-bold text-base ${isRed ? 'text-red-500' : 'text-black'}`}>
          {card.rank}
        </span>
        <span className={isRed ? 'text-red-500' : 'text-black'}>
          {SUIT_SYMBOLS[card.suit]}
        </span>
      </div>
    </div>
  );
}
