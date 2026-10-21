import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

/** Decodes the base64 string expo-image-picker returns (with `base64: true`) into bytes for upload. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Uploads into `<bucket>/<userId>/<name>-<timestamp>.<ext>` (storage RLS requires the user's own folder). */
export async function uploadUserImage(opts: {
  bucket: 'avatars' | 'farm-logos';
  userId: string;
  name: string;
  base64: string;
  mimeType: string;
}): Promise<string> {
  const ext = opts.mimeType === 'image/png' ? 'png' : opts.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${opts.userId}/${opts.name}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(opts.bucket)
    .upload(path, base64ToBytes(opts.base64), { contentType: opts.mimeType, upsert: false });
  if (error) throw error;
  return path;
}

/** Deletes every file in the user's folder of a bucket (used when replacing a photo or deleting the account). */
export async function removeUserFiles(bucket: 'avatars' | 'farm-logos', userId: string, keep?: string) {
  const { data } = await supabase.storage.from(bucket).list(userId);
  const paths = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (paths.length) await supabase.storage.from(bucket).remove(paths);
}

/** Short-lived URL for a file in a private bucket. */
export function useSignedUrl(bucket: 'avatars', path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed-url', bucket, path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
