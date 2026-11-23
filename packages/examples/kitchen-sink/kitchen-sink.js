import Gtk from 'gi://Gtk';
import {
  createGtkRenderHost,
  mountGtplTemplate,
} from '../../../dist/runtime/src/index.js';
import renderKitchenSink from '../../../dist/examples/kitchen-sink/template.js';

const application = new Gtk.Application({
  application_id: 'org.gnome.GEF.KitchenSink',
});

application.connect('activate', () => {
  const host = createGtkRenderHost(Gtk);
  const view = mountGtplTemplate({}, renderKitchenSink, host);
  const window = new Gtk.ApplicationWindow({
    application,
    title: 'GEF Kitchen Sink',
    default_width: 960,
    default_height: 900,
  });

  window.set_child(view.node);
  window.connect('close-request', () => {
    view.dispose();
    return false;
  });
  window.present();
});

application.run(['gef-kitchen-sink']);
