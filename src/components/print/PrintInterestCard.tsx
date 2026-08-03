import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTrack } from "@/hooks/use-analytics";
import type { PrintInterestSource } from "@/lib/print-interest";
import { PrintWaitlistDialog } from "./PrintWaitlistDialog";

interface Props {
  source: PrintInterestSource;
  businessId?: string | null;
  className?: string;
}

/**
 * High-intent prompt for professional printing. Printing is NOT available yet,
 * so this card only ever collects demand — it never links to checkout.
 */
export function PrintInterestCard({ source, businessId, className }: Props) {
  const [open, setOpen] = useState(false);
  const track = useTrack();
  const seen = useRef(false);

  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    track("print_interest_card_viewed", { source });
  }, [track, source]);

  return (
    <>
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-primary" aria-hidden />
              <h3 className="text-base font-semibold">Need this professionally printed?</h3>
              <Badge variant="secondary">Coming soon</Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              We&rsquo;re preparing professional printing for stickers, counter cards, table tents,
              posters and hospitality packs. Tell us what you need and we&rsquo;ll prioritise the
              most requested products.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => {
                track("print_waitlist_opened", { source, mode: "join" });
                setOpen(true);
              }}
            >
              Join the print waitlist
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                track("print_waitlist_opened", { source, mode: "tell_us" });
                setOpen(true);
              }}
            >
              Tell us what you need
            </Button>
          </div>
        </CardContent>
      </Card>

      <PrintWaitlistDialog
        open={open}
        onOpenChange={setOpen}
        source={source}
        businessId={businessId ?? null}
      />
    </>
  );
}
