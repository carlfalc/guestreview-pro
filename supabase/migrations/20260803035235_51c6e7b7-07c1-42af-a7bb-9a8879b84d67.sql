-- =========================================================
-- PRINT STORE MVP — catalogue, cart, proofs, orders
-- =========================================================

-- ---------- products ----------
CREATE TABLE public.print_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_key text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'sticker',
  shape text NOT NULL DEFAULT 'square',
  material text NOT NULL DEFAULT '',
  finish text NOT NULL DEFAULT '',
  artwork_format text NOT NULL DEFAULT 'pdf',
  width_mm numeric NOT NULL,
  height_mm numeric NOT NULL,
  bleed_mm numeric NOT NULL DEFAULT 3,
  safe_area_mm numeric NOT NULL DEFAULT 4,
  min_qr_mm numeric NOT NULL DEFAULT 25,
  print_sides integer NOT NULL DEFAULT 1,
  format_id text,
  production_days_min integer NOT NULL DEFAULT 2,
  production_days_max integer NOT NULL DEFAULT 5,
  shipping_class text NOT NULL DEFAULT 'parcel',
  supported_countries text[] NOT NULL DEFAULT ARRAY['*'],
  base_currency text NOT NULL DEFAULT 'NZD',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.print_products TO anon, authenticated;
GRANT ALL ON public.print_products TO service_role;
ALTER TABLE public.print_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active print products"
  ON public.print_products FOR SELECT USING (active = true);
CREATE POLICY "Admins can read all print products"
  ON public.print_products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.print_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.print_products(id) ON DELETE CASCADE,
  variant_key text NOT NULL,
  label text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  fulfilment_cost_minor integer NOT NULL CHECK (fulfilment_cost_minor >= 0),
  retail_price_minor integer NOT NULL CHECK (retail_price_minor >= 0),
  currency_code text NOT NULL DEFAULT 'NZD',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, variant_key)
);
-- Customers must never read fulfilment_cost_minor: reads go through server
-- functions that project retail columns only.
GRANT SELECT ON public.print_product_variants TO authenticated;
GRANT ALL ON public.print_product_variants TO service_role;
ALTER TABLE public.print_product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read print variants"
  ON public.print_product_variants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------- bundles ----------
CREATE TABLE public.print_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_key text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  industry text,
  discount_percent numeric NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 50),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.print_bundles TO anon, authenticated;
GRANT ALL ON public.print_bundles TO service_role;
ALTER TABLE public.print_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active bundles"
  ON public.print_bundles FOR SELECT USING (active = true);

CREATE TABLE public.print_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.print_bundles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.print_products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES public.print_product_variants(id) ON DELETE SET NULL,
  label text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.print_bundle_items TO anon, authenticated;
GRANT ALL ON public.print_bundle_items TO service_role;
ALTER TABLE public.print_bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read bundle items"
  ON public.print_bundle_items FOR SELECT USING (true);

-- ---------- carts ----------
CREATE TABLE public.print_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','ordered','abandoned')),
  currency_code text NOT NULL DEFAULT 'NZD',
  pricing_region text NOT NULL DEFAULT 'NZ',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX print_carts_one_open_per_owner
  ON public.print_carts (owner_id) WHERE status = 'open';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_carts TO authenticated;
GRANT ALL ON public.print_carts TO service_role;
ALTER TABLE public.print_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their cart"
  ON public.print_carts FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.print_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.print_carts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.print_products(id) ON DELETE RESTRICT,
  variant_id uuid NOT NULL REFERENCES public.print_product_variants(id) ON DELETE RESTRICT,
  bundle_id uuid REFERENCES public.print_bundles(id) ON DELETE SET NULL,
  bundle_group text,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  qr_code_id uuid NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  marketing_pack_id uuid REFERENCES public.marketing_packs(id) ON DELETE SET NULL,
  placement_plan_id uuid REFERENCES public.placement_plans(id) ON DELETE SET NULL,
  campaign text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_retail_minor integer NOT NULL DEFAULT 0,
  unit_cost_minor integer NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'NZD',
  design jsonb NOT NULL DEFAULT '{}'::jsonb,
  artwork_version integer NOT NULL DEFAULT 1,
  validation_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_status text NOT NULL DEFAULT 'error'
    CHECK (validation_status IN ('pass','warning','error')),
  warnings_acknowledged boolean NOT NULL DEFAULT false,
  proof_id uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_cart_items TO authenticated;
