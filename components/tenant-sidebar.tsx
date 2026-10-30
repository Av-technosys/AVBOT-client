'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftIcon,
  Building2Icon,
  ChevronDownIcon,
  MessageCircleIcon,
  PlugIcon,
  UsersIcon,
  WorkflowIcon,
} from 'lucide-react';
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

const tenantNavItems = [
  { title: 'Contacts', path: 'contacts', icon: UsersIcon },
  { title: 'Salesforce Account', path: 'salesforce-connect', icon: PlugIcon },
  { title: 'WhatsApp', path: 'whatsapp', icon: MessageCircleIcon },
  { title: 'Marketing Campaign Flow', path: 'campaigns', icon: WorkflowIcon },
];

function WhatsappMenu({ tenantPath, pathname }: { tenantPath: string; pathname: string }) {
  const accountPath = `${tenantPath}/whatsapp`;
  const templatesPath = `${accountPath}/templates`;
  const active = pathname === accountPath || pathname.startsWith(`${accountPath}/`);
  const templatesActive = pathname === templatesPath || pathname.startsWith(`${templatesPath}/`);
  const [expanded, setExpanded] = useState(active);
  const submenuId = useId();
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar();

  function toggle() {
    if (!isMobile && state === 'collapsed') {
      setOpen(true);
      setExpanded(true);
    } else {
      setExpanded((value) => !value);
    }
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        tooltip="WhatsApp"
        isActive={active}
        aria-expanded={expanded}
        aria-controls={submenuId}
        onClick={toggle}
      >
        <MessageCircleIcon />
        <span>WhatsApp</span>
        <ChevronDownIcon
          className={`ml-auto transition-transform group-data-[collapsible=icon]:hidden ${expanded ? 'rotate-180' : ''}`}
        />
      </SidebarMenuButton>
      <SidebarMenuSub id={submenuId} hidden={!expanded} className={expanded ? '' : 'hidden'}>
        {[
          {
            title: 'WhatsApp Account',
            href: accountPath,
            active: active && !templatesActive,
            description: 'Accounts and WhatsApp numbers',
          },
          {
            title: 'WhatsApp Templates',
            href: templatesPath,
            active: templatesActive,
            description: 'WhatsApp message templates',
          },
        ].map((item) => (
          <SidebarMenuSubItem key={item.href}>
            <SidebarMenuSubButton
              render={<Link href={item.href} onNavigate={() => setOpenMobile(false)} />}
              isActive={item.active}
              aria-current={item.active ? 'page' : undefined}
              title={item.description}
            >
              <span>{item.title}</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        ))}
      </SidebarMenuSub>
    </SidebarMenuItem>
  );
}

export function TenantSidebar({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const tenantPath = `/tenant/${encodeURIComponent(tenantId)}`;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href={tenantPath} onNavigate={() => setOpenMobile(false)} />}
              size="lg"
              tooltip="Tenant details"
              isActive={pathname === tenantPath}
              aria-current={pathname === tenantPath ? 'page' : undefined}
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
                <Building2Icon />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Tenant details</span>
                <span className="text-sidebar-foreground/70 truncate text-xs">{tenantId}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/tenant" onNavigate={() => setOpenMobile(false)} />}
              tooltip="Back to tenants"
            >
              <ArrowLeftIcon />
              <span>Back to tenants</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tenant menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tenantNavItems.map((item) => {
                const href = `${tenantPath}/${item.path}`;
                if (item.path === 'whatsapp') {
                  return (
                    <WhatsappMenu
                      key={`${href}:${pathname}`}
                      tenantPath={tenantPath}
                      pathname={pathname}
                    />
                  );
                }
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      render={<Link href={href} onNavigate={() => setOpenMobile(false)} />}
                      tooltip={item.title}
                      isActive={active}
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
