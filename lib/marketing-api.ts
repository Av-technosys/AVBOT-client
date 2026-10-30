import { request, type Contact } from './api';
export type Binding = { source: 'fixed' | 'contact'; value: string; fallback?: string };
export type RuntimeConfig = Record<string, Record<string, Binding>>;
export type Audience = {
  selection: { mode: 'selected'; ids: string[] } | { mode: 'all'; excludedIds: string[] };
  filters?: {
    q?: string;
    searchField?: 'all' | 'name' | 'email' | 'phone' | 'location' | 'city' | 'state' | 'country';
    source?: string;
    salesforceConnectId?: string;
    location?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};
export type MarketingNode = {
  id: string;
  label: string;
  template: { name: string; language: string; components: Record<string, unknown>[] };
  fields: { key: string; label: string; kind: 'text' | 'media' | 'number'; format?: string }[];
};
export type CampaignRun = {
  id: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  totalContacts: number;
  completedContacts: number;
  failedContacts: number;
  skippedContacts: number;
  stoppedContacts: number;
  reviewRequired?: number;
  audience: Audience | null;
  runtimeConfig: RuntimeConfig;
  whatsappConnectId: string | null;
  whatsappConnectNumberId: string | null;
  snapshot: { nodes: { id: string; label: string }[] } | null;
};
export type Execution = {
  id: string;
  status: string;
  campaignNodeId: string;
  messageId: string | null;
  branchKey: string | null;
  errorMessage: string | null;
  createdAt: string;
  message?: {
    status: string;
    sentAt: string | null;
    deliveredAt: string | null;
    readAt: string | null;
    failedAt: string | null;
    errorCode: string | null;
    errorMessage: string | null;
  } | null;
};
export type Enrollment = {
  id: string;
  status: string;
  currentNodeId: string | null;
  nextNodeId: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  lastError: string | null;
  stopReason: string | null;
  recipientPhone: string | null;
  contact: { id: string; name: string | null; phone: string };
  executions: Execution[];
};
export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };
export type RunPreview = {
  total: number;
  eligible: number;
  excluded: number;
  exclusions: { contactId: string; name: string | null; reason: string }[];
  samples: {
    contactId: string;
    name: string | null;
    phone: string;
    messages: Record<string, unknown>[];
  }[];
  nodes: MarketingNode[];
};
export const runPath = (tenant: string, campaign: string, run?: string) =>
  `/tenants/${encodeURIComponent(tenant)}/campaigns/${campaign}/runs${run ? `/${run}` : ''}`;
export const listRuns = (tenant: string, campaign: string) =>
  request<{ data: CampaignRun[] }>(runPath(tenant, campaign));
export const createRun = (tenant: string, campaign: string) =>
  request<{ data: CampaignRun }>(runPath(tenant, campaign), { method: 'POST' });
export const getRun = (tenant: string, campaign: string, run: string) =>
  request<{ data: CampaignRun }>(runPath(tenant, campaign, run));
export const saveRun = (tenant: string, campaign: string, run: string, data: unknown) =>
  request<{ data: CampaignRun }>(runPath(tenant, campaign, run), { method: 'PUT', data });
export const runAction = <T>(
  tenant: string,
  campaign: string,
  run: string,
  action: string,
  data?: unknown,
) => request<{ data: T }>(`${runPath(tenant, campaign, run)}/${action}`, { method: 'POST', data });
export const audiencePage = (
  tenant: string,
  campaign: string,
  run: string,
  page: number,
  filters: Audience['filters'],
) =>
  request<{ data: Page<Contact> }>(`${runPath(tenant, campaign, run)}/audience`, {
    params: { page, ...filters },
  });
export const enrollmentPage = (tenant: string, campaign: string, run: string, page: number) =>
  request<{ data: Page<Enrollment> }>(`${runPath(tenant, campaign, run)}/enrollments`, {
    params: { page },
  });
export const uploadRunMedia = (tenant: string, campaign: string, run: string, file: File) =>
  request<{ data: { id: string; filename: string; mimeType: string; size: number } }>(
    `${runPath(tenant, campaign, run)}/media`,
    {
      method: 'POST',
      data: file,
      params: { filename: file.name },
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      timeout: 130000,
    },
  );
