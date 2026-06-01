import { Card, PlayType, InstantWinResult, PlayRecord, RANK_VALUES, RANK_ORDER } from '@/types';

export function getCardRankValue(rank: Card['rank']): number {
  return RANK_VALUES[rank];
}

export function isSameSuit(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  return cards.every((c) => c.suit === cards[0].suit);
}

export function isSameRank(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  return cards.every((c) => c.rank === cards[0].rank);
}

export function isSameColor(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  return cards.every((c) => c.color === cards[0].color);
}

export function isConsecutive(cards: Card[]): boolean {
  if (cards.length < 2) return false;
  const sorted = [...cards].sort((a, b) => getCardRankValue(a.rank) - getCardRankValue(b.rank));
  for (let i = 1; i < sorted.length; i++) {
    if (getCardRankValue(sorted[i].rank) - getCardRankValue(sorted[i - 1].rank) !== 1) {
      return false;
    }
  }
  return true;
}

export function detectPlayType(cards: Card[]): PlayType | null {
  if (cards.length === 0) return null;
  if (cards.length === 1) return 'single';

  if (cards.length === 2) {
    if (isSameRank(cards) && isSameColor(cards)) return 'good_pair';
    return null;
  }

  if (cards.length === 3) {
    if (isSameRank(cards)) return 'triple';
    if (isSameSuit(cards) && isConsecutive(cards)) return 'triple_straight_flush';
    return null;
  }

  if (cards.length >= 4) {
    if (isSameSuit(cards) && isConsecutive(cards)) return 'quad_plus_straight_flush';
    // check for 2 straight good pairs (4 cards only)
    if (cards.length === 4) {
      const sorted = [...cards].sort((a, b) => getCardRankValue(a.rank) - getCardRankValue(b.rank));
      const pair1 = [sorted[0], sorted[1]];
      const pair2 = [sorted[2], sorted[3]];
      if (
        isSameRank(pair1) && isSameColor(pair1) &&
        isSameRank(pair2) && isSameColor(pair2) &&
        getCardRankValue(pair2[0].rank) - getCardRankValue(pair1[0].rank) === 1
      ) {
        return 'two_straight_good_pairs';
      }
    }
    return null;
  }

  return null;
}

export function canBeat(played: PlayRecord, previous: PlayRecord | null): boolean {
  if (!previous || previous.type === 'pass') return true;

  const playedRank = Math.max(...played.cards.map((c) => getCardRankValue(c.rank)));
  const prevRank = Math.max(...previous.cards.map((c) => getCardRankValue(c.rank)));

  switch (played.type) {
    case 'single':
      if (previous.type === 'single') {
        return played.cards[0].suit === previous.cards[0].suit && playedRank > prevRank;
      }
      return false;

    case 'good_pair':
      if (previous.type === 'good_pair') {
        return played.cards[0].color === previous.cards[0].color && playedRank > prevRank;
      }
      return false;

    case 'triple_straight_flush':
      if (previous.type === 'single') {
        return played.cards[0].suit === previous.cards[0].suit;
      }
      if (previous.type === 'triple_straight_flush') {
        return played.cards[0].suit === previous.cards[0].suit && playedRank > prevRank;
      }
      return false;

    case 'quad_plus_straight_flush':
      if (previous.type === 'single') {
        return played.cards[0].suit === previous.cards[0].suit;
      }
      if (previous.type === 'triple_straight_flush' || previous.type === 'quad_plus_straight_flush') {
        return played.cards[0].suit === previous.cards[0].suit && playedRank > prevRank;
      }
      return false;

    case 'triple':
      if (previous.type === 'single') {
        const prevCardRank = getCardRankValue(previous.cards[0].rank);
        return prevCardRank >= getCardRankValue(10 as Card['rank']) && prevCardRank <= getCardRankValue('A' as Card['rank']);
      }
      if (previous.type === 'triple') {
        return playedRank > prevRank;
      }
      return false;

    case 'two_straight_good_pairs':
      if (previous.type === 'good_pair') return true;
      if (previous.type === 'two_straight_good_pairs') return playedRank > prevRank;
      return false;

    case 'pass':
      return false;
  }
}

export function getPlayableCards(hand: Card[], previous: PlayRecord | null, leadingSuit: Card['suit'] | null): Card[] {
  if (!previous || previous.type === 'pass') return hand;

  const playable: Card[] = [];

  switch (previous.type) {
    case 'single':
      playable.push(...hand.filter((c) => c.suit === previous.cards[0].suit && getCardRankValue(c.rank) > getCardRankValue(previous.cards[0].rank)));
      break;
    case 'good_pair':
      playable.push(...hand.filter((c) => c.color === previous.cards[0].color && getCardRankValue(c.rank) > getCardRankValue(previous.cards[0].rank)));
      break;
    default:
      break;
  }

  return playable;
}

