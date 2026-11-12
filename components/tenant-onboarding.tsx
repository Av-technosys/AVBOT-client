'use client';

import { UserButton } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OnboardingChoice, TenantOnboarding as OnboardingData } from '@/lib/tenant-users-api';

export function TenantOnboarding({
  data,
  onSubmit,
  onRefresh,
}: {
  data: OnboardingData;
  onSubmit: (choice: OnboardingChoice) => Promise<void>;
  onRefresh: () => void;
}) {
  const invitationId = useSearchParams().get('invitation');
  const preferred = data.invitations.find((invite) => invite.id === invitationId);
  const invitations = preferred
    ? [preferred, ...data.invitations.filter((invite) => invite.id !== preferred.id)]
    : data.invitations;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function submit(choice: OnboardingChoice, action: string) {
    setBusy(action);
    setError('');
    try {
      await onSubmit(choice);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not complete setup.');
    } finally {
      setBusy(null);
    }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void submit(
      {
        name: String(fields.get('name') ?? ''),
        companyName: String(fields.get('companyName') ?? ''),
      },
      'create',
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-5 py-10 sm:py-16">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Set up your workspace</h1>
          <p className="text-muted-foreground mt-1 text-sm break-all">Signed in as {data.email}</p>
        </div>
        <UserButton />
      </header>
      {invitationId && !preferred && (
        <p role="status" className="text-muted-foreground text-sm">
          This invitation is unavailable for your email. Check that you signed in with the address
          that was invited.
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitations.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium break-words">{invite.tenantName}</p>
                  <p className="text-muted-foreground text-sm capitalize">
                    {invite.role.toLowerCase()}
                  </p>
                </div>
                <Button
                  disabled={busy !== null}
                  onClick={() => void submit({ invitationId: invite.id }, invite.id)}
                >
                  {busy === invite.id ? 'Joining…' : 'Join tenant'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Create a tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={create}>
            <div className="space-y-2">
              <Label htmlFor="onboarding-name">Tenant name</Label>
              <Input id="onboarding-name" name="name" required maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-company">Company name (optional)</Label>
              <Input id="onboarding-company" name="companyName" maxLength={255} />
            </div>
            <Button type="submit" disabled={busy !== null}>
              {busy === 'create' ? 'Creating…' : 'Create tenant'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Button variant="outline" disabled={busy !== null} onClick={onRefresh}>
        Check for invitations
      </Button>
    </main>
  );
}
