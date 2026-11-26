import { validateStCss } from '../../compiler/src/index.js';

export function reportCssDiagnostics(source: string, input: string, stderr: (message: string) => void): number {
  const diagnostics = validateStCss(source);
  for (const item of diagnostics) {
    stderr(formatDiagnostic(source, input, {
      code: item.code,
      message: item.message,
      span: { start: item.start, end: item.end, line: item.line, column: item.column },
    }));
  }
  return diagnostics.length;
}

export function formatDiagnostic(source: string, input: string, diagnostic: { code: string; message: string; span: { line: number; column: number; start: number; end: number } }): string {
  const lines = source.split(/\r\n|\r|\n/);
  const line = lines[diagnostic.span.line - 1] ?? '';
  const width = String(diagnostic.span.line).length;
  const markerLength = Math.max(1, Math.min(diagnostic.span.end - diagnostic.span.start, Math.max(1, line.length - diagnostic.span.column + 1)));
  return [
    `${input}:${diagnostic.span.line}:${diagnostic.span.column}: ${diagnostic.code}: ${diagnostic.message}`,
    `${String(diagnostic.span.line).padStart(width)} | ${line}`,
    `${' '.repeat(width)} | ${' '.repeat(Math.max(0, diagnostic.span.column - 1))}${'^'.repeat(markerLength)}`,
  ].join('\n');
}

export function validateWorkspaceConfig(source: string): string | undefined {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return 'gef.json must contain valid JSON.';
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'gef.json must contain a JSON object.';
  const config = value as Record<string, unknown>;
  if (config.version !== 1) return 'gef.json version must be 1.';
  if (!config.projects || typeof config.projects !== 'object' || Array.isArray(config.projects)) {
    return 'gef.json projects must be a non-empty object.';
  }
  const projects = config.projects as Record<string, unknown>;
  const names = Object.keys(projects);
  if (names.length === 0) return 'gef.json projects must contain at least one project.';
  for (const name of names) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) return `gef.json project name "${name}" must use lowercase letters, digits and hyphens.`;
    const project = projects[name];
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      return `gef.json project "${name}" must be an object.`;
    }
    const entry = project as Record<string, unknown>;
    if (entry.projectType !== 'application' && entry.projectType !== 'extension') {
      return `gef.json project "${name}" projectType must be "application" or "extension".`;
    }
    for (const field of ['root', 'sourceRoot', 'entryPoint', 'outputPath'] as const) {
      const path = entry[field];
      if (typeof path !== 'string' || !path.trim() || path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/.test(path)
        || (path !== '.' && path.split('/').some((part) => part === '..' || part === '.'))) {
        return `gef.json project "${name}" ${field} must be a safe workspace-relative path.`;
      }
    }
  }
  if (config.defaultProject !== undefined
    && (typeof config.defaultProject !== 'string' || !Object.hasOwn(projects, config.defaultProject))) {
    return 'gef.json defaultProject must reference a project declared in projects.';
  }
  if (config.defaultProject === undefined && names.length !== 1) {
    return 'gef.json must define defaultProject when it contains multiple projects.';
  }
  return undefined;
}

