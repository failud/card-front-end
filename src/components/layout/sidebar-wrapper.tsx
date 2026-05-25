'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';

export function SidebarWrapper() {
  const pathname = usePathname();
  const isGame = pathname === '/game';

  if (isGame) return null;

  return <Sidebar />;
}