export function checkInstantWin(hand: Card[], centralCard: Card | null): InstantWinResult[] {
  const results: InstantWinResult[] = [];

  // Type A: Four of a kind (can use central card)
  const rankCounts = new Map<string, Card[]>();
  for (const c of hand) rankCounts.set(String(c.rank), [...(rankCounts.get(String(c.rank)) || []), c]);
  for (const [, cards] of rankCounts) {
    if (cards.length === 4) {
      results.push({ type: 'A', name: 'four_of_a_kind', points: 5, canUseCentral: false, cardIds: cards.map((c) => c.id) });
    }
    if (cards.length === 3 && centralCard && cards[0].rank === centralCard.rank) {
      results.push({ type: 'A', name: 'four_of_a_kind', points: 5, canUseCentral: true, cardIds: [...cards.map((c) => c.id), centralCard.id] });
    }
  }

  // Type A: Four consecutive same suit (can use central card)
  const suitGroups = new Map<string, Card[]>();
  for (const c of hand) suitGroups.set(c.suit, [...(suitGroups.get(c.suit) || []), c]);
  for (const [, cards] of suitGroups) {
    const sorted = [...cards].sort((a, b) => getCardRankValue(a.rank) - getCardRankValue(b.rank));
    for (let i = 0; i <= sorted.length - 4; i++) {
      const slice = sorted.slice(i, i + 4);
      if (isConsecutive(slice)) {
        results.push({ type: 'A', name: 'four_straight_flush', points: 5, canUseCentral: false, cardIds: slice.map((c) => c.id) });
      }
    }
    if (centralCard && centralCard.suit === cards[0].suit) {
      const withCentral = [...cards, centralCard].sort((a, b) => getCardRankValue(a.rank) - getCardRankValue(b.rank));
      for (let i = 0; i <= withCentral.length - 4; i++) {
        const slice = withCentral.slice(i, i + 4);
        if (isConsecutive(slice) && slice.some((c) => c.id === centralCard.id)) {
          results.push({ type: 'A', name: 'four_straight_flush', points: 5, canUseCentral: true, cardIds: slice.map((c) => c.id) });
        }
      }
    }
  }

  // Type B: 3 Good Pairs
  const goodPairs: Card[][] = [];
  const usedForPairs = new Set<string>();
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (usedForPairs.has(hand[i].id) || usedForPairs.has(hand[j].id)) continue;
      if (hand[i].rank === hand[j].rank && hand[i].color === hand[j].color) {
        goodPairs.push([hand[i], hand[j]]);
        usedForPairs.add(hand[i].id);
        usedForPairs.add(hand[j].id);
      }
    }
  }
  if (goodPairs.length >= 3) {
    results.push({ type: 'B', name: 'three_good_pairs', points: 5, canUseCentral: false, cardIds: goodPairs.slice(0, 3).flat().map((c) => c.id) });
  }

  // Type B: 4 Bad Pairs
  const badPairs: Card[][] = [];
  const usedForBad = new Set<string>();
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (usedForBad.has(hand[i].id) || usedForBad.has(hand[j].id)) continue;
      if (hand[i].rank === hand[j].rank && hand[i].color !== hand[j].color) {
        badPairs.push([hand[i], hand[j]]);
        usedForBad.add(hand[i].id);
        usedForBad.add(hand[j].id);
      }
    }
  }
  if (badPairs.length >= 4) {
    results.push({ type: 'B', name: 'four_bad_pairs', points: 5, canUseCentral: false, cardIds: badPairs.slice(0, 4).flat().map((c) => c.id) });
  }

  // Type B: 5 Face cards (J, Q, K)
  const faceCards = hand.filter((c) => c.rank === 'J' || c.rank === 'Q' || c.rank === 'K');
  if (faceCards.length >= 5) {
    results.push({ type: 'B', name: 'five_face_cards', points: 5, canUseCentral: false, cardIds: faceCards.slice(0, 5).map((c) => c.id) });
  }

  // Type B: Triple 2
  const twos = hand.filter((c) => c.rank === '2');
  if (twos.length >= 3) {
    results.push({ type: 'B', name: 'triple_two', points: twos.length === 4 ? 10 : 5, canUseCentral: false, cardIds: twos.map((c) => c.id) });
  }

  // Type B: 6 cards of same suit
  for (const [, cards] of suitGroups) {
    if (cards.length >= 6) {
      results.push({ type: 'B', name: 'six_same_suit', points: 5, canUseCentral: false, cardIds: cards.slice(0, 6).map((c) => c.id) });
    }
  }

  // Type B: Under-10 hand (no 10, J, Q, K)
  const hasHighCards = hand.some((c) => {
    const v = getCardRankValue(c.rank);
    return v >= getCardRankValue('10' as Card['rank']) && v <= getCardRankValue('K' as Card['rank']);
  });
  if (!hasHighCards) {
    results.push({ type: 'B', name: 'under_ten_hand', points: 5, canUseCentral: false, cardIds: hand.map((c) => c.id) });
  }

  return results;
}

export function isValidStraight(cards: Card[]): boolean {
  if (!isConsecutive(cards)) return false;
  const sorted = [...cards].sort((a, b) => getCardRankValue(a.rank) - getCardRankValue(b.rank));
  // K-A-2-3 is invalid
  for (let i = 1; i < sorted.length; i++) {
    const prev = getCardRankValue(sorted[i - 1].rank);
    const curr = getCardRankValue(sorted[i].rank);
    if (prev === getCardRankValue('K') && curr === getCardRankValue('A')) continue;
    if (prev === getCardRankValue('A') && curr === getCardRankValue(2 as Card['rank'])) continue;
    if (curr - prev !== 1) return false;
  }
  // Check for K-A-2-3 (invalid wrap)
  if (sorted.length === 4) {
    const ranks = sorted.map((c) => getCardRankValue(c.rank));
    const hasK = ranks.includes(getCardRankValue('K'));
    const hasA = ranks.includes(getCardRankValue('A'));
    const has2 = ranks.includes(getCardRankValue(2 as Card['rank']));
    const has3 = ranks.includes(getCardRankValue(3 as Card['rank']));
    if (hasK && hasA && has2 && has3) return false;
  }
  return true;
}
