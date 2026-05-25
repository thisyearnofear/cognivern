import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const demoExplored = request.cookies.get('demoExplored')?.value;
  const onboarded = request.cookies.get('onboardingCompleted')?.value;
  const path = request.nextUrl.pathname;

  const canAccessApp = onboarded === 'true' || demoExplored === 'true';

  if (path === '/' && canAccessApp) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (path.startsWith('/dashboard') && !canAccessApp && path !== '/') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|os).*)'],
};