GRANT ALL ON public.print_cart_items TO service_role;
ALTER TABLE public.print_cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their cart items"
  ON public.print_cart_items FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ---------- orders ----------
CREATE SEQUENCE IF NOT EXISTS public.print_order_number_seq START 1000;

CREATE TABLE public.print_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','awaiting_proof','ready_for_payment','paid','awaiting_fulfilment',
    'submitted_to_printer','in_production','shipped','delivered','canceled',
    'refund_requested','refunded','production_failed')),
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  currency_code text NOT NULL DEFAULT 'NZD',
  pricing_region text NOT NULL DEFAULT 'NZ',
  plan_key text NOT NULL DEFAULT 'free',
  discount_percent numeric NOT NULL DEFAULT 0,
  subtotal_minor integer NOT NULL DEFAULT 0,
  discount_minor integer NOT NULL DEFAULT 0,
  shipping_minor integer NOT NULL DEFAULT 0,
  tax_minor integer NOT NULL DEFAULT 0,
  total_minor integer NOT NULL DEFAULT 0,
  estimated_cost_minor integer NOT NULL DEFAULT 0,
  estimated_margin_minor integer NOT NULL DEFAULT 0,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  payment_status text NOT NULL DEFAULT 'unpaid',
  paid_at timestamptz,
  contact_email text,
  shipping_name text,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_key text NOT NULL DEFAULT 'manual',
  provider_order_id text,
  printer_name text,
  supplier_cost_minor integer,
  supplier_shipping_minor integer,
  tracking_carrier text,
  tracking_number text,
  tracking_url text,
  estimated_ship_date date,
  estimated_delivery_date date,
  submitted_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  refund_amount_minor integer,
  failure_reason text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Customers read their orders through server functions that strip internal
