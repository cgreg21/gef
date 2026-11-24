# GTPL language — initial specification

GTPL (`.gtpl`) is GEF's canonical declarative template format. It is HTML-like in appearance, but it is a framework DSL compiled ahead of time to native renderer instructions. It is not browser HTML and is not loaded by a web browser.

## File conventions

A component normally consists of:

```text
my-component/
  my-component.component.ts
  my-component.component.gtpl
  my-component.component.scss
  my-component.component.spec.ts
```

`@Component` accepts either an inline `template` string or a `templateUrl` pointing to an external `.gtpl` file. The build pipeline resolves external files and supplies their source to `compileGtplComponent`; the installed runtime never loads template files.

## Node model

The parser distinguishes:

- **Element nodes**: renderer component tags such as `StBox`, `StLabel`, or user components.
- **Text nodes**: literal text and interpolation parts.
- **Interpolation parts**: expressions delimited by `{{` and `}}`.
- **Attributes**: static attributes and binding forms.
- **Comments**: `<!-- ... -->`, discarded from the render tree.

The names `StBox`, `StIcon`, `StLabel`, and `StButton` are proposed GEF renderer component selectors. They are not HTML elements and must be registered in the target renderer.

## Binding syntax

| Form | Meaning |
| --- | --- |
| `{{ expression }}` | Text interpolation |
| `[property]="expression"` | One-way property binding |
| `(event)="handler($event)"` | Event binding |
| `[(property)]="expression"` | Property binding plus a `propertyChange` assignment callback |
| `*gefIf="condition"` | Structural conditional |
| `*gefFor="let item of items"` | Structural iteration |
| `[class]="classes"` | String, array or object class binding |
| `[class.active]="condition"` | Dynamic class token |
| `[style]="styles"` | String or object style binding |
| `[style.opacity]="opacity"` | Dynamic style property |
| `[style.width.px]="width"` | Dynamic style property with unit |
| `#localName` | Local element reference |

## Classes and inline styles

GTPL follows Angular's built-in class and style binding model. Static `class` values accept whitespace-separated names. `[class]` accepts a string, an array of names, or an object whose truthy entries enable their keys. Individual tokens can be controlled with `[class.active]="isActive"`; all sources are combined, so disabling one binding does not remove a class still enabled elsewhere.

The `style` attribute and `[style]` accept CSS declarations or an object map. Use `[style.color]="textColor"` for a single property and `[style.width.px]="width"` to append a unit. A null or undefined property value removes that declaration. Camel-case object keys are converted to CSS kebab-case. Selectors and complete CSS rules belong in component stylesheets, not element attributes.

GTK4 uses a widget-scoped `Gtk.CssProvider`; GNOME Shell uses the native St style API. These bindings do not depend on browser DOM support.
 
## Expression language

GTPL expressions are a restricted, statically analyzable language. They are not arbitrary JavaScript and are never evaluated using `eval` or `Function`.

The initial expression parser supports:

- Identifiers and literals: strings, numbers, booleans, and `null`.
- Member access: `device.name`, `device?.name`, and `items[index]`.
- Calls: `device.getLabel()` and argument lists.
- Unary operators: `!`, unary `+`, and unary `-`.
- Binary operators: arithmetic, comparison, equality, logical AND/OR, nullish coalescing, and exponentiation.
- Conditional expressions: `condition ? whenTrue : whenFalse`.
- Assignments to identifier and member-expression targets, for event handlers and lowered two-way bindings.
- Array and object literals. Object keys may be identifiers, strings or numbers; values are expressions, and trailing commas are accepted.
- Pipe expressions with chained transforms and colon-separated arguments.

Statements, `new`, arbitrary global access, and JavaScript function/arrow declarations are intentionally not part of the expression grammar. Simple assignments to identifiers and member expressions are supported for event handlers and two-way bindings. Pipes use `value | pipeName:argument` syntax. `@let` declares template-local values and their scopes are checked by the semantic pass.

