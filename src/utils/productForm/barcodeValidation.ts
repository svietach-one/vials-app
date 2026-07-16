/**
 * Manual barcode entry validation (UPC-A / EAN-13).
 *
 * UPC-A is EAN-13 with a leading zero, and both use the same mod-10 check
 * digit, so a valid 12-digit input is normalized to the 13-digit form and
 * everything downstream works with a single format.
 */

/** Mod-10 check: for a 13-digit code, weights are 1,3,1,3,… left to right. */
function hasValidEan13Checksum(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = digits.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits.charCodeAt(12) - 48;
}

/**
 * Validates manually typed barcode digits and returns the normalized
 * 13-digit EAN-13 form, or null when the input is not a valid
 * UPC-A/EAN-13 code. Surrounding whitespace is tolerated; anything else
 * (letters, separators, wrong length) is invalid.
 */
export function normalizeManualBarcode(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\d{12,13}$/.test(trimmed)) return null;

  const ean13 = trimmed.length === 12 ? `0${trimmed}` : trimmed;
  return hasValidEan13Checksum(ean13) ? ean13 : null;
}

/** Human-readable inline error for invalid manual input, or null if valid. */
export function manualBarcodeError(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return 'Enter digits only';
  if (trimmed.length !== 12 && trimmed.length !== 13) {
    return 'A barcode has 12 or 13 digits';
  }
  if (normalizeManualBarcode(trimmed) === null) {
    return 'That doesn’t look like a valid barcode — check the digits';
  }
  return null;
}
