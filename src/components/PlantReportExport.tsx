import { useState } from "react";
import { Share2, Download, Loader2, Copy, Check, FileText, Eye } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
    const { getDisplayUrl } = await import("@/lib/supabase-helpers");
    const resolved = await getDisplayUrl(url);
    if (!resolved) return null;
    const res = await fetch(resolved);
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  const openPreview = async () => {
    setPreviewOpen(true);
    if (qrPreview) return;
    try {
      const url = `${window.location.origin}/plant/${plantId}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 220,
        margin: 1,
        color: { dark: "#1e1e1e", light: "#ffffff" },
      });
      setQrPreview(dataUrl);
    } catch {
      // ignore
    }
  };

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
      const reshapeArabic = isRtl ? (await import("arabic-reshaper")).default : null;
      const rtlText = (text: string) => {
        if (!isRtl || !reshapeArabic) return text;
        try {
          const reshaped = reshapeArabic(text);
          // Reverse for RTL display in jsPDF
          return reshaped.split('').reverse().join('');
        } catch { return text; }
      };
      const data = await fetchReportData(plantId);
      const { plant, journal, health, photos } = data;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Register Arabic font
      if (isRtl) {
        pdf.addFileToVFS("Amiri-Regular.ttf", amiriRegularBase64);
        pdf.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      }

      const setFont = (style: string = "normal") => {
        if (isRtl) {
          pdf.setFont("Amiri", style === "italic" ? "normal" : style);
        } else {
          pdf.setFont("helvetica", style);
        }
      };
      const textAlign = isRtl ? "right" as const : "left" as const;
      const textX = (leftX: number) => isRtl ? pageW - leftX : leftX;

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
      setFont("bold");
      pdf.text("Plantification", isRtl ? pageW - margin : margin, 12, { align: textAlign });
      pdf.setFontSize(10);
      setFont("normal");
      pdf.text(rtlText(t("plantReport")), isRtl ? pageW - margin : margin, 19, { align: textAlign });
      pdf.text(new Date().toLocaleDateString(), isRtl ? margin : pageW - margin, 19, { align: isRtl ? "left" : "right" });

      y = 36;

      // ── Plant hero image ──
      if (plant?.image_url) {
        const imgData = await loadImageAsBase64(plant.image_url);
        if (imgData) {
          checkPage(55);
          const imgW = Math.min(contentW, 80);
          const imgH = imgW * 0.75;
          const imgX = margin + (contentW - imgW) / 2;
          pdf.setFillColor(245, 245, 245);
          pdf.roundedRect(imgX - 2, y - 2, imgW + 4, imgH + 4, 3, 3, "F");
          pdf.addImage(imgData, "JPEG", imgX, y, imgW, imgH);
          y += imgH + 8;
        }
      }

      // ── Plant name ──
      pdf.setTextColor(30, 30, 30);
      pdf.setFontSize(22);
      setFont("bold");
      pdf.text(rtlText(plant?.nickname || plant?.name || plantName), isRtl ? pageW - margin : margin, y, { align: textAlign });
      y += 7;

      if (plant?.scientific_name) {
        pdf.setFontSize(11);
        setFont("italic");
        pdf.setTextColor(120, 120, 120);
        pdf.text(plant.scientific_name, isRtl ? pageW - margin : margin, y, { align: textAlign });
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
        const orderedItems = isRtl ? [...infoItems].reverse() : infoItems;
        orderedItems.forEach(([label, value], i) => {
          const cx = margin + i * cardW;
          pdf.setFillColor(240, 253, 244);
          pdf.roundedRect(cx, y, cardW - 3, 14, 2, 2, "F");
          pdf.setFontSize(7);
          setFont("normal");
          pdf.setTextColor(100, 100, 100);
          const labelX = isRtl ? cx + cardW - 6 : cx + 3;
          pdf.text(rtlText(label), labelX, y + 5, { align: textAlign });
          pdf.setFontSize(9);
          setFont("bold");
          pdf.setTextColor(30, 30, 30);
          pdf.text(rtlText(value), labelX, y + 11, { align: textAlign });
        });
        y += 20;
      }

      // ── Care tips ──
      if (plant?.care_tips) {
        checkPage(30);
        pdf.setFillColor(254, 249, 195);
        const tipsText = rtlText(plant.care_tips);
        const tipLines = pdf.splitTextToSize(tipsText, contentW - 10);
        const tipH = tipLines.length * 4.5 + 12;
        pdf.roundedRect(margin, y, contentW, tipH, 2, 2, "F");
        pdf.setFontSize(9);
        setFont("bold");
        pdf.setTextColor(120, 100, 0);
        const tipLabelText = rtlText(t("careTipsLabel").replace(/[^\w\s\u0600-\u06FF]/g, "").trim());
        const tipTextX = isRtl ? pageW - margin - 5 : margin + 5;
        pdf.text(tipLabelText, tipTextX, y + 6, { align: textAlign });
        setFont("normal");
        pdf.setTextColor(80, 70, 0);
        pdf.setFontSize(8);
        pdf.text(tipLines, tipTextX, y + 12, { align: textAlign });
        y += tipH + 6;
      }

      // ── Section helper ──
      const sectionTitle = (title: string, color: [number, number, number]) => {
        checkPage(14);
        y += 4;
        pdf.setFillColor(...color);
        const barX = isRtl ? pageW - margin - 3 : margin;
        pdf.rect(barX, y, 3, 8, "F");
        pdf.setFontSize(13);
        setFont("bold");
        pdf.setTextColor(30, 30, 30);
        const titleX = isRtl ? pageW - margin - 6 : margin + 6;
        pdf.text(rtlText(title), titleX, y + 6, { align: textAlign });
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
          setFont("bold");
          pdf.setTextColor(...(isHealthy ? [34, 197, 94] as [number, number, number] : [239, 68, 68] as [number, number, number]));
          const statusText = isHealthy ? "✓ Healthy" : "⚠ Issues";
          const statusX = isRtl ? pageW - margin - 4 : margin + 4;
          pdf.text(rtlText(statusText), statusX, y + 5, { align: textAlign });

          setFont("normal");
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(8);
          const dateStr = new Date(h.created_at).toLocaleDateString();
          const dateX = isRtl ? margin + 4 : pageW - margin - 4;
          pdf.text(dateStr + (h.overall_confidence ? ` (${h.overall_confidence}%)` : ""), dateX, y + 5, { align: isRtl ? "left" : "right" });

          diseases.forEach((d: any, i: number) => {
            pdf.setTextColor(80, 80, 80);
            const diseaseX = isRtl ? pageW - margin - 6 : margin + 6;
            pdf.text(rtlText(`• ${(d.name || "").replace(/_/g, " ")}`), diseaseX, y + 10 + i * 4, { align: textAlign });
          });

          y += 14 + diseases.length * 4;
        }
      }

      // ── Care Journal ──
      if (journal.length > 0) {
        sectionTitle(`${t("careJournal")} (${journal.length})`, [59, 130, 246]);

        for (const j of journal) {
          const mood = j.mood || "stable";
          const obsText = j.observation ? rtlText(j.observation) : "";
          const obsLines = obsText ? pdf.splitTextToSize(obsText, contentW - 14) : [];
          const entryH = 12 + obsLines.length * 4 + (j.image_url ? 28 : 0);
          checkPage(entryH);

          pdf.setFillColor(248, 250, 252);
          pdf.roundedRect(margin, y, contentW, entryH, 2, 2, "F");

          // Mood color bar
          const mColor = MOOD_COLORS[mood] || [59, 130, 246];
          pdf.setFillColor(...mColor);
          const moodBarX = isRtl ? pageW - margin - 3 : margin;
          pdf.rect(moodBarX, y, 3, entryH, "F");

          pdf.setFontSize(9);
          setFont("bold");
          pdf.setTextColor(...mColor);
          const moodTextX = isRtl ? pageW - margin - 6 : margin + 6;
          pdf.text(rtlText(MOODS[mood] || mood), moodTextX, y + 5, { align: textAlign });

          setFont("normal");
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(8);
          const jDateX = isRtl ? margin + 4 : pageW - margin - 4;
          pdf.text(new Date(j.entry_date).toLocaleDateString(), jDateX, y + 5, { align: isRtl ? "left" : "right" });

          if (obsLines.length > 0) {
            pdf.setTextColor(60, 60, 60);
            pdf.text(obsLines, moodTextX, y + 11, { align: textAlign });
          }

          if (j.image_url) {
            const jImg = await loadImageAsBase64(j.image_url);
            if (jImg) {
              const imgY = y + 10 + obsLines.length * 4;
              const imgJX = isRtl ? pageW - margin - 28 : margin + 6;
              pdf.addImage(jImg, "JPEG", imgJX, imgY, 22, 22);
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

          const actualCol = isRtl ? (photosPerRow - 1 - col) : col;
          const px = margin + actualCol * (photoSize + 4);
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

      // ── QR Code ──
      const plantUrl = `${window.location.origin}/plant/${plantId}`;
      try {
        const qrDataUrl = await QRCode.toDataURL(plantUrl, { width: 200, margin: 1, color: { dark: "#1e1e1e", light: "#ffffff" } });
        checkPage(40);
        y += 4;
        const qrSize = 30;
        const qrX = margin + (contentW - qrSize) / 2;
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(qrX - 3, y - 2, qrSize + 6, qrSize + 12, 2, 2, "F");
        pdf.addImage(qrDataUrl, "PNG", qrX, y, qrSize, qrSize);
        pdf.setFontSize(7);
        setFont("normal");
        pdf.setTextColor(120, 120, 120);
        pdf.text(rtlText(t("scanToView") || "Scan to view plant"), margin + contentW / 2, y + qrSize + 4, { align: "center" });
        y += qrSize + 14;
      } catch (e) {
        console.warn("QR code generation failed:", e);
      }

      // ── Footer ──
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(7);
        setFont("normal");
        pdf.setTextColor(150, 150, 150);
        const footerText = rtlText(`${t("generatedBy")} Plantification • ${new Date().toLocaleDateString()}`);
        pdf.text(footerText, isRtl ? pageW - margin : margin, pageH - 6, { align: textAlign });
        pdf.text(`${p} / ${totalPages}`, isRtl ? margin : pageW - margin, pageH - 6, { align: isRtl ? "left" : "right" });
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
          onClick={openPreview}
          disabled={pdfGenerating || generating}
          className="h-8 rounded-lg gap-1.5 text-xs"
        >
          <Eye className="w-3.5 h-3.5" />
          {((t as any)("exportPreview")) || "Preview"}
        </Button>
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">{((t as any)("exportPreview")) || "Export preview"}</DialogTitle>
          </DialogHeader>
          <div
            className="mx-auto bg-white text-black rounded-lg shadow-md overflow-hidden border border-border"
            style={{ width: "100%", aspectRatio: "0.707" }}
          >
            <div className="bg-[hsl(142,71%,45%)] h-8 flex items-center px-3">
              <span className="text-white text-[10px] font-bold">Plantification</span>
              <span className="ml-auto text-white/80 text-[8px]">{t("plantReport")}</span>
            </div>
            <div className="p-3 flex flex-col h-[calc(100%-2rem)]">
              <div className="flex-1 space-y-2">
                <div className="h-12 bg-gray-100 rounded" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
                <div className="h-2 bg-gray-100 rounded w-1/3" />
                <div className="grid grid-cols-3 gap-1 mt-2">
                  <div className="h-6 bg-green-50 rounded" />
                  <div className="h-6 bg-green-50 rounded" />
                  <div className="h-6 bg-green-50 rounded" />
                </div>
                <div className="space-y-1 mt-2">
                  <div className="h-1.5 bg-gray-200 rounded" />
                  <div className="h-1.5 bg-gray-200 rounded w-5/6" />
                  <div className="h-1.5 bg-gray-200 rounded w-4/6" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 pt-2 border-t border-gray-100">
                {qrPreview ? (
                  <img src={qrPreview} alt="QR preview" className="w-14 h-14" />
                ) : (
                  <div className="w-14 h-14 bg-gray-100 rounded animate-pulse" />
                )}
                <span className="text-[7px] text-gray-500">{t("scanToView") || "Scan to view plant"}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {((t as any)("qrAtBottom")) || "The QR code appears centered at the bottom of the report."}
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)} className="rounded-lg">
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => { setPreviewOpen(false); handlePdfExport(); }}
              disabled={pdfGenerating}
              className="rounded-lg gap-1.5"
            >
              {pdfGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {t("exportPdf")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
