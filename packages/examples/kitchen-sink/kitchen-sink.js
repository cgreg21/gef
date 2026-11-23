import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import {
  createGtkRenderHost,
  mountGtplTemplate,
} from '../../../dist/runtime/src/index.js';
import renderKitchenSink from '../../../dist/examples/kitchen-sink/template.js';

Gtk.init();

const host = createGtkRenderHost(Gtk);
const view = mountGtplTemplate({}, renderKitchenSink, host);
const window = new Gtk.Window({
  title: 'GEF Kitchen Sink',
  default_width: 960,
  default_height: 900,
});
const loop = GLib.MainLoop.new(null, false);

window.set_child(view.node);
window.connect('close-request', () => {
  view.dispose();
  loop.quit();
  return false;
});
window.present();
loop.run();
