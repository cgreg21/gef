import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {
  createGtkRenderHost,
  mountGtplTemplate,
  type AdwNamespace,
  type GtkNamespace,
} from '../../runtime/src/index.js';
import renderPreferences from './template.js';

export default class GefPreferences extends ExtensionPreferences {
  private disposeView: (() => void) | undefined;

  override fillPreferencesWindow(window: {
    add(widget: unknown): void;
    connect(signal: string, callback: () => boolean): number;
    disconnect(id: number): void;
  }): void {
    this.disposeView?.();
    const host = createGtkRenderHost(Gtk as unknown as GtkNamespace, {
      adw: Adw as unknown as AdwNamespace,
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 12,
    });
    const view = mountGtplTemplate({}, renderPreferences, host);
    window.add(view.node);
    const closeHandler = window.connect('close-request', () => {
      view.dispose();
      this.disposeView = undefined;
      return false;
    });
    this.disposeView = () => {
      window.disconnect(closeHandler);
      view.dispose();
    };
  }
}
