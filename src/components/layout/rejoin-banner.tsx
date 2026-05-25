'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { useOnlineGameStore } from '@/stores/online-game-store';
import { useToastStore } from '@/stores/toast-store';
import { X, LogIn } from 'lucide-react';

const RECONNECT_KEY = 'koi-room-reconnect';

function getStoredRoomCode(): string | null {
  try {
    const raw = sessionStorage.getItem(RECONNECT_KEY);
    return raw ? JSON.parse(raw).roomCode : null;
  } catch {
    return null;
  }
}

function clearStoredRoom() {
  try {
    sessionStorage.removeItem(RECONNECT_KEY);
  } catch {}
}

export function RejoinBanner() {
  const router = useRouter();
  const toast = useToastStore((s) => s.show);
  const { roomCode: activeRoomCode, phase, isReconnecting } = useOnlineGameStore();
  const [storedCode, setStoredCode] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [rejoining, setRejoining] = useState(false);

  useEffect(() => {
    const code = getStoredRoomCode();
    if (code && !activeRoomCode) {
      setStoredCode(code);
    }
  }, [activeRoomCode]);

  // Hide if already in a room, dismissed, or no stored code
  if (!storedCode || dismissed || activeRoomCode || isReconnecting || phase === 'game-over') {
    return null;
  }

  const handleRejoin = () => {
    if (isReconnecting) return;

    const socket = getSocket();
    if (!socket?.connected) {
      toast('Not connected to server');
      return;
    }

    setRejoining(true);
    socket.emit('join_room', { roomCode: storedCode }, (res: { ok?: boolean; error?: string }) => {
      setRejoining(false);
      if (res.error) {
        clearStoredRoom();
        setStoredCode(null);
        toast(res.error);
        return;
      }
      router.push(`/online/${storedCode}`);
    });
  };

  const handleDismiss = () => {
    clearStoredRoom();
    setDismissed(true);
  };

  return (
    <div className="fixed top-14 left-0 right-0 z-[90] flex justify-center pointer-events-none px-4">
      <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 bg-yellow-600/95 border border-yellow-500/50 text-white rounded-b-xl shadow-xl text-sm max-w-md w-full animate-in slide-in-from-top-4">
        <LogIn size={15} className="shrink-0" />
        <span className="flex-1 leading-tight">
          You have a game in progress.<br />
          <span className="text-yellow-200 text-xs">Room: {storedCode}</span>
        </span>
        <button
          onClick={handleRejoin}
          disabled={rejoining}
          className="px-3 py-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors text-xs font-semibold disabled:opacity-50"
        >
          {rejoining ? '...' : 'Rejoin'}
        </button>
        <button onClick={handleDismiss} className="p-1 rounded-lg hover:bg-black/20 transition-colors shrink-0">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
