'use client';

import { create } from 'zustand';

interface ViewportState {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
}

const MOBILE_BP = 640;
const TABLET_BP = 1024;
const COMPACT_HEIGHT = 500;

function derive(w: number, h: number) {
  return {
    width: w,
    height: h,
    isMobile: w < MOBILE_BP || h < COMPACT_HEIGHT,
    isTablet: w >= MOBILE_BP && w < TABLET_BP && h >= COMPACT_HEIGHT,
    isDesktop: w >= TABLET_BP && h >= COMPACT_HEIGHT,
    isLandscape: w > h,
    isPortrait: w <= h,
  };
}

function getClientSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

export const useViewportStore = create<ViewportState>()((set) => {
  const initial = derive(getClientSize().width, getClientSize().height);

  if (typeof window !== 'undefined') {
    const handler = () => set(derive(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', handler);
  }

  return initial;
});
