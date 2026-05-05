import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import SignedImage from "@/components/SignedImage";

interface DiagnosisEntry {
  id: string;
  is_healthy: boolean;
  overall_confidence: number | null;
  diseases: any[];
  created_at: string;
  image_url: string | null;
}

export default function HealthTimeline({ plantId }: { plantId: string }) {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<DiagnosisEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("diagnosis_history")
        .select("id, is_healthy, overall_confidence, diseases, created_at, image_url")
        .eq("plant_id", plantId)
        .order("created_at", { ascending: false })
        .limit(20);
      setEntries((data as DiagnosisEntry[]) || []);
      setLoading(false);
    };
    fetch();
  }, [plantId]);

  if (loading) return null;
  if (entries.length === 0) {
    return (
      <div className="mt-6">
        <h3 className="font-serif text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
          <Clock className="w-3.5 h-3.5" /> {t("healthHistory")}
        </h3>
        <p className="text-xs text-muted-foreground italic">{t("noHealthHistory")}</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="font-serif text-sm text-muted-foreground flex items-center gap-1.5 mb-3">
        <Clock className="w-3.5 h-3.5" /> {t("healthHistory")}
      </h3>
      <div className="relative pl-6 space-y-3">
        {/* Timeline line */}
        <div className="absolute left-[9px] top-1 bottom-1 w-0.5 bg-border" />

        {entries.map((entry) => {
          const diseases = Array.isArray(entry.diseases) ? entry.diseases : [];
          const date = new Date(entry.created_at);
          return (
            <div key={entry.id} className="relative">
              {/* Dot */}
              <div className={`absolute -left-6 top-1 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
                entry.is_healthy
                  ? "border-primary bg-primary/15"
                  : "border-destructive bg-destructive/15"
              }`}>
                {entry.is_healthy ? (
                  <ShieldCheck className="w-2.5 h-2.5 text-primary" />
                ) : (
                  <ShieldAlert className="w-2.5 h-2.5 text-destructive" />
                )}
              </div>

              <div className="p-3 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${entry.is_healthy ? "text-primary" : "text-destructive"}`}>
                    {entry.is_healthy ? "✓ Healthy" : `⚠ ${diseases.length} issue${diseases.length !== 1 ? "s" : ""}`}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {entry.overall_confidence != null && (
                  <div className="w-full h-1.5 rounded-full bg-muted mb-1.5">
                    <div
                      className={`h-full rounded-full ${entry.is_healthy ? "bg-primary" : "bg-destructive"}`}
                      style={{ width: `${entry.overall_confidence}%` }}
                    />
                  </div>
                )}
                {diseases.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {diseases.slice(0, 3).map((d: any, i: number) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                        {(d.name || "").replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
                {entry.image_url && (
                  <SignedImage src={entry.image_url} alt="" className="w-12 h-12 rounded-lg object-cover mt-2 border border-border" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
