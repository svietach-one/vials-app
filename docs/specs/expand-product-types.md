# Spec: Expand Product Types + Restore OCR Banner Gate

**Task slug:** `expand-product-types`
**Author:** planner
**Date:** 2026-06-21

## Problem

1. The `ProductType` union and its UI chip list are too narrow (8 types). Users cannot accurately categorise common product formats like cream, mask, eye cream, ampoule, etc.

2. The INCI field inline banner incorrectly shows the "Scanner Demo Mode" OCR warning whenever the text field has any content (`value.length > 0`), including OBF prefill and manual paste — not just after a real OCR scan.

## User stories

**US-1 — Accurate product typing**
As a user adding a product, I want to select from a full range of product types so I can categorise it accurately without resorting to a catch-all.

*Acceptance criteria:*
- AC-1: The product type chip rail includes all 18 types: cleanser, toner, essence, serum, gel, moisturizer, oil, spf, makeup_remover, peeling, ampoule, lotion, cream, eye_cream, mask, balm, spot_treatment, other.
- AC-2: Existing products with legacy types are unaffected (union is additive).
- AC-3: Each chip label is human-readable (e.g. `eye_cream` → "Eye Cream").

**US-2 — OCR-only review banner**
As a user who just scanned an ingredient label, I want to see a targeted warning that my scan may contain typos, but I do NOT want to see this warning when I manually paste or OBF-prefill ingredients.

*Acceptance criteria:*
- AC-4: When the INCI field is empty, the static gray/orange banner reads the Latin/English character instruction.
- AC-5: After a successful OCR scan (`handleOcrResult` fires), the banner switches to: "Please review the scanned text carefully for any punctuation or typo mistakes."
- AC-6: Manually typing or pasting text does NOT trigger the OCR banner.
- AC-7: OBF prefill does NOT trigger the OCR banner.
- AC-8: Clearing the INCI field after a scan resets the banner back to the static instruction.
