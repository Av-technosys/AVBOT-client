import { request } from './api';

export type MessageCounts = { sent: number; delivered: number; seen: number; unseen: number };
export type DailyMessageCounts = MessageCounts & {
  day: string;
  types: (MessageCounts & { type: string })[];
};
export type MessageAnalytics = {
  timezone: string;
  totals: MessageCounts;
  previousTotals: MessageCounts;
  series: DailyMessageCounts[];
};
export type AnalyticsDays = 7 | 30;

export function getMessageAnalytics(tenant: string, days: AnalyticsDays, signal?: AbortSignal) {
  return request<{ data: MessageAnalytics }>(
    `/tenants/${encodeURIComponent(tenant)}/message-analytics`,
    {
      params: { days },
      signal,
    },
  );
}
