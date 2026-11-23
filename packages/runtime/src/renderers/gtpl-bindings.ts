/** Small, renderer-independent helpers for Angular-style GTPL class and style bindings. */
export function classNames(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/\\s+/).filter(Boolean);
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  if (value && typeof value === 'object') return Object.entries(value).filter(([, enabled]) => Boolean(enabled)).map(([name]) => name);
  return [];
}

export function styleDeclarations(value: unknown): Map<string, string> {
  const declarations = new Map<string, string>();
  if (typeof value === 'string') {
    for (const declaration of value.split(';')) {
      const separator = declaration.indexOf(':');
      if (separator < 1) continue;
      const name = declaration.slice(0, separator).trim();
      const content = declaration.slice(separator + 1).trim();
      if (name && content) declarations.set(name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), content);
    }
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [name, content] of Object.entries(value)) {
      if (content === null || content === undefined || content === false || content === '') continue;
      const cssName = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      declarations.set(cssName, String(content));
    }
  } else if (value !== null && value !== undefined) {
    throw new Error('GTPL style must be a CSS string or a style object.');
  }
  return declarations;
}

export function styleText(declarations: Map<string, string>): string {
  return [...declarations].map(([name, value]) => `${name}: ${value};`).join(' ');
}
