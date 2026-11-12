'use client';

import { useAuth, useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from 'react';
import { TenantOnboarding } from '@/components/tenant-onboarding';
import { Button } from '@/components/ui/button';
import { registerApiTokenGetter, request } from '@/lib/api';
import type {
  OnboardingChoice,
  TenantOnboarding as OnboardingData,
  TenantRole,
} from '@/lib/tenant-users-api';

type ConsoleUser =
  | { isAdmin: true }
  | {
      isAdmin: false;
      tenantId: number;
      tenantUserId: string;
      role: TenantRole;
    };

type SessionResponse =
  { data: ConsoleUser; refreshToken: boolean } | { data: null; onboarding: OnboardingData };

const ConsoleUserContext = createContext<ConsoleUser | null>(null);

export function useConsoleUser() {
  const user = useContext(ConsoleUserContext);
  if (!user) throw new Error('Console session is unavailable.');
  return user;
}

export function canManageTenant(user: ConsoleUser) {
  return user.isAdmin || user.role === 'OWNER' || user.role === 'ADMIN';
}

export function ConsoleSession({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  if (!isLoaded) return <SessionLoading />;
  if (!isSignedIn) return <SessionNotice message="Sign in to access the console." />;
  return <InitializeSession key={sessionId}>{children}</InitializeSession>;
}

function InitializeSession({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<
    { user: ConsoleUser } | { onboarding: OnboardingData } | { error: string } | null
  >(null);

  function refreshSession() {
    setResult(null);
    setRetry((value) => value + 1);
  }

  async function completeOnboarding(choice: OnboardingChoice) {
    const token = await getToken();
    if (!token) throw new Error('Sign in to continue.');
    const { data } = await request<{ data: { tenantId: number } }>('/auth/onboarding', {
      method: 'POST',
      data: choice,
      headers: { Authorization: `Bearer ${token}` },
    });
    refreshSession();
    router.replace(`/tenant/${data.tenantId}`);
  }

  useEffect(() => {
    const controller = new AbortController();
    let unregister: (() => void) | undefined;

    async function initialize() {
      const token = await getToken();
      if (!token) throw new Error('Sign in to access the console.');
      const response = await request<SessionResponse>('/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (response.data === null) {
        if (!controller.signal.aborted) setResult({ onboarding: response.onboarding });
        return;
      }
      let user = response.data;
      if (response.refreshToken) {
        const refreshed = await getToken({ skipCache: true });
        if (!refreshed) throw new Error('Sign in to access the console.');
        ({ data: user } = await request<{ data: ConsoleUser }>('/auth/session', {
          headers: { Authorization: `Bearer ${refreshed}` },
          signal: controller.signal,
        }));
      }
      if (controller.signal.aborted) return;
      unregister = registerApiTokenGetter(getToken);
      setResult({ user });
    }

    void initialize().catch((error: unknown) => {
      if (!controller.signal.aborted)
        setResult({
          error: error instanceof Error ? error.message : 'Could not load your console session.',
        });
    });
    return () => {
      controller.abort();
      unregister?.();
    };
  }, [getToken, retry]);

  if (!result) return <SessionLoading />;
  if ('error' in result) return <SessionNotice message={result.error} onRetry={refreshSession} />;
  if ('onboarding' in result)
    return (
      <Suspense fallback={<SessionLoading />}>
        <TenantOnboarding
          data={result.onboarding}
          onSubmit={completeOnboarding}
          onRefresh={refreshSession}
        />
      </Suspense>
    );
  return <ConsoleUserContext.Provider value={result.user}>{children}</ConsoleUserContext.Provider>;
}

function SessionLoading() {
  return (
    <p role="status" className="text-muted-foreground p-6 text-sm">
      Loading your session…
    </p>
  );
}

function SessionNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <p role="alert">{message}</p>
      <div className="flex gap-3">
        {onRetry && <Button onClick={onRetry}>Retry</Button>}
        {isSignedIn ? (
          <Button variant="outline" onClick={() => void signOut({ redirectUrl: '/sign-in' })}>
            Sign out
          </Button>
        ) : (
          <Link className="underline" href="/sign-in">
            Sign in
          </Link>
        )}
      </div>
    </main>
  );
}
