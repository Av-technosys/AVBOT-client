import type { ReactNode } from 'react';
import { UserButton } from '@clerk/nextjs';

import { ConsoleClerkProvider } from '@/components/console-clerk-provider';
import { ConsoleSession } from '@/components/console-session';
import { UserSidebar } from '@/components/userSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

export default function UserLayout({ children }: { children: ReactNode }) {
  return (
    <ConsoleClerkProvider>
      <ConsoleSession>
        <SidebarProvider>
          <UserSidebar />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
              <SidebarTrigger />
              <UserButton />
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </ConsoleSession>
    </ConsoleClerkProvider>
  );
}
