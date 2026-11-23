# CLI reference

The executable is named `gef`. It is included in the
`gnome-extension-framework` npm package.

Run it through npm without a global installation:

```sh
npx --yes --package gnome-extension-framework@next gef --help
```

In a source checkout, run the built CLI with `npm run gef -- <command>`.
The CLI requires Node.js 22 or newer. Commands that compile SCSS also require
the project Sass dependency; packaging and environment checks use native
GNOME tools.

## Commands

### `gef --help`

Prints usage and the command list, including \`ego-check\`. Unknown commands
and invalid required arguments return a non-zero exit code.

### `gef check <template.gtpl>`

Parses, lowers and validates a GTPL template. It prints source-positioned
diagnostics and returns a failure status when the template is invalid.

```sh
gef check src/view.gtpl
```

### `gef compile <template.gtpl> [output.js]`

Validates a template and writes a JavaScript render-function module. If the
output path is omitted, the CLI uses `<input>.js`. Missing parent directories
are created. A linked Source Map v3 file is written beside the JavaScript
output as `<output.js>.map`.

```sh
gef compile src/view.gtpl dist/view.js
```

The generated module exports the render function. The extension must supply
the runtime and native renderer when mounting generated output.

### `gef styles <input.scss> [output.css]`

Compiles SCSS with Sass, then validates the resulting stylesheet against the
current GNOME theme CSS compatibility checks. If the output path is omitted,
the CLI replaces the `.scss` suffix with `.css`. CSS diagnostics include
file, line, column and a source caret.

```sh
gef styles src/theme.scss dist/theme.css
```

This is an initial compatibility checker, not a complete validator for every
St or GTK CSS property. Keep Shell and preferences styles separate.

### `gef new <extension-name> [directory]`

Creates a minimal GNOME Shell 51 extension project. Names must start with a
lowercase letter and contain lowercase letters, digits or hyphens. The
directory defaults to the extension name.

```sh
gef new hello-world
gef new hello-world ./extensions/hello-world
```

Generated files include metadata, a TypeScript extension class, minimal GJS
declarations, TypeScript configuration, package scripts and a packaging
script. The generated UUID and metadata are examples; replace them before
distribution. Review the generated AI-assisted-code notice and do not submit
code you cannot understand and maintain.

### `gef generate component <Name> [directory]`

Generates a TypeScript component class and a matching GTPL template. The name
must be PascalCase and start with an uppercase letter. The directory defaults
to the current directory.

```sh
gef generate component UserCard src/components
```

The generated component has a `@Component` selector, a `@Input() title`
property and a template that interpolates `title`.

### `gef build`

Runs the current project's `npm run build` script. The command does not
invent a build configuration for the project; configure the script in the
project's `package.json`.

### `gef test`

Runs the current project's `npm test` script.

### `gef package`

If the current `package.json` defines a `package` script, runs that script.
Otherwise it runs `npm run build` followed by
`npm run package:example`. This fallback is intended for the GEF repository
example; an extension project should define its own packaging script.

### `gef watch`

Runs the project's `npm run dev:watch` script. The GEF repository watcher
rebuilds and restages the example when source files change.

### `gef doctor`

Checks Node.js 22+, Sass, GJS, GNOME Shell 51, GTK4, libadwaita,
`glib-compile-schemas`, `zip` and `unzip`. It reports each dependency as
available or missing and returns a failure status if any required check
fails. Some checks are relevant only to the native platform features you
intend to use.

### `gef ego-check <staged-extension-directory>`

Validates a staged extension directory. Current checks include:

- Required metadata fields, UUID syntax and Shell version list.
- Optional positive integer metadata version.
- Optional GSettings schema ID and matching packaged schema.
- Root `extension.js` entry point and default-exported class with
  `enable()` and `disable()`.
- Shell/preferences process boundaries across static local JavaScript imports.
- Unreachable JavaScript files and common development-only paths.
- Relative CSS `url()` references to packaged files.
- Advisory warnings for constructor side effects and possibly unused assets.

```sh
gef ego-check dist/extension
```

The command validates a staged directory; it does not create or inspect the
ZIP archive itself. The packaging pipeline separately checks archive
integrity, required files and development-only paths. A successful result is
not a guarantee of EGO approval.

## Exit status

- `0`: command completed successfully.
- `1`: validation, build, test, prerequisite or packaging check failed.
- `2`: invalid command arguments or an input/output operation could not be
  completed.

## Related documentation

- [Getting started](getting-started.md)
- [GTPL language](gtpl-language.md)
- [Components, directives and pipes](components.md)
- [EGO compliance](ego-compliance.md)
