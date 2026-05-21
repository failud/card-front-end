'use client';

import { create } from 'zustand';

type ToastType = 'error' | 'success' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
  show: (message: string, type?: ToastType) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  type: 'error',
  visible: false,
  show: (message: string, type: ToastType = 'error') => {
    set({ message, type, visible: true });
    setTimeout(() => set({ visible: false }), 2500);
  },
  hide: () => set({ visible: false }),
}));
