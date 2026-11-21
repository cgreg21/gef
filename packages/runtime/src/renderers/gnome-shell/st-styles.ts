import { ResourceScope } from '../../resources/resource-scope.js';

export interface StStylesheetExtension {
  loadStylesheet(): void;
  unloadStylesheet(): void;
}

/** Loads the extension stylesheet once and binds unloading to its owner scope. */
export function loadStStylesheet(extension: StStylesheetExtension, scope?: ResourceScope): () => void {
  extension.loadStylesheet();
  let loaded = true;
  const unload = () => {
    if (!loaded) return;
    loaded = false;
    extension.unloadStylesheet();
  };
  scope?.add(unload);
  return unload;
}
