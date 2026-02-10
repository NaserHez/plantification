import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Leaf, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import PlantCard from "@/components/PlantCard";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";

interface Plant {
  id: string;
  name: string;
  scientific_name: string | null;
  image_url: string | null;
  sunlight: string | null;
  watering_frequency: string | null;
  location: string | null;
}

export default function GardenPage() {
  const navigate = useNavigate();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlants = async () => {
      const { data } = await supabase
        .from("plants")
        .select("id, name, scientific_name, image_url, sunlight, watering_frequency, location")
        .order("created_at", { ascending: false });
      setPlants(data || []);
      setLoading(false);
    };
    fetchPlants();
  }, []);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif">{localStorage.getItem("garden_name") || "My Garden"}</h1>
          <p className="text-sm text-muted-foreground">
            {plants.length} plant{plants.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => navigate("/identify")} size="icon" className="rounded-xl h-10 w-10">
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      <div className="px-4 max-w-md mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[4/3] rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : plants.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
              <Leaf className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-serif text-lg mb-1">No plants yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Identify your first plant to start your garden
            </p>
            <Button onClick={() => navigate("/identify")} className="rounded-xl">
              Identify a Plant
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-3 mt-4"
          >
            {plants.map((p) => (
              <PlantCard
                key={p.id}
                id={p.id}
                name={p.name}
                scientificName={p.scientific_name}
                imageUrl={p.image_url}
                sunlight={p.sunlight}
                wateringFrequency={p.watering_frequency}
                location={p.location}
              />
            ))}
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
