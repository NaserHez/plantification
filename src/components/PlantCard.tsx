import { Droplets, Sun, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import SignedImage from "@/components/SignedImage";

interface PlantCardProps {
  id: string;
  name: string;
  commonName?: string | null;
  scientificName?: string | null;
  imageUrl?: string | null;
  sunlight?: string | null;
  wateringFrequency?: string | null;
  location?: string | null;
  lastWatered?: string | null;
  variant?: "card" | "list";
}

const FREQ_DAYS: Record<string, number> = {
  daily: 1,
  "every-2-days": 2,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

function getWateringStatus(lastWatered?: string | null, frequency?: string | null) {
  if (!lastWatered || !frequency) return { overdue: false, dueSoon: false };
  const interval = FREQ_DAYS[frequency] || 7;
  const days = (Date.now() - new Date(lastWatered).getTime()) / 86400000;
  return { overdue: days >= interval, dueSoon: days >= interval - 1 && days < interval };
}

export default function PlantCard({ id, name, commonName, scientificName, imageUrl, sunlight, wateringFrequency, location, lastWatered, variant = "card" }: PlantCardProps) {
  const showCommon = commonName && commonName !== name;
  const navigate = useNavigate();
  const { overdue, dueSoon } = getWateringStatus(lastWatered, wateringFrequency);
  const dropClass = overdue ? "text-overdue animate-pulse" : dueSoon ? "text-sun" : "text-water";

  if (variant === "list") {
    return (
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(`/plant/${id}`)}
        className="bg-card rounded-xl overflow-hidden cursor-pointer border border-border shadow-sm hover:shadow-md transition-shadow flex items-center gap-3 p-2"
      >
        <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
          {imageUrl ? (
            <SignedImage src={imageUrl} alt={name} className="w-full h-full object-cover" fallback={<div className="w-full h-full flex items-center justify-center"><span className="text-2xl">🌱</span></div>} />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><span className="text-2xl">🌱</span></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-sm font-medium truncate">{name}</h3>
          {scientificName && <p className="text-xs text-muted-foreground italic truncate">{scientificName}</p>}
        </div>
        <div className="flex gap-1.5 flex-shrink-0 items-center">
          {sunlight && <Sun className="w-3.5 h-3.5 text-sun" />}
          {wateringFrequency && <Droplets className={cn("w-3.5 h-3.5", dropClass)} />}
          {location && <MapPin className="w-3.5 h-3.5 text-bloom" />}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => navigate(`/plant/${id}`)}
      className="relative bg-card rounded-2xl overflow-hidden cursor-pointer border border-border shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="aspect-[4/3] bg-muted overflow-hidden relative">
        {imageUrl ? (
          <SignedImage src={imageUrl} alt={name} className="w-full h-full object-cover" fallback={<div className="w-full h-full flex items-center justify-center"><span className="text-4xl">🌱</span></div>} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">🌱</span>
          </div>
        )}
        {overdue && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-overdue text-[10px] font-medium text-white shadow-sm">
            <Droplets className="w-3 h-3" />
            <span>Water</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-serif text-base font-medium truncate">{name}</h3>
        {scientificName && (
          <p className="text-xs text-muted-foreground italic truncate">{scientificName}</p>
        )}
        <div className="flex gap-2 mt-2 items-center">
          {sunlight && <Sun className="w-3.5 h-3.5 text-sun" />}
          {wateringFrequency && <Droplets className={cn("w-3.5 h-3.5", dropClass)} />}
          {location && <MapPin className="w-3.5 h-3.5 text-bloom" />}
        </div>
      </div>
    </motion.div>
  );
}
