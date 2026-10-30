'use client';

import { useId } from 'react';
import { Label } from '@/components/ui/label';

export function ImportMarketingPreference({
  value,
  onChange,
  disabled = false,
}: {
  value: boolean;
  onChange: (optedIn: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Marketing opt-in for imported contacts</Label>
      <select
        id={id}
        value={String(value)}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === 'true')}
        aria-describedby={`${id}-help`}
        className="bg-background w-full rounded-lg border p-2 text-sm sm:max-w-sm"
      >
        <option value="false">Not opted in to marketing</option>
        <option value="true">Opted in to marketing</option>
      </select>
      <p id={`${id}-help`} className="text-muted-foreground text-xs">
        Applies to all new contacts in this import. Existing contacts keep their marketing
        preference.
      </p>
    </div>
  );
}
