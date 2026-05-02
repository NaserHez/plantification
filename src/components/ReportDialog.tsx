import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "post" | "comment";
  postId: string;
  commentId?: string;
}

const REASONS = [
  { id: "spam", labelKey: "reportSpam" },
  { id: "harassment", labelKey: "reportHarassment" },
  { id: "inappropriate", labelKey: "reportInappropriate" },
  { id: "misinformation", labelKey: "reportMisinformation" },
  { id: "other", labelKey: "reportOther" },
] as const;

export default function ReportDialog({
  open,
  onOpenChange,
  targetType,
  postId,
  commentId,
}: ReportDialogProps) {
  const { t } = useLanguage();
  const [reason, setReason] = useState<string>("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const reporterId = userRes.user?.id;
      if (!reporterId) {
        toast.error("Please sign in");
        return;
      }
      const { error } = await supabase.from("post_reports").insert({
        reporter_id: reporterId,
        target_type: targetType,
        post_id: postId,
        comment_id: commentId || null,
        reason,
        details: details.trim() || null,
      });
      if (error) throw error;
      toast.success(t("reportSubmitted"));
      onOpenChange(false);
      setReason("spam");
      setDetails("");
    } catch (err: any) {
      toast.error(err.message || t("reportFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Flag className="w-4 h-4 text-destructive" />
            {t("reportTitle")}
          </DialogTitle>
          <DialogDescription>
            {targetType === "post" ? t("reportPost") : t("reportComment")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">
              {t("reportReason")}
            </Label>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {REASONS.map((r) => (
                <div key={r.id} className="flex items-center gap-2.5">
                  <RadioGroupItem value={r.id} id={`reason-${r.id}`} />
                  <Label htmlFor={`reason-${r.id}`} className="text-sm cursor-pointer flex-1">
                    {t(r.labelKey as any)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="report-details" className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("reportDetails")}
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={3}
              className="rounded-xl resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl gap-1.5"
            variant="destructive"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("reportSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
