# Development roadmap

## Foundation
- [x] Repository baseline and GNOME Shell 51 target.
- [x] Canonical .gtpl templates and initial parser.
- [ ] Reproducible lockfile, dependency audit, lint and formatting.

## GTPL compiler
- [x] Nested elements, attributes, interpolation and expression AST.
- [x] Angular-like @if, @for, @switch and @let parsing.
- [x] Lexical scope and optional component identifier checks.
- [x] Decorator-based component declarations (`@Component`, `@Input`, `@Output`) and immutable metadata extraction.
- [x] Directive and pipe declaration metadata (`@Directive`, `@Pipe`, `@HostBinding`, `@HostListener`).
- [x] Disposable output event emitter.
- [x] Component input/output binding validation.
- [x] Organize compiler implementation by domain subdirectories with focused package entry points.
- [x] Deterministic parser fuzz corpus and malformed-input regression tests.
- [ ] Type-check expressions against TypeScript component members.
- [x] Emit JavaScript source for parsed expression ASTs.\n- [x] Emit initial JavaScript render-function source for GTPL ASTs (runtime contract injected; structural shorthand and two-way bindings remain pending).
- [x] Provide a combined GTPL parse, semantic and component validation API.
- [x] Connect supported generated templates to the executable renderer-independent runtime.
- [ ] Complete source maps, diagnostics mapping and remaining template constructs.
- [ ] Switch exhaustiveness checks using TypeScript types.

## Runtime and renderers
- [x] Initial resource scope with reverse-order, idempotent cleanup.
- [x] Initial renderer-independent GTPL runtime and disposable render views.
- [x] Initial GNOME Shell St host adapter with reactive property/text bindings and signal cleanup.
- [x] Synchronous signal, computed and effect primitives.
- [x] Reactive `@if`, `@switch` and keyed `@for` updates in the St host.
- [x] Explicit hierarchical dependency injector with scoped disposal.
- [ ] Component lifecycle integration, directive instantiation and DI scopes.
- [ ] GNOME Shell 51 St/Clutter integration tests.
- [x] Initial GTK4/libadwaita host adapter with reactive bindings and keyed loops.
- [ ] GTK4/libadwaita preferences integration tests and complete renderer coverage.
- [ ] Native GJS code generation and source maps.

## Styles and developer tools
- [ ] SCSS compilation and St/GTK-specific CSS validation.
- [ ] CLI: new, generate, build, test, validate, package and doctor.
- [ ] Watch mode, diagnostics and examples.
