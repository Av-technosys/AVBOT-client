'use client';

import { useState, type ComponentProps } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SecretInput } from '@/components/ui/secret-input';
import { Label } from '@/components/ui/label';
import {
  saveSalesforceAccount,
  type SalesforceAccount,
  type SalesforceAccountInput,
} from '@/lib/api';
import { salesforceSyncOptions } from '@/lib/salesforce-account';
import { ImportMarketingPreference } from '@/components/import-marketing-preference';

const fields = [
  { key: 'salesforceLoginUrl', label: 'Salesforce Login URL', maxLength: 512 },
  { key: 'salesforceApiUrl', label: 'Salesforce API URL', maxLength: 512 },
  { key: 'clientId', label: 'Client ID', maxLength: 255 },
  { key: 'clientSecret', label: 'Client Secret', maxLength: 255, secret: true },
  { key: 'username', label: 'Username', maxLength: 255 },
  { key: 'password', label: 'Password', maxLength: 255, secret: true },
  { key: 'grantType', label: 'Grant Type', maxLength: 100 },
] as const;

export function SalesforceAccountForm({
  tenantId,
  account,
  onSaved,
  onCancel,
}: {
  tenantId: string;
  account?: SalesforceAccount;
  onSaved: (account: SalesforceAccount) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SalesforceAccountInput>(() => ({
    salesforceLoginUrl: account?.salesforceLoginUrl ?? '',
    salesforceApiUrl: account?.salesforceApiUrl ?? '',
    clientId: account?.clientId ?? '',
    clientSecret: account?.clientSecret ?? '',
    username: account?.username ?? '',
    password: '',
    grantType: account?.grantType ?? '',
    syncObjects: [...(account?.syncObjects ?? [])],
  }));
  const [busy, setBusy] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!account && !form.syncObjects.length) {
      toast.error('Choose Leads, Contacts, or both to sync.');
      return;
    }
    const body: Parameters<typeof saveSalesforceAccount>[1] = { ...form, marketingOptIn };
    if (account) {
      delete body.syncObjects;
      if (!form.clientSecret) delete body.clientSecret;
      if (!form.password) delete body.password;
    }
    setBusy(true);
    try {
      const { data, importJobs } = await saveSalesforceAccount(tenantId, body, account?.id);
      const message = account ? 'Salesforce account updated' : 'Salesforce account connected';
      toast.success(`${message}${importJobs.length ? '; imports queued' : ''}`);
      onSaved(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save Salesforce account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{account ? 'Edit Salesforce account' : 'Connect Salesforce account'}</CardTitle>
        <CardDescription>
          {account
            ? 'Leave the client secret or password blank to keep its saved value.'
            : 'Enter your credentials and choose which data to sync.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const secret = 'secret' in field;
              const inputProps: ComponentProps<typeof Input> = {
                id: `salesforce-${field.key}`,
                autoComplete: 'off',
                maxLength: field.maxLength,
                value: form[field.key],
                required: !secret || !account,
                onChange: (event) =>
                  setForm((previous) => ({ ...previous, [field.key]: event.target.value })),
              };
              return (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`salesforce-${field.key}`}>{field.label}</Label>
                  {secret ? (
                    <SecretInput {...inputProps} label={field.label.toLowerCase()} />
                  ) : (
                    <Input {...inputProps} />
                  )}
                </div>
              );
            })}
          </fieldset>
          <fieldset disabled={busy || !!account} className="space-y-3">
            <legend className="mb-2 text-sm font-medium">Sync data from</legend>
            <p className="text-muted-foreground text-sm" id="salesforce-sync-help">
              {account
                ? 'Sync sources are set when connecting the account and cannot be changed.'
                : 'Choose Leads, Contacts, or both. Connecting the account requests a sync.'}
            </p>
            <div className="flex flex-wrap gap-6">
              {salesforceSyncOptions.map((option) => (
                <Label key={option.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={form.syncObjects.includes(option.value)}
                    aria-describedby="salesforce-sync-help"
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setForm((previous) => ({
                        ...previous,
                        syncObjects: checked
                          ? [...previous.syncObjects, option.value]
                          : previous.syncObjects.filter((value) => value !== option.value),
                      }));
                    }}
                  />
                  {option.label}
                </Label>
              ))}
            </div>
          </fieldset>
          <ImportMarketingPreference
            value={marketingOptIn}
            onChange={setMarketingOptIn}
            disabled={busy}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving...' : account ? 'Save account' : 'Connect account'}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
