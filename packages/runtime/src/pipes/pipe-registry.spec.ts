import { Pipe } from '../../../shared/src/components/metadata.js';
import { describe, expect, it, vi } from 'vitest';
import { PipeRegistry } from './pipe-registry.js';

describe('PipeRegistry', () => {
  it('caches pure pipe transforms by input and arguments', () => {
    const transform = vi.fn((value: unknown, suffix: unknown) => `${value}${suffix}`);
    const pipes = new PipeRegistry().register('append', { transform });
    expect(pipes.transform('append', 'gef', '!')).toBe('gef!');
    expect(pipes.transform('append', 'gef', '!')).toBe('gef!');
    expect(pipes.transform('append', 'gef', '?')).toBe('gef?');
    expect(transform).toHaveBeenCalledTimes(2);
  });

  it('registers a pipe using decorator metadata', () => {
    const transform = vi.fn((value: unknown) => String(value).toUpperCase());
    const pipes = new PipeRegistry().registerMetadata({ name: 'uppercase', pure: true }, { transform });
    expect(pipes.transform('uppercase', 'gef')).toBe('GEF');
    expect(pipes.has('uppercase')).toBe(true);
  });

  it('registers a decorated pipe class directly', () => {
    @Pipe({ name: 'uppercase' })
    class UppercasePipe {
      transform(value: unknown): string { return String(value).toUpperCase(); }
    }
    const pipes = new PipeRegistry().registerType(UppercasePipe, () => new UppercasePipe());
    expect(pipes.transform('uppercase', 'gef')).toBe('GEF');
  });

  it('does not cache impure pipes', () => {
    const transform = vi.fn((value: unknown) => value);
    const pipes = new PipeRegistry().register('clock', { transform }, false);
    pipes.transform('clock', 1);
    pipes.transform('clock', 1);
    expect(transform).toHaveBeenCalledTimes(2);
  });

  it('rejects duplicate and invalid names and reports missing pipes', () => {
    const pipe = { transform: (value: unknown) => value };
    const pipes = new PipeRegistry().register('identity', pipe);
    expect(() => pipes.register('identity', pipe)).toThrow(/Duplicate/);
    expect(() => pipes.register('not valid', pipe)).toThrow(/Invalid/);
    expect(() => pipes.transform('missing', 1)).toThrow(/No GEF pipe/);
  });

  it('clears registered pipes', () => {
    const pipes = new PipeRegistry().register('identity', { transform: (value) => value });
    expect(pipes.has('identity')).toBe(true);
    pipes.clear();
    expect(pipes.has('identity')).toBe(false);
  });
});
