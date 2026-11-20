import { describe, expect, it, vi } from 'vitest';
import { ResourceScope } from './resource-scope.js';

describe('ResourceScope', () => {
  it('cleans resources in reverse registration order', () => {
    const scope = new ResourceScope();
    const calls: number[] = [];

    scope.add(() => calls.push(1));
    scope.add(() => calls.push(2));
    scope.add(() => calls.push(3));
    scope.dispose();

    expect(calls).toEqual([3, 2, 1]);
  });

  it('is safe to dispose more than once', () => {
    const scope = new ResourceScope();
    const cleanup = vi.fn();
    scope.add(cleanup);

    scope.dispose();
    scope.dispose();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(scope.disposed).toBe(true);
  });

  it('cleans resources added after disposal immediately', () => {
    const scope = new ResourceScope();
    scope.dispose();

    const cleanup = vi.fn();
    scope.add(cleanup);

    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('continues cleanup after an error and rethrows the first error', () => {
    const scope = new ResourceScope();
    const firstError = new Error('first cleanup failed');
    const laterCleanup = vi.fn();

    scope.add(laterCleanup);
    scope.add(() => { throw firstError; });
    scope.add(() => { throw new Error('second cleanup failed'); });

    expect(() => scope.dispose()).toThrow(firstError);
    expect(laterCleanup).toHaveBeenCalledOnce();
    expect(scope.disposed).toBe(true);
  });

  it('does not retain cleanup callbacks after disposal', () => {
    const scope = new ResourceScope();
    const cleanup = vi.fn();
    scope.add(cleanup);

    scope.dispose();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(() => scope.dispose()).not.toThrow();
  });
});
