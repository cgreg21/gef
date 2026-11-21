import St from 'gi://St';
import Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import {
  ResourceScope,
  bindGSettingsBoolean,
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
  private releaseStylesheet: (() => void) | undefined;
  private settingsScope: ResourceScope | undefined;

  override enable(): void {
    this.releaseStylesheet = loadStStylesheet(this);
    const host = createStRenderHost(St as StNamespace);
    this.settingsScope = new ResourceScope();
    const enabled = bindGSettingsBoolean(this.getSettings(), 'enabled', this.settingsScope);
    this.view = mountGtplTemplate({ enabled }, renderTemplate, host);
    Main.panel.addToStatusArea('gef-hello-world', this.view.node);
  }

  override disable(): void {
    this.view?.dispose();
    this.view = undefined;
    this.releaseStylesheet?.();
    this.releaseStylesheet = undefined;
    this.settingsScope?.dispose();
    this.settingsScope = undefined;
  }
}
