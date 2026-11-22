export interface StCssDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly start: number;
  readonly end: number;
}

const UNSUPPORTED: readonly { pattern: RegExp; code: string; message: string }[] = [
  { pattern: /^display\s*:\s*(?:flex|grid)\b/i, code: 'GEFCSS1003', message: 'Browser flex/grid display is not supported by the GNOME theme CSS engine.' },
  { pattern: /^(?:grid|flex)(?:-|\s*:)/i, code: 'GEFCSS1004', message: 'Browser grid/flex layout properties are not supported by the GNOME theme CSS engine.' },
  { pattern: /^position\s*:\s*(?:fixed|sticky)\b/i, code: 'GEFCSS1005', message: 'This browser positioning mode is not supported by the GNOME theme CSS engine.' },
];

/** Checks common browser-only CSS features and basic block balance for St/GTK stylesheets. */
export function validateStCss(source: string): readonly StCssDiagnostic[] {
  const diagnostics: StCssDiagnostic[] = [];
  const stack: Array<{ line: number; column: number; start: number }> = [];
  let line = 1;
  let column = 1;
  let quote = '';
  let comment = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    const next = source[index + 1] ?? '';
    if (comment) {
      if (char === '*' && next === '/') { comment = false; index += 1; column += 2; continue; }
    } else if (quote) {
      if (char === '\\') { index += 1; column += 2; continue; }
      if (char === quote) quote = '';
    } else if (char === '/' && next === '*') {
      comment = true; index += 1; column += 2; continue;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '{') stack.push({ line, column, start: index });
    else if (char === '}') {
      if (stack.length === 0) diagnostics.push({ code: 'GEFCSS1002', message: 'Unexpected closing brace.', line, column, start: index, end: index + 1 });
      else stack.pop();
    }
    if (char === '\n') { line += 1; column = 1; } else column += 1;
  }
  for (const opening of stack) diagnostics.push({
    code: 'GEFCSS1001', message: 'Unclosed CSS block.', line: opening.line, column: opening.column, start: opening.start, end: opening.start + 1,
  });

  const masked = source.split('');
  let maskedQuote = '';
  let maskedComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    const next = source[index + 1] ?? '';
    if (maskedComment) {
      if (char === '*' && next === '/') {
        masked[index] = ' ';
        masked[index + 1] = ' ';
        maskedComment = false;
        index += 1;
      } else if (char !== '\\n' && char !== '\\r') masked[index] = ' ';
    } else if (maskedQuote) {
      if (char === '\\\\') {
        if (char !== '\\n' && char !== '\\r') masked[index] = ' ';
        if (index + 1 < source.length) {
          if (next !== '\\n' && next !== '\\r') masked[index + 1] = ' ';
          index += 1;
        }
      } else {
        if (char !== '\\n' && char !== '\\r') masked[index] = ' ';
        if (char === maskedQuote) maskedQuote = '';
      }
    } else if (char === '/' && next === '*') {
      masked[index] = ' ';
      masked[index + 1] = ' ';
      maskedComment = true;
      index += 1;
    } else if (char === '"' || char === "'") {
      masked[index] = ' ';
      maskedQuote = char;
    }
  }
  const withoutCommentsAndStrings = masked.join('');
  const declaration = /(?:^|[;{])\s*([a-z-]+\s*:\s*[^;{}]+)/gim;
  for (const match of withoutCommentsAndStrings.matchAll(declaration)) {
    const value = match[1]?.trim() ?? '';
    const rule = UNSUPPORTED.find((candidate) => candidate.pattern.test(value));
    if (!rule) continue;
    const raw = match[1] ?? '';
    const start = (match.index ?? 0) + match[0].indexOf(raw);
    const before = source.slice(0, start);
    const lines = before.split('\n');
    diagnostics.push({
      code: rule.code,
      message: rule.message,
      line: lines.length,
      column: (lines.at(-1)?.length ?? 0) + 1,
      start,
      end: start + raw.trimEnd().length,
    });
  }
  return diagnostics;
}
