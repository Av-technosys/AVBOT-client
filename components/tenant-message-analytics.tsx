'use client';

import { useEffect, useState } from 'react';
import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  getMessageAnalytics,
  type AnalyticsDays,
  type MessageAnalytics,
  type MessageCounts,
} from '@/lib/message-analytics-api';

const chartConfig = {
  sent: { label: 'Sent', color: 'var(--chart-1)' },
  seen: { label: 'Seen', color: 'var(--chart-3)' },
  unseen: { label: 'Unseen', color: 'var(--chart-5)' },
} satisfies ChartConfig;
const metrics = [
  ['sent', 'Sent'],
  ['delivered', 'Delivered'],
  ['seen', 'Seen'],
  ['unseen', 'Unseen'],
] as const satisfies ReadonlyArray<readonly [keyof MessageCounts, string]>;
const number = new Intl.NumberFormat('en-IN');
const percent = new Intl.NumberFormat('en-IN', {
  style: 'percent',
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});
const shortDate = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const fullDate = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const displayDate = (day: string, formatter = shortDate) =>
  formatter.format(new Date(`${day}T00:00:00Z`));

function Change({ count, previous }: { count: number; previous: number }) {
  if (!previous) {
    return count > 0 ? (
      <span className="text-muted-foreground text-xs">No previous activity</span>
    ) : null;
  }
  const change = (count - previous) / previous;
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
      {change > 0 && <ArrowUpRightIcon aria-hidden size={14} />}
      {change < 0 && <ArrowDownRightIcon aria-hidden size={14} />}
      {percent.format(change)} vs previous period
    </span>
  );
}

export function TenantMessageAnalytics({ tenant }: { tenant: string }) {
  const [days, setDays] = useState<AnalyticsDays>(7);
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<{
    days: AnalyticsDays;
    data?: MessageAnalytics;
    error?: string;
  }>();

  useEffect(() => {
    const controller = new AbortController();
    getMessageAnalytics(tenant, days, controller.signal)
      .then(({ data }) => {
        if (!controller.signal.aborted) setLoaded({ days, data });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setLoaded({ days, error: error.message });
      });
    return () => controller.abort();
  }, [tenant, days, retry]);

  const current = loaded?.days === days ? loaded : undefined;
  const data = current?.data;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Message analytics</CardTitle>
          <CardDescription>Daily outbound WhatsApp messages · India time</CardDescription>
        </div>
        <div className="flex gap-1" role="group" aria-label="Reporting period">
          {([7, 30] as const).map((period) => (
            <Button
              key={period}
              type="button"
              size="sm"
              variant={days === period ? 'default' : 'outline'}
              aria-pressed={days === period}
              onClick={() => setDays(period)}
            >
              {period} days
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-5" aria-busy={!current}>
        {current?.error ? (
          <div className="space-y-2">
            <p role="alert" className="text-destructive text-sm">
              {current.error}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoaded(undefined);
                setRetry((value) => value + 1);
              }}
            >
              Retry
            </Button>
          </div>
        ) : !data ? (
          <p className="text-muted-foreground py-4 text-sm" role="status">
            Loading message analytics…
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {metrics.map(([key, label]) => (
                <div key={key} className="min-w-0 space-y-1 rounded-lg border p-3">
                  <p className="text-muted-foreground text-sm">{label}</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {number.format(data.totals[key])}
                  </p>
                  <Change count={data.totals[key]} previous={data.previousTotals[key]} />
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Today’s totals are in progress. Unseen counts delivered messages with no read receipt.
            </p>
            {data.totals.sent === 0 && (
              <p className="text-muted-foreground text-sm">No outbound messages in this period.</p>
            )}
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-60 w-full min-w-0 sm:h-72"
            >
              <LineChart
                data={data.series}
                accessibilityLayer
                margin={{ left: 0, right: 12, top: 8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(day) => displayDate(String(day))}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tickFormatter={(count) => number.format(count)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(day) => displayDate(String(day), fullDate)}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                {(['sent', 'seen', 'unseen'] as const).map((key) => (
                  <Line
                    key={key}
                    dataKey={key}
                    type="linear"
                    stroke={`var(--color-${key})`}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ChartContainer>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-130 text-sm">
                <caption className="sr-only">Daily message counts by date and message type</caption>
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-3 text-left font-medium">
                      Date
                    </th>
                    {metrics.map(([key, label]) => (
                      <th key={key} scope="col" className="p-3 text-right font-medium">
                        {label}
                      </th>
                    ))}
                    <th scope="col" className="p-3 text-left font-medium">
                      Message types
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.series].reverse().map((day) => (
                    <tr key={day.day} className="border-t align-top">
                      <th scope="row" className="p-3 text-left font-normal whitespace-nowrap">
                        <time dateTime={day.day}>{displayDate(day.day, fullDate)}</time>
                      </th>
                      {metrics.map(([key]) => (
                        <td key={key} className="p-3 text-right tabular-nums">
                          {number.format(day[key])}
                        </td>
                      ))}
                      <td className="p-3">
                        {day.types.length ? (
                          <details className="text-sm">
                            <summary className="text-primary cursor-pointer whitespace-nowrap">
                              View types
                            </summary>
                            <ul className="mt-2 space-y-1">
                              {day.types.map((entry) => (
                                <li
                                  key={entry.type}
                                  className="text-muted-foreground text-xs whitespace-nowrap"
                                >
                                  <span className="text-foreground capitalize">
                                    {entry.type.toLowerCase()}
                                  </span>{' '}
                                  · {number.format(entry.sent)} sent · {number.format(entry.seen)}{' '}
                                  seen · {number.format(entry.unseen)} unseen
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
