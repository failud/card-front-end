'use client';

import { Player } from '@/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';

interface OpponentAreaProps {
  players: Player[];
  currentPlayerIndex: number;
}

export function OpponentArea({ players, currentPlayerIndex }: OpponentAreaProps) {
  const { t } = useTranslations();

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{t('game.aiOpponents')}</p>
      {players.map((player, i) => (
        <Card
          key={player.id}
          className={cn(
            'bg-gray-900 border-gray-800 transition-colors',
            currentPlayerIndex === i && 'border-yellow-500/50 bg-yellow-500/5',
          )}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-gray-700 text-gray-300 text-xs">
                {player.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{player.name}</p>
              <p className="text-xs text-gray-500">
                {player.isOut ? t('game.out') : player.lockedOut ? t('game.locked') : `${player.hand.length} ${t('common.cards')}`}
              </p>
            </div>
            {currentPlayerIndex === i && !player.isOut && !player.lockedOut && (
              <Badge className="bg-yellow-600 text-xs">{t('game.thinking')}</Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
