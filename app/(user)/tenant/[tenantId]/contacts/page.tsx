'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  DownloadIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TenantBreadcrumb } from '@/components/tenant-breadcrumb';
import { SalesforceCsvImport } from '@/components/salesforce-csv-import';
import { SalesforceAccountSelect } from '@/components/salesforce-account-select';
import { toast } from 'sonner';
import {
  listContacts,
  getContact,
  saveContact,
  deleteContact,
  deleteSelectedContacts,
  exportSelectedContacts,
  type Contact,
  type ContactInput,
  type ContactPage,
  type ContactSource,
  type ContactSelection,
} from '@/lib/api';

const pageSizes = [10, 20, 25, 50, 100];
const emptySelection: ContactSelection = { mode: 'selected', ids: [] };
const maxSelectionIds = 1000;
const sources: ContactSource[] = ['MANUAL', 'SALESFORCE', 'WHATSAPP', 'CSV_IMPORT', 'API'];
const textFields = [
  { key: 'name', label: 'Name', maxLength: 255 },
  { key: 'phone', label: 'Phone number', type: 'tel', maxLength: 64, required: true },
  { key: 'email', label: 'Email', type: 'email', maxLength: 255 },
  { key: 'whatsappPhoneNumber', label: 'WhatsApp number', type: 'tel', maxLength: 64 },
  { key: 'location', label: 'Location', maxLength: 255 },
  { key: 'city', label: 'City', maxLength: 255 },
  { key: 'state', label: 'State', maxLength: 255 },
  { key: 'country', label: 'Country', maxLength: 255 },
] as const;
const salesforceFields = [
  { key: 'salesforceContactId', label: 'Salesforce contact ID', maxLength: 255 },
  { key: 'salesforceLeadId', label: 'Salesforce lead ID', maxLength: 255 },
  { key: 'salesforceObjectType', label: 'Salesforce object type', maxLength: 100 },
  { key: 'salesforceObjectId', label: 'Salesforce object ID', maxLength: 255 },
] as const;
type TextKey = (typeof textFields)[number]['key'] | (typeof salesforceFields)[number]['key'];
type ContactForm = Record<TextKey, string> & {
  salesforceConnectId: string;
  source: ContactSource;
  marketingOptIn: boolean;
  isBlocked: boolean;
  customDataText: string;
};
const emptyForm: ContactForm = {
  salesforceConnectId: '',
  name: '',
  phone: '',
  email: '',
  whatsappPhoneNumber: '',
  location: '',
  city: '',
  state: '',
  country: '',
  salesforceContactId: '',
  salesforceLeadId: '',
  salesforceObjectType: '',
  salesforceObjectId: '',
  source: 'MANUAL',
  marketingOptIn: true,
  isBlocked: false,
  customDataText: '',
};
function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleString('en-IN') : '—';
}
function validPage(value: string | null) {
  const page = Number(value);
  return value &&
    /^\d+$/.test(value) &&
    Number.isSafeInteger(page) &&
    page > 0 &&
    page <= 2147483647
    ? page
    : 1;
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Loading contacts...</p>}>
      <ContactsRoute />
    </Suspense>
  );
}

function ContactsRoute() {
  const { tenantId } = useParams<{ tenantId: string }>();
  return <ContactsTenantRoute key={tenantId} tenant={tenantId} />;
}

function ContactsTenantRoute({ tenant }: { tenant: string }) {
  const [selection, setSelection] = useState<ContactSelection>(emptySelection);
  const params = useSearchParams();
  const pathname = usePathname();
  const page = validPage(params.get('page'));
  const requestedSize = Number(params.get('pageSize'));
  const pageSize = pageSizes.includes(requestedSize) ? requestedSize : 25;
  return (
    <TenantContacts
      key={`${page}:${pageSize}`}
      tenant={tenant}
      page={page}
      pageSize={pageSize}
      pathname={pathname}
      queryString={params.toString()}
      selection={selection}
      onSelectionChange={setSelection}
    />
  );
}

