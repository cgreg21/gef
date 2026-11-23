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
| `[class.active]="condition"` | Dynamic class token |
| `[style.opacity]="opacity"` | Dynamic style binding, if supported by target |
| `#localName` | Local element reference |

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
- Array literals.
- Pipe expressions with chained transforms and colon-separated arguments.

Object literals, statements, `new`, arbitrary global access, and JavaScript function/arrow declarations are intentionally not part of the initial grammar. Simple assignments to identifiers and member expressions are supported for event handlers and two-way bindings. Pipes use `value | pipeName:argument` syntax. `@let` declares template-local values and their scopes are checked by the semantic pass.

The parser produces a typed expression AST and syntax diagnostics. Control flow follows Angular's built-in block model: `@let name = expression;` local declarations, `@switch (expression)` with grouped `@case (value)` branches and optional `@default { ... }` / `@default never;`, `@if (...)`, any number of `@else if (...)` branches, one `@else` branch, and `@for (item of iterable; track identity; let idx = $index)` with optional contextual aliases and `@empty`. `@if` also supports `; as alias` to bind its condition result. The fallback is written `@else { ... }` (without parentheses). Structural shorthand is `*if` and `*for` (also `*gefIf` and `*gefFor`) on elements; `*for` uses the `let item of items` microsyntax. Block loops expose `$count`, `$index`, `$first`, `$last`, `$even`, and `$odd`, which may be aliased with `let name = $index`. Expression-bearing property, event, two-way, and structural bindings are parsed during GTPL parsing; interpolation expressions are parsed as well. Parsed trees are attached to their AST nodes while original expression text and source spans are preserved. `*gefFor="let item of items"` is recognized as dedicated microsyntax and intentionally deferred to structural-directive parsing. Expression diagnostics are translated to template-file line and column positions; semantic unknown-identifier diagnostics point to the exact identifier in interpolation and attribute expressions. Source locations recognize LF, CRLF and standalone CR line endings.

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
  <Flex direction="column" grow="1">
    <Label>Page content</Label>
  </Flex>
</Flex>
```

`HeaderBar` is a horizontal container and `Sidebar` is a vertical container. Both accept the same child elements and bindings as other GTPL containers. They are layout containers, not window decorations: attach the header bar to the application's window/title area when the platform requires it. Their default orientations can be overridden with the normal `orientation` attribute.

## Security and correctness

- Do not use `eval`, `Function`, or dynamic code evaluation for expressions.
- Do not treat interpolated values as markup.
- Escape or reject unsupported constructs at compile time; never silently reinterpret them.
- Diagnostics must include the source file and 1-based line/column. The standalone expression parser reports expression-relative offsets; the GTPL parser remaps them to template-file positions.
- Unknown renderer elements and properties are errors once renderer metadata is available.

## Status

Implemented: template structure parser, Angular-style `@switch` / `@case` / `@default` selection (including grouped cases and `@default never` syntax), `@let` local declarations, binding-attribute classification, interpolation boundary parsing, expression AST/parser, integration of expression trees into bindings/interpolations, template-positioned expression diagnostics, and syntax/integration tests.

Implemented: structural shorthand and two-way binding lowering, JavaScript template generation, renderer-independent execution runtime, reactive text/property bindings, reactive `@if`/`@switch`/keyed `@for` updates in the GNOME Shell and GTK4 hosts, deterministic render-view disposal, TypeScript-aware expression type checking, component/directive/pipe metadata registration, component and directive lifecycles, Source Map v3 mappings for template nodes and nested expression nodes, and initial GTK4/libadwaita rendering. Remaining work includes full renderer validation, broader native GNOME Shell 51 integration coverage and production hardening.
