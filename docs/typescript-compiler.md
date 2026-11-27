# TypeScript compiler

GEF exposes a TypeScript project compilation API through `gnome-extension-framework/compiler` and the `gef compile-ts` CLI command.

```ts
import { compileTypeScriptProject } from 'gnome-extension-framework/compiler';

const result = compileTypeScriptProject({
  configFilePath: 'tsconfig.json',
  outDir: 'dist',
});

if (!result.success) {
  for (const diagnostic of result.diagnostics) {
    console.error(diagnostic);
  }
}
```

The compiler reads the project's `tsconfig.json`, performs TypeScript semantic checking, and emits JavaScript plus source maps. An optional `outDir` overrides the configured output directory. Type errors prevent output emission.

## Native compilation status

This is the TypeScript frontend milestone, not yet machine-code generation. GEF applications use different platform runtimes: GJS for GNOME Shell and Node-GTK for desktop GTK. The next stages are a shared typed intermediate representation, a GTK desktop executable backend, and platform-specific packaging. GNOME Shell extensions must continue to emit JavaScript compatible with GJS; they cannot be replaced by standalone ELF binaries inside the shell process.

## CLI

```sh
gef compile-ts
gef compile-ts tsconfig.json
gef compile-ts --project tsconfig.app.json
gef compile-ts --project tsconfig.json --out-dir dist
```

The command defaults to `tsconfig.json`, accepts `--project` / `-p` and an optional `--out-dir`, prints TypeScript diagnostics, and exits non-zero when the project cannot be compiled. Existing `gef compile` remains dedicated to GTPL templates.
