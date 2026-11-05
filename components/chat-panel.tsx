'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeftIcon,
  CheckIcon,
  CheckCheckIcon,
  Clock3Icon,
  CodeXmlIcon,
  FileTextIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  PaperclipIcon,
  SearchIcon,
  SendIcon,
  TriangleAlertIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getTenant } from '@/lib/api';
import { fileMime, MEDIA_ACCEPT, type TenantMedia } from '@/lib/media-api';
import {
  chatAttachmentBlob,
  chatMessagePreview,
  chatRequest,
  chatRequestId,
  chatSocketUrl,
  createChatSession,
  uploadChatMedia,
  type ChatAttachment,
  type ChatContact,
  type ChatHistory,
  type ChatMessage,
  type ChatNumber,
  type ChatSession,
} from '@/lib/chat-api';

type SendInput = { contactId: string; text: string; mediaSlug?: string; requestId: string };
type Sender = (input: SendInput) => Promise<ChatMessage>;
const time = (date: string) =>
  new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export function TenantChat({ tenant }: { tenant: string }) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function connect() {
      try {
        const { data: details } = await getTenant(tenant);
        const { data } = await createChatSession(details.bearerToken);
        if (active) {
          setSession(data);
          setError('');
          timer = setTimeout(
            () => {
              void connect();
            },
            Math.max(1000, data.expiresAt - Date.now() - 60000),
          );
        }
      } catch (err) {
        if (active) setError((err as Error).message);
      }
    }
    void connect();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tenant, retry]);
  if (!session)
    return (
      <div className="flex min-h-96 items-center justify-center rounded-xl border">
        {error ? (
          <div role="alert" className="space-y-3 text-center">
            <p>{error}</p>
            <Button onClick={() => setRetry((n) => n + 1)}>Reconnect</Button>
          </div>
        ) : (
          <LoaderCircleIcon className="animate-spin" aria-label="Opening chat" />
        )}
      </div>
    );
  return (
    <>
      <ChatPanel session={session} internal />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </>
  );
}

export function EmbeddedChat({
  tenantId,
  parentOrigin,
}: {
  tenantId: string;
  parentOrigin: string;
}) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let origin: string;
    try {
      origin = new URL(parentOrigin).origin;
      if (origin !== parentOrigin || window.parent === window) throw new Error();
    } catch {
      setError('Open this view inside an iframe with a valid parentOrigin.');
      return;
    }
    const receive = (event: MessageEvent) => {
      if (
        event.source !== window.parent ||
        event.origin !== origin ||
        event.data?.type !== 'avbot:chat:session'
      )
        return;
      if (String(event.data.tenantId) !== tenantId || typeof event.data.token !== 'string') {
        setError('The embedding tenant does not match.');
        return;
      }
      // The signed claims are checked by the backend; this check prevents a host
      // from accidentally attaching a valid session for a different tenant/origin.
      try {
        const body = event.data.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const claims = JSON.parse(
          new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0))),
        );
        if (
          String(claims.tenantId) !== tenantId ||
          claims.parentOrigin !== origin ||
          claims.expiresAt <= Date.now()
        )
          throw new Error();
        setSession({
          token: event.data.token,
          tenantId: claims.tenantId,
          parentOrigin: origin,
          expiresAt: claims.expiresAt,
        });
        setError('');
      } catch {
        setError('The chat credential is invalid or expired.');
      }
    };
    window.addEventListener('message', receive);
    const request = () => window.parent.postMessage({ type: 'avbot:chat:ready', tenantId }, origin);
    request();
    const timer = setInterval(request, 50 * 60 * 1000);
    return () => {
      window.removeEventListener('message', receive);
      clearInterval(timer);
    };
  }, [tenantId, parentOrigin]);
  if (!tenantId || !parentOrigin)
    return (
      <p role="alert" className="p-6">
        The iframe requires tenantId and parentOrigin.
      </p>
    );
  if (!session)
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center text-sm text-slate-500">
        {error || 'Waiting for a secure connection from the host application…'}
      </div>
    );
  return <ChatPanel session={session} embedded />;
}

