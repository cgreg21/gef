declare module 'gi://St' {
  const St: unknown;
  export default St;
}

declare module 'resource:///org/gnome/shell/ui/main.js' {
  const Main: {
    readonly panel: {
      addToStatusArea(name: string, actor: unknown): void;
    };
  };
  export default Main;
}

declare module 'resource:///org/gnome/shell/extensions/extension.js' {
  export class Extension {
    enable(): void;
    disable(): void;
    loadStylesheet(): void;
    unloadStylesheet(): void;
    getSettings(): GSettings;
  }
}

interface GSettings {
  get_boolean(key: string): boolean;
  set_boolean(key: string, value: boolean): void;
  connect(signal: string, callback: (...args: unknown[]) => void): number;
  disconnect(handlerId: number): void;
}

declare module 'gi://Gtk' {
  const Gtk: {
    readonly Box: new (properties?: Record<string, unknown>) => unknown;
    readonly Label: new (properties?: Record<string, unknown>) => unknown;
    readonly Button: new (properties?: Record<string, unknown>) => unknown;
    readonly Entry: new (properties?: Record<string, unknown>) => unknown;
    readonly Image: new (properties?: Record<string, unknown>) => unknown;
    readonly ScrolledWindow: new (properties?: Record<string, unknown>) => unknown;
    readonly Switch: new (properties?: Record<string, unknown>) => unknown;
    readonly Orientation: { readonly VERTICAL: number; readonly HORIZONTAL: number };
  };
  export default Gtk;
}
declare module 'gi://Adw' {
  const Adw: {
    readonly PreferencesPage: new (properties?: Record<string, unknown>) => unknown;
    readonly PreferencesGroup: new (properties?: Record<string, unknown>) => unknown;
    readonly ActionRow: new (properties?: Record<string, unknown>) => unknown;
  };
  export default Adw;
}
declare module 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js' {
  export class ExtensionPreferences {
    getSettings(): GSettings;
    fillPreferencesWindow(window: { add(widget: unknown): void }): void;
  }
}
