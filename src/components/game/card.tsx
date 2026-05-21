'use client';

import { Card as CardType } from '@/types';
import { SUIT_SYMBOLS } from '@/types';
import { cn } from '@/lib/utils';

interface CardProps {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-10 h-16 text-xs',
  md: 'w-14 h-22 text-sm',
  lg: 'w-18 h-28 text-2xl',
};

export function GameCard({ card, selected, onClick, disabled, size = 'lg' }: CardProps) {
  const isRed = card.color === 'red';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        sizeClasses[size],
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
      <span className={cn(isRed ? 'text-red-500 text-5xl' : 'text-black text-5xl')}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </button>
  );
}
