import Gtk from 'gi:Gtk-4.0';
import GLib from 'gi:GLib-2.0';
import {
  createGtkRenderHost,
  mountGtplTemplate,
} from '../../../dist/runtime/src/index.js';
import renderKitchenSink from '../../../dist/examples/kitchen-sink/template.js';

Gtk.init();

const host = createGtkRenderHost(Gtk, { api: 'node-gtk' });
const view = mountGtplTemplate({}, renderKitchenSink, host);
const window = new Gtk.Window({
  title: 'GEF Kitchen Sink',
  defaultWidth: 960,
  defaultHeight: 900,
});
const loop = GLib.MainLoop.new(null, false);

window.setChild(view.node);
window.on('close-request', () => {
  view.dispose();
  loop.quit();
  return false;
});
window.present();
loop.run();
