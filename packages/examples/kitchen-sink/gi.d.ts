declare module 'gi:Gtk-4.0' { const Gtk: any; export default Gtk; }
declare module 'gi:GLib-2.0' { const GLib: any; export default GLib; }

declare module '*.js' {
  const render: (...args: any[]) => any;
  export default render;
}
