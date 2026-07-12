export type DestinationType =
  | "google_review"
  | "website"
  | "menu"
  | "restaurant_booking"
  | "accommodation_booking"
  | "feedback"
  | "wifi"
  | "loyalty"
  | "event"
  | "social_media"
  | "custom";

export const DESTINATION_TYPES: { value: DestinationType; label: string }[] = [
  { value: "google_review", label: "Google review" },
  { value: "website", label: "Website" },
  { value: "menu", label: "Menu" },
  { value: "restaurant_booking", label: "Restaurant booking" },
  { value: "accommodation_booking", label: "Accommodation booking" },
  { value: "feedback", label: "Feedback form" },
  { value: "wifi", label: "Wi-Fi" },
  { value: "loyalty", label: "Loyalty program" },
  { value: "event", label: "Event" },
  { value: "social_media", label: "Social media" },
  { value: "custom", label: "Custom" },
];

export function destinationLabel(t: DestinationType | string): string {
  return DESTINATION_TYPES.find((d) => d.value === t)?.label ?? "Custom";
}

export function isValidHttpsUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export type EffectiveStatus = "active" | "paused" | "expired" | "archived";

export function computeEffectiveStatus(
  status: string,
  expires_at: string | null,
): EffectiveStatus {
  if (status === "archived") return "archived";
  if (status === "paused") return "paused";
  if (expires_at && new Date(expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

export function statusLabel(s: EffectiveStatus): string {
  return { active: "Active", paused: "Paused", expired: "Expired", archived: "Archived" }[s];
}

export function statusBadgeVariant(
  s: EffectiveStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (s === "active") return "default";
  if (s === "paused") return "secondary";
  if (s === "expired") return "destructive";
  return "outline";
}
