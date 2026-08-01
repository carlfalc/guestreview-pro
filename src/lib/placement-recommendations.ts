// Goal-based QR placement recommendation engine.
//
// Pure data + pure functions. No database, no network, no React — safe to
// import from the wizard, from server functions and from tests.
//
// The engine turns three plain-language answers (industry, goals, where
// customers interact) into a concrete, ordered placement plan: destination,
// print format, wording, material and the reason behind each suggestion.
// It never fabricates performance statistics.

import type { DestinationType } from "@/lib/qr-destinations";
import { FORMATS, type BusinessFormat } from "@/lib/qr-formats";

export const RECOMMENDATION_VERSION = 1;

// ---------------------------------------------------------------- industries

export const INDUSTRIES = [
  { key: "hotel", label: "Hotel" },
  { key: "motel", label: "Motel" },
  { key: "restaurant", label: "Restaurant" },
  { key: "cafe", label: "Café" },
  { key: "bar", label: "Bar" },
  { key: "retail", label: "Retail" },
  { key: "tourism", label: "Tourism" },
  { key: "salon", label: "Salon or Beauty" },
  { key: "medical", label: "Medical or Dental" },
  { key: "real_estate", label: "Real Estate" },
  { key: "automotive", label: "Automotive" },
  { key: "professional", label: "Professional Services" },
  { key: "other", label: "Other" },
] as const;

export type IndustryKey = (typeof INDUSTRIES)[number]["key"];

export function isIndustryKey(v: unknown): v is IndustryKey {
  return typeof v === "string" && INDUSTRIES.some((i) => i.key === v);
}

export function industryLabel(key: string): string {
  return INDUSTRIES.find((i) => i.key === key)?.label ?? "Other";
}

/** Best-effort mapping from the free-text `businesses.industry` column. */
export function matchIndustry(raw: string | null | undefined): IndustryKey | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (isIndustryKey(v)) return v;
  const table: Array<[RegExp, IndustryKey]> = [
    [/hotel|resort|lodge|b&b|bed and breakfast/, "hotel"],
    [/motel|motor inn/, "motel"],
    [/restaurant|bistro|dining|eatery|takeaway/, "restaurant"],
    [/caf|coffee|bakery|brunch/, "cafe"],
    [/bar|pub|brewery|tavern|winery/, "bar"],
    [/retail|shop|store|boutique|grocer/, "retail"],
    [/tour|attraction|travel|adventure|activity/, "tourism"],
    [/salon|beauty|hair|spa|barber|nail/, "salon"],
    [/medical|dental|dentist|clinic|health|physio|vet/, "medical"],
    [/real estate|realty|property|letting/, "real_estate"],
    [/auto|garage|mechanic|car |tyre|panel/, "automotive"],
    [/account|law|consult|agency|professional|service/, "professional"],
  ];
  for (const [re, key] of table) if (re.test(v)) return key;
  return null;
}

// --------------------------------------------------------------------- goals

export const BUSINESS_GOALS = [
  {
    key: "reviews",
    label: "Increase Google reviews",
    destinations: ["google_review"],
    headline: "Loved your visit?",
    supportText: "It takes 30 seconds and helps us more than you know.",
    cta: "Leave a Google review",
  },
  {
    key: "feedback",
    label: "Collect private feedback",
    destinations: ["feedback"],
    headline: "How did we do?",
    supportText: "Tell us privately — we read every message.",
    cta: "Share feedback",
  },
  {
    key: "repeat_visits",
    label: "Increase repeat visits",
    destinations: ["loyalty"],
    headline: "Come back and save",
    supportText: "Scan to join and collect rewards on every visit.",
    cta: "Join now",
  },
  {
    key: "loyalty",
    label: "Promote loyalty",
    destinations: ["loyalty"],
    headline: "Join our regulars",
    supportText: "Members get first access to offers and events.",
    cta: "Join the club",
  },
  {
    key: "bookings",
    label: "Promote bookings",
    destinations: ["restaurant_booking", "accommodation_booking"],
    headline: "Book your next visit",
    supportText: "Pick a time that suits you in a couple of taps.",
    cta: "Book now",
  },
  {
    key: "menu",
    label: "Promote a menu",
    destinations: ["menu"],
    headline: "See today's menu",
    supportText: "Always up to date — no printing needed.",
    cta: "View the menu",
  },
  {
    key: "event",
    label: "Promote an event",
    destinations: ["event"],
    headline: "What's on",
    supportText: "See the line-up and grab your spot.",
    cta: "See events",
  },
  {
    key: "social",
    label: "Grow social followers",
    destinations: ["social_media"],
    headline: "Follow along",
    supportText: "Offers, new arrivals and behind the scenes.",
    cta: "Follow us",
  },
  {
    key: "mixed",
    label: "Mixed campaign",
    destinations: ["google_review", "menu", "loyalty", "social_media"],
    headline: "Stay connected",
    supportText: "Reviews, menus and offers all in one place.",
    cta: "Scan to explore",
  },
] as const;

