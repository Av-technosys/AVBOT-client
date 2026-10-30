'use client';

import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { PhoneIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  type ApiMappingType,
  type ConnectionRecord,
  type ConnectionRecordKind,
  listConnectionRecords,
  saveConnectionRecord,
  deleteConnectionRecord,
} from '@/lib/api';

const DEFAULT_MAPPINGS: Record<string, Record<string, string>> = {
  Account: { id: '', name: '', email: '', number: '', accountId: '' },
  Deals: { id: '', name: '', accountId: '' },
  ScheduleBooking: { id: '', dealId: '', subject: '', startDateTime: '' },
  WhatsAppMessage: {
    messageId: '',
    fromNumber: '',
    body: '',
    status: '',
    direction: '',
    timestamp: '',
  },
};
const FALLBACK_MAPPING: Record<string, string> = { id: '' };
function getDefaultMapping(type?: string) {
  return (type && DEFAULT_MAPPINGS[type]) ?? FALLBACK_MAPPING;
}
const MAPPING_TYPES = Object.keys(DEFAULT_MAPPINGS) as ApiMappingType[];

export function ConnectionRecords({
  tenantId,
  kind,
}: {
  tenantId: string;
  kind: ConnectionRecordKind;
}) {
  const mappings = kind.endsWith('/api-mappings');
  const [records, setRecords] = useState<ConnectionRecord[]>([]);
  const [editing, setEditing] = useState<ConnectionRecord | null>(null);
  const [mappingValues, setMappingValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    listConnectionRecords(tenantId, kind)
      .then(({ data }) => {
        if (active) {
          setRecords(data);
          setError('');
        }
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenantId, kind, reload]);

  function edit(record: ConnectionRecord) {
    setEditing({ ...record });
    // Only pull values for keys this type is supposed to have. Stray/old
    // keys from a previous save are dropped; missing keys default to "".
    const template = getDefaultMapping(record.apiMappingType);
    const saved = (record.fieldMapping ?? {}) as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const key of Object.keys(template)) {
      values[key] = typeof saved[key] === 'string' ? (saved[key] as string) : '';
    }
    setMappingValues(values);
    setError('');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setError('');
    const fieldMapping: Record<string, unknown> = mappings ? { ...mappingValues } : {};
    setBusy(true);
    try {
      const body = mappings
        ? { apiEndpoint: editing.apiEndpoint, apiMappingType: editing.apiMappingType, fieldMapping }
        : { numberId: editing.numberId, phoneNumber: editing.phoneNumber };
      const { data } = await saveConnectionRecord(tenantId, kind, body, editing.id || undefined);
      setRecords((previous) =>
        editing.id ? previous.map((row) => (row.id === data.id ? data : row)) : [...previous, data],
      );
      setEditing(null);
      toast.success(mappings ? 'API mapping saved' : 'WhatsApp number saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(record: ConnectionRecord) {
    if (!window.confirm(`Delete ${mappings ? 'this API mapping' : 'this WhatsApp number'}?`))
      return;
    setBusy(true);
    setError('');
    try {
      await deleteConnectionRecord(tenantId, kind, record.id);
      setRecords((previous) => previous.filter((row) => row.id !== record.id));
      if (editing?.id === record.id) setEditing(null);
      toast.success(mappings ? 'API mapping deleted' : 'WhatsApp number deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {!mappings && <PhoneIcon className="size-4" aria-hidden="true" />}
          {mappings ? 'API Mappings' : 'WhatsApp numbers'}
        </CardTitle>
        {!mappings && (
          <p className="text-muted-foreground text-sm">
            Add one or more business phone numbers to the selected account.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div role="alert" className="text-destructive text-sm">
            {error}{' '}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setReload((value) => value + 1)}
            >
              Reload
            </Button>
          </div>
        )}
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {records.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No {mappings ? 'API mappings' : 'WhatsApp numbers'} added.
              </p>
            )}
            {records.map((record) => (
              <div key={record.id} className="space-y-2 rounded-md border p-4">
                <p className="font-medium break-all">
                  {mappings ? record.apiMappingType : record.phoneNumber}
                </p>
                <p className="text-sm break-all">
                  {mappings ? record.apiEndpoint : `Number ID: ${record.numberId}`}
                </p>
                {mappings && (
                  <pre className="bg-muted overflow-auto rounded p-3 text-sm">
                    {JSON.stringify(record.fieldMapping, null, 2)}
                  </pre>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => edit(record)}>
                    Edit
                  </Button>
                  <Button variant="destructive" disabled={busy} onClick={() => remove(record)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {!editing && (
              <Button
                disabled={busy}
                onClick={() => {
                  setEditing({
                    id: '',
                    apiMappingType: 'Account',
                    numberId: '',
                    phoneNumber: '',
                    apiEndpoint: '',
                  });
                  setMappingValues({ ...getDefaultMapping('Account') });
                }}
              >
                Add {mappings ? 'API Mapping' : 'WhatsApp Number'}
              </Button>
            )}
          </>
        )}
        {editing && (
          <form onSubmit={save} className="space-y-4 rounded-md border p-4">
            <h3 className="font-medium">
              {editing.id ? 'Edit' : 'Add'} {mappings ? 'API Mapping' : 'WhatsApp Number'}
            </h3>
            <fieldset disabled={busy} className="space-y-4">
              {mappings ? (
                <>
                  <label className="block space-y-2">
                    <span>API Endpoint</span>
                    <Input
                      required
                      maxLength={255}
                      value={editing.apiEndpoint ?? ''}
                      onChange={(e) => setEditing({ ...editing, apiEndpoint: e.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span>Mapping Type</span>
                    <select
                      className="bg-background block w-full rounded-md border p-2"
                      value={editing.apiMappingType}
                      onChange={(e) => {
                        const type = e.target.value as ApiMappingType;
                        setEditing({ ...editing, apiMappingType: type });
                        if (!editing.id) setMappingValues({ ...getDefaultMapping(type) });
                      }}
                    >
                      {MAPPING_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="space-y-2">
                    <span>Field Mapping</span>
                    <div className="bg-muted rounded-md border p-3 font-mono text-sm leading-loose text-black">
                      <div>{'{'}</div>
                      {Object.keys(mappingValues).map((key, idx, arr) => (
                        <div key={key} className="pl-4">
                          <span>&quot;{key}&quot;</span>
                          <span>: &quot;</span>
                          <input
                            required
                            value={mappingValues[key]}
                            onChange={(e) =>
                              setMappingValues({ ...mappingValues, [key]: e.target.value })
                            }
                            style={{
                              width: mappingValues[key] ? `${mappingValues[key].length}ch` : '2px',
                            }}
                            className="m-0 inline-block appearance-none border-none bg-transparent p-0 font-mono text-sm text-black outline-none"
                          />
                          <span>&quot;{idx < arr.length - 1 ? ',' : ''}</span>
                        </div>
                      ))}
                      <div>{'}'}</div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <label className="block space-y-2">
                    <span>WhatsApp Phone Number ID</span>
                    <Input
                      required
                      maxLength={512}
                      placeholder="Phone number ID from Meta"
                      value={editing.numberId ?? ''}
                      onChange={(e) => setEditing({ ...editing, numberId: e.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span>Phone Number</span>
                    <Input
                      required
                      type="tel"
                      maxLength={512}
                      placeholder="+919876543210"
                      value={editing.phoneNumber ?? ''}
                      onChange={(e) => setEditing({ ...editing, phoneNumber: e.target.value })}
                    />
                  </label>
                </>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
              </div>
            </fieldset>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
