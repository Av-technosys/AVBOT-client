'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PlayIcon, XIcon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  listWhatsappAccounts,
  listSalesforceAccounts,
  listConnectionRecords,
  type WhatsappAccount,
  type SalesforceAccount,
  type ConnectionRecord,
} from '@/lib/api';
import {
  createRun,
  listRuns,
  getRun,
  saveRun,
  runAction,
  audiencePage,
  enrollmentPage,
  uploadRunMedia,
  type Audience,
  type CampaignRun,
  type RuntimeConfig,
  type RunPreview,
  type Page,
  type Enrollment,
  type Binding,
} from '@/lib/marketing-api';
import type { Contact } from '@/lib/api';
const selectClass = 'bg-background w-full rounded-md border px-3 py-2 text-sm';
const searchFields = [
  ['name', 'Name'],
  ['email', 'Email'],
  ['phone', 'Phone number'],
  ['city', 'City'],
  ['state', 'State'],
  ['location', 'Location / area'],
  ['country', 'Country'],
  ['all', 'Name, email or phone'],
] as const;

function searchAudience(audience: Audience | null): Audience {
  if (!audience)
    return { selection: { mode: 'selected', ids: [] }, filters: { searchField: 'name' } };
  const filters = audience.filters ?? {};
  const previous = (['city', 'state', 'location', 'country'] as const).filter((key) =>
    filters[key]?.trim(),
  );
  const field = previous[0];
  // Older drafts can contain several simultaneous filters. Require a fresh selection
  // when converting them to one search so a broader audience is never preselected.
  const changesScope = Boolean(filters.source || previous.length + (filters.q ? 1 : 0) > 1);
  return {
    selection: changesScope ? { mode: 'selected', ids: [] } : audience.selection,
    filters: {
      q: filters.q || (field ? filters[field] : '') || '',
      searchField: filters.q
        ? filters.searchField || 'all'
        : field || filters.searchField || 'name',
      salesforceConnectId: filters.salesforceConnectId ?? '',
    },
  };
}
const date = (value: string | null) => (value ? new Date(value).toLocaleString('en-IN') : '—');
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Could not process campaign run';

