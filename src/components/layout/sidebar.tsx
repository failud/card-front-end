'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTranslations } from '@/lib/i18n';

const navItems = [
  { href: '/modes', labelKey: 'sidebar.modes' as const, icon: '🎮' },
  { href: '/profile', labelKey: 'sidebar.profile' as const, icon: '👤' },
  { href: '/history', labelKey: 'sidebar.history' as const, icon: '📋' },
];

export function Sidebar() {
  const pathname = usePathname();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const nickname = useAuthStore((s) => s.nickname);
  const logout = useAuthStore((s) => s.logout);
  const { t } = useTranslations();

  const isGame = pathname === '/game' || pathname.startsWith('/online/');
  const isOnlineLobby = pathname === '/online';

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    main.classList.toggle('lg:ml-64', !isGame);
  }, [isGame]);

  if (isGame) return null;

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-200',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="p-4 flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-red-600 text-white">
              {nickname.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{nickname}</p>
            <p className="text-xs text-gray-400">{t('common.online')}</p>
          </div>
        </div>
        <Separator className="bg-gray-800" />
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                pathname === item.href
                  ? 'bg-red-600/20 text-red-400'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white',
              )}
            >
              <span>{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </Link>
          ))}
        </nav>
        <Separator className="bg-gray-800" />
        <div className="p-3">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 hover:text-white hover:bg-gray-800"
            onClick={logout}
          >
            {t('sidebar.logout')}
          </Button>
        </div>
      </aside>
    </>
  );
}
