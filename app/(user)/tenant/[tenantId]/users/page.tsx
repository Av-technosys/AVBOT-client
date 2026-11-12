'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { canManageTenant, useConsoleUser } from '@/components/console-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  inviteTenantUser,
  listTenantUsers,
  revokeTenantInvitation,
  updateTenantUserRole,
  type InvitationRole,
  type TenantRole,
} from '@/lib/tenant-users-api';

type UserDirectory = Awaited<ReturnType<typeof listTenantUsers>>['data'];
type Member = UserDirectory['members'][number];

export default function TenantUsersPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const user = useConsoleUser();
  if (!canManageTenant(user)) return <p role="alert">Tenant administrator access is required.</p>;
  return (
    <UserDirectoryView
      key={tenantId}
      tenantId={tenantId}
      canInviteAdmins={user.isAdmin || user.role === 'OWNER'}
    />
  );
}

function UserDirectoryView({
  tenantId,
  canInviteAdmins,
}: {
  tenantId: string;
  canInviteAdmins: boolean;
}) {
  const [directory, setDirectory] = useState<UserDirectory | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void listTenantUsers(tenantId, controller.signal)
      .then(({ data }) => {
        if (!controller.signal.aborted) setDirectory(data);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(error instanceof Error ? error.message : 'Could not load users.');
      });
    return () => controller.abort();
  }, [tenantId, reload]);

  function invitationLink(id: string) {
    const url = new URL('/tenant', window.location.origin);
    url.searchParams.set('invitation', id);
    return url.href;
  }

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy('invite');
    try {
      const { data } = await inviteTenantUser(
        tenantId,
        String(fields.get('email')),
        fields.get('role') as InvitationRole,
      );
      setDirectory(
        (current) => current && { ...current, invitations: [...current.invitations, data] },
      );
      setShareLink(invitationLink(data.id));
      form.reset();
      toast.success('Invitation created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the invitation.');
    } finally {
      setBusy(null);
    }
  }

  async function copyInvite(id: string) {
    const url = invitationLink(id);
    setShareLink(url);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invitation link copied');
    } catch {
      toast.info('Copy the link from the invitation link field.');
    }
  }

  async function revokeInvite(id: string) {
    setBusy(id);
    try {
      await revokeTenantInvitation(tenantId, id);
      setDirectory(
        (current) =>
          current && {
            ...current,
            invitations: current.invitations.filter((invite) => invite.id !== id),
          },
      );
      setShareLink((link) => (link === invitationLink(id) ? '' : link));
      toast.success('Invitation revoked');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not revoke the invitation.');
    } finally {
      setBusy(null);
    }
  }

  async function saveRole(memberId: string, role: TenantRole) {
    setBusy(memberId);
    try {
      const { data } = await updateTenantUserRole(tenantId, memberId, role);
      setDirectory(
        (current) =>
          current && {
            ...current,
            members: current.members.map((member) =>
              member.id === memberId ? { ...member, ...data } : member,
            ),
          },
      );
      toast.success('Role updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the role.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      {loadError && (
        <div role="alert" className="space-y-2">
          <p className="text-destructive text-sm">{loadError}</p>
          <Button
            variant="outline"
            onClick={() => {
              setLoadError('');
              setReload((value) => value + 1);
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {!directory && !loadError && (
        <p role="status" className="text-muted-foreground text-sm">
          Loading users…
        </p>
      )}
      {directory && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Invite a user</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                onSubmit={sendInvite}
                className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
              >
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input id="invite-email" name="email" type="email" required maxLength={255} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <select
                    id="invite-role"
                    name="role"
                    defaultValue="AGENT"
                    className="bg-background border-input h-9 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="AGENT">Agent</option>
                    <option value="VIEWER">Viewer</option>
                    <option value="MANAGER">Manager</option>
                    {canInviteAdmins && <option value="ADMIN">Admin</option>}
                  </select>
                </div>
                <Button type="submit" disabled={busy !== null}>
                  {busy === 'invite' ? 'Creating…' : 'Create invitation'}
                </Button>
              </form>
              {shareLink && (
                <div className="space-y-2">
                  <Label htmlFor="invitation-link">Invitation link</Label>
                  <Input
                    id="invitation-link"
                    readOnly
                    value={shareLink}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <p className="text-muted-foreground text-sm">
                    Share this link with the recipient. They must sign in with the invited email
                    address.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pending invitations</CardTitle>
            </CardHeader>
            <CardContent>
              {directory.invitations.length === 0 && (
                <p className="text-muted-foreground text-sm">No pending invitations.</p>
              )}
              <ul className="divide-y">
                {directory.invitations.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium break-all">{invite.email}</p>
                      <p className="text-muted-foreground text-sm">
                        <span className="capitalize">{invite.role.toLowerCase()}</span> · Expires{' '}
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void copyInvite(invite.id)}
                      >
                        Copy link
                      </Button>
                      {(canInviteAdmins || invite.role !== 'ADMIN') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy !== null}
                          onClick={() => void revokeInvite(invite.id)}
                        >
                          {busy === invite.id ? 'Revoking…' : 'Revoke'}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
            </CardHeader>
            <CardContent>
              {directory.members.length === 0 && (
                <p className="text-muted-foreground text-sm">No members yet.</p>
              )}
              <ul className="divide-y">
                {directory.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium break-words">{member.name}</p>
                      <p className="text-muted-foreground text-sm break-all">{member.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-muted-foreground text-sm">
                        {member.isActive ? (member.isLinked ? 'Active' : 'Unlinked') : 'Inactive'}
                      </p>
                      {member.editableRoles?.length ? (
                        <MemberRoleEditor
                          key={member.role}
                          member={member}
                          disabled={busy !== null}
                          saving={busy === member.id}
                          onSave={(role) => void saveRole(member.id, role)}
                        />
                      ) : (
                        <p className="text-muted-foreground text-sm capitalize">
                          {member.role.toLowerCase()}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MemberRoleEditor({
  member,
  disabled,
  saving,
  onSave,
}: {
  member: Member;
  disabled: boolean;
  saving: boolean;
  onSave: (role: TenantRole) => void;
}) {
  const [role, setRole] = useState(member.role);

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (role !== member.role) onSave(role);
      }}
    >
      <select
        aria-label={`Role for ${member.name}`}
        value={role}
        disabled={disabled}
        onChange={(event) => setRole(event.target.value as TenantRole)}
        className="bg-background border-input h-8 rounded-md border px-2 text-sm capitalize"
      >
        {member.editableRoles.map((choice) => (
          <option key={choice} value={choice}>
            {choice.toLowerCase()}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={disabled || role === member.role}>
        {saving ? 'Saving…' : 'Save role'}
      </Button>
    </form>
  );
}
