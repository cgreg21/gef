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
- [x] Disposable output event emitter in the shared package, exported by compiler and runtime.
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
- [x] Component instance/view lifecycle with child injector scopes and reverse-order teardown.
- [x] Explicit directive instance mounting with host bindings, host listeners and deterministic cleanup.
- [ ] Automatic selector matching and directive instantiation from templates.
- [x] GLib timeout/idle scheduling and GObject signal lifecycle helpers.\n- [ ] GNOME Shell 51 St/Clutter integration tests.
- [x] Initial GTK4/libadwaita host adapter with reactive bindings and keyed loops.
- [x] GTK4/libadwaita preferences example entry point and template compilation.
- [ ] GTK4/libadwaita preferences integration tests and complete renderer coverage.
- [ ] Native GJS code generation and source maps.

## Styles and developer tools
- [x] SCSS compilation through the Sass CLI.\n- [x] Initial GNOME theme CSS validation for unsupported browser layout declarations and block balance.
- [ ] Complete St/GTK-specific CSS validation and style scoping.
- [x] CLI `check` and `compile` commands.
- [x] CLI `new` and `doctor` commands.
- [x] CLI `generate component`, `test`, `package` and `styles` commands.
- [ ] Watch mode and integrated GNOME test runner.
- [ ] Watch mode, diagnostics and examples.
