'use client';

import { PlayRecord, Player } from '@/types';
import { SUIT_SYMBOLS } from '@/types';
import { useTranslations } from '@/lib/i18n';

interface PlayHistoryProps {
  records: PlayRecord[];
  players: Player[];
}

export function PlayHistory({ records, players }: PlayHistoryProps) {
  const { t } = useTranslations();

  if (records.length === 0) {
    return <p className="text-xs text-gray-600 text-center">{t('game.noPlaysThisRound')}</p>;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1">
      <span className="text-xs text-gray-500 shrink-0">{t('game.thisRound')}:</span>
      {records.map((record, i) => {
        const player = players.find((p) => p.id === record.playerId);
        if (record.type === 'pass') {
          return (
            <span key={i} className="text-xs text-gray-600 shrink-0">
              {t('game.playerPassed', { name: player?.name ?? '' })}
            </span>
          );
        }
        return (
          <div key={i} className="flex items-center gap-1 shrink-0 bg-gray-800/50 rounded px-2 py-1">
            <span className="text-xs text-gray-400">{player?.name}:</span>
            {record.cards.map((card) => (
              <span
                key={card.id}
                className={card.color === 'red' ? 'text-red-400' : 'text-gray-200'}
              >
                {card.rank}{SUIT_SYMBOLS[card.suit]}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
