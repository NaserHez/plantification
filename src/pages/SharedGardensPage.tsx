import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Plus, Copy, LogOut, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

interface Garden { id: string; name: string; invite_code: string; owner_id: string; }

export default function SharedGardensPage() {
  const nav = useNavigate();
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUid(user?.id ?? null);
    const { data } = await (supabase as any).from("shared_gardens").select("*").order("created_at", { ascending: false });
    setGardens((data || []) as Garden[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim() || !uid) return;
    setBusy(true);
    const { data, error } = await (supabase as any)
      .from("shared_gardens")
      .insert({ name: name.trim(), owner_id: uid })
      .select()
      .single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    // owner is also a member — add self so join-list semantics work uniformly.
    await (supabase as any).from("shared_garden_members").insert({ garden_id: data.id, user_id: uid });
    setName("");
    setGardens((g) => [data as Garden, ...g]);
    toast.success("Garden created");
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  const leave = async (g: Garden) => {
    if (!uid) return;
    await (supabase as any).from("shared_garden_members").delete()
      .eq("garden_id", g.id).eq("user_id", uid);
    setGardens((prev) => prev.filter((x) => x.id !== g.id));
    toast.success("Left garden");
  };

  const remove = async (g: Garden) => {
    await (supabase as any).from("shared_gardens").delete().eq("id", g.id);
    setGardens((prev) => prev.filter((x) => x.id !== g.id));
    toast.success("Garden deleted");
  };

  return (
    <div className="min-h-dvh bg-background pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => nav(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-serif flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Shared gardens
        </h1>
      </div>

      <main className="px-4 max-w-md mx-auto space-y-4">
        <p className="text-sm text-muted-foreground">
          Share plant care with housemates or family. Everyone can water, add photos, and edit plants in a shared garden.
        </p>

        <div className="rounded-2xl bg-card border border-border p-4 space-y-2">
          <label htmlFor="new-garden" className="text-sm font-medium">Create a shared garden</label>
          <div className="flex gap-2">
            <Input id="new-garden" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Our apartment" className="rounded-xl h-10" />
            <Button onClick={create} disabled={busy || !name.trim()} className="rounded-xl h-10 gap-1">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : gardens.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No shared gardens yet.</p>
        ) : (
          <ul className="space-y-2">
            {gardens.map((g) => {
              const owner = g.owner_id === uid;
              return (
                <li key={g.id} className="rounded-2xl bg-card border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{g.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {owner ? "Owner" : "Member"} · code {g.invite_code}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(g.invite_code)} aria-label="Copy invite link">
                        <Copy className="w-4 h-4" />
                      </Button>
                      {owner ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(g)} aria-label="Delete garden">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => leave(g)} aria-label="Leave garden">
                          <LogOut className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
