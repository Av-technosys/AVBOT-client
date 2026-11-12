'use client';

import Link from 'next/link';
import { useConsoleUser } from '@/components/console-session';
import TenantListPage from '../tenant/page';

export default function AdminPage() {
  const user = useConsoleUser();
  if (!user.isAdmin) {
    return (
      <div className="space-y-3">
        <p role="alert">Platform administrator access is required.</p>
        <Link href="/tenant" className="underline">
          Go to your tenant
        </Link>
      </div>
    );
  }
  return <TenantListPage />;
}
