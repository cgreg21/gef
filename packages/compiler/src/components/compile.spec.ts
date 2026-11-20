import { describe, expect, it } from 'vitest';
import { Component, Input } from './api.js';
import { compileGtplComponent } from './compile.js';

describe('compileGtplComponent', () => {
  it('compiles decorated component metadata and emits a context-aware render function', () => {
    @Component({ selector: 'GefGreeting', template: '<StLabel>Hello {{name}}</StLabel>' })
    class GreetingComponent {
      @Input() name = 'GEF';
    }

    const result = compileGtplComponent(GreetingComponent, { componentMembers: ['name'] });
    expect(result.metadata.selector).toBe('GefGreeting');
    expect(result.diagnostics).toEqual([]);
    expect(result.renderSource).toContain('ctx.name');
  });

  it('returns diagnostics without emitting invalid render source', () => {
    @Component({ selector: 'GefInvalid', template: '<StLabel *for="let item in items" />' })
    class InvalidComponent {}

    const result = compileGtplComponent(InvalidComponent, { componentMembers: ['items'] });
    expect(result.diagnostics.map((item) => item.code)).toContain('GTPL4203');
    expect(result.renderSource).toBeUndefined();
  });

  it('validates known child component input and output contracts', () => {
    @Component({ selector: 'GefChild', template: '<StLabel />' })
    class ChildComponent {}

    @Component({ selector: 'GefParent', template: '<GefChild [title]="title" (closed)="close()" />' })
    class ParentComponent {
      title = 'hello';
      close(): void {}
    }

    const result = compileGtplComponent(ParentComponent, {
      componentMembers: ['title', 'close'],
      components: [{ selector: 'GefChild', inputs: ['title'], outputs: ['closed'] }],
      strictComponents: true,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.renderSource).toContain('runtime.bind');
  });

  it('requires component metadata', () => {
    expect(() => compileGtplComponent(class Plain {}, { componentMembers: [] }))
      .toThrow(/without @Component/);
  });
});
