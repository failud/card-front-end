'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useOnlineGameStore } from '@/stores/online-game-store';
import { getSocket } from '@/lib/socket';
import { useBeforeUnload } from '@/hooks/use-before-unload';
import { fetchRooms, type PublicRoom } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { COIN_LEVELS } from '@/lib/constants';
import { useTranslations } from '@/lib/i18n';

const COIN_LEVEL_KEYS = ['casual', 'low', 'medium', 'standard', 'high', 'veryHigh', 'premium'] as const;

const COIN_VALUE_TO_KEY: Record<number, string> = {};
COIN_LEVELS.forEach((level, i) => {
  COIN_VALUE_TO_KEY[level.value] = COIN_LEVEL_KEYS[i];
});

export default function OnlinePage() {
  const router = useRouter();
  const { nickname, token, userId } = useAuthStore();
  const { t } = useTranslations();
  const {
    phase, roomCode, isHost, playerCount: storePlayerCount, players, error, isReconnecting,
    createRoom, joinRoom, leaveRoom, startGame, listenToEvents, setError, reconnectToRoom,
    readyPlayers, playerReady, lastWinnerId,
  } = useOnlineGameStore();

  const nonHostPlayers = players.filter((p) => p.id !== players[0]?.id && p.connected);
  const allNonHostReady = nonHostPlayers.length === 0 || nonHostPlayers.every((p) => readyPlayers.includes(p.id));
  const toggleReady = () => playerReady();

  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [localPlayerCount, setLocalPlayerCount] = useState(3);
  const [coinLevel, setCoinLevel] = useState(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const data = await fetchRooms();
      setPublicRooms(data.rooms);
    } catch {
      // Silent fail - room list is non-critical
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  // Fetch public rooms on mount and when not in a room
  useEffect(() => {
    if (!mounted) return;
    if (phase === 'lobby' && roomCode) return; // Don't show rooms while in a room
    loadRooms();
    const interval = setInterval(loadRooms, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [mounted, phase, roomCode, loadRooms]);

  useEffect(() => { setMounted(true); }, []);

  // Warn before leaving while in a room
  useBeforeUnload(phase === 'lobby' && !!roomCode);

  useEffect(() => {
    if (!nickname) { router.push('/'); return; }
    listenToEvents(token);

    // Try to reconnect to a previous room on initial mount
    if (!roomCode) {
      const socket = getSocket();
      if (socket?.connected) {
        reconnectToRoom();
      }
    }

    // Always listen for socket reconnect to re-establish room membership
    const onConnect = () => {
      if (roomCode) {
        // Already in a room — re-join to update socket ID on backend
        const socket = getSocket();
        if (socket?.connected) {
          socket.emit('join_room', { roomCode },
            (res: { ok?: boolean; error?: string }) => {
              if (res.error) setError(res.error);
            });
        }
      } else {
        reconnectToRoom();
      }
    };
    const socket = getSocket();
    socket?.on('connect', onConnect);
    return () => { socket?.off('connect', onConnect); };
  }, [nickname, token, router, listenToEvents, roomCode]);

  // Navigate to game when it starts
  useEffect(() => {
    if (phase === 'ready-check' || phase === 'playing') {
      router.push(`/online/${roomCode}`);
    }
  }, [phase, roomCode, router]);

  const handleCreateRoom = () => {
    createRoom(localPlayerCount, COIN_LEVELS[coinLevel].value, isPrivate);
  };

  const handleJoinRoom = () => {
    if (joinCode.trim().length < 4) return;
    joinRoom(joinCode.trim().toUpperCase());
  };

  const handleLeave = () => {
    leaveRoom();
    setShowCreate(false);
    setJoinCode('');
  };

  if (!nickname) return null;

  const renderLobby = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            {t('online.roomTitle', { code: roomCode })}
          </h2>
          <p className="text-gray-400 text-sm">
            {t('online.playersCount', { current: players.length, total: storePlayerCount })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 text-sm h-9 sm:h-10"
            onClick={handleLeave}
          >
            {t('common.back')}
          </Button>
          {isHost && (
            <Button
              className="bg-red-600 hover:bg-red-700 text-sm h-9 sm:h-10"
              disabled={players.length < 3 || !allNonHostReady}
              onClick={startGame}
            >
              {t('modes.startButton')}
            </Button>
          )}
        </div>
      </div>

      <div className="max-h-[35vh] sm:max-h-[45vh] overflow-y-auto space-y-2 mx-0 sm:-mx-10 overflow-x-hidden">
        <p className="text-sm text-gray-500 uppercase sticky top-0 bg-gray-950 pb-1 px-10">{t('online.playersSection')}</p>
        {players.map((p, i) => {
          const isReady = readyPlayers.includes(p.id);
          return (
            <div key={p.id} className={`flex items-center gap-2 sm:gap-3 py-2 px-3 rounded transition-colors ${
              isReady ? 'bg-green-900/30 border border-green-800/40' : 'bg-gray-800/50'
            }`}>
              <span className="text-gray-400 text-sm w-5 sm:w-6 shrink-0">{i + 1}.</span>
              <span className={`text-sm sm:text-base flex-1 truncate ${isReady ? 'text-green-200' : 'text-white'}`}>
                {p.name}
              </span>
              {p.id === players[0]?.id && (
                <Badge className="bg-yellow-600/50 text-yellow-200 text-xs shrink-0">{t('online.host')}</Badge>
              )}
              {phase === 'game-over' && p.id === lastWinnerId && (
                <Badge className="bg-yellow-500/80 text-yellow-950 text-[10px] shrink-0 font-bold tracking-wider">{t('online.lastWinner')}</Badge>
              )}
              {!p.connected && (
                <Badge className="bg-red-600/50 text-red-200 text-xs shrink-0">{t('online.disconnected')}</Badge>
              )}
              {p.connected && p.id !== players[0]?.id && (
                <Badge className={`shrink-0 text-xs ${
                  isReady
                    ? 'bg-green-600/50 text-green-200'
                    : 'bg-gray-600/50 text-gray-400'
                }`}>
                  <span className="mr-0.5">{isReady ? '✓' : '○'}</span>
                  {isReady ? t('online.ready') : t('online.notReady')}
                </Badge>
              )}
            </div>
          );
        })}
        {Array.from({ length: Math.max(0, storePlayerCount - players.length) }).map((_, i) => (
          <div key={`waiting-${i}`} className="flex items-center gap-2 sm:gap-3 py-2 px-5 rounded bg-gray-800/20 border border-dashed border-gray-700">
            <span className="text-gray-600 text-sm w-5 sm:w-6">{players.length + i + 1}.</span>
            <span className="text-gray-600 text-sm">{t('online.waitingForPlayer')}</span>
          </div>
        ))}
      </div>

      <p className="text-gray-500 text-xs sm:text-sm text-center">
        {t('online.shareCode')}{' '}
        <span className="text-white font-bold tracking-widest text-base sm:text-lg">{roomCode}</span>
      </p>
    </div>
  );

  const renderForms = () => (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Create Room */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-white text-base sm:text-lg">{t('online.createRoom')}</CardTitle>
            <CardDescription className="text-gray-400 text-xs sm:text-sm">
              {t('online.createRoomDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            {showCreate ? (
              <>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">
                    {t('online.playersLabel', { count: localPlayerCount })}
                  </label>
                  <div className="flex gap-2">
                    {[3, 4, 5].map((n) => (
                      <Button
                        key={n}
                        variant={localPlayerCount === n ? 'default' : 'outline'}
                        className={localPlayerCount === n
                          ? 'bg-red-600 hover:bg-red-700 h-9 sm:h-10 flex-1'
                          : 'border-gray-700 text-gray-300 hover:bg-gray-800 h-9 sm:h-10 flex-1'}
                        onClick={() => setLocalPlayerCount(n)}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">{t('online.betLevel')}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {COIN_LEVELS.map((level, i) => (
                      <Button
                        key={i}
                        variant={coinLevel === i ? 'default' : 'outline'}
                        size="sm"
                        className={coinLevel === i
                          ? 'bg-red-600 hover:bg-red-700 text-xs h-auto py-1.5'
                          : 'border-gray-700 text-gray-300 hover:bg-gray-800 text-xs h-auto py-1.5'}
                        onClick={() => setCoinLevel(i)}
                      >
                        <span className="flex flex-col items-center gap-0.5">
                          <span>{t(`coinLevels.${COIN_LEVEL_KEYS[i]}`)}</span>
                          <span className={coinLevel === i ? 'text-red-200' : 'text-gray-500'}>
                            {t('online.coinMultiplier', { value: level.value })}
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">{t('online.roomVisibility')}</label>
                  <div className="flex gap-2">
                    <Button
                      variant={isPrivate ? 'outline' : 'default'}
                      className={
                        isPrivate
                          ? 'border-gray-700 text-gray-300 hover:bg-gray-800 h-9 flex-1'
                          : 'bg-green-600 hover:bg-green-700 h-9 flex-1'
                      }
                      onClick={() => setIsPrivate(false)}
                    >
                      {t('online.public')}
                    </Button>
                    <Button
                      variant={isPrivate ? 'default' : 'outline'}
                      className={
                        isPrivate
                          ? 'bg-yellow-600 hover:bg-yellow-700 h-9 flex-1'
                          : 'border-gray-700 text-gray-300 hover:bg-gray-800 h-9 flex-1'
                      }
                      onClick={() => setIsPrivate(true)}
                    >
                      {t('online.private')}
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 h-9 sm:h-10"
                    onClick={() => setShowCreate(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 h-9 sm:h-10"
                    onClick={handleCreateRoom}
                  >
                    {t('online.create')}
                  </Button>
                </div>
              </>
            ) : (
              <Button className="w-full bg-red-600 hover:bg-red-700 h-10 sm:h-11" onClick={() => setShowCreate(true)}>
                {t('online.createNewRoom')}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Join Room */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-white text-base sm:text-lg">{t('online.joinRoom')}</CardTitle>
            <CardDescription className="text-gray-400 text-xs sm:text-sm">
              {t('online.joinRoomDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            <Input
              placeholder={t('online.joinRoomPlaceholder')}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-11 text-center tracking-widest text-base sm:text-lg"
            />
            <Button
              className="w-full bg-red-600 hover:bg-red-700 h-10 sm:h-11"
              disabled={joinCode.trim().length < 4}
              onClick={handleJoinRoom}
            >
              {t('online.joinRoom')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Public Room List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-gray-400 uppercase tracking-wider">
            {t('online.availableRooms')}
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 h-7 text-xs"
            onClick={loadRooms}
            disabled={roomsLoading}
          >
            {t('online.refreshRooms')}
          </Button>
        </div>
        {roomsLoading && publicRooms.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">{t('common.loading')}</div>
        ) : publicRooms.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm bg-gray-900/50 rounded-lg border border-dashed border-gray-800">
            {t('online.noRooms')}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {publicRooms.map((room) => {
              const host = room.players.find((p) => p.id === room.hostId);
              const coinKey = COIN_VALUE_TO_KEY[room.config.coinValue];
              return (
                <div
                  key={room.code}
                  className="flex items-center justify-between bg-gray-900/70 border border-gray-800 rounded-lg px-4 py-3 hover:border-red-500/30 transition-colors"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold tracking-wider text-sm">
                        {room.code}
                      </span>
                      {coinKey && (
                        <span className="text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                          {t(`coinLevels.${coinKey}`)}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {t('online.playersInRoom', {
                        current: room.players.length,
                        max: room.config.playerCount,
                      })}
                    </p>
                    {host && (
                      <p className="text-gray-600 text-[10px] truncate">
                        {t('online.hostLabel', { name: host.name })}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 h-8 text-xs shrink-0"
                    onClick={() => {
                      setJoinCode(room.code);
                      joinRoom(room.code);
                    }}
                  >
                    {t('online.joinButton')}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">{t('online.title')}</h1>
        <p className="text-sm text-gray-400 mb-6 sm:mb-8">{t('online.subtitle')}</p>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-600/20 border border-red-600/30 text-red-300 text-sm">
            {error}
            <button className="ml-2 underline" onClick={() => setError(null)}>{t('online.dismiss')}</button>
          </div>
        )}

        {!mounted || isReconnecting ? (
          <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
        ) : (phase === 'lobby' || phase === 'game-over') && roomCode ? (
          renderLobby()
        ) : phase === 'ready-check' || phase === 'playing' ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-gray-400">{t('game.starting')}</p>
          </div>
        ) : (
          renderForms()
        )}

        {/* Ready button at bottom right for non-host players */}
        {(phase === 'lobby' || phase === 'game-over') && roomCode &&
         userId !== players[0]?.id && (
          <div className="fixed right-6 z-50">
            <Button
              size="lg"
              className={readyPlayers.includes(userId)
                ? 'bg-green-600 hover:bg-green-700 shadow-lg px-6 rounded-full'
                : 'bg-gray-700 hover:bg-gray-600 shadow-lg px-6 rounded-full'}
              onClick={toggleReady}
            >
              {readyPlayers.includes(userId) ? t('online.ready') : t('online.readyButton')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
