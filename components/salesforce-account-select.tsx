'use client';

import { useEffect, useState } from 'react';
import { listSalesforceAccounts, type SalesforceAccount } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function SalesforceAccountSelect({
  tenant,
  value,
  onChange,
}: {
  tenant: string;
  value: string;
  onChange: (accountId: string) => void;
}) {
  const [result, setResult] = useState<{
    accounts: SalesforceAccount[];
    error: string;
  } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    listSalesforceAccounts(tenant)
      .then(({ data }) => {
        if (active) setResult({ accounts: data, error: '' });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            accounts: [],
            error: error instanceof Error ? error.message : 'Could not load Salesforce accounts',
          });
      });
    return () => {
      active = false;
    };
  }, [tenant, reload]);

  return (
    <div className="space-y-2">
      <Label htmlFor="contact-salesforce-account">Salesforce account (optional)</Label>
      <select
        id="contact-salesforce-account"
        className="bg-background w-full rounded-lg border p-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby="contact-salesforce-account-help"
      >
        <option value="">No Salesforce account</option>
        {value && !result?.accounts.some((account) => account.id === value) && (
          <option value={value}>Current account ({value})</option>
        )}
        {result?.accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.username} — {account.salesforceApiUrl}
          </option>
        ))}
      </select>
      <p id="contact-salesforce-account-help" className="text-muted-foreground text-xs">
        {!result
          ? 'Loading Salesforce accounts...'
          : result.error
            ? 'Accounts could not be loaded. You can still save without an account.'
            : result.accounts.length
              ? 'Leave empty to create a contact without a Salesforce account.'
              : 'No Salesforce accounts configured for this tenant. You can leave this empty.'}
      </p>
      {result?.error && (
        <div role="alert" className="space-y-2">
          <p className="text-destructive text-sm">{result.error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setResult(null);
              setReload((previous) => previous + 1);
            }}
          >
            Retry loading accounts
          </Button>
        </div>
      )}
    </div>
  );
}
