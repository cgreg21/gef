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

The current `@Component` API accepts an inline `template` string. External `.gtpl` file loading and a `templateUrl` option remain planned; the file layout above describes the intended component organization.

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
- Array literals.

Object literals, statements, `new`, arbitrary global access, and JavaScript function/arrow declarations are intentionally not part of the initial grammar. Simple assignments to identifiers and member expressions are supported for event handlers and two-way bindings. Pipes and local-variable declarations will be specified separately.

The parser produces a typed expression AST and syntax diagnostics. Control flow follows Angular's built-in block model: `@let name = expression;` local declarations, `@switch (expression)` with grouped `@case (value)` branches and optional `@default { ... }` / `@default never;`, `@if (...)`, any number of `@else if (...)` branches, one `@else` branch, and `@for (item of iterable; track identity; let idx = $index)` with optional contextual aliases and `@empty`. `@if` also supports `; as alias` to bind its condition result. The fallback is written `@else { ... }` (without parentheses). Structural shorthand is `*if` and `*for` (also `*gefIf` and `*gefFor`) on elements; `*for` uses the `let item of items` microsyntax. Block loops expose `$count`, `$index`, `$first`, `$last`, `$even`, and `$odd`, which may be aliased with `let name = $index`. Expression-bearing property, event, two-way, and structural bindings are parsed during GTPL parsing; interpolation expressions are parsed as well. Parsed trees are attached to their AST nodes while original expression text and source spans are preserved. `*gefFor="let item of items"` is recognized as dedicated microsyntax and intentionally deferred to structural-directive parsing. Expression diagnostics are translated to template-file line and column positions. This phase does not type-check identifiers against a component class or renderer metadata; that belongs to semantic analysis.

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
Attribute      ::= StaticAttribute
                 | PropertyBinding
                 | EventBinding
                 | TwoWayBinding
                 | StructuralBinding
                 | LocalReference
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

## Security and correctness

- Do not use `eval`, `Function`, or dynamic code evaluation for expressions.
- Do not treat interpolated values as markup.
- Escape or reject unsupported constructs at compile time; never silently reinterpret them.
- Diagnostics must include the source file and 1-based line/column. The standalone expression parser reports expression-relative offsets; the GTPL parser remaps them to template-file positions.
- Unknown renderer elements and properties are errors once renderer metadata is available.

## Status

Implemented: template structure parser, Angular-style `@switch` / `@case` / `@default` selection (including grouped cases and `@default never` syntax), `@let` local declarations, binding-attribute classification, interpolation boundary parsing, expression AST/parser, integration of expression trees into bindings/interpolations, template-positioned expression diagnostics, and syntax/integration tests.

Implemented: structural shorthand lowering, two-way binding lowering, initial template JavaScript source generation. Not yet implemented: expression type checking against TypeScript members, renderer validation, complete runtime execution and renderer-specific code generation. Component, directive and pipe declaration metadata plus component input/output contract validation are implemented.