Object literals are useful with Angular-style class and style bindings, for example `[class]="{ active: isActive, disabled: isDisabled }"` and `[style]="{ color: textColor, padding: '8px' }"`. The parser produces a typed expression AST and syntax diagnostics. Control flow follows Angular's built-in block model: `@let name = expression;` local declarations, `@switch (expression)` with grouped `@case (value)` branches and optional `@default { ... }` / `@default never;`, `@if (...)`, any number of `@else if (...)` branches, one `@else` branch, and `@for (item of iterable; track identity; let idx = $index)` with optional contextual aliases and `@empty`. `@if` also supports `; as alias` to bind its condition result. The fallback is written `@else { ... }` (without parentheses). Structural shorthand is `*if` and `*for` (also `*gefIf` and `*gefFor`) on elements; `*for` uses the `let item of items` microsyntax. Block loops expose `$count`, `$index`, `$first`, `$last`, `$even`, and `$odd`, which may be aliased with `let name = $index`. Expression-bearing property, event, two-way, and structural bindings are parsed during GTPL parsing; interpolation expressions are parsed as well. Parsed trees are attached to their AST nodes while original expression text and source spans are preserved. `*gefFor="let item of items"` is recognized as dedicated microsyntax and intentionally deferred to structural-directive parsing. Expression diagnostics are translated to template-file line and column positions; semantic unknown-identifier diagnostics point to the exact identifier in interpolation and attribute expressions. Source locations recognize LF, CRLF and standalone CR line endings.

## Initial template grammar sketch

```ebnf
Template       ::= Node*
Node           ::= Element | Text | Comment | LetDeclaration | IfBlock | ForBlock | SwitchBlock
IfBlock        ::= "@if" "(" Expression (";" "as" Identifier)? ")" "{" Node* "}" ("@else if" "(" Expression ")" "{" Node* "}")* ("@else" "{" Node* "}")?
ForBlock       ::= "@for" "(" Identifier "of" Expression ";" "track" Expression (";" "let" Alias ("," Alias)*)? ")" "{" Node* "}" ("@empty" "{" Node* "}")?
SwitchBlock    ::= "@switch" "(" Expression ")" "{" (SwitchCase | SwitchDefault)* "}"
SwitchCase     ::= ("@case" "(" Expression ")")+ "{" Node* "}"
SwitchDefault  ::= "@default" ("{" Node* "}" | "never" ("(" Expression ")")? ";")
LetDeclaration ::= "@let" Identifier "=" Expression ";"
Alias          ::= Identifier "=" ContextVariable
ContextVariable ::= "$count" | "$index" | "$first" | "$last" | "$even" | "$odd"
Element        ::= OpenTag Node* CloseTag | SelfClosingTag
OpenTag        ::= "<" Name Attribute* ">"
CloseTag       ::= "</" Name ">"
SelfClosingTag ::= "<" Name Attribute* "/>"
Attribute      ::= StaticAttribute | PropertyBinding | EventBinding | TwoWayBinding | StructuralBinding | LocalReference
Text           ::= (Character | Interpolation)+
Interpolation  ::= "{{" Expression "}}"
```

This is a grammar sketch, not yet the complete formal grammar. The parser rejects malformed nesting and reports unterminated tags, comments, quoted attributes, and interpolations with source locations.

## Parsing and compilation phases

1. Lex source while tracking offsets, lines, and columns.
2. Parse tags, attributes, text, comments, and interpolation boundaries into a typed template AST.
3. Parse expression strings into expression ASTs.
4. Validate renderer selectors, input/output names, directive usage, and expression types.
5. Lower structural directives into explicit template control-flow nodes.
6. Generate renderer-specific JavaScript with source maps.

No template or expression parsing should occur in the installed extension runtime.

## Native layout containers

GTPL provides two simple application-shell containers on both GNOME Shell and GTK4:

```html
<HeaderBar>
  <Label text="My application" />
  <Button>Settings</Button>
</HeaderBar>

<Flex direction="row" gap="12">
  <Sidebar width="220">
    <Button>Overview</Button>
    <Button>Preferences</Button>
  </Sidebar>
  <Flex direction="column" gap="8">
    <Label>Page content</Label>
    <Button>Continue</Button>
  </Flex>
</Flex>
```

`HeaderBar` uses the supplied `Adw.HeaderBar` when available, otherwise `Gtk.HeaderBar`, then falls back to a horizontal `Gtk.Box`; on GNOME Shell it uses a horizontal `St.BoxLayout`. `Sidebar` is a vertical `Gtk.Box` or `St.BoxLayout`. Children are packed into the native header bar using its start slot. Both accept the same child elements and bindings as other GTPL containers. They are layout containers, not window decorations: attach the header bar to the application's window/title area when the platform requires it. The `orientation` attribute applies to the box fallback and to `Sidebar`.



