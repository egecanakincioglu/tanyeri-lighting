import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../test/axe.ts';
import type { FormState } from '../../../server/admin/form.ts';
import { buildFormTexts } from '../texts.ts';
import { FeaturedEditor, type FeaturedItem } from './featured-editor.tsx';

const formTexts = buildFormTexts((key) => (key === 'save' ? 'Save' : key === 'saving' ? 'Saving' : key));
const texts = {
  current: 'On the home page',
  counter: '{count} of {max}',
  empty: 'No product is featured yet.',
  moveUp: 'Move up',
  moveDown: 'Move down',
  remove: 'Remove',
  add: 'Add a product',
  search: 'Search',
  noMatch: 'No product to add.',
  full: 'The list is full.',
  refine: 'More products match.',
};

const item = (n: number): FeaturedItem => ({
  id: `p${n}`,
  name: `Lamp ${n}`,
  code: `CODE-${n}`,
  imageUrl: '/demo/area-otel.webp',
});
const products = [1, 2, 3, 4].map(item);

const save = vi.fn<(ids: string[]) => Promise<FormState>>();

function setup(props: { initial?: FeaturedItem[]; limit?: number; products?: FeaturedItem[]; off?: string } = {}) {
  return render(
    <FeaturedEditor
      initial={props.initial ?? [item(1), item(2)]}
      products={props.products ?? products}
      limit={props.limit ?? 3}
      save={save}
      texts={texts}
      formTexts={formTexts}
      disabledReason={props.off}
    />,
  );
}

async function press(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

const order = () => [...document.querySelectorAll('ol > li')].map((row) => row.querySelector('p')?.textContent);

describe('FeaturedEditor', () => {
  beforeEach(() => {
    save.mockClear();
    save.mockResolvedValue({ status: 'success' });
  });
  afterEach(cleanup);

  it('shows the current list in order with the count, and offers only the other products', () => {
    setup();
    expect(screen.getByRole('heading', { name: /On the home page/ }).textContent).toContain('2 of 3');
    expect(screen.queryByRole('button', { name: 'Add a product: Lamp 1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a product: Lamp 3' })).toBeTruthy();
  });

  it('adds, moves and removes products, and saves the complete list in that order', async () => {
    setup();
    await press('Add a product: Lamp 3');
    await press('Move up: Lamp 3');
    await press('Move up: Lamp 3');
    await press('Move down: Lamp 1');
    await press('Remove: Lamp 2');
    expect(order()).toEqual(['Lamp 3', 'Lamp 1']);
    await press('Save');
    expect(save).toHaveBeenCalledWith(['p3', 'p1']);
    expect(screen.getByRole('status').textContent).toBe('saved');
  });

  it('moves the focus to the next remove button, else the previous, else the search field', async () => {
    setup({ initial: [item(1), item(2), item(3)], limit: 4 });
    await press('Remove: Lamp 2');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove: Lamp 3' }));
    await press('Remove: Lamp 3');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove: Lamp 1' }));
    await press('Remove: Lamp 1');
    expect(document.activeElement).toBe(screen.getByLabelText('Search'));
  });

  it('moves the focus to the search field after adding a product', async () => {
    setup({ limit: 4 });
    await press('Add a product: Lamp 3');
    expect(document.activeElement).toBe(screen.getByLabelText('Search'));
  });

  it('moves the focus to the remove button of the new row when adding fills the list', async () => {
    setup({ limit: 3 });
    await press('Add a product: Lamp 3');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove: Lamp 3' }));
  });

  it('does not move the first up or the last down', async () => {
    setup();
    await press('Move up: Lamp 1');
    await press('Move down: Lamp 2');
    expect(order()).toEqual(['Lamp 1', 'Lamp 2']);
  });

  it('searches by name or code and says when nothing matches', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'code-4' } });
    expect(screen.queryByRole('button', { name: 'Add a product: Lamp 3' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a product: Lamp 4' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } });
    expect(screen.getByText('No product to add.')).toBeTruthy();
  });

  it('stops adding at the limit and says so', async () => {
    setup({ limit: 3 });
    await press('Add a product: Lamp 3');
    expect(screen.getByText('The list is full.')).toBeTruthy();
    expect((screen.getByLabelText('Search') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Add a product: Lamp 4' })).toBeNull();
  });

  it('lists at most 30 matches and asks to narrow the search', () => {
    const many = Array.from({ length: 35 }, (_, n) => item(100 + n));
    setup({ initial: [], products: many, limit: 6 });
    expect(screen.getAllByRole('button', { name: /^Add a product:/ })).toHaveLength(30);
    expect(screen.getByText('More products match.')).toBeTruthy();
  });

  it('says so when the list is empty and can save an empty list', async () => {
    setup({ initial: [] });
    expect(screen.getByText('No product is featured yet.')).toBeTruthy();
    await press('Save');
    expect(save).toHaveBeenCalledWith([]);
  });

  it('shows the error the server gives', async () => {
    save.mockResolvedValue({ status: 'error', code: 'notFound', fieldErrors: {} });
    setup();
    await press('Save');
    expect(screen.getByRole('alert').textContent).toContain('errors.notFound');
  });

  it('turns every control off in the demo and says why', () => {
    setup({ off: 'Off in the demo.' });
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled || button.getAttribute('aria-disabled') === 'true').toBe(true);
    }
    expect(screen.getByText('Off in the demo.')).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = setup();
    expect(await axeViolations(container)).toEqual([]);
  });
});
