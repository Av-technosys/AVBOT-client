import { request } from '@/lib/api';
import { NEXT_PUBLIC_API_BASE_URL } from '@/lib/env';
import type { TenantMedia } from '@/lib/media-api';

export type ChatSession = {
  token: string;
  tenantId: number;
  expiresAt: number;
  parentOrigin: string | null;
};
export type ChatNumber = {
  id: string;
  numberId: string;
  phoneNumber: string;
  accountId: string;
  businessAccountId: string;
};
export type ChatAttachment = {
  id: string;
  messageId: string;
  mediaType: string;
  mimeType: string | null;
  fileName: string | null;
};
export type ChatMessage = {
  id: string;
  contactId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  content: string | null;
  templateName: string | null;
  status: string;
  createdAt: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  errorMessage?: string | null;
  sendState?: string | null;
  attachments: ChatAttachment[];
};
export type ChatContact = {
  id: string;
  name: string | null;
  phone: string;
  whatsappPhoneNumber: string | null;
  isBlocked: boolean;
  lastMessage: Pick<
    ChatMessage,
    'id' | 'content' | 'type' | 'templateName' | 'direction' | 'status' | 'createdAt'
  > | null;
};
export type ChatHistory = {
  data: ChatMessage[];
  nextCursor: string | null;
  windowEndsAt: string | null;
  isBlocked: boolean;
};

export function createChatSession(bearerToken: string, parentOrigin?: string) {
  return request<{ data: ChatSession }>('/chat/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    data: { parentOrigin },
  });
}
export async function chatRequest<T>(token: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/chat${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.msg ?? 'Could not load chat. Please try again.');
  }
  return (await response.json()) as T;
}
export async function chatAttachmentBlob(
  token: string,
  numberId: string,
  attachmentId: string,
  signal: AbortSignal,
) {
  const response = await fetch(
    `${NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/chat/attachments/${attachmentId}/content?numberId=${encodeURIComponent(numberId)}`,
    { headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' },
  );
  if (!response.ok) throw new Error('Attachment unavailable.');
  return response.blob();
}
export function chatSocketUrl() {
  const url = new URL(`${NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/chat/ws`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
export async function uploadChatMedia(token: string, file: File, mimeType: string) {
  const { data } = await chatRequest<{
    data: { file: TenantMedia; uploadUrl: string; headers: Record<string, string> };
  }>(token, '/media/uploads', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, name: file.name, size: file.size, mimeType }),
  });
  const upload = await fetch(data.uploadUrl, { method: 'PUT', headers: data.headers, body: file });
  if (!upload.ok)
    throw new Error('Media upload failed. Please check S3 CORS settings and try again.');
  return chatRequest<{ data: TenantMedia }>(token, `/media/${data.file.slug}/complete`, {
    method: 'POST',
  });
}
export function chatMessagePreview(
  message: { content: string | null; type: string; templateName: string | null } | null,
) {
  if (!message) return 'Start a conversation';
  return (
    message.content ||
    (message.templateName
      ? `Template: ${message.templateName}`
      : ({
          IMAGE: 'Photo',
          DOCUMENT: 'Document',
          AUDIO: 'Voice message',
          VIDEO: 'Video',
          LOCATION: 'Location',
          INTERACTIVE: 'Interactive message',
        }[message.type] ?? 'Message'))
  );
}
export function chatRequestId() {
  if ('randomUUID' in globalThis.crypto) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
