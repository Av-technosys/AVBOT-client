'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { ConnectionRecords } from '@/components/connection-records';
import { SalesforceAccountForm } from '@/components/salesforce-account-form';
import { SalesforceImportStatus } from '@/components/salesforce-import-status';
import { TenantBreadcrumb } from '@/components/tenant-breadcrumb';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SecretInput } from '@/components/ui/secret-input';
import { deleteSalesforceAccount, getSalesforceAccount, type SalesforceAccount } from '@/lib/api';
import { salesforceAccountPath, salesforceSyncLabel } from '@/lib/salesforce-account';

export default function SalesforceAccountDetailPage() {
  const { tenantId, accountId } = useParams<{ tenantId: string; accountId: string }>();
  return (
    <SalesforceAccountDetail
      key={`${tenantId}:${accountId}`}
      tenantId={tenantId}
      accountId={accountId}
    />
  );
}

function SalesforceAccountDetail({ tenantId, accountId }: { tenantId: string; accountId: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<SalesforceAccount | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const listPath = salesforceAccountPath(tenantId);

  useEffect(() => {
    let active = true;
    getSalesforceAccount(tenantId, accountId)
      .then(({ data }) => {
        if (active) {
          setAccount(data);
          setError('');
        }
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [tenantId, accountId, reload]);

  async function remove() {
    if (
      !account ||
      deleting ||
      editing ||
      !window.confirm(
        `Delete Salesforce account "${account.username}" and its API mappings and sync history? Linked contacts will be kept. This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    try {
      await deleteSalesforceAccount(tenantId, accountId);
      toast.success('Salesforce account deleted');
      router.replace(listPath);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete Salesforce account');
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TenantBreadcrumb
        tenantId={tenantId}
        currentPage={account?.username || 'Account details'}
        parentPage={{ label: 'Salesforce accounts', href: listPath }}
      />
      <div>
        <Link href={listPath} className={buttonVariants({ variant: 'outline' })}>
          <ArrowLeftIcon /> All Salesforce accounts
        </Link>
      </div>
      {error ? (
        <div role="alert" className="space-y-2">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" onClick={() => setReload((value) => value + 1)}>
            Retry
          </Button>
        </div>
      ) : !account ? (
        <p className="text-muted-foreground text-sm">Loading Salesforce account...</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold break-all">{account.username}</h1>
              <p className="text-muted-foreground mt-1 text-sm">Salesforce account details</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={editing || deleting}
                onClick={() => setEditing(true)}
              >
                <PencilIcon /> Edit account
              </Button>
              <Button variant="destructive" disabled={editing || deleting} onClick={remove}>
                <Trash2Icon /> {deleting ? 'Deleting...' : 'Delete account'}
              </Button>
            </div>
          </div>

          {editing ? (
            <SalesforceAccountForm
              tenantId={tenantId}
              account={account}
              onCancel={() => setEditing(false)}
              onSaved={(saved) => {
                setAccount(saved);
                setEditing(false);
                setReload((value) => value + 1);
              }}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Account configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  {[
                    ['Username', account.username],
                    ['Salesforce API URL', account.salesforceApiUrl],
                    ['Salesforce Login URL', account.salesforceLoginUrl],
                    ['Client ID', account.clientId],
                    ['Grant type', account.grantType],
                    ['Sync data from', salesforceSyncLabel(account.syncObjects)],
                    ['Created', new Date(account.createdAt).toLocaleString('en-IN')],
                    ['Updated', new Date(account.updatedAt).toLocaleString('en-IN')],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-all">{value}</dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-muted-foreground">
                      <label htmlFor="salesforce-client-secret">Client Secret</label>
                    </dt>
                    <dd className="mt-1">
                      <SecretInput
                        id="salesforce-client-secret"
                        label="client secret"
                        value={account.clientSecret}
                        readOnly
                        autoComplete="off"
                      />
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}

          <SalesforceImportStatus
            key={`${accountId}:${reload}`}
            tenantId={tenantId}
            accountId={accountId}
          />
          <section aria-label={`API mappings for Salesforce account ${account.username}`}>
            <fieldset disabled={editing || deleting} className="min-w-0">
              <ConnectionRecords
                tenantId={tenantId}
                kind={`salesforce-accounts/${accountId}/api-mappings`}
              />
            </fieldset>
          </section>
        </>
      )}
    </div>
  );
}
