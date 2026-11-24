import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, isSupportedLocale } from '@/i18n/config';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { CookieConsentBanner } from '@/components/ui/CookieConsentBanner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Viewora — Explore More. Discover More.',
    template: '%s | Viewora',
  },
  description:
    'Privacy-first social intelligence platform to explore legitimately accessible public Instagram content, analyze profile performance, and unlock transparent AI analytics.',
};

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('viewora_theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'dark' || ((!stored || stored === 'system') && prefersDark);
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const headerLocale = headerList.get('x-viewora-locale') ?? DEFAULT_LOCALE;
  const lang = isSupportedLocale(headerLocale) ? headerLocale : DEFAULT_LOCALE;

  return (
    <html
      lang={lang}
      className={`${inter.variable} ${plusJakarta.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          {children}
          <CookieConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