export type GoalKey = (typeof BUSINESS_GOALS)[number]["key"];

export function isGoalKey(v: unknown): v is GoalKey {
  return typeof v === "string" && BUSINESS_GOALS.some((g) => g.key === v);
}

export function goalLabel(key: string): string {
  return BUSINESS_GOALS.find((g) => g.key === key)?.label ?? key;
}

export function goalDestinations(key: GoalKey): DestinationType[] {
  return [...(BUSINESS_GOALS.find((g) => g.key === key)?.destinations ?? ["google_review"])];
}

/** Accommodation businesses book rooms; everyone else books tables. */
function bookingDestination(industry: IndustryKey): DestinationType {
  return industry === "hotel" || industry === "motel" || industry === "tourism"
    ? "accommodation_booking"
    : "restaurant_booking";
}

/** The destination a goal implies for a given industry. */
export function destinationForGoal(goal: GoalKey, industry: IndustryKey): DestinationType {
  if (goal === "bookings") return bookingDestination(industry);
  return goalDestinations(goal)[0];
}

// ---------------------------------------------------------------- placements

export type PriorityKey = "high" | "medium" | "low";

export interface PlacementDef {
  key: string;
  name: string;
  /** Industries this placement is offered for. */
  industries: IndustryKey[];
  /** Default print/digital format from the catalogue. */
  formatId: string;
  /** Base weight (higher wins) before goal adjustments. */
  weight: number;
  /** Why this placement works — plain language, no invented statistics. */
  reason: string;
  /** Goals this placement is an especially strong fit for. */
  boostGoals?: GoalKey[];
  /** Goals this placement should not be offered for. */
  excludeGoals?: GoalKey[];
  /** Overrides the goal's default call to action. */
  cta?: string;
  /** Suggested location name when a physical spot needs one. */
  locationName?: string;
  digital?: boolean;
}

const FOOD: IndustryKey[] = ["restaurant", "cafe", "bar"];
const STAY: IndustryKey[] = ["hotel", "motel"];
const ALL_INDUSTRIES: IndustryKey[] = INDUSTRIES.map((i) => i.key);

