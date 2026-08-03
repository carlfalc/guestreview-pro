import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { founderBadgeLabel, isFounderActive } from "@/lib/founder";
import { useMyFounderStatus } from "@/hooks/use-founder";

/**
 * "Founding Member #042". Renders nothing unless the account currently holds
 * an ACTIVE place — a released or refunded slot loses the badge.
 */
export function FounderBadge({ className }: { className?: string }) {
  const { data } = useMyFounderStatus();
  if (!data?.slot || !isFounderActive(data.slot)) return null;

  return (
    <Badge
      variant="outline"
      className={`gap-1.5 border-amber-400/50 bg-amber-400/10 text-amber-300 ${className ?? ""}`}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {founderBadgeLabel(data.slot.slotNumber)}
    </Badge>
  );
}
