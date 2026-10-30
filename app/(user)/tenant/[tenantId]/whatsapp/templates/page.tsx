'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { EyeIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { TenantBreadcrumb } from '@/components/tenant-breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  WhatsappTemplateEditor,
  WhatsappMessagePreview,
} from '@/components/whatsapp-template-editor';
import { metaCreatePayload } from '@/lib/whatsapp-template';
import {
  listWhatsappAccounts,
  listMessageTemplates,
  syncMessageTemplates,
  getMessageTemplate,
  saveMessageTemplate,
  deleteMessageTemplate,
  type WhatsappAccount,
  type MessageTemplate,
  type MessageTemplateInput,
} from '@/lib/api';

export default function TemplatesPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  return <WhatsappTemplates key={tenantId} tenantId={tenantId} />;
}

function WhatsappTemplates({ tenantId }: { tenantId: string }) {
  const [accounts, setAccounts] = useState<WhatsappAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountReload, setAccountReload] = useState(0);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | undefined>();
  const [viewing, setViewing] = useState<MessageTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const visible = templates.filter((row) =>
    `${row.name} ${row.language} ${row.category ?? ''} ${row.status}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const whatsappPath = `/tenant/${encodeURIComponent(tenantId)}/whatsapp`;

  useEffect(() => {
    let active = true;
    listWhatsappAccounts(tenantId)
      .then(({ data }) => {
        if (!active) return;
        setAccounts(data);
        setAccountId(data[0]?.id ?? '');
        setAccountError('');
      })
      .catch((error: Error) => {
        if (active) setAccountError(error.message);
      })
      .finally(() => {
        if (active) setAccountsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [tenantId, accountReload]);

  useEffect(() => {
    if (!accountId || busy) return;
    let active = true;
    function refresh(silent = false) {
      return listMessageTemplates(tenantId, accountId)
        .then(({ data }) => {
          if (!active) return;
          setTemplates(data);
          setViewing((previous) =>
            previous ? (data.find((row) => row.id === previous.id) ?? null) : null,
          );
          setLoadError('');
        })
        .catch((error: Error) => {
          if (active && !silent) setLoadError(error.message);
        })
        .finally(() => {
          if (active) setLoaded(true);
        });
    }
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true);
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [tenantId, accountId, reload, busy]);

  function selectAccount(id: string) {
    setAccountId(id);
    setTemplates([]);
    setLoaded(false);
    setLoadError('');
    setEditingId(null);
    setViewing(null);
    setFormError('');
    setSearch('');
  }

  function edit(template?: MessageTemplate) {
    setViewing(null);
    setEditingId(template?.id ?? '');
    setEditingTemplate(template);
    setFormError('');
  }

  async function save(input: MessageTemplateInput) {
    if (busy || editingId === null) return;
    setFormError('');
    setBusy(true);
    try {
      const { data } = await saveMessageTemplate(
        tenantId,
        accountId,
        input,
        editingId || undefined,
      );
      setTemplates((previous) => [data, ...previous.filter((row) => row.id !== data.id)]);
      setEditingId(null);
      setEditingTemplate(undefined);
      setSearch('');
      toast.success(`Template submitted to Meta. Status: ${data.status}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save template');
    } finally {
      setBusy(false);
    }
  }

  async function view(template: MessageTemplate) {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await getMessageTemplate(tenantId, accountId, template.id);
      setViewing(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load template');
    } finally {
      setBusy(false);
    }
  }

  async function syncFromMeta() {
    if (busy || !accountId || editingId !== null) return;
    setBusy(true);
    try {
      const result = await syncMessageTemplates(tenantId, accountId);
      setTemplates(result.data);
      setLoaded(true);
      setLoadError('');
      toast.success(
        `Imported ${result.sync.imported} template(s) from Meta; refreshed ${result.sync.updated}.`,
      );
      if (result.sync.skipped.length) toast.warning(result.sync.skipped.join('\n'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not sync templates from Meta');
    } finally {
      setBusy(false);
    }
  }

  async function remove(template: MessageTemplate) {
    if (
      busy ||
      !window.confirm(
        `Remove template "${template.name}" (${template.language}) from the local library? This does not delete it from Meta.`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteMessageTemplate(tenantId, accountId, template.id);
      setTemplates((previous) => previous.filter((row) => row.id !== template.id));
      if (viewing?.id === template.id) setViewing(null);
      toast.success('Template deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete template');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TenantBreadcrumb
        tenantId={tenantId}
        currentPage="WhatsApp Templates"
        parentPage={{ label: 'WhatsApp Connect', href: whatsappPath }}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp Templates</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create and edit Meta templates. Review status updates automatically after approval or
            rejection.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy || !accountsLoaded || !accountId || editingId !== null}
            onClick={syncFromMeta}
          >
            Sync from Meta
          </Button>
          <Button
            disabled={busy || !loaded || Boolean(loadError) || !accountId || editingId !== null}
            onClick={() => edit()}
          >
            <PlusIcon /> Create template
          </Button>
        </div>
      </div>
      {!accountsLoaded && (
        <p className="text-muted-foreground text-sm">Loading WhatsApp accounts...</p>
      )}
      {accountError && (
        <div role="alert" className="space-y-2">
          <p className="text-destructive text-sm">{accountError}</p>
          <Button
            variant="outline"
            onClick={() => {
              setAccountsLoaded(false);
              setAccountReload((value) => value + 1);
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {accountsLoaded && !accountError && !accounts.length && (
        <Card>
          <CardHeader>
            <CardTitle>Connect a WhatsApp account first</CardTitle>
            <CardDescription>Templates belong to a saved WhatsApp account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={whatsappPath} className="text-primary text-sm underline">
              Add a WhatsApp account
            </Link>
          </CardContent>
        </Card>
      )}
      {accounts.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="template-account">WhatsApp account</Label>
          <select
            id="template-account"
            className="bg-background w-full rounded-lg border p-2 text-sm sm:max-w-md"
            value={accountId}
            disabled={busy || editingId !== null}
            onChange={(event) => selectAccount(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.businessAccountId}
              </option>
            ))}
          </select>
        </div>
      )}
      {editingId !== null && (
        <WhatsappTemplateEditor
          key={`${accountId}:${editingId}`}
          template={editingTemplate}
          account={accounts.find((account) => account.id === accountId)}
          busy={busy}
          error={formError}
          onSave={save}
          onCancel={() => {
            setEditingId(null);
            setEditingTemplate(undefined);
            setFormError('');
          }}
        />
      )}
      {viewing && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{viewing.name}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close template details"
                onClick={() => setViewing(null)}
              >
                <XIcon />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <WhatsappMessagePreview components={viewing.components} />
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['Template ID', viewing.id],
                ['Language', viewing.language],
                ['Category', viewing.category ?? '—'],
                ['Status', viewing.status],
                ['Provider template ID', viewing.providerTemplateId ?? '—'],
                ['Active', viewing.isActive ? 'Yes' : 'No'],
                ['Created', new Date(viewing.createdAt).toLocaleString('en-IN')],
                ['Updated', new Date(viewing.updatedAt).toLocaleString('en-IN')],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-all">{value}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="mb-2 font-medium">Meta create-template payload</p>
              <pre className="bg-muted overflow-auto rounded-lg p-3 text-xs">
                {JSON.stringify(metaCreatePayload(viewing), null, 2)}
              </pre>
            </div>
            <div>
              <p className="mb-2 font-medium">Variable schema</p>
              <pre className="bg-muted overflow-auto rounded-lg p-3 text-xs">
                {JSON.stringify(viewing.variableSchema, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
      {accountId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Message templates</CardTitle>
              <Button
                variant="outline"
                disabled={busy || editingId !== null}
                onClick={() => setReload((value) => value + 1)}
              >
                Refresh status
              </Button>
            </div>
            <CardDescription>
              {templates.length} saved template{templates.length === 1 ? '' : 's'} for the selected
              account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              aria-label="Search templates"
              placeholder="Search name, language, category, or status..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {!loaded && <p className="text-muted-foreground text-sm">Loading templates...</p>}
            {loadError && (
              <div role="alert" className="space-y-2">
                <p className="text-destructive text-sm">{loadError}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setLoaded(false);
                    setLoadError('');
                    setReload((value) => value + 1);
                  }}
                >
                  Retry
                </Button>
              </div>
            )}
            {loaded && !loadError && !visible.length && (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {templates.length
                  ? 'No templates match your search.'
                  : 'No templates yet. Create your first template.'}
              </p>
            )}
            {loaded && !loadError && visible.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Templates for the selected WhatsApp account</caption>
                  <thead className="bg-muted/50">
                    <tr>
                      {[
                        'Name',
                        'Language',
                        'Category',
                        'Status',
                        'Active',
                        'Source',
                        'Actions',
                      ].map((label) => (
                        <th key={label} scope="col" className="px-4 py-3 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((template) => (
                      <tr key={template.id} className="border-t">
                        <td className="px-4 py-3 font-medium break-all">{template.name}</td>
                        <td className="px-4 py-3">{template.language}</td>
                        <td className="px-4 py-3">{template.category ?? '—'}</td>
                        <td className="px-4 py-3">{template.status}</td>
                        <td className="px-4 py-3">{template.isActive ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3">
                          {template.providerTemplateId ? 'Meta' : 'Local draft'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy || editingId !== null}
                              aria-label={`View ${template.name}`}
                              onClick={() => view(template)}
                            >
                              <EyeIcon /> View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy || editingId !== null}
                              aria-label={`Edit ${template.name}`}
                              onClick={() => edit(template)}
                            >
                              <PencilIcon /> Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={busy || editingId !== null}
                              aria-label={`Delete ${template.name}`}
                              onClick={() => remove(template)}
                            >
                              <Trash2Icon /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
