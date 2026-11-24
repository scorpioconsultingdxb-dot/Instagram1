import { NextResponse, type NextRequest } from 'next/server';
import {
  isSupportedLocale,
  matchLocaleFromAcceptLanguage,
  SUPPORTED_LOCALES,
} from '@/i18n/config';

const PUBLIC_FILE_PATTERN = /\.(.*)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip internal Next routes, API routes, sitemap/robots, and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg' ||
    pathname === '/opengraph-image' ||
    PUBLIC_FILE_PATTERN.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check if path already starts with a supported locale
  const firstSegment = pathname.split('/')[1] ?? '';
  if (isSupportedLocale(firstSegment)) {
    const response = NextResponse.next();
    response.headers.set('x-viewora-locale', firstSegment);
    return response;
  }

  // Check persisted locale cookie or Accept-Language header
  const cookieLocale = request.cookies.get('viewora_locale')?.value;
  const preferredLocale =
    cookieLocale && isSupportedLocale(cookieLocale)
      ? cookieLocale
      : matchLocaleFromAcceptLanguage(request.headers.get('accept-language'));

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname =
    pathname === '/' ? `/${preferredLocale}` : `/${preferredLocale}${pathname}`;

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};

export { SUPPORTED_LOCALES };
