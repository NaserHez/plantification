import { Droplets, Sun, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface PlantCardProps {
  id: string;
  name: string;
  scientificName?: string | null;
  imageUrl?: string | null;
  sunlight?: string | null;
  wateringFrequency?: string | null;
  location?: string | null;
}

export default function PlantCard({ id, name, scientificName, imageUrl, sunlight, wateringFrequency, location }: PlantCardProps) {
  const navigate = useNavigate();

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
