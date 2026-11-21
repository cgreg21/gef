import St from 'gi://St';
import Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import {
  createStRenderHost,
  mountGtplTemplate,
  type GtplRenderView,
  type StActor,
  type StNamespace,
  loadStStylesheet,
} from '../../runtime/src/index.js';
import renderTemplate from './template.js';

export default class GefHelloWorldExtension extends Extension {
  private view: GtplRenderView<StActor> | undefined;
  private unloadStylesheet: (() => void) | undefined;

  override enable(): void {
    this.unloadStylesheet = loadStStylesheet(this);
    const host = createStRenderHost(St as StNamespace);
    this.view = mountGtplTemplate({}, renderTemplate, host);
    Main.panel.addToStatusArea('gef-hello-world', this.view.node);
  }

  override disable(): void {
    this.view?.dispose();
    this.view = undefined;
    this.unloadStylesheet?.();
    this.unloadStylesheet = undefined;
  }
}
