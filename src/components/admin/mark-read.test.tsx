import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkRead } from './mark-read.tsx';

afterEach(cleanup);

describe('MarkRead', () => {
  it('calls the action once with the id and shows nothing', () => {
    const action = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
    const { container } = render(<MarkRead id="m1" action={action} />);
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith('m1');
    expect(container.innerHTML).toBe('');
  });
});