export const PLACEMENTS: PlacementDef[] = [
  // ---- shared / front of house
  {
    key: "entrance",
    name: "Front entrance",
    industries: [...FOOD, "retail", "tourism", "salon", "medical", "automotive", "professional"],
    formatId: "window-decal-150",
    weight: 60,
    reason: "Seen by everyone arriving and passing by.",
    boostGoals: ["social", "menu", "event"],
  },
  {
    key: "window",
    name: "Window",
    industries: [...FOOD, "retail", "salon", "tourism", "real_estate", "automotive"],
    formatId: "window-decal-150",
    weight: 45,
    reason: "Works outside opening hours for passers-by.",
    boostGoals: ["social", "bookings", "event"],
  },
  {
    key: "counter",
    name: "Counter",
    industries: [...FOOD, "retail", "salon", "medical", "automotive", "professional"],
    formatId: "a6-portrait",
    weight: 88,
    reason: "The customer is standing still and unhurried.",
    boostGoals: ["reviews", "feedback", "loyalty", "repeat_visits"],
    locationName: "Counter",
  },
  {
    key: "eftpos",
    name: "EFTPOS / payment area",
    industries: [...FOOD, "retail", "salon", "automotive"],
    formatId: "acrylic-dl",
    weight: 95,
    reason: "The experience is freshest at the moment of payment.",
    boostGoals: ["reviews", "feedback"],
    cta: "How did we do?",
    locationName: "Payment area",
  },
  {
    key: "receipt",
    name: "Receipt",
    industries: [...FOOD, "retail", "salon", "automotive", "medical"],
    formatId: "sms-card",
    weight: 70,
    reason: "Travels home with the customer for later.",
    boostGoals: ["reviews", "loyalty", "repeat_visits"],
    digital: true,
  },
  {
    key: "bathroom",
    name: "Bathroom",
    industries: [...FOOD, "hotel", "motel"],
    formatId: "a6-portrait",
    weight: 40,
    reason: "A quiet moment with nothing else competing for attention.",
    excludeGoals: ["bookings"],
  },
  {
    key: "email_signature",
    name: "Email signature",
    industries: ALL_INDUSTRIES,
    formatId: "email-signature",
    weight: 35,
    reason: "Reaches every customer you already email.",
    digital: true,
  },
  {
    key: "website_badge",
    name: "Website badge",
    industries: ALL_INDUSTRIES,
    formatId: "web-review-badge",
    weight: 30,
    reason: "Turns existing website traffic into scans and clicks.",
    digital: true,
  },
  {
    key: "social_post",
    name: "Social post",
    industries: ALL_INDUSTRIES,
    formatId: "ig-story",
    weight: 28,
    reason: "Your followers already know you — the easiest ask.",
    digital: true,
  },
  {
    key: "custom_poster",
    name: "Wall poster",
    industries: ALL_INDUSTRIES,
    formatId: "poster-a4-p",
    weight: 38,
    reason: "A larger format for busier or wider spaces.",
  },

  // ---- hospitality (restaurant / cafe / bar)
  {
    key: "table",
    name: "Table",
    industries: FOOD,
    formatId: "tent-a6",
    weight: 92,
    reason: "Visible for the whole time the customer is seated.",
    boostGoals: ["reviews", "menu", "loyalty", "event"],
    locationName: "Tables",
  },
  {
    key: "menu",
    name: "Menu",
    industries: FOOD,
    formatId: "sticker-sq-60",
    weight: 66,
    reason: "Everyone picks up the menu at least once.",
    boostGoals: ["menu", "bookings", "social"],
  },
  {
    key: "bill_folder",
    name: "Bill folder",
    industries: [...FOOD],
    formatId: "dl-portrait",
    weight: 90,
    reason: "Handed over right after the meal ends.",
    boostGoals: ["reviews", "feedback"],
    cta: "Enjoyed your visit?",
  },
  {
    key: "takeaway",
    name: "Takeaway packaging",
    industries: ["restaurant", "cafe"],
    formatId: "sticker-circle-60",
    weight: 62,
    reason: "Reaches customers who never sit down with you.",
    boostGoals: ["reviews", "loyalty", "menu"],
  },
  {
    key: "cup_sleeve",
    name: "Cup sleeve",
    industries: ["cafe"],
    formatId: "sticker-rect-100x70",
    weight: 58,
    reason: "Held for as long as the drink lasts.",
    boostGoals: ["reviews", "loyalty"],
  },
  {
    key: "loyalty_card",
    name: "Loyalty card",
    industries: ["cafe", "restaurant", "retail", "salon"],
    formatId: "sms-card",
    weight: 55,
    reason: "Already in the wallet of your most frequent customers.",
    boostGoals: ["loyalty", "repeat_visits"],
  },

  // ---- accommodation
  {
    key: "reception",
    name: "Reception",
    industries: [...STAY, "salon", "medical", "tourism", "professional", "automotive"],
    formatId: "reception-a5",
    weight: 90,
    reason: "The first and last point of contact for every guest.",
    boostGoals: ["reviews", "bookings", "feedback"],
    locationName: "Reception",
  },
  {
    key: "guest_room",
    name: "Guest room",
    industries: STAY,
    formatId: "a6-portrait",
    weight: 86,
    reason: "Guests spend more time here than anywhere else.",
    boostGoals: ["reviews", "feedback", "menu"],
    locationName: "Guest rooms",
  },
  {
    key: "bedside",
    name: "Bedside",
    industries: STAY,
    formatId: "bedside-dl",
    weight: 78,
    reason: "Seen last thing at night and first thing in the morning.",
    boostGoals: ["reviews", "feedback"],
  },
  {
    key: "compendium",
    name: "Room compendium",
    industries: STAY,
    formatId: "compendium-a6",
    weight: 70,
    reason: "Where guests already look for information.",
    boostGoals: ["reviews", "menu", "event"],
  },
  {
    key: "keycard",
    name: "Key-card wallet",
    industries: STAY,
    formatId: "keycard-wallet",
    weight: 74,
    reason: "Carried by the guest for the whole stay.",
    boostGoals: ["reviews", "loyalty"],
  },
  {
    key: "lift",
    name: "Lift",
    industries: ["hotel"],
    formatId: "lift-a4",
    weight: 56,
    reason: "A captive audience with idle time.",
  },
  {
    key: "breakfast",
    name: "Breakfast area",
    industries: STAY,
    formatId: "tent-a6",
    weight: 64,
    reason: "A relaxed setting during the stay, not after it.",
    boostGoals: ["reviews", "menu"],
  },
  {
    key: "checkout_desk",
    name: "Checkout desk",
    industries: [...STAY, "retail"],
    formatId: "acrylic-dl",
    weight: 88,
    reason: "The natural moment to ask, as the visit wraps up.",
    boostGoals: ["reviews", "feedback"],
    cta: "How was your stay?",
    locationName: "Checkout desk",
  },
  {
    key: "post_stay",
    name: "Post-stay message",
    industries: [...STAY, "tourism"],
    formatId: "sms-card",
    weight: 68,
    reason: "Follows up once the guest is home and reflecting.",
    boostGoals: ["reviews", "loyalty"],
    digital: true,
  },

  // ---- retail
  {
    key: "checkout",
    name: "Checkout",
    industries: ["retail", "tourism"],
    formatId: "acrylic-a6",
    weight: 92,
    reason: "Every purchase passes through here.",
    boostGoals: ["reviews", "loyalty", "feedback"],
    locationName: "Checkout",
  },
  {
    key: "packaging",
    name: "Product packaging",
    industries: ["retail", "cafe", "restaurant"],
    formatId: "sticker-circle-60",
    weight: 60,
    reason: "Opened at home, when the customer is happiest.",
    boostGoals: ["reviews", "social", "loyalty"],
  },
  {
    key: "fitting_room",
    name: "Fitting room",
    industries: ["retail"],
    formatId: "sticker-sq-90",
    weight: 44,
    reason: "A private pause in the shopping trip.",
    excludeGoals: ["bookings"],
  },

  // ---- salon / medical / services
  {
    key: "mirror",
    name: "Mirror station",
    industries: ["salon"],
    formatId: "mirror-100",
    weight: 82,
    reason: "Directly in front of the client while they wait.",
    boostGoals: ["reviews", "social"],
  },
  {
    key: "appointment_card",
    name: "Appointment card",
    industries: ["salon", "medical", "automotive", "professional"],
    formatId: "sms-card",
    weight: 66,
    reason: "Kept until the next visit.",
    boostGoals: ["bookings", "repeat_visits", "loyalty"],
  },
  {
    key: "follow_up",
    name: "Follow-up message",
    industries: ["salon", "medical", "automotive", "professional", "real_estate"],
    formatId: "sms-card",
    weight: 72,
    reason: "Arrives once the result has been enjoyed for a day or two.",
    boostGoals: ["reviews", "feedback"],
    digital: true,
  },
  {
    key: "waiting_room",
    name: "Waiting area",
    industries: ["medical", "automotive", "professional", "salon"],
    formatId: "poster-a4-p",
    weight: 58,
    reason: "Waiting time is attention you already have.",
  },

  // ---- tourism / real estate / automotive extras
  {
    key: "ticket_desk",
    name: "Ticket desk",
    industries: ["tourism"],
    formatId: "acrylic-a6",
    weight: 84,
    reason: "Every visitor stops here before the experience starts.",
    boostGoals: ["bookings", "reviews"],
    locationName: "Ticket desk",
  },
  {
    key: "vehicle_handover",
    name: "Vehicle handover",
    industries: ["automotive"],
    formatId: "dl-portrait",
    weight: 86,
    reason: "The moment the job is judged as finished.",
    boostGoals: ["reviews", "feedback"],
  },
  {
    key: "property_signage",
    name: "Property signage",
    industries: ["real_estate"],
    formatId: "poster-a4-p",
    weight: 80,
    reason: "Turns kerbside interest into an enquiry.",
    boostGoals: ["bookings", "social"],
  },
];

