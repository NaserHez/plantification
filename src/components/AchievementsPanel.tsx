import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Flame, Sprout, Leaf, Search, Heart, Lock } from "lucide-react";

const ICONS: Record<string, any> = { sprout: Sprout, leaf: Leaf, flame: Flame, search: Search, heart: Heart };

interface Badge { code: string; name: string; description: string; icon: string | null; earned: boolean; }

export default function AchievementsPanel() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: all } = await (supabase as any).from("badges").select("*");
      const { data: mine } = await (supabase as any).from("user_badges").select("badge_code").eq("user_id", user.id);
      const earned = new Set((mine || []).map((r: any) => r.badge_code));
      setBadges(((all || []) as any[]).map((b) => ({ ...b, earned: earned.has(b.code) })));
      const { data: p } = await supabase
        .from("profiles")
        .select("current_streak, longest_streak" as any)
        .eq("user_id", user.id)
        .maybeSingle();
      if (p) setStreak({ current: (p as any).current_streak || 0, longest: (p as any).longest_streak || 0 });
    })();
  }, []);

  return (
    <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
      <h2 className="font-serif text-lg flex items-center gap-2">
        <Trophy className="w-4 h-4 text-sun" /> Achievements
      </h2>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border p-3 text-center">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Current streak</div>
          <div className="text-2xl font-serif flex items-center justify-center gap-1"><Flame className="w-5 h-5 text-cta" /> {streak.current}</div>
        </div>
        <div className="rounded-xl border border-border p-3 text-center">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Longest</div>
          <div className="text-2xl font-serif">{streak.longest}</div>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-2">
        {badges.map((b) => {
          const Icon = ICONS[b.icon || ""] || Trophy;
          return (
            <li key={b.code} className={`flex items-center gap-3 rounded-xl p-2.5 border ${b.earned ? "border-primary/40 bg-primary/5" : "border-border bg-background/40 opacity-70"}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${b.earned ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                {b.earned ? <Icon className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{b.name}</div>
                <div className="text-[11px] text-muted-foreground">{b.description}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
