import { request } from '@/lib/api';

export type TenantRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'VIEWER';
export type InvitationRole = Exclude<TenantRole, 'OWNER'>;

type TenantMember = {
  id: string;
  name: string;
  email: string;
  role: TenantRole;
  isActive: boolean;
  isLinked: boolean;
  editableRoles: TenantRole[];
};

export type TenantInvitation = {
  id: string;
  email: string;
  role: InvitationRole;
  expiresAt: string;
};

export type TenantOnboarding = {
  email: string;
  invitations: Array<{ id: string; tenantName: string; role: InvitationRole }>;
};

export type OnboardingChoice = { invitationId: string } | { name: string; companyName?: string };

const tenantPath = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}`;

export function listTenantUsers(tenant: string, signal?: AbortSignal) {
  return request<{ data: { members: TenantMember[]; invitations: TenantInvitation[] } }>(
    `${tenantPath(tenant)}/users`,
    { signal },
  );
}

export function inviteTenantUser(tenant: string, email: string, role: InvitationRole) {
  return request<{ data: TenantInvitation }>(`${tenantPath(tenant)}/invitations`, {
    method: 'POST',
    data: { email, role },
  });
}

export function revokeTenantInvitation(tenant: string, invitationId: string) {
  return request(`${tenantPath(tenant)}/invitations/${encodeURIComponent(invitationId)}`, {
    method: 'DELETE',
  });
}

export function updateTenantUserRole(tenant: string, userId: string, role: TenantRole) {
  return request<{ data: Pick<TenantMember, 'role' | 'editableRoles'> }>(
    `${tenantPath(tenant)}/users/${encodeURIComponent(userId)}/role`,
    { method: 'PUT', data: { role } },
  );
}
