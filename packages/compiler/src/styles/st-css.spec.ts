import { describe, expect, it } from 'vitest';
import { validateStCss } from './st-css.js';

describe('validateStCss', () => {
  it('accepts simple St stylesheets and comments', () => {
    expect(validateStCss('/* panel */ .panel { padding: 6px; color: white; }')).toEqual([]);
  });

  it('reports unbalanced blocks', () => {
    expect(validateStCss('.panel { padding: 6px;').map((item) => item.code)).toContain('GEFCSS1001');
    expect(validateStCss('}').map((item) => item.code)).toContain('GEFCSS1002');
  });

  it('reports unterminated strings and comments at their opening positions', () => {
    expect(validateStCss('content: "unfinished')).toMatchObject([
      { code: 'GEFCSS1006', line: 1, column: 10, start: 9, end: 10 },
    ]);
    expect(validateStCss('/* unfinished')).toMatchObject([
      { code: 'GEFCSS1007', line: 1, column: 1, start: 0, end: 2 },
    ]);
  });

  it('reports common browser-only layout declarations', () => {
    const diagnostics = validateStCss('.panel { display: flex; grid-template-columns: 1fr; position: sticky; }');
    expect(diagnostics.map((item) => item.code)).toEqual(['GEFCSS1003', 'GEFCSS1004', 'GEFCSS1005']);
  });

  it('reports exact declaration offsets after comments and whitespace', () => {
    const source = '/* leading comment */\n.panel {\n  display: flex;\n}';
    const diagnostic = validateStCss(source)[0];
    expect(diagnostic).toMatchObject({
      code: 'GEFCSS1003',
      line: 3,
      column: 3,
      start: source.indexOf('display'),
      end: source.indexOf(';'),
    });
  });

  it.each(['\r\n', '\r'])('tracks declaration positions with %j line endings', (newline) => {
    const source = ['.panel {', '  display: flex;', '}'].join(newline);
    expect(validateStCss(source)[0]).toMatchObject({
      code: 'GEFCSS1003',
      line: 2,
      column: 3,
      start: source.indexOf('display'),
    });
    expect(validateStCss(source).find((item) => item.code === 'GEFCSS1001')).toBeUndefined();
  });

  it.each(['\n', '\r\n', '\r'])('tracks escaped string newlines with %j', (newline) => {
    const source = ['content: "first' + String.fromCharCode(92), 'second"', '}'].join(newline);
    expect(validateStCss(source)).toMatchObject([
      { code: 'GEFCSS1002', line: 3, column: 1 },
    ]);
  });

  it('reports unbalanced parentheses and brackets outside strings and comments', () => {
    const source = '.panel { padding: calc(1px; background: [red; color: blue); }';
    expect(validateStCss(source).map((item) => item.code)).toEqual(['GEFCSS1009', 'GEFCSS1011', 'GEFCSS1008']);
  });

  it('ignores parentheses and brackets inside strings and comments', () => {
    expect(validateStCss('.panel { content: "([)]"; /* ([ */ padding: calc(1px + 2px); }')).toEqual([]);
  });

  it('reports exact positions for unexpected closing delimiters', () => {
    const source = '.panel { padding: 1px); }';
    expect(validateStCss(source)[0]).toMatchObject({
      code: 'GEFCSS1008',
      line: 1,
      column: source.indexOf(')') + 1,
      start: source.indexOf(')'),
      end: source.indexOf(')') + 1,
    });
  });

  it('ignores declaration-like text inside quoted strings, including embedded semicolons', () => {
    expect(validateStCss('.panel { content: "safe; display: flex"; background: url("data:text/plain;display:grid"); }')).toEqual([]);
  });

  it('still validates declarations after quoted semicolons', () => {
    const diagnostics = validateStCss('.panel { content: "safe; display: flex"; display: grid; }');
    expect(diagnostics.map((item) => item.code)).toEqual(['GEFCSS1003']);
    expect(diagnostics[0]?.start).toBeGreaterThan(0);
  });

  it('ignores unsupported-looking text inside comments and strings', () => {
    expect(validateStCss('.panel { content: "display: flex"; /* display: grid; */ }')).toEqual([]);
  });
});
