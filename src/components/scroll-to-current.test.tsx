import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrollToCurrent } from './scroll-to-current.tsx';

function setup(hasCurrent: boolean) {
  const { container } = render(
    <ScrollToCurrent className="tabs">
      <li>
        <span>A</span>
      </li>
      <li>
        <span aria-current={hasCurrent ? 'page' : undefined}>B</span>
      </li>
    </ScrollToCurrent>,
  );
  return container.querySelector('ul')!;
}

const spies: Array<{ mockRestore: () => void }> = [];
const track = <T extends { mockRestore: () => void }>(spy: T): T => {
  spies.push(spy);
  return spy;
};

describe('ScrollToCurrent', () => {
  afterEach(() => {
    cleanup();
    for (const spy of spies.splice(0)) spy.mockRestore();
  });

  it('renders its children in a list with the given class', () => {
    const list = setup(true);
    expect(list.className).toBe('tabs');
    expect(list.querySelectorAll('span')).toHaveLength(2);
  });

  it('scrolls the list so the current item starts at its edge, without touching the page', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    track(vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get')).mockReturnValue(900);
    track(vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get')).mockReturnValue(300);
    track(vi.spyOn(Element.prototype, 'getBoundingClientRect')).mockImplementation(function (this: Element) {
      return { left: this.tagName === 'UL' ? 16 : 416 } as DOMRect;
    });
    expect(setup(true).scrollLeft).toBe(400);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('does nothing when the list does not overflow', () => {
    track(vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get')).mockReturnValue(300);
    track(vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get')).mockReturnValue(300);
    expect(setup(true).scrollLeft).toBe(0);
  });

  it('does nothing when no item is current', () => {
    track(vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get')).mockReturnValue(900);
    track(vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get')).mockReturnValue(300);
    expect(setup(false).scrollLeft).toBe(0);
  });
});
