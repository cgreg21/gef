import { describe, expect, it, vi } from 'vitest';
import { ResourceScope } from '../resources/resource-scope.js';
import { connectGObjectSignal, createGjsScheduler } from './gjs.js';

function createGLib() {
  let nextId = 1;
  const callbacks = new Map<number, () => boolean>();
  const removed: number[] = [];
  return {
    glib: {
      PRIORITY_DEFAULT: 0,
      PRIORITY_DEFAULT_IDLE: 200,
      timeout_add: vi.fn((_priority: number, _interval: number, callback: () => boolean) => {
        const id = nextId++;
        callbacks.set(id, callback);
        return id;
      }),
      idle_add: vi.fn((_priority: number, callback: () => boolean) => {
        const id = nextId++;
        callbacks.set(id, callback);
        return id;
      }),
      source_remove: vi.fn((id: number) => { removed.push(id); callbacks.delete(id); }),
    },
    callbacks,
    removed,
  };
}

describe('GJS platform helpers', () => {
  it('runs a timeout once and does not remove an already completed source', () => {
    const { glib, callbacks, removed } = createGLib();
    const callback = vi.fn();
    const cancel = createGjsScheduler(glib).timeout(100, callback);
    expect(callbacks.get(1)?.()).toBe(false);
    expect(callback).toHaveBeenCalledOnce();
    cancel();
    expect(removed).toEqual([]);
  });

  it('cancels an interval and owns it in a resource scope', () => {
    const { glib, callbacks, removed } = createGLib();
    const scope = new ResourceScope();
    const callback = vi.fn();
    createGjsScheduler(glib).interval(50, callback, scope);
    expect(callbacks.get(1)?.()).toBe(true);
    scope.dispose();
    expect(removed).toEqual([1]);
    expect(callbacks.get(1)).toBeUndefined();
  });

  it('schedules idle work and supports explicit cancellation', () => {
    const { glib, callbacks, removed } = createGLib();
    const callback = vi.fn();
    const cancel = createGjsScheduler(glib).idle(callback);
    cancel();
    expect(removed).toEqual([1]);
    expect(callbacks.get(1)).toBeUndefined();
  });

  it('connects a GObject signal and disconnects it once with its scope', () => {
    const source = { connect: vi.fn(() => 7), disconnect: vi.fn() };
    const scope = new ResourceScope();
    const disconnect = connectGObjectSignal(source, 'notify::visible', vi.fn(), scope);
    scope.dispose();
    disconnect();
    expect(source.connect).toHaveBeenCalledWith('notify::visible', expect.any(Function));
    expect(source.disconnect).toHaveBeenCalledOnceWith(7);
  });
});
