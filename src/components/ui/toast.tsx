'use client';

import { useToastStore } from '@/stores/toast-store';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export function Toast() {
  const { message, type, visible, hide } = useToastStore();

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium max-w-sm text-center animate-in fade-in slide-in-from-top-4',
          type === 'error' && 'bg-red-900/95 border border-red-700/50 text-red-100',
          type === 'success' && 'bg-green-900/95 border border-green-700/50 text-green-100',
          type === 'info' && 'bg-gray-900/95 border border-gray-700/50 text-gray-100',
        )}
        style={{
          animation: 'toast-in 0.25s ease-out',
        }}
      >
        <span className="flex-1">{message}</span>
        <button
          onClick={hide}
          className="p-0.5 rounded hover:bg-black/20 transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
