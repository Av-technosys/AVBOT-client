import type { ReactNode } from 'react';
import { ConsoleClerkProvider } from '@/components/console-clerk-provider';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ConsoleClerkProvider>
      <main className="grid min-h-screen place-items-center p-6">{children}</main>
    </ConsoleClerkProvider>
  );
}
