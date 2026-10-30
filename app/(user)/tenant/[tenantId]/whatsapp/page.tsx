'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckIcon,
  MessageCircleIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { ConnectionRecords } from '@/components/connection-records';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { TenantBreadcrumb } from '@/components/tenant-breadcrumb';
import {
  listWhatsappAccounts,
  saveWhatsappAccount,
  deleteWhatsappAccount,
  type WhatsappAccount,
} from '@/lib/api';

type AccountForm = {
  businessAccountId: string;
  apiVersion: string;
  accessToken: string;
  encryptedToken: string;
  webhookSecretEncrypted: string;
};
const emptyForm: AccountForm = {
  businessAccountId: '',
  apiVersion: '',
  accessToken: '',
  encryptedToken: '',
  webhookSecretEncrypted: '',
};
const fields: {
  key: keyof AccountForm;
  label: string;
  secret?: boolean;
  savedFlag?: 'hasAccessToken' | 'hasEncryptedToken' | 'hasWebhookSecret';
  maxLength: number;
}[] = [
  { key: 'businessAccountId', label: 'WhatsApp Business Account ID', maxLength: 255 },
  { key: 'apiVersion', label: 'API version', maxLength: 512 },
  {
    key: 'accessToken',
    label: 'Access token (optional)',
    secret: true,
    savedFlag: 'hasAccessToken',
    maxLength: 512,
  },
  {
    key: 'encryptedToken',
    label: 'Encrypted access token',
    secret: true,
    savedFlag: 'hasEncryptedToken',
    maxLength: 512,
  },
  {
    key: 'webhookSecretEncrypted',
    label: 'Meta App Secret',
    secret: true,
    savedFlag: 'hasWebhookSecret',
    maxLength: 512,
  },
];

export default function WhatsappConnectPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  return <WhatsappAccounts key={tenantId} tenantId={tenantId} />;
}

