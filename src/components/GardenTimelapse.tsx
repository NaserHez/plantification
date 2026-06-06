import { useEffect, useMemo, useState } from "react";
import { Film, X, CalendarDays, SortAsc } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import SignedImage from "@/components/SignedImage";

interface PhotoEntry {
  id: string;
  plant_id: string;
  entry_date: string;
  created_at: string;
  image_url: string;
  plant_name: string;
}

type SortMode = "date" | "name";

const formatTimestamp = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function GardenTimelapse() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(
    () => (localStorage.getItem("timelapse_sort") as SortMode) || "date"
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: entries }, { data: plants }] = await Promise.all([
        supabase
          .from("journal_entries")
          .select("id, plant_id, entry_date, created_at, image_url")
          .eq("user_id", user.id)
          .not("image_url", "is", null)
          .order("created_at", { ascending: true })
          .limit(200),
        supabase
          .from("plants")
          .select("id, name, nickname")
          .eq("user_id", user.id),
      ]);

      if (cancelled) return;
      const nameMap = new Map<string, string>(
        (plants || []).map((p: any) => [p.id, p.nickname || p.name])
      );
      const list: PhotoEntry[] = (entries || [])
        .filter((e: any) => e.image_url)
        .map((e: any) => ({
          id: e.id,
          plant_id: e.plant_id,
          entry_date: e.entry_date,
          created_at: e.created_at,
          image_url: e.image_url,
          plant_name: nameMap.get(e.plant_id) || "Plant",
        }));
      setPhotos(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const sortedPhotos = useMemo(() => {
    const arr = [...photos];
    if (sortMode === "name") {
      arr.sort((a, b) => {
        const n = a.plant_name.localeCompare(b.plant_name);
        if (n !== 0) return n;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    } else {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return arr;
  }, [photos, sortMode]);

  const range = useMemo(() => {
    if (photos.length === 0) return null;
    const sorted = [...photos].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return { first: new Date(sorted[0].created_at), last: new Date(sorted[sorted.length - 1].created_at) };
  }, [photos]);

  const toggleSort = () => {
    const next: SortMode = sortMode === "date" ? "name" : "date";
    setSortMode(next);
    localStorage.setItem("timelapse_sort", next);
  };

  if (loading || photos.length === 0) return null;

  const current = lightboxIndex !== null ? sortedPhotos[lightboxIndex] : null;

  return (
    <div className="px-4 mt-6 mb-2">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="font-serif text-sm text-muted-foreground flex items-center gap-1.5 min-w-0">
          <Film className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">Garden timelapse</span>
          <span className="text-[10px] text-muted-foreground/70 shrink-0">· {photos.length}</span>
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          {range && sortMode === "date" && (
            <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
              {range.first.toLocaleDateString()} → {range.last.toLocaleDateString()}
            </span>
          )}
          <button
            onClick={toggleSort}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-card hover:border-primary/40 text-[11px] font-medium"
            aria-label={`Sort by ${sortMode === "date" ? "plant name" : "photo date"}`}
            title={`Sort by ${sortMode === "date" ? "plant name" : "photo date"}`}
          >
            {sortMode === "date" ? <CalendarDays className="w-3 h-3 text-primary" /> : <SortAsc className="w-3 h-3 text-primary" />}
            {sortMode === "date" ? "Date" : "Name"}
          </button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {sortedPhotos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setLightboxIndex(i)}
            className="relative shrink-0 snap-start rounded-xl overflow-hidden border border-border bg-muted hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            style={{ width: 88, height: 88 }}
            aria-label={`${p.plant_name} on ${formatTimestamp(p.created_at)}`}
          >
            <SignedImage
              src={p.image_url}
              alt={p.plant_name}
              lazy
              className="w-full h-full object-cover"
              fallback={<div className="w-full h-full flex items-center justify-center text-xl opacity-40">🌱</div>}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 py-1 pointer-events-none">
              <p className="text-[9px] font-medium text-white leading-tight truncate">
                {p.plant_name}
              </p>
              <p className="text-[9px] text-white/80 leading-tight">
                {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
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
                    {formatTimestamp(current.created_at)}
                  </p>
                </button>
                <button
                  disabled={lightboxIndex === sortedPhotos.length - 1}
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
