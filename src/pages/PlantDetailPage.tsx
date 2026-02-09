import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Droplets, Sun, MapPin, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PlantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plant, setPlant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("plants").select("*").eq("id", id).single();
      setPlant(data);
      setLoading(false);
    };
    if (id) fetch();
  }, [id]);

  const handleUpdate = async (field: string, value: string) => {
    setPlant((p: any) => ({ ...p, [field]: value }));
    const { error } = await supabase.from("plants").update({ [field]: value }).eq("id", id);
    if (error) toast.error("Failed to update");
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("plants").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Plant removed");
      navigate("/garden");
    }
  };

  const handleWater = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    await supabase.from("plants").update({ last_watered: now }).eq("id", id);
    setPlant((p: any) => ({ ...p, last_watered: now }));
    toast.success("Watered! 💧");
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!plant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p>Plant not found</p>
        <Button onClick={() => navigate("/garden")}>Back to Garden</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header image */}
      <div className="relative h-64 bg-muted">
        {plant.image_url ? (
          <img src={plant.image_url} alt={plant.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🌿</div>
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 rounded-full bg-background/70 backdrop-blur-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {plant.confidence && (
          <span className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium bg-primary/80 text-primary-foreground backdrop-blur-sm">
            {plant.confidence}% match
          </span>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 -mt-6 relative"
      >
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <h1 className="font-serif text-2xl">{plant.name}</h1>
          {plant.scientific_name && (
            <p className="text-sm text-muted-foreground italic">{plant.scientific_name}</p>
          )}

          {/* Quick actions */}
          <div className="flex gap-2 mt-4">
            <Button onClick={handleWater} disabled={saving} variant="outline" className="flex-1 h-10 rounded-xl gap-2 text-water border-water/30">
              <Droplets className="w-4 h-4" />
              Water
            </Button>
          </div>

          {plant.last_watered && (
            <p className="text-xs text-muted-foreground mt-2">
              Last watered: {new Date(plant.last_watered).toLocaleDateString()}
            </p>
          )}

          {/* Care settings */}
          <div className="space-y-4 mt-6">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Sun className="w-3.5 h-3.5 text-sun" /> Sunlight
              </Label>
              <Select value={plant.sunlight || "medium"} onValueChange={(v) => handleUpdate("sunlight", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low light</SelectItem>
                  <SelectItem value="medium">Medium light</SelectItem>
                  <SelectItem value="high">Bright / direct</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Droplets className="w-3.5 h-3.5 text-water" /> Watering
              </Label>
              <Select value={plant.watering_frequency || "weekly"} onValueChange={(v) => handleUpdate("watering_frequency", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="every-2-days">Every 2 days</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <MapPin className="w-3.5 h-3.5 text-bloom" /> Location
              </Label>
              <Select value={plant.location || "indoor"} onValueChange={(v) => handleUpdate("location", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indoor">Indoor</SelectItem>
                  <SelectItem value="outdoor">Outdoor</SelectItem>
                  <SelectItem value="balcony">Balcony</SelectItem>
                  <SelectItem value="windowsill">Windowsill</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Notes</Label>
              <Textarea
                value={plant.notes || ""}
                onChange={(e) => handleUpdate("notes", e.target.value)}
                placeholder="Add care notes..."
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>
          </div>

          <Button onClick={handleDelete} variant="outline" className="w-full mt-6 h-10 rounded-xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" />
            Remove Plant
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
