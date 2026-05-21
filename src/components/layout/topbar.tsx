'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';

export function Topbar() {
  const pathname = usePathname();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const nickname = useAuthStore((s) => s.nickname);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isLoginPage = pathname === '/';

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-gray-800 bg-gray-950/80 backdrop-blur flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        {!isLoginPage && (
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
            onClick={toggleSidebar}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </Button>
        )}
        <Link href="/modes" className="text-lg font-bold text-white tracking-wide">
          ໄພ່ <span className="text-red-500">Koi</span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        {!isLoginPage && nickname && (
          <span className="text-sm text-gray-400 hidden sm:block">{nickname}</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-white"
          onClick={toggleTheme}
        >
          {mounted ? (theme === 'dark' ? '☀️' : '🌙') : '☀️'}
        </Button>
      </div>
    </header>
  );
}
