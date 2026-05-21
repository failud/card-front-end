'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';

export function useBeforeUnload(enabled: boolean, roomCode: string) {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const socket = getSocket();
      if (socket?.connected && roomCode) {
        socket.emit('leave_room', { roomCode });
      }
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, roomCode]);
}
