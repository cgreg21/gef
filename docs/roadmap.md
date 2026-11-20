# Development roadmap

## Milestone 0 — repository foundation

- [x] Create repository documentation and package/tooling baseline.
- [x] Establish GNOME Shell 51 as the first platform target.
- [x] Define `.gtpl` as the canonical template file extension.
- [x] Add an initial parser and syntax-level tests.
- [ ] Establish a reproducible lockfile and dependency audit.
- [ ] Add linting and formatting checks.

## Milestone 1 — GTPL parser

- [x] Parse nested and self-closing elements.
- [x] Parse static, property, event, two-way, structural, and local-reference attributes.
- [x] Parse text interpolation boundaries.
- [x] Produce source-located diagnostics for malformed markup.
- [x] Add an expression AST and initial expression parser.
- [x] Connect expression parsing to property, event, two-way, structural bindings, and interpolation nodes (except the dedicated `*gefFor` microsyntax).
- [x] Parse element structural shorthand `*if` / `*for`.\n- [x] Parse block control flow `@if` / `@else if` / `@else` and `@for` / `@empty`.\n- [ ] Add parser fuzzing and malformed-input corpus.

## Milestone 2 — compiler semantics

- [ ] Component metadata and selector registry.
- [ ] Renderer metadata for inputs, outputs, and supported properties.
- [ ] Expression type checking against component class members.
- [ ] Structural shorthand lowering and built-in control-flow lowering.
- [ ] Template type-check blocks and actionable diagnostics.

## Milestone 3 — runtime and Shell renderer

- [ ] Resource ownership and deterministic lifecycle cleanup.
- [ ] Dependency injection and reactive signals.
- [ ] GNOME Shell 51 St/Clutter renderer.
- [ ] Native GJS output and source maps.
- [ ] GNOME Shell 51 integration test harness.

## Milestone 4 — styles and preferences

- [ ] SCSS compilation and component style scoping.
- [ ] St CSS validator for GNOME Shell 51.
- [ ] GTK CSS validation and GTK4/libadwaita renderer.
- [ ] Theme loading and development reload support.

## Milestone 5 — developer experience

- [ ] `gef new`, `generate`, `build`, `test`, `validate`, `package`, and `doctor`.
- [ ] Watch mode and actionable diagnostics.
- [ ] Inspector and runtime diagnostics.
- [ ] Example extensions and complete documentation.
