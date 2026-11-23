# Development roadmap

## Documentation
- [x] Add a documentation index, first-extension walkthrough and complete CLI command reference.
- [x] Keep the CLI help synopsis, generated alpha dependency range and npm availability notes aligned with the actual scaffold.
- [x] Link the documentation set from the repository README and keep alpha limitations explicit.

## EGO publication compliance
- [x] Require the staged `extension.js` entry point and reject malformed UUID domain labels.
- [x] Emit readable, consistently formatted JavaScript without minification or obfuscation, preserving generated line/column positions in Source Map v3.
- [x] Check Shell and preferences entry points and their complete static JavaScript dependency graphs for process-specific GI imports.
- [x] Require the default-exported Shell extension class to implement `enable()` and `disable()`.
- [ ] Complete lifecycle validation: detect more pre-enable side effects and verify resource cleanup in `disable()`. The Shell 51 harness now installs the generated archive and exercises two real enable/disable cycles; runtime execution still requires a GNOME Shell 51 host.
- [x] Warn about GNOME resource creation and signal/timer registration at module load time.
- [x] Warn when resource creation in `enable()` has no obvious cleanup call in `disable()`; this is a heuristic, not proof of complete cleanup.
- [x] Recognize GObject `disconnectObject()` and GLib `source_remove()` as explicit lifecycle cleanup calls.
- [x] Add a GNOME Shell 51 GJS fixture that repeats resource-scope cleanup for real St actors, GObject signals and GLib timers.
- [x] Verify St host signal-handler and reactive-effect teardown when their actors are destroyed.
- [x] Warn about GNOME actor creation, signal connections and GLib timers in the extension constructor.
- [x] Validate unique stable `shell-version` values and positive integer optional metadata `version`.
- [x] Validate required `metadata.json` fields, UUID format and optional settings schema metadata.
- [x] Reject JavaScript modules not reachable from either extension entry point.
- [x] Validate local CSS `url()` references against packaged files.
- [x] Warn about potentially unused CSS, image, font, resource and schema files without rejecting dynamic runtime references.
- [ ] Bundle only required runtime files; exclude build tools, scripts, development files and unused assets.
- [ ] Check generated code for unsupported APIs, excessive logging, unnecessary subprocesses and review-hostile output.
- [x] Warn about `console.debug()` calls in packaged JavaScript without blocking the EGO check.
- [x] Provide an EGO pre-submission validation command with concise file, JavaScript, warning and error totals (static checks only; not EGO approval).
- [x] Format EGO summary file, JavaScript, warning and error counts with correct singular and plural wording.
- [x] Generate a UUID-named EGO ZIP with extension files at the archive root; verify archive integrity, required files and absence of development-only paths.
- [x] Add a GNOME Shell 51 harness that installs the final EGO ZIP and verifies two real enable/disable cycles through `gnome-extensions`.

## npm publication and CLI distribution
- [x] Prepare the first alpha version as `0.1.0-alpha.1` and keep prereleases on npm's `next` dist-tag.
- [x] Confirm the public npm package name and publish the first alpha release.
- [x] Publish package metadata, compiler/runtime ESM exports and the `gef` executable.
- [x] Add CI coverage for npm manifest/export/tarball contents, clean installation, compiler/runtime ESM imports and CLI execution through `npx`.
- [ ] Verify the first published alpha from the public npm registry and install it through `npx --package gnome-extension-framework@next gef --help`.
- [x] Add a GitHub Release workflow with npm trusted publishing (OIDC), including an exact release-tag/package-version guard; never store credentials in source.
- [x] Document the one-time manual npm package bootstrap, versioning, changelog and release recovery procedure.
- [ ] Configure the npm package trusted publisher and verify an OIDC publication of a subsequent version.
- [ ] Run the final alpha candidate through the GNOME Shell 51 real-host enable/disable harness before publishing.

