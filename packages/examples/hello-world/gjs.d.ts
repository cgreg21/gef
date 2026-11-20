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
  }
}
