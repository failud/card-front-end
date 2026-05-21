import { Card, Player, PlayRecord } from '@/types';

export function calculateScore(
  playedRecords: PlayRecord[],
  centralCard: Card,
  instantWinSets: number,
  isFourTwos: boolean,
): number {
  let points = 0;

  const allPlayedCards = playedRecords.flatMap((r) => r.cards);

  // Each 2 = 1 point
  points += allPlayedCards.filter((c) => c.rank === '2').length;

  // Cards matching Central Card rank = 1 point each
  points += allPlayedCards.filter((c) => c.rank === centralCard.rank).length;

  // Special sets played
  for (const record of playedRecords) {
    if (record.type === 'two_straight_good_pairs') {
      points += 3;
    } else if (record.type !== 'pass' && record.type !== 'single') {
      points += 1;
    }
  }

  // Instant win points
  if (isFourTwos) {
    points += 10;
  } else {
    points += instantWinSets * 5;
  }

  // Zero-point win
  if (points === 0) {
    points = 5;
  }

  return points;
}

export function calculatePayout(
  winnerId: string,
  players: Player[],
  score: number,
  coinValue: number,
  isInstantWin: boolean,
): Record<string, number> {
  const payouts: Record<string, number> = {};
  const baseAmount = score * coinValue;

  for (const player of players) {
    if (player.id === winnerId) {
      payouts[player.id] = 0;
    } else {
      let multiplier = 1;
      if (player.hand.length >= 2) multiplier *= 2;
      if (isInstantWin) multiplier *= 2;
      payouts[player.id] = -(baseAmount * multiplier);
    }
  }

  const totalReceived = Object.values(payouts)
    .filter((v) => v < 0)
    .reduce((sum, v) => sum + Math.abs(v), 0);
  payouts[winnerId] = totalReceived;

  return payouts;
}
