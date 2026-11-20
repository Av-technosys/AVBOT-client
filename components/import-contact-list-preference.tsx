'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type ImportContactListPreference = {
  enabled: boolean;
  name: string;
  includeExistingContacts: boolean;
};

export const emptyImportContactList: ImportContactListPreference = {
  enabled: false,
  name: '',
  includeExistingContacts: false,
};

export function validImportContactList(value: ImportContactListPreference) {
  return !value.enabled || (value.name.trim().length > 0 && value.name.trim().length <= 120);
}

export function importContactListOptions(value: ImportContactListPreference) {
  return value.enabled
    ? { newListName: value.name.trim(), includeExistingContacts: value.includeExistingContacts }
    : {};
}

export function ImportContactListPreference({
  value,
  onChange,
  disabled = false,
}: {
  value: ImportContactListPreference;
  onChange: (value: ImportContactListPreference) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <Label htmlFor={`${id}-enabled`} className="flex items-center gap-2">
        <input
          id={`${id}-enabled`}
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
        />
        Add contacts to a new list
      </Label>
      {value.enabled && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>New list name</Label>
            <Input
              id={`${id}-name`}
              value={value.name}
              required
              maxLength={120}
              placeholder="e.g. November contacts"
              onChange={(event) => onChange({ ...value, name: event.target.value })}
              aria-describedby={`${id}-help`}
            />
            <p id={`${id}-help`} className="text-muted-foreground text-xs">
              Use a unique name of 1–120 characters. New contacts in this import will be added.
            </p>
          </div>
          <Label htmlFor={`${id}-existing`} className="flex items-center gap-2">
            <input
              id={`${id}-existing`}
              type="checkbox"
              checked={value.includeExistingContacts}
              onChange={(event) =>
                onChange({ ...value, includeExistingContacts: event.target.checked })
              }
            />
            Include contacts that already exist
          </Label>
          <p className="text-muted-foreground text-xs">
            Existing contacts keep their details and marketing preference.
          </p>
        </div>
      )}
    </fieldset>
  );
}
