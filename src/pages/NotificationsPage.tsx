import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Droplets, BellOff, Bell, BellRing, CalendarClock, MapPin, List as ListIcon } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useWateringReminders } from "@/hooks/use-watering-reminders";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PlantWithSchedule {
  id: string;
  name: string;
  nickname?: string | null;
  watering_frequency?: string | null;
  last_watered?: string | null;
  image_url?: string | null;
  location?: string | null;
}

const frequencyToDays: Record<string, number> = {
  daily: 1,
  "every-2-days": 2,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

function getNextWateringDate(plant: PlantWithSchedule): Date | null {
  if (!plant.last_watered || !plant.watering_frequency) return null;
  const last = new Date(plant.last_watered);
  const days = frequencyToDays[plant.watering_frequency] || 7;
  const next = new Date(last.getTime() + days * 86400000);
  return next;
}

function getUpcomingWaterings(plants: PlantWithSchedule[]) {
  const now = new Date();
  return plants
    .filter((p) => p.last_watered && p.watering_frequency)
    .map((p) => {
      const nextDate = getNextWateringDate(p)!;
      const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / 86400000);
      return { ...p, nextDate, daysUntil };
    })
    .filter((p) => p.daysUntil > 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);
}

function SwipeableNotification({
  plant,
  onWatered,
  onNavigate,
  isWatering,
  t,
}: {
  plant: any;
  onWatered: (e: React.MouseEvent, id: string, name: string) => void;
  onNavigate: (id: string) => void;
  isWatering: boolean;
  t: (key: string) => string;
}) {
  const x = useMotionValue(0);
  const bg = useTransform(x, [-120, 0, 120], ["hsl(200 70% 55%)", "transparent", "hsl(200 70% 55%)"]);
  const opacity = useTransform(x, [-120, -60, 0, 60, 120], [1, 0.7, 1, 0.7, 1]);

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 300) {
      // Trigger watering on swipe
      onWatered({ stopPropagation: () => {} } as any, plant.id, plant.nickname || plant.name);
    }
  };

  return (
    <motion.div
      layout
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Background swipe indicator */}
      <motion.div
        style={{ backgroundColor: bg }}
        className="absolute inset-0 rounded-2xl flex items-center justify-between px-6"
      >
        <Droplets className="w-5 h-5 text-white" />
        <Droplets className="w-5 h-5 text-white" />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        style={{ x, opacity }}
        onDragEnd={handleDragEnd}
        className="flex items-center gap-2 relative z-10"
      >
        <button
          onClick={() => onNavigate(plant.id)}
          className="flex-1 flex items-center gap-3 p-3 rounded-2xl bg-water/10 border border-water/20 text-left hover:bg-water/15 transition-colors"
        >
          {plant.image_url ? (
            <img src={plant.image_url} alt={plant.nickname || plant.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-water/20 flex items-center justify-center shrink-0 text-lg">🌿</div>
          )}
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm truncate block">{plant.nickname || plant.name}</span>
            <span className="text-xs text-water font-medium">
              {plant.daysOverdue === 0 ? t("dueToday") : `${plant.daysOverdue}${t("daysOverdue")}`}
            </span>
          </div>
        </button>
        <button
          onClick={(e) => onWatered(e, plant.id, plant.nickname || plant.name)}
          disabled={isWatering}
          className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary transition-colors disabled:opacity-50"
          title={t("watered")}
        >
          <Droplets className={`w-5 h-5 ${isWatering ? "animate-pulse" : ""}`} />
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [plants, setPlants] = useState<PlantWithSchedule[]>([]);
  const [wateringIds, setWateringIds] = useState<Set<string>>(new Set());
  const [wateringAll, setWateringAll] = useState(false);

  const [groupByLocation, setGroupByLocation] = useState<boolean>(() => {
    return localStorage.getItem("notif_group_by_location") !== "false";
  });

  const fetchPlants = async () => {
    const { data } = await supabase
      .from("plants")
      .select("id, name, nickname, watering_frequency, last_watered, image_url, location")
      .order("created_at", { ascending: false });
    setPlants(data || []);
  };

  useEffect(() => { fetchPlants(); }, []);

  const { overdue, permissionGranted, requestPermission } = useWateringReminders(plants);
  const upcoming = getUpcomingWaterings(plants);

  // Update PWA badge
  useEffect(() => {
    if ("setAppBadge" in navigator && overdue.length > 0) {
      (navigator as any).setAppBadge(overdue.length);
    } else if ("clearAppBadge" in navigator && overdue.length === 0) {
      (navigator as any).clearAppBadge();
    }
  }, [overdue.length]);

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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
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
        {overdue.length === 0 && upcoming.length === 0 ? (
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
          <>
            {overdue.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-sm text-muted-foreground flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-water" />
                    {t("wateringAlerts")}
                  </h2>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={wateringAll}
                        className="rounded-xl gap-1.5 text-xs border-water/30 text-water hover:bg-water/10 hover:text-water"
                      >
                        <Droplets className={`w-3.5 h-3.5 ${wateringAll ? "animate-pulse" : ""}`} />
                        {t("waterAll")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl max-w-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("waterAll")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("waterAllConfirm")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">{t("cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleWaterAll} className="rounded-xl">
                          <Droplets className="w-4 h-4 mr-1" />
                          {t("waterAll")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">{t("swipeToRemove")}</p>
                  <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                    <button
                      onClick={() => { setGroupByLocation(true); localStorage.setItem("notif_group_by_location", "true"); }}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${groupByLocation ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                    >
                      <MapPin className="w-3 h-3" /> {t("byLocation")}
                    </button>
                    <button
                      onClick={() => { setGroupByLocation(false); localStorage.setItem("notif_group_by_location", "false"); }}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${!groupByLocation ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                    >
                      <ListIcon className="w-3 h-3" /> {t("flatList")}
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {groupByLocation ? (
                    Object.entries(
                      overdue.reduce<Record<string, typeof overdue>>((acc, p) => {
                        const loc = p.location || "other";
                        (acc[loc] ||= []).push(p);
                        return acc;
                      }, {})
                    ).map(([loc, group]) => {
                      const labels: Record<string, string> = {
                        indoor: t("indoor"),
                        outdoor: t("outdoor"),
                        balcony: t("balcony"),
                        windowsill: t("windowsill"),
                        other: t("other"),
                      };
                      return (
                        <div key={loc} className="space-y-2 mb-2">
                          <h3 className="font-serif text-xs text-muted-foreground flex items-center gap-1.5 px-1">
                            <MapPin className="w-3 h-3" />
                            {labels[loc] || loc}
                            <span className="text-[10px]">({group.length})</span>
                          </h3>
                          <div className="space-y-2">
                            {group.map((p) => (
                              <SwipeableNotification
                                key={p.id}
                                plant={p}
                                onWatered={handleMarkWatered}
                                onNavigate={(id) => navigate(`/plant/${id}`)}
                                isWatering={wateringIds.has(p.id)}
                                t={t as any}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    overdue.map((p) => (
                      <SwipeableNotification
                        key={p.id}
                        plant={p}
                        onWatered={handleMarkWatered}
                        onNavigate={(id) => navigate(`/plant/${id}`)}
                        isWatering={wateringIds.has(p.id)}
                        t={t as any}
                      />
                    ))
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Next scheduled waterings */}
            {upcoming.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-3">
                <h2 className="font-serif text-sm text-muted-foreground flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-primary" />
                  {t("upcomingWaterings")}
                </h2>
                {upcoming.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/plant/${p.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border text-left hover:border-primary/30 transition-colors"
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.nickname || p.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0 text-lg">🌿</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm truncate block">{p.nickname || p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("nextWatering")} {formatDate(p.nextDate)}
                        {p.daysUntil === 1 ? ` (${t("tomorrow")})` : ` (${p.daysUntil}${t("daysLeft")})`}
                      </span>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
