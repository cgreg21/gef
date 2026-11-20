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

The TypeScript component metadata references its template with `templateUrl`. A standalone reusable template may also use the `.gtpl` extension.

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
| `[(property)]="expression"` | Two-way binding, subject to renderer support |
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

Object literals, assignments, statements, `new`, arbitrary global access, and JavaScript function/arrow declarations are intentionally not part of the initial grammar. Pipes and local-variable declarations will be specified separately.

The parser produces a typed expression AST and syntax diagnostics. It does not yet type-check identifiers against a component class or renderer metadata; that belongs to the semantic-analysis phase.

## Initial template grammar sketch

```ebnf
Template       ::= Node*
Node           ::= Element | Text | Comment
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
- Diagnostics must include the source file and 1-based line/column (expression diagnostics currently report source-relative offsets).
- Unknown renderer elements and properties are errors once renderer metadata is available.

## Status

Implemented: template structure parser, binding-attribute classification, interpolation boundary parsing, expression AST/parser, and syntax-level tests.

Not yet implemented: connecting expression parsing to every template binding during compilation, expression type checking, component metadata, directive lowering, renderer validation, and JavaScript code generation.
