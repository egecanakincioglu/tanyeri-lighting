import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../../test/axe.ts';
import { FormActions } from './form-actions.tsx';

const texts = { saved: 'Saved.', errors: { generic: 'Something went wrong.' } } as never;

afterEach(cleanup);

describe('FormActions', () => {
  it('keeps the buttons and the answer of the last submit together, stuck to the bottom of the screen', () => {
    const { container } = render(
      <FormActions state={{ status: 'success' }} texts={texts}>
        <button type="submit">Save</button>
      </FormActions>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Saved.');
    expect((container.firstElementChild as HTMLElement).className).toContain('sticky');
  });

  it('shows the error of a failed save next to the button', () => {
    render(
      <FormActions state={{ status: 'error', code: 'generic', fieldErrors: {} }} texts={texts}>
        <button type="submit">Save</button>
      </FormActions>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Something went wrong.');
  });

  it('says why saving is off when given a note, and nothing otherwise', () => {
    const { rerender } = render(
      <FormActions state={null} texts={texts} note="Saving is off in the demo.">
        <button type="submit" disabled>
          Save
        </button>
      </FormActions>,
    );
    expect(screen.getByText('Saving is off in the demo.')).toBeTruthy();
    rerender(
      <FormActions state={null} texts={texts}>
        <button type="submit">Save</button>
      </FormActions>,
    );
    expect(screen.queryByText('Saving is off in the demo.')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <FormActions state={null} texts={texts} note="Saving is off in the demo.">
        <button type="submit" disabled>
          Save
        </button>
      </FormActions>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
