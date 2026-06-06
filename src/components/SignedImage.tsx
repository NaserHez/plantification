import { useEffect, useRef, useState } from "react";
import { getDisplayUrl } from "@/lib/supabase-helpers";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  fallback?: React.ReactNode;
  /** When true, defers signed-URL resolution + image fetch until the element scrolls into view. */
  lazy?: boolean;
};

/**
 * Renders an <img> for either a public URL or a `plant-images:<path>` private reference.
 * Resolves a short-lived signed URL when needed.
 */
export default function SignedImage({ src, fallback = null, lazy = false, className, ...rest }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [inView, setInView] = useState(!lazy);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!lazy || inView) return;
    const node = wrapperRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [lazy, inView]);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!inView) return;
    getDisplayUrl(src).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => { cancelled = true; };
  }, [src, inView]);

  if (!url) {
    if (lazy) {
      return (
        <span
          ref={wrapperRef}
          className={`block animate-pulse bg-muted ${className || ""}`}
          aria-hidden="true"
        >
          {fallback}
        </span>
      );
    }
    return <>{fallback}</>;
  }
  return <img src={url} loading={lazy ? "lazy" : rest.loading} decoding="async" className={className} {...rest} />;
}
