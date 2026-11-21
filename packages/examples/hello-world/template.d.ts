import type { GtplRenderFunction } from '../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../runtime/src/renderers/gnome-shell/st-render-host.js';

declare const renderTemplate: GtplRenderFunction<{ enabled: import('../../runtime/src/reactivity/signal.js').ReadonlySignal<boolean> }, StActor>;
export default renderTemplate;
