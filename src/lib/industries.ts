// Industry landing-page content. Each entry is hand-written for that trade —
// placements, objections and FAQs differ genuinely between them.

export type IndustryPlacement = {
  where: string;
  format: string;
  why: string;
};

export type Industry = {
  slug: string;
  name: string;
  /** Used in nav, cards and breadcrumbs. */
  shortName: string;
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroSubtitle: string;
  /** Two or three paragraphs of unique page copy. */
  intro: string[];
  placements: IndustryPlacement[];
  /** Format ids from src/lib/qr-formats.ts that suit this trade. */
  packFormatIds: string[];
  packName: string;
  packBlurb: string;
  timing: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
};

export const INDUSTRIES: Industry[] = [
  {
    slug: "hotels",
    name: "Hotels",
    shortName: "Hotels",
    metaTitle: "Google Review QR Codes for Hotels | GuestReview Pro",
    metaDescription:
      "Room-by-room Google review QR codes for hotels: compendium inserts, bedside cards, lift posters and reception signs, with scan analytics per placement.",
    heroTitle: "Google review QR codes built for hotel guest journeys",
    heroSubtitle:
      "A hotel stay has a dozen quiet moments where a guest is happy and idle. Put a review code in the right ones and measure which floor, which room type and which touchpoint actually earns the scan.",
    intro: [
      "Hotels have the longest customer journey of any hospitality business, and that is the advantage. A guest passes reception twice, spends hours in the room, waits for a lift and settles a bill — all before they leave. Rather than asking once at check-out, when the guest is rushing for a taxi, you can place the same review destination across several calm moments and let the guest choose.",
      "The catch is attribution. If every printed asset carries the same code you never learn whether the compendium insert or the bedside card did the work. GuestReview Pro lets you create a separate code per placement while pointing every one of them at the same Google review form, so scan counts tell you where to invest the next print run.",
      "Because codes are dynamic, a rebrand, a property-name change or a new Google Business Profile does not force a reprint of every room in the building. You update the destination once and the printed codes keep working.",
    ],
    placements: [
      {
        where: "In-room compendium",
        format: "A6 insert, 105 × 148 mm",
        why: "The guest is seated, unhurried and already reading hotel information. Highest scan rate in most properties.",
      },
      {
        where: "Bedside table",
        format: "DL card, 99 × 210 mm",
        why: "Caught during evening phone time. Works best with a short line about the stay rather than a generic 'review us'.",
      },
      {
        where: "Reception desk",
        format: "A5 sign in an acrylic stand",
        why: "Visible during check-out conversation, so staff can point at it instead of reciting a link.",
      },
      {
        where: "Lift lobby",
        format: "A4 poster",
        why: "Repeat exposure on every floor. Needs a larger code — scanning distance is typically 1.5–2 m.",
      },
      {
        where: "Key-card wallet",
        format: "86 × 54 mm insert",
        why: "Travels with the guest for the whole stay and survives the room being serviced.",
      },
      {
        where: "Bathroom mirror",
        format: "100 × 100 mm waterproof vinyl",
        why: "Long dwell time. Use waterproof stock — standard vinyl lifts in humidity.",
      },
    ],
    packFormatIds: [
      "reception-a5",
      "compendium-a6",
      "bedside-dl",
      "keycard-wallet",
      "lift-a4",
      "mirror-100",
    ],
    packName: "Hotel pack",
    packBlurb:
      "Six print-ready assets covering reception, room, bathroom and circulation areas, each validated for its real scanning distance.",
    timing: [
      {
        title: "Day two, not check-out",
        body: "Guests who have slept a night have an opinion; guests leaving have a train to catch. In-room placements collect reviews mid-stay.",
      },
      {
        title: "After a resolved problem",
        body: "A guest whose issue was fixed well is often your most enthusiastic reviewer. Reception placement makes that easy to act on.",
      },
      {
        title: "Never filtered",
        body: "Every guest sees the same code and the same public review form. Screening who gets asked breaches Google's policies.",
      },
    ],
    faqs: [
      {
        q: "Should each room have its own QR code?",
        a: "Rarely. One code per placement type — compendium, bedside, mirror — gives you useful comparison without producing hundreds of codes to manage. Larger groups sometimes use one code per floor or wing.",
      },
      {
        q: "Can we use one code across multiple properties?",
        a: "You should not. Each property has its own Google Business Profile and review form, so each needs its own destination. The Business plan covers up to 10 properties with portfolio reporting.",
      },
      {
        q: "What size should the lift poster QR code be?",
        a: "Around one tenth of the scanning distance. At two metres that means a code of roughly 200 mm, which is why lift artwork is A3 or larger in most properties.",
      },
      {
        q: "Will housekeeping damage in-room codes?",
        a: "Compendium inserts and key-card wallets survive best. Mirror stickers should be waterproof vinyl, and bedside cards are cheap enough to replace on a quarterly cycle.",
      },
    ],
  },
  {
    slug: "motels",
    name: "Motels",
    shortName: "Motels",
    metaTitle: "Google Review QR Codes for Motels | GuestReview Pro",
    metaDescription:
      "Simple, low-cost Google review QR codes for motels: room cards, office window decals and key-tag inserts, designed for short stays and no front-desk staff.",
    heroTitle: "Review QR codes for motels with short stays and small teams",
    heroSubtitle:
      "Most motel guests arrive late, leave early and never speak to anyone twice. The review ask has to work without a conversation.",
    intro: [
      "Motels rarely have the staffing to ask for reviews verbally, and the guest contact window is often under twelve hours. That makes printed placement the whole strategy: whatever is in the room, on the door or in the office window is doing the asking.",
      "It also makes cost matter. A motel does not need a six-piece marketing pack — it needs one durable room card, one window decal for the office and possibly a key-tag insert. GuestReview Pro's free plan covers a single business and a single code, which is enough to run a real motel programme before paying anything.",
      "Because guests often book on the road, the same code that collects reviews also builds the profile that the next driver sees when they search for a room nearby. Reviews and occupancy are more tightly linked here than in almost any other trade.",
    ],
    placements: [
      {
        where: "Room desk or bedside",
        format: "A6 counter card",
        why: "The only guaranteed touchpoint in a short stay. Keep the message to one line.",
      },
      {
        where: "Office window",
        format: "150 × 150 mm window decal",
        why: "Visible at late check-in when the office is closed and nobody is there to ask.",
      },
      {
        where: "Room door interior",
        format: "60 mm circular sticker",
        why: "Seen on the way out, when a guest has just decided the stay was fine.",
      },
      {
        where: "Key tag or key drop",
        format: "86 × 54 mm insert",
        why: "Pairs with the departure routine at unstaffed properties.",
      },
      {
        where: "Breakfast or vending area",
        format: "A6 landscape card",
        why: "The one shared space many motels have, and a natural pause point.",
      },
    ],
    packFormatIds: [
      "a6-portrait",
      "window-decal-150",
      "sticker-circle-60",
      "keycard-wallet",
      "a6-landscape",
    ],
    packName: "Motel essentials",
    packBlurb:
      "A five-piece, low-cost set aimed at short stays and unstaffed check-in, printable on a single A3 sheet at most trade printers.",
    timing: [
      {
        title: "Before the guest drives away",
        body: "Departure is the only reliable moment. Door and key-drop placements catch it without any staff involvement.",
      },
      {
        title: "Late arrivals",
        body: "A window decal keeps the ask alive when the office closed hours before the guest arrived.",
      },
      {
        title: "One code, one destination",
        body: "Keep every asset pointed at the same Google review form so the profile that ranks locally is the one being fed.",
      },
    ],
    faqs: [
      {
        q: "Is one QR code enough for a motel?",
        a: "Often yes. If you print a room card and a window decal from the same code, you lose placement comparison but keep the programme simple and free.",
      },
      {
        q: "Do we need laminated cards?",
        a: "Room cards last far longer laminated or printed on 350 gsm silk. Anything on an exterior window should be vinyl rather than paper.",
      },
      {
        q: "Will guests scan without an app?",
        a: "Yes. Every current iPhone and Android camera reads QR codes natively, with no app and no login.",
      },
      {
        q: "Can we change the destination if we join a franchise?",
        a: "Yes. Codes are dynamic, so a new Google Business Profile means updating one field, not reprinting every room.",
      },
    ],
  },
  {
    slug: "restaurants",
    name: "Restaurants",
    shortName: "Restaurants",
    metaTitle: "Google Review QR Codes for Restaurants | GuestReview Pro",
    metaDescription:
      "Table tents, bill-fold cards and window stickers with Google review QR codes for restaurants — sized for real table distances and measured per placement.",
    heroTitle: "Table-tent and bill-fold review QR codes for restaurants",
    heroSubtitle:
      "The gap between the last course and the card machine is the highest-intent moment in hospitality. A well-placed code turns it into a review.",
    intro: [
      "Restaurant reviews are won at the end of the meal, when the guest is full, relaxed and waiting. That window is short — usually the two or three minutes around the bill — and it is the reason folded table tents and bill-fold inserts outperform posters by a wide margin.",
      "Size is the common failure. A code printed at 20 mm on a table tent sits roughly 500 mm from a diner's phone and scans slowly in low restaurant lighting. GuestReview Pro validates the printed size, the quiet zone and the contrast against the real physical dimensions of the piece, and warns before you send it to a printer.",
      "Folded pieces are handled as true production artwork: front and back panels, fold lines, bleed and a proof preview, so a table tent that looks right on screen also folds correctly on 350 gsm stock.",
    ],
    placements: [
      {
        where: "Dining table",
        format: "Folded A5 or A6 table tent",
        why: "Present for the whole meal, and read during the natural lull before dessert.",
      },
      {
        where: "Bill fold or receipt tray",
        format: "86 × 54 mm or DL card",
        why: "Highest intent point of the entire visit — the guest has just decided how the meal went.",
      },
      {
        where: "Front window or door",
        format: "150 × 150 mm decal",
        why: "Catches walk-past traffic and reassures people choosing between two places on the street.",
      },
      {
        where: "Bar top or counter",
        format: "80 mm circular sticker",
        why: "Works for drinks-only visits and takeaway collection, which table tents miss entirely.",
      },
      {
        where: "Takeaway packaging",
        format: "60 mm circular sticker",
        why: "The only touchpoint for delivery and collection orders.",
      },
      {
        where: "Toilets and corridor",
        format: "A5 poster",
        why: "Long dwell time, no distractions, and away from the table so it never feels like pressure.",
      },
    ],
    packFormatIds: [
      "tent-a5",
      "a6-portrait",
      "dl-portrait",
      "window-decal-150",
      "sticker-circle-80",
      "poster-a4-p",
    ],
    packName: "Restaurant pack",
    packBlurb:
      "Table tents, counter cards, a window decal and takeaway stickers — the full front-of-house set with true folded artwork.",
    timing: [
      {
        title: "With the bill, not with the starter",
        body: "Ask when the experience is complete. Table tents get read all meal but scanned at the end.",
      },
      {
        title: "Cover takeaway too",
        body: "Delivery and collection customers never see a table tent. A packaging sticker is the only way to reach them.",
      },
      {
        title: "Same ask for everyone",
        body: "No pre-screening, no 'were you happy?' step. Review gating breaches Google's policies and can cost you the profile.",
      },
    ],
    faqs: [
      {
        q: "How big should a QR code be on a table tent?",
        a: "About 30–40 mm on an A6 tent and 40–45 mm on an A5. Diners scan from roughly 300–500 mm and restaurant lighting is usually dim, so err larger.",
      },
      {
        q: "Do table tents work better than bill-fold cards?",
        a: "They get more exposure; bill-fold cards get more scans per exposure. Running one code on each for a fortnight tells you which is true for your room.",
      },
      {
        q: "Can we offer a discount for leaving a review?",
        a: "No. Incentivised reviews breach Google's policies. You can thank people for reviewing generally, but never condition a reward on leaving one.",
      },
      {
        q: "Will a dark table tent design still scan?",
        a: "Yes, if the contrast holds. Validation checks the contrast ratio between the code and its background and blocks combinations that read unreliably.",
      },
    ],
  },
  {
    slug: "cafes",
    name: "Cafés",
    shortName: "Cafés",
    metaTitle: "Google Review QR Codes for Cafés and Coffee Shops | GuestReview Pro",
    metaDescription:
      "Counter stickers, cup-sleeve codes and window decals for cafés. Fast, low-friction Google review QR codes designed for two-minute visits and regulars.",
    heroTitle: "Review QR codes for cafés, where the visit lasts two minutes",
    heroSubtitle:
      "Coffee customers do not linger over a bill. The ask has to sit exactly where their hands and eyes already are: the counter, the cup and the pick-up point.",
    intro: [
      "A café visit can be over in ninety seconds. There is no bill fold, often no table service and frequently no seat at all. That rules out most of the restaurant playbook and puts the weight on three surfaces: the payment counter, the collection point and the cup itself.",
      "Regulars change the maths too. Someone who visits four times a week will walk past a poster hundreds of times without reading it, so a café programme benefits from rotating placement and refreshing artwork rather than printing once and forgetting. Scan analytics by placement show when a sticker has gone invisible.",
      "Small independents also tend to print in-house or in short runs. Every GuestReview Pro export is a real print-ready file at true physical dimensions, so a 60 mm circular sticker is genuinely 60 mm whether it goes to a trade printer or a desktop sheet of labels.",
    ],
    placements: [
      {
        where: "Payment counter",
        format: "80 mm circular sticker",
        why: "Eyes are already down at the card terminal. The single highest-scanning café placement.",
      },
      {
        where: "Collection point",
        format: "A6 counter card",
        why: "Customers wait here with a free hand and nothing to do for thirty seconds.",
      },
      {
        where: "Cup sleeve or lid",
        format: "60 mm circular sticker",
        why: "Reaches takeaway customers who never stop moving inside the shop.",
      },
      {
        where: "Front window",
        format: "150 × 150 mm decal",
        why: "Works on the queue outside and on passers-by comparing two cafés.",
      },
      {
        where: "Loyalty card",
        format: "86 × 54 mm card back",
        why: "Regulars carry it, and it is the one thing they look at repeatedly.",
      },
      {
        where: "Community board",
        format: "A5 poster",
        why: "Good for seated customers with laptops and long dwell times.",
      },
    ],
    packFormatIds: [
      "sticker-circle-80",
      "a6-portrait",
      "sticker-circle-60",
      "window-decal-150",
      "keycard-wallet",
      "poster-a5-p",
    ],
    packName: "Café pack",
    packBlurb:
      "Counter and cup stickers plus a collection-point card and window decal, all sized for short-range scanning under 400 mm.",
    timing: [
      {
        title: "At payment",
        body: "The one guaranteed pause in a café visit, and the moment the service quality is already known.",
      },
      {
        title: "While waiting for the order",
        body: "Thirty idle seconds at the collection point is more than enough time to scan and start typing.",
      },
      {
        title: "Refresh quarterly",
        body: "Regulars stop seeing familiar artwork. Rotating the design keeps scan rates from decaying.",
      },
    ],
    faqs: [
      {
        q: "What is the best QR code size for a counter sticker?",
        a: "30–45 mm. Café scanning distance is short — usually 200–400 mm — so a smaller code reads fine as long as the quiet zone is intact.",
      },
      {
        q: "Do cup-sleeve codes actually get scanned?",
        a: "They convert modestly but reach takeaway customers you have no other way of asking. Treat them as reach, not as your main placement.",
      },
      {
        q: "Can I print stickers myself?",
        a: "Yes. Exports are print-ready at true size with bleed, so a sheet of blank circular labels works as well as a trade printer.",
      },
      {
        q: "How do I know which placement is working?",
        a: "Create a separate code per surface. All of them point at the same review form, but scan counts are tracked separately.",
      },
    ],
  },
  {
    slug: "retail",
    name: "Retail",
    shortName: "Retail",
    metaTitle: "Google Review QR Codes for Retail Stores | GuestReview Pro",
    metaDescription:
      "Till stickers, shelf-edge cards, receipt inserts and window decals with Google review QR codes for retail — plus digital badges for your site and email.",
    heroTitle: "Google review QR codes for shops and retail counters",
    heroSubtitle:
      "Retail reviews come from the till, the bag and the follow-up email — three touchpoints most shops never use.",
    intro: [
      "Retail has an unusual advantage: the purchase itself is the proof of satisfaction. Someone who has just paid is far more likely to leave a review than someone browsing, which is why till-adjacent placement outperforms shop-floor posters consistently.",
      "The second advantage is the receipt and the bag. A packaging sticker or a receipt insert reaches the customer at home, hours after the visit, when they have used the product and formed a real opinion. Those reviews tend to be longer and more specific, which is exactly what future shoppers read.",
      "Retail is also the trade most likely to need digital assets alongside print. GuestReview Pro exports website review badges, email-signature banners and social-sized graphics from the same code, so the online storefront and the physical one point at the same profile.",
    ],
    placements: [
      {
        where: "Till or card terminal",
        format: "80 mm circular sticker",
        why: "Payment is the moment of highest satisfaction and lowest distraction.",
      },
      {
        where: "Bag or packaging",
        format: "60 mm circular sticker",
        why: "Reaches the customer at home once the product has actually been used.",
      },
      {
        where: "Shop window",
        format: "150 × 150 mm decal",
        why: "Builds trust with people deciding whether to come in at all.",
      },
      {
        where: "Shelf edge or fitting room",
        format: "100 × 70 mm rectangular sticker",
        why: "Useful where staff give advice — customers review the help, not just the product.",
      },
      {
        where: "Website and email",
        format: "400 × 400 px badge, 600 × 200 px banner",
        why: "Extends the same code to online orders and post-purchase emails.",
      },
      {
        where: "Counter display",
        format: "A6 counter card",
        why: "Gives staff something to point at without needing a script.",
      },
    ],
    packFormatIds: [
      "sticker-circle-80",
      "sticker-circle-60",
      "window-decal-150",
      "sticker-rect-100x70",
      "web-review-badge",
      "email-signature",
      "a6-portrait",
    ],
    packName: "Retail pack",
    packBlurb:
      "Till and packaging stickers, a window decal and matching digital badges for your website and email signature.",
    timing: [
      {
        title: "At the till",
        body: "Immediately after payment, while the experience is still the most recent thing that happened.",
      },
      {
        title: "In the bag",
        body: "A packaging sticker delays the ask until the product has been used, which produces more detailed reviews.",
      },
      {
        title: "In the follow-up email",
        body: "The email-signature banner uses the same code, so online and in-store reviews land on one profile.",
      },
    ],
    faqs: [
      {
        q: "Should the QR code be at the till or on the shop floor?",
        a: "The till, first. Shop-floor placement reaches browsers who have not bought anything and rarely converts.",
      },
      {
        q: "Can I put the same code on my website?",
        a: "Yes. Export the digital review badge from the same code so online and in-store activity build one profile.",
      },
      {
        q: "Does this work for multi-site retail?",
        a: "Each shop needs its own Google Business Profile and its own destination. The Business plan covers up to 10 sites with portfolio reporting.",
      },
      {
        q: "Can we ask only satisfied customers?",
        a: "No. Filtering who is invited is review gating and breaches Google's policies. Ask everyone identically.",
      },
    ],
  },
  {
    slug: "tourism",
    name: "Tourism",
    shortName: "Tourism",
    metaTitle: "Google Review QR Codes for Tours and Attractions | GuestReview Pro",
    metaDescription:
      "Review QR codes for tour operators and attractions: ticket-back codes, vehicle decals, guide lanyard cards and exit posters, built for outdoor scanning.",
    heroTitle: "Review QR codes for tour operators and attractions",
    heroSubtitle:
      "Visitors are at peak enthusiasm the moment an experience ends — and usually standing outside, in daylight, with a phone already in hand.",
    intro: [
      "Tourism has the strongest emotional peak of any trade on this list. Someone stepping off a boat, a bus or a zip line is more willing to leave a review than almost any other customer, but the window closes within minutes as they head to the car park.",
      "The environment is the constraint. Outdoor placement means sun glare, weather and scanning from a distance in a moving group, so codes must be larger, higher-contrast and printed on materials that survive rain and UV. Validation flags low-contrast designs and undersized codes before they reach a printer.",
      "Ticket backs and guide-carried cards solve the distance problem entirely: the code arrives in the visitor's hand rather than on a wall. Pair one of those with an exit-point poster and you cover both the individual and the group.",
    ],
    placements: [
      {
        where: "Ticket or wristband back",
        format: "86 × 54 mm insert",
        why: "Already in the visitor's hand and kept for the whole experience.",
      },
      {
        where: "Exit and gift-shop route",
        format: "A3 portrait poster",
        why: "Catches the whole group at the emotional peak. Needs a large code for 2 m+ scanning.",
      },
      {
        where: "Guide lanyard card",
        format: "A6 portrait card",
        why: "Lets a guide close the tour by holding it up rather than reciting a search phrase.",
      },
      {
        where: "Vehicle or vessel interior",
        format: "100 × 100 mm vinyl sticker",
        why: "Return journeys are dead time, which is ideal for a considered review.",
      },
      {
        where: "Booking confirmation and follow-up",
        format: "1200 × 630 px digital card",
        why: "Reaches visitors who left before seeing anything printed.",
      },
      {
        where: "Ticket window",
        format: "150 × 150 mm decal",
        why: "Visible in the queue, which is where expectations are set.",
      },
    ],
    packFormatIds: [
      "keycard-wallet",
      "poster-a3-p",
      "a6-portrait",
      "mirror-100",
      "sms-card",
      "window-decal-150",
    ],
    packName: "Tourism pack",
    packBlurb:
      "Ticket inserts, a large-format exit poster, guide cards and weatherproof vehicle stickers, all validated for outdoor scanning distances.",
    timing: [
      {
        title: "The last five minutes",
        body: "Ask before the group disperses. Guide-carried cards and exit posters both target that window.",
      },
      {
        title: "On the return journey",
        body: "Coach and boat returns give twenty quiet minutes — the best conditions for a long, useful review.",
      },
      {
        title: "Seasonal reprints",
        body: "Outdoor vinyl fades. Plan a reprint each season and use scan data to decide which placements are worth repeating.",
      },
    ],
    faqs: [
      {
        q: "How large should an outdoor review QR code be?",
        a: "At least one tenth of the scanning distance. An exit poster read from three metres needs a code around 300 mm, which usually means A2 or larger artwork.",
      },
      {
        q: "Will codes scan in bright sunlight?",
        a: "High-contrast dark-on-light codes scan best outdoors. Matte laminate reduces glare; gloss under direct sun is the usual cause of failed scans.",
      },
      {
        q: "Do international visitors need an app?",
        a: "No. Phone cameras read the code natively and the destination is your public Google review form, which works in any country.",
      },
      {
        q: "Can we use one code across several tours?",
        a: "You can, but separate codes per tour tell you which experience earns reviews. All of them can point at the same Google profile.",
      },
    ],
  },
  {
    slug: "salons",
    name: "Salons and spas",
    shortName: "Salons",
    metaTitle: "Google Review QR Codes for Salons, Barbers and Spas | GuestReview Pro",
    metaDescription:
      "Mirror stickers, styling-station cards and reception signs with Google review QR codes for salons, barbers and spas — built around the appointment routine.",
    heroTitle: "Review QR codes for salons, barbers and spas",
    heroSubtitle:
      "Your client has just looked in the mirror and liked what they saw. That reaction lasts about ninety seconds — put the code where they are already looking.",
    intro: [
      "Salon appointments are long, personal and end with a single decisive moment: the mirror reveal. Almost every review a salon earns traces back to those few seconds, which makes placement unusually precise here — the mirror and the payment desk do nearly all the work.",
      "Waiting time is the second opportunity. Clients arrive early, sit through colour development and wait for a stylist to finish, often with a phone in hand and nothing to read. A card at the styling station or in the waiting area collects reviews from people who are already bored rather than interrupting the service itself.",
      "Because salons rely so heavily on individual stylists, separate codes per station let you see which chairs generate the most engagement — useful for training, and for deciding who fronts your marketing.",
    ],
    placements: [
      {
        where: "Mirror at each station",
        format: "100 × 100 mm vinyl sticker",
        why: "Directly in the client's eyeline at the exact moment of the reveal.",
      },
      {
        where: "Styling station shelf",
        format: "A6 counter card",
        why: "Read during colour development or blow-dry waits, which can run 30 minutes or more.",
      },
      {
        where: "Reception and payment desk",
        format: "A5 sign in an acrylic stand",
        why: "Rebooking and payment happen here, so the client is stationary and satisfied.",
      },
      {
        where: "Waiting area",
        format: "A4 portrait poster",
        why: "Early arrivals have genuine idle time and no distractions.",
      },
      {
        where: "Appointment card",
        format: "86 × 54 mm card back",
        why: "Leaves with the client and survives past the appointment itself.",
      },
      {
        where: "Treatment room",
        format: "60 mm circular sticker",
        why: "For spas, where the mirror moment does not exist and the ask belongs at the end of the treatment.",
      },
    ],
    packFormatIds: [
      "mirror-100",
      "a6-portrait",
      "reception-a5",
      "poster-a4-p",
      "keycard-wallet",
      "sticker-circle-60",
    ],
    packName: "Salon and spa pack",
    packBlurb:
      "Mirror stickers, station cards, a reception sign and appointment-card artwork sized for close-range indoor scanning.",
    timing: [
      {
        title: "At the mirror reveal",
        body: "The strongest emotional peak in the appointment, and the one placement most salons miss.",
      },
      {
        title: "During waiting time",
        body: "Colour development and blow-dry waits are long, idle and perfect for writing a considered review.",
      },
      {
        title: "Never tie it to a discount",
        body: "Incentivising reviews breaches Google's policies. Ask everyone the same way, with nothing attached.",
      },
    ],
    faqs: [
      {
        q: "Should each stylist have their own QR code?",
        a: "It is worth doing in salons with four or more chairs. Reviews still land on one Google profile, but scan counts show which stations earn engagement.",
      },
      {
        q: "Will a mirror sticker damage the glass?",
        a: "Static-cling or removable vinyl lifts cleanly. Use waterproof stock in wash areas and treatment rooms.",
      },
      {
        q: "Can a client mention their stylist by name?",
        a: "That is entirely up to the client and happens naturally — it is one reason salon reviews are so valuable. You simply must not script or filter what they write.",
      },
      {
        q: "What about mobile and home-visit stylists?",
        a: "Use the digital review card in follow-up messages. It carries the same code without needing anything printed.",
      },
    ],
  },
  {
    slug: "medical",
    name: "Medical and dental",
    shortName: "Medical",
    metaTitle: "Google Review QR Codes for Clinics and Dental Practices | GuestReview Pro",
    metaDescription:
      "Discreet, compliance-aware Google review QR codes for clinics, dental and allied-health practices — reception signs, waiting-room cards and aftercare inserts.",
    heroTitle: "Review QR codes for clinics and dental practices",
    heroSubtitle:
      "Healthcare reviews need a lighter touch: never in the treatment room, never tied to an outcome, and never selective about who is asked.",
    intro: [
      "Patients choose clinics on trust, and trust is built almost entirely from public reviews. But healthcare is also the trade where an aggressive review programme does the most damage — asking mid-consultation, or asking only patients who seemed pleased, reads as pressure and creates real compliance risk.",
      "The workable approach is passive and universal. A discreet reception sign, a waiting-room card and an aftercare insert make the option visible to every patient without any staff member raising it during care. Nobody is singled out, and nobody is screened.",
      "GuestReview Pro is deliberately incapable of gating: there is no pre-screening step, no sentiment question and no way to route unhappy patients somewhere else. Every scan opens the same public Google review form, which is both a policy requirement and the right default for a clinical setting.",
    ],
    placements: [
      {
        where: "Reception desk",
        format: "A5 sign in an acrylic stand",
        why: "Visible during booking and payment, entirely optional and never raised by staff.",
      },
      {
        where: "Waiting room",
        format: "A4 portrait poster",
        why: "Long dwell time and no clinical context. The least intrusive placement available.",
      },
      {
        where: "Aftercare leaflet",
        format: "A6 insert",
        why: "Reaches the patient at home once treatment has settled and an opinion has formed.",
      },
      {
        where: "Appointment reminder card",
        format: "86 × 54 mm card back",
        why: "Travels with the patient without ever being handed over as a review request.",
      },
      {
        where: "Practice website",
        format: "400 × 400 px review badge",
        why: "Serves patients who never look at anything printed in the building.",
      },
      {
        where: "Corridor to exit",
        format: "A5 poster",
        why: "Seen on the way out rather than during care.",
      },
    ],
    packFormatIds: [
      "reception-a5",
      "poster-a4-p",
      "compendium-a6",
      "keycard-wallet",
      "web-review-badge",
      "poster-a5-p",
    ],
    packName: "Clinic pack",
    packBlurb:
      "A restrained, professional set for reception, waiting areas and aftercare, with muted templates suited to clinical environments.",
    timing: [
      {
        title: "Never during treatment",
        body: "Keep the ask out of consultation and treatment rooms entirely. Reception, waiting areas and aftercare only.",
      },
      {
        title: "Same visibility for everyone",
        body: "Passive placement means every patient sees the same option. No staff member decides who gets asked.",
      },
      {
        title: "Nothing about clinical outcomes",
        body: "Copy should reference the visit and the service, never results, recovery or specific treatments.",
      },
    ],
    faqs: [
      {
        q: "Is asking patients for Google reviews allowed?",
        a: "Asking openly and universally is generally acceptable, but professional bodies differ by country and specialty. Check your regulator's guidance — and never solicit reviews that reference clinical outcomes or identifiable treatment details.",
      },
      {
        q: "Can we screen out unhappy patients?",
        a: "No. Review gating breaches Google's policies, and GuestReview Pro cannot do it: every scan opens the same public review form.",
      },
      {
        q: "Should staff mention the code during appointments?",
        a: "We recommend against it. Passive placement in reception and waiting areas keeps the ask out of the clinical relationship entirely.",
      },
      {
        q: "Do the designs have to look promotional?",
        a: "No. The clean minimal template uses restrained typography and no star imagery, which suits clinical environments far better than a bold review layout.",
      },
    ],
  },
];

export function industryBySlug(slug: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}

export const INDUSTRY_SLUGS = INDUSTRIES.map((i) => i.slug);
