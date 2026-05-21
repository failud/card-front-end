import { Card, PlayRecord } from '@/types';
import { getCardRankValue, canBeat, detectPlayType } from './rules';

export interface AIDecision {
  action: 'play' | 'pass';
  cards: Card[];
}

export function aiDecide(
  hand: Card[],
  previous: PlayRecord | null,
  isStartingRound: boolean,
): AIDecision {
  // If starting a round, play the lowest single card
  if (isStartingRound || !previous || previous.type === 'pass') {
    const sorted = [...hand].sort((a, b) => getCardRankValue(a.rank) - getCardRankValue(b.rank));
    // Try to find a pair first
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[i].rank === sorted[j].rank && sorted[i].color === sorted[j].color) {
          return { action: 'play', cards: [sorted[i], sorted[j]] };
        }
      }
    }
    return { action: 'play', cards: [sorted[0]] };
  }

  // Try to beat the previous play
  const candidates = findBeatingCards(hand, previous);
  if (candidates.length > 0) {
    // Play the lowest valid option
    return { action: 'play', cards: candidates[0] };
  }

  return { action: 'pass', cards: [] };
}

function findBeatingCards(hand: Card[], previous: PlayRecord): Card[][] {
  const results: Card[][] = [];

  switch (previous.type) {
    case 'single': {
      const prevRank = getCardRankValue(previous.cards[0].rank);
      const sameSuit = hand.filter(
        (c) => c.suit === previous.cards[0].suit && getCardRankValue(c.rank) > prevRank,
      );
      for (const card of sameSuit) {
        results.push([card]);
      }
      break;
    }
    case 'good_pair': {
      const prevRank = getCardRankValue(previous.cards[0].rank);
      const color = previous.cards[0].color;
      const rankGroups = new Map<string, Card[]>();
      for (const c of hand) {
        if (c.color !== color || getCardRankValue(c.rank) <= prevRank) continue;
        const key = String(c.rank);
        rankGroups.set(key, [...(rankGroups.get(key) || []), c]);
      }
      for (const [, cards] of rankGroups) {
        if (cards.length >= 2) results.push(cards.slice(0, 2));
      }
      break;
    }
    // Other types: AI plays simply for now
  }

  return results.sort((a, b) => {
    const aMax = Math.max(...a.map((c) => getCardRankValue(c.rank)));
    const bMax = Math.max(...b.map((c) => getCardRankValue(c.rank)));
    return aMax - bMax;
  });
}
