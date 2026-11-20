import { describe, expect, it } from 'vitest';
import { parseGtpl } from './parser.js';

describe('parseGtpl', () => {
  it('parses nested and self-closing elements', () => {
    const result = parseGtpl('<StBox><StIcon iconName="computer-symbolic" /></StBox>');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.nodes).toHaveLength(1);
    const root = result.nodes[0];
    expect(root?.kind).toBe('element');
    if (root?.kind !== 'element') return;
    expect(root.name).toBe('StBox');
    expect(root.children).toHaveLength(1);
    const child = root.children[0];
    expect(child?.kind).toBe('element');
    if (child?.kind !== 'element') return;
    expect(child.name).toBe('StIcon');
    expect(child.attributes[0]).toMatchObject({
      name: 'iconName',
      value: 'computer-symbolic',
      kind: 'static',
    });
  });

  it('keeps unterminated escaped attribute values within the source span', () => {
    const source = '<StLabel title="value\\';
    const result = parseGtpl(source);
    const diagnostic = result.diagnostics.find((item) => item.code === 'GTPL1007');
    expect(diagnostic?.span.end).toBe(source.length);
  });
  it('keeps escaped quotes inside quoted attribute values', () => {
    const result = parseGtpl(String.raw`<StLabel title="a\"b" subtitle="next" />`);
    expect(result.diagnostics).toHaveLength(0);
    const element = result.nodes[0];
    expect(element?.kind).toBe('element');
    if (element?.kind !== 'element') return;
    expect(element.attributes.map(({ name, value }) => [name, value])).toEqual([
      ['title', String.raw`a\"b`],
      ['subtitle', 'next'],
    ]);
  });
  it('classifies Angular-inspired binding attributes', () => {
    const result = parseGtpl(
      '<StButton title="Open" [visible]="isVisible" (clicked)="open()" [(value)]="volume" *gefIf="enabled" #button />',
    );
    expect(result.diagnostics).toHaveLength(0);
    const node = result.nodes[0];
    expect(node?.kind).toBe('element');
    if (node?.kind !== 'element') return;
    expect(node.attributes.map(({ name, kind }) => [name, kind])).toEqual([
      ['title', 'static'],
      ['visible', 'property'],
      ['clicked', 'event'],
      ['value', 'two-way'],
      ['gefIf', 'structural'],
      ['button', 'reference'],
    ]);
  });

  it('splits literal text and interpolation parts', () => {
    const result = parseGtpl('<StLabel>Hello {{ user.name }}!</StLabel>');
    expect(result.diagnostics).toHaveLength(0);
    const element = result.nodes[0];
    expect(element?.kind).toBe('element');
    if (element?.kind !== 'element') return;
    const text = element.children[0];
    expect(text?.kind).toBe('text');
    if (text?.kind !== 'text') return;
    expect(text.parts.map((part) => part.kind)).toEqual(['text', 'interpolation', 'text']);
    expect(text.parts[1]).toMatchObject({ expression: 'user.name' });
  });

  it('ignores comments', () => {
    const result = parseGtpl('<!-- ignored --><StLabel />');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.nodes).toHaveLength(1);
  });

  it('preserves control-flow boundaries after an unclosed element', () => {
    const result = parseGtpl('@if (ready) { <StLabel>broken } <StButton />');
    const block = result.nodes[0];
    expect(block?.kind).toBe('if-block');
    if (block?.kind !== 'if-block') return;
    expect(block.branches[0]?.children).toHaveLength(1);
    expect(block.branches[0]?.children[0]).toMatchObject({ kind: 'element', name: 'StLabel' });
    expect(result.nodes[1]).toMatchObject({ kind: 'element', name: 'StButton' });
    expect(result.diagnostics.some((item) => item.code === 'GTPL1006')).toBe(true);
    expect(result.diagnostics.some((item) => item.code === 'GTPL3006')).toBe(false);
  });

  it('recovers an ancestor closing tag after a nested element is left open', () => {
    const result = parseGtpl('<StBox><StLabel></StBox>');
    expect(result.nodes).toMatchObject([
      {
        kind: 'element',
        name: 'StBox',
        children: [{ kind: 'element', name: 'StLabel', children: [] }],
      },
    ]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(['GTPL1006']);
    expect(result.diagnostics[0]?.span.start).toBe(7);
  });

  it('keeps every diagnostic span within the source bounds', () => {
    const sources = ['@if', '@for (item of items', '<StLabel title="unterminated', '@switch (value)'];
    for (const source of sources) {
      const result = parseGtpl(source);
      for (const diagnostic of result.diagnostics) {
        expect(diagnostic.span.start).toBeGreaterThanOrEqual(0);
        expect(diagnostic.span.end).toBeGreaterThanOrEqual(diagnostic.span.start);
        expect(diagnostic.span.end).toBeLessThanOrEqual(source.length);
      }
    }
  });

  it('reports missing closing tags with source locations', () => {
    const result = parseGtpl('<StBox>\n  <StLabel />');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'GTPL1006',
      span: { line: 1, column: 1 },
    });
  });

  it('reports mismatched closing tags', () => {
    const result = parseGtpl('<StBox></StLabel>');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'GTPL1005')).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'GTPL1006')).toBe(true);
  });

  it('reports unterminated interpolation', () => {
    const result = parseGtpl('<StLabel>{{ value </StLabel>');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'GTPL1011')).toBe(true);
  });

  it('reports unterminated comments', () => {
    const result = parseGtpl('<!-- never closed');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'GTPL1012')).toBe(true);
  });
});


