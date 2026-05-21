'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/lib/i18n';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const router = useRouter();
  const { login, loading, error: apiError, isLoggedIn } = useAuthStore();

  // Redirect to modes if already logged in (token persists across refresh)
  useEffect(() => {
    if (isLoggedIn) router.replace('/modes');
  }, [isLoggedIn, router]);
  const { t } = useTranslations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    const u = username.trim();
    if (!u) {
      setLocalError(t('login.errorUsernameRequired'));
      return;
    }
    if (!password) {
      setLocalError(t('login.errorPasswordRequired'));
      return;
    }

    const ok = await login(u, password);
    if (ok) router.push('/modes');
  };

  const error = localError || apiError;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-gray-900 border-gray-800">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-white">
            {t('login.titleBrand')} <span className="text-red-500">{t('login.titleKoi')}</span>
          </CardTitle>
          <CardDescription className="text-gray-400 mt-2">
            {t('login.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                placeholder={t('login.usernamePlaceholder')}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setLocalError('');
                }}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-11"
                autoFocus
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder={t('login.passwordPlaceholder')}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLocalError('');
                }}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-11"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white h-11 font-semibold"
              disabled={loading}
            >
              {loading ? t('common.loading') : t('login.joinButton')}
            </Button>
          </form>
          <p className="text-gray-500 text-xs text-center mt-4">
            {t('login.demoHint')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
