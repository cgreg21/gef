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
- [ ] Parser fuzzing and malformed-input corpus.
- [ ] Type-check expressions against TypeScript component members.
- [ ] Lower structural shorthand and control flow.
- [ ] Switch exhaustiveness checks using TypeScript types.

## Runtime and renderers
- [ ] Resource ownership and deterministic cleanup.
- [ ] Dependency injection and reactive signals.
- [ ] GNOME Shell 51 St/Clutter renderer and integration tests.
- [ ] GTK4/libadwaita preferences renderer.
- [ ] Native GJS code generation and source maps.

## Styles and developer tools
- [ ] SCSS compilation and St/GTK-specific CSS validation.
- [ ] CLI: new, generate, build, test, validate, package and doctor.
- [ ] Watch mode, diagnostics and examples.