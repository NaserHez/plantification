import { supabase } from "@/integrations/supabase/client";

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface IdentifyCacheEntry { value: any; ts: number }
const IDENTIFY_CACHE_KEY = 'identify_cache_v1';
const IDENTIFY_CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

function readIdCache(): Record<string, IdentifyCacheEntry> {
  try { return JSON.parse(localStorage.getItem(IDENTIFY_CACHE_KEY) || '{}'); } catch { return {}; }
}
function writeIdCache(c: Record<string, IdentifyCacheEntry>) {
  try { localStorage.setItem(IDENTIFY_CACHE_KEY, JSON.stringify(c)); } catch {}
}

export async function identifyPlant(imageBase64: string, language: string = "en") {
  const useAiValidation = localStorage.getItem('identify_ai_validation') !== 'false';
  // Hash a stable slice of the image to detect "same image" reuse
  const sample = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const imageHash = await sha256Hex(sample.slice(0, 4096) + ':' + sample.length);

  // Client-side cache for instant reuse
  const cache = readIdCache();
  const cacheKey = `${imageHash}|${language}|${useAiValidation ? 1 : 0}`;
  const hit = cache[cacheKey];
  if (hit && Date.now() - hit.ts < IDENTIFY_CACHE_TTL) {
    return { ...hit.value, diagnostics: { ...(hit.value.diagnostics || {}), cached: true, clientCache: true } };
  }

  const { data, error } = await supabase.functions.invoke('identify-plant', {
    body: { image: imageBase64, language, imageHash, useAiValidation },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);

  // Persist
  cache[cacheKey] = { value: data, ts: Date.now() };
  // Trim to last 30
  const keys = Object.keys(cache);
  if (keys.length > 30) {
    keys.sort((a, b) => (cache[a].ts - cache[b].ts));
    keys.slice(0, keys.length - 30).forEach(k => delete cache[k]);
  }
  writeIdCache(cache);
  return data;
}

export async function regenerateCareTips(plantName: string, language: string) {
  const { data, error } = await supabase.functions.invoke('regenerate-care-tips', {
    body: { plantName, language },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.careTips;
}

/**
 * Upload an image to the private `plant-images` bucket.
 * Returns a storage reference of the form `plant-images:<path>` so callers
 * know to resolve it via a signed URL (see getDisplayUrl / SignedImage).
 */
export async function uploadPlantImage(userId: string, file: Blob, fileName: string) {
  const path = `${userId}/${Date.now()}-${fileName}`;
  const { data, error } = await supabase.storage
    .from('plant-images')
    .upload(path, file, { contentType: 'image/jpeg' });

  if (error) throw error;
  return `plant-images:${data.path}`;
}

/**
 * Resolve any stored image reference to a URL the browser can render.
 * - `plant-images:<path>` → short-lived signed URL (private bucket)
 * - Already-public http(s) URL or data: URL → returned as-is
 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
export async function getDisplayUrl(ref: string | null | undefined): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith('plant-images:')) {
    const path = ref.slice('plant-images:'.length);
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    const { data, error } = await supabase.storage
      .from('plant-images')
      .createSignedUrl(path, 60 * 60); // 1h
    if (error || !data?.signedUrl) return null;
    signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 });
    return data.signedUrl;
  }
  return ref; // public URL or data URL
}

export function compressImage(file: File, maxSize = 1800, quality = 0.92): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;
      // Only downscale; never upscale — preserves leaf/flower detail for identification
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
