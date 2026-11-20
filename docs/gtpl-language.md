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
- **Comments**: `<!-- ... -->`, discarded from the render tree but retained by diagnostics tooling if needed.

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

Expressions are not arbitrary JavaScript source. A separate expression grammar and type checker will define the safe, statically analyzable subset. The initial parser preserves expression text and does not evaluate it.

## Initial grammar sketch

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

This is a grammar sketch, not yet the complete formal grammar. The parser must reject malformed nesting, unterminated tags, duplicate binding names where prohibited, and unterminated interpolations with source-located diagnostics.

## Parsing and compilation phases

1. Lex source while tracking offset, line, and column.
2. Parse tags, attributes, text, comments, and interpolation boundaries into a typed AST.
3. Validate renderer selectors, input/output names, directive usage, and expression types.
4. Lower structural directives into explicit template control-flow nodes.
5. Generate renderer-specific JavaScript with source maps.

No template parsing should occur in the installed extension runtime.

## Security and correctness

- Do not use `eval`, `Function`, or dynamic code evaluation for expressions.
- Do not treat interpolated values as markup.
- Escape or reject unsupported constructs at compile time; never silently reinterpret them.
- Diagnostics must include the source file and 1-based line/column.
- Unknown renderer elements and properties are errors once renderer metadata is available.

## Status

The initial parser recognizes element structure, static attributes, binding attribute categories, comments, and text interpolation boundaries. It intentionally leaves expression parsing, directive lowering, renderer validation, and code generation for later milestones.
