import { useEffect, useMemo, useState } from "react";
import { Film, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import SignedImage from "@/components/SignedImage";

interface PhotoEntry {
  id: string;
  plant_id: string;
  entry_date: string;
  image_url: string;
  plant_name: string;
}

export default function GardenTimelapse() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: entries }, { data: plants }] = await Promise.all([
        supabase
          .from("journal_entries")
          .select("id, plant_id, entry_date, image_url")
          .eq("user_id", user.id)
          .not("image_url", "is", null)
          .order("entry_date", { ascending: true })
          .limit(100),
        supabase
          .from("plants")
          .select("id, name, nickname")
          .eq("user_id", user.id),
      ]);

      if (cancelled) return;
      const nameMap = new Map<string, string>(
        (plants || []).map((p: any) => [p.id, p.nickname || p.name])
      );
      const list = (entries || [])
        .filter((e: any) => e.image_url)
        .map((e: any) => ({
          id: e.id,
          plant_id: e.plant_id,
          entry_date: e.entry_date,
          image_url: e.image_url,
          plant_name: nameMap.get(e.plant_id) || "Plant",
        }));
      setPhotos(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const range = useMemo(() => {
    if (photos.length === 0) return null;
    return {
      first: new Date(photos[0].entry_date),
      last: new Date(photos[photos.length - 1].entry_date),
    };
  }, [photos]);

  if (loading || photos.length === 0) return null;

  const current = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <div className="px-4 mt-6 mb-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-serif text-sm text-muted-foreground flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5 text-primary" /> Garden timelapse
          <span className="text-[10px] text-muted-foreground/70">· {photos.length}</span>
        </h2>
        {range && (
          <span className="text-[10px] text-muted-foreground/70">
            {range.first.toLocaleDateString()} → {range.last.toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {photos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setLightboxIndex(i)}
            className="relative shrink-0 snap-start rounded-xl overflow-hidden border border-border bg-muted hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            style={{ width: 88, height: 88 }}
            aria-label={`${p.plant_name} on ${new Date(p.entry_date).toLocaleDateString()}`}
          >
            <SignedImage
              src={p.image_url}
              alt={p.plant_name}
              className="w-full h-full object-cover"
              fallback={<div className="w-full h-full flex items-center justify-center text-xl">🌱</div>}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 py-1">
              <p className="text-[9px] font-medium text-white leading-tight truncate">
                {p.plant_name}
              </p>
              <p className="text-[9px] text-white/80 leading-tight">
                {new Date(p.entry_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
            </div>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {current && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxIndex(null)}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          >
            <button
              onClick={(ev) => { ev.stopPropagation(); setLightboxIndex(null); }}
              className="absolute top-4 right-4 p-2 rounded-full bg-card border border-border"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div onClick={(ev) => ev.stopPropagation()} className="max-w-sm w-full">
              <SignedImage
                src={current.image_url}
                alt={current.plant_name}
                className="w-full max-h-[65vh] rounded-2xl object-contain bg-muted"
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  disabled={lightboxIndex === 0}
                  onClick={(ev) => { ev.stopPropagation(); setLightboxIndex(i => (i ?? 0) - 1); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-muted disabled:opacity-30"
                >← Prev</button>
                <button
                  onClick={(ev) => { ev.stopPropagation(); navigate(`/plant/${current.plant_id}`); }}
                  className="text-xs text-center flex-1 truncate"
                >
                  <p className="font-medium truncate">{current.plant_name}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {new Date(current.entry_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </button>
                <button
                  disabled={lightboxIndex === photos.length - 1}
                  onClick={(ev) => { ev.stopPropagation(); setLightboxIndex(i => (i ?? 0) + 1); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-muted disabled:opacity-30"
                >Next →</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
