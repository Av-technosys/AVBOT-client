import { EmbeddedChat } from '@/components/chat-panel';

export default async function EmbedChatPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string; parentOrigin?: string }>;
}) {
  const { tenantId = '', parentOrigin = '' } = await searchParams;
  return (
    <EmbeddedChat
      key={`${tenantId}:${parentOrigin}`}
      tenantId={tenantId}
      parentOrigin={parentOrigin}
    />
  );
}
