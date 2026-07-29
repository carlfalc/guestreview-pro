/**
 * Turns the database plan-limit guard errors into positive upgrade copy.
 * The triggers raise messages prefixed with PLAN_LIMIT_<RESOURCE>.
 */
export function planLimitMessage(error: unknown): string | null {
  const message =
    typeof error === "string"
      ? error
      : (error as { message?: string } | null)?.message ?? "";
  if (!message.includes("PLAN_LIMIT_")) return null;
  if (message.includes("PLAN_LIMIT_QR_CODES")) {
    return "The Free plan includes 1 active QR code. Upgrade to Pro for unlimited QR codes, campaigns and advanced analytics.";
  }
  if (message.includes("PLAN_LIMIT_BUSINESSES")) {
    return "Your plan includes 1 business. Upgrade to Business to manage up to 10 with portfolio reporting.";
  }
  return "Your current plan doesn't include this yet — upgrade to unlock it.";
}

/** Message to surface for any failed create/update, plan-aware. */
export function friendlyMutationError(error: unknown, fallback = "Something went wrong."): string {
  return (
    planLimitMessage(error) ??
    ((error as { message?: string } | null)?.message || fallback)
  );
}
