'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listMedia, mediaUrl, type TenantMedia } from '@/lib/media-api';

export function TenantMediaPicker({
  tenant,
  format,
  value,
  hasSelection,
  disabled,
  id,
  onSelect,
}: {
  tenant: string;
  format?: string;
  value?: string;
  hasSelection: boolean;
  disabled: boolean;
  id: string;
  onSelect: (file: TenantMedia | null) => void;
}) {
  const [files, setFiles] = useState<TenantMedia[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [url, setUrl] = useState('');
  const [previewError, setPreviewError] = useState('');
  useEffect(() => {
    let active = true;
    listMedia(tenant)
      .then(({ data }) => {
        if (active) {
          setFiles(data);
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
  }, [tenant, reload]);

  useEffect(() => {
    if (!value) return;
    let active = true;
    async function load() {
      try {
        const { data } = await mediaUrl(tenant, value!);
        if (active) {
          setUrl(data.url);
          setPreviewError('');
        }
      } catch {
        if (active) setPreviewError('Preview unavailable. Refresh the gallery to retry.');
      }
    }
    void load();
    const timer = setInterval(
      () => {
        void load();
      },
      50 * 60 * 1000,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [tenant, value, reload]);

  const compatible = files.filter((file) =>
    format === 'IMAGE'
      ? ['image/jpeg', 'image/png'].includes(file.mimeType) && file.size <= 5 * 1024 * 1024
      : format === 'DOCUMENT' && file.mimeType === 'application/pdf',
  );
  const visible = compatible.filter(
    (file) =>
      file.slug === value ||
      `${file.name} ${file.originalName}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = files.find((file) => file.slug === value);
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Search uploaded media"
          className="min-w-40 flex-1"
          placeholder="Search your uploaded files…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || loading}
          onClick={() => {
            setLoading(true);
            setReload((current) => current + 1);
          }}
        >
          <RefreshCwIcon /> Refresh
        </Button>
      </div>
      <select
        id={id}
        className="bg-background w-full rounded-md border px-3 py-2 text-sm"
        value={value ?? ''}
        disabled={disabled || loading || !!error}
        onChange={(event) => {
          setUrl('');
          setPreviewError('');
          onSelect(files.find((file) => file.slug === event.target.value) ?? null);
        }}
      >
        <option value="">{loading ? 'Loading uploaded files…' : 'Choose an uploaded file'}</option>
        {value && !compatible.some((file) => file.slug === value) && (
          <option value={value} disabled>
            Previously selected file
          </option>
        )}
        {visible.map((file) => (
          <option key={file.slug} value={file.slug}>
            {file.name} · {file.originalName} · {(file.size / 1024 / 1024).toFixed(2)} MB
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      {!loading && !error && !compatible.length && (
        <p className="text-muted-foreground text-xs">
          {format === 'VIDEO'
            ? 'The media gallery currently supports images and PDFs. Video files are not available.'
            : 'No compatible files yet. Upload a file in Media, then refresh this list.'}
        </p>
      )}
      {format === 'IMAGE' && (
        <p className="text-muted-foreground text-xs">
          Choose a JPG or PNG up to 5 MB. WebP files cannot be used as WhatsApp image headers.
        </p>
      )}
      {format === 'DOCUMENT' && (
        <p className="text-muted-foreground text-xs">Choose an uploaded PDF document.</p>
      )}
      {hasSelection && !value && (
        <p className="text-muted-foreground text-xs">
          A previously configured file is selected. Choose a gallery file to replace it.
        </p>
      )}
      {selected && (
        <p className="text-sm">
          Selected: <span className="font-medium">{selected.name}</span>
        </p>
      )}
      {selected && url && !previewError && (
        <>
          {selected.mimeType.startsWith('image/') && (
            <Image
              src={url}
              alt={selected.name}
              width={320}
              height={200}
              unoptimized
              className="max-h-48 rounded-lg object-contain"
              onError={() => setPreviewError('Preview unavailable. Refresh the gallery to retry.')}
            />
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary block text-xs underline"
          >
            Preview selected file
          </a>
        </>
      )}
      {previewError && <p className="text-muted-foreground text-xs">{previewError}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/tenant/${encodeURIComponent(tenant)}/media`}
          target="_blank"
          className="text-primary text-xs underline"
        >
          Manage uploaded files
        </Link>
        {hasSelection && (
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              setUrl('');
              setPreviewError('');
              onSelect(null);
            }}
          >
            Remove file selection
          </Button>
        )}
      </div>
    </div>
  );
}