function useChatSocket(
  session: ChatSession,
  numberId: string,
  onUpdate: (contactId?: string) => void,
) {
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef(
    new Map<
      string,
      {
        resolve: (message: ChatMessage) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >(),
  );
  const updateRef = useRef(onUpdate);
  updateRef.current = onUpdate;
  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const rejectPending = () => {
      for (const p of pending.current.values()) {
        clearTimeout(p.timer);
        p.reject(new Error('Connection interrupted. Check the conversation before sending again.'));
      }
      pending.current.clear();
    };
    function connect() {
      if (stopped) return;
      const ws = new WebSocket(chatSocketUrl());
      socket.current = ws;
      ws.onopen = () => {
        if (!stopped) ws.send(JSON.stringify({ type: 'auth', token: session.token }));
      };
      ws.onmessage = (event) => {
        if (stopped || socket.current !== ws) return;
        const value = JSON.parse(event.data);
        if (value.type === 'ready') {
          if (numberId) ws.send(JSON.stringify({ type: 'subscribe', numberId }));
        } else if (value.type === 'subscribed' && value.numberId === numberId) {
          setLive(true);
          setError('');
          attempts = 0;
          updateRef.current();
        } else if (
          (value.type === 'update' || value.type === 'resync') &&
          value.numberId === numberId
        )
          updateRef.current(value.contactId);
        else if (value.type === 'sent' || value.type === 'error') {
          const request = pending.current.get(value.requestId);
          if (request) {
            clearTimeout(request.timer);
            pending.current.delete(value.requestId);
            if (value.type === 'sent') request.resolve(value.data);
            else request.reject(new Error(value.msg));
          } else if (value.type === 'error') setError(value.msg);
        }
      };
      ws.onerror = () => {
        if (!stopped) setLive(false);
      };
      ws.onclose = (event) => {
        if (stopped) return;
        setLive(false);
        rejectPending();
        if (event.code === 4401) {
          setError('Chat session expired. Refresh or reconnect through your host application.');
          return;
        }
        setError('Reconnecting to chat…');
        retry = setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(attempts++, 4)));
      };
    }
    setLive(false);
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket.current?.close();
      rejectPending();
    };
  }, [session.token, numberId]);
  const send: Sender = useCallback(
    (input) =>
      new Promise((resolve, reject) => {
        const ws = socket.current;
        if (!live || !ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error('Wait for chat to reconnect.'));
          return;
        }
        const timer = setTimeout(() => {
          pending.current.delete(input.requestId);
          reject(
            new Error(
              'Sending is taking longer than expected. Check the conversation before sending again.',
            ),
          );
          updateRef.current(input.contactId);
        }, 180000);
        pending.current.set(input.requestId, { resolve, reject, timer });
        ws.send(JSON.stringify({ type: 'send', numberId, ...input }));
      }),
    [live, numberId],
  );
  return { live, error, send };
}

