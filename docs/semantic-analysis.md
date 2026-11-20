# GTPL semantic analysis and component validation

## Component declarations

Components, directives and pipes are declared through the public decorator API. Decorators collect immutable metadata; they do not instantiate components or execute rendering behavior.

```ts
@Component({ selector: 'GefButton', template: '<button>{{ label }}</button>' })
class GefButton {
  @Input() label = '';
  @Output() readonly clicked = new EventEmitter<void>();
}
```

The metadata can be passed directly to GTPL validation because component contracts are structural data:

```ts
const parsed = parseGtpl(template);
const metadata = getComponentMetadata(GefButton);
const diagnostics = metadata
  ? validateGtplComponents(parsed.nodes, { components: [metadata] })
  : [];
```

Property bindings must match a component input and event bindings must match an output. A two-way binding requires an input and the matching `nameChange` output.

Unknown elements are allowed by default so templates can use native St actors without duplicating GNOME Shell's widget catalogue. Set `strict: true` for a closed component registry.

## Semantic scopes

`analyzeGtpl` validates template-local names and, optionally, identifiers exposed by the component and framework. It handles `@let`, `@if` aliases, `@for` item/context variables, `@empty` and isolated `@switch` branches.

This is name and scope validation only. It does not type-check TypeScript members, instantiate components, execute pipes, or generate renderer code.
