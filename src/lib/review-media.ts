const STORAGE_MARKER = '/storage/v1/object/public/ugc/';
const SIGNED_STORAGE_MARKER = '/storage/v1/object/sign/ugc/';

export const REVIEW_MEDIA_BUCKET = 'ugc';
export const REVIEW_MEDIA_URL_TTL_SECONDS = 60 * 60;

export function reviewMediaBytesMatch(type: string, bytes: Uint8Array): boolean {
  const startsWith = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (type === 'image/jpeg') return startsWith(0xff, 0xd8, 0xff);
  if (type === 'image/png') return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (type === 'image/webp') {
    return startsWith(0x52, 0x49, 0x46, 0x46)
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  if (type === 'video/mp4' || type === 'video/quicktime') {
    return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  }
  if (type === 'video/webm') return startsWith(0x1a, 0x45, 0xdf, 0xa3);
  return false;
}

export function reviewMediaPathForUser(value: string, userId: string): boolean {
  return value.startsWith(`reviews/${userId}/`) && !value.includes('..');
}

export function storedReviewMediaPath(value: string): string | null {
  if (value.startsWith('reviews/') && !value.includes('..')) return value;

  try {
    const url = new URL(value);
    const marker = url.pathname.includes(STORAGE_MARKER) ? STORAGE_MARKER : SIGNED_STORAGE_MARKER;
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    const path = decodeURIComponent(url.pathname.slice(index + marker.length));
    return path.startsWith('reviews/') && !path.includes('..') ? path : null;
  } catch {
    return null;
  }
}

export async function signReviewMedia(
  storage: { from(bucket: string): { createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl?: string } | null }> } },
  values: unknown,
): Promise<string[]> {
  if (!Array.isArray(values)) return [];

  return (await Promise.all(values.filter((value): value is string => typeof value === 'string').map(async (value) => {
    const path = storedReviewMediaPath(value);
    if (!path) return null;
    try {
      const { data } = await storage.from(REVIEW_MEDIA_BUCKET).createSignedUrl(path, REVIEW_MEDIA_URL_TTL_SECONDS);
      return data?.signedUrl ?? null;
    } catch {
      return null;
    }
  }))).filter((value): value is string => Boolean(value));
}
