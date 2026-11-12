import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';

const isAdminSignIn = createRouteMatcher(['/admin/sign-in(.*)']);
const isSignIn = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);
const isAdmin = createRouteMatcher(['/admin(.*)']);

const handleClerk = clerkMiddleware(
  async (auth, request) => {
    if (isSignIn(request) || isAdminSignIn(request)) return;
    if (isAdmin(request)) {
      await auth.protect({
        unauthenticatedUrl: new URL('/admin/sign-in', request.url).href,
      });
      return;
    }
    await auth.protect();
  },
  { signInUrl: '/sign-in', signUpUrl: '/sign-up' },
);

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    if (isSignIn(request) || isAdminSignIn(request)) return NextResponse.next();
    return NextResponse.redirect(
      new URL(isAdmin(request) ? '/admin/sign-in' : '/sign-in', request.url),
    );
  }
  return handleClerk(request, event);
}

export const config = {
  matcher: [
    '/',
    '/tenant/:path*',
    '/settings/:path*',
    '/salesforce-connect/:path*',
    '/admin/:path*',
    '/sign-in/:path*',
    '/sign-up/:path*',
  ],
};
