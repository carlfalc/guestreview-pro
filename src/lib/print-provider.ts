// Print fulfilment provider abstraction.
//
// No live provider is connected in this phase. Every order is fulfilled by an
// administrator through the "manual" provider. The interface is shaped so a
// real provider (Prodigi, Gelato, Printful) can be dropped in later without
// touching the cart or order model.

export type PrintProviderKey = "manual" | "prodigi";

export interface ProviderProduct {
  sku: string;
  name: string;
  /** Our catalogue key this SKU maps to, when known. */
  productKey?: string | null;
  attributes?: Record<string, string>;
}

export interface ProviderQuoteRequest {
  items: Array<{ sku: string; quantity: number }>;
  destination: { countryCode: string; postalCode?: string | null };
  currency: string;
}

export interface ProviderQuote {
  currency: string;
  itemsCostMinor: number;
  shippingCostMinor: number;
  taxMinor: number;
  totalCostMinor: number;
  /** Null when the provider cannot quote (manual fulfilment). */
  estimatedDispatchDays: number | null;
}

export interface ProviderOrderItem {
  sku: string;
  quantity: number;
  artworkUrl: string;
  /** Proof reference so the operator can trace the approved artwork. */
  proofId: string;
}

export interface ProviderOrderRequest {
  orderNumber: string;
  currency: string;
  items: ProviderOrderItem[];
  recipient: {
    name: string;
    email?: string | null;
    line1: string;
    line2?: string | null;
    city: string;
    region?: string | null;
    postalCode: string;
    countryCode: string;
  };
}

export type ProviderOrderStatus =
  | "received"
  | "in_production"
  | "shipped"
  | "delivered"
  | "canceled"
  | "failed";

export interface ProviderOrder {
  providerOrderId: string | null;
  status: ProviderOrderStatus;
  message?: string;
}

export interface ProviderTracking {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface ProviderWebhookResult {
  handled: boolean;
  providerOrderId?: string | null;
  status?: ProviderOrderStatus;
  tracking?: ProviderTracking;
  message?: string;
}

export interface PrintProvider {
  readonly key: PrintProviderKey;
  readonly automated: boolean;
  getProducts(): Promise<ProviderProduct[]>;
  getQuote(request: ProviderQuoteRequest): Promise<ProviderQuote | null>;
  submitOrder(request: ProviderOrderRequest): Promise<ProviderOrder>;
  cancelOrder(providerOrderId: string): Promise<ProviderOrder>;
  getOrder(providerOrderId: string): Promise<ProviderOrder | null>;
  getTracking(providerOrderId: string): Promise<ProviderTracking | null>;
  handleWebhook(payload: unknown, signature?: string | null): Promise<ProviderWebhookResult>;
}

/**
 * Manual fulfilment. Nothing is sent anywhere: an administrator downloads the
 * approved artwork, places the job with a printer and records progress in the
 * admin console. Quote and tracking lookups intentionally return null so the
 * UI falls back to the internally recorded values.
 */
export const manualProvider: PrintProvider = {
  key: "manual",
  automated: false,
  async getProducts() {
    return [];
  },
  async getQuote() {
    return null;
  },
  async submitOrder(request) {
    return {
      providerOrderId: null,
      status: "received",
      message: `Queued for manual fulfilment (${request.items.length} item(s)).`,
    };
  },
  async cancelOrder() {
    return { providerOrderId: null, status: "canceled", message: "Cancelled manually." };
  },
  async getOrder() {
    return null;
  },
  async getTracking() {
    return null;
  },
  async handleWebhook() {
    return { handled: false, message: "Manual fulfilment has no webhooks." };
  },
};

const PROVIDERS: Partial<Record<PrintProviderKey, PrintProvider>> = {
  manual: manualProvider,
};

/** Resolve a provider by key. Unknown keys fall back to manual fulfilment. */
export function getPrintProvider(key: string | null | undefined): PrintProvider {
  return PROVIDERS[(key ?? "manual") as PrintProviderKey] ?? manualProvider;
}

/** The provider every order currently uses. */
export const ACTIVE_PROVIDER_KEY: PrintProviderKey = "manual";