export function placementByKey(key: string): PlacementDef | undefined {
  return PLACEMENTS.find((p) => p.key === key);
}

/** Journey options to show for a given industry, most useful first. */
export function placementsForIndustry(industry: IndustryKey): PlacementDef[] {
  return PLACEMENTS.filter((p) => p.industries.includes(industry)).sort(
    (a, b) => b.weight - a.weight,
  );
}

// ------------------------------------------------------------------ formats

export function formatById(id: string): BusinessFormat | undefined {
  return FORMATS.find((f) => f.id === id);
}

// --------------------------------------------------------------- blueprints

export interface Blueprint {
  key: string;
  label: string;
  industry: IndustryKey;
  goals: GoalKey[];
  placementKeys: string[];
  description: string;
}

export const BLUEPRINTS: Blueprint[] = [
  {
    key: "restaurant_reviews",
    label: "Restaurant review plan",
    industry: "restaurant",
    goals: ["reviews"],
    placementKeys: ["entrance", "table", "counter", "bill_folder", "receipt"],
    description: "Entrance, table, counter, bill folder and receipt.",
  },
  {
    key: "hotel_reviews",
    label: "Hotel review plan",
    industry: "hotel",
    goals: ["reviews"],
    placementKeys: ["reception", "guest_room", "bedside", "compendium", "lift"],
    description: "Reception, guest room, bedside card, compendium and lift.",
  },
  {
    key: "motel_reviews",
    label: "Motel review plan",
    industry: "motel",
    goals: ["reviews"],
    placementKeys: ["reception", "guest_room", "keycard", "checkout_desk", "post_stay"],
    description: "Reception, guest room, key-card wallet, checkout desk and post-stay message.",
  },
  {
    key: "cafe_reviews",
    label: "Café review plan",
    industry: "cafe",
    goals: ["reviews"],
    placementKeys: ["counter", "table", "receipt", "window", "loyalty_card"],
    description: "Counter, table, receipt, window and loyalty card.",
  },
  {
    key: "retail_reviews",
    label: "Retail review plan",
    industry: "retail",
    goals: ["reviews"],
    placementKeys: ["entrance", "checkout", "receipt", "packaging", "window"],
    description: "Entrance, checkout, receipt, packaging and window.",
  },
  {
    key: "salon_reviews",
    label: "Salon review plan",
    industry: "salon",
    goals: ["reviews"],
    placementKeys: ["reception", "mirror", "counter", "appointment_card", "follow_up"],
    description: "Reception, mirror, checkout, appointment card and follow-up message.",
  },
];

