import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Droplets, BellOff, Bell, BellRing, CalendarClock, MapPin, List as ListIcon, Heart, MessageCircle, CheckCheck } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useWateringReminders } from "@/hooks/use-watering-reminders";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import SignedImage from "@/components/SignedImage";
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
            <SignedImage src={plant.image_url} alt={plant.nickname || plant.name} className="w-10 h-10 rounded-xl object-cover shrink-0" fallback={<div className="w-10 h-10 rounded-xl bg-water/20 flex items-center justify-center shrink-0 text-lg">🌿</div>} />
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

  // Community activity
  interface ActivityItem {
    id: string;
    type: "like" | "comment";
    actor_id: string;
    post_id: string;
    comment_id?: string | null;
    read_at: string | null;
    created_at: string;
    actor_name?: string | null;
    actor_avatar?: string | null;
  }
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const fetchPlants = async () => {
    const { data } = await supabase
      .from("plants")
      .select("id, name, nickname, watering_frequency, last_watered, image_url, location")
      .order("created_at", { ascending: false });
    setPlants(data || []);
  };

  const fetchActivity = useCallback(async () => {
    const { data } = await supabase
      .from("community_notifications")
      .select("id, type, actor_id, post_id, comment_id, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (!data || data.length === 0) {
      setActivity([]);
      return;
    }
    const actorIds = [...new Set(data.map((n) => n.actor_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", actorIds);
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    setActivity(
      data.map((n) => ({
        ...n,
        type: n.type as "like" | "comment",
        actor_name: profileMap.get(n.actor_id)?.display_name ?? null,
        actor_avatar: profileMap.get(n.actor_id)?.avatar_url ?? null,
      }))
    );
  }, []);

  useEffect(() => {
    fetchPlants();
    fetchActivity();
  }, [fetchActivity]);

  const handleOpenActivity = async (n: ActivityItem) => {
    if (!n.read_at) {
      await supabase
        .from("community_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id);
      setActivity((prev) =>
        prev.map((a) => (a.id === n.id ? { ...a, read_at: new Date().toISOString() } : a))
      );
    }
    navigate(`/community#post-${n.post_id}`);
  };

  const handleMarkAllRead = async () => {
    const unread = activity.filter((a) => !a.read_at);
    if (unread.length === 0) return;
    const ids = unread.map((a) => a.id);
    const now = new Date().toISOString();
    await supabase.from("community_notifications").update({ read_at: now }).in("id", ids);
    setActivity((prev) => prev.map((a) => ({ ...a, read_at: a.read_at ?? now })));
  };

  const { overdue, permissionGranted, requestPermission } = useWateringReminders(plants);
  const upcoming = getUpcomingWaterings(plants);

  // Update PWA badge with overdue waterings + unread community activity
  useEffect(() => {
    const unreadActivity = activity.filter((a) => !a.read_at).length;
    const total = overdue.length + unreadActivity;
    if ("setAppBadge" in navigator && total > 0) {
      (navigator as any).setAppBadge(total);
    } else if ("clearAppBadge" in navigator && total === 0) {
      (navigator as any).clearAppBadge();
    }
  }, [overdue.length, activity]);

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
        {overdue.length === 0 && upcoming.length === 0 && activity.length === 0 ? (
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
                      <SignedImage src={p.image_url} alt={p.nickname || p.name} className="w-10 h-10 rounded-xl object-cover shrink-0" fallback={<div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0 text-lg">🌿</div>} />
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

            {/* Community activity */}
            {activity.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-sm text-muted-foreground flex items-center gap-2">
                    <Heart className="w-4 h-4 text-bloom" />
                    {t("activity")}
                  </h2>
                  {activity.some((a) => !a.read_at) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleMarkAllRead}
                      className="rounded-xl gap-1.5 text-xs h-7"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      {t("markAllRead")}
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {activity.map((n) => {
                    const isUnread = !n.read_at;
                    const Icon = n.type === "like" ? Heart : MessageCircle;
                    const iconColor = n.type === "like" ? "text-bloom" : "text-primary";
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleOpenActivity(n)}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors ${
                          isUnread
                            ? "bg-primary/5 border-primary/30 hover:bg-primary/10"
                            : "bg-card border-border hover:border-primary/30"
                        }`}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="w-9 h-9">
                            <AvatarImage src={n.actor_avatar || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {(n.actor_name || "?")[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center ${iconColor}`}>
                            <Icon className={`w-2.5 h-2.5 ${n.type === "like" ? "fill-bloom" : ""}`} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">
                            <span className="font-semibold">{n.actor_name || t("anonymousGardener")}</span>{" "}
                            <span className="text-muted-foreground">
                              {n.type === "like" ? t("likedYourPost") : t("commentedOnPost")}
                            </span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
