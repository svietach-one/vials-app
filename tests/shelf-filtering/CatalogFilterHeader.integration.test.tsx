/**
 * Integration tests — CatalogFilterHeader (shelf-filtering feature)
 *
 * Covers:
 *   SF-CFH-1  Renders all category pills: All, Serums, Moisturizers, SPF
 *   SF-CFH-2  Renders all biomarker badges: Soothing, Actives, Hydration
 *   SF-CFH-3  Category pill selected: pressing "Serums" calls onFilterChange with selectedCategory "Serums"
 *   SF-CFH-4  Category pill deselect: pressing the already-selected "Serums" calls onFilterChange with selectedCategory "All"
 *   SF-CFH-5  Biomarker badge adds to array: pressing "Actives" from empty selection calls onFilterChange with ["Actives"]
 *   SF-CFH-6  Biomarker badge removes from array: pressing "Actives" when already selected calls onFilterChange with []
 *   SF-CFH-7  Multiple biomarkers: pressing "Soothing" when "Actives" is selected calls onFilterChange with ["Actives", "Soothing"]
 *
 * CatalogFilterHeader is a purely controlled component with no stores or AsyncStorage
 * in its import chain, so no async-storage or store mocks are needed.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { CatalogFilterHeader } from '@/components/catalog/CatalogFilterHeader';
import type { CatalogFilterState } from '@/types';

// ── Design tokens mock ────────────────────────────────────────────────────────
//
// CatalogFilterHeader imports colors, radius, space, and typography.
// Using the same Proxy pattern as other integration tests in this repo.

jest.mock('@/constants/tokens', () => ({
  colors: {
    textPrimary: '#2F4F4F',
    textSecondary: '#6B7280',
    textOnDark: '#FFFFFF',
    borderStrong: '#C8C4BA',
  },
  space: new Proxy({} as Record<string | number, number>, {
    get: (_: any, key: string | symbol) => (key === 'gutterScreen' ? 16 : 8),
  }),
  typography: new Proxy({}, { get: () => ({}) }),
  radius: new Proxy({}, { get: () => 8 }),
}));

// ── Filter state factory ──────────────────────────────────────────────────────

function makeFilterState(overrides: Partial<CatalogFilterState> = {}): CatalogFilterState {
  return {
    searchQuery: '',
    selectedCategory: 'All',
    selectedBiomarkers: [],
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ── SF-CFH-1: All category pills render ───────────────────────────────────────

describe('SF-CFH-1: all category pills are rendered', () => {
  it('should render the All pill', () => {
    render(
      <CatalogFilterHeader
        filterState={makeFilterState()}
        onFilterChange={jest.fn()}
      />,
    );
    expect(screen.getByText('All')).toBeTruthy();
  });

  it('should render the Serums pill', () => {
    render(
      <CatalogFilterHeader
        filterState={makeFilterState()}
        onFilterChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Serums')).toBeTruthy();
  });

  it('should render the Moisturizers pill', () => {
    render(
      <CatalogFilterHeader
        filterState={makeFilterState()}
        onFilterChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Moisturizers')).toBeTruthy();
  });

  it('should render the SPF pill', () => {
    render(
      <CatalogFilterHeader
        filterState={makeFilterState()}
        onFilterChange={jest.fn()}
      />,
    );
    expect(screen.getByText('SPF')).toBeTruthy();
  });
});

// ── SF-CFH-2: All biomarker badges render ─────────────────────────────────────

describe('SF-CFH-2: all biomarker badges are rendered', () => {
  it('should render the Soothing badge', () => {
    render(
      <CatalogFilterHeader
        filterState={makeFilterState()}
        onFilterChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Soothing')).toBeTruthy();
  });

  it('should render the Actives badge', () => {
    render(
      <CatalogFilterHeader
        filterState={makeFilterState()}
        onFilterChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Actives')).toBeTruthy();
  });

  it('should render the Hydration badge', () => {
    render(
      <CatalogFilterHeader
        filterState={makeFilterState()}
        onFilterChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Hydration')).toBeTruthy();
  });
});

// ── SF-CFH-3: Category pill selected state ────────────────────────────────────

describe('SF-CFH-3: pressing a category pill calls onFilterChange with the selected category', () => {
  it('should call onFilterChange with selectedCategory "Serums" when the Serums pill is pressed', () => {
    const onFilterChange = jest.fn();
    render(
      <CatalogFilterHeader
        filterState={makeFilterState({ selectedCategory: 'All' })}
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Serums'));
    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ selectedCategory: 'Serums' }),
    );
  });
});

// ── SF-CFH-4: Category pill deselect ──────────────────────────────────────────

describe('SF-CFH-4: pressing the already-selected category pill reverts selectedCategory to "All"', () => {
  it('should call onFilterChange with selectedCategory "All" when the already-selected Serums pill is pressed', () => {
    const onFilterChange = jest.fn();
    render(
      <CatalogFilterHeader
        filterState={makeFilterState({ selectedCategory: 'Serums' })}
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Serums'));
    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ selectedCategory: 'All' }),
    );
  });
});

// ── SF-CFH-5: Biomarker badge adds to the array ───────────────────────────────

describe('SF-CFH-5: pressing an unselected biomarker badge adds it to selectedBiomarkers', () => {
  it('should call onFilterChange with selectedBiomarkers ["Actives"] when Actives is pressed from an empty selection', () => {
    const onFilterChange = jest.fn();
    render(
      <CatalogFilterHeader
        filterState={makeFilterState({ selectedBiomarkers: [] })}
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Actives'));
    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ selectedBiomarkers: ['Actives'] }),
    );
  });
});

// ── SF-CFH-6: Biomarker badge removes from the array ─────────────────────────

describe('SF-CFH-6: pressing an already-selected biomarker badge removes it from selectedBiomarkers', () => {
  it('should call onFilterChange with selectedBiomarkers [] when Actives is pressed while already selected', () => {
    const onFilterChange = jest.fn();
    render(
      <CatalogFilterHeader
        filterState={makeFilterState({ selectedBiomarkers: ['Actives'] })}
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Actives'));
    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ selectedBiomarkers: [] }),
    );
  });
});

// ── SF-CFH-7: Multiple biomarkers accumulate ──────────────────────────────────

describe('SF-CFH-7: pressing a second biomarker badge adds it alongside the existing selection', () => {
  it('should call onFilterChange with selectedBiomarkers ["Actives", "Soothing"] when Soothing is pressed while Actives is already selected', () => {
    const onFilterChange = jest.fn();
    render(
      <CatalogFilterHeader
        filterState={makeFilterState({ selectedBiomarkers: ['Actives'] })}
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.press(screen.getByLabelText('Filter by Soothing'));
    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ selectedBiomarkers: ['Actives', 'Soothing'] }),
    );
  });
});
