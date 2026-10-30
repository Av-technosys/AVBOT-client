'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CopyIcon, KeyRoundIcon, PencilIcon, RefreshCcwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { generateTenantBearerToken, getTenant, type Tenant } from '@/lib/api';

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  return <TenantDetail key={tenantId} tenantId={tenantId} />;
}

function TenantDetail({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let active = true;
    getTenant(tenantId)
      .then(({ data }) => {
        if (active) {
          setTenant(data);
          setError('');
        }
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [tenantId, reload]);

  async function handleCopyBearerToken() {
    if (!tenant?.bearerToken) return;

    try {
      await navigator.clipboard.writeText(tenant.bearerToken);
      toast.success('Bearer token copied');
    } catch {
      toast.error('Failed to copy bearer token');
    }
  }

  async function handleGenerateBearerToken() {
    const confirmed = window.confirm(
      'Generate a new bearer token? The old token will stop working immediately.',
    );

    if (!confirmed) return;

    setGenerating(true);

    try {
      const res = await generateTenantBearerToken(tenantId);
      setTenant(res.data);
      toast.success('Bearer token generated and saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate bearer token');
    } finally {
      setGenerating(false);
    }
  }

  if (error)
    return (
      <div role="alert" className="space-y-3">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="outline" onClick={() => setReload((value) => value + 1)}>
          Retry
        </Button>
      </div>
    );

  if (!tenant) return <p className="text-muted-foreground text-sm">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          <p className="text-muted-foreground text-sm">{tenant.email}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/tenant/${encodeURIComponent(tenantId)}/edit`)}
        >
          <PencilIcon /> Edit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenant information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Name', value: tenant.name },
              { label: 'Company', value: tenant.companyName },
              { label: 'Phone', value: tenant.phone },
              { label: 'Email', value: tenant.email },
              { label: 'Tenant ID', value: String(tenant.tenantId) },
              { label: 'Slug', value: tenant.slug },
              { label: 'Created', value: new Date(tenant.createdAt).toLocaleString('en-IN') },
              { label: 'Updated', value: new Date(tenant.updatedAt).toLocaleString('en-IN') },
            ].map(({ label, value }) => (
              <div key={label} className="min-w-0 space-y-1">
                <dt className="text-muted-foreground text-sm">{label}</dt>
                <dd className="text-sm font-medium break-words">{value?.trim() || '—'}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4" /> Bearer Token
          </CardTitle>
          <CardDescription>View, copy, or generate a new token for this tenant.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="bg-muted/40 rounded-md border p-3 font-mono text-sm break-all">
            {tenant.bearerToken}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleCopyBearerToken}>
              <CopyIcon />
              Copy
            </Button>
            <Button variant="outline" onClick={handleGenerateBearerToken} disabled={generating}>
              <RefreshCcwIcon />
              {generating ? 'Generating...' : 'Generate New Token'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
