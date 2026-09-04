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
});
