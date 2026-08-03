import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitFounderFeedback } from "@/lib/founder.functions";
import { useRefreshFounder } from "@/hooks/use-founder";
import { useTrack } from "@/hooks/use-analytics";

function ScaleRow({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number | null;
  onChange: (value: number) => void;
}) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-full border text-sm transition ${
              value === n
                ? "border-transparent bg-foreground text-background"
                : "border-border/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Founders-only survey, offered 7 days after activation. */
export function FounderFeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const submit = useServerFn(submitFounderFeedback);
  const refresh = useRefreshFounder();
  const track = useTrack();
  const [saving, setSaving] = useState(false);
  const [setupEase, setSetupEase] = useState<number | null>(null);
  const [recommendScore, setRecommendScore] = useState<number | null>(null);
  const [nearlyStopped, setNearlyStopped] = useState("");
  const [mostImportantFeature, setMostImportantFeature] = useState("");
  const [missing, setMissing] = useState("");

  const send = async () => {
    setSaving(true);
    try {
      const result = await submit({
        data: { setupEase, recommendScore, nearlyStopped, mostImportantFeature, missing },
      });
      if (!result.ok) throw new Error(result.error ?? "Could not save your feedback.");
      track("founder_feedback_submitted", {});
      toast.success("Thank you — your feedback goes straight to the team.");
      refresh();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your feedback.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Founding member feedback</DialogTitle>
          <DialogDescription>
            Five short questions. Your answers shape what we build next.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <ScaleRow
            label="How easy was it to get set up?"
            min={1}
            max={5}
            value={setupEase}
            onChange={setSetupEase}
          />
          <div className="space-y-2">
            <Label htmlFor="nearly-stopped">What nearly stopped you from using it?</Label>
            <Textarea
              id="nearly-stopped"
              value={nearlyStopped}
              onChange={(e) => setNearlyStopped(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="most-important">Which feature matters most to you?</Label>
            <Textarea
              id="most-important"
              value={mostImportantFeature}
              onChange={(e) => setMostImportantFeature(e.target.value)}
              rows={2}
            />
          </div>
          <ScaleRow
            label="How likely are you to recommend GuestReview Pro?"
            min={0}
            max={10}
            value={recommendScore}
            onChange={setRecommendScore}
          />
          <div className="space-y-2">
            <Label htmlFor="missing">What is missing today?</Label>
            <Textarea
              id="missing"
              value={missing}
              onChange={(e) => setMissing(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={send} disabled={saving}>
            {saving ? "Sending…" : "Send feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
