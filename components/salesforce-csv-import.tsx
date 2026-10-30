'use client';

import { useState } from 'react';
import { UploadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { importSalesforceCsv, type SalesforceImportResult } from '@/lib/api';
import { ImportMarketingPreference } from '@/components/import-marketing-preference';

export function SalesforceCsvImport({
  tenant,
  onClose,
  onImported,
  onBusyChange,
}: {
  tenant: string;
  onClose: () => void;
  onImported: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [csv, setCsv] = useState('');
  const [filename, setFilename] = useState('');
  const [result, setResult] = useState<SalesforceImportResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function preview(file?: File) {
    setCsv('');
    setResult(null);
    setError('');
    setCompleted(false);
    setFilename(file?.name ?? '');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 2 * 1024 * 1024) {
      setError('Choose a CSV file of 2 MB or smaller.');
      return;
    }
    setProcessing(true);
    onBusyChange(true);
    try {
      const content = await file.text();
      const { data } = await importSalesforceCsv(tenant, content, true);
      setCsv(content);
      setResult(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not preview CSV');
    } finally {
      setProcessing(false);
      onBusyChange(false);
    }
  }

  async function commit() {
    if (!result?.ready || processing || completed) return;
    setProcessing(true);
    onBusyChange(true);
    setError('');
    try {
      const { data } = await importSalesforceCsv(tenant, csv, false, optIn);
      setResult(data);
      setCompleted(true);
      onImported();
      toast.success(
        `${data.imported} contacts imported; ${data.invalid + data.duplicates + data.existing} skipped`,
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not import CSV');
    } finally {
      setProcessing(false);
      onBusyChange(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Import contacts from Salesforce</CardTitle>
            <CardDescription>
              Choose a Salesforce Account CSV. Up to 5,000 rows and 2 MB per file.
            </CardDescription>
          </div>
          <Button variant="ghost" disabled={processing} onClick={onClose}>
            Close import
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="salesforce-csv">Salesforce CSV file</Label>
          <Input
            id="salesforce-csv"
            type="file"
            accept=".csv,text/csv"
            disabled={processing}
            onChange={(event) => {
              void preview(event.target.files?.[0]);
            }}
          />
          <p className="text-muted-foreground text-xs">
            Required columns: Id, Name, Phone. Billing address maps to location, city, state and
            country. Type, Industry, Website and extra columns are saved as Salesforce custom data.
          </p>
        </div>
        <p className="text-muted-foreground text-sm">
          Rows without a valid phone and repeated IDs or phones are skipped. Existing contacts are
          kept unchanged. Phone spaces, brackets, dots and hyphens are removed; country codes are
          not added.
        </p>
        <ImportMarketingPreference
          value={optIn}
          onChange={setOptIn}
          disabled={processing || completed}
        />
        {processing && (
          <p role="status" className="text-muted-foreground text-sm">
            Processing CSV...
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {result && (
          <div className="space-y-3">
            <p className="text-sm font-medium" aria-live="polite">
              {filename}: {result.total} rows ·{' '}
              {completed ? `${result.imported} imported` : `${result.ready} ready to import`} ·{' '}
              {result.invalid} invalid · {result.duplicates} duplicates in file · {result.existing}{' '}
              already exist
            </p>
            <div className="max-h-80 overflow-auto rounded-lg border">
              <table className="w-full min-w-180 text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    {['CSV row', 'Contact', 'Phone', 'Salesforce ID', 'Status'].map((label) => (
                      <th key={label} scope="col" className="px-3 py-2 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.row} className="border-t">
                      <td className="px-3 py-2">{row.row}</td>
                      <td className="px-3 py-2">{row.name || '—'}</td>
                      <td className="px-3 py-2">{row.phone || '—'}</td>
                      <td className="px-3 py-2">{row.salesforceId}</td>
                      <td className="px-3 py-2">
                        {row.status === 'ready' ? (completed ? 'Imported' : 'Ready') : row.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.total > 50 && (
              <p className="text-muted-foreground text-xs">Showing the first 50 rows.</p>
            )}
            {result.issues.length > 0 && (
              <details className="rounded-lg border p-3 text-sm">
                <summary className="cursor-pointer">Skipped row details (first 100)</summary>
                <ul className="mt-2 space-y-1">
                  {result.issues.map((issue) => (
                    <li key={issue.row}>
                      Row {issue.row}: {issue.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {!completed && (
              <Button disabled={processing || !result.ready} onClick={commit}>
                <UploadIcon /> Import {result.ready} contacts
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
