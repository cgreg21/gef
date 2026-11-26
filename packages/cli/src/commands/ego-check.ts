import { basename, dirname, relative, resolve } from 'node:path';
import type { CliIO } from '../index.js';

export async function runEgoCheck(
  inputArg: string | undefined,
  io: Pick<CliIO, 'readFile' | 'listFiles' | 'stdout' | 'stderr'>,
): Promise<number> {
  if (!inputArg || inputArg.startsWith('-')) {
    io.stderr('Missing staged extension directory.');
    return 2;
  }
  const directory = resolve(inputArg);
  let metadata: Record<string, unknown>;
  let files: string[];
  try {
    metadata = JSON.parse(await io.readFile(resolve(directory, 'metadata.json'))) as Record<string, unknown>;
    files = await io.listFiles(directory);
  } catch (error) {
    io.stderr(`Unable to inspect staged extension: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  const errors: string[] = [];
  if (typeof metadata.uuid !== 'string' || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?))*$/.test(metadata.uuid)) errors.push('metadata.json: invalid or missing uuid.');
  if (!files.includes(resolve(directory, 'extension.js'))) errors.push('Package is missing the required extension.js entry point.');
  for (const field of ['name', 'description'] as const) {
    if (typeof metadata[field] !== 'string' || !metadata[field].trim()) errors.push(`metadata.json: missing required ${field}.`);
  }
  if (!Array.isArray(metadata['shell-version']) || metadata['shell-version'].length === 0 || metadata['shell-version'].some((version) => typeof version !== 'string' || !/^\d+(?:\.\d+)*$/.test(version))) {
    errors.push('metadata.json: shell-version must contain stable numeric GNOME Shell versions.');
  }
  if (Array.isArray(metadata['shell-version']) && new Set(metadata['shell-version']).size !== metadata['shell-version'].length) {
    errors.push('metadata.json: shell-version must not contain duplicate GNOME Shell versions.');
  }
  if (metadata.version !== undefined && (!Number.isInteger(metadata.version) || (metadata.version as number) < 1)) {
    errors.push('metadata.json: version must be a positive integer when provided.');
  }
  const schemaId = metadata['settings-schema'];
  if (schemaId !== undefined) {
    if (typeof schemaId !== 'string' || !/^[A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:[.][A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(schemaId)) {
      errors.push('metadata.json: settings-schema must be a valid dotted GSettings schema ID.');
    } else {
      const schemaFiles = files.filter((file) => relative(directory, file).replaceAll('\\', '/').split('/').includes('schemas') && file.endsWith('.gschema.xml'));
      if (schemaFiles.length === 0 && !files.some((file) => relative(directory, file).replaceAll('\\', '/').endsWith('schemas/gschemas.compiled'))) {
        errors.push('metadata.json: settings-schema is set but no GSettings schema is packaged.');
      } else if (schemaFiles.length > 0) {
        let found = false;
        for (const file of schemaFiles) {
          try {
            const source = await io.readFile(file);
            const ids = [...source.matchAll(/<schema[^>]* id=["']([^"']+)["']/g)].map((match) => match[1]);
            if (ids.includes(schemaId)) found = true;
          } catch {
            errors.push(`Unable to read GSettings schema: ${file.slice(directory.length + 1)}`);
          }
        }
        if (!found) errors.push(`metadata.json: settings-schema "${schemaId}" does not match a packaged GSettings schema.`);
      }
    }
  }
  const javascriptSources = new Map<string, string>();
  const warnings: string[] = [];
  for (const file of files) {
    const relative = file.slice(directory.length + 1).replaceAll('\\', '/');
    if (/(^|\/)(node_modules|tests?|scripts|\.git)(\/|$)/.test(relative) || /\.(?:ts|map|md|lock)$/.test(relative) || /(^|\/)package\.json$/.test(relative)) {
      errors.push(`Package contains development-only file: ${relative}`);
    }
    if (file.endsWith('.js')) {
      let source: string;
      try { source = await io.readFile(file); } catch { errors.push(`Unable to read JavaScript file: ${relative}`); continue; }
      javascriptSources.set(file, source);
      if (/\bconsole\s*\.\s*debug\s*\(/.test(source)) {
        warnings.push(`${relative}: contains console.debug() logging; remove temporary debug output before submission.`);
      }
      if (relative === 'prefs.js' && /(?:gi:\/\/|from\s*['"])(?:St|Clutter|Meta|Shell)(?:['"/]|$)/.test(source)) {
        errors.push('prefs.js: preferences code must not import Shell-only libraries.');
      }
      if (relative === 'extension.js' && /(?:gi:\/\/|from\s*['"])(?:Gtk|Gdk|Adw)(?:['"/]|$)/.test(source)) {
        errors.push('extension.js: Shell code must not import GTK or libadwaita.');
      }
    }
  }
  const shellEntry = resolve(directory, 'extension.js');
  const shellSource = javascriptSources.get(shellEntry);
  if (shellSource !== undefined) {
    if (!/export\s+default\s+class\b/.test(shellSource)) {
      errors.push('extension.js: expected a default-exported extension class.');
    }
    for (const hook of ['enable', 'disable']) {
      if (!new RegExp('\\b' + hook + '\\s*\\(\\s*\\)\\s*\\{').test(shellSource)) {
        errors.push('extension.js: extension class must implement ' + hook + '().');
      }
    }
    const hasLifecycleSideEffects = /\b(?:connect|connectObject|timeout_add|idle_add)\s*\(|\bnew\s+(?:St|Clutter|Meta|Shell)\./;
    const constructorBody = shellSource.match(/\bconstructor\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n {2}(?:async\s+)?[A-Za-z_$][\w$]*\s*\()/)?.[1]
      ?? shellSource.match(/\bconstructor\s*\([^)]*\)\s*\{([\s\S]*?)\}/)?.[1]
      ?? '';
    if (hasLifecycleSideEffects.test(constructorBody)) {
      warnings.push('extension.js: constructor contains GNOME resource or signal side effects; move them into enable() and release them in disable().');
    }
    const classStart = shellSource.indexOf('export default class');
    const moduleSetup = classStart < 0 ? shellSource : shellSource.slice(0, classStart);
    if (hasLifecycleSideEffects.test(moduleSetup)) {
      warnings.push('extension.js: module-level code may create GNOME resources or connect signals before enable(); move setup into enable().');
    }
    const methodBody = (method: string): string => {
      const pattern = new RegExp('\\b' + method + '\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)(?=\n {2}(?:async\\s+)?[A-Za-z_$][\\w$]*\\s*\\()/');
      return shellSource.match(pattern)?.[1]
        ?? shellSource.match(new RegExp('\\b' + method + '\\s*\\([^)]*\\)\\s*\\{([^}]*)\\}'))?.[1]
        ?? '';
    };
    const enableBody = methodBody('enable');
    const disableBody = methodBody('disable');
    if (hasLifecycleSideEffects.test(enableBody)
      && !/\b(?:destroy|disconnect|disconnectObject|clear|remove|source_remove|dispose|release)\s*\(/.test(disableBody)) {
      warnings.push('extension.js: enable() creates GNOME resources or connections but disable() has no obvious cleanup call.');
    }
  }
  const inspectImports = (entry: string, forbidden: RegExp, message: string): Set<string> => {
    const pending = [resolve(directory, entry)];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const file = pending.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      const source = javascriptSources.get(file);
      if (source === undefined) continue;
      for (const match of source.matchAll(/^\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
        const specifier = match[1]!;
        if (forbidden.test(specifier)) {
          const path = relative(directory, file).replaceAll('\\', '/');
          errors.push(`${path}: ${message}`);
        }
        if (specifier.startsWith('./') || specifier.startsWith('../')) {
          const dependency = resolve(dirname(file), specifier);
          if (files.includes(dependency) && dependency.endsWith('.js')) pending.push(dependency);
        }
      }
    }
    return new Set([...visited].map((file) => relative(directory, file).replaceAll('\\', '/')));
  };
  const reachableJavaScript = new Set(['extension.js', 'prefs.js']);
  for (const file of inspectImports('prefs.js', /^gi:\/\/(?:St|Clutter|Meta|Shell)(?:[/?]|$)/, 'preferences dependency imports a Shell-only library.')) reachableJavaScript.add(file);
  for (const file of inspectImports('extension.js', /^gi:\/\/(?:Gtk|Gdk|Adw)(?:[/?]|$)/, 'Shell dependency imports GTK or libadwaita.')) reachableJavaScript.add(file);
  for (const file of javascriptSources.keys()) {
    const path = relative(directory, file).replaceAll('\\', '/');
    if (!reachableJavaScript.has(path)) {
      errors.push(`JavaScript file is not imported by either extension entry point: ${path}`);
    }
  }
  for (const file of files.filter((path) => path.endsWith('.css'))) {
    let stylesheet: string;
    try { stylesheet = await io.readFile(file); } catch { continue; }
    for (const match of stylesheet.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
      const asset = match[2]!.trim();
      if (/^(?:data:|https?:|#|\/)/i.test(asset)) continue;
      const assetPath = resolve(dirname(file), asset.split(/[?#]/, 1)[0]!);
      if (!files.includes(assetPath)) {
        errors.push(relative(directory, file).replaceAll('\\', '/') + ': stylesheet references missing asset "' + asset + '".');
      }
    }
  }
  const resourceFiles = files.filter((file) => /\.(?:css|svg|png|jpe?g|webp|gif|woff2?|ttf|otf|gschema\.xml|gresource\.xml)$/i.test(file)
    || relative(directory, file).replaceAll('\\', '/').endsWith('schemas/gschemas.compiled'));
  const resourceSources = [...javascriptSources.values()];
  for (const file of files.filter((path) => path.endsWith('.css'))) {
    try { resourceSources.push(await io.readFile(file)); } catch { /* A failed optional asset read is reported as a possible unused resource. */ }
  }
  for (const file of resourceFiles) {
    const path = relative(directory, file).replaceAll('\\', '/');
    if (path === 'stylesheet.css') continue;
    let used = false;
    if (file.endsWith('.gschema.xml')) {
      const schema = await io.readFile(file).catch(() => '');
      const id = schema.match(/<schema\b[^>]*\bid=["']([^"']+)["']/)?.[1];
      used = Boolean(id && (metadata['settings-schema'] === id || [...javascriptSources.values()].some((source) => source.includes(id))));
    } else if (relative(directory, file).replaceAll('\\', '/').endsWith('schemas/gschemas.compiled')) {
      used = typeof schemaId === 'string';
    } else {
      const name = basename(file);
      used = resourceSources.some((source) => source.includes(path) || source.includes(name));
    }
    if (!used) warnings.push(`Possibly unused package resource: ${path}`);
  }
  if (errors.length) {
    errors.forEach((error) => io.stderr(error));
    warnings.forEach((warning) => io.stderr(warning));
    io.stderr(`EGO validation failed: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
    return 1;
  }
  warnings.forEach((warning) => io.stderr(warning));
  io.stdout(`EGO validation passed: ${files.length} file${files.length === 1 ? '' : 's'}, ${javascriptSources.size} JavaScript file${javascriptSources.size === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
  return 0;
}
