'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as api from '@/lib/api';

interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  totalPoints: number;
  instantWins: number;
}

interface AuthState {
  nickname: string;
  isLoggedIn: boolean;
  userId: string;
  token: string;
  stats: UserStats;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      nickname: '',
      isLoggedIn: false,
      userId: '',
      token: '',
      stats: { gamesPlayed: 0, gamesWon: 0, totalPoints: 0, instantWins: 0 },
      loading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const data = await api.login(username, password);
          api.setToken(data.token);
          set({
            token: data.token,
            userId: data.user.id,
            nickname: data.user.displayName,
            isLoggedIn: true,
            stats: data.user.stats,
            loading: false,
          });
          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Login failed';
          set({ error: message, loading: false });
          return false;
        }
      },

      logout: () => {
        api.clearToken();
        set({
          nickname: '',
          isLoggedIn: false,
          userId: '',
          token: '',
          stats: { gamesPlayed: 0, gamesWon: 0, totalPoints: 0, instantWins: 0 },
        });
      },

      refreshProfile: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const profile = await api.fetchMe();
          set({
            nickname: profile.displayName,
            stats: profile.stats,
          });
        } catch {
          // Token expired — logout
          get().logout();
        }
      },
    }),
    {
      name: 'koi-auth',
      partialize: (state) => ({
        nickname: state.nickname,
        isLoggedIn: state.isLoggedIn,
        userId: state.userId,
        token: state.token,
        stats: state.stats,
      }),
    },
  ),
);
