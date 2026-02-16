import { Droplets, Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

interface OverduePlant {
  id: string;
  name: string;
  nickname?: string | null;
  daysOverdue: number;
}

interface Props {
  overdue: OverduePlant[];
  permissionGranted: boolean;
  onRequestPermission: () => void;
}

export default function WateringReminders({ overdue, permissionGranted, onRequestPermission }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (dismissed || overdue.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-4 mb-3 p-4 rounded-2xl bg-water/10 border border-water/20"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-water" />
            <span className="font-serif text-sm font-medium">
              {overdue.length} {overdue.length > 1 ? t("plantsNeedWaterPlural") : t("plantsNeedWater")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {!permissionGranted && (
              <button onClick={onRequestPermission} className="p-1 rounded-lg hover:bg-muted" title={t("enableNotifications")}>
                <BellOff className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <button onClick={() => setDismissed(true)} className="p-1 rounded-lg hover:bg-muted">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          {overdue.slice(0, 4).map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/plant/${p.id}`)}
              className="flex items-center justify-between w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-water/10 transition-colors"
            >
              <span className="truncate">{p.nickname || p.name}</span>
              <span className="text-xs text-water font-medium ml-2 whitespace-nowrap">
                {p.daysOverdue === 0 ? t("dueToday") : `${p.daysOverdue}${t("daysOverdue")}`}
              </span>
            </button>
          ))}
          {overdue.length > 4 && (
            <p className="text-xs text-muted-foreground px-2">+{overdue.length - 4} more</p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
