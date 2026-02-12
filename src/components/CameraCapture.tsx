import { useRef, useState, useCallback } from "react";
import { Camera, Upload, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { compressImage, identifyPlant } from "@/lib/supabase-helpers";
import { toast } from "sonner";

interface IdentificationResult {
  name: string;
  scientificName: string;
  confidence: number;
  commonNames?: string[];
  similarImages?: string[];
  isMock: boolean;
}

interface CameraCaptureProps {
  onResult: (result: IdentificationResult, imageBase64: string) => void;
  language?: string;
}

export default function CameraCapture({ onResult, language = "en" }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamRef, setStreamRef] = useState<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1500 }, height: { ideal: 1500 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamRef(stream);
        setStreaming(true);
      }
    } catch {
      toast.error("Camera access denied. Please use file upload instead.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef?.getTracks().forEach((t) => t.stop());
    setStreamRef(null);
    setStreaming(false);
  }, [streamRef]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    const v = videoRef.current;
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setCapturedImage(compressed);
    } catch {
      toast.error("Failed to process image");
    }
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
    stopCamera();
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
        ) : streaming ? (
          <motion.div
            key="video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden border-2 border-primary/30"
          >
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
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
              Take a photo or upload an image to identify your plant
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />

      <div className="flex gap-3 w-full max-w-sm">
        {capturedImage ? (
          <Button onClick={handleIdentify} disabled={loading} className="flex-1 h-12 rounded-xl text-base gap-2">
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Identifying...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Identify Plant
              </>
            )}
          </Button>
        ) : streaming ? (
          <Button onClick={capturePhoto} className="flex-1 h-12 rounded-xl text-base gap-2">
            <Camera className="w-5 h-5" />
            Capture
          </Button>
        ) : (
          <>
            <Button onClick={startCamera} variant="outline" className="flex-1 h-12 rounded-xl text-base gap-2">
              <Camera className="w-5 h-5" />
              Camera
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-1 h-12 rounded-xl text-base gap-2">
              <Upload className="w-5 h-5" />
              Upload
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
