import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Camera, Upload, X, Loader2, ShieldCheck, ShieldAlert, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/supabase-helpers";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

interface Disease {
  name: string;
  probability: number;
  description?: string | null;
  treatment?: string | null;
}

interface HealthResult {
  isHealthy: boolean;
  diseases: Disease[];
}

export default function DiagnosisPage() {
  const navigate = useNavigate();
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
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-serif">Health Check</h1>
      </div>

      <div className="px-4 max-w-md mx-auto space-y-4">
        {/* Plant selector */}
        {plants.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Select a plant (optional)</label>
            <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Choose a plant..." />
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

        {/* Image capture */}
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
              <p className="text-sm text-muted-foreground text-center px-8">
                Take a photo of your plant to check its health
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

        <div className="flex gap-3 w-full">
          {capturedImage ? (
            <Button onClick={handleDiagnose} disabled={loading} className="flex-1 h-12 rounded-xl text-base gap-2">
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Diagnosing...</>
              ) : (
                <><Stethoscope className="w-5 h-5" /> Diagnose</>
              )}
            </Button>
          ) : (
            <>
              <Button onClick={openCamera} variant="outline" className="flex-1 h-12 rounded-xl text-base gap-2">
                <Camera className="w-5 h-5" /> Camera
              </Button>
              <Button onClick={openFilePicker} variant="outline" className="flex-1 h-12 rounded-xl text-base gap-2">
                <Upload className="w-5 h-5" /> Upload
              </Button>
            </>
          )}
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`p-5 rounded-2xl border border-border ${result.isHealthy ? "bg-primary/5" : "bg-destructive/5"}`}
            >
              <div className="flex items-center gap-2 mb-3">
                {result.isHealthy ? (
                  <ShieldCheck className="w-6 h-6 text-primary" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-destructive" />
                )}
                <h2 className="font-serif text-lg">
                  {result.isHealthy ? "Plant looks healthy!" : "Issues detected"}
                </h2>
              </div>

              {result.diseases.length > 0 ? (
                <div className="space-y-3">
                  {result.diseases.map((d, i) => (
                    <div key={i} className="p-3 rounded-xl bg-card border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm capitalize">{d.name.replace(/_/g, " ")}</span>
                        <span className="text-xs text-muted-foreground">{d.probability}%</span>
                      </div>
                      {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                      {d.treatment && <p className="text-xs text-primary mt-1">💊 {d.treatment}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No issues found. Keep up the good care!</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
}
