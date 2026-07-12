import { splitLabelText } from './ocrNormalizer';

describe('splitLabelText', () => {
  it('uses the first line as brand and remaining lines as name', () => {
    const result = splitLabelText('CeraVe\nFoaming Cleanser\nNormal to Oily Skin');

    expect(result).toEqual({ brand: 'CeraVe', name: 'Foaming Cleanser Normal to Oily Skin' });
  });

  it('strips trademark symbols and collapses whitespace', () => {
    const result = splitLabelText('La   Roche-Posay®\nEffaclar™  Duo(+)');

    expect(result).toEqual({ brand: 'La Roche-Posay', name: 'Effaclar Duo(+)' });
  });

  it('skips empty lines between brand and name', () => {
    const result = splitLabelText('The Ordinary\n\n\nNiacinamide 10% + Zinc 1%');

    expect(result).toEqual({ brand: 'The Ordinary', name: 'Niacinamide 10% + Zinc 1%' });
  });

  it('returns the single line as brand with an empty name', () => {
    expect(splitLabelText('Bioderma')).toEqual({ brand: 'Bioderma', name: '' });
  });

  it('returns empty fields for empty or whitespace-only input', () => {
    expect(splitLabelText('')).toEqual({ brand: '', name: '' });
    expect(splitLabelText('  \n  \n')).toEqual({ brand: '', name: '' });
  });
});
