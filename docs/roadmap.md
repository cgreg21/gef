# Development roadmap

## EGO publication compliance
- [x] Require the staged `extension.js` entry point and reject malformed UUID domain labels.
- [ ] Emit readable, consistently formatted JavaScript without minification or obfuscation.
- [x] Check Shell and preferences entry points and their complete static JavaScript dependency graphs for process-specific GI imports.
- [x] Require the default-exported Shell extension class to implement `enable()` and `disable()`.
- [ ] Complete lifecycle validation: detect more pre-enable side effects and verify resource cleanup in `disable()`. The Shell 51 harness now installs the generated archive and exercises two real enable/disable cycles; runtime execution still requires a GNOME Shell 51 host.
- [x] Add a GNOME Shell 51 GJS fixture that repeats resource-scope cleanup for real St actors, GObject signals and GLib timers.
- [x] Warn about GNOME actor creation, signal connections and GLib timers in the extension constructor.
- [x] Validate unique stable `shell-version` values and positive integer optional metadata `version`.
- [x] Validate required `metadata.json` fields, UUID format and optional settings schema metadata.
- [x] Reject JavaScript modules not reachable from either extension entry point.
- [x] Validate local CSS `url()` references against packaged files.
- [x] Warn about potentially unused CSS, image, font, resource and schema files without rejecting dynamic runtime references.
- [ ] Bundle only required runtime files; exclude build tools, scripts, development files and unused assets.
- [ ] Check generated code for unsupported APIs, excessive logging, unnecessary subprocesses and review-hostile output.
- [ ] Provide an EGO pre-submission validation command and a readable review report.
- [x] Generate a UUID-named EGO ZIP with extension files at the archive root; verify archive integrity, required files and absence of development-only paths.
- [x] Add a GNOME Shell 51 harness that installs the final EGO ZIP and verifies two real enable/disable cycles through `gnome-extensions`.

## npm publication and CLI distribution
- [ ] Confirm the public npm package name and publish the first stable release.
- [ ] Publish package metadata, compiler/runtime ESM exports and the `gef` executable.
- [x] Add CI coverage for clean tarball installation, compiler/runtime ESM imports and CLI execution through `npx`.
- [ ] Verify the first published version from the public npm registry.
- [x] Add a GitHub Release workflow with npm trusted publishing (OIDC), including an exact release-tag/package-version guard; never store credentials in source.
- [x] Document the one-time manual npm package bootstrap, versioning, changelog and release recovery procedure.
- [ ] Configure the npm package trusted publisher and complete the first public release.

## Foundation
- [x] Repository baseline and GNOME Shell 51 target.
- [x] Canonical .gtpl templates and initial parser.
- [x] Public ESM package entry points and package contents metadata.
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
- [x] Optional TypeScript expression checking against component context type literals.
- [x] Emit JavaScript source for parsed expression ASTs.
- [x] Emit JavaScript render-function source for GTPL ASTs, including `*if`/`*for` lowering and two-way bindings.
- [x] Provide a combined GTPL parse, semantic and component validation API.
- [x] Connect supported generated templates to the executable renderer-independent runtime.
- [x] Emit Source Map v3 mappings for all rendered GTPL nodes, including nested elements and text nodes, and expose them through compiler, component compilation and CLI output.
- [x] Complete Source Map v3 expression mappings down to nested expression AST nodes, including member access, calls, operators, conditional expressions, pipes and array items.
- [x] Map interpolation, expression-bound attribute, `@if`, `@for`, `@switch`, and `@let` expressions to their GTPL source positions.
- [x] Report unknown identifiers at their exact GTPL expression locations.
- [x] Track correct template line numbers for LF, CRLF and standalone CR line endings.
- [x] Exhaustiveness diagnostics for `@default never` over literal-union context properties.

## Runtime and renderers
- [x] Initial resource scope with reverse-order, idempotent cleanup.
- [x] Generated Shell example owns stylesheet, GSettings bindings and mounted view in one activation scope, including rollback when setup fails.
- [x] Initial renderer-independent GTPL runtime and disposable render views.
- [x] Initial GNOME Shell St host adapter with reactive property/text bindings and signal cleanup.
- [x] Synchronous signal, computed and effect primitives.
- [x] Reactive `@if`, `@switch` and keyed `@for` updates in the St host.
- [x] Clean up partially rendered repeat components on failure and release initial-render tracking after mount.
- [x] Explicit hierarchical dependency injector with scoped disposal.
- [x] Component instance/view lifecycle with child injector scopes, bound inputs/outputs and reverse-order teardown.
- [x] Runtime regression coverage for reactive input updates and stopping updates after component destruction.
- [x] GTK renderer coverage for registered component mounting, reactive inputs and output teardown.
- [x] Nested component selector registry and generated-template mounting.
- [x] Explicit directive instance mounting with host bindings, host listeners and deterministic cleanup.
- [x] Selector-matched directive instantiation, input/output binding and host behavior in generated templates.
- [x] Runtime pipe registry with pure-transform caching and decorator metadata registration.
- [x] GLib timeout/idle scheduling, GObject signal lifecycle, D-Bus subscriptions and Clutter transition cleanup.
- [x] GNOME Shell 51 St actor smoke harness on a virtual X11 display (requires a host with Shell 51 installed).
- [x] GTK4/libadwaita host adapter with reactive bindings, keyed loops and common GTK4/Adw widget constructors.
- [x] GTK4/libadwaita preferences example entry point, template compilation and reactive GSettings-backed controls.
- [x] Reactive GSettings adapters for boolean, integer, string and string-array keys.
- [x] Native GTK4/libadwaita widget and GSettings smoke test under Xvfb in CI.
- [x] Compile and stage the extension GSettings schema during packaging.
- [x] Scoped GTK stylesheet provider and GNOME Shell extension stylesheet lifecycle helpers.
- [ ] Full preferences-window integration tests and remaining renderer coverage.
- [ ] Native GJS code generation and source maps.

## Styles and developer tools
- [x] SCSS compilation through the Sass CLI.
- [x] Initial GNOME theme CSS validation for unsupported browser layout declarations and block balance.
- [ ] Complete St/GTK-specific CSS validation and style scoping.
- [x] CLI `check`, `compile` and `build` commands.
- [x] CLI `new` and `doctor` commands.
- [x] CLI `generate component` creates a decorated, input-driven component and matching GTPL template.
- [x] CLI `test`, `package` and `styles` commands.
- [x] Native filesystem watch mode and GNOME Shell 51 virtual-display smoke test harness.
- [ ] Full automated GNOME Shell 51 and GTK4 integration suite.
- [x] Source excerpts and caret markers in GTPL CLI diagnostics.
- [x] CLI doctor checks Node.js, Sass, GJS, GNOME Shell 51, GTK4, libadwaita and GSettings tools.
- [ ] Additional examples and full integration coverage.
