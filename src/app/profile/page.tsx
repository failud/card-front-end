'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useTranslations } from '@/lib/i18n';
import * as api from '@/lib/api';
import type { ProfileResponse } from '@/lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const nickname = useAuthStore((s) => s.nickname);
  const userId = useAuthStore((s) => s.userId);
  const stats = useAuthStore((s) => s.stats);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const { t } = useTranslations();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);

  useEffect(() => {
    if (!nickname || !userId) {
      router.push('/');
      return;
    }
    api.fetchProfile().then(setProfile).catch(() => {});
  }, [nickname, userId, router]);

  if (!nickname) return null;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">{t('profile.title')}</h1>

        <div className="flex items-center gap-5 mb-8">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-red-600 text-white text-2xl">
              {nickname.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold text-white">{nickname}</h2>
            <p className="text-gray-400">{t('profile.role')}</p>
            {profile && (
              <p className="text-sm text-green-400 mt-1">{t('profile.winRate')}: {profile.winRate}%</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          {[
            { label: t('profile.gamesPlayed'), value: stats.gamesPlayed },
            { label: t('profile.wins'), value: stats.gamesWon },
            { label: t('profile.totalPoints'), value: stats.totalPoints },
            { label: t('profile.instantWins'), value: stats.instantWins },
          ].map((stat) => (
            <Card key={stat.label} className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-3xl font-bold text-white">{stat.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gray-900 border-gray-800 mb-4">
          <CardHeader>
            <CardTitle className="text-white text-lg">{t('profile.settings')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{t('profile.theme')}</p>
                <p className="text-gray-400 text-sm">{theme === 'dark' ? t('profile.dark') : t('profile.light')}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  className={theme === 'dark' ? 'bg-red-600' : 'border-gray-700 text-gray-300'}
                  onClick={() => setTheme('dark')}
                >
                  {t('profile.dark')}
                </Button>
                <Button
                  size="sm"
                  variant={theme === 'light' ? 'default' : 'outline'}
                  className={theme === 'light' ? 'bg-red-600' : 'border-gray-700 text-gray-300'}
                  onClick={() => setTheme('light')}
                >
                  {t('profile.light')}
                </Button>
              </div>
            </div>
            <Separator className="bg-gray-800" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{t('profile.language')}</p>
              </div>
              <LanguageSwitcher />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
