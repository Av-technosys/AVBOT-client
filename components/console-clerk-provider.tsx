import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import type { ReactNode } from 'react';

export function ConsoleClerkProvider({ children }: { children: ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return (
      <main className="grid min-h-screen place-content-center p-6 text-center">
        <h1 className="text-xl font-semibold">Sign-in is unavailable</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Configure the application’s Clerk keys to continue.
        </p>
      </main>
    );
  }

  return (
    <ClerkProvider
      appearance={{ theme: shadcn }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
