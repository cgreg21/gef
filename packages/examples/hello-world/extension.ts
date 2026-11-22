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
  private scope: ResourceScope | undefined;

  override enable(): void {
    if (this.scope) return;

    const scope = new ResourceScope();
    this.scope = scope;

    try {
      loadStStylesheet(this, scope);

      const settingsScope = new ResourceScope();
      scope.add(() => settingsScope.dispose());
      const enabled = bindGSettingsBoolean(this.getSettings(), 'enabled', settingsScope);
      const host = createStRenderHost(St as StNamespace);
      const view = mountGtplTemplate({ enabled }, renderTemplate, host);
      this.view = view;
      scope.add(() => {
        view.dispose();
        this.view = undefined;
      });

      Main.panel.addToStatusArea('gef-hello-world', view.node);
    } catch (error) {
      scope.dispose();
      this.scope = undefined;
      throw error;
    }
  }

  override disable(): void {
    const scope = this.scope;
    this.scope = undefined;
    scope?.dispose();
  }
}
