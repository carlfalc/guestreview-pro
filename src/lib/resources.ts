// Resource centre content library.
//
// Cornerstone, hand-written articles. Everything here is static data so the
// public routes can be server-rendered with zero database work — the resource
// centre must never depend on account state or Supabase.

export type ResourceCategory =
  | "google-reviews"
  | "qr-marketing"
  | "print-placement"
  | "local-seo"
  | "reputation-ops";

export const RESOURCE_CATEGORIES: {
  id: ResourceCategory;
  label: string;
  blurb: string;
}[] = [
  {
    id: "google-reviews",
    label: "Google reviews",
    blurb: "How review collection actually works, and what Google's policies allow.",
  },
  {
    id: "qr-marketing",
    label: "QR marketing",
    blurb: "Dynamic codes, scan analytics and campaign structure for physical spaces.",
  },
  {
    id: "print-placement",
    label: "Print & placement",
    blurb: "Sizing, materials, contrast and where codes earn the most scans.",
  },
  {
    id: "local-seo",
    label: "Local SEO",
    blurb: "Reviews, proximity and relevance in the Google Business Profile map pack.",
  },
  {
    id: "reputation-ops",
    label: "Reputation operations",
    blurb: "Responding, staff routines and keeping a review programme alive.",
  },
];

export type ResourceSection = {
  id: string;
  heading: string;
  body: string[];
  /** Optional bullet list rendered after the paragraphs. */
  bullets?: string[];
};

export type ResourceArticle = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: ResourceCategory;
  excerpt: string;
  readMinutes: number;
  /** ISO date of the last substantive content change. */
  updated: string;
  intro: string[];
  sections: ResourceSection[];
  faqs: { q: string; a: string }[];
  /** Internal linking targets. */
  relatedSlugs: string[];
  industrySlugs: string[];
  templateIds: string[];
};

