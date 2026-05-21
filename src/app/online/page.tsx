'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useOnlineGameStore } from '@/stores/online-game-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { COIN_LEVELS } from '@/lib/constants';
import { useTranslations } from '@/lib/i18n';

const COIN_LEVEL_KEYS = ['casual', 'low', 'medium', 'standard', 'high', 'veryHigh', 'premium'] as const;

export default function OnlinePage() {
  const router = useRouter();
  const { nickname, token } = useAuthStore();
  const { t } = useTranslations();
  const {
    phase, roomCode, isHost, playerCount: storePlayerCount, players, error,
    createRoom, joinRoom, leaveRoom, startGame, listenToEvents, setError,
  } = useOnlineGameStore();

  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [localPlayerCount, setLocalPlayerCount] = useState(3);
  const [coinLevel, setCoinLevel] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!nickname) { router.push('/'); return; }
    listenToEvents(token);
  }, [nickname, token, router, listenToEvents]);

  // Navigate to game when it starts
  useEffect(() => {
    if (phase === 'ready-check' || phase === 'playing') {
      router.push(`/online/${roomCode}`);
    }
  }, [phase, roomCode, router]);

  const handleCreateRoom = () => {
    createRoom(localPlayerCount, COIN_LEVELS[coinLevel].value);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            Room: <span className="text-red-400">{roomCode}</span>
          </h2>
          <p className="text-gray-400 text-sm">
            {players.length} / {storePlayerCount} players
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
            onClick={handleLeave}
          >
            {t('common.back')}
          </Button>
          {isHost && (
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={players.length < 3}
              onClick={startGame}
            >
              {t('modes.startButton')}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-500 uppercase">Players</p>
        {players.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 py-2 px-3 rounded bg-gray-800/50">
            <span className="text-gray-400 text-sm w-6">{i + 1}.</span>
            <span className="text-white flex-1">{p.name}</span>
            {p.id === players[0]?.id && (
              <Badge className="bg-yellow-600/50 text-yellow-200 text-xs">Host</Badge>
            )}
            {!p.connected && (
              <Badge className="bg-red-600/50 text-red-200 text-xs">Disconnected</Badge>
            )}
          </div>
        ))}
        {Array.from({ length: Math.max(0, storePlayerCount - players.length) }).map((_, i) => (
          <div key={`waiting-${i}`} className="flex items-center gap-3 py-2 px-3 rounded bg-gray-800/20 border border-dashed border-gray-700">
            <span className="text-gray-600 text-sm w-6">{players.length + i + 1}.</span>
            <span className="text-gray-600">Waiting for player...</span>
          </div>
        ))}
      </div>

      <p className="text-gray-500 text-sm text-center">
        Share this code: <span className="text-white font-bold tracking-widest text-lg">{roomCode}</span>
      </p>
    </div>
  );

  const renderForms = () => (
    <div className="grid gap-4 sm:grid-cols-2 max-w-xl mx-auto">
      {/* Create Room */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">Create Room</CardTitle>
          <CardDescription className="text-gray-400">
            Create a new game room and share the code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCreate ? (
            <>
              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  Players: {localPlayerCount}
                </label>
                <div className="flex gap-2">
                  {[3, 4].map((n) => (
                    <Button
                      key={n}
                      variant={localPlayerCount === n ? 'default' : 'outline'}
                      className={localPlayerCount === n
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'border-gray-700 text-gray-300 hover:bg-gray-800'}
                      onClick={() => setLocalPlayerCount(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-300 block mb-2">Bet Level</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {COIN_LEVELS.map((level, i) => (
                    <Button
                      key={i}
                      variant={coinLevel === i ? 'default' : 'outline'}
                      size="sm"
                      className={coinLevel === i
                        ? 'bg-red-600 hover:bg-red-700 text-xs'
                        : 'border-gray-700 text-gray-300 hover:bg-gray-800 text-xs'}
                      onClick={() => setCoinLevel(i)}
                    >
                      {t(`coinLevels.${COIN_LEVEL_KEYS[i]}`)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={() => setShowCreate(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleCreateRoom}
                >
                  Create
                </Button>
              </div>
            </>
          ) : (
            <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => setShowCreate(true)}>
              Create New Room
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Join Room */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">Join Room</CardTitle>
          <CardDescription className="text-gray-400">
            Enter a room code to join an existing game
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Enter room code (e.g. ABC123)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-11 text-center tracking-widest text-lg"
          />
          <Button
            className="w-full bg-red-600 hover:bg-red-700"
            disabled={joinCode.trim().length < 4}
            onClick={handleJoinRoom}
          >
            Join Room
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Online Multiplayer</h1>
        <p className="text-gray-400 mb-8">Play Koi with real players in real-time</p>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-600/20 border border-red-600/30 text-red-300 text-sm">
            {error}
            <button className="ml-2 underline" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {!mounted ? (
          <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
        ) : phase === 'lobby' && roomCode ? renderLobby() : renderForms()}
      </div>
    </div>
  );
}
