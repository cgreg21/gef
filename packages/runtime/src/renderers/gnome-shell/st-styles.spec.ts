import { describe, expect, it, vi } from 'vitest';
import { ResourceScope } from '../../resources/resource-scope.js';
import { loadStStylesheet } from './st-styles.js';

describe('loadStStylesheet', () => {
  it('loads once and unloads once with its resource scope', () => {
    const extension = { loadStylesheet: vi.fn(), unloadStylesheet: vi.fn() };
    const scope = new ResourceScope();
    const unload = loadStStylesheet(extension, scope);
    scope.dispose();
    unload();
    expect(extension.loadStylesheet).toHaveBeenCalledOnce();
    expect(extension.unloadStylesheet).toHaveBeenCalledOnce();
  });
});
