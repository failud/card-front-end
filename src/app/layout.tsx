import type { Metadata } from 'next';
import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Topbar } from '@/components/layout/topbar';
import { Sidebar } from '@/components/layout/sidebar';
import { I18nProvider } from '@/lib/i18n';
import { LangProvider } from '@/components/ui/lang-provider';
import { Toast } from '@/components/ui/toast';
import { Noto_Sans_Lao } from 'next/font/google';

const notoSansLao = Noto_Sans_Lao({
  subsets: ['lao'],
  variable: '--font-noto-sans-lao',
});

export const metadata: Metadata = {
  title: 'ໄພ່ Koi — Card Game',
  description: 'ໄພ່ Koi — ເກມໄພ່ລາວດັ້ງເດີມ',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${notoSansLao.variable} h-full antialiased dark`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-gray-950 text-white">
        <TooltipProvider>
          <I18nProvider>
            <LangProvider />
            <Toast />
            <Topbar />
            <div className="flex flex-1">
              <Sidebar />
              <main className="flex-1 lg:ml-64">{children}</main>
            </div>
          </I18nProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
