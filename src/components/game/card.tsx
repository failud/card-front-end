'use client';

import { Card as CardType } from '@/types';
import { SUIT_SYMBOLS } from '@/types';
import { cn } from '@/lib/utils';
import { useViewportStore } from '@/stores/viewport-store';

interface CardProps {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { card: 'w-9 h-14 text-xs', suit: 'text-xl' },
  md: { card: 'w-10 h-16 text-xl', suit: 'text-3xl' },
  lg: { card: 'w-12 h-20 text-base', suit: 'text-3xl' },
};

const sizeMapDesktop = {
  sm: { card: 'w-10 h-16 text-xs', suit: 'text-xl' },
  md: { card: 'w-14 h-22 text-xl', suit: 'text-4xl' },
  lg: { card: 'w-18 h-28 text-2xl', suit: 'text-5xl' },
};

export function GameCard({ card, selected, onClick, disabled, size = 'lg' }: CardProps) {
  const isRed = card.color === 'red';
  const { isMobile } = useViewportStore();
  const map = isMobile ? sizeMap : sizeMapDesktop;
  const { card: cardClass, suit: suitClass } = map[size];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        cardClass,
        'rounded-lg flex flex-col items-center justify-center font-bold shadow-md transition-all',
        'bg-white text-black border-2',
        selected
          ? 'border-yellow-400 -translate-y-2 shadow-yellow-400/30 shadow-lg'
          : 'border-gray-300 hover:border-gray-400',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer hover:-translate-y-1',
      )}
    >
      <span className={cn('font-bold leading-tight', isRed && 'text-red-500')}>
        {card.rank}
      </span>
      <span className={cn(isRed ? 'text-red-500' : 'text-black', suitClass)}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </button>
  );
}
