'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { EyeIcon, PencilIcon, PlusIcon, Trash2Icon, WorkflowIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TenantBreadcrumb } from '@/components/tenant-breadcrumb';
import { CampaignWorkspace } from '@/components/campaign-workspace';
import { toast } from 'sonner';
import {
  listCampaigns,
  getCampaign,
  saveCampaign,
  deleteCampaign,
  type Campaign,
  type CampaignInput,
  type CampaignStatus,
} from '@/lib/api';

const emptyForm: CampaignInput = { name: '', description: '', status: 'DRAFT' };
const statuses: { value: CampaignStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];
const statusColors: Record<CampaignStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-primary/10 text-primary',
  ARCHIVED: 'bg-secondary text-secondary-foreground',
};
function statusLabel(value: CampaignStatus) {
  return statuses.find((status) => status.value === value)?.label ?? value;
}
function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleString('en-IN') : '—';
}

export default function CampaignsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  return <TenantCampaigns key={tenantId} tenant={tenantId} />;
}

function TenantCampaigns({ tenant }: { tenant: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [workspace, setWorkspace] = useState<Campaign | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignInput>(emptyForm);
  const [viewing, setViewing] = useState<Campaign | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CampaignStatus | ''>('');
  const visible = campaigns.filter(
    (campaign) =>
      (!filter || campaign.status === filter) &&
      `${campaign.name} ${campaign.description ?? ''}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );

  useEffect(() => {
    let active = true;
    listCampaigns(tenant)
      .then(({ data }) => {
        if (active) {
          setCampaigns(data);
          setLoadError('');
        }
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
  }, [tenant, reload]);

  function edit(campaign?: Campaign) {
    setViewing(null);
    setEditingId(campaign?.id ?? '');
    setForm(
      campaign
        ? { name: campaign.name, description: campaign.description ?? '', status: campaign.status }
        : emptyForm,
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (editingId === null || busy) return;
    setBusy(true);
    try {
      const { data } = await saveCampaign(
        tenant,
        { ...form, description: form.description?.trim() || null },
        editingId || undefined,
      );
      setCampaigns((previous) => [data, ...previous.filter((row) => row.id !== data.id)]);
      setEditingId(null);
      setForm(emptyForm);
      setSearch('');
      setFilter('');
      toast.success(editingId ? 'Campaign updated' : 'Campaign created');
      if (!editingId) setWorkspace(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save campaign');
    } finally {
      setBusy(false);
    }
  }

  async function view(campaign: Campaign) {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await getCampaign(tenant, campaign.id);
      setViewing(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load campaign');
    } finally {
      setBusy(false);
    }
  }

  async function remove(campaign: Campaign) {
    if (busy || !window.confirm(`Delete campaign "${campaign.name}"?`)) return;
    setBusy(true);
    try {
      await deleteCampaign(tenant, campaign.id);
      setCampaigns((previous) => previous.filter((row) => row.id !== campaign.id));
      if (viewing?.id === campaign.id) setViewing(null);
      toast.success('Campaign deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete campaign');
    } finally {
      setBusy(false);
    }
  }

  if (workspace)
    return (
      <div className="flex flex-col gap-5">
        <TenantBreadcrumb tenantId={tenant} currentPage="Campaign workspace" />
        <CampaignWorkspace
          key={workspace.id}
          tenant={tenant}
          campaign={workspace}
          onClose={() => setWorkspace(null)}
          onSaved={(entryNodeId, updatedAt) => {
            setCampaigns((previous) =>
              previous.map((row) =>
                row.id === workspace.id ? { ...row, entryNodeId, updatedAt } : row,
              ),
            );
          }}
        />
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <TenantBreadcrumb tenantId={tenant} currentPage="Marketing Campaign Flow" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Marketing Campaign Flow</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create campaigns and build their message workflows in the workspace.
          </p>
        </div>
        <Button
          disabled={busy || !loaded || Boolean(loadError) || editingId !== null}
          onClick={() => edit()}
        >
          <PlusIcon />
          Create campaign
        </Button>
      </div>

      {editingId !== null && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit campaign' : 'Create campaign'}</CardTitle>
            <CardDescription>Give the campaign a name, description, and status.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <fieldset disabled={busy} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Campaign name</Label>
                  <Input
                    id="campaign-name"
                    required
                    maxLength={255}
                    value={form.name}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, name: event.target.value }))
                    }
                    placeholder="e.g. New property launch"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-description">Description (optional)</Label>
                  <Textarea
                    id="campaign-description"
                    rows={3}
                    value={form.description ?? ''}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, description: event.target.value }))
                    }
                    placeholder="Describe the audience and purpose of this campaign."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-status">Status</Label>
                  <select
                    id="campaign-status"
                    className="bg-background w-full rounded-lg border p-2 text-sm sm:max-w-xs"
                    value={form.status}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        status: event.target.value as CampaignStatus,
                      }))
                    }
                  >
                    {statuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy}>
                    {busy ? 'Saving...' : 'Save campaign'}
                  </Button>
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
              <CardTitle>Campaign details</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close campaign details"
                onClick={() => setViewing(null)}
              >
                <XIcon />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <h2 className="text-lg font-semibold break-all">{viewing.name}</h2>
            <p className="text-muted-foreground text-sm break-words whitespace-pre-wrap">
              {viewing.description || 'No description added.'}
            </p>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ['Status', statusLabel(viewing.status)],
                ['Publication', viewing.isPublished ? 'Published' : 'Not published'],
                ['Created', dateLabel(viewing.createdAt)],
                ['Updated', dateLabel(viewing.updatedAt)],
                ['Published at', dateLabel(viewing.publishedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1">{value}</dd>
                </div>
              ))}
            </dl>
            <Button
              variant="outline"
              disabled={busy || editingId !== null}
              onClick={() => edit(viewing)}
            >
              <PencilIcon />
              Edit campaign
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            All campaigns{' '}
            {loaded && !loadError && (
              <span className="text-muted-foreground text-sm">({campaigns.length})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loaded ? (
            <p className="text-muted-foreground text-sm">Loading campaigns...</p>
          ) : loadError ? (
            <div role="alert" className="space-y-2">
              <p className="text-destructive text-sm">{loadError}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setLoaded(false);
                  setReload((value) => value + 1);
                }}
              >
                Retry
              </Button>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-muted/30 space-y-2 rounded-lg border border-dashed p-8 text-center">
              <WorkflowIcon className="text-muted-foreground mx-auto size-8" />
              <p className="font-medium">No campaigns yet</p>
              <p className="text-muted-foreground text-sm">
                Create the first marketing campaign for this tenant.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  aria-label="Search campaigns"
                  placeholder="Search campaigns..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <select
                  aria-label="Filter campaigns by status"
                  className="bg-background rounded-lg border p-2 text-sm sm:w-44"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as CampaignStatus | '')}
                >
                  <option value="">All statuses</option>
                  {statuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              {visible.length === 0 && (
                <p className="text-muted-foreground text-sm">No campaigns match your search.</p>
              )}
              <div className="space-y-3">
                {visible.map((campaign) => (
                  <article
                    key={campaign.id}
                    className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium break-all">{campaign.name}</h2>
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${statusColors[campaign.status]}`}
                        >
                          {statusLabel(campaign.status)}
                        </span>
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-sm break-words">
                        {campaign.description || 'No description added.'}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Updated {dateLabel(campaign.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={busy || editingId !== null}
                        onClick={() => setWorkspace(campaign)}
                      >
                        <WorkflowIcon />
                        Workspace
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy || editingId !== null}
                        onClick={() => view(campaign)}
                      >
                        <EyeIcon />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy || editingId !== null}
                        onClick={() => edit(campaign)}
                      >
                        <PencilIcon />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={busy || editingId !== null}
                        onClick={() => remove(campaign)}
                      >
                        <Trash2Icon />
                        Delete
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
