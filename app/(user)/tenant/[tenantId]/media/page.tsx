'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import {
  ExternalLinkIcon,
  FileTextIcon,
  ImagesIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { TenantBreadcrumb } from '@/components/tenant-breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getTenant } from '@/lib/api';
import {
  deleteMedia,
  fileMime,
  listMedia,
  MEDIA_ACCEPT,
  mediaUrl,
  renameMedia,
  uploadMedia,
  type TenantMedia,
} from '@/lib/media-api';

function formatSize(size: number) {
  return size < 1024 * 1024
    ? `${(size / 1024).toFixed(1)} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function MediaPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  return <MediaGallery key={tenantId} tenant={tenantId} />;
}

function MediaGallery({ tenant }: { tenant: string }) {
  const [files, setFiles] = useState<TenantMedia[]>([]);
  const [tenantName, setTenantName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    getTenant(tenant)
      .then(({ data }) => {
        if (active) setTenantName(data.name);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [tenant]);

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

  function refresh() {
    setLoading(true);
    setReload((value) => value + 1);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !name.trim()) return;
    setUploading(true);
    setProgress(0);
    try {
      const { data } = await uploadMedia(tenant, selected, name.trim(), setProgress);
      setFiles((current) => [data, ...current]);
      setSelected(null);
      setName('');
      if (fileInput.current) fileInput.current.value = '';
      toast.success('File uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const visible = files.filter(
    (file) =>
      (filter === 'all' ||
        (filter === 'images'
          ? file.mimeType.startsWith('image/')
          : file.mimeType === 'application/pdf')) &&
      `${file.name} ${file.originalName}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <TenantBreadcrumb tenantId={tenant} tenantLabel={tenantName} currentPage="Media" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Upload and manage images and PDFs for {tenantName || 'this tenant'}.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading || uploading}>
          <RefreshCwIcon className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadIcon className="size-4" /> Upload media
          </CardTitle>
          <CardDescription>PDF, JPG, JPEG, PNG, or WebP. Up to 20 MB per file.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={upload} className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="media-file">File</Label>
              <Input
                ref={fileInput}
                id="media-file"
                type="file"
                accept={MEDIA_ACCEPT}
                disabled={uploading}
                required
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setSelected(null);
                  if (!file) {
                    setName('');
                    return;
                  }
                  try {
                    fileMime(file);
                    setSelected(file);
                    setName(file.name);
                  } catch (err) {
                    event.target.value = '';
                    setName('');
                    toast.error((err as Error).message);
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="media-name">File name</Label>
              <Input
                id="media-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Give this file a name"
                maxLength={255}
                required
                disabled={uploading}
              />
            </div>
            <Button
              type="submit"
              disabled={!selected || !name.trim() || uploading || loading || !!error}
            >
              <UploadIcon />{' '}
              {uploading
                ? progress === 100
                  ? 'Saving…'
                  : `Uploading ${progress}%`
                : 'Upload file'}
            </Button>
            {selected && (
              <p className="text-muted-foreground text-xs md:col-span-3">
                {selected.name} · {formatSize(selected.size)}
              </p>
            )}
            {uploading && (
              <progress
                className="h-2 w-full md:col-span-3"
                value={progress}
                max={100}
                aria-label="Upload progress"
              />
            )}
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <Input
            aria-label="Search media"
            placeholder="Search files…"
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          aria-label="Filter media type"
          className="bg-background h-9 rounded-lg border px-3 text-sm"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All files</option>
          <option value="images">Images</option>
          <option value="pdf">PDFs</option>
        </select>
        <span className="text-muted-foreground text-sm">
          {files.length} {files.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      {error ? (
        <div role="alert" className="border-destructive/30 text-destructive rounded-xl border p-5">
          {error}{' '}
          <Button variant="outline" onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : loading ? (
        <p role="status" className="text-muted-foreground py-12 text-center">
          Loading media…
        </p>
      ) : !visible.length ? (
        <div className="text-muted-foreground rounded-xl border border-dashed py-16 text-center">
          <ImagesIcon className="mx-auto mb-3 size-10" />
          <p className="text-foreground font-medium">
            {files.length ? 'No matching files' : 'Your media gallery is empty'}
          </p>
          <p className="mt-1 text-sm">
            {files.length
              ? 'Try a different search or file type.'
              : 'Upload your first image or PDF above.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((file) => (
            <MediaCard
              key={file.slug}
              file={file}
              tenant={tenant}
              onRename={(saved) =>
                setFiles((current) =>
                  current.map((item) => (item.slug === saved.slug ? saved : item)),
                )
              }
              onDelete={() =>
                setFiles((current) => current.filter((item) => item.slug !== file.slug))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaCard({
  file,
  tenant,
  onRename,
  onDelete,
}: {
  file: TenantMedia;
  tenant: string;
  onRename: (file: TenantMedia) => void;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(file.name);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const isImage = file.mimeType.startsWith('image/');

  useEffect(() => {
    let active = true;
    async function loadUrl() {
      try {
        const { data } = await mediaUrl(tenant, file.slug);
        if (active) {
          setUrl(data.url);
          setPreviewError(false);
        }
      } catch {
        if (active) setPreviewError(true);
      }
    }
    void loadUrl();
    const timer = setInterval(
      () => {
        void loadUrl();
      },
      50 * 60 * 1000,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [tenant, file.slug, reload]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { data } = await renameMedia(tenant, file.slug, name.trim());
      onRename(data);
      setEditing(false);
      toast.success('File renamed');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete “${file.name}”? This removes the file from the media gallery and storage.`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteMedia(tenant, file.slug);
      onDelete();
      toast.success('File deleted');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden py-0">
      <div className="bg-muted flex aspect-[4/3] items-center justify-center overflow-hidden">
        {isImage && url && !previewError ? (
          // Signed S3 URLs are temporary and do not need Next.js image optimization.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={file.name}
            className="size-full object-contain"
            loading="lazy"
            onError={() => setPreviewError(true)}
          />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2">
            {isImage ? <ImagesIcon className="size-12" /> : <FileTextIcon className="size-12" />}
            <span className="text-xs">{isImage ? 'Image' : 'PDF document'}</span>
          </div>
        )}
      </div>
      <CardContent className="space-y-3 p-4">
        {editing ? (
          <form onSubmit={save} className="space-y-2">
            <Input
              aria-label={`New name for ${file.name}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              required
              disabled={busy}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={busy || !name.trim()}>
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setName(file.name);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <p className="truncate font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="text-muted-foreground truncate text-xs" title={file.originalName}>
              {file.originalName}
            </p>
          </div>
        )}
        <div className="text-muted-foreground space-y-1 text-xs">
          <p>
            {file.mimeType.split('/')[1].toUpperCase()} · {formatSize(file.size)}
          </p>
          <p>Added {new Date(file.createdAt).toLocaleString()}</p>
          <p>Updated {new Date(file.updatedAt).toLocaleString()}</p>
        </div>
        {previewError && (
          <Button variant="outline" size="sm" onClick={() => setReload((value) => value + 1)}>
            Retry preview
          </Button>
        )}
        <div className="flex gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            render={<a href={url || undefined} target="_blank" rel="noopener noreferrer" />}
            disabled={!url || previewError}
          >
            <ExternalLinkIcon /> Open
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Rename ${file.name}`}
            title="Rename"
            disabled={busy || editing}
            onClick={() => setEditing(true)}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            aria-label={`Delete ${file.name}`}
            title="Delete"
            className="ml-auto"
            disabled={busy}
            onClick={remove}
          >
            <Trash2Icon />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
