import { Droplets, Sun, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PlantCardProps {
  id: string;
  name: string;
  scientificName?: string | null;
  imageUrl?: string | null;
  sunlight?: string | null;
  wateringFrequency?: string | null;
  location?: string | null;
  variant?: "card" | "list";
}

export default function PlantCard({ id, name, scientificName, imageUrl, sunlight, wateringFrequency, location, variant = "card" }: PlantCardProps) {
  const navigate = useNavigate();

  if (variant === "list") {
    return (
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(`/plant/${id}`)}
        className="bg-card rounded-xl overflow-hidden cursor-pointer border border-border shadow-sm hover:shadow-md transition-shadow flex items-center gap-3 p-2"
      >
        <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><span className="text-2xl">🌱</span></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-sm font-medium truncate">{name}</h3>
          {scientificName && <p className="text-xs text-muted-foreground italic truncate">{scientificName}</p>}
        </div>
        <div className="flex gap-1.5 text-muted-foreground flex-shrink-0">
          {sunlight && <Sun className="w-3.5 h-3.5 text-sun" />}
          {wateringFrequency && <Droplets className="w-3.5 h-3.5 text-water" />}
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
      className="bg-card rounded-2xl overflow-hidden cursor-pointer border border-border shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="aspect-[4/3] bg-muted overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">🌱</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-serif text-base font-medium truncate">{name}</h3>
        {scientificName && (
          <p className="text-xs text-muted-foreground italic truncate">{scientificName}</p>
        )}
        <div className="flex gap-2 mt-2 text-muted-foreground">
          {sunlight && <Sun className="w-3.5 h-3.5 text-sun" />}
          {wateringFrequency && <Droplets className="w-3.5 h-3.5 text-water" />}
          {location && <MapPin className="w-3.5 h-3.5 text-bloom" />}
        </div>
      </div>
    </motion.div>
  );
}
