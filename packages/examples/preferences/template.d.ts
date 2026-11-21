import type { GtplRenderFunction } from '../../runtime/src/rendering/gtpl-runtime.js';
import type { GtkActor } from '../../runtime/src/renderers/gtk/gtk-render-host.js';

declare const renderPreferences: GtplRenderFunction<Record<string, never>, GtkActor>;
export default renderPreferences;
