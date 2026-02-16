import { useRef, useState, useCallback } from "react";
import { Camera, Upload, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { compressImage, identifyPlant } from "@/lib/supabase-helpers";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

interface IdentificationResult {
  name: string;
  scientificName: string;
  confidence: number;
  commonNames?: string[];
  similarImages?: string[];
  careTips?: string;
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

interface CameraCaptureProps {
  onResult: (result: IdentificationResult, imageBase64: string) => void;
  language?: string;
}

export default function CameraCapture({ onResult, language = "en" }: CameraCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const openNativeCamera = useCallback(() => {
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

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setCapturedImage(compressed);
    } catch {
      toast.error("Failed to process image");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleIdentify = useCallback(async () => {
    if (!capturedImage) return;
    setLoading(true);
    try {
      const result = await identifyPlant(capturedImage, language);
      onResult(result, capturedImage);
    } catch (err: any) {
      toast.error(err.message || "Identification failed");
    } finally {
      setLoading(false);
    }
  }, [capturedImage, onResult, language]);

  const reset = () => {
    setCapturedImage(null);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <AnimatePresence mode="wait">
        {capturedImage ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden border-2 border-primary/30"
          >
            <img src={capturedImage} alt="Captured plant" className="w-full h-full object-cover" />
            <button
              onClick={reset}
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
            className="w-full max-w-sm aspect-square rounded-2xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
              <Camera className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center px-8">
              {t("takePhotoOrUpload")}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />

      <div className="flex gap-3 w-full max-w-sm">
        {capturedImage ? (
          <Button onClick={handleIdentify} disabled={loading} className="flex-1 h-12 rounded-xl text-base gap-2">
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t("identifying")}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {t("identifyPlantBtn")}
              </>
            )}
          </Button>
        ) : (
          <>
            <Button onClick={openNativeCamera} variant="outline" className="flex-1 h-12 rounded-xl text-base gap-2">
              <Camera className="w-5 h-5" />
              {t("camera")}
            </Button>
            <Button onClick={openFilePicker} variant="outline" className="flex-1 h-12 rounded-xl text-base gap-2">
              <Upload className="w-5 h-5" />
              {t("upload")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
