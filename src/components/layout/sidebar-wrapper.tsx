'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { cn } from '@/lib/utils';

export function SidebarWrapper() {
  const pathname = usePathname();
  const isGame = pathname === '/game';

  if (isGame) return null;

  return (
    <>
      <Sidebar />
      {/* Spacer to offset the main content when sidebar is visible */}
      <style>{`@media (min-width: 1024px) { main[data-sidebar] { margin-left: 16rem; } }`}</style>
    </>
  );
}