describe('GTPL expression integration', () => {
  it('does not close interpolations on delimiters inside quoted strings', () => {
    const source = String.raw`<StLabel>{{ format("}}", 'value') }}</StLabel>`;
    const result = parseGtpl(source);
    expect(result.diagnostics).toHaveLength(0);
    const element = result.nodes[0];
    expect(element?.kind).toBe('element');
    if (element?.kind !== 'element') return;
    const text = element.children[0];
    expect(text?.kind).toBe('text');
    if (text?.kind !== 'text') return;
    expect(text.parts).toMatchObject([
      { kind: 'interpolation', expression: String.raw`format("}}", 'value')` },
    ]);
  });

  it('keeps less-than comparisons inside interpolations', () => {
    const result = parseGtpl('<StLabel>{{ value < limit }}</StLabel>');
    expect(result.diagnostics).toHaveLength(0);
    const element = result.nodes[0];
    expect(element?.kind).toBe('element');
    if (element?.kind !== 'element') return;
    expect(element.children[0]).toMatchObject({
      kind: 'text',
      parts: [{ kind: 'interpolation', expression: 'value < limit' }],
    });
  });

  it('attaches parsed expression trees to interpolations and bindings', () => {
    const result = parseGtpl('<StLabel [visible]="device.connected">{{ device.name }}</StLabel>');
    expect(result.diagnostics).toHaveLength(0);
    const root = result.nodes[0];
    expect(root?.kind).toBe('element');
    if (root?.kind !== 'element') return;
    expect(root.attributes[0]?.parsedExpression).toMatchObject({
      kind: 'member',
      property: 'connected',
    });
    const text = root.children[0];
    expect(text?.kind).toBe('text');
    if (text?.kind !== 'text') return;
    const interpolation = text.parts.find((part) => part.kind === 'interpolation');
    expect(interpolation).toMatchObject({
      kind: 'interpolation',
      parsedExpression: { kind: 'member', property: 'name' },
    });
  });

  it('maps binding expression diagnostics to template line and column', () => {
    const result = parseGtpl('<StBox>\n  <StLabel [visible]="device." />\n</StBox>');
    const diagnostic = result.diagnostics.find((item) => item.code === 'GTPL2003');
    expect(diagnostic?.span.line).toBe(2);
    expect(diagnostic?.span.column).toBeGreaterThan(20);
  });

  it('maps interpolation expression diagnostics to template coordinates', () => {
    const result = parseGtpl('<StLabel>\n  {{ device. }}\n</StLabel>');
    const diagnostic = result.diagnostics.find((item) => item.code === 'GTPL2003');
    expect(diagnostic?.span.line).toBe(2);
    expect(diagnostic?.span.column).toBeGreaterThan(10);
  });

  it('does not parse static values, local references, or *gefFor microsyntax as expressions', () => {
    const result = parseGtpl('<StLabel title="hello" #label *gefFor="let item of items" />');
    expect(result.diagnostics).toHaveLength(0);
    const root = result.nodes[0];
    expect(root?.kind).toBe('element');
    if (root?.kind !== 'element') return;
    expect(root.attributes.every((attribute) => !('parsedExpression' in attribute))).toBe(true);
  });

  it('reports invalid expressions in property, event, and two-way bindings', () => {
    const result = parseGtpl('<StButton [visible]="foo." (clicked)="run(]" [(value)]="[" />');
    expect(result.diagnostics.filter((item) => item.code.startsWith('GTPL200')).length).toBeGreaterThanOrEqual(3);
  });
});


