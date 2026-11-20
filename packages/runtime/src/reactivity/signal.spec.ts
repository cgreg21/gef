import { describe, expect, it, vi } from 'vitest';
import { computed, effect, signal } from './signal.js';

describe('signals', () => {
  it('notifies subscribers only when the value changes', () => {
    const value = signal(1);
    const listener = vi.fn();
    const unsubscribe = value.subscribe(listener);
    value.set(1);
    value.set(2);
    unsubscribe();
    value.set(3);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(2, 1);
  });

  it('reruns effects when a dependency changes', () => {
    const value = signal(2);
    const result: number[] = [];
    const dispose = effect(() => result.push(value.get() * 2));
    value.set(3);
    dispose();
    value.set(4);
    expect(result).toEqual([4, 6]);
  });

  it('tracks only dependencies read during the latest effect run', () => {
    const chooseLeft = signal(true);
    const left = signal('left');
    const right = signal('right');
    const result: string[] = [];
    const dispose = effect(() => result.push(chooseLeft.get() ? left.get() : right.get()));
    chooseLeft.set(false);
    left.set('ignored');
    right.set('selected');
    dispose();
    expect(result).toEqual(['left', 'right', 'selected']);
  });

  it('updates computed values and can dispose their dependency effect', () => {
    const count = signal(2);
    const doubled = computed(() => count.get() * 2);
    const values: number[] = [];
    doubled.subscribe((value) => values.push(value));
    count.set(3);
    doubled.dispose();
    count.set(4);
    expect(doubled.get()).toBe(6);
    expect(values).toEqual([6]);
  });

  it('continues notifying observers when one subscriber throws', () => {
    const value = signal(0);
    const listener = vi.fn();
    value.subscribe(() => { throw new Error('listener failed'); });
    value.subscribe(listener);
    expect(() => value.set(1)).toThrow('listener failed');
    expect(listener).toHaveBeenCalledWith(1, 0);
  });

  it('handles a signal update requested from inside an effect without recursion', () => {
    const value = signal(0);
    const observed: number[] = [];
    const dispose = effect(() => {
      const current = value.get();
      observed.push(current);
      if (current === 1) value.set(2);
    });
    value.set(1);
    dispose();
    expect(observed).toEqual([0, 1, 2]);
  });
});
