import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from './event-emitter.js';

describe('EventEmitter', () => {
  it('emits values to subscribed listeners', () => {
    const emitter = new EventEmitter<number>();
    const listener = vi.fn();

    emitter.subscribe(listener);
    emitter.emit(3);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(3);
  });

  it('supports idempotent unsubscribe', () => {
    const emitter = new EventEmitter<number>();
    const listener = vi.fn();
    const subscription = emitter.subscribe(listener);

    subscription.unsubscribe();
    subscription.unsubscribe();
    emitter.emit(4);

    expect(listener).not.toHaveBeenCalled();
  });

  it('clears all listeners', () => {
    const emitter = new EventEmitter<string>();
    const listener = vi.fn();

    emitter.subscribe(listener);
    emitter.clear();
    emitter.emit('ignored');

    expect(listener).not.toHaveBeenCalled();
  });

  it('uses a stable listener snapshot while emitting', () => {
    const emitter = new EventEmitter<number>();
    const second = vi.fn();
    const first = vi.fn(() => {
      emitter.subscribe(second);
    });

    emitter.subscribe(first);
    emitter.emit(1);

    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();

    emitter.emit(2);
    expect(second).toHaveBeenCalledOnce();
  });
});
