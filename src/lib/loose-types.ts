/**
 * Deliberate escape hatches for values that cross an untyped boundary:
 *
 *  - `LooseRecord` — Stripe event payloads. Stripe's SDK types differ between
 *    API versions, and the webhook handler reads fields defensively.
 *  - `LooseQueryBuilder` / `LooseClient` — PostgREST query builders for tables
 *    that are not present in the generated Supabase types yet.
 *
 * These are the only places in the codebase allowed to use `any`; every other
 * module must use precise types. Keeping the escape hatch in one file means
 * `@typescript-eslint/no-explicit-any` stays an error everywhere else.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A record with unknown shape, read defensively at runtime. */
export type LooseRecord = Record<string, any>;

/** Chainable PostgREST query builder with an unmodelled result shape. */
export type LooseQueryBuilder = any;

/** Supabase client narrowed to the untyped surface used by admin queries. */
export type LooseClient = {
  from: (table: string) => LooseQueryBuilder;
  rpc: (name: string, args?: unknown) => Promise<any>;
};