-- cost and notes; direct SELECT is admin-only.
GRANT SELECT ON public.print_orders TO authenticated;
GRANT ALL ON public.print_orders TO service_role;
ALTER TABLE public.print_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read all print orders"
  ON public.print_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.print_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.print_orders(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.print_products(id) ON DELETE RESTRICT,
  variant_id uuid NOT NULL REFERENCES public.print_product_variants(id) ON DELETE RESTRICT,
  bundle_id uuid REFERENCES public.print_bundles(id) ON DELETE SET NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  qr_code_id uuid REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  proof_id uuid,
  product_name text NOT NULL,
  variant_label text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  unit_retail_minor integer NOT NULL DEFAULT 0,
  unit_cost_minor integer NOT NULL DEFAULT 0,
  line_total_minor integer NOT NULL DEFAULT 0,
  design jsonb NOT NULL DEFAULT '{}'::jsonb,
  artwork_version integer NOT NULL DEFAULT 1,
  validation_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  qr_destination text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.print_order_items TO authenticated;
GRANT ALL ON public.print_order_items TO service_role;
ALTER TABLE public.print_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read all print order items"
  ON public.print_order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.print_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cart_item_id uuid REFERENCES public.print_cart_items(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES public.print_order_items(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.print_products(id) ON DELETE RESTRICT,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  qr_code_id uuid REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','superseded')),
  artwork_hash text NOT NULL DEFAULT '',
  proof_url text,
  front_svg text,
  back_svg text,
  design_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  qr_destination text,
  qr_short_url text,
  approval_statement text,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.print_proofs TO authenticated;
GRANT ALL ON public.print_proofs TO service_role;
ALTER TABLE public.print_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their proofs"
  ON public.print_proofs FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.print_cart_items
  ADD CONSTRAINT print_cart_items_proof_fk
  FOREIGN KEY (proof_id) REFERENCES public.print_proofs(id) ON DELETE SET NULL;
ALTER TABLE public.print_order_items
  ADD CONSTRAINT print_order_items_proof_fk
  FOREIGN KEY (proof_id) REFERENCES public.print_proofs(id) ON DELETE SET NULL;

CREATE TABLE public.print_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.print_orders(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  previous_status text,
  new_status text,
  note text,
  visibility text NOT NULL DEFAULT 'customer' CHECK (visibility IN ('customer','internal')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.print_order_events TO authenticated;
GRANT ALL ON public.print_order_events TO service_role;
ALTER TABLE public.print_order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their customer-visible events"
  ON public.print_order_events FOR SELECT TO authenticated
  USING ((auth.uid() = owner_id AND visibility = 'customer')
         OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX print_cart_items_cart_idx ON public.print_cart_items (cart_id);
CREATE INDEX print_orders_owner_idx ON public.print_orders (owner_id, created_at DESC);
CREATE INDEX print_order_items_order_idx ON public.print_order_items (order_id);
CREATE INDEX print_order_events_order_idx ON public.print_order_events (order_id, created_at DESC);
CREATE INDEX print_proofs_owner_idx ON public.print_proofs (owner_id, created_at DESC);

CREATE TRIGGER print_products_updated_at BEFORE UPDATE ON public.print_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER print_product_variants_updated_at BEFORE UPDATE ON public.print_product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER print_bundles_updated_at BEFORE UPDATE ON public.print_bundles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER print_carts_updated_at BEFORE UPDATE ON public.print_carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER print_cart_items_updated_at BEFORE UPDATE ON public.print_cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER print_orders_updated_at BEFORE UPDATE ON public.print_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER print_proofs_updated_at BEFORE UPDATE ON public.print_proofs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Order numbers are allocated server-side only.
CREATE OR REPLACE FUNCTION public.next_print_order_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'GRP-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.print_order_number_seq')::text, 5, '0');
$$;

-- ---------- seed catalogue ----------
INSERT INTO public.print_products
 (product_key, slug, name, description, category, shape, material, finish, artwork_format,
  width_mm, height_mm, bleed_mm, safe_area_mm, min_qr_mm, print_sides, format_id,
  production_days_min, production_days_max, shipping_class, sort_order)
VALUES
 ('vinyl_sticker_pack','vinyl-qr-sticker-pack','Vinyl QR Sticker Pack',
  'Durable circular vinyl stickers for tables, counters and equipment. Weather resistant with a gloss laminate.',
  'sticker','circular','White vinyl 90 micron','Gloss laminate','pdf',
  80,80,3,4,30,1,'sticker-round-80',2,4,'letter',10),
 ('window_decal','window-qr-decal','Window QR Decal',
  'Clear static-cling window decal for entrances and shopfronts. Applies without adhesive residue.',
  'sticker','square','Clear static cling vinyl','Matte','pdf',
  150,150,3,6,45,1,'sticker-square-150',3,5,'letter',20),
 ('counter_card_a5','a5-counter-card','A5 Counter Card',
  'Rigid A5 counter card for tills, reception desks and service points.',
  'counter','portrait','400gsm uncoated board','Matte','pdf',
  148,210,3,8,45,2,'counter-a5',2,4,'parcel',30),
 ('poster_a4','a4-poster','A4 Poster',
  'A4 satin poster for walls, lifts and staff areas.',
  'poster','portrait','200gsm satin poster stock','Satin','pdf',
  210,297,3,10,60,1,'poster-a4',2,4,'tube',40),
 ('hotel_room_card_pack','hotel-room-card-pack','Hotel Room Card Pack',
  'A6 in-room review cards for bedside tables, desks and welcome folders.',
  'hotel','portrait','350gsm silk board','Soft touch','pdf',
  105,148,3,6,35,2,'hotel-a6',3,5,'parcel',50),
 ('restaurant_starter_pack','restaurant-review-starter-pack','Restaurant Review Starter Pack',
  'Everything a restaurant needs on day one: table stickers, counter cards, a window decal and a back-of-house poster.',
  'bundle','portrait','Mixed print media','Mixed','pdf',
  210,297,3,8,30,2,NULL,4,7,'parcel',60),
 ('cafe_starter_pack','cafe-review-starter-pack','Café Review Starter Pack',
  'Table stickers, a counter card, a window decal and a poster, sized for café service.',
  'bundle','portrait','Mixed print media','Mixed','pdf',
  210,297,3,8,30,2,NULL,4,7,'parcel',70),
 ('retail_starter_pack','retail-review-starter-pack','Retail Review Starter Pack',
  'Checkout stickers, counter cards, a window decal and a poster for retail floors.',
  'bundle','portrait','Mixed print media','Mixed','pdf',
  210,297,3,8,30,2,NULL,4,7,'parcel',80);

INSERT INTO public.print_product_variants
 (product_id, variant_key, label, quantity, fulfilment_cost_minor, retail_price_minor, sort_order)
SELECT p.id, v.variant_key, v.label, v.quantity, v.cost, v.retail, v.sort_order
FROM public.print_products p
JOIN (VALUES
  ('vinyl_sticker_pack','qty_10','10 stickers',10,1200,2900,1),
  ('vinyl_sticker_pack','qty_25','25 stickers',25,2200,4900,2),
  ('vinyl_sticker_pack','qty_50','50 stickers',50,3500,7900,3),
  ('vinyl_sticker_pack','qty_100','100 stickers',100,5500,12900,4),
  ('window_decal','qty_1','1 decal',1,1800,4500,1),
  ('window_decal','qty_2','2 decals',2,3200,7900,2),
  ('window_decal','qty_5','5 decals',5,7000,16900,3),
  ('counter_card_a5','qty_1','1 card',1,600,1900,1),
  ('counter_card_a5','qty_2','2 cards',2,1000,3200,2),
  ('counter_card_a5','qty_5','5 cards',5,2000,5900,3),
  ('counter_card_a5','qty_10','10 cards',10,3500,9900,4),
  ('poster_a4','qty_1','1 poster',1,900,2500,1),
  ('poster_a4','qty_2','2 posters',2,1600,4500,2),
  ('poster_a4','qty_5','5 posters',5,3200,8900,3),
  ('hotel_room_card_pack','qty_20','20 cards',20,2400,5900,1),
  ('hotel_room_card_pack','qty_50','50 cards',50,5000,11900,2),
  ('hotel_room_card_pack','qty_100','100 cards',100,8500,19900,3),
  ('restaurant_starter_pack','pack_1','1 starter pack',1,9000,19900,1),
  ('cafe_starter_pack','pack_1','1 starter pack',1,7000,15900,1),
  ('retail_starter_pack','pack_1','1 starter pack',1,7500,16900,1)
) AS v(product_key, variant_key, label, quantity, cost, retail, sort_order)
  ON v.product_key = p.product_key;

INSERT INTO public.print_bundles (bundle_key, slug, name, description, industry, discount_percent, sort_order)
VALUES
 ('restaurant_review_pack','restaurant-review-pack','Restaurant Review Pack',
  '10 table stickers, 2 counter cards, 1 window decal and 1 A4 poster — one business, one campaign, one design theme.',
  'restaurant',10,10),
 ('hotel_review_pack','hotel-review-pack','Hotel Review Pack',
  '20 room cards, 2 reception cards, 2 lift posters and 1 window decal.',
  'hotel',10,20),
 ('cafe_review_pack','cafe-review-pack','Café Review Pack',
  '10 table stickers, 1 counter card, 1 window decal and 1 A4 poster.',
  'cafe',10,30),
 ('retail_review_pack','retail-review-pack','Retail Review Pack',
  '5 checkout stickers, 1 window decal, 2 counter cards and 1 poster.',
  'retail',10,40);

INSERT INTO public.print_bundle_items (bundle_id, product_id, variant_id, label, quantity, sort_order)
SELECT b.id, p.id, v.id, x.label, 1, x.sort_order
FROM (VALUES
  ('restaurant_review_pack','vinyl_sticker_pack','qty_10','10 table stickers',1),
  ('restaurant_review_pack','counter_card_a5','qty_2','2 counter cards',2),
  ('restaurant_review_pack','window_decal','qty_1','1 window decal',3),
  ('restaurant_review_pack','poster_a4','qty_1','1 A4 poster',4),
  ('hotel_review_pack','hotel_room_card_pack','qty_20','20 room cards',1),
  ('hotel_review_pack','counter_card_a5','qty_2','2 reception cards',2),
  ('hotel_review_pack','poster_a4','qty_2','2 lift posters',3),
  ('hotel_review_pack','window_decal','qty_1','1 window decal',4),
  ('cafe_review_pack','vinyl_sticker_pack','qty_10','10 table stickers',1),
  ('cafe_review_pack','counter_card_a5','qty_1','1 counter card',2),
  ('cafe_review_pack','window_decal','qty_1','1 window decal',3),
  ('cafe_review_pack','poster_a4','qty_1','1 A4 poster',4),
  ('retail_review_pack','vinyl_sticker_pack','qty_10','5 checkout stickers',1),
  ('retail_review_pack','window_decal','qty_1','1 window decal',2),
  ('retail_review_pack','counter_card_a5','qty_2','2 counter cards',3),
  ('retail_review_pack','poster_a4','qty_1','1 poster',4)
) AS x(bundle_key, product_key, variant_key, label, sort_order)
JOIN public.print_bundles b ON b.bundle_key = x.bundle_key
JOIN public.print_products p ON p.product_key = x.product_key
JOIN public.print_product_variants v ON v.product_id = p.id AND v.variant_key = x.variant_key;