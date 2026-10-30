import Link from 'next/link';
import { ChevronRightIcon } from 'lucide-react';

type TenantBreadcrumbProps = {
  tenantId: string;
  currentPage: string;
  tenantLabel?: string;
  parentPage?: { label: string; href: string };
};

export function TenantBreadcrumb({
  tenantId,
  currentPage,
  tenantLabel,
  parentPage,
}: TenantBreadcrumbProps) {
  const detailLabel = tenantLabel?.trim() || `Tenant ${tenantId}`;

  return (
    <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link className="hover:text-foreground transition-colors" href="/tenant">
            Tenants
          </Link>
        </li>
        <li aria-hidden="true" className="flex items-center">
          <ChevronRightIcon className="size-4" />
        </li>
        <li>
          <Link
            className="hover:text-foreground transition-colors"
            href={`/tenant/${encodeURIComponent(tenantId)}`}
          >
            {detailLabel}
          </Link>
        </li>
        <li aria-hidden="true" className="flex items-center">
          <ChevronRightIcon className="size-4" />
        </li>
        {parentPage && (
          <>
            <li>
              <Link className="hover:text-foreground transition-colors" href={parentPage.href}>
                {parentPage.label}
              </Link>
            </li>
            <li aria-hidden="true" className="flex items-center">
              <ChevronRightIcon className="size-4" />
            </li>
          </>
        )}
        <li aria-current="page" className="text-foreground font-medium">
          {currentPage}
        </li>
      </ol>
    </nav>
  );
}
