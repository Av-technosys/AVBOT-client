import axios, { AxiosRequestConfig } from 'axios';
import { NEXT_PUBLIC_API_BASE_URL } from '@/lib/env';

const client = axios.create({
  baseURL: NEXT_PUBLIC_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly requestId?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function newRequestId() {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  // getRandomValues also works for internal apps served over HTTP.
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

client.interceptors.request.use((config) => {
  config.headers.set('X-Request-ID', newRequestId());
  return config;
});

export async function request<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await client.request<T>({ url: path, ...config });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const correlationId =
        err.response?.headers['x-request-id'] || err.config?.headers.get('X-Request-ID');
      if (err.response?.data instanceof Blob) {
        let msg = err.message || 'Request failed';
        try {
          const body = JSON.parse(await err.response.data.text());
          if (typeof body.msg === 'string') msg = body.msg;
        } catch {
          // Fall back to the HTTP error when the server did not return JSON.
        }
        throw new ApiRequestError(msg, correlationId, err.response?.status);
      }
      const msg = err.response?.data?.msg ?? err.message ?? 'Request failed';
      throw new ApiRequestError(msg, correlationId, err.response?.status);
    }
    throw err;
  }
}

export type Tenant = {
  tenantId: number;
  slug: string;
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string;
  bearerToken: string;
  createdAt: string;
  updatedAt: string;
};

export type SalesforceConnect = {
  syncObjects?: SalesforceSyncObject[];
  salesforceLoginUrl: string;
  salesforceApiUrl: string;
  salesforceToken: string | null;
  refreshToken: string | null;
  instanceUrl: string | null;
  signature: string | null;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  grantType: string;
};

export type SalesforceSyncObject = 'Lead' | 'Contact';

export type SalesforceImportOptions = { marketingOptIn?: boolean };

export type SalesforceImportJob = {
  id: string;
  tenantId: number;
  connectionId: string;
  objectType: SalesforceSyncObject;
  marketingOptIn: boolean;
  salesforceJobId: string | null;
  status: 'QUEUED' | 'EXPORTING' | 'IMPORTING' | 'COMPLETED' | 'FAILED';
  nextPollAt: string | null;
  deadlineAt: string;
  rowsProcessed: number;
  rowsImported: number;
  rowsSkipped: number;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
};

export function listSalesforceImportJobs(tenantId: string, accountId: string) {
  return request<{ data: SalesforceImportJob[] }>(
    `/tenants/${encodeURIComponent(tenantId)}/salesforce-accounts/${encodeURIComponent(accountId)}/import-jobs`,
  );
}

export function startSalesforceImport(
  tenantId: string,
  accountId: string,
  options: SalesforceImportOptions = {},
) {
  return request<{ data: SalesforceImportJob[] }>(
    `/tenants/${encodeURIComponent(tenantId)}/salesforce-accounts/${encodeURIComponent(accountId)}/import-jobs`,
    { method: 'POST', data: options },
  );
}

export type SalesforceAccount = Omit<SalesforceConnect, 'instanceUrl' | 'signature'> & {
  id: string;
  tenantId: number;
  syncObjects: SalesforceSyncObject[];
  createdAt: string;
  updatedAt: string;
};
export type SalesforceAccountInput = Pick<
  SalesforceAccount,
  | 'salesforceLoginUrl'
  | 'salesforceApiUrl'
  | 'clientId'
  | 'clientSecret'
  | 'username'
  | 'password'
  | 'grantType'
  | 'syncObjects'
>;

export type WhatsappAccount = {
  id: string;
  tenantId: number;
  businessAccountId: string;
  apiVersion: string;
  hasAccessToken: boolean;
  hasEncryptedToken: boolean;
  hasWebhookSecret: boolean;
  createdAt: string;
  updatedAt: string;
};
export type WhatsappAccountInput = {
  businessAccountId: string;
  apiVersion: string;
  accessToken?: string;
  encryptedToken?: string;
  webhookSecretEncrypted?: string;
};

// Tenants
export function listTenants() {
  return request<{ data: Tenant[] }>('/tenants');
}

export function getTenant(tenantId: string) {
  return request<{ data: Tenant }>(`/tenants/${encodeURIComponent(tenantId)}`);
}

export function createTenant(body: {
  name: string;
  companyName?: string;
  phone?: string;
  email: string;
}) {
  return request<{ data: Tenant }>('/tenants', {
    method: 'POST',
    data: body,
  });
}

