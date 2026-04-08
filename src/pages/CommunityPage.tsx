import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Search, Leaf, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/i18n/LanguageContext";
import BottomNav from "@/components/BottomNav";

interface PublicGarden {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  garden_bio: string | null;
  plant_count: number;
  preview_images: string[];
}

export default function CommunityPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [gardens, setGardens] = useState<PublicGarden[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Get all public plants grouped by user
      const { data: plants } = await supabase
        .from("plants")
        .select("user_id, name, image_url")
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      if (!plants || plants.length === 0) {
        setGardens([]);
        setLoading(false);
        return;
      }

      // Group by user
      const userMap = new Map<string, { count: number; images: string[] }>();
      for (const p of plants) {
        const entry = userMap.get(p.user_id) || { count: 0, images: [] };
        entry.count++;
        if (p.image_url && entry.images.length < 4) entry.images.push(p.image_url);
        userMap.set(p.user_id, entry);
      }

      // Fetch profiles
      const userIds = [...userMap.keys()];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, garden_bio")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      const result: PublicGarden[] = userIds.map((uid) => {
        const profile = profileMap.get(uid);
        const info = userMap.get(uid)!;
        return {
          user_id: uid,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
          garden_bio: profile?.garden_bio || null,
          plant_count: info.count,
          preview_images: info.images,
        };
      });

      setGardens(result.sort((a, b) => b.plant_count - a.plant_count));
      setLoading(false);
    }
    load();
  }, []);

  const filtered = gardens.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (g.display_name || "").toLowerCase().includes(q) || (g.garden_bio || "").toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 px-4 pt-6 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full bg-card/60 backdrop-blur">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-serif font-bold text-foreground">{t("community")}</h1>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("searchGardens")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/60 backdrop-blur border-border/50 rounded-xl h-9 text-sm"
          />
        </div>
      </div>

      {/* Gardens list */}
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t("loading")}...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Leaf className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">{t("noPublicGardens")}</p>
          </div>
        ) : (
          filtered.map((g) => (
            <button
              key={g.user_id}
              onClick={() => navigate(`/garden/${g.user_id}`)}
              className="w-full bg-card rounded-2xl border border-border/50 p-4 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={g.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {(g.display_name || "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{g.display_name || t("anonymousGardener")}</p>
                  <p className="text-xs text-muted-foreground">{g.plant_count} {t("plantsShared")}</p>
                </div>
              </div>
              {g.garden_bio && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{g.garden_bio}</p>
              )}
              {g.preview_images.length > 0 && (
                <div className="flex gap-1.5 overflow-hidden rounded-xl">
                  {g.preview_images.map((img, i) => (
                    <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              )}
            </button>
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
}
