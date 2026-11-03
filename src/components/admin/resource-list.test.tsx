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
const formTexts = { saved: 'Saved.', deleted: 'Deleted.', errors: { invalidOrder: 'The list changed.' } } as never;

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

  it('opens the edit page from the title link, which is named after the row', () => {
    setup();
    const link = screen.getByRole('link', { name: 'Beta' });
    expect(link.getAttribute('href')).toBe('/en/admin/references/id-1');
    expect(screen.getByRole('link', { name: 'Edit: Beta' }).getAttribute('href')).toBe(link.getAttribute('href'));
  });

  it('names the delete button after its row, as an icon without a visible label', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Delete: Gamma' });
    expect(button.textContent).toBe('');
    expect(button.getAttribute('title')).toBe('Delete');
  });

  it('offers the create action in the empty state', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <ResourceList
          rows={[]}
          locale="en"
          texts={texts}
          formTexts={formTexts}
          deleteAction={deleteAction}
          createAction={<button type="button">Add one</button>}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('There are no items yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add one' })).toBeTruthy();
  });

  it('has no arrows when the list has no reorder action', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <ResourceList rows={rows} locale="en" texts={texts} formTexts={formTexts} deleteAction={deleteAction} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole('button', { name: /^Move/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete: Beta' })).toBeTruthy();
  });

  it('says what a deletion takes along in the dialog of a row that has such a text', () => {
    setup([{ ...rows[0]!, deleteBody: '“{name}” is also on the home page.' }, rows[1]!]);
    expect(document.body.textContent).toContain('“Alpha” is also on the home page.');
    expect(document.body.textContent).toContain('“Beta” will be deleted.');
  });

  it('shows cover thumbnails in a portrait box when asked', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <ResourceList
          rows={rows}
          locale="en"
          texts={texts}
          formTexts={formTexts}
          reorder={reorder}
          deleteAction={deleteAction}
          portraitImages
        />
      </NextIntlClientProvider>,
    );
    expect(container.querySelector('img')!.parentElement!.className).toContain('aspect-[210/297]');
    expect(container.querySelector('img')!.getAttribute('sizes')).toBe('56px');
  });

  it('tells the browser the real width of a landscape thumbnail', () => {
    const { container } = setup();
    expect(container.querySelector('img')!.getAttribute('sizes')).toBe('80px');
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

  it('says a row was deleted instead of the order, and moves the focus to the page body', async () => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    deleteAction.mockResolvedValue({ status: 'success' });
    const main = document.createElement('main');
    main.id = 'main';
    main.tabIndex = -1;
    document.body.append(main);
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move up: Beta' }));
    });
    expect(screen.getByRole('status').textContent).toBe('Order saved.');
    const dialog = screen.getAllByRole('dialog', { hidden: true })[0]!;
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Yes', hidden: true }));
    });
    expect(screen.getByRole('status').textContent).toBe('Deleted.');
    expect(document.activeElement).toBe(main);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move down: Alpha' }));
    });
    expect(screen.getByRole('status').textContent).toBe('Order saved.');
    main.remove();
  });

  it('still says the row was deleted when it was the last one', async () => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    deleteAction.mockResolvedValue({ status: 'success' });
    const main = document.createElement('main');
    main.id = 'main';
    main.tabIndex = -1;
    document.body.append(main);
    const view = setup([rows[0]!]);
    await act(async () => {
      fireEvent.click(
        within(screen.getAllByRole('dialog', { hidden: true })[0]!).getByRole('button', { name: 'Yes', hidden: true }),
      );
    });
    view.rerender(
      <NextIntlClientProvider locale="en" messages={{}}>
        <ResourceList rows={[]} locale="en" texts={texts} formTexts={formTexts} deleteAction={deleteAction} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('There are no items yet.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Deleted.');
    expect(document.activeElement).toBe(main);
    main.remove();
  });

  it('keeps the focus and the status line when the delete fails', async () => {
    deleteAction.mockResolvedValue({ status: 'error', code: 'invalidOrder', fieldErrors: {} });
    setup();
    const dialog = screen.getAllByRole('dialog', { hidden: true })[0]!;
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Yes', hidden: true }));
    });
    expect(screen.queryByText('Deleted.')).toBeNull();
    expect(document.activeElement).toBe(document.body);
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
