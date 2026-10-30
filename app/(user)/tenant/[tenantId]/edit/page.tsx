'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { TenantBreadcrumb } from '@/components/tenant-breadcrumb';
import { getTenant, updateTenant } from '@/lib/api';

export default function TenantEditPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTenant(tenantId)
      .then((res) => {
        setName(res.data.name);
        setCompanyName(res.data.companyName ?? '');
        setPhone(res.data.phone ?? '');
        setEmail(res.data.email);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load tenant'))
      .finally(() => setLoaded(true));
  }, [tenantId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await updateTenant(tenantId, { name, companyName, phone, email });
      toast.success('Tenant updated');

      setTimeout(() => router.push(`/tenant/${tenantId}`), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save tenant');
      setLoading(false);
    }
  }

  if (!loaded) return <p className="text-muted-foreground text-sm">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <TenantBreadcrumb currentPage="Edit" tenantId={tenantId} tenantLabel={name} />

      <Card>
        <CardHeader>
          <CardTitle>Edit Tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div>
              <Label className="mb-2">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div>
              <Label className="mb-2">Company Name</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>

            <div>
              <Label className="mb-2">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div>
              <Label className="mb-2">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