export function blueprintsForIndustry(industry: IndustryKey): Blueprint[] {
  return BLUEPRINTS.filter((b) => b.industry === industry);
}

// ------------------------------------------------------------- the engine

export interface RecommendationInput {
  industry: IndustryKey;
  goals: GoalKey[];
  /** Placement keys the owner ticked in step 3. Empty = recommend defaults. */
  placementKeys?: string[];
  /** Free-text placements the owner added themselves. */
  customPlacements?: Array<{ key: string; name: string }>;
  /** Placement keys that already have a live QR code on this business. */
  existingPlacementKeys?: string[];
  /** How many recommendations to return when nothing was ticked. */
  limit?: number;
}

export interface PlacementRecommendation {
  placementKey: string;
  placementName: string;
  priority: PriorityKey;
  score: number;
  goal: GoalKey;
  destinationType: DestinationType;
  formatId: string;
  formatName: string;
  material: string;
  minQrSizeMm: number;
  headline: string;
  supportText: string;
  ctaText: string;
  reason: string;
  locationName: string | null;
  /** True when a QR already exists on this business for the same placement. */
  duplicateOfExisting: boolean;
  /** 1-based rollout order. */
  order: number;
  custom: boolean;
}

function priorityFromScore(score: number): PriorityKey {
  if (score >= 85) return "high";
  if (score >= 55) return "medium";
  return "low";
}

/** Pick the goal this placement serves best. */
function goalForPlacement(def: PlacementDef | null, goals: GoalKey[]): GoalKey {
  if (goals.length === 0) return "reviews";
  if (!def) return goals[0];
  const boosted = goals.find((g) => def.boostGoals?.includes(g));
  if (boosted) return boosted;
  const allowed = goals.filter((g) => !def.excludeGoals?.includes(g));
  return allowed[0] ?? goals[0];
}

function wordingFor(goal: GoalKey, def: PlacementDef | null) {
  const g = BUSINESS_GOALS.find((x) => x.key === goal) ?? BUSINESS_GOALS[0];
  return {
    headline: g.headline,
    supportText: g.supportText,
    ctaText: def?.cta ?? g.cta,
  };
}

/**
 * Turn the wizard answers into an ordered placement plan.
 *
 * When the owner ticked placements we recommend exactly those. When they
 * ticked nothing we return the strongest options for their industry and goals.
 */
