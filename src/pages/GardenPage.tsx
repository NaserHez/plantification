import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Leaf, LayoutGrid, List, MapPin, GripVertical, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import PlantCard from "@/components/PlantCard";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
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
  const { t } = useLanguage();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<LayoutMode>(() => {
    return (localStorage.getItem("garden_layout") as LayoutMode) || "cards";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);

  // Pull-to-reveal search
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 60 && !searchVisible) {
      setSearchVisible(true);
      pulling.current = false;
    }
  }, [searchVisible]);

  const handleTouchEnd = useCallback(() => {
    pulling.current = false;
  }, []);

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

  const filteredPlants = useMemo(() => {
    if (!searchQuery.trim()) return plants;
    const q = searchQuery.toLowerCase();
    return plants.filter((p) =>
      (p.nickname || p.name).toLowerCase().includes(q) ||
      (p.scientific_name || "").toLowerCase().includes(q)
    );
  }, [plants, searchQuery]);

  const locationGroups = useMemo(() => {
    const groups: Record<string, Plant[]> = {};
    filteredPlants.forEach((p) => {
      const loc = p.location || "other";
      if (!groups[loc]) groups[loc] = [];
      groups[loc].push(p);
    });
    return groups;
  }, [filteredPlants]);

  const locationLabels: Record<string, string> = {
    indoor: t("indoor"),
    outdoor: t("outdoor"),
    balcony: t("balcony"),
    windowsill: t("windowsill"),
    other: t("other"),
  };

  return (
    <div
      ref={scrollRef}
      className="min-h-screen bg-background pb-20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-serif">{localStorage.getItem("garden_name") || t("myGarden")}</h1>
          <p className="text-sm text-muted-foreground">
            {plants.length} {plants.length !== 1 ? t("plants") : t("plant")}
          </p>
        </div>
        <Button onClick={() => navigate("/identify")} size="icon" className="rounded-xl h-10 w-10">
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* Pull-down hint when search is hidden */}
      {plants.length > 0 && !searchVisible && (
        <div className="flex justify-center mb-1">
          <button
            onClick={() => setSearchVisible(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
          >
            <Search className="w-3 h-3" />
            {t("pullToSearch")}
          </button>
        </div>
      )}

      {/* Search bar - revealed on swipe down */}
      <AnimatePresence>
        {plants.length > 0 && searchVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 mb-3 overflow-hidden"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchPlants")}
                autoFocus
                className="w-full h-9 pl-9 pr-8 rounded-xl bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {searchVisible && (
                <button
                  onClick={() => { setSearchVisible(false); setSearchQuery(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-accent text-muted-foreground"
                >
                  ✕
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {plants.length > 0 && (
        <div className="px-4 flex gap-1 mb-3">
          {([
            { mode: "cards" as LayoutMode, icon: LayoutGrid, label: t("cards") },
            { mode: "list" as LayoutMode, icon: List, label: t("list") },
            { mode: "location" as LayoutMode, icon: MapPin, label: t("location") },
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
        ) : filteredPlants.length === 0 && plants.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
              <Leaf className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-serif text-lg mb-1">{t("noPlants")}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t("noPlantsDesc")}</p>
            <Button onClick={() => navigate("/identify")} className="rounded-xl">
              {t("identifyPlant")}
            </Button>
          </motion.div>
        ) : filteredPlants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">{t("noResults")}</div>
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
              items={filteredPlants.map((p) => p.id)}
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
                {filteredPlants.map((p) => (
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