describe('GTPL built-in control flow', () => {
  it('parses *if and *for structural attributes on elements', () => {
    const result = parseGtpl('<StLabel *if="isVisible" /><StRow *for="let item of items" />');
    expect(result.diagnostics).toHaveLength(0);
    const first = result.nodes[0], second = result.nodes[1];
    expect(first?.kind).toBe('element'); expect(second?.kind).toBe('element');
    if (first?.kind !== 'element' || second?.kind !== 'element') return;
    expect(first.attributes[0]).toMatchObject({ name: 'if', kind: 'structural', parsedExpression: { kind: 'identifier', name: 'isVisible' } });
    expect(second.attributes[0]).toMatchObject({ name: 'for', kind: 'structural', value: 'let item of items' });
  });
  it('parses @if, @else if and @else branches', () => {
    const result = parseGtpl('@if (ready) { <StLabel /> } @else if (loading) { <StSpinner /> } @else { <StButton /> }');
    expect(result.diagnostics).toHaveLength(0);
    const block = result.nodes[0]; expect(block?.kind).toBe('if-block');
    if (block?.kind !== 'if-block') return;
    expect(block.branches).toHaveLength(3);
    expect(block.branches.map((branch) => branch.children[0]?.kind)).toEqual(['element','element','element']);
    expect(block.branches[1]?.parsedCondition).toMatchObject({ kind: 'identifier', name: 'loading' });
    expect(block.branches[2]?.condition).toBeUndefined();
  });
  it('includes the control-flow directive in every @if branch span', () => {
    const source = '@if (ready) { <StLabel /> } @else if (loading) { <StSpinner /> } @else { <StButton /> }';
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('if-block');
    if (block?.kind !== 'if-block') return;
    expect(block.branches[0]?.span.start).toBe(source.indexOf('@if'));
    expect(block.branches[0]?.span.end).toBe(source.indexOf('} @else') + 1);
    expect(block.branches[1]?.span.start).toBe(source.indexOf('@else if'));
    expect(block.branches[2]?.span.start).toBe(source.lastIndexOf('@else'));
    expect(block.branches[2]?.span.end).toBe(source.length);
  });

  it('preserves the complete source span of an @else branch', () => {
    const source = '@if (ready) { <StLabel /> } @else { <StButton /> }';
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('if-block');
    if (block?.kind !== 'if-block') return;
    const branch = block.branches[1];
    expect(branch?.span.start).toBe(source.indexOf('@else'));
    expect(branch?.span.end).toBe(source.length);
    expect(branch?.span.line).toBe(1);
    expect(branch?.span.column).toBe(source.indexOf('@else') + 1);
  });

  it('parses @if expression aliases', () => {
    const result = parseGtpl('@if (user.profile; as profile) { <StLabel>{{ profile.name }}</StLabel> }');
    expect(result.diagnostics).toHaveLength(0);
    const block = result.nodes[0];
    expect(block?.kind).toBe('if-block');
    if (block?.kind !== 'if-block') return;
    expect(block.branches[0]).toMatchObject({ condition: 'user.profile', alias: 'profile', parsedCondition: { kind: 'member', property: 'profile' } });
  });
  it('keeps escaped quotes and semicolons inside @for header strings', () => {
    const source = String.raw`@for (item of getItems("a\";b"); track item.id) { <StLabel /> }`;
    const result = parseGtpl(source);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.nodes[0]).toMatchObject({ kind: 'for-block', collection: String.raw`getItems("a\";b")` });
  });
  it('parses @for contextual aliases and nested semicolons safely', () => {
    const result = parseGtpl('@for (item of getItems("a;b"); track item.id; let idx = $index, e = $even) { <StLabel>{{ idx }} {{ e }}</StLabel> }');
    expect(result.diagnostics).toHaveLength(0);
    const block = result.nodes[0];
    expect(block?.kind).toBe('for-block');
    if (block?.kind !== 'for-block') return;
    expect(block.collection).toBe('getItems("a;b")');
    expect(block.aliases).toEqual([{ name: 'idx', context: '$index' }, { name: 'e', context: '$even' }]);
  });
  it('excludes trailing whitespace from @if source spans', () => {
    const source = '@if (ready) { <StLabel /> }   <StButton />';
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('if-block');
    if (block?.kind !== 'if-block') return;
    expect(block.span.end).toBe(source.indexOf('}') + 1);
    expect(result.nodes[1]?.kind).toBe('element');
  });

  it('excludes trailing whitespace from @for source spans', () => {
    const source = '@for (item of items; track item.id) { <StLabel /> }   <StButton />';
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('for-block');
    if (block?.kind !== 'for-block') return;
    expect(block.span.end).toBe(source.indexOf('}') + 1);
    expect(result.nodes[1]?.kind).toBe('element');
  });

  it('includes the @empty branch but excludes trailing whitespace from @for spans', () => {
    const source = '@for (item of items; track item.id) {} @empty { <StLabel /> }   <StButton />';
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('for-block');
    if (block?.kind !== 'for-block') return;
    expect(block.span.end).toBe(source.lastIndexOf('}') + 1);
  });

  it('parses @for with track and @empty', () => {
    const result = parseGtpl('@for (device of devices; track device.id) { <StLabel>{{ device.name }}</StLabel> } @empty { <StLabel>No devices</StLabel> }');
    expect(result.diagnostics).toHaveLength(0);
    const block = result.nodes[0]; expect(block?.kind).toBe('for-block');
    if (block?.kind !== 'for-block') return;
    expect(block).toMatchObject({ item:'device', collection:'devices', track:'device.id', parsedCollection:{kind:'identifier',name:'devices'}, parsedTrack:{kind:'member',property:'id'} });
    expect(block.children).toHaveLength(1); expect(block.empty).toHaveLength(1);
  });
  it('parses @switch with grouped @case labels and @default', () => {
    const result = parseGtpl(`@switch (user.role) {
      @case ('admin') { <StLabel>Admin</StLabel> }
      @case ('editor')
      @case ('reviewer') { <StLabel>Editor</StLabel> }
      @default { <StLabel>Viewer</StLabel> }
    }`);
    expect(result.diagnostics).toHaveLength(0);
    const block = result.nodes[0];
    expect(block?.kind).toBe('switch-block');
    if (block?.kind !== 'switch-block') return;
    expect(block.parsedExpression).toMatchObject({ kind: 'member', property: 'role' });
    expect(block.cases).toHaveLength(2);
    expect(block.cases[1]?.expressions).toEqual(["'editor'", "'reviewer'"]);
    expect(block.cases[1]?.children[0]?.kind).toBe('element');
    expect(block.defaultCase?.exhaustive).toBe(false);
  });
  it('parses exhaustive @default never and optional checked expression', () => {
    const result = parseGtpl('@switch (state) { @case ("ready") {} @default never(state); }');
    expect(result.diagnostics).toHaveLength(0);
    const block = result.nodes[0];
    expect(block?.kind).toBe('switch-block');
    if (block?.kind !== 'switch-block') return;
    expect(block.defaultCase).toMatchObject({ exhaustive: true, neverExpression: 'state', parsedNeverExpression: { kind: 'identifier', name: 'state' } });
  });
  it('parses @let local template declarations', () => {
    const result = parseGtpl('@let currentUser = user.profile; <StLabel>{{ currentUser.name }}</StLabel>');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.nodes[0]).toMatchObject({ kind: 'let-declaration', name: 'currentUser', parsedExpression: { kind: 'member', property: 'profile' } });
  });
  it('recovers after an unterminated @let inside a control-flow block', () => {
    const result = parseGtpl('@if (ready) { @let value = user.name <StLabel /> } <StButton />');
    const block = result.nodes[0];
    expect(block?.kind).toBe('if-block');
    if (block?.kind !== 'if-block') return;
    expect(block.branches[0]?.children.map((node) => node.kind)).toEqual(['let-declaration', 'element']);
    expect(result.nodes.find((node) => node.kind === 'element')?.kind).toBe('element');
    expect(result.diagnostics.some((item) => item.code === 'GTPL3204')).toBe(true);
  });

  it('does not treat longer identifiers as control-flow directives', () => {
    const source = '@if (ready) { @for (item of items; track item.id) { @switch (item.kind) { @case ("ok") { <StLabel /> } } } } @elsewhere <StButton />';
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('if-block');
    if (block?.kind !== 'if-block') return;
    expect(block.branches).toHaveLength(1);
    expect(block.branches[0]?.children).toHaveLength(1);
    expect(result.nodes[1]?.kind).toBe('text');
    expect(result.nodes[2]?.kind).toBe('element');
    expect(result.diagnostics.some((item) => item.code === 'GTPL3005')).toBe(false);
  });

  it('does not consume a later @case after unexpected switch text', () => {
    const source = '@switch (role) { unexpected text @case ("admin") { <StLabel /> } }';
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('switch-block');
    if (block?.kind !== 'switch-block') return;
    expect(block.cases).toHaveLength(1);
    expect(block.cases[0]?.expressions).toEqual(['"admin"']);
    expect(result.diagnostics.some((item) => item.code === 'GTPL3106')).toBe(true);
  });

  it('recovers a missing @case closing brace before the next case', () => {
    const source = '@switch (role) { @case ("admin") { <StLabel /> @case ("editor") { <StButton /> } @default { <StBox /> } }';
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('switch-block');
    if (block?.kind !== 'switch-block') return;
    expect(block.cases).toHaveLength(2);
    expect(block.cases[0]?.children).toHaveLength(1);
    expect(block.cases[1]?.expressions).toEqual(['"editor"']);
    expect(block.defaultCase?.children).toHaveLength(1);
    expect(result.diagnostics.some((item) => item.code === 'GTPL3006')).toBe(true);
  });

  it('keeps nested switch labels inside their own switch and preserves source spans', () => {
    const source = '@switch (kind) { @case ("outer") { @switch (state) { @case ("ready") {} @case ("busy") {} } } @case ("other") {} }';
    const result = parseGtpl(source);
    const outer = result.nodes[0];
    expect(outer?.kind).toBe('switch-block');
    if (outer?.kind !== 'switch-block') return;
    expect(outer.cases).toHaveLength(2);
    const nested = outer.cases[0]?.children[0];
    expect(nested?.kind).toBe('switch-block');
    if (nested?.kind !== 'switch-block') return;
    expect(nested.cases).toHaveLength(2);
    expect(nested.cases.map((item) => item.expressions)).toEqual([['"ready"'], ['"busy"']]);
    for (const item of [...outer.cases, ...nested.cases]) {
      expect(source.slice(item.span.start, item.span.end)).toContain('@case');
      expect(item.span.end).toBeGreaterThan(item.span.start);
    }
    expect(outer.cases[1]?.expressions).toEqual(['"other"']);
  });

  it('preserves switch labels after an unclosed nested control-flow block', () => {
    const source = '@switch (role) { @case ("admin") { @if (ready) { <StLabel /> @case ("editor") { <StButton /> } } }';
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('switch-block');
    if (block?.kind !== 'switch-block') return;
    expect(block.cases).toHaveLength(2);
    expect(block.cases[0]?.expressions).toEqual(['"admin"']);
    expect(block.cases[0]?.children[0]?.kind).toBe('if-block');
    expect(block.cases[1]?.expressions).toEqual(['"editor"']);
    expect(block.cases[1]?.children[0]?.kind).toBe('element');
    expect(result.diagnostics.some((item) => item.code === 'GTPL3006')).toBe(true);
  });

  it('recovers a missing @default closing brace before a later case', () => {
    const source = '@switch (role) { @case ("admin") {} @default { <StLabel /> @case ("editor") {} }';
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('switch-block');
    if (block?.kind !== 'switch-block') return;
    expect(block.defaultCase?.children).toHaveLength(1);
    expect(block.cases).toHaveLength(2);
    expect(result.diagnostics.some((item) => item.code === 'GTPL3006')).toBe(true);
    expect(result.diagnostics.some((item) => item.code === 'GTPL3102')).toBe(true);
  });
  it('keeps the first @default when a duplicate is reported', () => {
    const result = parseGtpl('@switch (role) { @case ("admin") {} @default { <StLabel>first</StLabel> } @default { <StLabel>second</StLabel> } }');
    const block = result.nodes[0];
    expect(block?.kind).toBe('switch-block');
    if (block?.kind !== 'switch-block') return;
    expect(block.defaultCase?.children).toHaveLength(1);
    const child = block.defaultCase?.children[0];
    expect(child?.kind).toBe('element');
    if (child?.kind !== 'element') return;
    expect(child.children[0]).toMatchObject({ kind: 'text', parts: [{ kind: 'text', value: 'first' }] });
    expect(result.diagnostics.some((item) => item.code === 'GTPL3104')).toBe(true);
  });

  it('reports malformed switch structures and missing @let terminators', () => {
    const switchResult = parseGtpl('@switch (role) { @default {} @case ("late") {} @default {} }');
    expect(switchResult.diagnostics.some((item) => item.code === 'GTPL3102')).toBe(true);
    expect(switchResult.diagnostics.some((item) => item.code === 'GTPL3104')).toBe(true);
    const letResult = parseGtpl('@let value = user.name');
    expect(letResult.diagnostics.some((item) => item.code === 'GTPL3204')).toBe(true);
  });
  it('supports nested control-flow blocks', () => {
    const result = parseGtpl('@if (visible) { @for (item of items; track item.id) { <StLabel /> } }');
    expect(result.diagnostics).toHaveLength(0);
    const outer = result.nodes[0]; expect(outer?.kind).toBe('if-block');
    if (outer?.kind !== 'if-block') return;
    expect(outer.branches[0]?.children[0]?.kind).toBe('for-block');
  });
  it('recovers a missing control-flow closing parenthesis before the block', () => {
    const source = '@if (ready { <StLabel /> } <StButton />';
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('if-block');
    if (block?.kind !== 'if-block') return;
    expect(block.branches[0]?.children).toHaveLength(1);
    expect(block.branches[0]?.children[0]?.kind).toBe('element');
    expect(result.nodes[1]?.kind).toBe('element');
    expect(result.diagnostics.some((item) => item.code === 'GTPL3004')).toBe(true);
    expect(result.diagnostics.some((item) => item.code === 'GTPL3006')).toBe(false);
  });


  it('keeps escaped quotes inside @if conditions', () => {
    const source = String.raw`@if (isReady("a\")b")) { <StLabel /> } <StButton />`;
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('if-block');
    if (block?.kind !== 'if-block') return;
    expect(block.branches[0]?.children[0]?.kind).toBe('element');
    expect(result.nodes[1]?.kind).toBe('element');
    expect(result.diagnostics).toHaveLength(0);
  });

  it('does not terminate @let at a semicolon inside an escaped string', () => {
    const source = String.raw`@let value = "a\";b"; <StLabel />`;
    const result = parseGtpl(source);
    expect(result.nodes[0]).toMatchObject({
      kind: 'let-declaration',
      name: 'value',
      expression: String.raw`"a\";b"`,
    });
    expect(result.nodes.find((node) => node.kind === 'element')?.kind).toBe('element');
    expect(result.diagnostics).toHaveLength(0);
  });

  it('maps control-flow expression diagnostics past leading whitespace', () => {
    const ifSource = '@if (  user. ) {}';
    const ifDiagnostic = parseGtpl(ifSource).diagnostics.find((item) => item.code === 'GTPL2003');
    expect(ifDiagnostic?.span.start).toBe(ifSource.indexOf('user.') + 5);

    const switchSource = '@switch (  state. ) { @case ("ready") {} }';
    const switchDiagnostic = parseGtpl(switchSource).diagnostics.find((item) => item.code === 'GTPL2003');
    expect(switchDiagnostic?.span.start).toBe(switchSource.indexOf('state.') + 6);

    const forSource = '@for (item of  items.; track item.id) {}';
    const forDiagnostic = parseGtpl(forSource).diagnostics.find((item) => item.code === 'GTPL2003');
    expect(forDiagnostic?.span.start).toBe(forSource.indexOf('items.') + 6);
  });


  it('keeps the first @for track expression when a duplicate is reported', () => {
    const source = '@for (item of items; track item.id; track item.name) { <StLabel /> }';
    const result = parseGtpl(source);
    const block = result.nodes[0];
    expect(block?.kind).toBe('for-block');
    if (block?.kind !== 'for-block') return;
    expect(block.track).toBe('item.id');
    expect(block.parsedTrack).toMatchObject({ kind: 'member', property: 'id' });
    expect(result.diagnostics.some((item) => item.code === 'GTPL3008')).toBe(true);
  });

  it('reports missing @for track and malformed delimiters', () => {
    const result = parseGtpl('@for (item of items) { <StLabel /> } @if ready { <StBox /> }');
    expect(result.diagnostics.some((item) => item.code === 'GTPL3002')).toBe(true);
    expect(result.diagnostics.some((item) => item.code === 'GTPL3003')).toBe(true);
  });
});