export function CampaignRuns({
  tenant,
  campaignId,
  disabled = false,
}: {
  tenant: string;
  campaignId: string;
  disabled?: boolean;
}) {
  const [runs, setRuns] = useState<CampaignRun[]>([]);
  const [open, setOpen] = useState<CampaignRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const reload = useCallback(async () => {
    const { data } = await listRuns(tenant, campaignId);
    setRuns(data);
  }, [tenant, campaignId]);
  useEffect(() => {
    if (!expanded) return;
    let active = true;
    listRuns(tenant, campaignId)
      .then(({ data }) => {
        if (active) setRuns(data);
      })
      .catch((error) => {
        if (active) toast.error(message(error));
      });
    return () => {
      active = false;
    };
  }, [expanded, tenant, campaignId]);
  async function start() {
    setBusy(true);
    try {
      const { data } = await createRun(tenant, campaignId);
      setOpen(data);
      setExpanded(true);
      await reload();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Campaign runs</p>
          <p className="text-muted-foreground text-sm">
            Choose recipients, configure messages, and monitor delivery.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Hide history' : 'Run history'}
          </Button>
          <Button disabled={disabled || busy} onClick={start}>
            <PlayIcon />
            Run campaign
          </Button>
        </div>
      </div>
      {disabled && (
        <p className="text-muted-foreground mt-2 text-xs">
          Save the workflow before creating a run. Publish the campaign before starting delivery.
        </p>
      )}
      {expanded && (
        <div className="mt-4 space-y-2">
          {!runs.length && <p className="text-muted-foreground text-sm">No runs yet.</p>}
          {runs.map((r) => (
            <button
              key={r.id}
              className="hover:bg-muted flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm"
              onClick={() => setOpen(r)}
            >
              <span>
                {date(r.createdAt)} · {r.status}
              </span>
              <span>
                {r.completedContacts}/{r.totalContacts} complete · {r.failedContacts} failed ·{' '}
                {r.stoppedContacts} stopped
              </span>
            </button>
          ))}
        </div>
      )}
      {open && (
        <RunDialog
          key={open.id}
          tenant={tenant}
          campaignId={campaignId}
          initial={open}
          onClose={() => {
            setOpen(null);
            reload().catch((error) => toast.error(message(error)));
          }}
        />
      )}
    </div>
  );
}
function RunDialog({
  tenant,
  campaignId,
  initial,
  onClose,
}: {
  tenant: string;
  campaignId: string;
  initial: CampaignRun;
  onClose: () => void;
}) {
  const [run, setRun] = useState(initial);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [audience, setAudience] = useState<Audience>(() => searchAudience(initial.audience));
  const [accountId, setAccountId] = useState(initial.whatsappConnectId ?? '');
  const [numberId, setNumberId] = useState(initial.whatsappConnectNumberId ?? '');
  const [accounts, setAccounts] = useState<WhatsappAccount[]>([]);
  const [salesforce, setSalesforce] = useState<SalesforceAccount[]>([]);
  const [numbers, setNumbers] = useState<ConnectionRecord[]>([]);
  const mediaUrls = useRef<string[]>([]);
  const [localMedia, setLocalMedia] = useState<Record<string, { url: string; type: string }>>({});
  useEffect(
    () => () => {
      mediaUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const [config, setConfig] = useState<RuntimeConfig>(initial.runtimeConfig);
  const [preview, setPreview] = useState<RunPreview | null>(null);
  const [contacts, setContacts] = useState<Page<Contact> | null>(null);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Page<Enrollment> | null>(null);
  const [recipientPage, setRecipientPage] = useState(1);
  const account = accounts.find((a) => a.id === accountId);
  const draft = run.status === 'DRAFT';
  const refresh = useCallback(async () => {
    const [{ data: entry }, { data: recipients }] = await Promise.all([
      getRun(tenant, campaignId, initial.id),
      enrollmentPage(tenant, campaignId, initial.id, recipientPage),
    ]);
    setRun(entry);
    setRows(recipients);
  }, [tenant, campaignId, initial.id, recipientPage]);
  useEffect(() => {
    Promise.all([listWhatsappAccounts(tenant), listSalesforceAccounts(tenant)])
      .then(([a, s]) => {
        setAccounts(a.data);
        setSalesforce(s.data);
      })
      .catch((e) => setError(message(e)));
  }, [tenant]);
  useEffect(() => {
    let active = true;
    if (!accountId) return;
    listConnectionRecords(tenant, `whatsapp-accounts/${accountId}/numbers`)
      .then(({ data }) => {
        if (active) setNumbers(data);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [tenant, accountId]);
  useEffect(() => {
    if (!draft) return;
    let active = true;
    audiencePage(tenant, campaignId, run.id, page, audience.filters)
      .then(({ data }) => {
        if (active) setContacts(data);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [tenant, campaignId, run.id, page, audience.filters, draft]);
  useEffect(() => {
    if (draft) return;
    let active = true;
    const load = () =>
      refresh().catch((e) => {
        if (active) setError(message(e));
      });
    load();
    const timer = run.status === 'RUNNING' ? setInterval(load, 10000) : undefined;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [draft, refresh, run.status]);
  function filter(key: keyof NonNullable<Audience['filters']>, value: string) {
    setPage(1);
    setContacts(null);
    setAudience((a) => ({
      ...a,
      filters: { ...a.filters, [key]: value },
      selection:
        a.selection.mode === 'all'
          ? { mode: 'all', excludedIds: [] }
          : { mode: 'selected', ids: [] },
    }));
  }
  function toggle(id: string) {
    setAudience((a) => {
      const s = a.selection;
      if (s.mode === 'all')
        return {
          ...a,
          selection: {
            mode: 'all',
            excludedIds: s.excludedIds.includes(id)
              ? s.excludedIds.filter((x) => x !== id)
              : [...s.excludedIds, id],
          },
        };
      return {
        ...a,
        selection: {
          mode: 'selected',
          ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id],
        },
      };
    });
  }
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const { data } = await saveRun(tenant, campaignId, run.id, {
      audience,
      runtimeConfig: config,
      ...(accountId && numberId
        ? { whatsappConnectId: accountId, whatsappConnectNumberId: numberId }
        : {}),
    });
    setRun(data);
    return data;
  }
  async function next() {
    await save();
    if (step === 1 || step === 2) {
      const { data } = await runAction<RunPreview>(tenant, campaignId, run.id, 'preview');
      setPreview(data);
    }
    setStep((s) => Math.min(3, s + 1));
  }
  function binding(nodeId: string, key: string, value: Binding) {
    setConfig((c) => ({ ...c, [nodeId]: { ...c[nodeId], [key]: value } }));
  }
  async function upload(nodeId: string, file: File, format?: string) {
    await perform(async () => {
      const expected = format?.toLowerCase();
      if (
        (expected === 'image' && !file.type.startsWith('image/')) ||
        (expected === 'video' && !file.type.startsWith('video/')) ||
        (expected === 'document' &&
          (file.type.startsWith('image/') || file.type.startsWith('video/')))
      )
        throw new Error(`Choose a ${expected} file for this template`);
      const { data } = await uploadRunMedia(tenant, campaignId, run.id, file);
      const url = URL.createObjectURL(file);
      mediaUrls.current.push(url);
      setLocalMedia((m) => ({ ...m, [nodeId]: { url, type: file.type } }));
      setConfig((c) => ({
        ...c,
        [nodeId]: {
          ...c[nodeId],
          'header.media': { source: 'fixed', value: `id:${data.id}` },
          'header.filename': { source: 'fixed', value: data.filename },
        },
      }));
      toast.success('File uploaded to WhatsApp. Save to keep this selection.');
    });
  }
  async function stop(path = 'stop') {
    await perform(async () => {
      await runAction(tenant, campaignId, run.id, path);
      await refresh();
      toast.success('Remaining messages stopped');
    });
  }
  const selectedCount =
    audience.selection.mode === 'selected'
      ? audience.selection.ids.length
      : Math.max(0, (contacts?.total ?? 0) - audience.selection.excludedIds.length);
  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-3 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-title"
        className="bg-background max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border shadow-xl"
      >
        <header className="bg-background sticky top-0 z-10 flex items-center justify-between border-b p-5">
          <div>
            <h2 id="run-title" className="text-lg font-semibold">
              {draft ? 'Set up campaign run' : 'Campaign run'}
            </h2>
            <p className="text-muted-foreground text-xs">
              {run.id} · {run.status}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label="Close campaign run"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </header>
        <div className="space-y-5 p-5">
          {error && (
            <p role="alert" className="text-destructive rounded-lg border p-3 text-sm">
              {error}
            </p>
          )}
          {draft ? (
            <>
              <ol className="grid grid-cols-4 gap-2 text-xs">
                {['Audience', 'WhatsApp sender', 'Template fields/files', 'Review and start'].map(
                  (label, i) => (
                    <li
                      key={label}
                      className={`rounded-lg border p-3 ${step === i ? 'bg-primary text-primary-foreground' : ''}`}
                    >
                      {i + 1}. {label}
                    </li>
                  ),
                )}
              </ol>
              <fieldset disabled={busy} className="space-y-4">
                {step === 0 && (
                  <>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex min-w-0 flex-1 gap-2">
                        <Input
                          className="min-w-0 flex-1"
                          aria-label="Search audience"
                          placeholder={`Search by ${searchFields.find(([key]) => key === audience.filters?.searchField)?.[1].toLowerCase() ?? 'name'}…`}
                          maxLength={255}
                          value={audience.filters?.q ?? ''}
                          onChange={(e) => filter('q', e.target.value)}
                        />
                        <select
                          className="bg-background w-40 shrink-0 rounded-md border px-3 py-2 text-sm"
                          aria-label="Search field"
                          value={audience.filters?.searchField ?? 'name'}
                          onChange={(e) => filter('searchField', e.target.value)}
                        >
                          {searchFields.map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <select
                        className={`${selectClass} sm:w-56`}
                        aria-label="Salesforce account"
                        value={audience.filters?.salesforceConnectId ?? ''}
                        onChange={(e) => filter('salesforceConnectId', e.target.value)}
                      >
                        <option value="">All Salesforce accounts</option>
                        {salesforce.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.username}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <label className="flex gap-2">
                        <input
                          type="radio"
                          checked={audience.selection.mode === 'selected'}
                          onChange={() =>
                            setAudience((a) => ({ ...a, selection: { mode: 'selected', ids: [] } }))
                          }
                        />
                        Choose specific contacts
                      </label>
                      <label className="flex gap-2">
                        <input
                          type="radio"
                          checked={audience.selection.mode === 'all'}
                          onChange={() =>
                            setAudience((a) => ({
                              ...a,
                              selection: { mode: 'all', excludedIds: [] },
                            }))
                          }
                        />
                        All filtered contacts across every page
                      </label>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {selectedCount} selected. Consent, blocking, suppression, phone numbers, and
                      template values are checked before starting.
                    </p>
                    <div className="divide-y rounded-lg border">
                      {!contacts && <p className="p-4 text-sm">Loading contacts…</p>}
                      {contacts?.rows.map((c) => (
                        <label key={c.id} className="flex items-center gap-3 p-3 text-sm">
                          <input
                            type="checkbox"
                            checked={
                              audience.selection.mode === 'all'
                                ? !audience.selection.excludedIds.includes(c.id)
                                : audience.selection.ids.includes(c.id)
                            }
                            onChange={() => toggle(c.id)}
                          />
                          <span className="flex-1">
                            {c.name || 'Unnamed contact'}
                            <span className="text-muted-foreground block text-xs">
                              {c.whatsappPhoneNumber || c.phone} · {c.source}
                            </span>
                            {c.email && (
                              <span className="text-muted-foreground block text-xs">{c.email}</span>
                            )}
                            {[c.location, c.city, c.state, c.country].some(Boolean) && (
                              <span className="text-muted-foreground block text-xs">
                                {[c.location, c.city, c.state, c.country]
                                  .filter(Boolean)
                                  .join(', ')}
                              </span>
                            )}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {c.marketingOptIn ? 'Subscribed' : 'Opted out'}
                            {c.isBlocked ? ' · Blocked' : ''}
                          </span>
                        </label>
                      ))}
                      {contacts && !contacts.rows.length && (
                        <p className="p-4 text-sm">No matching contacts.</p>
                      )}
                    </div>
                    <Pagination page={page} total={contacts?.total ?? 0} onChange={setPage} />
                  </>
                )}
                {step === 1 && (
                  <>
                    <label className="block space-y-2 text-sm">
                      WhatsApp account
                      <select
                        className={selectClass}
                        value={accountId}
                        onChange={(e) => {
                          setAccountId(e.target.value);
                          setNumberId('');
                          setConfig({});
                          setPreview(null);
                        }}
                      >
                        <option value="">Select account</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.businessAccountId} · {a.apiVersion}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-2 text-sm">
                      Associated sender number
                      <select
                        className={selectClass}
                        value={numberId}
                        onChange={(e) => {
                          setNumberId(e.target.value);
                          setConfig({});
                        }}
                      >
                        <option value="">Select sender number</option>
                        {numbers.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.phoneNumber} · {n.numberId}
                          </option>
                        ))}
                      </select>
                    </label>
                    {account && (
                      <div className="bg-muted rounded-lg p-4 text-sm">
                        <p>API version: {account.apiVersion}</p>
                        <p>Access token: {account.hasAccessToken ? 'Saved' : 'Missing'}</p>
                        <p>Webhook App Secret: {account.hasWebhookSecret ? 'Saved' : 'Missing'}</p>
                      </div>
                    )}
                    <Link
                      className="text-primary text-sm underline"
                      href={`/tenant/${encodeURIComponent(tenant)}/whatsapp`}
                      target="_blank"
                    >
                      Configure account credentials or add a sender number
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() =>
                        perform(async () => {
                          const { data } = await listWhatsappAccounts(tenant);
                          setAccounts(data);
                          if (accountId) {
                            const n = await listConnectionRecords(
                              tenant,
                              `whatsapp-accounts/${accountId}/numbers`,
                            );
                            setNumbers(n.data);
                          }
                        })
                      }
                    >
                      Refresh saved accounts
                    </Button>
                    <p className="text-muted-foreground text-xs">
                      All reachable templates must belong to this account. Changing sender clears
                      previous file and field selections.
                    </p>
                  </>
                )}
                {step === 2 && (
                  <div className="space-y-5">
                    {preview?.nodes.map((node) => (
                      <article key={node.id} className="space-y-4 rounded-xl border p-4">
                        <div>
                          <h3 className="font-medium">{node.label}</h3>
                          <p className="text-muted-foreground text-xs">
                            {node.template.name} · {node.template.language}
                          </p>
                        </div>
                        <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">
                          {node.template.components
                            .filter(
                              (c) =>
                                ['HEADER', 'BODY', 'FOOTER'].includes(String(c.type)) && c.text,
                            )
                            .map((c, i) => (
                              <p key={i}>{String(c.text)}</p>
                            ))}
                        </div>
                        {!node.fields.length && (
                          <p className="text-muted-foreground text-sm">
                            This template needs no runtime values.
                          </p>
                        )}
                        {node.fields.map((field) => {
                          const b = config[node.id]?.[field.key] ?? { source: 'fixed', value: '' };
                          return (
                            <div key={field.key} className="space-y-2">
                              <label
                                className="text-sm font-medium"
                                htmlFor={`${node.id}-${field.key}`}
                              >
                                {field.label}
                              </label>
                              <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
                                <select
                                  className={selectClass}
                                  aria-label={`${field.label} source`}
                                  value={b.source}
                                  onChange={(e) =>
                                    binding(node.id, field.key, {
                                      ...b,
                                      source: e.target.value as Binding['source'],
                                      value: '',
                                    })
                                  }
                                >
                                  <option value="fixed">Fixed value</option>
                                  <option value="contact">Contact field</option>
                                </select>
                                <Input
                                  id={`${node.id}-${field.key}`}
                                  placeholder={
                                    b.source === 'contact'
                                      ? 'name, email, customData.propertyName'
                                      : field.kind === 'media'
                                        ? 'https://… or upload a file'
                                        : 'Enter value'
                                  }
                                  value={b.value}
                                  onChange={(e) =>
                                    binding(node.id, field.key, { ...b, value: e.target.value })
                                  }
                                />
                              </div>
                              {b.source === 'contact' && (
                                <>
                                  <Input
                                    aria-label={`${field.label} fallback`}
                                    placeholder="Fallback when contact field is empty (optional)"
                                    value={b.fallback ?? ''}
                                    onChange={(e) =>
                                      binding(node.id, field.key, {
                                        ...b,
                                        fallback: e.target.value,
                                      })
                                    }
                                  />
                                  <p className="text-muted-foreground text-xs">
                                    Fields: name, phone, whatsappPhoneNumber, email, location, city,
                                    state, country, source, customData.key
                                  </p>
                                </>
                              )}
                              {field.kind === 'media' && (
                                <>
                                  <input
                                    type="file"
                                    aria-label={`Upload ${field.format?.toLowerCase()}`}
                                    accept={
                                      field.format === 'IMAGE'
                                        ? 'image/jpeg,image/png'
                                        : field.format === 'VIDEO'
                                          ? 'video/mp4,video/3gpp'
                                          : '.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx'
                                    }
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) upload(node.id, file, field.format);
                                    }}
                                  />
                                  {localMedia[node.id]?.type.startsWith('image/') && (
                                    <Image
                                      src={localMedia[node.id].url}
                                      alt="Selected template image"
                                      width={320}
                                      height={200}
                                      unoptimized
                                      className="max-h-48 rounded-lg object-contain"
                                    />
                                  )}
                                  {localMedia[node.id]?.type.startsWith('video/') && (
                                    <video
                                      src={localMedia[node.id].url}
                                      controls
                                      className="max-h-48 rounded-lg"
                                    />
                                  )}
                                  {localMedia[node.id] && (
                                    <a
                                      href={localMedia[node.id].url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-primary block text-xs underline"
                                    >
                                      Preview selected file
                                    </a>
                                  )}
                                  {config[node.id]?.['header.filename']?.value && (
                                    <p className="text-muted-foreground text-xs">
                                      Selected: {config[node.id]['header.filename'].value}
                                    </p>
                                  )}
                                  {/^https:\/\//.test(b.value) && (
                                    <a
                                      href={b.value}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-primary block text-xs underline"
                                    >
                                      Preview media
                                    </a>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setLocalMedia((m) => {
                                        const copy = { ...m };
                                        delete copy[node.id];
                                        return copy;
                                      });
                                      setConfig((c) => ({
                                        ...c,
                                        [node.id]: {
                                          ...c[node.id],
                                          'header.media': { source: 'fixed', value: '' },
                                          'header.filename': { source: 'fixed', value: '' },
                                        },
                                      }));
                                    }}
                                  >
                                    Remove file selection
                                  </Button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </article>
                    ))}
                  </div>
                )}
                {step === 3 && preview && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        ['Targeted', preview.total],
                        ['Eligible', preview.eligible],
                        ['Excluded', preview.excluded],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border p-4">
                          <p className="text-muted-foreground text-xs">{label}</p>
                          <p className="text-2xl font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm">
                      Sender: {numbers.find((n) => n.id === numberId)?.phoneNumber} ·{' '}
                      {account?.apiVersion}. Previous recipients can join this new run. Recipient
                      eligibility is checked again when starting and sending.
                    </p>
                    {!!preview.exclusions.length && (
                      <details>
                        <summary className="cursor-pointer text-sm">
                          Excluded recipients ({preview.excluded}; first 100 shown)
                        </summary>
                        <ul className="mt-2 space-y-1 text-xs">
                          {preview.exclusions.map((x) => (
                            <li key={x.contactId}>
                              {x.name || x.contactId}: {x.reason}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {preview.samples.map((sample) => (
                      <details key={sample.contactId} className="rounded-lg border p-3">
                        <summary className="cursor-pointer text-sm">
                          Preview for {sample.name || 'contact'} · {sample.phone}
                        </summary>
                        {sample.messages.map((m, i) => (
                          <MessagePreview
                            key={i}
                            payload={m}
                            source={
                              preview.nodes.find(
                                (n) => n.template.name === (m.template as { name: string }).name,
                              )?.template.components ?? []
                            }
                          />
                        ))}
                      </details>
                    ))}
                  </>
                )}
                <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={step === 0}
                      onClick={() => setStep((s) => s - 1)}
                    >
                      Back
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        perform(async () => {
                          await save();
                          toast.success('Draft saved');
                        })
                      }
                    >
                      Save draft
                    </Button>
                  </div>
                  {step < 3 ? (
                    <Button
                      disabled={
                        (step === 0 && !selectedCount) || (step === 1 && (!accountId || !numberId))
                      }
                      onClick={() => perform(next)}
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button
                      disabled={!preview?.eligible}
                      onClick={() =>
                        perform(async () => {
                          await save();
                          const { data } = await runAction<CampaignRun>(
                            tenant,
                            campaignId,
                            run.id,
                            'start',
                          );
                          setRun(data);
                          toast.success('Campaign started');
                        })
                      }
                    >
                      Start campaign · {preview?.eligible ?? 0} recipients
                    </Button>
                  )}
                </div>
              </fieldset>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Cancel this draft run?')) stop();
                }}
              >
                Cancel draft run
              </Button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                {[
                  ['Recipients', run.totalContacts],
                  ['Completed', run.completedContacts],
                  ['Failed', run.failedContacts],
                  ['Skipped', run.skippedContacts],
                  ['Stopped', run.stoppedContacts],
                  ['Needs review', run.reviewRequired ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border p-3">
                    <p className="text-muted-foreground text-xs">{label}</p>
                    <p className="text-xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={busy} onClick={() => perform(refresh)}>
                  <RefreshCwIcon />
                  Refresh
                </Button>
                {run.status === 'RUNNING' && (
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Permanently stop all remaining messages in this run? A request already being sent may finish.',
                        )
                      )
                        stop();
                    }}
                  >
                    Stop whole run
                  </Button>
                )}
                <p className="text-muted-foreground self-center text-xs">
                  Active runs refresh every 10 seconds.
                </p>
              </div>
              <div className="space-y-3">
                {rows?.rows.map((e) => (
                  <article key={e.id} className="space-y-3 rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {e.contact.name || e.contact.phone}{' '}
                          <span className="text-muted-foreground text-xs">{e.recipientPhone}</span>
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {e.status} · Current:{' '}
                          {run.snapshot?.nodes.find((n) => n.id === e.currentNodeId)?.label || '—'}{' '}
                          · Next:{' '}
                          {run.snapshot?.nodes.find((n) => n.id === e.nextNodeId)?.label ||
                            e.nextAction ||
                            '—'}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Next action: {date(e.nextActionAt)}
                        </p>
                      </div>
                      {['ACTIVE', 'WAITING'].includes(e.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Stop remaining messages for ${e.contact.name || e.contact.phone}?`,
                              )
                            )
                              stop(`enrollments/${e.id}/stop`);
                          }}
                        >
                          Stop recipient
                        </Button>
                      )}
                    </div>
                    {(e.lastError || e.stopReason) && (
                      <p className="text-destructive text-xs">{e.lastError || e.stopReason}</p>
                    )}
                    <details>
                      <summary className="cursor-pointer text-xs">
                        Message and execution history ({e.executions.length})
                      </summary>
                      <div className="mt-2 space-y-2">
                        {e.executions.map((x) => (
                          <div key={x.id} className="bg-muted space-y-1 rounded-lg p-3 text-xs">
                            <p>
                              {run.snapshot?.nodes.find((n) => n.id === x.campaignNodeId)?.label} ·{' '}
                              {x.status} · {x.message?.status || 'Pending'}
                              {x.branchKey ? ` · ${x.branchKey}` : ''}
                            </p>
                            <p>
                              Sent: {date(x.message?.sentAt ?? null)} · Delivered:{' '}
                              {date(x.message?.deliveredAt ?? null)} · Read:{' '}
                              {date(x.message?.readAt ?? null)}
                            </p>
                            {x.message?.failedAt && <p>Failed: {date(x.message.failedAt)}</p>}
                            {(x.message?.errorMessage || x.errorMessage) && (
                              <p className="text-destructive">
                                {x.message?.errorCode ? `Code ${x.message.errorCode}: ` : ''}
                                {x.message?.errorMessage || x.errorMessage}
                              </p>
                            )}
                            {x.status === 'REVIEW' && run.status === 'RUNNING' && (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    perform(async () => {
                                      await runAction(
                                        tenant,
                                        campaignId,
                                        run.id,
                                        `executions/${x.id}/resolve`,
                                        { resolution: 'mark-failed' },
                                      );
                                      await refresh();
                                    })
                                  }
                                >
                                  Mark failed
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        'WhatsApp may already have sent this message. Retrying can send a duplicate. Retry anyway?',
                                      )
                                    )
                                      perform(async () => {
                                        await runAction(
                                          tenant,
                                          campaignId,
                                          run.id,
                                          `executions/${x.id}/resolve`,
                                          { resolution: 'retry' },
                                        );
                                        await refresh();
                                      });
                                  }}
                                >
                                  Retry · may duplicate
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  </article>
                ))}
              </div>
              <Pagination
                page={recipientPage}
                total={rows?.total ?? 0}
                onChange={setRecipientPage}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span>
        {total} contacts · Page {page} of {Math.max(1, Math.ceil(total / 25))}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page * 25 >= total}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
function MessagePreview({
  payload,
  source,
}: {
  payload: Record<string, unknown>;
  source: Record<string, unknown>[];
}) {
  const template = payload.template as {
    name: string;
    components?: {
      type: string;
      parameters?: {
        text?: string;
        parameter_name?: string;
        type: string;
        image?: { link?: string };
        video?: { link?: string };
        document?: { link?: string; filename?: string };
      }[];
    }[];
  };
  function text(component: Record<string, unknown>) {
    const values =
      template.components?.find((c) => c.type === String(component.type).toLowerCase())
        ?.parameters ?? [];
    return String(component.text ?? '').replace(
      /\{\{([^{}]+)\}\}/g,
      (_, key: string) =>
        values.find((p, i) => (p.parameter_name ?? String(i + 1)) === key.trim())?.text ??
        `{{${key}}}`,
    );
  }
  return (
    <div className="mt-3 max-w-md rounded-2xl border bg-emerald-50 p-4 text-sm text-slate-900 dark:bg-emerald-950 dark:text-slate-100">
      <p className="mb-3 text-xs opacity-60">{template.name}</p>
      {source.map((c, i) => {
        if (['BODY', 'HEADER', 'FOOTER'].includes(String(c.type)) && c.text)
          return (
            <p
              key={i}
              className={`mb-2 whitespace-pre-wrap ${c.type === 'HEADER' ? 'font-semibold' : c.type === 'FOOTER' ? 'text-xs opacity-60' : ''}`}
            >
              {text(c)}
            </p>
          );
        if (c.type === 'HEADER' && c.format)
          return (
            <p key={i} className="mb-3 rounded-lg border p-3 text-xs">
              {String(c.format)} attachment ·{' '}
              {template.components?.find((x) => x.type === 'header')?.parameters?.[0]?.document
                ?.filename || 'Selected media'}
            </p>
          );
        if (c.type === 'BUTTONS' && Array.isArray(c.buttons))
          return (
            <div key={i} className="mt-3 space-y-2 border-t pt-3">
              {c.buttons.map((b: { text?: string; type?: string }, j: number) => (
                <p
                  key={j}
                  className="rounded-lg border p-2 text-center text-sky-700 dark:text-sky-300"
                >
                  {b.text || b.type}
                </p>
              ))}
            </div>
          );
        return null;
      })}
    </div>
  );
}
