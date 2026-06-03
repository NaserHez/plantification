import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { BookOpen, Plus, Trash2, Camera, Smile, Loader2, Film, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { uploadPlantImage, compressImage } from "@/lib/supabase-helpers";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import SignedImage from "@/components/SignedImage";

interface JournalEntry {
  id: string;
  entry_date: string;
  observation: string | null;
  mood: string | null;
  image_url: string | null;
  created_at: string;
}

const MOODS = [
  { value: "thriving", emoji: "🌟", label: { en: "Thriving", ar: "مزدهرة", pt: "Próspera" } },
  { value: "stable", emoji: "🌿", label: { en: "Stable", ar: "مستقرة", pt: "Estável" } },
  { value: "struggling", emoji: "🥀", label: { en: "Struggling", ar: "تعاني", pt: "Debilitada" } },
  { value: "recovering", emoji: "🌱", label: { en: "Recovering", ar: "تتعافى", pt: "A recuperar" } },
];

export default function PlantJournal({ plantId }: { plantId: string }) {
  const { t, language } = useLanguage();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [observation, setObservation] = useState("");
  const [mood, setMood] = useState("stable");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Timelapse photos = entries with image_url, oldest → newest so growth reads left-to-right
  const timelapse = useMemo(
    () => entries.filter(e => e.image_url).slice().reverse(),
    [entries]
  );

  useEffect(() => {
    const fetchEntries = async () => {
      const { data } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("plant_id", plantId)
        .order("entry_date", { ascending: false })
        .limit(50);
      setEntries((data as JournalEntry[]) || []);
      setLoading(false);
    };
    fetchEntries();
  }, [plantId]);

  const handleImagePick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setImagePreview(compressed);
      const res = await fetch(compressed);
      setImageFile(await res.blob());
    } catch {
      toast.error("Failed to process image");
    }
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleSave = async () => {
    if (!observation.trim() && !imageFile) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadPlantImage(user.id, imageFile, `journal-${Date.now()}.jpg`);
      }

      const { data, error } = await supabase.from("journal_entries").insert({
        plant_id: plantId,
        user_id: user.id,
        observation: observation.trim() || null,
        mood,
        image_url: imageUrl,
      }).select().single();

      if (error) throw error;
      setEntries(prev => [data as JournalEntry, ...prev]);
      setObservation("");
      setMood("stable");
      setImagePreview(null);
      setImageFile(null);
      setShowForm(false);
      toast.success(t("journalSaved"));
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("journal_entries").delete().eq("id", id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success(t("journalDeleted"));
  };

  const moodLabel = (value: string) => {
    const m = MOODS.find(m => m.value === value);
    if (!m) return value;
    return `${m.emoji} ${m.label[language as keyof typeof m.label] || m.label.en}`;
  };

  if (loading) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-sm text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" /> {t("careJournal")}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="h-7 px-2 text-xs gap-1"
        >
          <Plus className="w-3 h-3" /> {t("addEntry")}
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="p-3 rounded-xl bg-accent/50 border border-border space-y-3">
              <div className="flex gap-1.5 flex-wrap">
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setMood(m.value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      mood === m.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {m.emoji} {m.label[language as keyof typeof m.label] || m.label.en}
                  </button>
                ))}
              </div>

              <Textarea
                value={observation}
                onChange={e => setObservation(e.target.value)}
                placeholder={t("journalPlaceholder")}
                className="rounded-xl resize-none text-sm"
                rows={3}
              />

              {imagePreview && (
                <div className="relative w-20 h-20">
                  <img src={imagePreview} alt="" className="w-full h-full rounded-lg object-cover border border-border" />
                  <button
                    onClick={() => { setImagePreview(null); setImageFile(null); }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px]"
                  >✕</button>
                </div>
              )}

              <input ref={fileRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="h-8 rounded-lg gap-1 text-xs">
                  <Camera className="w-3.5 h-3.5" /> {t("addPhoto")}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || (!observation.trim() && !imageFile)} className="h-8 rounded-lg gap-1 text-xs ms-auto">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {t("save")}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timelapse growth gallery */}
      {timelapse.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-primary" /> {t("growthTimelapse") || "Growth timelapse"}
              <span className="text-[10px] text-muted-foreground/70">· {timelapse.length}</span>
            </h4>
            <span className="text-[10px] text-muted-foreground/70">
              {new Date(timelapse[0].entry_date).toLocaleDateString()} → {new Date(timelapse[timelapse.length - 1].entry_date).toLocaleDateString()}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
            {timelapse.map((e, i) => (
              <button
                key={e.id}
                onClick={() => setLightboxIndex(i)}
                className="relative shrink-0 snap-start rounded-xl overflow-hidden border border-border bg-muted hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                style={{ width: 96, height: 96 }}
                aria-label={`Open photo from ${new Date(e.entry_date).toLocaleDateString()}`}
              >
                <SignedImage
                  src={e.image_url!}
                  alt={`Plant photo ${i + 1}`}
                  className="w-full h-full object-cover"
                  fallback={<div className="w-full h-full flex items-center justify-center text-xl">🌱</div>}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                  <p className="text-[9px] font-medium text-white leading-tight">
                    {new Date(e.entry_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <span className="absolute top-1 left-1 text-[9px] font-bold text-white bg-primary/80 rounded-full px-1.5 py-0.5">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && timelapse[lightboxIndex] && (
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
                src={timelapse[lightboxIndex].image_url!}
                alt=""
                className="w-full max-h-[70vh] rounded-2xl object-contain bg-muted"
              />
              <div className="mt-3 flex items-center justify-between">
                <button
                  disabled={lightboxIndex === 0}
                  onClick={(ev) => { ev.stopPropagation(); setLightboxIndex(i => (i ?? 0) - 1); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-muted disabled:opacity-30"
                >← Prev</button>
                <div className="text-xs text-center">
                  <p className="font-medium">{moodLabel(timelapse[lightboxIndex].mood || "stable")}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {new Date(timelapse[lightboxIndex].entry_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
                <button
                  disabled={lightboxIndex === timelapse.length - 1}
                  onClick={(ev) => { ev.stopPropagation(); setLightboxIndex(i => (i ?? 0) + 1); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-muted disabled:opacity-30"
                >Next →</button>
              </div>
              {timelapse[lightboxIndex].observation && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed text-center">
                  {timelapse[lightboxIndex].observation}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t("noJournalEntries")}</p>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <div key={entry.id} className="p-3 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{moodLabel(entry.mood || "stable")}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.entry_date).toLocaleDateString()}
                  </span>
                  <button onClick={() => handleDelete(entry.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {entry.observation && (
                <p className="text-sm text-muted-foreground leading-relaxed">{entry.observation}</p>
              )}
              {entry.image_url && (
                <SignedImage src={entry.image_url} alt="" className="w-16 h-16 rounded-lg object-cover mt-2 border border-border" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
