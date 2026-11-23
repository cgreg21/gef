import Gtk from 'gi://Gtk';
import {
  createGtkRenderHost,
  mountGtplTemplate,
} from '../../runtime/src/index.js';
import renderShowcase from './template.js';

const application = new Gtk.Application({
  application_id: 'org.gnome.GEF.UIShowcase',
});

application.connect('activate', () => {
  const host = createGtkRenderHost(Gtk, {
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 12,
  });
  const view = mountGtplTemplate({}, renderShowcase, host);
  const window = new Gtk.ApplicationWindow({
    application,
    title: 'GEF UI Showcase',
    default_width: 760,
    default_height: 720,
  });

  window.set_child(view.node);
  window.connect('close-request', () => {
    view.dispose();
    return false;
  });
  window.present();
});

application.run([]);