function TenantContacts({
  tenant,
  page,
  pageSize,
  pathname,
  queryString,
  selection,
  onSelectionChange,
}: {
  tenant: string;
  page: number;
  pageSize: number;
  pathname: string;
  queryString: string;
  selection: ContactSelection;
  onSelectionChange: (selection: ContactSelection) => void;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ContactPage | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [viewing, setViewing] = useState<Contact | null>(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const goToPage = useCallback(
    (target: number, size = pageSize, replace = false) => {
      const params = new URLSearchParams(queryString);
      params.set('page', String(target));
      params.set('pageSize', String(size));
      const url = `${pathname}?${params.toString()}`;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, queryString, pageSize, router],
  );

  useEffect(() => {
    const controller = new AbortController();
    listContacts(tenant, page, pageSize, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        // Handles a removed last page or an out-of-range bookmarked URL.
        if (page > data.pagination.totalPages) {
          goToPage(data.pagination.totalPages, pageSize, true);
          return;
        }
        setResult(data);
        setLoadError('');
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setLoadError(error.message);
      });
    return () => controller.abort();
  }, [tenant, page, pageSize, reload, goToPage]);

  function refreshPage() {
    onSelectionChange(emptySelection);
    setResult(null);
    setLoadError('');
    setReload((value) => value + 1);
  }
  function edit(contact?: Contact) {
    setViewing(null);
    setEditingId(contact?.id ?? '');
    const next = { ...emptyForm };
    if (contact) {
      next.salesforceConnectId = contact.salesforceConnectId ?? '';
      for (const field of [...textFields, ...salesforceFields])
        next[field.key] = contact[field.key] ?? '';
      next.source = contact.source;
      next.marketingOptIn = contact.marketingOptIn;
      next.isBlocked = contact.isBlocked;
      next.customDataText =
        contact.customData === null ? '' : JSON.stringify(contact.customData, null, 2);
    }
    setForm(next);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (editingId === null || busy) return;
    let customData: Record<string, unknown> | null = null;
    if (form.customDataText.trim()) {
      try {
        const parsed: unknown = JSON.parse(form.customDataText);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
          throw new Error();
        customData = parsed as Record<string, unknown>;
      } catch {
        toast.error('Custom data must be a valid JSON object');
        return;
      }
    }
    const body: ContactInput = {
      salesforceConnectId: form.salesforceConnectId || null,
      phone: form.phone,
      source: form.source,
      marketingOptIn: form.marketingOptIn,
      isBlocked: form.isBlocked,
      customData,
    };
    for (const field of [...textFields, ...salesforceFields]) {
      if (field.key !== 'phone') body[field.key] = form[field.key].trim() || null;
    }
    setBusy(true);
    try {
      await saveContact(tenant, body, editingId || undefined);
      setEditingId(null);
      setForm(emptyForm);
      refreshPage();
      toast.success(editingId ? 'Contact updated' : 'Contact created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save contact');
    } finally {
      setBusy(false);
    }
  }

  async function view(contact: Contact) {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await getContact(tenant, contact.id);
      setViewing(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load contact');
    } finally {
      setBusy(false);
    }
  }

  async function remove(contact: Contact) {
    if (busy || !window.confirm(`Delete contact "${contact.name || contact.phone}"?`)) return;
    setBusy(true);
    try {
      await deleteContact(tenant, contact.id);
      onSelectionChange(emptySelection);
      if (viewing?.id === contact.id) setViewing(null);
      if (result?.data.length === 1 && page > 1) goToPage(page - 1, pageSize, true);
      else refreshPage();
      toast.success('Contact deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete contact');
    } finally {
      setBusy(false);
    }
  }

  const pageLocked = busy || editingId !== null || importOpen || !result;
  const firstRow = result?.pagination.total ? (page - 1) * pageSize + 1 : 0;
  const lastRow = result ? Math.min(page * pageSize, result.pagination.total) : 0;
  const isSelected = (id: string) =>
    selection.mode === 'all' ? !selection.excludedIds.includes(id) : selection.ids.includes(id);
  const selectedCount =
    selection.mode === 'all'
      ? Math.max(0, (result?.pagination.total ?? 0) - selection.excludedIds.length)
      : selection.ids.length;
  const pageSelectedCount = result?.data.filter((contact) => isSelected(contact.id)).length ?? 0;
  const allPageSelected = !!result?.data.length && pageSelectedCount === result.data.length;

  function toggleContacts(ids: string[], checked: boolean) {
    const next = new Set(selection.mode === 'all' ? selection.excludedIds : selection.ids);
    for (const id of ids) {
      if (selection.mode === 'all' ? !checked : checked) next.add(id);
      else next.delete(id);
    }
    if (next.size > maxSelectionIds) {
      toast.error(
        'For more than 1,000 individual selections, use Select all contacts. You can exclude up to 1,000 contacts.',
      );
      return;
    }
    onSelectionChange(
      selection.mode === 'all'
        ? { mode: 'all', excludedIds: [...next] }
        : { mode: 'selected', ids: [...next] },
    );
  }

  async function removeSelected() {
    if (pageLocked || !selectedCount) return;
    const target =
      selection.mode === 'all'
        ? `all contacts for this tenant${selection.excludedIds.length ? ` except ${selection.excludedIds.length} unchecked contacts` : ''}`
        : `${selectedCount} selected contacts`;
    if (
      !window.confirm(
        `Delete ${target}? This cannot be undone. Related conversations and messages may also be deleted. Contacts referenced by protected history will prevent the entire deletion.`,
      )
    )
      return;
    setBusy(true);
    try {
      const { data } = await deleteSelectedContacts(tenant, selection);
      setViewing(null);
      refreshPage();
      toast.success(`${data.deleted} contacts deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete selected contacts');
    } finally {
      setBusy(false);
    }
  }

  async function exportSelected() {
    if (pageLocked || !selectedCount) return;
    setBusy(true);
    try {
      const file = await exportSelectedContacts(tenant, selection);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contacts-${tenant}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success('Contacts exported to CSV');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not export selected contacts');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-5">
      <TenantBreadcrumb tenantId={tenant} currentPage="Contacts" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage this tenant’s contacts. Oldest created contacts appear first.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pageLocked} onClick={() => setImportOpen(true)}>
            <UploadIcon /> Import Salesforce CSV
          </Button>
          <Button disabled={pageLocked} onClick={() => edit()}>
            <PlusIcon /> Add contact
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3" aria-busy={!result && !loadError}>
        {[
          {
            label: 'Total contacts',
            value: result?.summary.total,
            description: 'All contacts for this tenant',
          },
          {
            label: 'Subscribed contacts',
            value: result?.summary.subscribed,
            description: 'Marketing opt-in enabled',
          },
          {
            label: 'Unsubscribed contacts',
            value: result?.summary.unsubscribed,
            description: 'Marketing opt-in disabled',
          },
        ].map(({ label, value, description }) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold" aria-live="polite">
                {value === undefined
                  ? loadError
                    ? '—'
                    : 'Loading...'
                  : value.toLocaleString('en-IN')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {importOpen && (
        <SalesforceCsvImport
          tenant={tenant}
          onClose={() => setImportOpen(false)}
          onImported={refreshPage}
          onBusyChange={setBusy}
        />
      )}

      {editingId !== null && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit contact' : 'Add contact'}</CardTitle>
            <CardDescription>
              Phone number is required. Other contact details are optional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <fieldset disabled={busy} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {textFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={`contact-${field.key}`}>{field.label}</Label>
                      <Input
                        id={`contact-${field.key}`}
                        type={'type' in field ? field.type : 'text'}
                        required={'required' in field && field.required}
                        maxLength={field.maxLength}
                        value={form[field.key]}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, [field.key]: event.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <SalesforceAccountSelect
                  key={tenant}
                  tenant={tenant}
                  value={form.salesforceConnectId}
                  onChange={(salesforceConnectId) =>
                    setForm((previous) => ({ ...previous, salesforceConnectId }))
                  }
                />
                <div className="space-y-2">
                  <Label htmlFor="contact-source">Source</Label>
                  <select
                    id="contact-source"
                    className="bg-background w-full rounded-lg border p-2 text-sm sm:max-w-xs"
                    value={form.source}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        source: event.target.value as ContactSource,
                      }))
                    }
                  >
                    {sources.map((source) => (
                      <option key={source} value={source}>
                        {source.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.marketingOptIn}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          marketingOptIn: event.target.checked,
                        }))
                      }
                    />
                    Marketing opt-in
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isBlocked}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, isBlocked: event.target.checked }))
                      }
                    />
                    Blocked
                  </label>
                </div>
                <details className="space-y-4 rounded-lg border p-4">
                  <summary className="cursor-pointer font-medium">
                    Salesforce and custom data
                  </summary>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {salesforceFields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={`contact-${field.key}`}>{field.label}</Label>
                        <Input
                          id={`contact-${field.key}`}
                          maxLength={field.maxLength}
                          value={form[field.key]}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              [field.key]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-custom-data">Custom data (JSON object, optional)</Label>
                    <Textarea
                      id="contact-custom-data"
                      rows={4}
                      value={form.customDataText}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, customDataText: event.target.value }))
                      }
                      placeholder='{"company": "Example"}'
                      className="font-mono"
                    />
                  </div>
                </details>
                <div className="flex gap-2">
                  <Button type="submit">{busy ? 'Saving...' : 'Save contact'}</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      )}

      {viewing && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Contact details</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close contact details"
                onClick={() => setViewing(null)}
              >
                <XIcon />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ...[...textFields, ...salesforceFields].map((field) => [
                  field.label,
                  viewing[field.key] || '—',
                ]),
                ['Source', viewing.source.replaceAll('_', ' ')],
                ['Salesforce account', viewing.salesforceConnectId || '—'],
                ['Marketing opt-in', viewing.marketingOptIn ? 'Yes' : 'No'],
                ['Blocked', viewing.isBlocked ? 'Yes' : 'No'],
                ['Created', dateLabel(viewing.createdAt)],
                ['Updated', dateLabel(viewing.updatedAt)],
                ['Marketing opted out', dateLabel(viewing.marketingOptedOutAt)],
                ['Last synced', dateLabel(viewing.lastSyncedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-all">{value}</dd>
                </div>
              ))}
            </dl>
            {viewing.customData && (
              <div>
                <p className="mb-2 text-sm font-medium">Custom data</p>
                <pre className="bg-muted overflow-auto rounded-lg p-3 text-xs">
                  {JSON.stringify(viewing.customData, null, 2)}
                </pre>
              </div>
            )}
            <Button variant="outline" disabled={pageLocked} onClick={() => edit(viewing)}>
              <PencilIcon />
              Edit contact
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>
                Contacts{' '}
                {result && (
                  <span className="text-muted-foreground text-sm">({result.pagination.total})</span>
                )}
              </CardTitle>
              <CardDescription>Created date, ascending</CardDescription>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span>Per page</span>
              <select
                aria-label="Contacts per page"
                className="bg-background rounded-lg border p-2"
                disabled={pageLocked}
                value={pageSize}
                onChange={(event) => goToPage(1, Number(event.target.value))}
              >
                {pageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {result && (selection.mode === 'all' || selectedCount > 0) && (
            <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="space-y-1 text-sm" aria-live="polite">
                <p>
                  {selection.mode === 'all'
                    ? `All ${selectedCount.toLocaleString('en-IN')} contacts across every page are selected${selection.excludedIds.length ? ` (${selection.excludedIds.length} excluded)` : ''}.`
                    : `${selectedCount.toLocaleString('en-IN')} contacts selected.`}
                </p>
                {selection.mode === 'all' && (
                  <p className="text-muted-foreground text-xs">
                    Applies to all contacts present when the action runs, except unchecked contacts.
                  </p>
                )}
                {selection.mode === 'selected' && allPageSelected && (
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    disabled={pageLocked}
                    onClick={() => onSelectionChange({ mode: 'all', excludedIds: [] })}
                  >
                    Select all {result.pagination.total.toLocaleString('en-IN')} contacts
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageLocked || !selectedCount}
                  onClick={exportSelected}
                >
                  <DownloadIcon /> Export CSV
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pageLocked || !selectedCount}
                  onClick={removeSelected}
                >
                  <Trash2Icon /> Delete selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pageLocked}
                  onClick={() => onSelectionChange(emptySelection)}
                >
                  Clear selection
                </Button>
              </div>
            </div>
          )}
          {loadError ? (
            <div role="alert" className="space-y-2">
              <p className="text-destructive text-sm">{loadError}</p>
              <Button variant="outline" onClick={refreshPage}>
                Retry
              </Button>
            </div>
          ) : !result ? (
            <p className="text-muted-foreground text-sm">Loading page {page}...</p>
          ) : result.data.length === 0 ? (
            <div className="bg-muted/30 space-y-2 rounded-lg border border-dashed p-8 text-center">
              <UsersIcon className="text-muted-foreground mx-auto size-8" />
              <p className="font-medium">No contacts yet</p>
              <p className="text-muted-foreground text-sm">
                Add the first contact for this tenant.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-225 text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th scope="col" className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all contacts on this page"
                        checked={allPageSelected}
                        disabled={pageLocked}
                        ref={(input) => {
                          if (input)
                            input.indeterminate = pageSelectedCount > 0 && !allPageSelected;
                        }}
                        onChange={(event) =>
                          toggleContacts(
                            result.data.map((contact) => contact.id),
                            event.target.checked,
                          )
                        }
                      />
                    </th>
                    {['Contact', 'Phone', 'Location', 'Source', 'Created', 'Actions'].map(
                      (heading) => (
                        <th key={heading} scope="col" className="px-4 py-3 font-medium">
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((contact) => (
                    <tr
                      key={contact.id}
                      className={`border-t ${isSelected(contact.id) ? 'bg-muted/30' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select contact ${contact.name || contact.phone}`}
                          checked={isSelected(contact.id)}
                          disabled={pageLocked}
                          onChange={(event) => toggleContacts([contact.id], event.target.checked)}
                        />
                      </td>
                      <td className="max-w-60 px-4 py-3">
                        <p className="font-medium break-words">
                          {contact.name || 'Unnamed contact'}
                        </p>
                        <p className="text-muted-foreground text-xs break-all">
                          {contact.email || '—'}
                        </p>
                        {contact.isBlocked && (
                          <span className="text-destructive text-xs">Blocked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{contact.phone}</td>
                      <td className="max-w-44 px-4 py-3 break-words">
                        {[contact.city, contact.state, contact.country]
                          .filter(Boolean)
                          .join(', ') ||
                          contact.location ||
                          '—'}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {contact.source.replaceAll('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {dateLabel(contact.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pageLocked}
                            onClick={() => view(contact)}
                          >
                            <EyeIcon />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pageLocked}
                            onClick={() => edit(contact)}
                          >
                            <PencilIcon />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={pageLocked}
                            onClick={() => remove(contact)}
                          >
                            <Trash2Icon />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result && (
            <nav
              aria-label="Contact pagination"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-muted-foreground text-sm">
                Showing {firstRow}–{lastRow} of {result.pagination.total} contacts
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageLocked || !result.pagination.hasPreviousPage}
                  onClick={() => goToPage(1)}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageLocked || !result.pagination.hasPreviousPage}
                  onClick={() => goToPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="px-2 text-sm" aria-live="polite">
                  Page {page} of {result.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageLocked || !result.pagination.hasNextPage}
                  onClick={() => goToPage(page + 1)}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageLocked || !result.pagination.hasNextPage}
                  onClick={() => goToPage(result.pagination.totalPages)}
                >
                  Last
                </Button>
              </div>
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
