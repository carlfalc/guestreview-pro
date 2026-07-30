import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitBetaFeedback, type FeedbackCategory } from "@/lib/feedback.functions";
import { useTrack } from "@/hooks/use-analytics";

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Something is broken" },
  { value: "confusing", label: "Something is confusing" },
  { value: "idea", label: "I have an idea" },
  { value: "praise", label: "This worked well" },
  { value: "other", label: "Something else" },
];

const RATINGS = [1, 2, 3, 4, 5];

/**
 * Floating beta feedback button. Available on every signed-in page; captures
 * the current route path (no query strings, no personal data).
 */
export function BetaFeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const submit = useServerFn(submitBetaFeedback);
  const track = useTrack();

  const mutation = useMutation({
    mutationFn: () => submit({ data: { category, message, rating, path } }),
    onSuccess: () => {
      track("feedback_submitted", { category, rated: rating != null });
      toast.success("Thanks — your feedback is with us.");
      setOpen(false);
      setMessage("");
      setRating(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send feedback."),
  });

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="fixed bottom-5 right-5 z-40 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus className="mr-2 h-4 w-4" />
        Feedback
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send beta feedback</DialogTitle>
            <DialogDescription>
              Tell us what happened or what you would change. We read every message.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as FeedbackCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-message">Your feedback</Label>
              <Textarea
                id="feedback-message"
                rows={5}
                maxLength={4000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What were you trying to do, and what happened?"
              />
            </div>

            <div className="space-y-2">
              <Label>How is the experience so far? (optional)</Label>
              <div className="flex gap-2">
                {RATINGS.map((r) => (
                  <Button
                    key={r}
                    type="button"
                    size="sm"
                    variant={rating === r ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setRating(rating === r ? null : r)}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              We store the page you were on ({path}) — nothing else about your device.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || message.trim().length < 3}
            >
              {mutation.isPending ? "Sending…" : "Send feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
