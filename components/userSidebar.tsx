'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { TenantSidebar } from '@/components/tenant-sidebar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { BarChart3Icon, LogOutIcon, SettingsIcon, UsersIcon } from 'lucide-react';

const userNavItems = [
  {
    title: 'Dashboard',
    href: '/',
    icon: BarChart3Icon,
  },
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
                    render={<Link href={item.href} onNavigate={() => setOpenMobile(false)} />}
                    tooltip={item.title}
                    isActive={pathname === item.href}
                    aria-current={pathname === item.href ? 'page' : undefined}
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
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              tooltip="Logout"
              type="button"
            >
              <LogOutIcon />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
