import { ResourceScope } from '../../resources/resource-scope.js';

export interface GtkCssProvider {
  load_from_path(path: string): void;
}

export interface GtkCssNamespace {
  readonly CssProvider: new () => GtkCssProvider;
  readonly StyleContext: {
    add_provider_for_display(display: unknown, provider: GtkCssProvider, priority: number): void;
    remove_provider_for_display(display: unknown, provider: GtkCssProvider): void;
  };
}

/** Loads a GTK stylesheet for one display and removes its provider on disposal. */
export function loadGtkStylesheet(
  Gtk: GtkCssNamespace,
  display: unknown,
  path: string,
  priority: number,
  scope?: ResourceScope,
): () => void {
  const provider = new Gtk.CssProvider();
  provider.load_from_path(path);
  Gtk.StyleContext.add_provider_for_display(display, provider, priority);
  let loaded = true;
  const unload = () => {
    if (!loaded) return;
    loaded = false;
    Gtk.StyleContext.remove_provider_for_display(display, provider);
  };
  scope?.add(unload);
  return unload;
}
