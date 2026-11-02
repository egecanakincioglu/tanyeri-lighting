import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormState } from '../../server/admin/form.ts';
import { axeViolations } from '../../test/axe.ts';
import { ResourceList, type ResourceListTexts, type ResourceRow } from './resource-list.tsx';

const texts: ResourceListTexts = {
  edit: 'Edit',
  moveUp: 'Move up',
  moveDown: 'Move down',
  empty: 'There are no items yet.',
  reordered: 'Order saved.',
  delete: {
    trigger: 'Delete',
    title: 'Delete?',
    body: '“{name}” will be deleted.',
    confirm: 'Yes',
    working: '…',
    cancel: 'Cancel',
  },
};
const formTexts = { saved: 'Saved.', errors: { invalidOrder: 'The list changed.' } } as never;

const rows: ResourceRow[] = ['Alpha', 'Beta', 'Gamma'].map((title, index) => ({
  id: `id-${index}`,
  title,
  subtitle: `${title} work`,
  imageUrl: '/demo/area-otel.webp',
  edit: { pathname: '/dashboard/references/[id]', params: { id: `id-${index}` } },
}));

const reorder = vi.fn<(ids: string[]) => Promise<FormState>>();
const deleteAction = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();

function setup(items: ResourceRow[] = rows, disabledReason?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={{}}>
      <ResourceList
        rows={items}
        locale="en"
        texts={texts}
        formTexts={formTexts}
        reorder={reorder}
        deleteAction={deleteAction}
        disabledReason={disabledReason}
      />
    </NextIntlClientProvider>,
  );
}

const titles = () =>
  screen.getAllByRole('listitem').map((item) => within(item).getAllByRole('paragraph')[0]!.textContent);

describe('ResourceList', () => {
  beforeEach(() => {
    reorder.mockClear();
    reorder.mockResolvedValue({ status: 'success' });
    deleteAction.mockClear();
  });
  afterEach(cleanup);

  it('shows the empty state when there is nothing to list', () => {
    setup([]);
    expect(screen.getByText('There are no items yet.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('lists each row with its thumbnail, subtitle, edit link and delete button', () => {
    const { container } = setup();
    expect(titles()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(screen.getByText('Beta work')).toBeTruthy();
    expect(container.querySelectorAll('img')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Edit: Beta' }).getAttribute('href')).toBe('/en/admin/references/id-1');
    expect(screen.getByRole('button', { name: 'Delete: Beta' })).toBeTruthy();
  });

  it('works for a row without a picture or subtitle', () => {
    const { container } = setup([{ id: 'x', title: 'Plain', edit: '/dashboard/references' }]);
    expect(container.querySelector('img')).toBeNull();
    expect(titles()).toEqual(['Plain']);
  });

  it('moves a row up and sends the complete new order', async () => {
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move up: Beta' }));
    });
    expect(reorder).toHaveBeenCalledWith(['id-1', 'id-0', 'id-2']);
    expect(screen.getByRole('status').textContent).toBe('Order saved.');
  });

  it('moves a row down', async () => {
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move down: Alpha' }));
    });
    expect(reorder).toHaveBeenCalledWith(['id-1', 'id-0', 'id-2']);
  });

  it('does nothing at the ends of the list and marks those buttons as unavailable', async () => {
    setup();
    const first = screen.getByRole('button', { name: 'Move up: Alpha' });
    const last = screen.getByRole('button', { name: 'Move down: Gamma' });
    expect([first.getAttribute('aria-disabled'), last.getAttribute('aria-disabled')]).toEqual(['true', 'true']);
    await act(async () => {
      fireEvent.click(first);
      fireEvent.click(last);
    });
    expect(reorder).not.toHaveBeenCalled();
  });

  it('shows why the order could not be saved', async () => {
    reorder.mockResolvedValue({ status: 'error', code: 'invalidOrder', fieldErrors: {} });
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move down: Alpha' }));
    });
    expect(screen.getByRole('alert').textContent).toBe('The list changed.');
  });

  it('leaves the order and the delete buttons alone in the demo, and says why', async () => {
    setup(rows, 'Off in the demo.');
    expect(screen.getAllByText('Off in the demo.').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Move down: Alpha' }).getAttribute('aria-disabled')).toBe('true');
    expect((screen.getByRole('button', { name: 'Delete: Alpha' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move down: Alpha' }));
    });
    expect(reorder).not.toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    const { container } = setup();
    expect(await axeViolations(container)).toEqual([]);
  });
});
