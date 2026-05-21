'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { COIN_LEVELS } from '@/lib/constants';
import { useGameStore } from '@/stores/game-store';
import { useTranslations } from '@/lib/i18n';

const COIN_LEVEL_KEYS = ['casual', 'low', 'medium', 'standard', 'high', 'veryHigh', 'premium'] as const;

export default function ModesPage() {
  const router = useRouter();
  const nickname = useAuthStore((s) => s.nickname);
  const initGame = useGameStore((s) => s.initGame);
  const [opponentCount, setOpponentCount] = useState(3);
  const [coinLevel, setCoinLevel] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const { t } = useTranslations();

  useEffect(() => {
    if (!nickname) {
      router.push('/');
    }
  }, [nickname, router]);

  const handleStartGame = () => {
    initGame(nickname, opponentCount, COIN_LEVELS[coinLevel].value);
    router.push('/game');
  };

  if (!nickname) return null;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">{t('modes.title')}</h1>
        <p className="text-gray-400 mb-8">{t('modes.greeting', { name: nickname })}</p>

        {!showSetup ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card
              className="bg-gray-900 border-gray-800 hover:border-red-500/50 cursor-pointer transition-colors"
              onClick={() => setShowSetup(true)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg">{t('modes.aiTitle')}</CardTitle>
                  <Badge className="bg-green-600">{t('modes.aiBadge')}</Badge>
                </div>
                <CardDescription className="text-gray-400">
                  {t('modes.aiDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>• {t('modes.aiFeature1')}</p>
                  <p>• {t('modes.aiFeature2')}</p>
                  <p>• {t('modes.aiFeature3')}</p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="bg-gray-900 border-gray-800 hover:border-green-500/50 cursor-pointer transition-colors"
              onClick={() => router.push('/online')}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg">{t('modes.onlineTitle')}</CardTitle>
                  <Badge className="bg-green-600">{t('modes.onlineBadge')}</Badge>
                </div>
                <CardDescription className="text-gray-400">
                  {t('modes.onlineDesc')}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <Card className="bg-gray-900 border-gray-800 max-w-md">
            <CardHeader>
              <CardTitle className="text-white">{t('modes.setupTitle')}</CardTitle>
              <CardDescription className="text-gray-400">
                {t('modes.setupDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  {t('modes.aiCount', { count: opponentCount + 1 })}
                </label>
                <div className="flex gap-2">
                  {[2, 3, 4].map((n) => (
                    <Button
                      key={n}
                      variant={opponentCount === n ? 'default' : 'outline'}
                      className={
                        opponentCount === n
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                      }
                      onClick={() => setOpponentCount(n)}
                    >
                      {t('modes.playerCount', { count: n + 1 })}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  {t('modes.betRate', {
                    value: COIN_LEVELS[coinLevel].value,
                    label: t(`coinLevels.${COIN_LEVEL_KEYS[coinLevel]}`),
                  })}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {COIN_LEVELS.map((level, i) => (
                    <Button
                      key={i}
                      variant={coinLevel === i ? 'default' : 'outline'}
                      size="sm"
                      className={
                        coinLevel === i
                          ? 'bg-red-600 hover:bg-red-700 text-xs'
                          : 'border-gray-700 text-gray-300 hover:bg-gray-800 text-xs'
                      }
                      onClick={() => setCoinLevel(i)}
                    >
                      {t(`coinLevels.${COIN_LEVEL_KEYS[i]}`)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={() => setShowSetup(false)}
                >
                  {t('common.back')}
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleStartGame}
                >
                  {t('modes.startButton')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
