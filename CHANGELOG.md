# Changelog

All notable changes to GEF are documented here. GEF uses Semantic Versioning;
pre-1.0 releases may introduce breaking changes between minor versions.

## 0.1.0-alpha.1 - Prepared 2026-11-22

First alpha candidate for GNOME Shell 51 extension development.

- TypeScript and GTPL compiler with diagnostics, component validation and Source Map v3 mappings.
- Runtime foundations for GNOME Shell St actors and GTK4/libadwaita preferences.
- Reactive bindings, dependency injection, component/directive lifecycles and scoped resource cleanup.
- `gef` CLI for checking, compiling, scaffolding, styles and EGO-oriented packaging.
- EGO-oriented metadata, process-boundary and archive validation.
- npm package metadata, compiler/runtime ESM exports and `npx` CLI support.
- CI coverage for unit tests, GTK4/libadwaita integration and clean installation of the packed npm tarball.

### Known alpha limitations

- GNOME Shell integration tests require a GNOME Shell 51 host and are not run by the standard hosted CI workflow.
- EGO lifecycle and generated-code review checks are not exhaustive; passing local checks does not guarantee EGO approval.
- St/GTK-specific CSS validation, full renderer coverage and native GJS code generation/source maps remain incomplete.
- The framework is not yet a production-complete replacement for GNOME's native APIs.
