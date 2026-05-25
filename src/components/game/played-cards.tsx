'use client';

import { SUIT_SYMBOLS } from '@/types';
import type { Card as CardType } from '@/types';

const MiniCard = ({ card, delay = 0 }: { card: CardType; delay?: number }) => (
  <div
    className="w-9 h-14 sm:w-11 sm:h-16 bg-white rounded-lg flex flex-col items-center justify-center text-black shadow leading-none font-bold text-lg sm:text-2xl"
    style={{
      animation: `card-deal 0.35s ease-out ${delay}ms both`,
    }}
  >
    <span className={card.color === 'red' ? 'text-red-500' : 'text-black'}>{card.rank}</span>
    <span className={card.color === 'red' ? 'text-red-500' : 'text-black'}>{SUIT_SYMBOLS[card.suit]}</span>
  </div>
);

export function PlayedCards({ records, fanned = false }: { records: { cards: CardType[]; type: string }[]; fanned?: boolean }) {
  const playRecords = records.filter(r => r.type !== 'pass');
  if (playRecords.length === 0) return null;

  if (fanned) {
    return (
      <div className="flex flex-wrap gap-0.5 justify-center mt-1">
        {playRecords.map((record, i) => {
          const cards = record.cards;
          const angle = (i * 4 - (playRecords.length - 1) * 2);
          return (
            <div key={i} className="relative w-9 h-14 sm:w-11 sm:h-16" style={{ transform: `rotate(${angle}deg)` }}>
              {cards.map((card, j) => (
                <div
                  key={card.id}
                  className="absolute"
                  style={{ left: `${j * 6}px`, top: `${j * 2}px`, zIndex: j }}
                >
                  <MiniCard card={card} delay={i * 80 + j * 40} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-0.5 justify-center mt-1">
      {playRecords.map((record, i) => (
        <div key={i} className="flex gap-px">
          {record.cards.map((card, j) => (
            <MiniCard key={card.id} card={card} delay={i * 60 + j * 30} />
          ))}
        </div>
      ))}
    </div>
  );
}
