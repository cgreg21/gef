# GTPL semantic analysis

The parser builds syntax trees; semantic analysis is a separate compile-time pass. It validates lexical visibility and, when supplied with component metadata, unresolved identifiers. It never evaluates expressions.

## Scopes

- The template root is a lexical scope. An `@let` declaration becomes visible to following nodes in that scope.
- Each `@if` branch has its own child scope. Its `as alias` is visible only inside that branch.
- An `@for` body receives the item, all six context variables (`$count`, `$index`, `$first`, `$last`, `$even`, `$odd`), and declared aliases. The `@empty` branch receives only the enclosing scope.
- Every switch case and default body has an isolated child scope.
- A declaration may shadow a name in an outer scope, but duplicate declarations in the same scope are diagnosed.

## API

```ts
const parsed = parseGtpl(templateSource);
const semantic = analyzeGtpl(parsed.nodes, {
  componentMembers: ['devices', 'refresh', 'selectedDevice'],
  globals: ['gettext'],
});
const diagnostics = [...parsed.diagnostics, ...semantic.diagnostics];
```

Providing `componentMembers` enables strict checking of identifiers that are not declared in lexical template scopes. Omitting it deliberately leaves component-context identifiers unresolved for compatibility until component metadata is connected. `globals` explicitly allow framework-provided names.

Semantic diagnostics currently include:
- `GTPL4001`: invalid template variable name.
- `GTPL4002`: identifier is not declared in template scope, component context, or configured globals.
- `GTPL4003`: duplicate declaration in the same lexical scope.

This is an initial scope and identifier pass, not full type checking. Property existence, call signatures, input/output compatibility, switch exhaustiveness, and renderer selector validation require component and renderer type metadata and remain future work.
