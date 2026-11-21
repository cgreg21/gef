# EGO publication compliance

GEF targets extensions distributed through [extensions.gnome.org](https://extensions.gnome.org/).
The compiler, project generator and packager must produce an extension that is
straightforward for a human reviewer to inspect and maintain.

This checklist follows the current
[GNOME Shell Extensions Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
and [GNOME Extension Best Practices](https://gjs.guide/extensions/review-guidelines/best-practices.html).
Passing local checks does not guarantee EGO approval; review decisions remain
with GNOME reviewers.

## Generated JavaScript

- Emit readable, consistently formatted JavaScript.
- Never minify, obfuscate, or hide generated logic behind opaque bundles.
- Keep modules small and split code by responsibility.
- Preserve useful source locations and diagnostics.
- Avoid redundant guards, empty catch blocks, unnecessary try/catch wrappers,
  excessive comments, and generated placeholder behavior.
- Generated code must be explainable and maintainable by the extension author.
- Prefer native inferred or directly referenced types over one-use aliases.
- Keep generated build scripts linear; avoid dynamic imports and wrappers when a direct import and call suffice.

## Extension lifecycle

- Module evaluation and the extension constructor must not create dynamic
  GObjects, connect signals, install timers, or modify GNOME Shell.
- Require the Shell entry point to default-export an extension class with `enable()` and `disable()` methods.
- Create runtime objects and connect signals in `enable()`.
- Destroy created objects, disconnect signals and remove sources in
  `disable()`.
- Keep setup and cleanup easy to compare during review.
- Resource ownership must be explicit and cleanup must be deterministic.

## Process isolation

- Keep Shell code and preferences code in separate entry points and modules. The CLI follows static local imports from each entry point and checks the full JavaScript dependency graph.
- Never import `St`, `Clutter`, `Meta` or `Shell` from preferences.
- Never import `Gtk`, `Gdk` or `Adw` from Shell-only modules.
- Shared modules must not import libraries belonging to either process.

## Metadata and package contents

- Validate `metadata.json` as JSON and validate the required `uuid`,
  `name`, `description` and `shell-version` fields.
- Validate UUID syntax with non-empty, well-formed domain labels.
- Require the root `extension.js` Shell entry point in every staged extension.
- Include only unique, stable GNOME Shell versions in release metadata. If `version` is present, it must be a positive integer.
- Include `settings-schema` when the extension uses its own GSettings schema, and ensure the packaged XML or compiled schema matches the declared ID.
- The local validator checks the declared schema against staged `.gschema.xml` files, or accepts a compiled schema when source XML is not shipped.
- Include required runtime JavaScript, schemas, translations and assets only.
- Exclude build scripts, development dependencies, source maps not intended
  for distribution, tests, caches and unused files from the EGO archive.
- Do not ship binary executables or bundled external applications.

## Compiler and CLI responsibilities

The compiler must generate reviewable JavaScript, not merely syntactically
valid output. The project generator must not create empty lifecycle methods
or pretend that a placeholder extension is ready for publication.

The packager and a future EGO validation command must inspect the final
staged directory and archive, not just source files. They should report
actionable errors for metadata, process-boundary, lifecycle and package
content violations.

## AI-assisted generation notice

The GNOME best-practices guide asks AI tools to mark generated extension
files as intended for personal use unless the author understands and is
prepared to maintain the JavaScript. GEF must make this limitation explicit
in its generated-project workflow and documentation. Authors who can explain
and maintain their extension should follow the guide's instruction to remove
the notice manually before submission.

## References

- https://gjs.guide/extensions/review-guidelines/review-guidelines.html
- https://gjs.guide/extensions/review-guidelines/best-practices.html
- https://gjs.guide/extensions/overview/anatomy.html
