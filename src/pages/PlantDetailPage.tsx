import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Droplets, Sun, MapPin, Trash2, Loader2, Stethoscope, Globe, RefreshCw, Bot, Home, Eye, Camera, SunMedium } from "lucide-react";
import CareSchedulePanel from "@/components/CareSchedulePanel";
import PlantGallery from "@/components/PlantGallery";
import { uploadPlantImage, compressImage } from "@/lib/supabase-helpers";
import HealthTimeline from "@/components/HealthTimeline";
import PlantJournal from "@/components/PlantJournal";
import PlantReportExport from "@/components/PlantReportExport";
import SignedImage from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { regenerateCareTips } from "@/lib/supabase-helpers";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

const LANGUAGES = [
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
];

export default function PlantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [plant, setPlant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [tipsLanguage, setTipsLanguage] = useState(localStorage.getItem("plant_language") || "en");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleChangePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const compressed = await compressImage(file);
      const resp = await fetch(compressed);
      const blob = await resp.blob();
      const safeName = (plant?.name || "plant").replace(/[^a-zA-Z0-9-_]/g, "-");
      const ref = await uploadPlantImage(user.id, blob, `${safeName}.jpg`);
      const { error } = await supabase.from("plants").update({ image_url: ref }).eq("id", id);
      if (error) throw error;
      setPlant((p: any) => ({ ...p, image_url: ref }));
      toast.success("Photo updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update photo");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("plants").select("*").eq("id", id).single();
      setPlant(data);
      setLoading(false);
    };
    if (id) fetch();
  }, [id]);

  const handleUpdate = async (field: string, value: string) => {
    setPlant((p: any) => ({ ...p, [field]: value }));
    const { error } = await supabase.from("plants").update({ [field]: value }).eq("id", id);
    if (error) toast.error("Failed to update");
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("plants").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success(t("plantRemoved"));
      navigate("/garden");
    }
  };

  const handleWater = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    await supabase.from("plants").update({ last_watered: now }).eq("id", id);
    setPlant((p: any) => ({ ...p, last_watered: now }));
    // Best-effort streak update — ignore errors.
    (supabase as any).rpc("record_care_action", { _plant: id }).then(() => {});
    toast.success(t("watered"));
    setSaving(false);
  };

  const handleRegenerateTips = async () => {
    if (!plant) return;
    setRegenerating(true);
    try {
      const newTips = await regenerateCareTips(plant.name, tipsLanguage);
      await supabase.from("plants").update({ care_tips: newTips }).eq("id", id);
      setPlant((p: any) => ({ ...p, care_tips: newTips }));
      toast.success(t("careTipsUpdated"));
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate tips");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!plant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p>{t("pageNotFound")}</p>
        <Button onClick={() => navigate("/garden")}>{t("back")}</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="relative h-64 bg-muted">
        {plant.image_url ? (
          <SignedImage src={plant.image_url} alt={plant.name} className="w-full h-full object-cover" fallback={<div className="w-full h-full flex items-center justify-center text-5xl">🌿</div>} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🌿</div>
        )}
      <div className="absolute top-4 left-4 flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-full bg-background/70 backdrop-blur-sm"
          >
            <Home className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-background/70 backdrop-blur-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        {plant.confidence && (
          <span className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium bg-primary/80 text-primary-foreground backdrop-blur-sm">
            {plant.confidence}% {t("match")}
          </span>
        )}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChangePhoto}
          className="hidden"
        />
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={uploadingPhoto}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-background/80 backdrop-blur-sm border border-border hover:bg-background disabled:opacity-60"
          title="Change photo"
        >
          {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          {uploadingPhoto ? "Uploading…" : "Change photo"}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 -mt-6 relative"
      >
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <h1 className="font-serif text-2xl">{plant.nickname || plant.name}</h1>
          {plant.scientific_name && (
            <p className="text-sm text-muted-foreground italic">{plant.scientific_name}</p>
          )}
          {plant.nickname && plant.nickname !== plant.name && (
            <p className="text-xs text-muted-foreground">Species: {plant.name}</p>
          )}

          <div className="flex gap-2 mt-4">
            <Button onClick={handleWater} disabled={saving} variant="outline" className="flex-1 h-10 rounded-xl gap-2 text-water border-water/30">
              <Droplets className="w-4 h-4" />
              {t("water")}
            </Button>
            <Button
              onClick={() => navigate(`/diagnose?plantId=${id}`)}
              variant="outline"
              className="flex-1 h-10 rounded-xl gap-2 text-bloom border-bloom/30"
            >
              <Stethoscope className="w-4 h-4" />
              {t("healthCheckBtn")}
            </Button>
            <Button
              onClick={() => navigate(`/chat?plant=${encodeURIComponent(plant.nickname || plant.name)}`)}
              variant="outline"
              className="flex-1 h-10 rounded-xl gap-2 text-primary border-primary/30"
            >
              <Bot className="w-4 h-4" />
              {t("askAi")}
            </Button>
          </div>

          {plant.last_watered && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{t("lastWatered")} {new Date(plant.last_watered).toLocaleDateString()}</span>
              <span className="text-primary font-medium">
                {t("nextWatering")} {(() => {
                  const freqDays: Record<string, number> = { daily: 1, "every-2-days": 2, weekly: 7, biweekly: 14, monthly: 30 };
                  const days = freqDays[plant.watering_frequency || "weekly"] || 7;
                  const next = new Date(new Date(plant.last_watered).getTime() + days * 86400000);
                  return next.toLocaleDateString();
                })()}
              </span>
            </div>
          )}

          <div className="space-y-4 mt-6">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Sun className="w-3.5 h-3.5 text-sun" /> {t("sunlightLabel")}
              </Label>
              <Select value={plant.sunlight || "medium"} onValueChange={(v) => handleUpdate("sunlight", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("lowLight")}</SelectItem>
                  <SelectItem value="medium">{t("mediumLight")}</SelectItem>
                  <SelectItem value="high">{t("brightDirect")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Droplets className="w-3.5 h-3.5 text-water" /> {t("wateringLabel")}
              </Label>
              <Select value={plant.watering_frequency || "weekly"} onValueChange={(v) => handleUpdate("watering_frequency", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t("daily")}</SelectItem>
                  <SelectItem value="every-2-days">{t("every2Days")}</SelectItem>
                  <SelectItem value="weekly">{t("weekly")}</SelectItem>
                  <SelectItem value="biweekly">{t("biweekly")}</SelectItem>
                  <SelectItem value="monthly">{t("monthly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <MapPin className="w-3.5 h-3.5 text-bloom" /> {t("locationLabel")}
              </Label>
              <Select value={plant.location || "indoor"} onValueChange={(v) => handleUpdate("location", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indoor">{t("indoor").replace(/^[^\s]+\s/, "")}</SelectItem>
                  <SelectItem value="outdoor">{t("outdoor").replace(/^[^\s]+\s/, "")}</SelectItem>
                  <SelectItem value="balcony">{t("balcony").replace(/^[^\s]+\s/, "")}</SelectItem>
                  <SelectItem value="windowsill">{t("windowsill").replace(/^[^\s]+\s/, "")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 rounded-xl bg-accent/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground font-medium">{t("careTipsLabel")}</Label>
                <div className="flex items-center gap-1.5">
                  <Select value={tipsLanguage} onValueChange={setTipsLanguage}>
                    <SelectTrigger className="h-7 w-24 rounded-lg text-xs border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          <span className="flex items-center gap-1">{l.flag} {l.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleRegenerateTips}
                    disabled={regenerating}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                  >
                    {regenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              {plant.care_tips ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{plant.care_tips}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">{t("noCareTips")}</p>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">{t("nickname")}</Label>
              <Input
                value={plant.nickname || ""}
                onChange={(e) => handleUpdate("nickname", e.target.value)}
                placeholder={t("giveNickname")}
                className="rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">{t("notes")}</Label>
              <Textarea
                value={plant.notes || ""}
                onChange={(e) => handleUpdate("notes", e.target.value)}
                placeholder={t("addNotes")}
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>
          </div>

          {id && (
            <div className="mt-6 space-y-4">
              <CareSchedulePanel plantId={id} wateringFrequency={plant.watering_frequency} />
              <Button
                onClick={() => navigate(`/light-meter?plant=${id}`)}
                variant="outline"
                className="w-full rounded-xl h-10 gap-2"
              >
                <SunMedium className="w-4 h-4 text-sun" />
                {plant.last_light_reading ? `Light: ${plant.last_light_reading} — measure again` : "Measure light with camera"}
              </Button>
            </div>
          )}

          {id && <PlantGallery plantId={id} />}
          
          {/* Health History Timeline */}
          {id && <HealthTimeline plantId={id} />}

          {/* Care Journal */}
          {id && <PlantJournal plantId={id} />}

          {/* Share & Export */}
          {id && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between bg-card rounded-xl border border-border/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{t("makePublic")}</span>
                </div>
                <button
                  onClick={async () => {
                    const newVal = !plant.is_public;
                    await supabase.from("plants").update({ is_public: newVal }).eq("id", id);
                    setPlant({ ...plant, is_public: newVal });
                    toast.success(newVal ? "Plant is now public" : "Plant is now private");
                  }}
                  className={`w-10 h-6 rounded-full transition-colors ${plant.is_public ? "bg-primary" : "bg-muted"} relative`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-transform ${plant.is_public ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
              <PlantReportExport plantId={id} plantName={plant.nickname || plant.name} />
            </div>
          )}

          <Button onClick={handleDelete} variant="outline" className="w-full mt-6 h-10 rounded-xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" />
            {t("removePlant")}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
