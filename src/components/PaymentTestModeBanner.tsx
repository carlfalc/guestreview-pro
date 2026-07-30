/**
 * Payment environment notice. Renders nothing in a correctly configured live
 * build; warns in test mode and shouts if a production build shipped without a
 * payments token.
 */
const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-destructive/40 bg-destructive/15 px-4 py-2 text-center text-sm text-destructive-foreground">
        Production checkout is not configured. Complete payment go-live to accept real payments.
      </div>
    );
  }

  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-200">
        Test mode — payments made here are not real. Use card 4242 4242 4242 4242.
      </div>
    );
  }

  return null;
}
