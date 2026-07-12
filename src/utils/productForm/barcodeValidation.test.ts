import { manualBarcodeError, normalizeManualBarcode } from './barcodeValidation';

describe('normalizeManualBarcode', () => {
  it('accepts a valid EAN-13 code unchanged', () => {
    expect(normalizeManualBarcode('4006381333931')).toBe('4006381333931');
  });

  it('normalizes a valid 12-digit UPC-A code to EAN-13 with a leading zero', () => {
    expect(normalizeManualBarcode('036000291452')).toBe('0036000291452');
  });

  it('tolerates surrounding whitespace', () => {
    expect(normalizeManualBarcode('  4006381333931  ')).toBe('4006381333931');
  });

  it('rejects a 13-digit code with a failed mod-10 checksum', () => {
    expect(normalizeManualBarcode('4006381333930')).toBeNull();
  });

  it('rejects a 12-digit code with a failed mod-10 checksum', () => {
    expect(normalizeManualBarcode('036000291453')).toBeNull();
  });

  it('rejects input that is too short or too long', () => {
    expect(normalizeManualBarcode('40063813339')).toBeNull();
    expect(normalizeManualBarcode('40063813339311')).toBeNull();
  });

  it('rejects input containing non-digits', () => {
    expect(normalizeManualBarcode('40063813339a1')).toBeNull();
    expect(normalizeManualBarcode('4006-381-333931')).toBeNull();
  });
});

describe('manualBarcodeError', () => {
  it('returns null for a valid code', () => {
    expect(manualBarcodeError('4006381333931')).toBeNull();
    expect(manualBarcodeError('036000291452')).toBeNull();
  });

  it('flags non-digit input before checking length', () => {
    expect(manualBarcodeError('12ab')).toBe('Enter digits only');
    expect(manualBarcodeError('')).toBe('Enter digits only');
  });

  it('flags wrong-length digit input', () => {
    expect(manualBarcodeError('12345')).toBe('A barcode has 12 or 13 digits');
  });

  it('flags a failed checksum on correctly sized input', () => {
    expect(manualBarcodeError('4006381333930')).toBe(
      'That doesn’t look like a valid barcode — check the digits',
    );
  });
});
