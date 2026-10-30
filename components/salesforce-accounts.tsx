'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRightIcon, PlugIcon, PlusIcon } from 'lucide-react';
import { SalesforceAccountForm } from '@/components/salesforce-account-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TenantBreadcrumb } from '@/components/tenant-breadcrumb';
import { listSalesforceAccounts, type SalesforceAccount } from '@/lib/api';
import { salesforceAccountPath, salesforceSyncLabel } from '@/lib/salesforce-account';

export default function SalesforceConnectPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  return <SalesforceAccounts key={tenantId} tenantId={tenantId} />;
}

function SalesforceAccounts({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SalesforceAccount[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    listSalesforceAccounts(tenantId)
      .then(({ data }) => {
        if (!active) return;
        setAccounts(data);
        setLoadError('');
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [tenantId, reload]);

  return (
    <div className="flex flex-col gap-4">
      <TenantBreadcrumb currentPage="Salesforce accounts" tenantId={tenantId} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Salesforce accounts</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Open an account to view its details, API mappings, and data sync status.
          </p>
        </div>
        <Button disabled={connecting} onClick={() => setConnecting(true)}>
          <PlusIcon /> Connect Salesforce account
        </Button>
      </div>

      {connecting && (
        <SalesforceAccountForm
          tenantId={tenantId}
          onCancel={() => setConnecting(false)}
          onSaved={(account) => router.push(salesforceAccountPath(tenantId, account.id))}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugIcon className="size-4" /> Connected accounts
          </CardTitle>
          <CardDescription>Each Salesforce account has its own page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loaded && (
            <p className="text-muted-foreground text-sm">Loading Salesforce accounts...</p>
          )}
          {loadError && (
            <div role="alert" className="space-y-2">
              <p className="text-destructive text-sm">{loadError}</p>
              <Button variant="outline" onClick={() => setReload((value) => value + 1)}>
                Retry
              </Button>
            </div>
          )}
          {loaded && !loadError && !accounts.length && (
            <p className="text-muted-foreground text-sm">
              No Salesforce accounts configured. Connect an account to get started.
            </p>
          )}
          {!loadError && (
            <div className="grid gap-3 sm:grid-cols-2">
              {accounts.map((account) => (
                <Link
                  key={account.id}
                  href={salesforceAccountPath(tenantId, account.id)}
                  className="hover:border-primary focus-visible:ring-ring space-y-3 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium break-all">{account.username}</p>
                      <p className="text-muted-foreground text-xs break-all">
                        {account.salesforceApiUrl}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Sync: {salesforceSyncLabel(account.syncObjects)}
                      </p>
                    </div>
                    <ArrowRightIcon className="text-muted-foreground mt-1 size-4 shrink-0" />
                  </div>
                  <p className="text-primary text-sm font-medium">View account</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
