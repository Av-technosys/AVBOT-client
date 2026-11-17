'use client';

import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ContactSelection, SalesforceAccountSummary } from '@/lib/api';
import type { ContactFilters, ContactPickerPage } from '@/lib/contact-lists-api';
import { toast } from 'sonner';

export const emptyContactSelection: ContactSelection = { mode: 'selected', ids: [] };

const searchFields = [
  ['name', 'Name'],
  ['email', 'Email'],
  ['phone', 'Phone number'],
  ['city', 'City'],
  ['state', 'State'],
  ['location', 'Location / area'],
  ['country', 'Country'],
  ['all-fields', 'All fields'],
  ['all', 'Name, email or phone'],
] as const;

export function contactSelectionCount(selection: ContactSelection, total: number) {
  return selection.mode === 'selected'
    ? selection.ids.length
    : Math.max(0, total - selection.excludedIds.length);
}

type SearchFieldsProps = {
  filters: ContactFilters;
  onChange: (filters: ContactFilters) => void;
  salesforce?: SalesforceAccountSummary[];
};

export function ContactSearchFields({ filters, onChange, salesforce }: SearchFieldsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Input
        className="min-w-36 flex-1"
        aria-label="Search contacts"
        placeholder="Search contacts…"
        maxLength={255}
        value={filters.q ?? ''}
        onChange={(e) => onChange({ ...filters, q: e.target.value })}
      />
      <select
        className="bg-background rounded-md border px-3 py-2 text-sm"
        aria-label="Search field"
        value={filters.searchField || 'name'}
        onChange={(e) =>
          onChange({
            ...filters,
            searchField: e.target.value as ContactFilters['searchField'],
          })
        }
      >
        {searchFields.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {salesforce && (
        <select
          className="bg-background rounded-md border px-3 py-2 text-sm"
          aria-label="Salesforce account"
          value={filters.salesforceConnectId ?? ''}
          onChange={(e) => onChange({ ...filters, salesforceConnectId: e.target.value })}
        >
          <option value="">All Salesforce accounts</option>
          {salesforce.map((account) => (
            <option key={account.id} value={account.id}>
              {account.username}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

type PickerProps = {
  results: ContactPickerPage | null;
  page: number;
  onPageChange: (page: number) => void;
  search?: SearchFieldsProps;
  selection?: ContactSelection;
  onSelectionChange?: (selection: ContactSelection) => void;
  showModes?: boolean;
  error?: string;
};

export function ContactPicker({
  results,
  page,
  onPageChange,
  search,
  selection,
  onSelectionChange,
  showModes,
  error,
}: PickerProps) {
  const modeGroup = useId();
  function toggle(id: string) {
    if (!selection || !onSelectionChange) return;
    const ids = new Set(selection.mode === 'all' ? selection.excludedIds : selection.ids);
    if (ids.has(id)) ids.delete(id);
    else if (ids.size < 1000) ids.add(id);
    else {
      toast.error(
        'Choose up to 1,000 contacts or exclusions. Use Select all matching contacts for larger selections.',
      );
      return;
    }
    onSelectionChange(
      selection.mode === 'all'
        ? { mode: 'all', excludedIds: [...ids] }
        : { mode: 'selected', ids: [...ids] },
    );
  }

  return (
    <div className="space-y-3">
      {search && <ContactSearchFields {...search} />}
      {selection && onSelectionChange && showModes && (
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex gap-2">
            <input
              type="radio"
              name={modeGroup}
              checked={selection.mode === 'selected'}
              onChange={() => onSelectionChange(emptyContactSelection)}
            />
            Choose specific contacts
          </label>
          <label className="flex gap-2">
            <input
              type="radio"
              name={modeGroup}
              checked={selection.mode === 'all'}
              disabled={!results?.total}
              onChange={() => onSelectionChange({ mode: 'all', excludedIds: [] })}
            />
            Select all matching contacts
          </label>
        </div>
      )}
      {selection && (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {contactSelectionCount(selection, results?.total ?? 0).toLocaleString('en-IN')} selected
        </p>
      )}
      <div
        className="max-h-80 divide-y overflow-y-auto rounded-lg border"
        aria-busy={!results && !error}
      >
        {error ? (
          <p role="alert" className="text-destructive p-3 text-sm">
            {error}
          </p>
        ) : (
          <>
            {!results && <p className="p-3 text-sm">Loading contacts…</p>}
            {results?.rows.map((contact) => {
              const location = [contact.location, contact.city, contact.state, contact.country]
                .filter(Boolean)
                .join(', ');
              const details = (
                <>
                  <span className="flex-1">
                    {contact.name || 'Unnamed contact'}
                    <span className="text-muted-foreground block text-xs">
                      {contact.whatsappPhoneNumber || contact.phone} · {contact.source}
                    </span>
                    {contact.email && (
                      <span className="text-muted-foreground block text-xs">{contact.email}</span>
                    )}
                    {location && (
                      <span className="text-muted-foreground block text-xs">{location}</span>
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {contact.marketingOptIn ? 'Subscribed' : 'Opted out'}
                    {contact.isBlocked ? ' · Blocked' : ''}
                  </span>
                </>
              );
              const rowClass = 'flex items-center gap-3 p-3 text-sm';
              return selection && onSelectionChange ? (
                <label key={contact.id} className={rowClass}>
                  <input
                    type="checkbox"
                    checked={
                      selection.mode === 'all'
                        ? !selection.excludedIds.includes(contact.id)
                        : selection.ids.includes(contact.id)
                    }
                    onChange={() => toggle(contact.id)}
                  />
                  {details}
                </label>
              ) : (
                <div key={contact.id} className={rowClass}>
                  {details}
                </div>
              );
            })}
            {results?.rows.length === 0 && <p className="p-3 text-sm">No matching contacts.</p>}
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span>
          {results?.total ?? 0} contacts · Page {page} of{' '}
          {Math.max(1, Math.ceil((results?.total ?? 0) / 25))}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page * 25 >= (results?.total ?? 0)}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
