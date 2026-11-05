import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormState } from '../../server/admin/form.ts';
import { axeViolations } from '../../test/axe.ts';
import { ConfirmDelete } from './confirm-delete.tsx';

const texts = {
  trigger: 'Delete',
  title: 'Delete this reference?',
  body: '“{name}” will be deleted for good.',
  confirm: 'Yes, delete',
  working: 'Deleting…',
  cancel: 'Cancel',
};
const formTexts = { saved: 'Saved.', errors: { notFound: 'Not found.' } } as never;
const action = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();

// jsdom has no modal dialog; this stand-in sets and clears the attribute.
beforeEach(() => {
  action.mockClear();
  action.mockResolvedValue({ status: 'success' });
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});
afterEach(cleanup);

function setup(disabledReason?: string) {
  return render(
    <ConfirmDelete
      name="Alpha Hotel"
      fields={{ id: 'r1', locale: 'en' }}
      action={action}
      texts={texts}
      formTexts={formTexts}
      disabledReason={disabledReason}
    />,
  );
}

describe('ConfirmDelete', () => {
  it('can be an icon button that keeps the name and opens the same dialog', () => {
    render(
      <ConfirmDelete
        name="Alpha Hotel"
        fields={{ id: 'r1' }}
        action={action}
        texts={texts}
        formTexts={formTexts}
        compact
      />,
    );
    const button = screen.getByRole('button', { name: 'Delete: Alpha Hotel' });
    expect(button.textContent).toBe('');
    fireEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Delete this reference?' })).toBeTruthy();
  });

  it('turns the icon button off in the demo and points to the reason', () => {
    render(
      <ConfirmDelete
        name="Alpha Hotel"
        fields={{ id: 'r1' }}
        action={action}
        texts={texts}
        formTexts={formTexts}
        disabledReason="Not in the demo."
        compact
      />,
    );
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Delete: Alpha Hotel' });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('names what the button deletes and keeps the dialog closed until asked', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Delete: Alpha Hotel' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
  });

  it('opens a named dialog that shows what will be deleted, with the safe choice first', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete: Alpha Hotel' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this reference?' });
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(dialog.textContent).toContain('“Alpha Hotel” will be deleted for good.');
    // The browser focuses the first control of a modal dialog, which must be the safe choice.
    expect(dialog.querySelector('button, a[href], input:not([type="hidden"])')?.textContent).toBe('Cancel');
  });

  it('closes without deleting when cancelled', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete: Alpha Hotel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it('sends the hidden fields to the action when confirmed', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete: Alpha Hotel' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    });
    expect(action).toHaveBeenCalledTimes(1);
    const sent = action.mock.calls[0]![1];
    expect([sent.get('id'), sent.get('locale')]).toEqual(['r1', 'en']);
  });

  it('shows why a delete failed, inside the dialog', async () => {
    action.mockResolvedValue({ status: 'error', code: 'notFound', fieldErrors: {} });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete: Alpha Hotel' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    });
    expect(screen.getByRole('alert').textContent).toBe('Not found.');
  });

  it('is off with a reason in the demo', () => {
    setup('Off in the demo.');
    const button = screen.getByRole('button', { name: 'Delete: Alpha Hotel' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe('Off in the demo.');
  });

  it('has no axe violations, closed or open', async () => {
    const { container } = setup();
    expect(await axeViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete: Alpha Hotel' }));
    expect(await axeViolations(container)).toEqual([]);
  });
});