export function recommendPlacements(input: RecommendationInput): PlacementRecommendation[] {
  const goals = (input.goals ?? []).filter(isGoalKey);
  const activeGoals: GoalKey[] = goals.length ? goals : ["reviews"];
  const existing = new Set(input.existingPlacementKeys ?? []);
  const custom = input.customPlacements ?? [];
  const ticked = input.placementKeys ?? [];

  const candidates: Array<{ def: PlacementDef | null; key: string; name: string }> = [];

  if (ticked.length) {
    for (const key of ticked) {
      const def = placementByKey(key) ?? null;
      candidates.push({ def, key, name: def?.name ?? key });
    }
  } else {
    for (const def of placementsForIndustry(input.industry)) {
      if (def.excludeGoals && activeGoals.every((g) => def.excludeGoals!.includes(g))) continue;
      candidates.push({ def, key: def.key, name: def.name });
    }
  }
  for (const c of custom) {
    if (!c.key || candidates.some((x) => x.key === c.key)) continue;
    candidates.push({ def: null, key: c.key, name: c.name || c.key });
  }

  const scored = candidates.map(({ def, key, name }) => {
    const goal = goalForPlacement(def, activeGoals);
    const base = def?.weight ?? 50;
    const boost = def?.boostGoals?.some((g) => activeGoals.includes(g)) ? 12 : 0;
    const penalty = def?.excludeGoals?.some((g) => activeGoals.includes(g)) ? 20 : 0;
    const score = Math.max(1, Math.min(100, base + boost - penalty));
    const formatId = def?.formatId ?? "a6-portrait";
    const format = formatById(formatId);
    const wording = wordingFor(goal, def);
    return {
      placementKey: key,
      placementName: name,
      priority: priorityFromScore(score),
      score,
      goal,
      destinationType: destinationForGoal(goal, input.industry),
      formatId,
      formatName: format?.name ?? "A6 counter card",
      material: format?.material ?? "Print",
      minQrSizeMm: format?.minQrSize ?? 25,
      headline: wording.headline,
      supportText: wording.supportText,
      ctaText: wording.ctaText,
      reason: def?.reason ?? "A spot you told us your customers interact with.",
      locationName: def?.locationName ?? null,
      duplicateOfExisting: existing.has(key),
      order: 0,
      custom: !def,
    } satisfies PlacementRecommendation;
  });

  scored.sort((a, b) => b.score - a.score || a.placementName.localeCompare(b.placementName));
  const limited = ticked.length ? scored : scored.slice(0, input.limit ?? 6);
  return limited.map((r, i) => ({ ...r, order: i + 1 }));
}

/** A friendly default plan name. */
export function defaultPlanName(businessName: string, goals: GoalKey[]): string {
  const bn = (businessName || "Untitled").trim();
  const primary = goals[0];
  switch (primary) {
    case "reviews":
      return `${bn} review placement plan`;
    case "feedback":
      return `${bn} feedback placement plan`;
    case "bookings":
      return `${bn} bookings placement plan`;
    case "menu":
      return `${bn} menu placement plan`;
    case "event":
      return `${bn} event placement plan`;
    case "social":
      return `${bn} social placement plan`;
    case "loyalty":
    case "repeat_visits":
      return `${bn} loyalty placement plan`;
    default:
      return `${bn} placement plan`;
  }
}

/** Formats a plan should generate as printable marketing assets. */
export function packFormatsFor(recs: Array<{ formatId: string }>): string[] {
  const digital = new Set(["sms-card"]);
  const out: string[] = [];
  for (const r of recs) {
    if (digital.has(r.formatId)) continue;
    if (!out.includes(r.formatId)) out.push(r.formatId);
  }
  return out;
}

// -------------------------------------------------------------- checklist

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

/** The physical rollout checklist for a generated plan. */
export function buildChecklist(recs: PlacementRecommendation[]): ChecklistItem[] {
  const items: ChecklistItem[] = recs.map((r) => ({
    key: `place_${r.placementKey}`,
    label: `Print and place: ${r.placementName} (${r.formatName})`,
    done: false,
  }));
  items.push(
    { key: "test_all", label: "Scan and test every QR code on a phone", done: false },
    { key: "confirm_destination", label: "Confirm each destination opens correctly", done: false },
    { key: "train_staff", label: "Brief the team on when to mention it", done: false },
    { key: "review_7_days", label: "Review scan analytics after 7 days", done: false },
  );
  return items;
}

export function checklistProgress(items: ChecklistItem[]): number {
  if (!items.length) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}
