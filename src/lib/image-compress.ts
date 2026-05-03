// Client-side image compression utility for community uploads.
// Limits max dimension and JPEG quality to reduce upload size.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB hard limit (pre-compression)
export const TARGET_MAX_DIMENSION = 1600; // px
export const TARGET_QUALITY = 0.82;

export interface CompressResult {
  file: File;
  originalBytes: number;
  bytes: number;
  width: number;
  height: number;
}

export async function compressImage(
  file: File,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<CompressResult> {
  const maxDim = opts.maxDim ?? TARGET_MAX_DIMENSION;
  const quality = opts.quality ?? TARGET_QUALITY;
  const originalBytes = file.size;

  if (!file.type.startsWith("image/")) {
    throw new Error("File is not an image");
  }
  if (originalBytes > MAX_UPLOAD_BYTES) {
    throw new Error(`Image is too large. Max ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)}MB.`);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Could not read image"));
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not decode image"));
    i.src = dataUrl;
  });

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compression failed"))),
      "image/jpeg",
      quality
    );
  });

  const compressed = new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  return { file: compressed, originalBytes, bytes: compressed.size, width, height };
}
