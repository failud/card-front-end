'use client';

import { useEffect } from 'react';
import { useLocaleStore } from '@/stores/locale-store';
import { useTranslations } from '@/lib/i18n';

export function LangProvider() {
  const locale = useLocaleStore((s) => s.locale);
  const { t } = useTranslations();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    document.title = t('meta.title');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('meta.description'));
  }, [locale, t]);

  return null;
}
