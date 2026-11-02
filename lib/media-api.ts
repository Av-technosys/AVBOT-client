import axios from 'axios';
import { request } from '@/lib/api';

export type TenantMedia = {
  slug: string;
  tenantId: number;
  s3Key: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
};

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
export const MEDIA_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';
const mimeTypes: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function fileMime(file: File) {
  const mime = mimeTypes[file.name.split('.').pop()?.toLowerCase() ?? ''];
  if (!mime) throw new Error('Only PDF, JPG, JPEG, PNG, and WebP files are allowed.');
  if (!file.size) throw new Error('The selected file is empty.');
  if (file.size > MAX_MEDIA_BYTES) throw new Error('Files must be 20 MB or smaller.');
  return mime;
}

function mediaPath(tenant: string, slug?: string) {
  return `/tenants/${encodeURIComponent(tenant)}/media${slug ? `/${encodeURIComponent(slug)}` : ''}`;
}

export function listMedia(tenant: string) {
  return request<{ data: TenantMedia[] }>(mediaPath(tenant));
}

export async function uploadMedia(
  tenant: string,
  file: File,
  name: string,
  onProgress: (percent: number) => void,
) {
  const mimeType = fileMime(file);
  const { data: upload } = await request<{
    data: {
      file: TenantMedia;
      uploadUrl: string;
      headers: Record<string, string>;
    };
  }>(`${mediaPath(tenant)}/uploads`, {
    method: 'POST',
    data: { filename: file.name, size: file.size, mimeType, name },
  });
  try {
    // Use a separate client so API interceptors and auth headers never reach S3.
    await axios.put(upload.uploadUrl, file, {
      headers: upload.headers,
      onUploadProgress: ({ loaded, total }) =>
        onProgress(total ? Math.round((loaded * 100) / total) : 0),
    });
    return await request<{ data: TenantMedia }>(`${mediaPath(tenant, upload.file.slug)}/complete`, {
      method: 'POST',
    });
  } catch (error) {
    try {
      await deleteMedia(tenant, upload.file.slug);
    } catch {
      /* Allow cleanup to be retried server-side. */
    }
    if (axios.isAxiosError(error))
      throw new Error(
        'S3 upload failed. Please retry; if it continues, check the bucket CORS settings and upload permissions.',
      );
    throw error;
  }
}

export function renameMedia(tenant: string, slug: string, name: string) {
  return request<{ data: TenantMedia }>(mediaPath(tenant, slug), { method: 'PUT', data: { name } });
}

export function deleteMedia(tenant: string, slug: string) {
  return request<{ data: null }>(mediaPath(tenant, slug), { method: 'DELETE' });
}

export function mediaUrl(tenant: string, slug: string) {
  return request<{ data: { url: string } }>(`${mediaPath(tenant, slug)}/url`);
}
