# GTPL component metadata

Component metadata is plain data: no decorators, reflection, or runtime registry are required.

```ts
const components = [{ selector: 'GefButton', inputs: ['label'], outputs: ['clicked'] }];
const parsed = parseGtpl(template);
const diagnostics = [
  ...parsed.diagnostics,
  ...validateGtplComponents(parsed.nodes, { components }),
];
```

Property bindings must match an input and event bindings must match an output. A two-way binding requires an input and the matching nameChange output.

Unknown elements are allowed by default so templates can use native St actors without duplicating GNOME Shell's widget catalogue. Set strict to true for a closed component registry.

This validates metadata only. It does not check TypeScript property types, instantiate components, or generate renderer code.