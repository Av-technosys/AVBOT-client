'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ContactPicker,
  contactSelectionCount,
  emptyContactSelection,
} from '@/components/contact-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ContactSelection } from '@/lib/api';
import {
  createContactList,
  deleteContactList,
  getContactListMembers,
  getContactLists,
  renameContactList,
  searchContacts,
  updateContactListMembers,
  type ContactFilters,
  type ContactList,
  type ContactPickerPage,
} from '@/lib/contact-lists-api';

export type ContactListsMode = 'create' | 'manage' | 'add';
const titles = { create: 'Create list', manage: 'Manage lists', add: 'Add to list' };
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Could not update contact lists';

export function ContactListsDialog({
  tenant,
  mode,
  selected,
  selectedFilters,
  selectedCount,
  onClose,
  onAdded,
}: {
  tenant: string;
  mode: ContactListsMode;
  selected: ContactSelection;
  selectedFilters?: ContactFilters;
  selectedCount: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const nameId = useId();
  const addId = useId();
  const [listId, setListId] = useState('');
  const [memberList, setMemberList] = useState<ContactList | null>(null);
  const [renaming, setRenaming] = useState<ContactList | null>(null);
  const [name, setName] = useState('');
  const [lists, setLists] = useState<ContactList[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState<ContactFilters>({ searchField: 'name' });
  const [selection, setSelection] = useState<ContactSelection>(emptyContactSelection);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<ContactPickerPage | null>(null);
  const [searchError, setSearchError] = useState('');
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    if (mode === 'create') return;
    const controller = new AbortController();
    getContactLists(tenant, controller.signal)
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setLists(data);
        setListError('');
      })
      .catch((error) => {
        if (!controller.signal.aborted) setListError(errorMessage(error));
      });
    return () => controller.abort();
  }, [tenant, mode, revision]);

  const memberListId = memberList?.id;
  useEffect(() => {
    if (mode !== 'create' && !memberListId) return;
    const controller = new AbortController();
    const request = memberListId
      ? getContactListMembers(tenant, memberListId, page, controller.signal)
      : searchContacts(tenant, page, filters, controller.signal);
    request
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
        if (page > lastPage) setPage(lastPage);
        else setResults(data);
        setSearchError('');
      })
      .catch((error) => {
        if (!controller.signal.aborted) setSearchError(errorMessage(error));
      });
    return () => controller.abort();
  }, [mode, memberListId, tenant, page, filters, revision]);

  function clearPicker() {
    setResults(null);
    setSearchError('');
    setPage(1);
    setSelection(emptyContactSelection);
  }

  function changePage(value: number) {
    setResults(null);
    setSearchError('');
    setPage(value);
  }

  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const count = contactSelectionCount(selection, results?.total ?? 0);
  const creating = mode === 'create';
  const memberPicker = creating || !!memberList;
  const selectionReady = !!results && !searchError;
  const canCreate =
    name.trim() &&
    ((selection.mode === 'selected' && !selection.ids.length) || (selectionReady && count > 0));

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="bg-background text-foreground m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl border shadow-xl backdrop:bg-black/50"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="space-y-4 p-5">
        <header className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {memberList?.name ?? titles[mode]}
          </h2>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </header>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <fieldset disabled={busy} className="space-y-4">
          {(creating || renaming) && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (creating && !canCreate) return;
                void perform(async () => {
                  if (renaming) {
                    await renameContactList(tenant, renaming.id, name);
                    setRenaming(null);
                    setRevision((value) => value + 1);
                    toast.success('List renamed');
                  } else {
                    const { data } = await createContactList(
                      tenant,
                      name,
                      count ? { selection, filters } : undefined,
                    );
                    toast.success(`List created with ${data.memberCount} contacts`);
                    onClose();
                  }
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor={nameId}>List name</Label>
                <Input
                  id={nameId}
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              {creating && (
                <ContactPicker
                  results={results}
                  page={page}
                  onPageChange={changePage}
                  search={{
                    filters,
                    onChange: (value) => {
                      setFilters(value);
                      clearPicker();
                    },
                  }}
                  selection={selection}
                  onSelectionChange={setSelection}
                  error={searchError}
                  showModes
                />
              )}
              <div className="flex justify-end gap-2">
                {renaming && (
                  <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
                    Back
                  </Button>
                )}
                <Button type="submit" disabled={creating ? !canCreate : !name.trim()}>
                  {creating ? 'Create list' : 'Save name'}
                </Button>
              </div>
            </form>
          )}
          {mode === 'add' && (
            <div className="space-y-3">
              <Label htmlFor={addId}>
                List for {selectedCount.toLocaleString('en-IN')} selected contacts
              </Label>
              <select
                id={addId}
                value={listId}
                onChange={(event) => setListId(event.target.value)}
                className="bg-background w-full rounded-md border p-2 text-sm"
              >
                <option value="">Choose a list</option>
                {lists?.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              {lists?.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Create a list on the Contacts page first.
                </p>
              )}
              <Button
                type="button"
                disabled={!listId || !lists?.some((list) => list.id === listId)}
                onClick={() => {
                  void perform(async () => {
                    const { data } = await updateContactListMembers(tenant, listId, 'PUT', {
                      selection: selected,
                      filters: selectedFilters,
                    });
                    toast.success(`${data.changed} contacts added to the list`);
                    onAdded();
                    onClose();
                  });
                }}
              >
                Add selected contacts
              </Button>
            </div>
          )}
          {mode === 'manage' && !memberList && !renaming && (
            <ul className="divide-y rounded-md border">
              {lists?.map((list) => (
                <li key={list.id} className="flex flex-wrap items-center gap-2 p-3">
                  <span className="min-w-32 flex-1 text-sm font-medium">
                    {list.name}{' '}
                    <span className="text-muted-foreground font-normal">
                      · {list.memberCount} contacts
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      clearPicker();
                      setError('');
                      setMemberList(list);
                    }}
                  >
                    View members
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setError('');
                      setName(list.name);
                      setRenaming(list);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete list “${list.name}”? Its contacts will stay in Contacts.`,
                        )
                      )
                        return;
                      void perform(async () => {
                        await deleteContactList(tenant, list.id);
                        setRevision((value) => value + 1);
                        toast.success('List deleted');
                      });
                    }}
                  >
                    Delete
                  </Button>
                </li>
              ))}
              {!lists && !listError && <li className="p-3 text-sm">Loading lists…</li>}
              {lists?.length === 0 && (
                <li className="text-muted-foreground p-3 text-sm">No contact lists yet.</li>
              )}
            </ul>
          )}
          {mode === 'manage' && memberList && (
            <>
              <ContactPicker
                results={results}
                page={page}
                onPageChange={changePage}
                selection={selection}
                onSelectionChange={setSelection}
                error={searchError}
                showModes
              />
              <div className="flex justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMemberList(null);
                    setError('');
                  }}
                >
                  Back to lists
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!selectionReady || !count}
                  onClick={() => {
                    if (!window.confirm(`Remove ${count} contacts from “${memberList.name}”?`))
                      return;
                    void perform(async () => {
                      const { data } = await updateContactListMembers(
                        tenant,
                        memberList.id,
                        'DELETE',
                        { selection },
                      );
                      clearPicker();
                      setRevision((value) => value + 1);
                      toast.success(`${data.changed} contacts removed from the list`);
                    });
                  }}
                >
                  Remove selected
                </Button>
              </div>
            </>
          )}
        </fieldset>
        {listError && !memberPicker && (
          <p role="alert" className="text-destructive text-sm">
            {listError}
          </p>
        )}
      </div>
    </dialog>
  );
}
