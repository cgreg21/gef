import { describe, expect, it, vi } from 'vitest';
import { ResourceScope } from '../../resources/resource-scope.js';
import { loadGtkStylesheet } from './gtk-styles.js';

describe('loadGtkStylesheet', () => {
  it('registers and removes a display stylesheet once', () => {
    const provider = { load_from_path: vi.fn() };
    const Gtk = {
      CssProvider: class { load_from_path = provider.load_from_path; },
      StyleContext: {
        add_provider_for_display: vi.fn(),
        remove_provider_for_display: vi.fn(),
      },
    };
    const scope = new ResourceScope();
    loadGtkStylesheet(Gtk, {}, 'prefs.css', 600, scope);
    scope.dispose();
    expect(provider.load_from_path).toHaveBeenCalledWith('prefs.css');
    expect(Gtk.StyleContext.add_provider_for_display).toHaveBeenCalledWith({}, expect.any(Object), 600);
    expect(Gtk.StyleContext.remove_provider_for_display).toHaveBeenCalledOnce();
  });
});
