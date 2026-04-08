import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Leaf, MapPin, Sun, Droplets } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";

interface PublicPlant {
  id: string;
  name: string;
  nickname: string | null;
  scientific_name: string | null;
  image_url: string | null;
  location: string | null;
  sunlight: string | null;
  watering_frequency: string | null;
}

interface GardenProfile {
  display_name: string | null;
  avatar_url: string | null;
  garden_bio: string | null;
}

export default function PublicGardenPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<GardenProfile | null>(null);
  const [plants, setPlants] = useState<PublicPlant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      setLoading(true);
      const [profileRes, plantsRes] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url, garden_bio").eq("user_id", userId!).single(),
        supabase.from("plants").select("id, name, nickname, scientific_name, image_url, location, sunlight, watering_frequency").eq("user_id", userId!).eq("is_public", true).order("created_at", { ascending: false }),
      ]);
      setProfile(profileRes.data);
      setPlants(plantsRes.data || []);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">{t("loading")}...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 px-4 pt-6 pb-6">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full bg-card/60 backdrop-blur mb-4">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-primary/20">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
              {(profile?.display_name || "?")[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-serif font-bold text-foreground">
              {profile?.display_name || t("anonymousGardener")}
            </h1>
            <p className="text-xs text-muted-foreground">{plants.length} {t("plantsShared")}</p>
          </div>
        </div>
        {profile?.garden_bio && (
          <p className="mt-3 text-sm text-muted-foreground">{profile.garden_bio}</p>
        )}
      </div>

      {/* Plants grid */}
      <div className="px-4 py-4">
        {plants.length === 0 ? (
          <div className="text-center py-12">
            <Leaf className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">{t("noPublicPlants")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {plants.map((plant) => (
              <div key={plant.id} className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                {plant.image_url ? (
                  <div className="aspect-square bg-muted">
                    <img src={plant.image_url} alt={plant.nickname || plant.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    <Leaf className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="p-3">
                  <p className="font-semibold text-sm text-foreground truncate">{plant.nickname || plant.name}</p>
                  {plant.scientific_name && (
                    <p className="text-[10px] text-muted-foreground italic truncate">{plant.scientific_name}</p>
                  )}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {plant.location && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-0.5">
                        <MapPin className="w-2.5 h-2.5" /> {plant.location}
                      </Badge>
                    )}
                    {plant.sunlight && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-0.5">
                        <Sun className="w-2.5 h-2.5" /> {plant.sunlight}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