function WhatsappAccounts({ tenantId }: { tenantId: string }) {
  const [accounts, setAccounts] = useState<WhatsappAccount[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<AccountForm>(emptyForm);
  // null closes the form; an empty ID creates a new account.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const selected = accounts.find((account) => account.id === selectedId);
  const editingAccount = accounts.find((account) => account.id === editingId);

  useEffect(() => {
    let active = true;
    listWhatsappAccounts(tenantId)
      .then(({ data }) => {
        if (!active) return;
        setAccounts(data);
        setSelectedId((previous) =>
          data.some((row) => row.id === previous) ? previous : (data[0]?.id ?? ''),
        );
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

  function edit(account?: WhatsappAccount) {
    setEditingId(account?.id ?? '');
    setForm({
      ...emptyForm,
      businessAccountId: account?.businessAccountId ?? '',
      apiVersion: account?.apiVersion ?? '',
      accessToken: '',
      encryptedToken: '',
      webhookSecretEncrypted: '',
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (editingId === null || busy) return;
    const accessToken = form.accessToken.trim();
    const encryptedToken = form.encryptedToken.trim();
    const webhookSecretEncrypted = form.webhookSecretEncrypted.trim();
    setBusy(true);
    try {
      const { data } = await saveWhatsappAccount(
        tenantId,
        {
          businessAccountId: form.businessAccountId,
          apiVersion: form.apiVersion,
          ...(accessToken ? { accessToken } : {}),
          ...(encryptedToken ? { encryptedToken } : {}),
          ...(webhookSecretEncrypted ? { webhookSecretEncrypted } : {}),
        },
        editingId || undefined,
      );
      setAccounts((previous) =>
        editingId ? previous.map((row) => (row.id === data.id ? data : row)) : [...previous, data],
      );
      setSelectedId(data.id);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(
        editingId ? 'WhatsApp account updated' : 'Account saved. Add its phone numbers below.',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save account');
    } finally {
      setBusy(false);
    }
  }

  async function remove(account: WhatsappAccount) {
    if (
      busy ||
      !window.confirm(
        `Delete WhatsApp account ${account.businessAccountId} and all its phone numbers?`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteWhatsappAccount(tenantId, account.id);
      const remaining = accounts.filter((row) => row.id !== account.id);
      setAccounts(remaining);
      if (selectedId === account.id) setSelectedId(remaining[0]?.id ?? '');
      if (editingId === account.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      toast.success('WhatsApp account deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TenantBreadcrumb currentPage="WhatsApp Connect" tenantId={tenantId} />
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp Connect</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect a business account to this tenant, then add its phone numbers.
        </p>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <MessageCircleIcon className="size-4" />
              WhatsApp accounts
            </CardTitle>
            {loaded && !loadError && editingId === null && (
              <Button disabled={busy} onClick={() => edit()}>
                <PlusIcon />
                Add account
              </Button>
            )}
          </div>
          <CardDescription>
            Select an account to manage its numbers. Each account can have multiple numbers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loaded && <p className="text-muted-foreground text-sm">Loading accounts...</p>}
          {loadError && (
            <div role="alert" className="space-y-2">
              <p className="text-destructive text-sm">{loadError}</p>
              <Button variant="outline" onClick={() => setReload((value) => value + 1)}>
                Retry
              </Button>
            </div>
          )}
          {loaded && !loadError && accounts.length === 0 && editingId === null && (
            <div className="bg-muted/30 rounded-lg border border-dashed p-6 text-center">
              <p className="font-medium">Connect your first WhatsApp account</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Save the account details before adding phone numbers.
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`space-y-3 rounded-lg border p-4 ${selectedId === account.id ? 'border-primary bg-primary/5' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium break-all">{account.businessAccountId}</p>
                    <p className="text-muted-foreground text-sm">API {account.apiVersion}</p>
                  </div>
                  {selectedId === account.id && (
                    <span className="text-primary flex shrink-0 items-center gap-1 text-xs">
                      <CheckIcon className="size-3" />
                      Selected
                    </span>
                  )}
                </div>
                {/* <div className="text-muted-foreground space-y-1 text-xs">
                  {fields
                    .filter((field) => field.savedFlag)
                    .map((field) => (
                      <div key={field.key} className="space-y-1">
                        <p>{field.label}</p>
                        <p className="text-foreground font-mono break-all">
                          {account[field.key] || 'Not saved'}
                        </p>
                      </div>
                    ))}
                </div> */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedId === account.id ? 'secondary' : 'outline'}
                    disabled={busy || editingId !== null}
                    onClick={() => setSelectedId(account.id)}
                  >
                    Manage numbers
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || editingId !== null}
                    onClick={() => edit(account)}
                  >
                    <PencilIcon />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy || editingId !== null}
                    onClick={() => remove(account)}
                    aria-label={`Delete account ${account.businessAccountId}`}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {editingId !== null && (
            <form onSubmit={save} className="space-y-4 rounded-lg border p-4">
              <h2 className="font-medium">
                {editingId ? 'Edit WhatsApp account' : 'Add WhatsApp account'}
              </h2>
              {editingId && (
                <p className="text-muted-foreground text-sm">
                  Saved credentials are shown below. Edit a value to replace it, or leave it blank
                  to keep the saved value.
                </p>
              )}
              <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                {fields.map((field) => {
                  const saved = Boolean(field.savedFlag && editingAccount?.[field.savedFlag]);
                  return (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={`account-${field.key}`}>{field.label}</Label>
                      <Input
                        id={`account-${field.key}`}
                        type="text"
                        autoComplete="off"
                        spellCheck={field.secret ? false : undefined}
                        maxLength={field.maxLength}
                        name={field.key}
                        value={form[field.key]}
                        aria-describedby={field.secret ? `account-${field.key}-status` : undefined}
                        required={!field.secret || (!saved && field.key !== 'accessToken')}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, [field.key]: event.target.value }))
                        }
                      />
                      {field.secret && (
                        <p
                          id={`account-${field.key}-status`}
                          className="text-muted-foreground text-xs"
                        >
                          {saved ? 'Saved value loaded. Leave blank to keep it.' : 'Not saved yet.'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </fieldset>
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving...' : 'Save account'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {selected && !loadError ? (
        <section
          aria-label={`Phone numbers for account ${selected.businessAccountId}`}
          className="space-y-2"
        >
          <p className="text-muted-foreground text-sm">
            Numbers for account{' '}
            <span className="text-foreground font-medium break-all">
              {selected.businessAccountId}
            </span>
          </p>
          <fieldset disabled={busy || editingId !== null} className="min-w-0">
            <ConnectionRecords
              key={`${tenantId}:${selected.id}`}
              tenantId={tenantId}
              kind={`whatsapp-accounts/${selected.id}/numbers`}
            />
          </fieldset>
        </section>
      ) : loaded && !loadError ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneIcon className="size-4" aria-hidden="true" />
              WhatsApp numbers
            </CardTitle>
            <CardDescription>
              Save a WhatsApp account first to add its phone numbers.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
