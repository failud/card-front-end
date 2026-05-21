'use client';

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocaleStore } from '@/stores/locale-store';
import type { Locale } from '@/types';

type TranslationValue = string | Record<string, unknown>;
type Translations = Record<string, TranslationValue>;

const localeFiles: Record<Locale, () => Promise<{ default: Translations }>> = {
  en: () => import('@/locales/en.json'),
  th: () => import('@/locales/th.json'),
  lo: () => import('@/locales/lo.json'),
};

interface TOptions {
  defaultValue?: string;
}

interface I18nContextValue {
  t: (key: string, params?: Record<string, string | number> | TOptions) => string;
  locale: Locale;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveValue(obj: Translations, path: string): string {
  const keys = path.split('.');
  let current: TranslationValue = obj;
  for (const key of keys) {
    if (typeof current !== 'object' || current === null) return '';
    current = (current as Record<string, TranslationValue>)[key];
    if (current === undefined) return '';
  }
  return typeof current === 'string' ? current : '';
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useLocaleStore((s) => s.locale);
  const [translations, setTranslations] = useState<Translations | null>(null);

  useEffect(() => {
    localeFiles[locale]().then((mod) => setTranslations(mod.default));
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number> | TOptions): string => {
      if (!translations) return typeof params === 'object' && 'defaultValue' in params ? (params as TOptions).defaultValue ?? key : key;
      const value = resolveValue(translations, key);
      if (!value) {
        if (typeof params === 'object' && 'defaultValue' in params) return (params as TOptions).defaultValue ?? key;
        return key;
      }
      const interpolationParams = typeof params === 'object' && !('defaultValue' in params) ? params : undefined;
      return interpolate(value, interpolationParams as Record<string, string | number> | undefined);
    },
    [translations],
  );

  return <I18nContext.Provider value={{ t, locale }}>{children}</I18nContext.Provider>;
}

export function useTranslations() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      t: (key: string, params?: Record<string, string | number> | TOptions) =>
        typeof params === 'object' && 'defaultValue' in params ? (params as TOptions).defaultValue ?? key : key,
      locale: 'th' as Locale,
    };
  }
  return ctx;
}
