import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Lightbulb, ShieldAlert, ShieldCheck, Activity, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import CameraCapture from "@/components/CameraCapture";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { uploadPlantImage } from "@/lib/supabase-helpers";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

interface Alternative {
  name: string;
  scientificName: string;
  commonNames?: string[];
  probability: number;
}

interface Diagnostics {
  plantIdStatus?: number;
  plantIdMs?: number;
  aiMs?: number;
  aiUsed?: boolean;
  aiBoosted?: boolean;
  aiAgreement?: boolean;
  ambiguous?: boolean;
  cached?: boolean;
  clientCache?: boolean;
  totalMs?: number;
}

interface IdentificationResult {
  name: string;
  scientificName: string;
  confidence: number;
  rawConfidence?: number;
  commonNames?: string[];
  alternatives?: Alternative[];
  similarImages?: string[];
  careTips?: string;
  verifiedByAI?: boolean;
  diagnostics?: Diagnostics;
  healthAssessment?: {
    isHealthy: boolean;
    diseases: Array<{
      name: string;
      probability: number;
      description?: string;
      treatment?: string;
    }>;
  };
  isMock: boolean;
}

export default function IdentifyPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [result, setResult] = useState<IdentificationResult | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nickname, setNickname] = useState("");

  const handleResult = (res: IdentificationResult, img: string) => {
    setResult(res);
    setImageBase64(img);
    setNickname(res.name);
  };

  const handleSave = async () => {
    if (!result || !imageBase64) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const response = await fetch(imageBase64);
      const blob = await response.blob();
      const safeName = result.name.replace(/[^a-zA-Z0-9-_]/g, '-');
      const imageUrl = await uploadPlantImage(user.id, blob, `${safeName}.jpg`);

      const { error } = await supabase.from('plants').insert({
        user_id: user.id,
        name: result.name,
        nickname: nickname || result.name,
        scientific_name: result.scientificName,
        confidence: result.confidence,
        image_url: imageUrl,
        care_tips: result.careTips || null,
      });

      if (error) throw error;
      toast.success(`${nickname || result.name} ${t("addedToGarden")}`);
      navigate("/garden");
    } catch (err: any) {
      toast.error(err.message || "Failed to save plant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-serif">{t("identifyPageTitle")}</h1>
      </div>

      <div className="px-4 max-w-md mx-auto">
        <CameraCapture onResult={handleResult} language={localStorage.getItem("app_language") || localStorage.getItem("plant_language") || "en"} />

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-6 bg-card rounded-2xl p-5 border border-border"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-serif text-xl">{result.name}</h2>
                  <p className="text-sm text-muted-foreground italic">{result.scientificName}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {result.confidence}% {t("match")}
                </span>
              </div>

              {result.isMock && (
                <p className="text-xs text-destructive mt-2">{t("mockWarning")}</p>
              )}

              {result.careTips && (
                <div className="mt-4 p-3 rounded-xl bg-accent/50 border border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Lightbulb className="w-4 h-4 text-sun" />
                    <span className="text-xs font-medium">{t("careTips")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{result.careTips}</p>
                </div>
              )}

              {result.healthAssessment && (
                <div className={`mt-4 p-3 rounded-xl border border-border ${result.healthAssessment.isHealthy ? 'bg-primary/5' : 'bg-destructive/5'}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    {result.healthAssessment.isHealthy ? (
                      <ShieldCheck className="w-4 h-4 text-primary" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-xs font-medium">
                      {result.healthAssessment.isHealthy ? t("plantLooksHealthy") : t("potentialIssues")}
                    </span>
                  </div>
                  {result.healthAssessment.diseases.length > 0 && (
                    <div className="space-y-2">
                      {result.healthAssessment.diseases.map((disease, i) => (
                        <div key={i} className="text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium capitalize">{disease.name.replace(/_/g, ' ')}</span>
                            <span className="text-xs text-muted-foreground">{disease.probability}%</span>
                          </div>
                          {disease.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{disease.description}</p>
                          )}
                          {disease.treatment && (
                            <p className="text-xs text-primary mt-0.5">💊 {disease.treatment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {result.similarImages && result.similarImages.length > 0 && (
                <div className="flex gap-2 mt-4 overflow-x-auto">
                  {result.similarImages.map((url, i) => (
                    <img key={i} src={url} alt="Similar" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("giveItAName")}</Label>
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t("nameExample")}
                  className="rounded-xl h-10"
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full mt-4 h-11 rounded-xl gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t("saveToGarden")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
}
