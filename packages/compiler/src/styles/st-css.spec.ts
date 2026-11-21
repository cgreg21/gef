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

  it('ignores unsupported-looking text inside comments and strings', () => {
    expect(validateStCss('.panel { content: "display: flex"; /* display: grid; */ }')).toEqual([]);
  });
});
