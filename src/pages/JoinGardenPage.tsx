import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function JoinGardenPage() {
  const { code } = useParams();
  const nav = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "signin">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("signin");
        return;
      }
      const { data, error } = await (supabase as any).rpc("join_shared_garden", { _code: code });
      if (error) {
        setStatus("error");
        setMsg(error.message === "invalid_code" ? "That invite code isn't valid." : error.message);
        return;
      }
      setStatus("ok");
      setTimeout(() => nav("/garden"), 1200);
    })();
  }, [code, nav]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <main className="max-w-sm w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-serif text-2xl">Join a shared garden</h1>
        {status === "loading" && <p className="text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Joining…</p>}
        {status === "ok" && <p className="text-primary flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> You're in! Redirecting…</p>}
        {status === "error" && (
          <>
            <p className="text-destructive flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4" /> {msg}</p>
            <Button onClick={() => nav("/")} variant="outline" className="rounded-xl">Go home</Button>
          </>
        )}
        {status === "signin" && (
          <>
            <p className="text-muted-foreground">Sign in to accept this invite. We'll bring you right back.</p>
            <Button onClick={() => nav("/")} className="rounded-xl">Sign in</Button>
          </>
        )}
      </main>
    </div>
  );
}
