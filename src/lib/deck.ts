import { Card, Suit, Rank, ArrangeMode } from '@/types';
import { RANK_ORDER, RANK_VALUES, SUIT_COLORS } from '@/types';

let cardIdCounter = 0;

export function createCard(suit: Suit, rank: Rank): Card {
  return {
    id: `card-${cardIdCounter++}`,
    suit,
    rank,
    color: SUIT_COLORS[suit],
  };
}

export function createDeck(): Card[] {
  cardIdCounter = 0;
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of RANK_ORDER) {
      deck.push(createCard(suit, rank));
    }
  }
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function deal(deck: Card[], playerCount: number) {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  for (let i = 0; i < 9 * playerCount; i++) {
    hands[i % playerCount].push(deck[i]);
  }
  const remaining = deck.slice(9 * playerCount);
  const centralCard = remaining[0];
  return { hands, remaining: remaining.slice(1), centralCard };
}

export function sortHand(cards: Card[], mode: ArrangeMode): Card[] {
  const sorted = [...cards];
  switch (mode) {
    case 'shuffle':
      return shuffle(sorted);
    case 'suit':
      return sorted.sort((a, b) => {
        const suitOrder: Record<Suit, number> = { hearts: 0, diamonds: 1, clubs: 2, spades: 3 };
        if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
        return RANK_VALUES[a.rank] - RANK_VALUES[b.rank];
      });
    case 'low-to-high':
      return sorted.sort((a, b) => RANK_VALUES[a.rank] - RANK_VALUES[b.rank]);
    case 'sets':
      return sorted.sort((a, b) => {
        if (RANK_VALUES[a.rank] !== RANK_VALUES[b.rank]) return RANK_VALUES[a.rank] - RANK_VALUES[b.rank];
        const suitOrder: Record<Suit, number> = { hearts: 0, diamonds: 1, clubs: 2, spades: 3 };
        return suitOrder[a.suit] - suitOrder[b.suit];
      });
    case 'manual':
    default:
      return sorted;
  }
}

export function getRankValue(rank: Rank): number {
  return RANK_VALUES[rank];
}
