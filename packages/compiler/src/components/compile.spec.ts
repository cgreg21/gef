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
    expect(result.renderSourceMap).toMatchObject({
      version: 3,
      sources: ['GefGreeting.gtpl'],
      sourcesContent: ['<StLabel>Hello {{name}}</StLabel>'],
    });
  });

  it('returns diagnostics without emitting invalid render source', () => {
    @Component({ selector: 'GefInvalid', template: '<StLabel *for="let item in items" />' })
    class InvalidComponent {}

    const result = compileGtplComponent(InvalidComponent, { componentMembers: ['items'] });
    expect(result.diagnostics.map((item) => item.code)).toContain('GTPL4203');
    expect(result.renderSource).toBeUndefined();
  });

  it('validates known child component input and output contracts', () => {
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

  it('compiles an external GTPL template supplied by the build pipeline', () => {
    @Component({ selector: 'GefExternal', templateUrl: './external.gtpl' })
    class ExternalComponent {
      title = 'GEF';
    }

    expect(() => compileGtplComponent(ExternalComponent, { componentMembers: ['title'] }))
      .toThrow(/provide the loaded template source/);
    const result = compileGtplComponent(
      ExternalComponent,
      { componentMembers: ['title'] },
      '<StLabel>{{title}}</StLabel>',
    );
    expect(result.metadata.templateUrl).toBe('./external.gtpl');
    expect(result.diagnostics).toEqual([]);
    expect(result.renderSource).toContain('ctx.title');
    expect(result.renderSourceMap?.sources).toEqual(['./external.gtpl']);
  });

  it('requires exactly one inline or external component template', () => {
    expect(() => Component({ selector: 'GefMissing' })(class Missing {})).toThrow(/exactly one/);
    expect(() => Component({
      selector: 'GefBoth', template: '<StLabel />', templateUrl: './view.gtpl',
    })(class Both {})).toThrow(/exactly one/);
  });

  it('requires component metadata', () => {
    expect(() => compileGtplComponent(class Plain {}, { componentMembers: [] }))
      .toThrow(/without @Component/);
  });
});
