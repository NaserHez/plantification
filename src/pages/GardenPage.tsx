import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Leaf, LayoutGrid, List, MapPin, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import PlantCard from "@/components/PlantCard";
import BottomNav from "@/components/BottomNav";
import WateringReminders from "@/components/WateringReminders";
import { useWateringReminders } from "@/hooks/use-watering-reminders";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Plant {
  id: string;
  name: string;
  scientific_name: string | null;
  image_url: string | null;
  sunlight: string | null;
  watering_frequency: string | null;
  location: string | null;
  nickname: string | null;
  last_watered: string | null;
}

type LayoutMode = "cards" | "list" | "location";

function SortablePlantCard({ plant, layout }: { plant: Plant; layout: LayoutMode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: plant.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1 rounded-md bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <PlantCard
        id={plant.id}
        name={plant.nickname || plant.name}
        scientificName={plant.scientific_name}
        imageUrl={plant.image_url}
        sunlight={plant.sunlight}
        wateringFrequency={plant.watering_frequency}
        location={plant.location}
        variant={layout === "list" ? "list" : "card"}
      />
    </div>
  );
}

export default function GardenPage() {
  const navigate = useNavigate();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<LayoutMode>(() => {
    return (localStorage.getItem("garden_layout") as LayoutMode) || "cards";
  });

  const { overdue, permissionGranted, requestPermission } = useWateringReminders(plants);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    const fetchPlants = async () => {
      const { data } = await supabase
        .from("plants")
        .select("id, name, scientific_name, image_url, sunlight, watering_frequency, location, nickname, last_watered")
        .order("created_at", { ascending: false });

      const fetched = data || [];
      // Restore saved order
      const savedOrder = localStorage.getItem("garden_order");
      if (savedOrder) {
        try {
          const orderIds: string[] = JSON.parse(savedOrder);
          const orderMap = new Map(orderIds.map((id, i) => [id, i]));
          fetched.sort((a, b) => {
            const ai = orderMap.get(a.id) ?? 999;
            const bi = orderMap.get(b.id) ?? 999;
            return ai - bi;
          });
        } catch {}
      }
      setPlants(fetched);
      setLoading(false);
    };
    fetchPlants();
  }, []);

  const handleLayoutChange = (mode: LayoutMode) => {
    setLayout(mode);
    localStorage.setItem("garden_layout", mode);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setPlants((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      localStorage.setItem("garden_order", JSON.stringify(reordered.map((p) => p.id)));
      return reordered;
    });
  };

  // Group by location
  const locationGroups = useMemo(() => {
    const groups: Record<string, Plant[]> = {};
    plants.forEach((p) => {
      const loc = p.location || "other";
      if (!groups[loc]) groups[loc] = [];
      groups[loc].push(p);
    });
    return groups;
  }, [plants]);

  const locationLabels: Record<string, string> = {
    indoor: "🏠 Indoor",
    outdoor: "🌳 Outdoor",
    balcony: "🌇 Balcony",
    windowsill: "🪟 Windowsill",
    other: "📍 Other",
  };

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

      {/* Watering reminders */}
      <WateringReminders overdue={overdue} permissionGranted={permissionGranted} onRequestPermission={requestPermission} />

      {/* Layout toggle */}
      {plants.length > 0 && (
        <div className="px-4 flex gap-1 mb-3">
          {([
            { mode: "cards" as LayoutMode, icon: LayoutGrid, label: "Cards" },
            { mode: "list" as LayoutMode, icon: List, label: "List" },
            { mode: "location" as LayoutMode, icon: MapPin, label: "Location" },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => handleLayoutChange(mode)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                layout === mode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

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
        ) : layout === "location" ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 mt-2">
            {Object.entries(locationGroups).map(([loc, group]) => (
              <div key={loc}>
                <h2 className="font-serif text-sm text-muted-foreground mb-2">
                  {locationLabels[loc] || loc}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {group.map((p) => (
                    <PlantCard
                      key={p.id}
                      id={p.id}
                      name={p.nickname || p.name}
                      scientificName={p.scientific_name}
                      imageUrl={p.image_url}
                      sunlight={p.sunlight}
                      wateringFrequency={p.watering_frequency}
                      location={p.location}
                    />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={plants.map((p) => p.id)}
              strategy={layout === "list" ? verticalListSortingStrategy : rectSortingStrategy}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "mt-2",
                  layout === "cards" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"
                )}
              >
                {plants.map((p) => (
                  <SortablePlantCard key={p.id} plant={p} layout={layout} />
                ))}
              </motion.div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
