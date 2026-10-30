'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createTenant, deleteTenant, listTenants, type Tenant } from '@/lib/api';

export default function TenantListPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadTenants() {
    const res = await listTenants();
    setTenants(res.data);
  }

  useEffect(() => {
    let cancelled = false;

    listTenants().then((res) => {
      if (!cancelled) setTenants(res.data);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddTenant(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createTenant({ name, companyName, phone, email });
      setName('');
      setCompanyName('');
      setPhone('');
      setEmail('');
      setShowAddForm(false);
      await loadTenants();
      toast.success('Tenant added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(tenant: Tenant) {
    const confirmed = window.confirm(
      `${tenant.name} do you want to delete it?? This action cannot be undone`,
    );
    if (!confirmed) return;
    setDeletingId(tenant.tenantId);
    try {
      await deleteTenant(String(tenant.tenantId));
      setTenants((prev) => prev.filter((t) => t.tenantId !== tenant.tenantId));
      toast.success('Tenant deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete tenant');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <Button onClick={() => setShowAddForm((prev) => !prev)}>
          <PlusIcon /> Add Tenant
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Tenant</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTenant} className="flex flex-col gap-4">
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
                {loading ? 'Creating...' : 'Create Tenant'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {tenants.map((tenant) => (
          <Card key={tenant.tenantId}>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{tenant.name}</p>
                <p className="text-muted-foreground truncate text-sm">{tenant.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/tenant/${encodeURIComponent(tenant.slug || String(tenant.tenantId))}/edit`,
                    )
                  }
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/tenant/${encodeURIComponent(tenant.slug || String(tenant.tenantId))}`,
                    )
                  }
                >
                  Visit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(tenant)}
                  disabled={deletingId === tenant.tenantId}
                >
                  {deletingId === tenant.tenantId ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {tenants.length === 0 && <p className="text-muted-foreground text-sm">No tenants yet.</p>}
      </div>
    </div>
  );
}
