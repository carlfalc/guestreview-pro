import type { AccountRegionDTO } from "@/lib/account-region.functions";

const SOURCE_LABEL: Record<string, string> = {
  stripe_billing: "Verified Stripe billing address",
  business_address: "Verified business address",
  profile: "Account profile",
  ip_geolocation: "Server-side location",
  browser_locale: "Browser locale",
  fallback: "International fallback",
};

export function RegionDetectionStatus({ region }: { region: AccountRegionDTO }) {
  return (
    <div className="grid gap-2 text-xs sm:grid-cols-2">
      <Row label="Detection source">{SOURCE_LABEL[region.detectionSource] ?? region.detectionSource}</Row>
      <Row label="Confidence"><span className="capitalize">{region.confidence}</span></Row>
      <Row label="Detected on">{new Date(region.detectedAt).toLocaleDateString()}</Row>
      <Row label="Status">{region.isLocked ? "Locked" : "Unlocked"}</Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl bg-accent/40 p-3">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-0.5 text-sm">{children}</span>
    </div>
  );
}
