'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/lib/i18n';
import * as api from '@/lib/api';
import type { GameHistoryItem } from '@/lib/api';

function GameCard({ history, t }: { history: GameHistoryItem; t: (key: string, params?: Record<string, string | number>) => string }) {
  const isWin = history.winnerId === 'player';
  const date = new Date(history.playedAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const time = new Date(history.playedAt).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-white text-base">
            {t('history.gameVsAi', { count: history.opponentCount })}
          </CardTitle>
          <p className="text-xs text-gray-500 mt-0.5">{date} {time}</p>
        </div>
        <Badge className={isWin ? 'bg-green-600' : 'bg-red-600'}>
          {isWin ? t('history.won') : t('history.lost')}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-gray-400">
            {t('history.winType')}: <span className="text-white">
              {history.winType === 'instant_win' ? t('game.instantWin') : t('game.normalWin')}
            </span>
          </span>
          <span className="text-gray-400">
            {t('game.totalPoints')}: <span className="text-white">{history.totalPoints}</span>
          </span>
          <span className="text-gray-400">
            {t('history.coinValue')}: <span className="text-white">{history.coinValue}</span>
          </span>
          {history.payouts && history.payouts['player'] !== undefined && (
            <span className="text-gray-400">
              {t('history.payout')}: {' '}
              <span className={history.payouts['player'] >= 0 ? 'text-green-400' : 'text-red-400'}>
                {history.payouts['player'] >= 0 ? '+' : ''}
                {history.payouts['player']} {t('common.coins')}
              </span>
            </span>
          )}
        </div>
        {history.instantWinSets && history.instantWinSets.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {history.instantWinSets.map((s, i) => (
              <Badge key={i} className="bg-yellow-600/50 text-yellow-200 text-xs">
                {s.name} +{s.points}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const nickname = useAuthStore((s) => s.nickname);
  const userId = useAuthStore((s) => s.userId);
  const { t } = useTranslations();
  const [items, setItems] = useState<GameHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!nickname || !userId) {
      router.push('/');
      return;
    }
    api.fetchHistory(1, 20).then((data) => {
      setItems(data.items);
      setTotal(data.total);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [nickname, userId, router]);

  if (!nickname) return null;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">{t('history.title')}</h1>
        <p className="text-gray-400 mb-8">
          {total > 0 ? t('history.subtitleWithCount', { count: total }) : t('history.subtitle')}
        </p>

        {loading ? (
          <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-12 text-center">
              <div className="text-4xl mb-4">📋</div>
              <p className="text-gray-400 text-lg">{t('history.empty')}</p>
              <p className="text-gray-500 text-sm mt-1">{t('history.emptyHint')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <GameCard key={item._id} history={item} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
