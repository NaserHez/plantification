import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Camera, Upload, X, Loader2, ShieldCheck, ShieldAlert, Stethoscope, Droplets, Sun, Leaf, Heart, AlertTriangle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/supabase-helpers";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";

interface Disease {
  name: string;
  probability: number;
  description?: string | null;
  cause?: string | null;
  treatment?: string | null;
  chemicalTreatment?: string | null;
  prevention?: string | null;
  similarImages?: { url: string; similarity: number }[];
}

interface CareRecommendations {
  watering?: { frequency?: string; amount?: string; tips?: string };
  sunlight?: string;
  nutrients?: string;
  preventiveCare?: string;
  urgentActions?: string | null;
  seasonalAdvice?: string;
}

interface HealthResult {
  isHealthy: boolean;
  overallConfidence?: number;
  diseases: Disease[];
  careRecommendations?: CareRecommendations | null;
}

export default function DiagnosisPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get("plantId");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [plants, setPlants] = useState<any[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState(preselectedId || "");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HealthResult | null>(null);

  useEffect(() => {
    const fetchPlants = async () => {
      const { data } = await supabase
        .from("plants")
        .select("id, name, nickname")
        .order("created_at", { ascending: false });
      setPlants(data || []);
    };
    fetchPlants();
  }, []);

  const openCamera = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.click();
    }
  }, []);

  const openFilePicker = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute("capture");
      fileInputRef.current.click();
    }
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setCapturedImage(compressed);
      setResult(null);
    } catch {
      toast.error("Failed to process image");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleDiagnose = async () => {
    if (!capturedImage) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("diagnose-plant", {
        body: { image: capturedImage },
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err: any) {
      toast.error(err.message || "Diagnosis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-serif">{t("healthCheck")}</h1>
      </div>

      <div className="px-4 max-w-md mx-auto space-y-4">
        {plants.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">{t("selectPlant")}</label>
            <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={t("choosePlant")} />
              </SelectTrigger>
              <SelectContent>
                {plants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nickname || p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <AnimatePresence mode="wait">
          {capturedImage ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full aspect-square rounded-2xl overflow-hidden border-2 border-primary/30"
            >
              <img src={capturedImage} alt="Plant" className="w-full h-full object-cover" />
              <button
                onClick={() => { setCapturedImage(null); setResult(null); }}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-foreground/60 text-background backdrop-blur-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full aspect-square rounded-2xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
                <Stethoscope className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center px-8">{t("takePhotoHealth")}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

        <div className="flex gap-3 w-full">
          {capturedImage ? (
            <Button onClick={handleDiagnose} disabled={loading} className="flex-1 h-12 rounded-xl text-base gap-2">
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {t("diagnosing")}</>
              ) : (
                <><Stethoscope className="w-5 h-5" /> {t("diagnoseBtn")}</>
              )}
            </Button>
          ) : (
            <>
              <Button onClick={openCamera} variant="outline" className="flex-1 h-12 rounded-xl text-base gap-2">
                <Camera className="w-5 h-5" /> {t("camera")}
              </Button>
              <Button onClick={openFilePicker} variant="outline" className="flex-1 h-12 rounded-xl text-base gap-2">
                <Upload className="w-5 h-5" /> {t("upload")}
              </Button>
            </>
          )}
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Health status header */}
              <div className={`p-5 rounded-2xl border border-border ${result.isHealthy ? "bg-primary/5" : "bg-destructive/5"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {result.isHealthy ? (
                    <ShieldCheck className="w-6 h-6 text-primary" />
                  ) : (
                    <ShieldAlert className="w-6 h-6 text-destructive" />
                  )}
                  <h2 className="font-serif text-lg">
                    {result.isHealthy ? t("plantLooksHealthy") : t("issuesDetected")}
                  </h2>
                </div>
                {result.overallConfidence != null && (
                  <p className="text-xs text-muted-foreground ml-8">
                    {t("confidence")}: {result.overallConfidence}%
                  </p>
                )}
              </div>

              {/* Urgent actions */}
              {result.careRecommendations?.urgentActions && (
                <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    <span className="font-medium text-sm">{t("urgentActions")}</span>
                  </div>
                  <p className="text-sm text-foreground">{result.careRecommendations.urgentActions}</p>
                </div>
              )}

              {/* Diseases */}
              {result.diseases.length > 0 && (
                <div className="space-y-3">
                  {result.diseases.map((d, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-card border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm capitalize">{d.name.replace(/_/g, " ")}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          d.probability >= 70 ? "bg-destructive/15 text-destructive" :
                          d.probability >= 40 ? "bg-yellow-500/15 text-yellow-600" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {d.probability}%
                        </span>
                      </div>
                      {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                      {d.cause && <p className="text-xs text-muted-foreground">🔍 <strong>Cause:</strong> {d.cause}</p>}
                      {d.treatment && <p className="text-xs text-primary">🌿 <strong>Bio treatment:</strong> {d.treatment}</p>}
                      {d.chemicalTreatment && <p className="text-xs text-muted-foreground">💊 <strong>Chemical:</strong> {d.chemicalTreatment}</p>}
                      {d.prevention && <p className="text-xs text-muted-foreground">🛡️ <strong>Prevention:</strong> {d.prevention}</p>}
                      {d.similarImages && d.similarImages.length > 0 && (
                        <div className="flex gap-2 mt-1">
                          {d.similarImages.map((img, j) => (
                            <img key={j} src={img.url} alt="Similar" className="w-16 h-16 rounded-lg object-cover border border-border" />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {result.diseases.length === 0 && (
                <p className="text-sm text-muted-foreground text-center">{t("noIssues")}</p>
              )}

              {/* Care recommendations */}
              {result.careRecommendations && (
                <div className="space-y-3">
                  <h3 className="font-serif text-base flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-primary" /> {t("careRecommendations")}
                  </h3>

                  {result.careRecommendations.watering && (
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <span className="font-medium text-sm">{t("watering")}</span>
                      </div>
                      {result.careRecommendations.watering.frequency && (
                        <p className="text-xs text-muted-foreground">📅 {result.careRecommendations.watering.frequency}</p>
                      )}
                      {result.careRecommendations.watering.amount && (
                        <p className="text-xs text-muted-foreground">💧 {result.careRecommendations.watering.amount}</p>
                      )}
                      {result.careRecommendations.watering.tips && (
                        <p className="text-xs text-primary mt-1">💡 {result.careRecommendations.watering.tips}</p>
                      )}
                    </div>
                  )}

                  {result.careRecommendations.sunlight && (
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sun className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium text-sm">{t("sunlight")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{result.careRecommendations.sunlight}</p>
                    </div>
                  )}

                  {result.careRecommendations.nutrients && (
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Leaf className="w-4 h-4 text-green-500" />
                        <span className="font-medium text-sm">{t("nutrients")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{result.careRecommendations.nutrients}</p>
                    </div>
                  )}

                  {result.careRecommendations.preventiveCare && (
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">{t("preventiveCare")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{result.careRecommendations.preventiveCare}</p>
                    </div>
                  )}

                  {result.careRecommendations.seasonalAdvice && (
                    <div className="p-3 rounded-xl bg-card border border-border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <span className="font-medium text-sm">{t("seasonalAdvice")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{result.careRecommendations.seasonalAdvice}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
}
