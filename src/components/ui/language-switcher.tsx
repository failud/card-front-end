'use client';

import { useLocaleStore } from '@/stores/locale-store';
import { LOCALES } from '@/types';
import { Button } from './button';

export function LanguageSwitcher() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <div className="flex gap-1">
      {LOCALES.map(({ code, label }) => (
        <Button
          key={code}
          size="sm"
          variant={locale === code ? 'default' : 'outline'}
          className={
            locale === code
              ? 'bg-red-600 hover:bg-red-700 text-xs h-7 px-2'
              : 'border-gray-700 text-gray-300 hover:bg-gray-800 text-xs h-7 px-2'
          }
          onClick={() => setLocale(code)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
