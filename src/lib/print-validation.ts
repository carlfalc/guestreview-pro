// Ordering gates for the Print Store.
//
// This layer does NOT re-implement artwork validation — it reuses the existing
// format validation engine and adds the checks that only matter once a
// physical print is being bought (minimum QR size on the real substrate,
// bleed, image resolution, live destination).

import type { ValidationResult } from "./format-validation";
import type { PrintProductDTO } from "./print-catalogue";

export type PrintGateCode =
  | "destination_missing"
  | "short_link_missing"
  | "destination_test_failed"
  | "qr_contrast"
  | "qr_too_small"
  | "outside_safe_area"
  | "bleed_missing"
  | "image_resolution"
  | "artwork_validation";

export type PrintGateLevel = "error" | "warning";

export interface PrintGate {
  code: PrintGateCode;
  level: PrintGateLevel;
  title: string;
  message: string;
  /** Warnings with this flag may be acknowledged and ordered anyway. */
  acknowledgeable: boolean;
}

export interface PrintGateInput {
  product: Pick<PrintProductDTO, "minQrMm" | "bleedMm" | "safeAreaMm" | "widthMm" | "heightMm">;
  /** Results from runFormatValidations for the artwork being ordered. */
  validation: ValidationResult[];
  qr: {
    shortCode: string | null | undefined;
    destinationUrl: string | null | undefined;
    /** Result of the destination test. `null` = never tested. */
    destinationOk: boolean | null;
  };
  /** Rendered QR width on the finished piece, in millimetres. */
  qrSizeMm: number;
  /** Bleed present in the generated artwork, in millimetres. */
  artworkBleedMm: number;
  /** Effective resolution of the lowest-resolution raster asset, in DPI. */
  imageDpi?: number | null;
}

const MIN_PRINT_DPI = 150;
const RECOMMENDED_PRINT_DPI = 300;

/**
 * Every blocking condition required by the print store, plus the warnings a
 * customer may knowingly accept.
 */
export function printOrderGates(input: PrintGateInput): PrintGate[] {
  const gates: PrintGate[] = [];
  const { product, qr } = input;

  if (!qr.destinationUrl || !qr.destinationUrl.trim()) {
    gates.push({
      code: "destination_missing",
      level: "error",
      title: "QR destination is missing",
      message:
        "This QR code has no destination. Add a Google review link or destination URL before ordering print.",
      acknowledgeable: false,
    });
  }

  if (!qr.shortCode || !qr.shortCode.trim()) {
    gates.push({
      code: "short_link_missing",
      level: "error",
      title: "QR short link is missing",
      message:
        "The printed code points at a short link that does not exist yet. Save the QR code, then order.",
      acknowledgeable: false,
    });
  }

  if (qr.destinationOk === false) {
    gates.push({
      code: "destination_test_failed",
      level: "error",
      title: "Destination test failed",
      message:
        "The destination did not respond correctly when tested. Fix it before committing to print.",
      acknowledgeable: false,
    });
  }

  if (input.qrSizeMm < product.minQrMm) {
    gates.push({
      code: "qr_too_small",
      level: "error",
      title: "QR code is below the minimum print size",
      message: `This product needs a QR of at least ${product.minQrMm}mm. The current artwork renders it at ${Math.round(input.qrSizeMm)}mm.`,
      acknowledgeable: false,
    });
  }

  if (input.artworkBleedMm + 0.001 < product.bleedMm) {
    gates.push({
      code: "bleed_missing",
      level: "error",
      title: "Bleed is missing",
      message: `${product.bleedMm}mm of bleed is required on every edge. Regenerate the artwork with bleed included.`,
      acknowledgeable: false,
    });
  }

  const dpi = input.imageDpi ?? null;
  if (dpi != null && dpi < MIN_PRINT_DPI) {
    gates.push({
      code: "image_resolution",
      level: "error",
      title: "Image resolution is too low to print",
      message: `An image in this artwork is only ${Math.round(dpi)} DPI. Print needs at least ${MIN_PRINT_DPI} DPI.`,
      acknowledgeable: false,
    });
  } else if (dpi != null && dpi < RECOMMENDED_PRINT_DPI) {
    gates.push({
      code: "image_resolution",
      level: "warning",
      title: "Image resolution is below the recommended 300 DPI",
      message: `An image in this artwork is ${Math.round(dpi)} DPI. It will print, but detail may look soft.`,
      acknowledgeable: true,
    });
  }

  // Fold the artwork validation engine's own findings into the gate list.
  const contrastFail = input.validation.find(
    (r) => r.level === "error" && r.category === "qr" && /contrast/i.test(r.title),
  );
  if (contrastFail) {
    gates.push({
      code: "qr_contrast",
      level: "error",
      title: contrastFail.title,
      message: contrastFail.message,
      acknowledgeable: false,
    });
  }

  const safeAreaFail = input.validation.find(
    (r) => r.level === "error" && (r.category === "print" || r.category === "text"),
  );
  if (safeAreaFail) {
    gates.push({
      code: "outside_safe_area",
      level: "error",
      title: safeAreaFail.title,
      message: safeAreaFail.message,
      acknowledgeable: false,
    });
  }

  const otherErrors = input.validation.filter(
    (r) => r.level === "error" && r !== contrastFail && r !== safeAreaFail,
  );
  for (const err of otherErrors) {
    gates.push({
      code: "artwork_validation",
      level: "error",
      title: err.title,
      message: err.message,
      acknowledgeable: false,
    });
  }

  for (const warn of input.validation.filter((r) => r.level === "warning")) {
    gates.push({
      code: "artwork_validation",
      level: "warning",
      title: warn.title,
      message: warn.message,
      acknowledgeable: true,
    });
  }

  return gates;
}

export interface PrintGateVerdict {
  /** Item may enter the cart. */
  ok: boolean;
  blocking: PrintGate[];
  warnings: PrintGate[];
  status: "pass" | "warning" | "error";
}

/**
 * A cart item is orderable when there are no blocking gates and every
 * acknowledgeable warning has been accepted by the customer.
 */
export function evaluatePrintGates(
  gates: PrintGate[],
  warningsAcknowledged: boolean,
): PrintGateVerdict {
  const blocking = gates.filter((g) => g.level === "error");
  const warnings = gates.filter((g) => g.level === "warning");
  const status: PrintGateVerdict["status"] = blocking.length
    ? "error"
    : warnings.length
      ? "warning"
      : "pass";
  return {
    ok: blocking.length === 0 && (warnings.length === 0 || warningsAcknowledged),
    blocking,
    warnings,
    status,
  };
}

/** Stable snapshot stored against a cart item / proof at approval time. */
export interface ValidationSnapshot {
  checkedAt: string;
  status: PrintGateVerdict["status"];
  warningsAcknowledged: boolean;
  gates: PrintGate[];
  results: ValidationResult[];
}

export function buildValidationSnapshot(
  gates: PrintGate[],
  results: ValidationResult[],
  warningsAcknowledged: boolean,
  now: Date = new Date(),
): ValidationSnapshot {
  const verdict = evaluatePrintGates(gates, warningsAcknowledged);
  return {
    checkedAt: now.toISOString(),
    status: verdict.status,
    warningsAcknowledged,
    gates,
    results,
  };
}
