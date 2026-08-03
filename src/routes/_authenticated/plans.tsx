import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountRegion } from "@/hooks/use-account-region";
import { RegionalPricingTable } from "@/components/billing/RegionalPricingTable";
import { useTrackOnce } from "@/hooks/use-analytics";
import { FounderPlanCard } from "@/components/founder/FounderPlanCard";

export const Route = createFileRoute("/_authenticated/plans")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — GuestReview Pro" },
      { name: "description", content: "Regional plan pricing for GuestReview Pro." },
    ],
  }),
});

function PricingPage() {
  const { data: region, isLoading } = useAccountRegion();
  useTrackOnce("pricing_viewed");

  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Plans & pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prices are shown in your account's billing currency. Pricing region is assigned
          automatically and cannot be changed manually.
        </p>
      </div>

      {isLoading || !region ? (
        <Card className="rounded-3xl border-border/70">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Preparing your regional settings…
          </CardContent>
        </Card>
      ) : (
        <>
          <FounderPlanCard region={region} />
          <RegionalPricingTable region={region} />
        </>
      )}
    </div>
  );
}
