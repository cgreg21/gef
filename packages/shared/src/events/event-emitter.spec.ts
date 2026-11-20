import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from './event-emitter.js';

describe('shared EventEmitter', () => {
  it('emits to a stable snapshot of listeners', () => {
    const emitter = new EventEmitter<number>();
    const second = vi.fn();
    const first = vi.fn(() => emitter.subscribe(second));
    emitter.subscribe(first);
    emitter.emit(1);
    expect(second).not.toHaveBeenCalled();
    emitter.emit(2);
    expect(second).toHaveBeenCalledOnce();
  });

  it('supports idempotent unsubscribe and clear', () => {
    const emitter = new EventEmitter<string>();
    const listener = vi.fn();
    const subscription = emitter.subscribe(listener);
    subscription.unsubscribe();
    subscription.unsubscribe();
    emitter.emit('ignored');
    expect(listener).not.toHaveBeenCalled();
    emitter.subscribe(listener);
    emitter.clear();
    emitter.emit('also ignored');
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies remaining listeners when one listener throws', () => {
    const emitter = new EventEmitter<number>();
    const remaining = vi.fn();
    emitter.subscribe(() => { throw new Error('listener failed'); });
    emitter.subscribe(remaining);
    expect(() => emitter.emit(4)).toThrow('listener failed');
    expect(remaining).toHaveBeenCalledWith(4);
  });
});