`Grid` arranges its direct template children in rows and columns. Use `columns` (a positive integer) and `gap` (a non-negative pixel value):

```html
<Grid columns="3" gap="12">
  <Card>One</Card>
  <Card>Two</Card>
  <Card>Three</Card>
  <Card>Four</Card>
</Grid>
```

GTK uses `Gtk.Grid` cell attachment. GNOME Shell 51 uses a vertical `St.BoxLayout` containing horizontal row boxes, since St 51 does not expose a native grid widget. The current GTPL grid uses a fixed column count; responsive column changes are not yet wired to native allocation events.

`Flex` is a native box container on both renderers. Its GTPL attributes are `direction="row|column"`, `gap="N"`, `homogeneous="true|false"` and `align="fill|start|center|end"`. `direction` and `homogeneous` can be bound reactively. `gap` maps to native box spacing; `homogeneous` asks the native box to distribute the same size to each child. Any child widget can declare `expand="true|false"`; this maps to GTK `hexpand`/`vexpand` or St `x_expand`/`y_expand`, and supports reactive bindings. It requests additional space from the native layout; it does not force an exact size. `align` sets the Flex container's horizontal and vertical native alignment (GTK `halign`/`valign`, St `x_align`/`y_align`) and supports reactive bindings. It does not implement CSS `align-items`. Main-axis `justify-content` is not exposed because the native box APIs do not provide a matching cross-platform property; wrapping and per-child grow/shrink weights are also not yet supported.

## Component host bindings

Components can expose native root properties with `@HostBinding`, using the same metadata decorator available to directives. A host binding is applied after the component template has rendered and is disposed with the component:

```ts
@Component({ selector: 'GefIconButton', template: '<StButton />' })
class IconButton {
  @HostBinding('accessible-label') label = 'Open settings';
}
```

The renderer must support `setProperty` for native properties and `setHostAttributes` for class/style bindings. Ordinary values are applied once; members containing GEF bindings update reactively and are disposed with the component. Class and style bindings reuse the same renderer behavior as template-level host attributes. Supported forms include `@HostBinding('class')`, `@HostBinding('class.active')`, `@HostBinding('style')`, and `@HostBinding('style.opacity')`. These bindings do not create extra wrappers or alter the component's template structure.

## Component host class and style

A component may receive the same class and style attributes as a native element. GEF applies these attributes to the component template's single native root, while the component's own template and input bindings remain independent:

```html
<GefButton
  class="toolbar-button"
  [class]="{ active: isActive }"
  [class.disabled]="isDisabled"
  [style]="{ minWidth: '120px', opacity: buttonOpacity }"
/>
```

The GTK4 and GNOME Shell renderers apply these bindings to the native root and dispose reactive effects and GTK CSS providers with that root. A component template must therefore render one managed native root when host class/style attributes are used; a fragment or text-only root cannot receive native styling.

## Security and correctness

- Do not use `eval`, `Function`, or dynamic code evaluation for expressions.
- Do not treat interpolated values as markup.
- Escape or reject unsupported constructs at compile time; never silently reinterpret them.
- Diagnostics must include the source file and 1-based line/column. The standalone expression parser reports expression-relative offsets; the GTPL parser remaps them to template-file positions.
- Unknown renderer elements and properties are errors once renderer metadata is available.

## Status

Implemented: template structure parser, Angular-style `@switch` / `@case` / `@default` selection (including grouped cases and `@default never` syntax), `@let` local declarations, binding-attribute classification, interpolation boundary parsing, expression AST/parser, integration of expression trees into bindings/interpolations, template-positioned expression diagnostics, and syntax/integration tests.

Implemented: structural shorthand and two-way binding lowering, JavaScript template generation, renderer-independent execution runtime, reactive text/property bindings, reactive `@if`/`@switch`/keyed `@for` updates in the GNOME Shell and GTK4 hosts, deterministic render-view disposal, TypeScript-aware expression type checking, component/directive/pipe metadata registration, component and directive lifecycles, Source Map v3 mappings for template nodes and nested expression nodes, and initial GTK4/libadwaita rendering. Remaining work includes full renderer validation, broader native GNOME Shell 51 integration coverage and production hardening.
