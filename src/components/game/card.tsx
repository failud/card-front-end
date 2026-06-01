'use client';

import { useMemo } from 'react';
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
  instantWinAvailable?: boolean;
  comboLevel?: number;
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

export function GameCard({ card, selected, onClick, disabled, size = 'lg', instantWinAvailable, comboLevel = 0 }: CardProps) {
  const isRed = card.color === 'red';
  const { isMobile } = useViewportStore();
  const map = isMobile ? sizeMap : sizeMapDesktop;
  const { card: cardClass, suit: suitClass } = map[size];

  // Sparkle particles rising from combo cards
  const sparkles = useMemo(() => {
    if (!comboLevel) return [];
    const count = comboLevel === 3 ? 8 : comboLevel === 2 ? 6 : 4;
    const color = comboLevel === 1 ? '#60a5fa' : comboLevel === 2 ? '#a78bfa' : '#c084fc';
    const starColor = comboLevel === 3 ? '#f0abfc' : comboLevel === 2 ? '#c4b5fd' : '#93c5fd';
    const items: { x: number; delay: number; duration: number; size: number; color: string; isStar: boolean }[] = [];
    for (let i = 0; i < count; i++) {
      const isStar = (comboLevel >= 2 && i % 2 === 0) || (comboLevel === 3 && i % 3 === 0);
      items.push({
        x: 8 + (i * 17 + 5) % 84,
        delay: (i * 0.35) % 1.8,
        duration: 1.0 + (i % 4) * 0.25,
        size: isStar ? 2 + (i % 3) : 2 + (i % 2),
        color: isStar ? starColor : color,
        isStar,
      });
    }
    return items;
  }, [comboLevel]);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        cardClass,
        'rounded-lg flex flex-col items-center justify-center font-bold shadow-md transition-all relative overflow-hidden',
        'bg-white text-black border-2',
        selected
          ? 'border-yellow-400 -translate-y-2 shadow-yellow-400/30 shadow-lg'
          : instantWinAvailable
            ? 'border-yellow-400 shadow-yellow-400/40 shadow-lg'
            : comboLevel === 3
              ? 'border-purple-400 shadow-purple-400/30 shadow-md'
              : comboLevel === 2
                ? 'border-violet-400 shadow-violet-400/20 shadow-sm'
                : comboLevel === 1
                  ? 'border-blue-400 shadow-blue-400/20 shadow-sm'
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

      {/* Sparkle overlay */}
      {sparkles.length > 0 && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg z-10">
          {sparkles.map((sp, i) => (
            <span
              key={i}
              className="absolute"
              style={{
                left: `${sp.x}%`,
                bottom: '0%',
                width: sp.isStar ? `${sp.size * 2.5}px` : `${sp.size}px`,
                height: sp.isStar ? `${sp.size * 2.5}px` : `${sp.size}px`,
                background: sp.color,
                animation: `sparkle-up ${sp.duration}s ease-out ${sp.delay}s infinite`,
                opacity: 0,
                borderRadius: sp.isStar ? '2px' : '50%',
                clipPath: sp.isStar ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' : undefined,
              }}
            />
          ))}
        </div>
      )}
    </button>
  );
}