export function updateTenant(
  tenantId: string,
  body: { name: string; companyName?: string; phone?: string; email: string },
) {
  return request<{ data: Tenant }>(`/tenants/${encodeURIComponent(tenantId)}`, {
    method: 'PUT',
    data: body,
  });
}

export function generateTenantBearerToken(tenantId: string) {
  return request<{ data: Tenant }>(`/tenants/${encodeURIComponent(tenantId)}/bearer-token`, {
    method: 'PUT',
  });
}

export function deleteTenant(tenantId: string) {
  return request<{ data: null }>(`/tenants/${encodeURIComponent(tenantId)}`, {
    method: 'DELETE',
  });
}

// Salesforce Connect
export function listSalesforceAccounts(tenantId: string) {
  return request<{ data: SalesforceAccount[] }>(
    `/tenants/${encodeURIComponent(tenantId)}/salesforce-accounts`,
  );
}

export function getSalesforceAccount(tenantId: string, accountId: string) {
  return request<{ data: SalesforceAccount }>(
    `/tenants/${encodeURIComponent(tenantId)}/salesforce-accounts/${encodeURIComponent(accountId)}`,
  );
}

export function saveSalesforceAccount(
  tenantId: string,
  body: Partial<SalesforceAccountInput> & SalesforceImportOptions,
  accountId?: string,
) {
  return request<{
    data: SalesforceAccount;
    importJobs: SalesforceImportJob[];
  }>(
    `/tenants/${encodeURIComponent(tenantId)}/salesforce-accounts${accountId ? `/${encodeURIComponent(accountId)}` : ''}`,
    { method: accountId ? 'PUT' : 'POST', data: body },
  );
}

export function deleteSalesforceAccount(tenantId: string, accountId: string) {
  return request<{ data: null }>(
    `/tenants/${encodeURIComponent(tenantId)}/salesforce-accounts/${encodeURIComponent(accountId)}`,
    { method: 'DELETE' },
  );
}

export function getSalesforceConnect(tenantId: string) {
  return request<{ data: SalesforceConnect | null }>(
    `/tenants/${encodeURIComponent(tenantId)}/salesforce-connect`,
  );
}

export function saveSalesforceConnect(tenantId: string, body: Partial<SalesforceConnect>) {
  return request<{ data: SalesforceConnect }>(
    `/tenants/${encodeURIComponent(tenantId)}/salesforce-connect`,
    {
      method: 'PUT',
      data: body,
    },
  );
}

export function deleteSalesforceConnect(tenantId: string) {
  return request<{ data: null }>(`/tenants/${encodeURIComponent(tenantId)}/salesforce-connect`, {
    method: 'DELETE',
  });
}

// WhatsApp accounts belong to a tenant; numbers belong to a selected account.
export function listWhatsappAccounts(tenantId: string) {
  return request<{ data: WhatsappAccount[] }>(
    `/tenants/${encodeURIComponent(tenantId)}/whatsapp-accounts`,
  );
}

export function saveWhatsappAccount(
  tenantId: string,
  body: WhatsappAccountInput,
  accountId?: string,
) {
  return request<{ data: WhatsappAccount }>(
    `/tenants/${encodeURIComponent(tenantId)}/whatsapp-accounts${accountId ? `/${accountId}` : ''}`,
    {
      method: accountId ? 'PUT' : 'POST',
      data: body,
    },
  );
}

export function deleteWhatsappAccount(tenantId: string, accountId: string) {
  return request<{ data: null }>(
    `/tenants/${encodeURIComponent(tenantId)}/whatsapp-accounts/${accountId}`,
    {
      method: 'DELETE',
    },
  );
}

