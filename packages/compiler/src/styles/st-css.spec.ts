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
