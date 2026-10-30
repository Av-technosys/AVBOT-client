import type { SalesforceSyncObject } from '@/lib/api';

export const salesforceSyncOptions: { value: SalesforceSyncObject; label: string }[] = [
  { value: 'Lead', label: 'Leads' },
  { value: 'Contact', label: 'Contacts' },
];

export function salesforceAccountPath(tenantId: string, accountId?: string) {
  const path = `/tenant/${encodeURIComponent(tenantId)}/salesforce-connect`;
  return accountId ? `${path}/${encodeURIComponent(accountId)}` : path;
}

export function salesforceSyncLabel(objects: SalesforceSyncObject[]) {
  return (
    salesforceSyncOptions
      .filter((option) => objects.includes(option.value))
      .map((option) => option.label)
      .join(', ') || 'Not configured'
  );
}
