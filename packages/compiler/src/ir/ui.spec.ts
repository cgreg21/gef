import { describe, expect, it } from 'vitest';
import { compileGtplToUiIr } from './ui.js';

describe('GTPL UI IR', () => {
  it('lowers a GTK view into renderer-neutral nodes and typed expression trees', () => {
    const result = compileGtplToUiIr(`
      @let heading = title;
      <GtkBox orientation="vertical" [spacing]="gap" #root>
        <GtkLabel [label]="heading" (activate)="select(heading)">Hello {{name}}</GtkLabel>
        @if (visible) { <GtkButton label="Open" /> } @else { Hidden }
        @for (item of items; track item.id) { <GtkLabel>{{item.name}}</GtkLabel> } @empty { Empty }
        @switch (state) { @case ("ready") { Ready } @default { Wait } }
      </GtkBox>
    `);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toEqual([]);
    const heading = result.nodes.find((node) => node.kind === 'let');
    expect(heading).toMatchObject({
      kind: 'let',
      name: 'heading',
      expression: { kind: 'identifier', name: 'title' },
    });
    const root = result.nodes.find((node) => node.kind === 'element');
    expect(root).toMatchObject({
      kind: 'element',
      component: 'GtkBox',
      properties: [
        { name: 'orientation', value: { kind: 'static', value: 'vertical' } },
        { name: 'spacing', value: { kind: 'binding', expression: { kind: 'identifier', name: 'gap' } } },
      ],
      references: ['root'],
    });
    if (root?.kind !== 'element') throw new Error('Expected root element');
    const content = root.children.filter((node) => node.kind !== 'text'
      || node.parts.some((part) => part.kind !== 'text' || part.value.trim() !== ''));
    expect(content.map((node) => node.kind)).toEqual(['element', 'if', 'for', 'switch']);
    expect(content[0]).toMatchObject({
      kind: 'element',
      events: [{ name: 'activate', handler: { kind: 'call' } }],
      children: [{ kind: 'text', parts: [{ kind: 'text', value: 'Hello ' }, { kind: 'expression', expression: { kind: 'identifier', name: 'name' } }] }],
    });
    expect(content[2]).toMatchObject({
      kind: 'for',
      item: 'item',
      collection: { kind: 'identifier', name: 'items' },
      trackBy: { kind: 'member', property: 'id' },
    });
  });

  it('returns diagnostics and no partial IR for invalid templates', () => {
    const result = compileGtplToUiIr('<GtkLabel [label]="missing + " />');
    expect(result.success).toBe(false);
    expect(result.nodes).toEqual([]);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('keeps the UI IR independent of GTK and GNOME Shell runtime packages', () => {
    const result = compileGtplToUiIr('<GtkButton label="Save" />');
    expect(result.success).toBe(true);
    expect(JSON.stringify(result.nodes)).not.toMatch(/GtkNamespace|StNamespace|Gjs|NodeGtk/);
  });
});
