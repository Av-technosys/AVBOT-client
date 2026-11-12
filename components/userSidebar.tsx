'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useConsoleUser } from '@/components/console-session';
import { TenantSidebar } from '@/components/tenant-sidebar';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { SettingsIcon, UsersIcon } from 'lucide-react';

const userNavItems = [
  {
    title: 'Tenants',
    href: '/tenant',
    icon: UsersIcon,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: SettingsIcon,
  },
];

export function UserSidebar() {
  const { tenantId } = useParams();
  return typeof tenantId === 'string' ? <TenantSidebar tenantId={tenantId} /> : <MainSidebar />;
}

function MainSidebar() {
  const pathname = usePathname();
  const user = useConsoleUser();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="WhatsappBot AI">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
                WB
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">WhatsappBot AI</span>
                <span className="text-sidebar-foreground/70 truncate text-xs">User Console</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={
                      <Link
                        href={user.isAdmin && item.href === '/tenant' ? '/admin' : item.href}
                        onNavigate={() => setOpenMobile(false)}
                      />
                    }
                    tooltip={item.title}
                    isActive={
                      pathname === item.href || (pathname === '/admin' && item.href === '/tenant')
                    }
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
