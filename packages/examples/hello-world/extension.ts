import St from 'gi://St';
import Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import {
  createStRenderHost,
  mountGtplTemplate,
  type GtplRenderRuntime,
  type GtplRenderView,
  type StActor,
  type StNamespace,
} from '../../runtime/src/index.js';

export default class GefHelloWorldExtension extends Extension {
  private view: GtplRenderView<StActor> | undefined;

  override enable(): void {
    const host = createStRenderHost(St as StNamespace);
    this.view = mountGtplTemplate(
      { label: 'GEF' },
      (context, runtime: GtplRenderRuntime<StActor>) => runtime.element(
        'StButton',
        {},
        runtime.element('StLabel', {
          text: runtime.bind(() => context.label),
        }, undefined),
      ),
      host,
    );
    Main.panel.addToStatusArea('gef-hello-world', this.view.node);
  }

  override disable(): void {
    this.view?.dispose();
    this.view = undefined;
  }
}
