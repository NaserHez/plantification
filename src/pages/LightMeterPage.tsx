import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Sun, Camera, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { useUnits } from "@/hooks/use-units";

// Convert relative brightness to a bucket + rough lux estimate.
// This is a coarse heuristic — mobile browsers don't expose true ISO/exposure,
// so we compare the frame's mean luminance against a device-noise floor.
function luxBucket(mean: number): { label: string; lux: number; tone: string } {
  // mean is 0-255. Rough mapping tuned against phone cameras in various rooms.
  if (mean < 30)  return { label: "Very low",  lux: 50,    tone: "bg-destructive/20 text-destructive" };
  if (mean < 70)  return { label: "Low",       lux: 200,   tone: "bg-cta/20 text-cta" };
  if (mean < 130) return { label: "Medium",    lux: 800,   tone: "bg-sun/25 text-foreground" };
  if (mean < 190) return { label: "Bright",    lux: 2500,  tone: "bg-primary/15 text-primary" };
  return              { label: "Direct sun", lux: 10000, tone: "bg-primary/25 text-primary" };
}

export default function LightMeterPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const plantId = params.get("plant");
  const units = useUnits();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [mean, setMean] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
      tick();
    } catch (e: any) {
      setError(e.message || "Camera not available");
    }
  };

  const tick = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const w = 40, h = 40;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    const m = sum / (data.length / 4);
    setMean(m);
    rafRef.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRunning(false);
  };

  useEffect(() => () => stop(), []);

  const bucket = luxBucket(mean);

  const save = async () => {
    if (!plantId) return;
    const { error } = await supabase
      .from("plants")
      .update({
        last_light_reading: bucket.label,
        last_light_lux: bucket.lux,
        last_light_at: new Date().toISOString(),
      } as any)
      .eq("id", plantId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSaved(true);
    toast.success("Light reading saved");
    setTimeout(() => nav(`/plant/${plantId}`), 900);
  };

  return (
    <div className="min-h-dvh bg-background pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => nav(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-serif flex items-center gap-2">
          <Sun className="w-5 h-5 text-sun" /> Light meter
        </h1>
      </div>

      <main className="px-4 max-w-md mx-auto space-y-4">
        <p className="text-sm text-muted-foreground">
          Point the camera where your plant sits. Hold steady for a few seconds while we sample the light.
        </p>

        <div className="rounded-2xl overflow-hidden border border-border bg-black aspect-video relative">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          {!running && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm">
              Tap start to enable the camera
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {running && (
          <div className={`rounded-2xl p-4 border border-border ${bucket.tone}`} role="status" aria-live="polite">
            <div className="text-xs uppercase tracking-wide opacity-70">Reading</div>
            <div className="text-2xl font-serif">{bucket.label}</div>
            <div className="text-xs opacity-80">
              {units === "imperial"
                ? `~${Math.round(bucket.lux / 10.764).toLocaleString()} fc`
                : `~${bucket.lux.toLocaleString()} lux`}
              {" · mean "}{Math.round(mean)}/255
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!running ? (
            <Button onClick={start} variant="cta" className="flex-1 rounded-xl h-11 gap-2">
              <Camera className="w-4 h-4" /> Start measuring
            </Button>
          ) : (
            <Button onClick={stop} variant="outline" className="flex-1 rounded-xl h-11">Stop</Button>
          )}
          {plantId && running && (
            <Button onClick={save} className="flex-1 rounded-xl h-11 gap-2">
              {saved ? <CheckCircle2 className="w-4 h-4" /> : null}
              Save to plant
            </Button>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