## Project configuration and Node-GTK
- [x] Add an Angular-style `gef.json` workspace file with `projects`, `defaultProject` and `projectType` (`application` or `extension`).
- [x] Generate a GTK4/libadwaita Node-GTK 4 application starter alongside GNOME Shell extension projects.
- [x] Route application packaging to the node-gtk bundler and retain EGO packaging for extension projects.
- [x] Generate Node-GTK portable bundle metadata (application ID, compiled entry point and GTK version) and delegate configured packaging through the project's npm script.
- [x] Adapt the GTK renderer to Node-GTK camelCase GObject properties, `.on()` / `.off()` signals and GTK child APIs.
- [x] Use the GEF GTPL compiler and GTK renderer in generated Node-GTK application projects.
- [x] Verify compiled GTPL mounting, reactive bindings, widget properties, signals and teardown against the native Node-GTK 4.1.1 runtime in CI.

## Cross-platform compatibility
- [x] Keep CLI EGO-check fixtures and path assertions portable across Windows and POSIX hosts.
- [x] Run TypeScript checks and the complete unit test suite on Windows CI.

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
- [x] Scoped GTK stylesheet provider and GNOME Shell extension stylesheet lifecycle helpers, with native GTK4 CSS load/unload smoke coverage.
- [x] Native Adw.PreferencesWindow smoke test for compiled preferences-page mounting, visibility, GSettings interaction, three open/close cycles, view detachment and post-destruction isolation.
- [x] Verify recursive GTK widget-tree teardown disconnects nested GObject signal handlers and stops child reactive bindings.
- [x] Dispose nested GTK widget resources without redundantly removing descendants from containers that are themselves being disposed.
- [ ] Full preferences-window integration tests and remaining renderer coverage.
- [ ] Native GJS code generation and source maps.

## Native UI components
- [x] Add the initial cross-platform `GefButton` component for GNOME Shell St and GTK4.
- [x] Add `GefLabel` with reactive text on GNOME Shell St and GTK4.
- [x] Add `GefIcon` with reactive icon names on GNOME Shell St and GTK4, including a Node-GTK native smoke check.
- [x] Add `GefInput` with a reactive value and `valueChange` output on GNOME Shell St and GTK4.
- [x] Add `GefCheckbox` with a reactive checked state and `checkedChange` output on GNOME Shell St and GTK4.
- [x] Add `GefSwitch` with a reactive active state and `activeChange` output, mapping St `state` and GTK4 `active` natively.
- [x] Add `GefProgressBar` with a reactive fraction on GNOME Shell St and GTK4, including native Node-GTK smoke coverage.
- [x] Add GTPL `HeaderBar` and `Sidebar` layout containers with platform-specific default orientations.
- [x] Add the initial GTPL `Flex` container with native row/column direction, spacing and reactive direction bindings on St and GTK4.
- [x] Add GTPL `Flex` homogeneous sizing with reactive boolean bindings on St and GTK4.
- [x] Add the cross-platform GTPL `expand` child attribute with reactive GTK4 and St expansion properties.
- [x] Add GTPL `Grid` with fixed column placement and spacing on GTK4 and GNOME Shell 51.
- [ ] Connect GTPL grid columns to native width changes for responsive reflow on St and GTK4.
- [x] Keep button labels and disabled/sensitive state reactive after component creation.
- [x] Add shared responsive breakpoints, mobile-first responsive values, breakpoint observation and responsive grid position calculation.

## Styles and developer tools
- [x] SCSS compilation through the Sass CLI.
- [x] Initial GNOME theme CSS validation for unsupported browser layout declarations and block balance.
- [x] Ignore comments and quoted strings (including embedded semicolons) when checking browser-only CSS declarations, while preserving diagnostic source offsets.
- [x] Report unterminated CSS strings and comments with source positions.
- [x] Preserve CSS diagnostic line and column positions for LF, CRLF and standalone CR line endings.
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
