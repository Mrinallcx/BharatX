import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { isPageTemporarilyDisabled } from '@/lib/constants';

const authRoutes = ['/sign-in', '/sign-up'];
// All routes are now accessible to everyone - no protected routes

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log('Pathname: ', pathname);
  if (pathname === '/api/search') return NextResponse.next();
  if (pathname.startsWith('/new') || pathname.startsWith('/api/search')) {
    return NextResponse.next();
  }

  // /api/payments/webhooks is a webhook endpoint that should be accessible without authentication
  if (pathname.startsWith('/api/payments/webhooks')) {
    return NextResponse.next();
  }

  // /api/auth/polar/webhooks
  if (pathname.startsWith('/api/auth/polar/webhooks')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/auth/dodopayments/webhooks')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/raycast')) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);

  // Redirect sign-in and sign-up routes to main page (disabled)
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Temporarily disabled pages → main chat
  if (isPageTemporarilyDisabled(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // All routes accessible to everyone - no authentication required

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
