import { describe, expect, it } from 'vitest';
import { Component, Input, Output } from './api.js';
import { EventEmitter } from './events/event-emitter.js';
import { compileGtplComponent, compileGtplComponentToUiIr } from './compile.js';

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

describe('decorated component UI IR', () => {
  it('links template selectors, inputs and outputs to component metadata', () => {
    @Component({ selector: 'GefSaveButton', template: '<button />' })
    class SaveButton {
      @Input() label = '';
      @Output() readonly clicked = new EventEmitter<void>();
    }
    @Component({
      selector: 'GefEditor',
      template: '<GefSaveButton [label]="title" (clicked)="save()" />',
    })
    class Editor {
      title = 'Save';
      save(): void {}
    }

    const result = compileGtplComponentToUiIr(Editor, {
      componentMembers: ['title', 'save'],
      componentTypes: [SaveButton],
    });

    expect(result.success).toBe(true);
    expect(result.metadata.selector).toBe('GefEditor');
    expect(result.nodes).toMatchObject([{
      kind: 'element',
      component: 'GefSaveButton',
      properties: [{ name: 'label', value: { kind: 'binding', expression: { kind: 'identifier', name: 'title' } } }],
      events: [{ name: 'clicked', handler: { kind: 'call' } }],
    }]);
  });

  it('reports invalid component contracts without producing partial IR', () => {
    @Component({ selector: 'GefSaveButton', template: '<button />' })
    class SaveButton { @Input() label = ''; }
    @Component({ selector: 'GefInvalidEditor', template: '<GefSaveButton [caption]="title" />' })
    class InvalidEditor {}

    const result = compileGtplComponentToUiIr(InvalidEditor, {
      componentMembers: ['title'],
      componentTypes: [SaveButton],
    });

    expect(result.success).toBe(false);
    expect(result.nodes).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('GTPL4102');
  });

  it('rejects undecorated and duplicate component registrations', () => {
    @Component({ selector: 'GefEditor', template: '<GefSaveButton />' })
    class Editor {}
    class Plain {}
    expect(() => compileGtplComponentToUiIr(Editor, { componentTypes: [Plain] })).toThrow(/@Component metadata/);

    @Component({ selector: 'GefSaveButton', template: '<button />' })
    class SaveButton {}
    @Component({ selector: 'GefSaveButton', template: '<button />' })
    class DuplicateSaveButton {}
    expect(() => compileGtplComponentToUiIr(Editor, {
      componentTypes: [SaveButton, DuplicateSaveButton],
    })).toThrow(/Duplicate component selector/);
  });
});
