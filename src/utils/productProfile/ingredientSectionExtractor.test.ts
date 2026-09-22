import { extractIngredientSection } from './ingredientSectionExtractor';

describe('extractIngredientSection', () => {
  it('returns the text unchanged when no section marker is present', () => {
    const text = 'Aqua, Glycerin, Niacinamide, Panthenol';

    expect(extractIngredientSection(text)).toBe(text);
  });

  it('cuts off text at a "Directions" marker following a real ingredient list', () => {
    const text = 'Aqua, Glycerin, Niacinamide. Directions: Apply twice daily to clean skin.';

    expect(extractIngredientSection(text)).toBe('Aqua, Glycerin, Niacinamide');
  });

  it('cuts off text at a "Warnings" marker, matching case-insensitively', () => {
    const text = 'Aqua, Glycerin, Retinol, WARNINGS: For external use only. Keep out of reach of children.';

    expect(extractIngredientSection(text)).toBe('Aqua, Glycerin, Retinol');
  });

  it('cuts off text at manufacturer metadata following the ingredient list', () => {
    const text = 'Aqua, Glycerin, Tocopherol, Made in France by Example Cosmetics SA';

    expect(extractIngredientSection(text)).toBe('Aqua, Glycerin, Tocopherol');
  });

  it('cuts at the earliest marker when more than one is present', () => {
    const text = 'Aqua, Glycerin, Directions: apply daily. Warnings: avoid eye contact.';

    expect(extractIngredientSection(text)).toBe('Aqua, Glycerin');
  });

  it('does not cut when the marker appears before any real comma-separated content', () => {
    const text = 'Directions: Aqua, Glycerin, Niacinamide';

    expect(extractIngredientSection(text)).toBe(text);
  });

  it('trims a trailing comma and whitespace left over after cutting', () => {
    const text = 'Aqua, Glycerin, Niacinamide,   How to use: massage in gently';

    expect(extractIngredientSection(text)).toBe('Aqua, Glycerin, Niacinamide');
  });

  it('does not treat a bare "use" or "apply" as a section marker', () => {
    const text = 'Aqua, Glycerin, safe to use daily, Niacinamide, apply generously';

    expect(extractIngredientSection(text)).toBe(text);
  });

  it('handles a realistic multi-marker capture the same way a real device photo would produce it', () => {
    const text =
      'Aqua/Water, Glycerin, Niacinamide, Sodium Hyaluronate, Panthenol, Tocopherol, ' +
      'Phenoxyethanol. Directions For Use: Apply to face and neck morning and evening. ' +
      'Warnings: Avoid contact with eyes. If irritation occurs, discontinue use. ' +
      'Net Wt 50ml. Made in Italy.';

    expect(extractIngredientSection(text)).toBe(
      'Aqua/Water, Glycerin, Niacinamide, Sodium Hyaluronate, Panthenol, Tocopherol, Phenoxyethanol',
    );
  });

  describe('labels that print Action/Directions/Warnings BEFORE the ingredients list', () => {
    // Real device-QA sample (docs/investigations/ocr-incomplete-ingredient-capture.md):
    // a Farmapol serum box prints Action -> How to use -> Warnings -> Instrumental
    // test results, THEN "Ingriedents" (the box's own misprint, correctly read by
    // Tesseract) -> the actual INCI list. Fixtures are the real ocrTextCleaner
    // output captured from that photo (colons already stripped, newlines already
    // flattened to commas) so this test exercises exactly what production sees.
    const FULL_SHOT_CLEANED =
      'EN Action Reduces wrinkles and hyperpigmentation, smooths and tightens the skin for visible ' +
      'rejuvenating effect. Brightens the skin, reducing the appearance of, pores and regulating sebum ' +
      'secretion. It absorbs quickly. How to use Apply a small amount of the serum evenly to a cleansed ' +
      'face or other area of the body that needs, intensive care. Apply topically, not exceeding an ' +
      'amount equivalent to the size of one pea per day. If applying to the entire face (no more than ' +
      'two peas), use the, serum every other day. Warnings The product is not intended for use by ' +
      'pregnant and breastfeeding women and children under 12. Due to the high niacinamide, content, ' +
      "follow the products directions for use. Do not use it with other products containing vitamin " +
      'B3. Avoid contact with eyes. Do not use in case of hypersensitivity to, any of the ingredients ' +
      'of the product. If adverse skin reactions occur, discontinue use., Instrumental test results ' +
      'hyperpigmentation reduction by 16.0% wrinkle reduction by 14.3% after two months of use., ' +
      'Ingriedents Aqua, Niacinamide, Methylpropanediol, Caprylic/Capric Triglyceride, sopropy ' +
      'Myristate, Cetearyl Alcohol, Glyceryl, Stearate Citrate, Tocopherol, Glyceryl Caprylate, ' +
      'Sodium Polyacrylate, Hydroxyacetophenone., 4 Made in Poland by 25C, Przedsibiorstwo ' +
      'Farmaceutyczne Farmapol Sp. 0.0., ul. wity Wojciech 29, 61-749 Pozna, Poland 15C 5 907 573 300399';

    const CROPPED_SHOT_CLEANED =
      'EN Action Reduces wrinkles and hyperpigmentation, smooths an, pores and regulating sebum ' +
      'secretion. It absorbs quickly. How to use, intensive care. Apply topically, not exceeding an ' +
      'amount equivalen, serum every other day. Warnings The product is not intended for, content, ' +
      "follow the products directions for use. Do not use it with othe, any of the ingredients of the " +
      'product. If adverse skin reactions occur, Instrumental test results hyperpigmentation reduction ' +
      'by 16.0% 1, Ingriedents Aqua, Niacinamide, Methylpropanediol, Stearate Citrate, Tocopherol, ' +
      'Glyceryl Caprylate, Sodium Polyacrylate, Made in Poland by, Przedsiebiorstwo Farmaceutyczne ' +
      'Farmapol Sp., Ul. wity Wojciech 29, 61-749 Pozna, Poland, Farmapol farmapol.pl';

    it('finds the real "Ingriedents" header (OCR misprint) past the leading marketing/warnings text', () => {
      expect(extractIngredientSection(FULL_SHOT_CLEANED)).toBe(
        'Aqua, Niacinamide, Methylpropanediol, Caprylic/Capric Triglyceride, sopropy Myristate, ' +
          'Cetearyl Alcohol, Glyceryl, Stearate Citrate, Tocopherol, Glyceryl Caprylate, Sodium ' +
          'Polyacrylate, Hydroxyacetophenone',
      );
    });

    it('does the same for a shot where the ingredient line itself is also cut off mid-word', () => {
      expect(extractIngredientSection(CROPPED_SHOT_CLEANED)).toBe(
        'Aqua, Niacinamide, Methylpropanediol, Stearate Citrate, Tocopherol, Glyceryl Caprylate, ' +
          'Sodium Polyacrylate',
      );
    });

    it('strips more than one trailing non-letter junk token (e.g. a page number AND a batch number)', () => {
      const text = 'Ingredients Aqua, Niacinamide, Glycerin, 4, 5, Made in Poland';

      expect(extractIngredientSection(text)).toBe('Aqua, Niacinamide, Glycerin');
    });

    it('does not mistake a trailing mention of the word "ingredients" in a warnings sentence for the real header', () => {
      // Regression case found while validating this fix: "ingredients" appears
      // in prose AFTER the real, ingredients-first list — the header search
      // must not lock onto it and discard the real list that precedes it.
      const text =
        'Aqua, Glycerin, Niacinamide. Warnings do not use if allergic to any of the ingredients, ' +
        'consult a doctor, discontinue if irritation persists';

      expect(extractIngredientSection(text)).toBe('Aqua, Glycerin, Niacinamide');
    });
  });
});
