import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email: string;
  /** Called after the password is confirmed against Supabase. */
  onConfirmed: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
}

/**
 * Prompts the user to re-enter their password before a sensitive action.
 * Verifies by calling `signInWithPassword` — the current session stays valid
 * either way; failure just surfaces the auth error without side effects.
 */
export default function ReauthDialog({
  open, onOpenChange, email, onConfirmed,
  title = "Confirm it's you",
  description = "For your security, please re-enter your password to continue.",
  confirmLabel = "Confirm",
}: Props) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pw) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      setPw("");
      onOpenChange(false);
      await onConfirmed();
    } catch (e: any) {
      toast.error(e?.message === "Invalid login credentials"
        ? "Password didn't match. Try again."
        : (e?.message || "Could not verify password"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-serif">
            <Lock className="w-4 h-4 text-primary" /> {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Signed in as</Label>
          <Input value={email} disabled className="rounded-xl h-10 bg-muted" />
          <Label htmlFor="reauth-pw" className="text-xs text-muted-foreground pt-1 block">
            Password
          </Label>
          <Input
            id="reauth-pw"
            type="password"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            className="rounded-xl h-10"
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
          <Button onClick={submit} disabled={busy || !pw} className="rounded-xl">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