export type MessageTemplate = {
  id: string;
  tenantId: number;
  whatsappConnectId: string;
  providerTemplateId: string | null;
  name: string;
  language: string;
  category: string | null;
  status: string;
  components: Record<string, unknown>[];
  variableSchema: Record<string, unknown> | null;
  metaOptions?: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
export type MessageTemplateInput = Pick<
  MessageTemplate,
  'name' | 'language' | 'category' | 'components' | 'variableSchema' | 'metaOptions'
>;
function templatePath(tenantId: string, accountId: string, templateId?: string) {
  return `/tenants/${encodeURIComponent(tenantId)}/whatsapp-accounts/${encodeURIComponent(accountId)}/templates${templateId ? `/${encodeURIComponent(templateId)}` : ''}`;
}
export function listMessageTemplates(tenantId: string, accountId: string) {
  return request<{ data: MessageTemplate[] }>(templatePath(tenantId, accountId));
}
export function syncMessageTemplates(tenantId: string, accountId: string) {
  return request<{
    data: MessageTemplate[];
    sync: { fetched: number; imported: number; updated: number; skipped: string[] };
  }>(`${templatePath(tenantId, accountId)}/sync`, { method: 'POST' });
}
export function getMessageTemplate(tenantId: string, accountId: string, templateId: string) {
  return request<{ data: MessageTemplate }>(templatePath(tenantId, accountId, templateId));
}
export function saveMessageTemplate(
  tenantId: string,
  accountId: string,
  body: MessageTemplateInput,
  templateId?: string,
) {
  return request<{ data: MessageTemplate }>(templatePath(tenantId, accountId, templateId), {
    method: templateId ? 'PUT' : 'POST',
    data: body,
  });
}
export function deleteMessageTemplate(tenantId: string, accountId: string, templateId: string) {
  return request<{ data: null }>(templatePath(tenantId, accountId, templateId), {
    method: 'DELETE',
  });
}

export type ApiMappingType = 'Account' | 'Deals' | 'ScheduleBooking';
export type ConnectionRecord = {
  id: string;
  numberId?: string;
  phoneNumber?: string;
  apiEndpoint?: string;
  apiMappingType?: ApiMappingType;
  fieldMapping?: Record<string, unknown>;
};
export type ConnectionRecordKind =
  | `whatsapp-accounts/${string}/numbers`
  | `salesforce-accounts/${string}/api-mappings`
  | 'salesforce-connect/api-mappings';
export function listConnectionRecords(tenantId: string, kind: ConnectionRecordKind) {
  return request<{ data: ConnectionRecord[] }>(`/tenants/${encodeURIComponent(tenantId)}/${kind}`);
}
export function saveConnectionRecord(
  tenantId: string,
  kind: ConnectionRecordKind,
  body: Omit<ConnectionRecord, 'id'>,
  id?: string,
) {
  return request<{ data: ConnectionRecord }>(
    `/tenants/${encodeURIComponent(tenantId)}/${kind}${id ? `/${id}` : ''}`,
    {
      method: id ? 'PUT' : 'POST',
      data: body,
    },
  );
}
export function deleteConnectionRecord(tenantId: string, kind: ConnectionRecordKind, id: string) {
  return request<{ data: null }>(`/tenants/${encodeURIComponent(tenantId)}/${kind}/${id}`, {
    method: 'DELETE',
  });
}

export type CampaignStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type Campaign = {
  id: string;
  tenantId: number;
  name: string;
  description: string | null;
  status: CampaignStatus;
  entryNodeId: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type CampaignInput = { name: string; description: string | null; status: CampaignStatus };
export function listCampaigns(tenant: string) {
  return request<{ data: Campaign[] }>(`/tenants/${encodeURIComponent(tenant)}/campaigns`);
}
export function getCampaign(tenant: string, campaignId: string) {
  return request<{ data: Campaign }>(
    `/tenants/${encodeURIComponent(tenant)}/campaigns/${campaignId}`,
  );
}
export function saveCampaign(tenant: string, body: CampaignInput, campaignId?: string) {
  return request<{ data: Campaign }>(
    `/tenants/${encodeURIComponent(tenant)}/campaigns${campaignId ? `/${campaignId}` : ''}`,
    {
      method: campaignId ? 'PUT' : 'POST',
      data: body,
    },
  );
}
export function deleteCampaign(tenant: string, campaignId: string) {
  return request<{ data: null }>(`/tenants/${encodeURIComponent(tenant)}/campaigns/${campaignId}`, {
    method: 'DELETE',
  });
}

export type CampaignNodeType =
  | 'START'
  | 'SEND_TEMPLATE'
  | 'SEND_TEXT'
  | 'WAIT'
  | 'CONDITION'
  | 'UPDATE_CONTACT'
  | 'ASSIGN_AGENT'
  | 'END';
export type CampaignNode = {
  id: string;
  nodeKey: string;
  nodeType: CampaignNodeType;
  label: string | null;
  config: Record<string, unknown>;
  messageTemplateId: string | null;
  sendNextMessageOnSeen: boolean;
  nextMessageSeekDelayMinutes: number | null;
  nextMessageDelayMinutes: number;
  positionX: number | null;
  positionY: number | null;
};
export type CampaignEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  branchKey: string;
};
export type CampaignFlow = {
  nodes: CampaignNode[];
  edges: CampaignEdge[];
  entryNodeId: string | null;
  updatedAt: string;
};
export function getCampaignFlow(tenant: string, campaignId: string) {
  return request<{ data: CampaignFlow }>(
    `/tenants/${encodeURIComponent(tenant)}/campaigns/${campaignId}/flow`,
  );
}
export function saveCampaignFlow(tenant: string, campaignId: string, body: CampaignFlow) {
  return request<{ data: CampaignFlow }>(
    `/tenants/${encodeURIComponent(tenant)}/campaigns/${campaignId}/flow`,
    { method: 'PUT', data: body },
  );
}
export function listCampaignTemplates(tenant: string) {
  return request<{ data: MessageTemplate[] }>(
    `/tenants/${encodeURIComponent(tenant)}/campaign-templates`,
  );
}

export type ContactSource = 'SALESFORCE' | 'WHATSAPP' | 'CSV_IMPORT' | 'API' | 'MANUAL';
export type Contact = {
  id: string;
  tenantId: number;
  salesforceConnectId: string | null;
  phone: string;
  name: string | null;
  email: string | null;
  whatsappPhoneNumber: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  source: ContactSource;
  marketingOptIn: boolean;
  marketingOptedOutAt: string | null;
  isBlocked: boolean;
  salesforceContactId: string | null;
  salesforceLeadId: string | null;
  salesforceObjectType: string | null;
  salesforceObjectId: string | null;
  customData: Record<string, unknown> | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ContactInput = Pick<Contact, 'phone'> &
  Partial<
    Omit<
      Contact,
      'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'marketingOptedOutAt' | 'lastSyncedAt'
    >
  >;
export type ContactPage = {
  data: Contact[];
  summary: {
    total: number;
    subscribed: number;
    unsubscribed: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};
export function listContacts(tenant: string, page: number, pageSize: number, signal?: AbortSignal) {
  return request<ContactPage>(`/tenants/${encodeURIComponent(tenant)}/contacts`, {
    params: { page, pageSize },
    signal,
  });
}
export function getContact(tenant: string, contactId: string) {
  return request<{ data: Contact }>(`/tenants/${encodeURIComponent(tenant)}/contacts/${contactId}`);
}
export function saveContact(tenant: string, body: ContactInput, contactId?: string) {
  return request<{ data: Contact }>(
    `/tenants/${encodeURIComponent(tenant)}/contacts${contactId ? `/${contactId}` : ''}`,
    {
      method: contactId ? 'PUT' : 'POST',
      data: body,
    },
  );
}
export function deleteContact(tenant: string, contactId: string) {
  return request<{ data: null }>(`/tenants/${encodeURIComponent(tenant)}/contacts/${contactId}`, {
    method: 'DELETE',
  });
}

export type ContactSelection =
  { mode: 'selected'; ids: string[] } | { mode: 'all'; excludedIds: string[] };

export function deleteSelectedContacts(tenant: string, selection: ContactSelection) {
  return request<{ data: { deleted: number } }>(
    `/tenants/${encodeURIComponent(tenant)}/contacts/bulk`,
    { method: 'DELETE', data: selection },
  );
}

export function exportSelectedContacts(tenant: string, selection: ContactSelection) {
  return request<Blob>(`/tenants/${encodeURIComponent(tenant)}/contacts/export`, {
    method: 'POST',
    data: selection,
    responseType: 'blob',
  });
}

export type SalesforceImportResult = {
  total: number;
  ready: number;
  invalid: number;
  duplicates: number;
  existing: number;
  imported: number;
  rows: {
    row: number;
    name: string;
    phone: string;
    salesforceId: string;
    status: 'ready' | 'invalid' | 'duplicate' | 'existing';
    reason: string;
  }[];
  issues: { row: number; reason: string }[];
};

export function importSalesforceCsv(
  tenant: string,
  csv: string,
  preview: boolean,
  marketingOptIn = false,
) {
  return request<{ data: SalesforceImportResult }>(
    `/tenants/${encodeURIComponent(tenant)}/contacts/import-salesforce${preview ? '/preview' : ''}`,
    {
      method: 'POST',
      data: csv,
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      params: { marketingOptIn },
      transformRequest: [(data) => data],
    },
  );
}
