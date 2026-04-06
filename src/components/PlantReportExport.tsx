import { useState } from "react";
import { Share2, Download, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

interface PlantReportExportProps {
  plantId: string;
  plantName: string;
}

const MOODS: Record<string, string> = {
  thriving: "🌟 Thriving",
  stable: "🌿 Stable",
  struggling: "🥀 Struggling",
  recovering: "🌱 Recovering",
};

export default function PlantReportExport({ plantId, plantName }: PlantReportExportProps) {
  const { t } = useLanguage();
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateReport = async (): Promise<string> => {
    const [journalRes, healthRes, plantRes] = await Promise.all([
      supabase.from("journal_entries").select("*").eq("plant_id", plantId).order("entry_date", { ascending: false }).limit(50),
      supabase.from("diagnosis_history").select("*").eq("plant_id", plantId).order("created_at", { ascending: false }).limit(20),
      supabase.from("plants").select("*").eq("id", plantId).single(),
    ]);

    const plant = plantRes.data;
    const journal = journalRes.data || [];
    const health = healthRes.data || [];

    let report = `🌿 ${t("plantReport")}: ${plantName}\n`;
    report += `${"═".repeat(40)}\n\n`;

    if (plant) {
      report += `📋 ${t("plantInfo")}\n`;
      report += `${"─".repeat(30)}\n`;
      if (plant.scientific_name) report += `${t("scientificName")}: ${plant.scientific_name}\n`;
      if (plant.location) report += `${t("locationLabel")}: ${plant.location}\n`;
      if (plant.sunlight) report += `${t("sunlightLabel")}: ${plant.sunlight}\n`;
      if (plant.watering_frequency) report += `${t("wateringLabel")}: ${plant.watering_frequency}\n`;
      if (plant.last_watered) report += `${t("lastWatered")} ${new Date(plant.last_watered).toLocaleDateString()}\n`;
      if (plant.care_tips) report += `\n💡 ${t("careTipsLabel")}\n${plant.care_tips}\n`;
      report += "\n";
    }

    if (health.length > 0) {
      report += `🏥 ${t("healthHistory")} (${health.length})\n`;
      report += `${"─".repeat(30)}\n`;
      health.forEach((h: any) => {
        const date = new Date(h.created_at).toLocaleDateString();
        const status = h.is_healthy ? "✅ Healthy" : "⚠️ Issues detected";
        const diseases = Array.isArray(h.diseases) ? h.diseases : [];
        report += `${date} — ${status}`;
        if (h.overall_confidence) report += ` (${h.overall_confidence}%)`;
        report += "\n";
        diseases.forEach((d: any) => {
          report += `  • ${(d.name || "").replace(/_/g, " ")}\n`;
        });
      });
      report += "\n";
    }

    if (journal.length > 0) {
      report += `📓 ${t("careJournal")} (${journal.length})\n`;
      report += `${"─".repeat(30)}\n`;
      journal.forEach((j: any) => {
        const date = new Date(j.entry_date).toLocaleDateString();
        const mood = MOODS[j.mood || "stable"] || j.mood;
        report += `${date} — ${mood}\n`;
        if (j.observation) report += `  ${j.observation}\n`;
      });
    }

    report += `\n${"═".repeat(40)}\n`;
    report += `${t("generatedBy")} Plantification • ${new Date().toLocaleDateString()}\n`;

    return report;
  };

  const handleCopy = async () => {
    setGenerating(true);
    try {
      const report = await generateReport();
      await navigator.clipboard.writeText(report);
      setCopied(true);
      toast.success(t("reportCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy report");
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    setGenerating(true);
    try {
      const report = await generateReport();
      if (navigator.share) {
        await navigator.share({
          title: `${plantName} — Plant Report`,
          text: report,
        });
      } else {
        await navigator.clipboard.writeText(report);
        toast.success(t("reportCopied"));
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error("Failed to share");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const report = await generateReport();
      const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${plantName.replace(/\s+/g, "_")}_report.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("reportDownloaded"));
    } catch {
      toast.error("Failed to download");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mt-6">
      <h3 className="font-serif text-sm text-muted-foreground flex items-center gap-1.5 mb-3">
        <Share2 className="w-3.5 h-3.5" /> {t("shareExport")}
      </h3>
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          disabled={generating}
          className="h-8 rounded-lg gap-1.5 text-xs"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
          {t("shareReport")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={generating}
          className="h-8 rounded-lg gap-1.5 text-xs"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {t("copyReport")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={generating}
          className="h-8 rounded-lg gap-1.5 text-xs"
        >
          <Download className="w-3.5 h-3.5" />
          {t("downloadReport")}
        </Button>
      </div>
    </div>
  );
}