export function ChatPanel({
  session,
  embedded = false,
  internal = false,
}: {
  session: ChatSession;
  embedded?: boolean;
  internal?: boolean;
}) {
  const [numbers, setNumbers] = useState<ChatNumber[]>([]);
  const [numberId, setNumberId] = useState('');
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selected, setSelected] = useState<ChatContact | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [chatRevision, setChatRevision] = useState(0);
  const [showEmbed, setShowEmbed] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback((contactId?: string) => {
    if (!contactId || contactId === selectedRef.current?.id) setChatRevision((n) => n + 1);
    if (!refreshTimer.current)
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        setRevision((n) => n + 1);
      }, 200);
  }, []);
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );
  const { live, error: socketError, send } = useChatSocket(session, numberId, refresh);
  useEffect(() => {
    const abort = new AbortController();
    chatRequest<{ data: ChatNumber[] }>(session.token, '/numbers', { signal: abort.signal })
      .then(({ data }) => {
        setNumbers(data);
        setNumberId((old) =>
          data.some((n) => n.numberId === old) ? old : (data[0]?.numberId ?? ''),
        );
        setLoading(false);
      })
      .catch((err) => {
        if (!abort.signal.aborted) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => abort.abort();
  }, [session.token]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!numberId) return;
    const abort = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ numberId, q: search, page: String(page) });
    chatRequest<{ data: ChatContact[]; hasMore: boolean }>(session.token, `/contacts?${params}`, {
      signal: abort.signal,
    })
      .then(({ data, hasMore }) => {
        setContacts(data);
        setHasMore(hasMore);
        setError('');
      })
      .catch((err) => {
        if (!abort.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [session.token, numberId, search, page, revision]);
  const senderNumber = numbers.find((n) => n.numberId === numberId);
  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden border border-slate-200 bg-white text-slate-900 shadow-sm ${embedded ? 'h-dvh' : 'h-[calc(100dvh-7rem)] min-h-[520px] rounded-xl'}`}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <MessageCircleIcon className="size-5" />
        </div>
        <div className="mr-auto">
          <h1 className="text-base font-semibold">WhatsApp inbox</h1>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`size-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {live ? 'Connected · live messages' : 'Connecting…'}
          </p>
        </div>
        <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-500">
          <span className="hidden sm:inline">WhatsApp number</span>
          <select
            aria-label="WhatsApp sender number"
            className="max-w-64 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
            value={numberId}
            onChange={(event) => {
              setNumberId(event.target.value);
              setSelected(null);
              setContacts([]);
              setPage(1);
            }}
          >
            <option value="" disabled>
              {numbers.length ? 'Select number' : 'No linked numbers'}
            </option>
            {numbers.map((number) => (
              <option key={number.id} value={number.numberId}>
                {number.phoneNumber} · {number.businessAccountId}
              </option>
            ))}
          </select>
        </label>
        {internal && (
          <Button variant="outline" size="sm" onClick={() => setShowEmbed((old) => !old)}>
            <CodeXmlIcon className="size-4" />
            <span className="hidden sm:inline">Embed</span>
          </Button>
        )}
      </header>
      {(error || socketError) && (
        <div
          role="alert"
          className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900"
        >
          <TriangleAlertIcon className="size-4 shrink-0" />
          {error || socketError}
          <button className="ml-auto underline" onClick={() => setRevision((n) => n + 1)}>
            Refresh
          </button>
        </div>
      )}
      {showEmbed && (
        <EmbedInstructions tenantId={session.tenantId} onClose={() => setShowEmbed(false)} />
      )}
      <div className="flex min-h-0 flex-1">
        <aside
          className={`${selected ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-slate-200 md:w-72 lg:w-80`}
        >
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <SearchIcon className="absolute top-2.5 left-3 size-4 text-slate-400" />
              <Input
                aria-label="Search contacts"
                placeholder="Search name or phone"
                className="border-0 bg-slate-100 pl-9 shadow-none"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="mt-3 flex justify-between px-1 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
              <span>Contacts</span>
              <span>{senderNumber?.phoneNumber}</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" aria-label="Contacts">
            {!contacts.length && (
              <div className="p-8 text-center text-sm text-slate-400">
                {loading
                  ? 'Loading contacts…'
                  : numbers.length
                    ? 'No contacts found.'
                    : 'Link a WhatsApp number to open your inbox.'}
              </div>
            )}
            {contacts.map((contact) => (
              <button
                key={contact.id}
                className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-4 text-left transition-colors hover:bg-slate-50 ${selected?.id === contact.id ? 'border-l-[3px] border-l-emerald-600 bg-emerald-50/70 pl-[13px]' : ''}`}
                onClick={() => setSelected(contact)}
                aria-pressed={selected?.id === contact.id}
              >
                <Avatar name={contact.name || contact.phone} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold">
                      {contact.name || contact.phone}
                    </span>
                    {contact.lastMessage && (
                      <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                        {time(contact.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    {contact.lastMessage?.direction === 'OUTBOUND' && (
                      <MessageTicks status={contact.lastMessage.status} />
                    )}
                    <span className="truncate">{chatMessagePreview(contact.lastMessage)}</span>
                  </div>
                  {contact.isBlocked && <span className="text-[10px] text-red-500">Blocked</span>}
                </div>
              </button>
            ))}
          </div>
          {(page > 1 || hasMore) && (
            <div className="flex items-center justify-between border-t p-2 text-xs">
              <Button
                size="sm"
                variant="ghost"
                disabled={page === 1 || loading}
                onClick={() => setPage((n) => n - 1)}
              >
                Previous
              </Button>
              <span>Page {page}</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={!hasMore || loading}
                onClick={() => setPage((n) => n + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </aside>
        {selected && numberId ? (
          <Conversation
            key={`${numberId}:${selected.id}`}
            session={session}
            contact={selected}
            numberId={numberId}
            live={live}
            revision={chatRevision}
            send={send}
            onBack={() => setSelected(null)}
            onUpdate={() => refresh(selected.id)}
          />
        ) : (
          <main className="hidden flex-1 flex-col items-center justify-center bg-[#f7f9f8] px-8 text-center md:flex">
            <div className="mb-5 flex size-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
              <MessageCircleIcon className="size-10 stroke-[1.3]" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">
              Your conversations, in one place
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
              Choose a contact to view messages and reply from your linked WhatsApp number.
            </p>
            <p className="mt-8 text-xs text-slate-400">
              Messages and delivery receipts update live.
            </p>
          </main>
        )}
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
      {initials(name.replace(/^\+?\d+$/, 'Contact'))}
    </div>
  );
}
function MessageTicks({ status, sendState }: { status: string; sendState?: string | null }) {
  if (sendState === 'REVIEW')
    return (
      <span title="Delivery unconfirmed">
        <TriangleAlertIcon className="size-3.5 text-amber-600" />
      </span>
    );
  if (status === 'READ')
    return (
      <span title="Read" aria-label="Read">
        <CheckCheckIcon className="size-4 text-sky-500" />
      </span>
    );
  if (status === 'DELIVERED')
    return (
      <span title="Delivered" aria-label="Delivered">
        <CheckCheckIcon className="size-4 text-slate-500" />
      </span>
    );
  if (status === 'SENT')
    return (
      <span title="Sent" aria-label="Sent">
        <CheckIcon className="size-4 text-slate-500" />
      </span>
    );
  if (status === 'FAILED')
    return (
      <span title="Failed" aria-label="Failed">
        <TriangleAlertIcon className="size-3.5 text-red-500" />
      </span>
    );
  return (
    <span title="Pending" aria-label="Pending">
      <Clock3Icon className="size-3 text-slate-400" />
    </span>
  );
}

function Conversation({
  session,
  contact,
  numberId,
  live,
  revision,
  send,
  onBack,
  onUpdate,
}: {
  session: ChatSession;
  contact: ChatContact;
  numberId: string;
  live: boolean;
  revision: number;
  send: Sender;
  onBack: () => void;
  onUpdate: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<Omit<ChatHistory, 'data'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [media, setMedia] = useState<TenantMedia | null>(null);
  const [gallery, setGallery] = useState(false);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const draftId = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const mounted = useRef(true);
  const messageRef = useRef(messages);
  messageRef.current = messages;
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  const merge = (incoming: ChatMessage[]) =>
    setMessages((old) =>
      Array.from(new Map([...old, ...incoming].map((m) => [m.id, m])).values()).sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      ),
    );
  useEffect(() => {
    const abort = new AbortController();
    chatRequest<ChatHistory>(
      session.token,
      `/contacts/${contact.id}/messages?numberId=${encodeURIComponent(numberId)}`,
      { signal: abort.signal },
    )
      .then((data) => {
        const missedPage =
          messageRef.current.length > 0 &&
          data.data.length === 50 &&
          !data.data.some((row) => messageRef.current.some((old) => old.id === row.id));
        if (missedPage) {
          // A reconnect may span more than one page of new messages. Reset the
          // cursor to the newest page so earlier messages remain reachable.
          setMessages(data.data);
          setHistory(data);
        } else {
          merge(data.data);
          setHistory((old) => ({ ...data, nextCursor: old ? old.nextCursor : data.nextCursor }));
        }
        setError('');
      })
      .catch((err) => {
        if (!abort.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [session.token, contact.id, numberId, revision]);
  useEffect(() => {
    if (nearBottom.current) bottom.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
  }, [messages]);
  async function loadOlder() {
    if (!history?.nextCursor) return;
    setOlder(true);
    const height = viewport.current?.scrollHeight ?? 0;
    try {
      const data = await chatRequest<ChatHistory>(
        session.token,
        `/contacts/${contact.id}/messages?${new URLSearchParams({ numberId, before: history.nextCursor })}`,
      );
      if (!mounted.current) return;
      merge(data.data);
      setHistory(data);
      requestAnimationFrame(() => {
        if (viewport.current) viewport.current.scrollTop += viewport.current.scrollHeight - height;
      });
    } catch (err) {
      if (mounted.current) setError((err as Error).message);
    } finally {
      if (mounted.current) setOlder(false);
    }
  }
  const canReply =
    !!history?.windowEndsAt && new Date(history.windowEndsAt).getTime() > now && !history.isBlocked;
  async function submit() {
    if (sending || !live || !canReply || (!text.trim() && !media)) return;
    const id = draftId.current ?? chatRequestId();
    draftId.current = id;
    setSending(true);
    setError('');
    nearBottom.current = true;
    try {
      const data = await send({
        requestId: id,
        contactId: contact.id,
        text: text.trim(),
        ...(media ? { mediaSlug: media.slug } : {}),
      });
      if (mounted.current) {
        merge([{ ...data, attachments: [] }]);
        setText('');
        setMedia(null);
        draftId.current = null;
        onUpdate();
      }
    } catch (err) {
      if (mounted.current) {
        setError((err as Error).message);
        onUpdate();
      }
    } finally {
      if (mounted.current) setSending(false);
    }
  }
  let previousDay = '';
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#f1f4f0]">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3">
        <button onClick={onBack} aria-label="Back to contacts" className="md:hidden">
          <ArrowLeftIcon className="size-5" />
        </button>
        <Avatar name={contact.name || contact.phone} />
        <div>
          <h2 className="text-sm font-semibold">{contact.name || contact.phone}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {contact.whatsappPhoneNumber || contact.phone}
          </p>
        </div>
        <span className="ml-auto hidden rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500 sm:inline">
          WhatsApp
        </span>
      </header>
      <div
        ref={viewport}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8"
        onScroll={() => {
          const el = viewport.current;
          if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        }}
        role="log"
        aria-label={`Messages with ${contact.name || contact.phone}`}
        aria-live="polite"
      >
        {history?.nextCursor && (
          <div className="mb-4 text-center">
            <Button size="sm" variant="outline" disabled={older} onClick={() => void loadOlder()}>
              {older ? 'Loading…' : 'Load earlier messages'}
            </Button>
          </div>
        )}
        {loading && (
          <div className="flex justify-center py-8">
            <LoaderCircleIcon className="size-5 animate-spin text-emerald-700" />
          </div>
        )}
        {!loading && !messages.length && (
          <p className="mx-auto mt-12 max-w-xs text-center text-sm text-slate-500">
            No messages with this contact from the selected number yet.
          </p>
        )}
        {messages.map((message) => {
          const date = new Date(message.createdAt).toLocaleDateString([], {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          const dayLabel = date !== previousDay;
          previousDay = date;
          const outgoing = message.direction === 'OUTBOUND';
          return (
            <div key={message.id}>
              {dayLabel && (
                <div className="my-5 flex justify-center">
                  <span className="rounded-lg border border-slate-200/70 bg-white/80 px-3 py-1 text-[10px] font-medium text-slate-500 shadow-sm">
                    {date}
                  </span>
                </div>
              )}
              <div className={`mb-2 flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-xl px-3 py-2 shadow-sm sm:max-w-[75%] ${outgoing ? 'rounded-tr-sm bg-[#d9f8c6]' : 'rounded-tl-sm bg-white'}`}
                >
                  {message.attachments?.map((attachment) => (
                    <Attachment
                      key={attachment.id}
                      attachment={attachment}
                      session={session}
                      numberId={numberId}
                    />
                  ))}
                  <p className="text-sm leading-relaxed [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                    {chatMessagePreview(message)}
                  </p>
                  <div className="mt-1 flex items-center justify-end gap-1.5">
                    <span className="text-[10px] text-slate-500">{time(message.createdAt)}</span>
                    {outgoing && (
                      <MessageTicks status={message.status} sendState={message.sendState} />
                    )}
                  </div>
                  {message.status === 'FAILED' && (
                    <p className="mt-1 max-w-72 text-[11px] text-red-700">
                      {message.errorMessage || 'WhatsApp could not deliver this message.'}
                    </p>
                  )}
                  {message.sendState === 'REVIEW' && (
                    <p className="mt-1 max-w-72 text-[11px] text-amber-800">
                      Delivery unconfirmed. Wait for a receipt before sending again.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {error && (
        <div role="alert" className="shrink-0 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
          <button className="ml-2 underline" onClick={onUpdate}>
            Refresh history
          </button>
        </div>
      )}
      {!loading && !canReply && (
        <div className="shrink-0 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-900">
          {history?.isBlocked
            ? 'This contact is blocked.'
            : 'The 24-hour reply window is closed. Send an approved template from a campaign, then wait for the contact to reply.'}
        </div>
      )}
      {gallery && (
        <MediaGallery
          session={session}
          onSelect={(file) => {
            setMedia(file);
            draftId.current = null;
            setGallery(false);
          }}
          onClose={() => setGallery(false)}
        />
      )}
      <form
        className="shrink-0 border-t border-slate-200 bg-white p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {media && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <PaperclipIcon className="size-3.5 text-emerald-600" />
            <span className="truncate">{media.name}</span>
            <button
              type="button"
              disabled={sending}
              className="ml-auto"
              aria-label="Remove attachment"
              onClick={() => {
                setMedia(null);
                draftId.current = null;
              }}
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Attach from media gallery"
            disabled={sending}
            onClick={() => setGallery(!gallery)}
          >
            <PaperclipIcon className="size-5 text-slate-500" />
          </Button>
          <textarea
            aria-label="Message"
            placeholder={canReply ? 'Type a message…' : 'Waiting for a reply from this contact…'}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border-0 bg-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            rows={1}
            value={text}
            maxLength={media ? 1024 : 4096}
            disabled={!canReply || sending}
            onChange={(event) => {
              setText(event.target.value);
              draftId.current = null;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={!canReply || !live || sending || (!text.trim() && !media)}
            aria-label="Send WhatsApp message"
          >
            {sending ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-400">
          {sending ? 'Sending to WhatsApp…' : 'Enter to send · Shift + Enter for a new line'}
        </p>
      </form>
    </main>
  );
}

function Attachment({
  attachment,
  session,
  numberId,
}: {
  attachment: ChatAttachment;
  session: ChatSession;
  numberId: string;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let objectUrl = '';
    chatAttachmentBlob(session.token, numberId, attachment.id, abort.signal)
      .then((blob) => {
        if (!abort.signal.aborted) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
          setError(false);
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session.token, numberId, attachment.id, retry]);
  if (error)
    return (
      <button
        className="mb-2 text-xs text-red-700 underline"
        onClick={() => setRetry((n) => n + 1)}
      >
        Reload attachment
      </button>
    );
  if (!url) return <p className="mb-2 text-xs text-slate-500">Loading attachment…</p>;
  const mime = attachment.mimeType ?? '';
  return (
    <div className="mb-2">
      {mime.startsWith('image/') ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Image
            src={url}
            alt={attachment.fileName || 'WhatsApp image'}
            width={320}
            height={240}
            className="max-h-72 w-auto max-w-full rounded-lg object-contain"
            unoptimized
          />
        </a>
      ) : mime.startsWith('audio/') ? (
        <audio controls src={url} className="max-w-full" />
      ) : mime.startsWith('video/') ? (
        <video controls src={url} className="max-h-72 max-w-full rounded-lg" />
      ) : null}
      <a
        className="mt-1 flex items-center gap-2 text-xs font-medium text-emerald-800 underline"
        href={url}
        download={attachment.fileName || 'attachment'}
      >
        <FileTextIcon className="size-4" />
        {attachment.fileName || 'Download attachment'}
      </a>
    </div>
  );
}

function MediaGallery({
  session,
  onSelect,
  onClose,
}: {
  session: ChatSession;
  onSelect: (file: TenantMedia) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<TenantMedia[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    chatRequest<{ data: TenantMedia[] }>(session.token, '/media', { signal: abort.signal })
      .then(({ data }) => {
        setFiles(data);
        setError('');
      })
      .catch((err) => {
        if (!abort.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [session.token, revision]);
  async function upload(file: File) {
    setBusy(true);
    setError('');
    try {
      await uploadChatMedia(session.token, file, fileMime(file));
      setRevision((n) => n + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="flex max-h-64 shrink-0 flex-col border-t border-slate-200 bg-white p-3"
      aria-label="Media gallery"
    >
      <div className="mb-2 flex items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold">Media gallery</h3>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
          <UploadIcon className="size-3.5" />
          {busy ? 'Uploading…' : 'Upload'}
          <input
            type="file"
            className="sr-only"
            accept={MEDIA_ACCEPT}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }}
          />
        </label>
        <button aria-label="Close media gallery" onClick={onClose}>
          <XIcon className="size-4" />
        </button>
      </div>
      <Input
        aria-label="Search media gallery"
        placeholder="Search your uploaded files"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mb-2"
      />
      {error && (
        <p role="alert" className="mb-2 text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="grid min-h-0 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {files
          .filter((file) =>
            `${file.name} ${file.originalName}`.toLowerCase().includes(query.toLowerCase()),
          )
          .map((file) => {
            const compatible =
              file.mimeType === 'application/pdf' ||
              (['image/jpeg', 'image/png'].includes(file.mimeType) && file.size <= 5 * 1024 * 1024);
            return (
              <button
                key={file.slug}
                type="button"
                disabled={!compatible || busy}
                className="flex items-center gap-2 rounded-lg border p-2 text-left hover:border-emerald-500 disabled:opacity-40"
                onClick={() => onSelect(file)}
              >
                <FileTextIcon className="size-5 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{file.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {compatible
                      ? `${(file.size / 1024 / 1024).toFixed(1)} MB · ${file.mimeType === 'application/pdf' ? 'PDF' : 'Image'}`
                      : 'WhatsApp requires JPG/PNG up to 5 MB, or PDF'}
                  </p>
                </div>
              </button>
            );
          })}
      </div>
      {!files.length && (
        <p className="p-3 text-center text-xs text-slate-400">
          {loading ? 'Loading gallery…' : 'No media yet. Upload an image or PDF to share it.'}
        </p>
      )}
    </section>
  );
}

function EmbedInstructions({ tenantId, onClose }: { tenantId: number; onClose: () => void }) {
  const [origin, setOrigin] = useState('https://your-company.lightning.force.com');
  const [baseUrl, setBaseUrl] = useState('');
  useEffect(() => setBaseUrl(window.location.origin), []);
  const src = `${baseUrl}/embed/chat?tenantId=${tenantId}&parentOrigin=${encodeURIComponent(origin)}`;
  const snippet = `<iframe id="whatsapp-chat" title="WhatsApp chat" src="${src.replace(/&/g, '&amp;')}" style="width:100%;height:720px;border:0" referrerpolicy="no-referrer"></iframe>\n<script>\nconst frame = document.getElementById('whatsapp-chat');\nwindow.addEventListener('message', async (event) => {\n  if (event.origin !== ${JSON.stringify(baseUrl)} || event.source !== frame.contentWindow || event.data?.type !== 'avbot:chat:ready') return;\n  const response = await fetch('/api/whatsapp-chat-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: ${tenantId} }) });\n  if (!response.ok) return;\n  const { token } = await response.json();\n  frame.contentWindow.postMessage({ type: 'avbot:chat:session', tenantId: ${tenantId}, token }, ${JSON.stringify(baseUrl)});\n});\n</script>`;
  return (
    <section className="max-h-80 shrink-0 overflow-y-auto border-b bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Embed this inbox</h2>
        <button aria-label="Close embed instructions" onClick={onClose}>
          <XIcon className="size-4" />
        </button>
      </div>
      <label className="mt-2 block text-xs text-slate-500">
        Parent application origin
        <Input
          className="mt-1 bg-white"
          value={origin}
          onChange={(event) => setOrigin(event.target.value)}
        />
      </label>
      <p className="my-2 text-xs leading-5 text-slate-500">
        Your host backend must authenticate the user, then call POST /chat/sessions with this
        tenant’s bearer token and parentOrigin. Return the short-lived token from
        /api/whatsapp-chat-session. Keep the tenant bearer token on your server. Salesforce can use
        an Apex controller for the same exchange.
      </p>
      <textarea
        aria-label="Iframe integration example"
        className="h-32 w-full rounded-lg border bg-white p-3 font-mono text-[11px]"
        value={snippet}
        readOnly
      />
      <Button
        className="mt-2"
        variant="outline"
        size="sm"
        onClick={() => void navigator.clipboard.writeText(snippet)}
      >
        Copy example
      </Button>
    </section>
  );
}
