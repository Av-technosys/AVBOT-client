'use client';

import { useEffect, useState } from 'react';
import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImportMarketingPreference } from '@/components/import-marketing-preference';
import {
  listSalesforceImportJobs,
  startSalesforceImport,
  type SalesforceImportJob,
} from '@/lib/api';

export function SalesforceImportStatus({
  tenantId,
  accountId,
}: {
  tenantId: string;
  accountId: string;
}) {
  const [jobs, setJobs] = useState<SalesforceImportJob[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [starting, setStarting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data } = await listSalesforceImportJobs(tenantId, accountId);
        if (!active) return;
        setJobs(data);
        setError('');
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : 'Could not load imports.');
      } finally {
        if (active) {
          setLoaded(true);
          setRefreshing(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [tenantId, accountId, refresh]);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (starting || refreshing || active || !loaded || error) return;
    setStarting(true);
    try {
      const { data } = await startSalesforceImport(tenantId, accountId, { marketingOptIn });
      setJobs((previous) => [
        ...data,
        ...previous.filter((job) => !data.some((created) => created.id === job.id)),
      ]);
      setRefreshing(true);
      setRefresh((value) => value + 1);
      toast.success('Salesforce imports queued');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start imports.');
    } finally {
      setStarting(false);
    }
  }
  const active = jobs.some((job) => !['COMPLETED', 'FAILED'].includes(job.status));
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Data sync status</CardTitle>
          <CardDescription>
            Recent imports for this Salesforce account. Use Refresh to get the latest status.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={refreshing || starting}
          aria-label="Refresh data sync status"
          onClick={() => {
            setRefreshing(true);
            setRefresh((value) => value + 1);
          }}
        >
          <RefreshCwIcon className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={start} className="flex flex-wrap items-start gap-4 rounded-lg border p-3">
          <div className="min-w-0 flex-1">
            <ImportMarketingPreference
              value={marketingOptIn}
              onChange={setMarketingOptIn}
              disabled={starting || refreshing || active || !loaded || !!error}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={starting || refreshing || active || !loaded || !!error}
          >
            {starting ? 'Starting...' : 'Start import'}
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {!loaded && <p className="text-muted-foreground text-sm">Loading imports...</p>}
        {loaded && !error && !jobs.length && (
          <p className="text-muted-foreground text-sm">No imports yet.</p>
        )}
        {!!jobs.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Salesforce import progress for the selected account
              </caption>
              <thead>
                <tr>
                  {[
                    'Source',
                    'Status',
                    'Marketing opt-in',
                    'Processed',
                    'Imported',
                    'Skipped',
                    'Started',
                    'Details',
                  ].map((label) => (
                    <th key={label} className="border-b px-3 py-2 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="border-b px-3 py-2">
                      {job.objectType === 'Lead' ? 'Leads' : 'Contacts'}
                    </td>
                    <td className="border-b px-3 py-2">
                      <span className={job.status === 'FAILED' ? 'text-destructive' : ''}>
                        {job.status}
                      </span>
                    </td>
                    <td className="border-b px-3 py-2">{job.marketingOptIn ? 'Yes' : 'No'}</td>
                    <td className="border-b px-3 py-2">{job.rowsProcessed.toLocaleString()}</td>
                    <td className="border-b px-3 py-2">{job.rowsImported.toLocaleString()}</td>
                    <td className="border-b px-3 py-2">{job.rowsSkipped.toLocaleString()}</td>
                    <td className="border-b px-3 py-2 whitespace-nowrap">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td className="max-w-sm border-b px-3 py-2 break-words">
                      {job.lastError ||
                        (job.status === 'EXPORTING' && job.nextPollAt
                          ? `Next check: ${new Date(job.nextPollAt).toLocaleTimeString()}`
                          : job.salesforceJobId || '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
