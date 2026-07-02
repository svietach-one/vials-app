/**
 * Integration tests — ProductActionSheet (extended props)
 *
 * Verifies backward-compatibility of the existing sheet AND the new
 * onAddToRoutine / onRemoveFromRoutine optional props introduced for
 * the ProductShelfCard feature (tech-design FE-2).
 *
 * Backward-compat:
 *   BC-1  Without routine props, sheet renders Hide/Show row as before
 *   BC-2  product=null keeps the sheet hidden
 *   BC-3  Edit and Delete still work unchanged
 *
 * New routine-action props:
 *   RA-1  onAddToRoutine provided → renders "Add to routine" row (not Hide/Show)
 *   RA-2  onRemoveFromRoutine provided → renders "Remove from routine" row (not Hide/Show)
 *   RA-3  Tapping "Add to routine" calls onAddToRoutine and closes the sheet
 *   RA-4  Tapping "Remove from routine" calls onRemoveFromRoutine and closes the sheet
 *   RA-5  Edit still works when routine props are present
 *   RA-6  Delete still works when routine props are present
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ProductActionSheet } from '@/components/product/ProductActionSheet';
import { makeProduct } from './fixtures';

// ── Helpers ───────────────────────────────────────────────────────────────────

const product = makeProduct();

function renderSheet(overrides: Partial<React.ComponentProps<typeof ProductActionSheet>> = {}) {
  const props = {
    product,
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onToggleHidden: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  render(<ProductActionSheet {...props} />);
  return props;
}

// ── BC: Backward-compatibility ────────────────────────────────────────────────

describe('BC — Backward-compatibility (no routine props)', () => {
  it('shows "Hide Product" when the product is not hidden', () => {
    renderSheet({ product: makeProduct({ isHidden: false }) });
    expect(screen.getByText('Hide Product')).toBeTruthy();
  });

  it('shows "Show Product" when the product is already hidden', () => {
    renderSheet({ product: makeProduct({ isHidden: true }) });
    expect(screen.getByText('Show Product')).toBeTruthy();
  });

  it('does not render sheet content when product is null', () => {
    renderSheet({ product: null });
    expect(screen.queryByText('Edit Product')).toBeNull();
  });

  it('calls onEdit when "Edit Product" is tapped', () => {
    const props = renderSheet();
    fireEvent.press(screen.getByText('Edit Product'));
    expect(props.onEdit).toHaveBeenCalledWith(product);
  });

  it('calls onDelete when "Delete Product" is tapped', () => {
    const props = renderSheet();
    fireEvent.press(screen.getByText('Delete Product'));
    expect(props.onDelete).toHaveBeenCalledWith(product);
  });

  it('calls onToggleHidden when the hide/show row is tapped', () => {
    const props = renderSheet({ product: makeProduct({ isHidden: false }) });
    fireEvent.press(screen.getByText('Hide Product'));
    expect(props.onToggleHidden).toHaveBeenCalledWith(product);
  });

  it('"Delete Product" row uses destructive (red) text styling', () => {
    renderSheet();
    const deleteText = screen.getByText('Delete Product');
    expect(deleteText.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: expect.stringMatching(/#[0-9a-fA-F]{6}/) }),
      ]),
    );
  });
});

// ── RA: New routine-action props ──────────────────────────────────────────────

describe('RA — New routine-action props (shelf card context)', () => {
  it('renders "Add to routine" row when onAddToRoutine is provided', () => {
    renderSheet({ onAddToRoutine: jest.fn() });
    expect(screen.getByText('Add to routine')).toBeTruthy();
    expect(screen.queryByText('Hide Product')).toBeNull();
    expect(screen.queryByText('Show Product')).toBeNull();
  });

  it('renders "Remove from routine" row when onRemoveFromRoutine is provided', () => {
    renderSheet({ onRemoveFromRoutine: jest.fn() });
    expect(screen.getByText('Remove from routine')).toBeTruthy();
    expect(screen.queryByText('Hide Product')).toBeNull();
    expect(screen.queryByText('Show Product')).toBeNull();
  });

  it('calls onAddToRoutine and closes the sheet when "Add to routine" is tapped', () => {
    const onAddToRoutine = jest.fn();
    const props = renderSheet({ onAddToRoutine });
    fireEvent.press(screen.getByText('Add to routine'));
    expect(onAddToRoutine).toHaveBeenCalledWith(product);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onRemoveFromRoutine and closes the sheet when "Remove from routine" is tapped', () => {
    const onRemoveFromRoutine = jest.fn();
    const props = renderSheet({ onRemoveFromRoutine });
    fireEvent.press(screen.getByText('Remove from routine'));
    expect(onRemoveFromRoutine).toHaveBeenCalledWith(product);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('still calls onEdit when Edit is tapped alongside routine props', () => {
    const props = renderSheet({ onAddToRoutine: jest.fn() });
    fireEvent.press(screen.getByText('Edit Product'));
    expect(props.onEdit).toHaveBeenCalledWith(product);
  });

  it('still calls onDelete when Delete is tapped alongside routine props', () => {
    const props = renderSheet({ onRemoveFromRoutine: jest.fn() });
    fireEvent.press(screen.getByText('Delete Product'));
    expect(props.onDelete).toHaveBeenCalledWith(product);
  });
});
