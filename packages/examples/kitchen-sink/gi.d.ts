declare module 'gi:Gtk-4.0' { const Gtk: any; export default Gtk; }
declare module 'gi:GLib-2.0' { const GLib: any; export default GLib; }

declare module '*.js' {
  import type { GtkActor, GtplRenderFunction } from '../../runtime/src/index.js';
  const render: GtplRenderFunction<Record<string, never>, GtkActor>;
  export default render;
}