export const RESOURCE_ARTICLES: ResourceArticle[] = [
  {
    slug: "how-to-get-more-google-reviews",
    title: "How to get more Google reviews without breaking the rules",
    metaTitle: "How to Get More Google Reviews (2026 Guide) | GuestReview Pro",
    metaDescription:
      "A practical, policy-safe system for collecting more Google reviews: when to ask, how to ask, what never to do and how QR placement turns intent into published reviews.",
    category: "google-reviews",
    excerpt:
      "Most businesses do not have a review problem — they have an asking problem. Here is the timing, wording and placement that turns satisfied customers into published reviews.",
    readMinutes: 8,
    updated: "2026-02-10",
    intro: [
      "Almost every business that complains about a thin review profile is quietly doing the same thing: asking rarely, asking late, and asking in a way that requires the customer to go and find something. The gap between a happy customer and a published review is usually three or four small frictions, and each one loses most of the people who were willing.",
      "This guide sets out a collection system that works without incentives, filtering or any of the tactics that put a Google Business Profile at risk. It assumes you have limited staff time and no appetite for chasing people by email.",
    ],
    sections: [
      {
        id: "why-asking-fails",
        heading: "Why the usual ask fails",
        body: [
          "The standard ask — “if you enjoyed today, please leave us a review” — puts four tasks on the customer: remember the request, unlock their phone, search for your business, and pick the right listing out of a map of similar names. Each step drops a large share of the people who genuinely intended to help.",
          "A printed code collapses those four steps into one. The customer points a camera at something already in front of them and lands directly on the review form for the correct listing. Nothing has to be remembered and nothing has to be searched.",
        ],
        bullets: [
          "Verbal ask, no artefact: a small fraction of willing customers follow through.",
          "Verbal ask plus a visible code at the point of the ask: dramatically higher completion, because the action happens immediately.",
          "Code with no ask at all: still collects reviews, but mostly from customers who were already delighted.",
        ],
      },
      {
        id: "timing",
        heading: "Get the timing right",
        body: [
          "The best moment is the point of satisfaction, not the point of payment. In a restaurant that is when plates are cleared, not when the card machine appears — the customer associates the ask with the meal rather than the bill. In a hotel it is mid-stay rather than check-out, because a departing guest is thinking about a train.",
          "For services with a delayed outcome — a salon colour, a repair, a medical follow-up — the satisfaction point may be days later. That is where a take-away artefact matters: an appointment card or a packaging label keeps the code in the customer's world after they leave yours.",
        ],
      },
      {
        id: "wording",
        heading: "Wording that converts without pressure",
        body: [
          "Short, specific and human beats polished marketing copy. “Enjoyed your coffee? Tell us in 30 seconds” outperforms “We value your feedback” because it names the experience and sets an honest time expectation.",
          "Avoid anything that steers sentiment. Wording such as “leave us a 5-star review” or “if you had a great experience, scan here” is what Google calls review gating, and it puts the listing at risk regardless of intent.",
        ],
        bullets: [
          "Name the moment: “Enjoyed your stay?”, “Happy with your cut?”",
          "Set the cost: “30 seconds”, “two taps”.",
          "Keep the destination honest: the same public form for every customer.",
          "Never mention a star rating, a discount or a prize.",
        ],
      },
      {
        id: "placement",
        heading: "Placement does most of the work",
        body: [
          "A code that is technically perfect and physically in the wrong place collects nothing. The three variables that matter are dwell time, eye line and light. A customer standing for eight seconds at a card terminal has time to scan; a customer walking past a wall poster does not.",
          "Run more than one placement and give each its own code. Scan counts then tell you which surface earns its printing cost, which is far more useful than a single aggregate number.",
        ],
      },
      {
        id: "measure",
        heading: "Measure scans, then measure published reviews",
        body: [
          "Scans and reviews are different metrics and both matter. A high scan count with few new reviews usually means the destination is wrong — the code is landing on a profile page rather than the review form, or on the wrong listing entirely.",
          "A low scan count with a high conversion rate means placement, not messaging, is the constraint. Add surfaces before you rewrite copy.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I offer a discount for leaving a review?",
        a: "No. Incentivised reviews breach Google's policies and can result in review removal or profile penalties. You can thank people, but the thank-you cannot be contingent on leaving a review.",
      },
      {
        q: "Can I ask only happy customers?",
        a: "No. Filtering or gating — routing satisfied customers to Google and unhappy ones to a private form — is explicitly prohibited. Every customer must see the same public review destination.",
      },
      {
        q: "How many reviews should I aim for each month?",
        a: "A steady trickle beats a burst. A sudden spike of reviews after months of silence looks unnatural and is more likely to be filtered. Consistent weekly collection is both safer and better for ranking.",
      },
    ],
    relatedSlugs: [
      "google-review-qr-code-guide",
      "qr-code-size-and-placement",
      "responding-to-google-reviews",
    ],
    industrySlugs: ["restaurants", "cafes", "hotels"],
    templateIds: ["counter-circle-mint", "tent-a5-restaurant", "reception-a5-hotel"],
  },
  {
    slug: "google-review-qr-code-guide",
    title: "Google review QR codes: how they work end to end",
    metaTitle: "Google Review QR Code Guide: Setup, Links & Tracking | GuestReview Pro",
    metaDescription:
      "What a Google review QR code actually does, how to find the correct review link, why dynamic codes matter and how to track scans per placement.",
    category: "qr-marketing",
    excerpt:
      "From Google Business Profile to printed sticker: the full chain, including the difference between a static code and a dynamic one you can re-point later.",
    readMinutes: 7,
    updated: "2026-02-10",
    intro: [
      "A Google review QR code is not a special kind of code. It is an ordinary QR code whose destination happens to be your Google review form. Everything that makes one good or bad is in the destination, the redirect and the print.",
      "This article walks the whole chain so you can tell the difference between a code that will still work in two years and one that will quietly break the first time something changes.",
    ],
    sections: [
      {
        id: "destination",
        heading: "Step one: the correct destination",
        body: [
          "Google exposes a direct review link from your Business Profile. That link opens the write-a-review dialog for one specific listing rather than a search result or a profile overview. If your code lands anywhere else, the customer has to hunt for the review button and most will not.",
          "Multi-location businesses need one destination per location. A shared code across sites merges reviews onto whichever listing you picked, which distorts local ranking for every other site.",
        ],
      },
      {
        id: "static-vs-dynamic",
        heading: "Static versus dynamic codes",
        body: [
          "A static code encodes the destination directly in the printed pattern. Change the destination and every printed asset becomes wrong — the only fix is a reprint.",
          "A dynamic code encodes a short redirect URL that you control. The printed pattern never changes; the destination behind it does. That matters more than people expect: rebrands, profile migrations, new listings after a move and simple typos are all recoverable without touching the physical world.",
        ],
        bullets: [
          "Static: free, permanent, unrecoverable if anything changes.",
          "Dynamic: re-pointable, measurable per placement, requires the redirect service to stay online.",
          "Anything printed at volume, or fixed to a wall, should be dynamic.",
        ],
      },
      {
        id: "redirect-speed",
        heading: "Why redirect speed matters",
        body: [
          "The redirect sits between the camera and the review form, so its latency is felt directly by the customer. A redirect that renders an application before forwarding adds a visible pause, and a pause on a phone camera is where people give up.",
          "A well-built redirect answers with an HTTP redirect at the edge — no application bundle, no login wall, no interstitial. GuestReview Pro scan links resolve this way, and every scan link is anonymous: a customer never sees an account screen.",
        ],
      },
      {
        id: "tracking",
        heading: "What the redirect lets you learn",
        body: [
          "Because the scan passes through your own URL, you can count it. Useful breakdowns are placement, device type and time of day — enough to decide where the next print run goes without collecting anything personal.",
          "Give each physical surface its own code. One code per business tells you almost nothing; one code per placement turns your print budget into an experiment.",
        ],
      },
      {
        id: "printing",
        heading: "Getting it onto the right material",
        body: [
          "Print is where good codes die. Low contrast, glossy laminate under downlights, and codes shrunk to fit a crowded layout account for most scanning failures in the field.",
          "Keep a quiet zone around the code, keep contrast high, and validate the artwork before it goes to a printer. Our template gallery lists the real dimensions and materials for each surface type.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do QR codes expire?",
        a: "The pattern itself never expires. A dynamic code stops working only if the redirect service behind it disappears, which is why the redirect provider matters as much as the design.",
      },
      {
        q: "Can I change where a printed code points?",
        a: "Only if it is dynamic. With a dynamic code you edit the destination and every printed asset immediately points somewhere new.",
      },
      {
        q: "Do customers need an app to scan?",
        a: "No. Every current iPhone and Android camera scans QR codes natively from the default camera app.",
      },
    ],
    relatedSlugs: [
      "how-to-get-more-google-reviews",
      "qr-code-size-and-placement",
      "dynamic-vs-static-qr-codes",
    ],
    industrySlugs: ["retail", "tourism", "medical"],
    templateIds: ["square-till-dark", "window-decal-street", "poster-a4-lift"],
  },
  {
    slug: "qr-code-size-and-placement",
    title: "QR code size, contrast and placement: a printing checklist",
    metaTitle: "QR Code Size & Placement Guide for Print | GuestReview Pro",
    metaDescription:
      "The 10:1 distance rule, minimum module size, quiet zones, contrast ratios, laminate choices and the placements that collect the most scans.",
    category: "print-placement",
    excerpt:
      "The physical rules that decide whether a code scans in one second or not at all — distance ratios, quiet zones, contrast and material.",
    readMinutes: 6,
    updated: "2026-02-10",
    intro: [
      "Scanning failures are almost never a data problem. They are a physics problem: the code is too small for the distance, too low in contrast, too glossy for the lighting, or crowded by artwork that eats the quiet zone.",
      "Use this as a pre-print checklist. Each rule below is the one that most often gets broken in real venues.",
    ],
    sections: [
      {
        id: "distance",
        heading: "The 10:1 distance rule",
        body: [
          "As a working rule, a QR code needs to be roughly one tenth of the intended scanning distance. A code scanned from arm's length (about 300 mm) can be 30 mm across. A code on a lift lobby wall read from two metres needs to be around 200 mm.",
          "Designers routinely violate this by dropping a 40 mm code onto an A3 poster. It looks balanced on screen and fails in the room.",
        ],
        bullets: [
          "Counter sticker, 250–350 mm distance: 30–40 mm code.",
          "Table tent, 400–600 mm: 40–60 mm code.",
          "Reception sign, 700 mm–1 m: 70–100 mm code.",
          "Wall poster, 1.5–2.5 m: 150–250 mm code.",
        ],
      },
      {
        id: "quiet-zone",
        heading: "Quiet zone and module size",
        body: [
          "A QR code needs a clear margin of at least four modules on every side. A module is one of the small squares in the pattern. Text, borders and background photography inside that margin reduce the reliable scanning distance sharply.",
          "Keep the printed module size at or above roughly 0.6 mm for offset or digital print. Below that, ink spread on uncoated stock starts merging modules.",
        ],
      },
      {
        id: "contrast",
        heading: "Contrast and colour",
        body: [
          "Dark pattern on a light background is the only reliably safe combination. Inverted codes — light modules on dark — scan on many phones and fail on enough of them that they are not worth the aesthetic.",
          "Aim for a contrast ratio comfortably above 4:1 between module and background. Brand colours are fine as long as the dark side is genuinely dark; mid-tone teal on cream is the classic failure.",
        ],
      },
      {
        id: "materials",
        heading: "Materials and finish",
        body: [
          "Matte or satin laminate is worth the small extra cost. Gloss laminate under directional lighting produces a specular hot spot exactly where the camera needs detail, and it is the single most common cause of a code that “only sometimes works”.",
          "Wet or humid areas — bathrooms, poolside, outdoor tables — need waterproof vinyl. Standard paper stock curls, and a curled code distorts the pattern geometry.",
        ],
      },
      {
        id: "placement",
        heading: "Choosing surfaces",
        body: [
          "Rank candidate surfaces by dwell time first. Where does a customer stand still, seated or waiting? Those places outperform high-traffic walkways every time.",
          "Then check the eye line. A code below waist height on a counter front is invisible to a standing adult holding a phone. Angle it, raise it, or move it.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the smallest a review QR code can be?",
        a: "For hand-held distances, around 25–30 mm across on good stock. Below that you are relying on the customer moving the phone very close, which most will not do.",
      },
      {
        q: "Can I put a logo in the middle of the code?",
        a: "A small centre logo is usually tolerated because of built-in error correction, but it consumes error-correction budget that print imperfections also need. Keep it under about 15% of the code area.",
      },
      {
        q: "Does a coloured background break scanning?",
        a: "Not if the contrast between the modules and the background stays high. Test the exact printed artwork, not the on-screen version.",
      },
    ],
    relatedSlugs: [
      "google-review-qr-code-guide",
      "how-to-get-more-google-reviews",
      "review-programme-staff-routine",
    ],
    industrySlugs: ["hotels", "restaurants", "salons"],
    templateIds: ["reception-a5-hotel", "poster-a3-exit", "mirror-square-salon"],
  },
  {
    slug: "dynamic-vs-static-qr-codes",
    title: "Dynamic vs static QR codes for review collection",
    metaTitle: "Dynamic vs Static QR Codes: Which to Print | GuestReview Pro",
    metaDescription:
      "A direct comparison of static and dynamic QR codes for Google review collection, covering cost, tracking, reprints, risk and multi-location use.",
    category: "qr-marketing",
    excerpt:
      "Static codes are free and permanent. Dynamic codes are editable and measurable. Here is which one each type of printed asset deserves.",
    readMinutes: 5,
    updated: "2026-02-10",
    intro: [
      "This is the decision most businesses get wrong once, expensively, when a Google listing changes and a thousand printed stickers stop pointing anywhere useful.",
    ],
    sections: [
      {
        id: "difference",
        heading: "The actual difference",
        body: [
          "A static code stores your destination inside the printed pattern. Nothing sits between the camera and Google, which is elegant and completely inflexible.",
          "A dynamic code stores a short link to a redirect you control. The redirect forwards to your review form. Because the pattern only ever encodes the short link, the destination can change forever afterwards.",
        ],
      },
      {
        id: "when-static",
        heading: "When static is fine",
        body: [
          "One-off, low-volume, short-lived assets: an event sign for a single weekend, a printed handout for a fixed campaign, a slide in a presentation. If a change would cost you nothing to reprint, static is fine.",
        ],
      },
      {
        id: "when-dynamic",
        heading: "When dynamic is the only sensible choice",
        body: [
          "Anything installed rather than handed out, anything printed in volume, and anything where you want to know which surface performed. That covers almost every permanent placement in a venue.",
          "It also covers every multi-location business, because dynamic codes let you keep one visual design across sites while each physical code points at its own listing.",
        ],
        bullets: [
          "Window decals and wall signage — installed, expensive to replace.",
          "Room and table assets — printed at volume.",
          "Anything you want scan analytics for.",
          "Any business with more than one Google listing.",
        ],
      },
      {
        id: "risk",
        heading: "The one real risk of dynamic codes",
        body: [
          "A dynamic code depends on its redirect staying online. If the provider disappears, so does the destination. Choose a provider whose redirect is a plain, fast, anonymous forward with no login requirement, and check that your scan URLs use a stable production domain rather than a temporary preview address.",
        ],
      },
    ],
    faqs: [
      {
        q: "Are dynamic QR codes slower to scan?",
        a: "The extra hop costs a fraction of a second when the redirect is served at the edge. A redirect that boots a web application first is noticeably slower and should be avoided.",
      },
      {
        q: "Can I convert a static code to dynamic later?",
        a: "Not without reprinting. The destination is baked into the printed pattern.",
      },
    ],
    relatedSlugs: [
      "google-review-qr-code-guide",
      "qr-code-size-and-placement",
      "local-seo-and-reviews",
    ],
    industrySlugs: ["motels", "retail", "tourism"],
    templateIds: ["window-decal-retail", "keycard-wallet-hotel", "digital-web-badge"],
  },
  {
    slug: "local-seo-and-reviews",
    title: "How Google reviews affect local search rankings",
    metaTitle: "Do Google Reviews Affect Local Rankings? | GuestReview Pro",
    metaDescription:
      "How review count, rating, recency and review text feed Google's local ranking signals, and what a realistic review cadence looks like for a small business.",
    category: "local-seo",
    excerpt:
      "Reviews influence the map pack through prominence, relevance and freshness. Here is what that means in practice for a single-site business.",
    readMinutes: 6,
    updated: "2026-02-10",
    intro: [
      "Google describes local ranking as a blend of relevance, distance and prominence. Reviews touch two of those three, which is why review programmes move rankings in a way that most on-page work does not.",
    ],
    sections: [
      {
        id: "prominence",
        heading: "Prominence: count and rating together",
        body: [
          "Prominence is Google's shorthand for how well known a place is. Review volume and average rating both feed it, and neither works alone: a 5.0 average from six reviews carries less weight than a 4.6 from two hundred.",
          "Volume also stabilises your rating. Once you pass roughly fifty reviews, a single bad experience stops being able to move the visible average, which changes how a business feels about collecting feedback at all.",
        ],
      },
      {
        id: "relevance",
        heading: "Relevance: what reviewers actually write",
        body: [
          "Review text is indexed. When customers describe what they came for — “gluten free brunch”, “late check-in”, “walk-in barber” — those phrases strengthen your association with those searches.",
          "You cannot script this, and you should not try. What you can do is ask at the moment tied to the service you want to be known for, which biases the language reviewers naturally use.",
        ],
      },
      {
        id: "recency",
        heading: "Recency and cadence",
        body: [
          "A profile with two hundred reviews, none newer than 2023, reads as stale to both Google and customers. Steady collection matters more than total volume past a certain point.",
          "A realistic target for a small venue is a handful of new reviews each week. That is achievable with placement alone and does not require staff to ask every customer.",
        ],
        bullets: [
          "Avoid bursts: fifty reviews in a week after a year of silence looks manufactured.",
          "Avoid gaps: three quiet months undoes a lot of visible momentum.",
          "Weekly consistency is the goal, not monthly campaigns.",
        ],
      },
      {
        id: "profile-hygiene",
        heading: "Profile hygiene multiplies the effect",
        body: [
          "Reviews cannot rescue an incomplete listing. Categories, hours, service attributes, photos and a correct primary category all gate how often you appear at all.",
          "Fix the profile first, then let review velocity compound on top of it.",
        ],
      },
    ],
    faqs: [
      {
        q: "How many reviews do I need to rank in the map pack?",
        a: "There is no threshold. What matters is how you compare with the other businesses competing for the same query in the same area — check their counts, not an abstract number.",
      },
      {
        q: "Do replies to reviews affect ranking?",
        a: "Google states that responding to reviews is a positive signal and it clearly affects conversion. Treat it as a standard operating routine rather than an optional courtesy.",
      },
      {
        q: "Does a one-star review damage rankings permanently?",
        a: "No. Its effect on your average shrinks as volume grows, and a good public reply often reads better to prospective customers than an unbroken run of praise.",
      },
    ],
    relatedSlugs: [
      "responding-to-google-reviews",
      "how-to-get-more-google-reviews",
      "dynamic-vs-static-qr-codes",
    ],
    industrySlugs: ["restaurants", "medical", "retail"],
    templateIds: ["digital-email-banner", "reception-clinic-calm", "counter-circle-mint"],
  },
  {
    slug: "responding-to-google-reviews",
    title: "Responding to Google reviews: templates and judgement calls",
    metaTitle: "How to Respond to Google Reviews (With Examples) | GuestReview Pro",
    metaDescription:
      "Response frameworks for positive, mixed and negative Google reviews, including what never to say publicly and how to handle reviews you believe are fake.",
    category: "reputation-ops",
    excerpt:
      "Replies are read by future customers, not past ones. A framework for positive, mixed, negative and suspicious reviews.",
    readMinutes: 6,
    updated: "2026-02-10",
    intro: [
      "The audience for a review reply is almost never the reviewer. It is the next person deciding whether to book, and they read your worst review and your response to it more carefully than anything else on the page.",
    ],
    sections: [
      {
        id: "positive",
        heading: "Positive reviews: short and specific",
        body: [
          "Thank them, mention the specific thing they mentioned, and stop. Long, template-identical replies under every five-star review read as automated and dilute the ones that matter.",
          "If they named a staff member, name that staff member back. It is the cheapest recognition programme a business will ever run.",
        ],
      },
      {
        id: "negative",
        heading: "Negative reviews: acknowledge, own, move offline",
        body: [
          "A good negative reply has three parts and no fourth: acknowledge what went wrong, state briefly what you are doing about it, and offer a direct route to sort it out. Do not relitigate the visit in public.",
          "Never dispute facts, never mention what the customer spent, and never imply they are lying — even when you are certain. Every defensive sentence costs you future bookings.",
        ],
        bullets: [
          "“Thank you for telling us — that is not the standard we hold ourselves to.”",
          "“We have changed X so it does not happen again.”",
          "“Please email us at … and we will make it right.”",
        ],
      },
      {
        id: "mixed",
        heading: "Mixed reviews are the most valuable",
        body: [
          "Three- and four-star reviews contain the most actionable detail and are read closely by careful buyers. Answer them with more substance than you give five-star reviews.",
        ],
      },
      {
        id: "fake",
        heading: "Suspected fake reviews",
        body: [
          "Report through the Business Profile, then reply calmly and factually — “we have no record of a visit matching this, and would like to help if we have made an error”. A composed reply protects you whether or not the report succeeds.",
          "Do not organise a counter-campaign of positive reviews. A sudden burst is more likely to trigger filtering than to bury the problem.",
        ],
      },
      {
        id: "cadence",
        heading: "Make it a routine, not a mood",
        body: [
          "Assign one person, one slot per week. Reviews answered within a few days read as attentive; reviews answered three months later read as damage control.",
        ],
      },
    ],
    faqs: [
      {
        q: "Should I reply to every review?",
        a: "Reply to every negative and mixed review, and to a meaningful share of positive ones. Complete coverage matters less than never leaving criticism unanswered.",
      },
      {
        q: "Can I get a review removed?",
        a: "Only if it breaches Google's content policies — spam, conflict of interest, offensive content or clearly not about your business. Disagreement is not grounds for removal.",
      },
    ],
    relatedSlugs: [
      "local-seo-and-reviews",
      "review-programme-staff-routine",
      "how-to-get-more-google-reviews",
    ],
    industrySlugs: ["hotels", "restaurants", "salons"],
    templateIds: ["tent-a6-compact", "bedside-dl-hotel", "digital-sms-card"],
  },
  {
    slug: "review-programme-staff-routine",
    title: "Building a review routine your staff will actually keep",
    metaTitle: "Staff Routines for Google Review Collection | GuestReview Pro",
    metaDescription:
      "How to embed review collection into shift routines: who asks, when, what they say, how to brief new starters and which numbers to review each month.",
    category: "reputation-ops",
    excerpt:
      "A review programme that depends on enthusiasm dies in three weeks. One built into existing shift routines survives staff turnover.",
    readMinutes: 5,
    updated: "2026-02-10",
    intro: [
      "The failure pattern is always the same: a burst of energy after installing the codes, then a slow return to nothing. The fix is not motivation — it is attaching the ask to something staff already do every shift.",
    ],
    sections: [
      {
        id: "anchor",
        heading: "Anchor the ask to an existing action",
        body: [
          "Pick a step that already happens: clearing plates, handing back a key, wrapping a purchase, booking the next appointment. The review ask rides on top of it and takes two seconds.",
          "Anything that requires staff to remember a separate task will be dropped during the first busy service.",
        ],
      },
      {
        id: "script",
        heading: "One sentence, everyone the same",
        body: [
          "Give the team a single sentence and a gesture toward the code. Variation is fine, but a default sentence means new starters are productive on day one.",
          "Keep the sentence policy-safe: no star ratings, no “if you had a good time”, no incentives.",
        ],
      },
      {
        id: "briefing",
        heading: "Brief new starters in the induction",
        body: [
          "Two lines in the induction document and one demonstration is enough. Where the codes are, what to say, and why it matters to the business.",
        ],
      },
      {
        id: "review",
        heading: "Look at the numbers monthly",
        body: [
          "Scan counts by placement, new reviews and average rating. Fifteen minutes a month is enough to spot a placement that has stopped working — often because something got moved, covered or scuffed.",
        ],
        bullets: [
          "Scans per placement, month over month.",
          "New reviews published.",
          "Any placement trending to zero — go and physically look at it.",
        ],
      },
    ],
    faqs: [
      {
        q: "Should staff be incentivised for review counts?",
        a: "Incentivising staff is permitted where incentivising customers is not, but tie it to the ask, not the outcome — rewarding review counts creates pressure to steer sentiment.",
      },
      {
        q: "How often should printed assets be replaced?",
        a: "Inspect quarterly. Counter stickers and table assets take the most damage; replace anything scuffed, curled or faded before it stops scanning.",
      },
    ],
    relatedSlugs: [
      "how-to-get-more-google-reviews",
      "responding-to-google-reviews",
      "qr-code-size-and-placement",
    ],
    industrySlugs: ["cafes", "retail", "motels"],
    templateIds: ["packaging-circle-small", "square-till-dark", "compendium-a6-hotel"],
  },
];

export const RESOURCE_SLUGS = RESOURCE_ARTICLES.map((a) => a.slug);

export function resourceBySlug(slug: string): ResourceArticle | undefined {
  return RESOURCE_ARTICLES.find((a) => a.slug === slug);
}

export function resourceCategory(id: string) {
  return RESOURCE_CATEGORIES.find((c) => c.id === id);
}

export function resourcesInCategory(id: ResourceCategory): ResourceArticle[] {
  return RESOURCE_ARTICLES.filter((a) => a.category === id);
}

export function relatedResources(article: ResourceArticle): ResourceArticle[] {
  return article.relatedSlugs
    .map((s) => resourceBySlug(s))
    .filter((a): a is ResourceArticle => Boolean(a) && a!.slug !== article.slug);
}
