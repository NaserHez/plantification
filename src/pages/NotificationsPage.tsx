import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Droplets, BellOff, Bell, BellRing, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useWateringReminders } from "@/hooks/use-watering-reminders";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [plants, setPlants] = useState<any[]>([]);
  const [wateringIds, setWateringIds] = useState<Set<string>>(new Set());
  const [wateringAll, setWateringAll] = useState(false);

  const fetchPlants = async () => {
    const { data } = await supabase
      .from("plants")
      .select("id, name, nickname, watering_frequency, last_watered")
      .order("created_at", { ascending: false });
    setPlants(data || []);
  };

  useEffect(() => { fetchPlants(); }, []);

  const { overdue, permissionGranted, requestPermission } = useWateringReminders(plants);

  const handleMarkWatered = async (e: React.MouseEvent, plantId: string, plantName: string) => {
    e.stopPropagation();
    setWateringIds((prev) => new Set(prev).add(plantId));
    const { error } = await supabase
      .from("plants")
      .update({ last_watered: new Date().toISOString() })
      .eq("id", plantId);
    if (error) {
      setWateringIds((prev) => { const n = new Set(prev); n.delete(plantId); return n; });
      return;
    }
    toast({ title: t("watered"), description: plantName });
    await fetchPlants();
    setWateringIds((prev) => { const n = new Set(prev); n.delete(plantId); return n; });
  };

  const handleWaterAll = async () => {
    if (overdue.length === 0) return;
    setWateringAll(true);
    const ids = overdue.map((p) => p.id);
    const now = new Date().toISOString();
    for (const id of ids) {
      await supabase.from("plants").update({ last_watered: now }).eq("id", id);
    }
    toast({ title: t("watered"), description: `${ids.length} ${ids.length > 1 ? t("plants") : t("plant")}` });
    await fetchPlants();
    setWateringAll(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-serif">{t("notifications")}</h1>
      </div>

      <div className="px-4 max-w-md mx-auto mt-2 space-y-4">
        {/* Notification permission banner */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shrink-0">
            {permissionGranted ? (
              <BellRing className="w-5 h-5 text-primary" />
            ) : (
              <BellOff className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {permissionGranted ? t("notifEnabled") : t("notifDisabled")}
            </p>
          </div>
          {!permissionGranted && (
            <Button size="sm" onClick={requestPermission} className="rounded-xl shrink-0">
              <Bell className="w-4 h-4 mr-1" />
              {t("enableNotifications")}
            </Button>
          )}
        </motion.div>

        {/* Overdue plants list */}
        {overdue.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
              <BellOff className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-lg mb-1">{t("noNotifications")}</h2>
            <p className="text-sm text-muted-foreground">{t("noNotificationsDesc")}</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-sm text-muted-foreground flex items-center gap-2">
                <Droplets className="w-4 h-4 text-water" />
                {t("wateringAlerts")}
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={handleWaterAll}
                disabled={wateringAll}
                className="rounded-xl gap-1.5 text-xs border-water/30 text-water hover:bg-water/10 hover:text-water"
              >
                <Droplets className={`w-3.5 h-3.5 ${wateringAll ? "animate-pulse" : ""}`} />
                {t("waterAll")}
              </Button>
            </div>
            <AnimatePresence>
              {overdue.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  exit={{ opacity: 0, x: -40, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2"
                >
                  <button
                    onClick={() => navigate(`/plant/${p.id}`)}
                    className="flex-1 flex items-center justify-between p-4 rounded-2xl bg-water/10 border border-water/20 text-left hover:bg-water/15 transition-colors"
                  >
                    <span className="font-medium text-sm truncate">{p.nickname || p.name}</span>
                    <span className="text-xs text-water font-medium ml-2 whitespace-nowrap">
                      {p.daysOverdue === 0 ? t("dueToday") : `${p.daysOverdue}${t("daysOverdue")}`}
                    </span>
                  </button>
                  <button
                    onClick={(e) => handleMarkWatered(e, p.id, p.nickname || p.name)}
                    disabled={wateringIds.has(p.id)}
                    className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary transition-colors disabled:opacity-50"
                    title={t("watered")}
                  >
                    <Droplets className={`w-5 h-5 ${wateringIds.has(p.id) ? "animate-pulse" : ""}`} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
