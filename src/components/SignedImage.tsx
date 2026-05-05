import { useEffect, useState } from "react";
import { getDisplayUrl } from "@/lib/supabase-helpers";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  fallback?: React.ReactNode;
};

/**
 * Renders an <img> for either a public URL or a `plant-images:<path>` private reference.
 * Resolves a short-lived signed URL when needed.
 */
export default function SignedImage({ src, fallback = null, ...rest }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    getDisplayUrl(src).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => { cancelled = true; };
  }, [src]);

  if (!url) return <>{fallback}</>;
  return <img src={url} {...rest} />;
}
