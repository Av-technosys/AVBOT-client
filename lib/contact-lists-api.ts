import { request, type Contact, type ContactSelection } from './api';

export type ContactFilters = {
  q?: string;
  searchField?:
    'all' | 'all-fields' | 'name' | 'email' | 'phone' | 'location' | 'city' | 'state' | 'country';
  source?: string;
  salesforceConnectId?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
};

export type ContactPickerPage = { rows: Contact[]; total: number; page: number; pageSize: number };
export type ContactList = { id: string; name: string; memberCount: number };
type Membership = { selection: ContactSelection; filters?: ContactFilters };

const tenantPath = (tenant: string) => `/tenants/${encodeURIComponent(tenant)}`;
const listPath = (tenant: string) => `${tenantPath(tenant)}/contact-lists`;

export function searchContacts(
  tenant: string,
  page: number,
  filters: ContactFilters,
  signal?: AbortSignal,
) {
  return request<{ data: ContactPickerPage }>(`${tenantPath(tenant)}/contacts/search`, {
    params: { page, ...filters },
    signal,
  });
}

export function getContactLists(tenant: string, signal?: AbortSignal) {
  return request<{ data: ContactList[] }>(listPath(tenant), { signal });
}

export function createContactList(tenant: string, name: string, membership?: Membership) {
  return request<{ data: ContactList }>(listPath(tenant), {
    method: 'POST',
    data: { name, membership },
  });
}

export function renameContactList(tenant: string, id: string, name: string) {
  return request<{ data: ContactList }>(`${listPath(tenant)}/${id}`, {
    method: 'PUT',
    data: { name },
  });
}

export function deleteContactList(tenant: string, id: string) {
  return request<{ data: null }>(`${listPath(tenant)}/${id}`, { method: 'DELETE' });
}

export function getContactListMembers(
  tenant: string,
  id: string,
  page: number,
  signal?: AbortSignal,
) {
  return request<{ data: ContactPickerPage }>(`${listPath(tenant)}/${id}/members`, {
    params: { page },
    signal,
  });
}

export function updateContactListMembers(
  tenant: string,
  id: string,
  method: 'PUT' | 'DELETE',
  membership: Membership,
) {
  return request<{ data: { changed: number; memberCount: number } }>(
    `${listPath(tenant)}/${id}/members`,
    { method, data: membership },
  );
}
