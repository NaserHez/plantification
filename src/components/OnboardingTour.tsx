import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const STEPS = [
  { title: "Welcome to Plantification 🌿", body: "Let's take a quick tour of the essentials — 30 seconds." },
  { title: "Identify any plant", body: "Tap Identify in the bottom bar and snap a photo. We'll match the species and set a care plan." },
  { title: "Your garden", body: "Every plant lives in Garden. Tap a card to edit care schedules, log watering, or add photos." },
  { title: "Reminders", body: "You'll get push notifications when a plant needs care. Manage timing in Settings." },
];

const LOCAL_KEY = "onboarding_done_v1";

export default function OnboardingTour({ forceOpen = false, onClose }: { forceOpen?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) { setOpen(true); setStep(0); return; }
    if (localStorage.getItem(LOCAL_KEY)) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("onboarded_at" as any)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data || !(data as any).onboarded_at) setOpen(true);
    })();
  }, [forceOpen]);

  const finish = async () => {
    setOpen(false);
    localStorage.setItem(LOCAL_KEY, "1");
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles")
        .update({ onboarded_at: new Date().toISOString() } as any)
        .eq("user_id", user.id);
    }
    onClose?.();
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else finish();
  };

  if (!open) return null;
  const current = STEPS[step];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-foreground/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-labelledby="tour-title"
        aria-modal="true"
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="w-full max-w-sm bg-card rounded-3xl p-5 border border-border shadow-xl"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <h2 id="tour-title" className="font-serif text-xl">{current.title}</h2>
            <button onClick={finish} className="p-1 rounded-lg hover:bg-muted" aria-label="Skip tour">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.body}</p>

          <div className="flex items-center justify-between mt-5">
            <div className="flex gap-1" aria-hidden>
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"}`} />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={finish} className="rounded-xl">Skip</Button>
              <Button size="sm" onClick={next} className="rounded-xl gap-1">
                {step === STEPS.length - 1 ? "Done" : "Next"}
                {step < STEPS.length - 1 && <ArrowRight className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
