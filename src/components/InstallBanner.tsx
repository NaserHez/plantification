import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const translations = {
  en: { title: "Install Plantification", description: "Add to your home screen for quick access", install: "Install" },
  ar: { title: "تثبيت Plantification", description: "أضفه إلى شاشتك الرئيسية للوصول السريع", install: "تثبيت" },
  "pt-PT": { title: "Instalar Plantification", description: "Adicione ao ecrã inicial para acesso rápido", install: "Instalar" },
};

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  useEffect(() => {
    if (localStorage.getItem("pwa-banner-dismissed")) { setDismissed(true); return; }
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
    setDismissed(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-banner-dismissed", "1");
  };

  if (dismissed || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl border border-border bg-card p-4 shadow-lg"
      >
        <button onClick={handleDismiss} className="absolute top-3 right-3 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{t.title}</p>
            <p className="text-xs text-muted-foreground">{t.description}</p>
          </div>
          <button onClick={handleInstall} className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            {t.install}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
