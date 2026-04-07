import { useState } from "react";
import { Share2, Download, Loader2, Copy, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { amiriRegularBase64 } from "@/fonts/amiri-regular";

interface PlantReportExportProps {
  plantId: string;
  plantName: string;
}

const MOODS: Record<string, string> = {
  thriving: "Thriving",
  stable: "Stable",
  struggling: "Struggling",
  recovering: "Recovering",
};

const MOOD_COLORS: Record<string, [number, number, number]> = {
  thriving: [34, 197, 94],
  stable: [59, 130, 246],
  struggling: [239, 68, 68],
  recovering: [234, 179, 8],
};

interface ReportData {
  plant: any;
  journal: any[];
  health: any[];
  photos: any[];
}

async function fetchReportData(plantId: string): Promise<ReportData> {
  const [journalRes, healthRes, plantRes, photosRes] = await Promise.all([
    supabase.from("journal_entries").select("*").eq("plant_id", plantId).order("entry_date", { ascending: false }).limit(50),
    supabase.from("diagnosis_history").select("*").eq("plant_id", plantId).order("created_at", { ascending: false }).limit(20),
    supabase.from("plants").select("*").eq("id", plantId).single(),
    supabase.from("plant_photos").select("*").eq("plant_id", plantId).order("created_at", { ascending: false }).limit(10),
  ]);
  return {
    plant: plantRes.data,
    journal: journalRes.data || [],
    health: healthRes.data || [],
    photos: photosRes.data || [],
  };
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function generateTextReport(data: ReportData, t: (k: any) => string): string {
  const { plant, journal, health } = data;
  let report = `Plant Report: ${plant?.nickname || plant?.name || "Unknown"}\n`;
  report += `${"═".repeat(40)}\n\n`;

  if (plant) {
    report += `Plant Info\n${"─".repeat(30)}\n`;
    if (plant.scientific_name) report += `${t("scientificName")}: ${plant.scientific_name}\n`;
    if (plant.location) report += `${t("locationLabel")}: ${plant.location}\n`;
    if (plant.sunlight) report += `${t("sunlightLabel")}: ${plant.sunlight}\n`;
    if (plant.watering_frequency) report += `${t("wateringLabel")}: ${plant.watering_frequency}\n`;
    if (plant.last_watered) report += `${t("lastWatered")} ${new Date(plant.last_watered).toLocaleDateString()}\n`;
    if (plant.care_tips) report += `\n${t("careTipsLabel")}\n${plant.care_tips}\n`;
    report += "\n";
  }

  if (health.length > 0) {
    report += `${t("healthHistory")} (${health.length})\n${"─".repeat(30)}\n`;
    health.forEach((h: any) => {
      const date = new Date(h.created_at).toLocaleDateString();
      const status = h.is_healthy ? "Healthy" : "Issues detected";
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
    report += `${t("careJournal")} (${journal.length})\n${"─".repeat(30)}\n`;
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
}

export default function PlantReportExport({ plantId, plantName }: PlantReportExportProps) {
  const { t, language } = useLanguage();
  const isRtl = language === "ar";
  const [generating, setGenerating] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    setGenerating(true);
    try {
      const data = await fetchReportData(plantId);
      const report = generateTextReport(data, t);
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
      const data = await fetchReportData(plantId);
      const report = generateTextReport(data, t);
      if (navigator.share) {
        await navigator.share({ title: `${plantName} — Plant Report`, text: report });
      } else {
        await navigator.clipboard.writeText(report);
        toast.success(t("reportCopied"));
      }
    } catch (err: any) {
      if (err.name !== "AbortError") toast.error("Failed to share");
    } finally {
      setGenerating(false);
    }
  };

  const handlePdfExport = async () => {
    setPdfGenerating(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const data = await fetchReportData(plantId);
      const { plant, journal, health, photos } = data;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;

      const checkPage = (needed: number) => {
        if (y + needed > pageH - margin) {
          pdf.addPage();
          y = margin;
        }
      };

      // ── Header with green accent bar ──
      pdf.setFillColor(34, 197, 94);
      pdf.rect(0, 0, pageW, 28, "F");
      pdf.setFillColor(22, 163, 74);
      pdf.rect(0, 26, pageW, 2, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Plantification", margin, 12);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(t("plantReport"), margin, 19);
      pdf.text(new Date().toLocaleDateString(), pageW - margin, 19, { align: "right" });

      y = 36;

      // ── Plant hero image ──
      if (plant?.image_url) {
        const imgData = await loadImageAsBase64(plant.image_url);
        if (imgData) {
          checkPage(55);
          const imgW = Math.min(contentW, 80);
          const imgH = imgW * 0.75;
          const imgX = margin + (contentW - imgW) / 2;
          // Rounded clip effect via rect background
          pdf.setFillColor(245, 245, 245);
          pdf.roundedRect(imgX - 2, y - 2, imgW + 4, imgH + 4, 3, 3, "F");
          pdf.addImage(imgData, "JPEG", imgX, y, imgW, imgH);
          y += imgH + 8;
        }
      }

      // ── Plant name ──
      pdf.setTextColor(30, 30, 30);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text(plant?.nickname || plant?.name || plantName, margin, y);
      y += 7;

      if (plant?.scientific_name) {
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(120, 120, 120);
        pdf.text(plant.scientific_name, margin, y);
        y += 6;
      }

      // ── Info cards ──
      y += 4;
      const infoItems: [string, string][] = [];
      if (plant?.location) infoItems.push([t("locationLabel"), plant.location]);
      if (plant?.sunlight) infoItems.push([t("sunlightLabel"), plant.sunlight]);
      if (plant?.watering_frequency) infoItems.push([t("wateringLabel"), plant.watering_frequency]);
      if (plant?.last_watered) infoItems.push([t("lastWatered").replace(":", ""), new Date(plant.last_watered).toLocaleDateString()]);

      if (infoItems.length > 0) {
        checkPage(16);
        const cardW = contentW / Math.min(infoItems.length, 4);
        infoItems.forEach(([label, value], i) => {
          const cx = margin + i * cardW;
          pdf.setFillColor(240, 253, 244);
          pdf.roundedRect(cx, y, cardW - 3, 14, 2, 2, "F");
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(100, 100, 100);
          pdf.text(label, cx + 3, y + 5);
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(30, 30, 30);
          pdf.text(value, cx + 3, y + 11);
        });
        y += 20;
      }

      // ── Care tips ──
      if (plant?.care_tips) {
        checkPage(30);
        pdf.setFillColor(254, 249, 195);
        const tipLines = pdf.splitTextToSize(plant.care_tips, contentW - 10);
        const tipH = tipLines.length * 4.5 + 12;
        pdf.roundedRect(margin, y, contentW, tipH, 2, 2, "F");
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(120, 100, 0);
        pdf.text(t("careTipsLabel").replace(/[^\w\s]/g, "").trim(), margin + 5, y + 6);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(80, 70, 0);
        pdf.setFontSize(8);
        pdf.text(tipLines, margin + 5, y + 12);
        y += tipH + 6;
      }

      // ── Section helper ──
      const sectionTitle = (title: string, color: [number, number, number]) => {
        checkPage(14);
        y += 4;
        pdf.setFillColor(...color);
        pdf.rect(margin, y, 3, 8, "F");
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 30, 30);
        pdf.text(title, margin + 6, y + 6);
        y += 12;
      };

      // ── Health History ──
      if (health.length > 0) {
        sectionTitle(`${t("healthHistory")} (${health.length})`, [239, 68, 68]);

        for (const h of health) {
          checkPage(16);
          const isHealthy = h.is_healthy;
          const diseases = Array.isArray(h.diseases) ? h.diseases : [];

          pdf.setFillColor(isHealthy ? 240 : 254, isHealthy ? 253 : 242, isHealthy ? 244 : 242);
          pdf.roundedRect(margin, y, contentW, 12 + diseases.length * 4, 2, 2, "F");

          pdf.setFontSize(9);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(...(isHealthy ? [34, 197, 94] as [number, number, number] : [239, 68, 68] as [number, number, number]));
          pdf.text(isHealthy ? "✓ Healthy" : "⚠ Issues", margin + 4, y + 5);

          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(8);
          const dateStr = new Date(h.created_at).toLocaleDateString();
          pdf.text(dateStr + (h.overall_confidence ? ` (${h.overall_confidence}%)` : ""), pageW - margin - 4, y + 5, { align: "right" });

          diseases.forEach((d: any, i: number) => {
            pdf.setTextColor(80, 80, 80);
            pdf.text(`• ${(d.name || "").replace(/_/g, " ")}`, margin + 6, y + 10 + i * 4);
          });

          y += 14 + diseases.length * 4;
        }
      }

      // ── Care Journal ──
      if (journal.length > 0) {
        sectionTitle(`${t("careJournal")} (${journal.length})`, [59, 130, 246]);

        for (const j of journal) {
          const mood = j.mood || "stable";
          const obsLines = j.observation ? pdf.splitTextToSize(j.observation, contentW - 14) : [];
          const entryH = 12 + obsLines.length * 4 + (j.image_url ? 28 : 0);
          checkPage(entryH);

          pdf.setFillColor(248, 250, 252);
          pdf.roundedRect(margin, y, contentW, entryH, 2, 2, "F");

          // Mood color bar
          const mColor = MOOD_COLORS[mood] || [59, 130, 246];
          pdf.setFillColor(...mColor);
          pdf.rect(margin, y, 3, entryH, "F");

          pdf.setFontSize(9);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(...mColor);
          pdf.text(MOODS[mood] || mood, margin + 6, y + 5);

          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(8);
          pdf.text(new Date(j.entry_date).toLocaleDateString(), pageW - margin - 4, y + 5, { align: "right" });

          if (obsLines.length > 0) {
            pdf.setTextColor(60, 60, 60);
            pdf.text(obsLines, margin + 6, y + 11);
          }

          if (j.image_url) {
            const jImg = await loadImageAsBase64(j.image_url);
            if (jImg) {
              const imgY = y + 10 + obsLines.length * 4;
              pdf.addImage(jImg, "JPEG", margin + 6, imgY, 22, 22);
            }
          }

          y += entryH + 3;
        }
      }

      // ── Photo Gallery ──
      if (photos.length > 0) {
        sectionTitle(`${t("photoGallery")} (${photos.length})`, [168, 85, 247]);

        const photosPerRow = 3;
        const photoSize = (contentW - (photosPerRow - 1) * 4) / photosPerRow;

        for (let i = 0; i < photos.length; i++) {
          const col = i % photosPerRow;
          if (col === 0) checkPage(photoSize + 8);

          const px = margin + col * (photoSize + 4);
          const pImg = await loadImageAsBase64(photos[i].image_url);
          if (pImg) {
            pdf.setFillColor(240, 240, 240);
            pdf.roundedRect(px, y, photoSize, photoSize * 0.75, 2, 2, "F");
            pdf.addImage(pImg, "JPEG", px, y, photoSize, photoSize * 0.75);
          }

          if (col === photosPerRow - 1 || i === photos.length - 1) {
            y += photoSize * 0.75 + 5;
          }
        }
      }

      // ── Footer ──
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(150, 150, 150);
        pdf.text(`${t("generatedBy")} Plantification • ${new Date().toLocaleDateString()}`, margin, pageH - 6);
        pdf.text(`${p} / ${totalPages}`, pageW - margin, pageH - 6, { align: "right" });
      }

      pdf.save(`${plantName.replace(/\s+/g, "_")}_report.pdf`);
      toast.success(t("reportDownloaded"));
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfGenerating(false);
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
          onClick={handlePdfExport}
          disabled={pdfGenerating || generating}
          className="h-8 rounded-lg gap-1.5 text-xs"
        >
          {pdfGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          {t("exportPdf")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          disabled={generating || pdfGenerating}
          className="h-8 rounded-lg gap-1.5 text-xs"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
          {t("shareReport")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={generating || pdfGenerating}
          className="h-8 rounded-lg gap-1.5 text-xs"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {t("copyReport")}
        </Button>
      </div>
    </div>
  );
}
