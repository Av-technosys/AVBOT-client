import { TenantChat } from '@/components/chat-panel';

export default async function ChatPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return <TenantChat tenant={tenantId} />;
}
