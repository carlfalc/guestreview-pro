import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { AccountRegionDTO } from "@/lib/account-region.functions";

export function BillingRegionBadge({ region }: { region: AccountRegionDTO | null | undefined }) {
  if (!region) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="rounded-full gap-1 font-medium">
            <Lock className="h-3 w-3" />
            {region.currencyCode} pricing
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          Your pricing region is assigned automatically and cannot be changed manually.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
